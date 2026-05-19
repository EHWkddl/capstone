import os
from yara_scanner import YaraScanner


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RULE_PATH = os.path.join(BASE_DIR, "index.yar")


# 서버 시작 시 YARA 스캐너 메모리 적재
scanner = YaraScanner(rule_path=RULE_PATH)


def rule_detect(user_input: str):
    return scanner.analyze(user_input)


def calculate_risk(rule_result, llm_result):

    # YARA 기본 점수
    score = rule_result.get(
        "risk_score",
        0
    )


    matched_rules = rule_result.get(
        "matched_rules",
        []
    )


    # LLM 탐지 결과 반영
    # llm_result 예:
    # {
    #   "detected":True
    # }

    if (
        llm_result
        and llm_result.get(
            "detected",
            False
        )
        and score < 100
    ):

        llm_bonus = 40

        score += llm_bonus


        matched_rules.append({

            "rule":"LLM_Detection",

            "score":llm_bonus,

            "severity":"medium",

            "reason":
            "LLM 의미 기반 위험 탐지"

        })


    # 최대 점수 제한
    final_score=min(
        score,
        100
    )


    # 최종 판단
    if final_score>=80:

        decision="Block"

    elif final_score>=40:

        decision="Warning"

    else:

        decision="Allow"


    # 최종 판단 근거
    if matched_rules:

        final_reason=", ".join(

            [
                x["rule"]
                for x in matched_rules
            ]

        )

    else:

        final_reason="탐지된 위협 없음"


    return{

        "risk_score":
        final_score,

        "decision":
        decision,

        "matched_rules":
        matched_rules,

        "final_reason":
        final_reason
    }