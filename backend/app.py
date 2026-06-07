import os
from typing import Optional
print("[System] 1. 기본 라이브러리 로딩 중...")
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai

print("[System] 2-1. database 모듈 로딩 시작...")
from database import (
    init_db,
    save_message,
    get_history,
    get_full_logs,
    get_logs,
    get_logs_count,
    get_log_by_id,
)
print("[System] 2-2. database 모듈 로딩 완료! security_engine 로딩 시작...")
from security_engine import (
    rule_detect,
    analyze_with_llm,
    calculate_context_score,
    calculate_risk,
)
from labels import normalize_attack_type, normalize_intent
print("[System] 2-3. security_engine 로딩 완료!")


# =========================
# 환경변수 및 Gemini 설정
# =========================
print("[System] 3. 환경변수 및 API 설정 중...")
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GOOGLE_API_KEY:
    raise RuntimeError("GOOGLE_API_KEY가 설정되지 않았습니다.")

genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel("models/gemini-2.5-flash")


# =========================
# FastAPI 설정
# =========================
print("[System] 4. FastAPI 앱 초기화 중...")
app = FastAPI(
    title="LLM Security Diagnosis Engine",
    description="Prompt Injection 및 Jailbreak 탐지 엔진 (YARA + Embedding + LLM 가중합)",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("[System] 5. 데이터베이스 초기화 중...")
init_db()
print("[System] 6. 서버 준비 완료! Uvicorn 포트 바인딩 대기 중...")


# =========================
# 요청 모델
# =========================
class AnalyzeRequest(BaseModel):
    conversation_id: str
    user_input: str
    use_security: bool = True


# =========================
# 핵심 API: /api/analyze
# =========================
@app.post("/analyze")
@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    try:
        conversation_id = req.conversation_id.strip()
        user_input = req.user_input.strip()

        if not conversation_id:
            return {"status": "error", "message": "conversation_id가 비어 있습니다."}
        if not user_input:
            return {"status": "error", "message": "user_input이 비어 있습니다."}

        # 1. 이전 대화 (LLM 컨텍스트 + Context 점수 둘 다 사용)
        history = get_history(conversation_id)
        context_text = "\n".join(f"{m['role']}: {m['content']}" for m in history)

        # 2. 3-tier 탐지
        rule_result = rule_detect(user_input)
        llm_result = analyze_with_llm(user_input, context_text, model)
        context_score = calculate_context_score(history)

        # 3. 가중합 + override + fail-soft
        risk_result = calculate_risk(rule_result, llm_result, context_score)

        # 4. attack_type / intent 한국어 정규화
        #    intent 는 LLM enum 좁은 매핑, attack_type 은 룰 영문 라벨까지 포함하는 broad 매핑
        intent = normalize_intent(llm_result["intent"])
        raw_attack_type = (
            rule_result["attack_type"]
            if rule_result.get("detected")
            else llm_result["intent"]
        )
        attack_type = normalize_attack_type(raw_attack_type)

        # 5. 백엔드 로그 (한 줄 요약)
        truncated = user_input if len(user_input) <= 80 else user_input[:77] + "..."
        override_marker = " override=true" if risk_result["override"] else ""
        print(
            f'[INFO] input="{truncated}" '
            f'rule={risk_result["rule_score"]} '
            f'llm={risk_result["llm_score"]} '
            f'context={risk_result["context_score"]} '
            f'final={risk_result["final_risk_score"]} '
            f'mode={risk_result["scoring_mode"]} '
            f'decision={risk_result["decision"]}{override_marker}'
        )

        # 6. decision별 사용자 메시지 (use_security=False면 Block도 통과)
        if req.use_security and risk_result["decision"] == "Block":
            action, status, security_result = (
                "차단", "blocked",
                "공격 가능성이 높아 LLM 애플리케이션으로 전달하지 않고 차단합니다.",
            )
        elif risk_result["decision"] == "Warning":
            action, status, security_result = (
                "경고", "warning",
                "주의가 필요한 입력입니다. 관리자 확인 후 LLM 전달 여부를 결정해야 합니다.",
            )
        else:
            action, status, security_result = (
                "허용", "success",
                "정상 입력으로 판단되어 LLM 애플리케이션에 전달 가능합니다.",
            )

        # 7. DB 저장
        # role=user: 간단히 (attack_type, risk_score 만 의미 있음)
        save_message(
            conversation_id=conversation_id,
            role="user",
            content=user_input,
            attack_type=attack_type,
            risk_score=risk_result["final_risk_score"],
        )
        # role=security_engine: 분석 결과 전체 저장 (intent 도 정규화된 값 사용)
        save_message(
            conversation_id=conversation_id,
            role="security_engine",
            content=security_result,
            attack_type=attack_type,
            risk_score=risk_result["final_risk_score"],
            decision=risk_result["decision"],
            final_risk_score=risk_result["final_risk_score"],
            rule_score=risk_result["rule_score"],
            llm_score=risk_result["llm_score"],
            context_score=risk_result["context_score"],
            intent=intent,
            reason=llm_result["reason"],
            confidence=llm_result["confidence"],
            matched_rules=rule_result["matched_rules"],
            override=risk_result["override"],
            scoring_mode=risk_result["scoring_mode"],
        )

        # 8. 응답 (신규 11개 필드 + 기존 호환 필드)
        return {
            "decision":         risk_result["decision"],
            "final_risk_score": risk_result["final_risk_score"],
            "override":         risk_result["override"],
            "scoring_mode":     risk_result["scoring_mode"],
            "rule_score":       risk_result["rule_score"],
            "llm_score":        risk_result["llm_score"],
            "context_score":    risk_result["context_score"],
            "matched_rules":    rule_result["matched_rules"],
            "intent":           intent,
            "reason":           llm_result["reason"],
            "confidence":       llm_result["confidence"],
            # legacy
            "status":           status,
            "attack_type":      attack_type,
            "risk_score":       risk_result["final_risk_score"],
            "action":           action,
            "security_result":  security_result,
            "rule_result":      rule_result,
            "llm_analysis":     llm_result,
        }

    except Exception as e:
        print("서버에러:", e)
        return {"status": "error", "message": str(e)}


# =========================
# 로그 조회 API
# =========================
@app.get("/history/{conversation_id}")
@app.get("/api/history/{conversation_id}")
async def get_logs_history(conversation_id: str):
    try:
        logs = get_full_logs(conversation_id.strip())
        return logs if logs else []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/logs")
@app.get("/api/logs")
async def list_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    decision: Optional[str] = Query(None, description="Allow / Warning / Block"),
    from_date: Optional[str] = Query(None, description="ISO 8601 (inclusive)"),
    to_date: Optional[str] = Query(None, description="ISO 8601 (inclusive)"),
    conversation_id: Optional[str] = Query(None),
):
    """탐지 로그 목록 (페이지네이션 + 필터).

    role='security_engine' row 만 최신순으로 반환.
    """
    try:
        total = get_logs_count(
            decision=decision,
            from_date=from_date,
            to_date=to_date,
            conversation_id=conversation_id,
        )
        items = get_logs(
            limit=limit,
            offset=offset,
            decision=decision,
            from_date=from_date,
            to_date=to_date,
            conversation_id=conversation_id,
        )
        return {"total": total, "items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/logs/{log_id}")
@app.get("/api/logs/{log_id}")
async def get_log_detail(log_id: int):
    """단건 로그 상세. matched_rules 는 list 로 deserialize 되어 반환."""
    try:
        log = get_log_by_id(log_id)
        if log is None:
            raise HTTPException(status_code=404, detail="Log not found")
        return log
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
