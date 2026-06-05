import json
import sqlite3
from datetime import datetime

from labels import normalize_attack_type

DB_NAME = "chat_logs.db"


# =========================
# 스키마 / 마이그레이션
# =========================

def _ensure_column(conn, col_name, col_type, default=None):
    """기존 chat_logs 테이블에 컬럼이 없으면 ALTER TABLE 로 추가 (idempotent)."""
    cur = conn.execute("PRAGMA table_info(chat_logs)")
    existing = {row[1] for row in cur.fetchall()}
    if col_name in existing:
        return
    default_clause = f" DEFAULT {default}" if default is not None else ""
    conn.execute(
        f"ALTER TABLE chat_logs ADD COLUMN {col_name} {col_type}{default_clause}"
    )


def init_db():
    """데이터베이스 및 테이블 초기화.

    - 신규 설치: 확장 스키마로 CREATE TABLE
    - 기존 설치: 누락된 컬럼만 ALTER TABLE 로 추가 (1,091 row 보존)
    """
    conn = sqlite3.connect(DB_NAME)

    conn.execute("""
    CREATE TABLE IF NOT EXISTS chat_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        attack_type TEXT,
        risk_score INTEGER DEFAULT 0,
        decision TEXT,
        final_risk_score INTEGER DEFAULT 0,
        rule_score INTEGER DEFAULT 0,
        llm_score INTEGER DEFAULT 0,
        context_score INTEGER DEFAULT 0,
        intent TEXT,
        reason TEXT,
        confidence REAL DEFAULT 0,
        matched_rules TEXT,
        override INTEGER DEFAULT 0,
        scoring_mode TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # 기존 테이블에 누락된 컬럼이 있으면 추가
    _ensure_column(conn, "decision", "TEXT")
    _ensure_column(conn, "final_risk_score", "INTEGER", default="0")
    _ensure_column(conn, "rule_score", "INTEGER", default="0")
    _ensure_column(conn, "llm_score", "INTEGER", default="0")
    _ensure_column(conn, "context_score", "INTEGER", default="0")
    _ensure_column(conn, "intent", "TEXT")
    _ensure_column(conn, "reason", "TEXT")
    _ensure_column(conn, "confidence", "REAL", default="0")
    _ensure_column(conn, "matched_rules", "TEXT")
    _ensure_column(conn, "override", "INTEGER", default="0")
    _ensure_column(conn, "scoring_mode", "TEXT")

    conn.commit()
    conn.close()

    # Legacy row 백필 (idempotent — decision IS NULL 만 대상)
    migrated = migrate_legacy_decisions()
    print(f"[Migration] Legacy decisions backfilled: {migrated} rows")


def migrate_legacy_decisions():
    """기존 security_engine row 중 decision 이 채워지지 않은 것을 risk_score 기반으로 백필.

    동시에 attack_type 도 한국어로 정규화한다.
    이미 decision 이 있는 row 는 건너뜀 (idempotent — 재시작마다 호출되어도 안전).

    Rules:
      - risk_score >= 70 → 'Block'
      - risk_score >= 30 → 'Warning'
      - 그 외           → 'Allow'
      - final_risk_score = risk_score
      - attack_type = normalize_attack_type(원본)
      - intent / reason / matched_rules / override 등은 NULL 유지

    반환: 업데이트된 row 수
    """
    conn = sqlite3.connect(DB_NAME)
    cur = conn.execute(
        """
        SELECT id, attack_type, risk_score
        FROM chat_logs
        WHERE role = 'security_engine' AND decision IS NULL
        """
    )
    rows = cur.fetchall()

    updated = 0
    for row_id, raw_attack_type, risk_score in rows:
        rs = int(risk_score or 0)
        if rs >= 70:
            decision = "Block"
        elif rs >= 30:
            decision = "Warning"
        else:
            decision = "Allow"

        normalized_attack = normalize_attack_type(raw_attack_type)

        conn.execute(
            """
            UPDATE chat_logs
            SET decision = ?,
                final_risk_score = ?,
                attack_type = ?
            WHERE id = ?
            """,
            (decision, rs, normalized_attack, row_id),
        )
        updated += 1

    conn.commit()
    conn.close()
    return updated


# =========================
# 쓰기
# =========================

def save_message(
    conversation_id,
    role,
    content,
    attack_type=None,
    risk_score=0,
    decision=None,
    final_risk_score=0,
    rule_score=0,
    llm_score=0,
    context_score=0,
    intent=None,
    reason=None,
    confidence=0.0,
    matched_rules=None,
    override=False,
    scoring_mode=None,
):
    """보안 진단 결과를 로그 테이블에 저장.

    role='user' 인 경우 attack_type/risk_score 만 의미 있고
    나머지 신규 컬럼은 기본값(NULL / 0) 으로 저장된다.
    role='security_engine' 인 경우 전체 필드가 의미 있음.
    """
    # matched_rules 는 list 로 받아서 JSON 문자열로 직렬화
    if matched_rules is None:
        matched_rules_value = None
    elif isinstance(matched_rules, str):
        matched_rules_value = matched_rules
    else:
        try:
            matched_rules_value = json.dumps(
                matched_rules, ensure_ascii=False
            )
        except (TypeError, ValueError):
            matched_rules_value = json.dumps([str(matched_rules)])

    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO chat_logs (
            conversation_id, role, content,
            attack_type, risk_score,
            decision, final_risk_score,
            rule_score, llm_score, context_score,
            intent, reason, confidence,
            matched_rules, override, scoring_mode,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            conversation_id,
            role,
            content,
            attack_type,
            risk_score,
            decision,
            final_risk_score,
            rule_score,
            llm_score,
            context_score,
            intent,
            reason,
            float(confidence) if confidence is not None else 0.0,
            matched_rules_value,
            int(bool(override)),
            scoring_mode,
            datetime.now().isoformat(),
        ),
    )

    conn.commit()
    conn.close()


# =========================
# 기존 조회 (시그니처 보존)
# =========================

def get_history(conversation_id, limit=10):
    """이전 대화 기록 N개 조회 (Gemini 문맥 분석용).

    role + content 만 반환. 신규 컬럼 추가 후에도 동작 동일.
    """
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT role, content
        FROM chat_logs
        WHERE conversation_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (conversation_id, limit),
    )

    rows = cur.fetchall()
    conn.close()

    rows.reverse()

    return [{"role": role, "content": content} for role, content in rows]


def get_full_logs(conversation_id):
    """특정 conversation_id 의 탐지 데이터를 프론트엔드 형식에 맞춰 전부 반환.

    기존 /api/history/{conv_id} 라우트와 호환 유지를 위해
    기존 컬럼 셋(conversation_id, role, content, attack_type,
    risk_score, created_at) 만 반환한다.
    """
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        """
        SELECT conversation_id, role, content, attack_type, risk_score,
               created_at
        FROM chat_logs
        WHERE conversation_id = ?
        ORDER BY id DESC
        """,
        (conversation_id,),
    )

    rows = cur.fetchall()
    conn.close()

    return [dict(row) for row in rows]


# =========================
# 신규: 로그 페이지용 조회
# =========================

def _build_log_filters(decision, from_date, to_date, conversation_id):
    """공통 WHERE 절 빌더. role='security_engine' 고정 + 선택 필터."""
    where = ["role = 'security_engine'"]
    params = []
    if decision is not None and decision != "":
        where.append("decision = ?")
        params.append(decision)
    if conversation_id is not None and conversation_id != "":
        where.append("conversation_id = ?")
        params.append(conversation_id)
    if from_date is not None and from_date != "":
        where.append("created_at >= ?")
        params.append(from_date)
    if to_date is not None and to_date != "":
        where.append("created_at <= ?")
        params.append(to_date)
    return " AND ".join(where), params


def get_logs(
    limit=50,
    offset=0,
    decision=None,
    from_date=None,
    to_date=None,
    conversation_id=None,
):
    """로그 페이지용 요약 조회.

    role='security_engine' row 만 최신순으로 반환.
    페이지네이션 + (decision / 날짜 / conv_id) 필터.
    """
    where_sql, params = _build_log_filters(
        decision, from_date, to_date, conversation_id
    )

    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    sql = f"""
    SELECT id, conversation_id, content, attack_type, decision,
           final_risk_score, intent, created_at
    FROM chat_logs
    WHERE {where_sql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
    """
    cur.execute(sql, (*params, int(limit), int(offset)))
    rows = cur.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def get_logs_count(
    decision=None,
    from_date=None,
    to_date=None,
    conversation_id=None,
):
    """동일 필터를 적용한 총 row 수 (페이지네이션용)."""
    where_sql, params = _build_log_filters(
        decision, from_date, to_date, conversation_id
    )

    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    sql = f"SELECT COUNT(*) FROM chat_logs WHERE {where_sql}"
    cur.execute(sql, params)
    count = cur.fetchone()[0]
    conn.close()
    return int(count)


def get_log_by_id(log_id):
    """단건 상세 (모든 컬럼). matched_rules 는 list 로 복원, override 는 bool."""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, conversation_id, role, content,
               attack_type, risk_score,
               decision, final_risk_score,
               rule_score, llm_score, context_score,
               intent, reason, confidence,
               matched_rules, override, scoring_mode,
               created_at
        FROM chat_logs
        WHERE id = ?
        """,
        (log_id,),
    )

    row = cur.fetchone()
    conn.close()

    if row is None:
        return None

    result = dict(row)

    # matched_rules JSON 문자열 → list 복원
    raw_rules = result.get("matched_rules")
    if raw_rules:
        try:
            result["matched_rules"] = json.loads(raw_rules)
        except (json.JSONDecodeError, TypeError):
            result["matched_rules"] = []
    else:
        result["matched_rules"] = []

    # override 0/1 → bool
    result["override"] = bool(result.get("override") or 0)

    return result
