import sqlite3
from datetime import datetime

DB_NAME = "chat_logs.db"


def init_db():
    """데이터베이스 및 테이블 초기화"""
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS chat_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        attack_type TEXT,
        risk_score INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)

    conn.commit()
    conn.close()


def save_message(conversation_id, role, content, attack_type=None, risk_score=0):
    """보안 진단 결과를 로그 테이블에 저장"""
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO chat_logs
    (conversation_id, role, content, attack_type, risk_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (
        conversation_id,
        role,
        content,
        attack_type,
        risk_score,
        datetime.now().isoformat()
    ))

    conn.commit()
    conn.close()


def get_history(conversation_id, limit=10):
    """이전 대화 기록 10개 조회 (Gemini 문맥 분석용)"""
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
    SELECT role, content
    FROM chat_logs
    WHERE conversation_id = ?
    ORDER BY id DESC
    LIMIT ?
    """, (conversation_id, limit))

    rows = cur.fetchall()
    conn.close()

    rows.reverse()

    return [
        {
            "role": role,
            "content": content
        }
        for role, content in rows
    ]


# ⭐ [정서 님 추가 기능] 웹 화면 맨 아래 '탐지 로그' 출력용 전체 조회 함수
def get_full_logs(conversation_id):
    """특정 conversation_id의 탐지 데이터를 프론트엔드 형식에 맞춰 전부 가져옵니다."""
    conn = sqlite3.connect(DB_NAME)
    # 데이터를 튜플이 아니라 딕셔너리(Key: Value) 형태로 반환받기 위한 설정
    conn.row_factory = sqlite3.Row  
    cur = conn.cursor()
    
    cur.execute("""
    SELECT conversation_id, role, content, attack_type, risk_score, created_at
    FROM chat_logs
    WHERE conversation_id = ?
    ORDER BY id DESC
    """, (conversation_id,))
    
    rows = cur.fetchall()
    conn.close()
    
    # 프론트엔드가 JSON 형식으로 바로 받아 쓰도록 파이썬 dict 리스트로 가공
    return [dict(row) for row in rows]