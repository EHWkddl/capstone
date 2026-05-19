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
        """텍스트를 분석하여 모든 매칭 룰의 위험도를 합산합니다."""
        matches = self.rules.match(data=text)
        
        if matches:
            total_risk_score = 0
            detected_attacks = []
            reasons = []

            # 매칭된 모든 룰을 순회하며 점수 합산
            for match in matches:
                # 룰의 meta 데이터에서 risk_score 추출 (기본값 0)
                score = match.meta.get("risk_score", 0)
                total_risk_score += score
                
                detected_attacks.append(match.rule)
                reasons.append(f"[{match.rule}] 매칭 (+{score}점)")

            return {
                "detected": total_risk_score > 0,
                "risk_score": total_risk_score,
                "attack_types": list(set(detected_attacks)), 
                "reasons": reasons
            }

        return {
            "detected": False,
            "risk_score": 0,
            "attack_types": "Normal",
            "reasons": ["탐지된 위협 패턴 없음"]
        }