import os
from yara_scanner import YaraScanner

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RULE_PATH = os.path.join(BASE_DIR, "index.yar")

# 서버 시작 시 YARA 스캐너를 메모리에 올립니다.
scanner = YaraScanner(rule_path=RULE_PATH)

def rule_detect(user_input: str):
    return scanner.analyze(user_input)

def calculate_risk(rule_result, llm_result):
    score = 0

    if rule_result.get("detected"):
        yara_score = rule_result.get("risk_score", 100) 
        score += yara_score

    # 3. LLM 탐지 시: +40점
    if llm_result.get("detected"):
        score += 40

    final_score = min(score, 100)

    # 4. 차단 기준 (80점 이상이면 무조건 Block)
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