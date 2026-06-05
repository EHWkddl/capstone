"""공격 유형 라벨 한국어 정규화.

DB 와 /api/analyze 응답에 들어가는 attack_type 값을
사용자에게 보이기 좋은 한국어 표기로 통일한다.

매핑 규칙
- 영문 카테고리 (YARA meta.category, legacy labels) → 한국어
- 한글 enum (LLM intent: 지시_무시 등) → 공백 형태로 정규화
- 매핑이 없는 값은 그대로 반환 (안전한 폴백)
"""

ATTACK_TYPE_KO = {
    # 영문 → 한국어
    "Prompt Injection": "프롬프트 인젝션",
    "HF Prompt Injection": "프롬프트 인젝션",
    "Prompt_Injection": "프롬프트 인젝션",
    "HF_Prompt_Injection_High_Risk": "프롬프트 인젝션",
    "Jailbreak": "탈옥",
    "Normal": "정상",
    "Suspected_Variant": "의심 변종",

    # LLM intent 한글 enum (underscore → space)
    "정상": "정상",
    "개념_설명": "개념 설명",
    "지시_무시": "지시 무시",
    "역할_변경": "역할 변경",
    "프롬프트_노출_요구": "프롬프트 노출 요구",
    "민감정보_요구": "민감정보 요구",
    "안전정책_우회": "안전 정책 우회",

    # 신규 룰 카테고리 (이미 공백)
    "기존 지시 무시 및 변경": "기존 지시 무시 및 변경",
}


def normalize_attack_type(raw):
    """공격 유형 라벨을 한국어 표기로 정규화.

    raw 가 None / 빈 문자열이면 '정상' 반환.
    매핑이 없는 값은 원본 그대로 반환.
    """
    if not raw:
        return "정상"
    return ATTACK_TYPE_KO.get(raw, raw)


# =========================
# LLM intent 정규화 (underscore → space)
# =========================
# 7개 enum 한정. attack_type 정규화와 별도로 두는 이유:
# - attack_type 은 룰 영문 라벨까지 포함하는 broad mapping
# - intent 는 LLM 응답 enum 만 다루는 좁은 매핑
INTENT_KO = {
    "정상": "정상",
    "개념_설명": "개념 설명",
    "지시_무시": "지시 무시",
    "역할_변경": "역할 변경",
    "프롬프트_노출_요구": "프롬프트 노출 요구",
    "민감정보_요구": "민감정보 요구",
    "안전정책_우회": "안전 정책 우회",
}


def normalize_intent(raw):
    """LLM intent 한글 enum 을 공백 표기로 정규화.

    raw 가 None / 빈 문자열이면 '정상' 반환.
    매핑이 없는 값은 원본 그대로 반환.
    """
    if not raw:
        return "정상"
    return INTENT_KO.get(raw, raw)
