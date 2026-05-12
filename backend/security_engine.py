import os
from yara_scanner import YaraScanner

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RULE_PATH = os.path.join(BASE_DIR, "index.yar")

# 서버 시작 시 YARA 스캐너를 메모리에 올립니다.
scanner = YaraScanner(rule_path=RULE_PATH)

def rule_detect(user_input: str):
    return scanner.analyze(user_input)

def calculate_risk(rule_result, llm_result):
    # 1. 기본 점수는 YARA 엔진의 점수를 그대로 가져옵니다 (40, 75, 100 등)
    score = rule_result.get("risk_score", 0)

    # 2. LLM(Gemini)이 추가로 탐지했다면 가산점을 줍니다.
    # 단, YARA가 이미 100점(Block)이면 더 이상 더할 필요 없겠죠?
    if llm_result.get("detected") and score < 100:
        score += 40

    # 3. 최종 점수는 100점을 넘지 않도록 커트!
    final_score = min(score, 100)

    # 4. 차단 기준 설정
    if final_score >= 80:
        decision = "Block"
    elif final_score >= 40:
        decision = "Warning"
    else:
        decision = "Allow"

    return {
        "risk_score": final_score,
        "decision": decision,
    }