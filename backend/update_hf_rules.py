import re
from datasets import load_dataset

def is_korean_or_english(text):
    if re.search(r'[가-힣]', text):
        return True
    german_pattern = re.compile(r'\b(und|der|die|das|ich|ist|nicht|zu|mit|auf|für|sich|ein|eine)\b|[äöüß]', re.IGNORECASE)
    if german_pattern.search(text):
        return False
    return True

def text_to_yara_regex(text):
    """
    원문을 YARA가 인식할 수 있는 강력한 정규식으로 변환합니다.
    예: "Forget all rules." -> /Forget\s+all\s+rules/i
    """
    # 1. 마침표, 쉼표 등 특수문자 제거 (오직 알파벳, 숫자, 한글만 남김)
    clean_text = re.sub(r'[^\w\s가-힣]', '', text)
    
    # 2. 공백 기준으로 단어 분리
    words = clean_text.split()
    
    # 3. 단어가 너무 적으면(3단어 미만) 오탐 위험이 커서 버림
    if len(words) < 3:
        return None
        
    # 4. 너무 긴 문장은 앞의 15단어(핵심 의도)만 추출해서 패턴화
    core_words = words[:15]
    
    # 5. 단어들을 \s+ (1개 이상의 공백이나 줄바꿈)으로 연결
    regex_pattern = r'\s+'.join(core_words)
    
    # 6. YARA 정규식 포맷(/.../i)으로 반환
    return f"/{regex_pattern}/i"

def generate_hf_yara():
    print("Hugging Face에서 데이터셋 로드 중...")
    
    dataset = load_dataset("deepset/prompt-injections", split="train")
    injections = dataset.filter(lambda x: x['label'] == 1)

    yara_content = """/* Auto-generated Smart Regex Rules from Hugging Face */
rule HF_Prompt_Injection_Smart_Regex {
    meta:
        description = "띄어쓰기, 마침표, 줄바꿈 우회를 차단하는 정규식 기반 블랙리스트"
        risk_score = 100
    strings:
"""
    count = 0
    for row in injections:
        text = row['text']
        
        if not is_korean_or_english(text):
            continue

        # 🌟 핵심: 단순 문자열($str_0 = "...")이 아닌 유연한 정규식($re_0 = /.../)으로 변환
        yara_regex = text_to_yara_regex(text)
        
        if yara_regex:
            yara_content += f'        $re_{count} = {yara_regex}\n'
            count += 1

    yara_content += """
    condition:
        any of them
}
"""
    with open("hf_injections.yar", "w", encoding="utf-8") as f:
        f.write(yara_content)
    
    print(f"성공! 마침표/띄어쓰기 우회를 방어하는 {count}개의 정규식 패턴이 저장되었습니다.")

if __name__ == "__main__":
    generate_hf_yara()