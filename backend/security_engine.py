print("[Engine Debug] 1. security_engine 진입 성공!")
import os

print("[Engine Debug] 2. yara_scanner 불러오는 중...")
from yara_scanner import YaraScanner

print("[Engine Debug] 3. embedding_scanner 불러오는 중...")
from embedding_scanner import EmbeddingScanner

print("[Engine Debug] 4. 함수 정의 단계 진입...")

def get_yara_scanner():
    # global 변수 대신 함수 자체에 저장하여 에러 원천 차단
    if not hasattr(get_yara_scanner, "instance"):
        print("[System] YARA 스캐너 로딩 중...")
        from yara_scanner import YaraScanner
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        RULE_PATH = os.path.join(BASE_DIR, "hf_injections.yar")
        get_yara_scanner.instance = YaraScanner(rule_path=RULE_PATH)
        print("[System] YARA 스캐너 로딩 완료!")
    return get_yara_scanner.instance    

def get_embedding_scanner():
    # global 변수 대신 함수 자체에 저장하여 에러 원천 차단
    if not hasattr(get_embedding_scanner, "instance"):
        print("[System] Embedding 스캐너 로딩 시작 (잠시만 기다려주세요)...")
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        get_embedding_scanner.instance = EmbeddingScanner(
            db_path=os.path.join(BASE_DIR, "vector_db"),
            seed_file=os.path.join(BASE_DIR, "seeds.json")
        )
        print("[System] Embedding 스캐너 로딩 완료!")
    return get_embedding_scanner.instance

def rule_detect(user_input: str):
    y_scanner = get_yara_scanner()
    e_scanner = get_embedding_scanner()
    
    yara_result = y_scanner.analyze(user_input)
    embed_result = e_scanner.analyze(user_input)
    
    yara_score = yara_result.get("risk_score", 0) if yara_result.get("detected") else 0
    embed_score = embed_result.get("risk_score", 0) if embed_result.get("detected") else 0
    
    if yara_score >= embed_score and yara_score > 0:
        return yara_result
    elif embed_score > yara_score:
        return embed_result
        
    return {"detected": False, "risk_score": 0, "attack_type": "None"}

def calculate_risk(rule_result, llm_result):
    yara_score = rule_result.get("risk_score", 0) if rule_result.get("detected") else 0
    llm_score = llm_result.get("risk_score", 40) if llm_result.get("detected") else 0

    final_score = max(yara_score, llm_score)
    final_score = min(final_score, 100)

    if final_score >= 80:
        decision = "Block"
    elif final_score >= 40:
        decision = "Warning"
    else:
        decision = "Allow"

    reason = "정상적인 입력으로 판단되었습니다."
    final_attack_type = "None"

    if decision != "Allow":
        if yara_score >= llm_score:
            final_attack_type = rule_result.get("attack_type", "Unknown Pattern")
            reason = f"[1차 필터] 문법/의미 분석 엔진에서 악성 패턴 '{final_attack_type}'이(가) 탐지되었습니다. (적용 점수: {yara_score}점)"
        else:
            final_attack_type = llm_result.get("attack_type", "LLM Detected Anomaly")
            reason = f"[2차 필터] LLM 심층 분석 결과, 우회 및 인젝션 의도가 다분한 '{final_attack_type}'(으)로 판단되었습니다. (적용 점수: {llm_score}점)"

    return {
        "risk_score": final_score,
        "decision": decision,
        "attack_type": final_attack_type,
        "final_reason": reason
    }