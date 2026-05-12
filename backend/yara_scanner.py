# yara_scanner.py
import yara
import os

class YaraScanner:
    def __init__(self, rule_path: str = "index.yar"):
        """서버 시작 시 YARA 룰을 한 번만 컴파일하여 메모리에 적재합니다."""
        if not os.path.exists(rule_path):
            raise FileNotFoundError(f"YARA 룰 파일을 찾을 수 없습니다: {rule_path}")
        
        self.rules = yara.compile(filepath=rule_path)

    def analyze(self, text: str) -> dict:
        """텍스트를 분석하여 기존 rule_detect와 동일한 형식의 딕셔너리를 반환합니다."""
        matches = self.rules.match(data=text)
        
        if matches:
            match = matches[0] # 가장 먼저 매칭된 룰 적용 (필요시 여러 개 처리 가능)
            
            # 1. 일단 YARA 룰 이름(예: Prompt_Injection)을 변환
            attack_type = match.rule.replace("_", " ") 
            
            # 2. 룰 이름에 "HF" 또는 "Blacklist"가 포함된 경우 Prompt Injection으로 간주
            if "HF" in match.rule or "Blacklist" in match.rule:
                attack_type = "HF Prompt Injection"
            
            return {
                "detected": True,
                "attack_type": attack_type,
                "risk_score": match.meta.get("risk_score", 100), # HF 룰에 risk_score가 없다면 기본값 100 부여
                "reason": f"YARA Rule matched: {match.rule}"
            }

        return {
            "detected": False,
            "attack_type": "Normal",
            "risk_score": 0,
            "reason": "No rule matched"
        }