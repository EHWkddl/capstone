import yara
import os

class YaraScanner:
    def __init__(self, rule_path: str = "index.yar"):
        """서버 시작 시 YARA 룰을 메모리에 적재합니다."""
        if not os.path.exists(rule_path):
            raise FileNotFoundError(f"YARA 룰 파일을 찾을 수 없습니다: {rule_path}")
        
        try:
            # 한글 인코딩 방어 로직
            self.rules = yara.compile(filepath=rule_path)
        except yara.Error as e:
            if "Illegal byte sequence" in str(e) or "invalid" in str(e):
                print(f"💡 [알림] {rule_path} 한글 인코딩 감지! UTF-8로 로드합니다.")
                with open(rule_path, 'r', encoding='utf-8') as f:
                    rule_text = f.read()
                self.rules = yara.compile(source=rule_text)
            else:
                raise e

    def analyze(self, text: str) -> dict:
        """탐지된 룰의 개수에 따라 점수를 차등 부여합니다."""
        if not hasattr(self, 'rules'):
            return {"detected": False, "attack_type": "Error", "risk_score": 0, "reason": "YARA 엔진 로드 실패"}

        matches = self.rules.match(data=text)
        
        if matches:
            # [복구] 탐지된 룰 개수에 따른 점수 산출
            match_count = len(matches)
            
            if match_count == 1:
                risk_score = 40   # 주의
                decision = "Warning"
            elif match_count == 2:
                risk_score = 75   # 위험
                decision = "Danger"
            else:
                risk_score = 100  # 차단
                decision = "Block"

            # 첫 번째 매칭된 룰 기준으로 정보 생성
            main_match = matches[0]
            attack_type = main_match.rule.replace("_", " ")
            
            if "HF" in main_match.rule or "Injection" in main_match.rule or "Blacklist" in main_match.rule:
                attack_type = "AI Prompt Injection"

            return {
                "detected": True,
                "attack_type": attack_type,
                "risk_score": risk_score,
                "decision": decision,
                "reason": f"보안 규칙 {match_count}개 일치: {main_match.rule}",
                "match_count": match_count
            }

        return {
            "detected": False,
            "attack_type": "Normal",
            "risk_score": 0,
            "decision": "Allow",
            "reason": "탐지된 위협 패턴 없음"
        }