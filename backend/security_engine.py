import re

RULES = {
    "Prompt Injection": [
        "ignoreallpreviousinstructions",
        "ignore previous instructions",
        "ignore all previous instructions",
        "이전지시사항을무시",
        "이전 지시사항을 무시",
        "이전지시를무시",
        "이전 지시를 무시",
        "규칙을무시",
        "규칙을 무시",
        "systemprompt",
        "system prompt",
        "[system]",
        "reveal system prompt",
        "show system prompt",
        "비밀번호를알려",
        "비밀번호를 알려",
    ],
    "Jailbreak": [
        "youaredan",
        "you are dan",
        "do anything now",
        "제약없는ai",
        "제약 없는 ai",
        "제한없이",
        "제한 없이",
        "bypass safety",
        "roleplay as",
    ],
}


def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"\s+", "", text)
    return text


def rule_detect(user_input: str):
    normalized_input = normalize_text(user_input)

    for attack_type, patterns in RULES.items():
        for pattern in patterns:
            normalized_pattern = normalize_text(pattern)

            if normalized_pattern in normalized_input:
                return {
                    "detected": True,
                    "attack_type": attack_type,
                    "risk_score": 80,
                    "reason": f"Rule matched: {pattern}",
                }

    return {
        "detected": False,
        "attack_type": "Normal",
        "risk_score": 0,
        "reason": "No rule matched",
    }


def calculate_risk(rule_result, llm_result):
    score = 0

    if rule_result.get("detected"):
        score += 60

    if llm_result.get("detected"):
        score += 40

    if score >= 80:
        decision = "Block"
    elif score >= 40:
        decision = "Warning"
    else:
        decision = "Allow"

    return {
        "risk_score": min(score, 100),
        "decision": decision,
    }