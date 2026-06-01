import os

import yara

SEVERITY_MULT = {"critical": 1.5, "medium": 1.2, "low": 1.0}


class YaraScanner:
    def __init__(self, rule_path: str = "hf_injections.yar"):
        """YARA 룰 컴파일. 한글 인코딩 오류 시 UTF-8 source 로 폴백 컴파일."""
        if not os.path.exists(rule_path):
            raise FileNotFoundError(f"YARA 룰 파일을 찾을 수 없습니다: {rule_path}")

        try:
            self.rules = yara.compile(filepath=rule_path)
        except yara.Error as e:
            msg = str(e)
            if "Illegal byte sequence" in msg or "invalid" in msg:
                print(f"[YARA] {rule_path} 한글 인코딩 감지 → UTF-8 source 재컴파일")
                with open(rule_path, "r", encoding="utf-8") as f:
                    self.rules = yara.compile(source=f.read())
            else:
                raise

    def analyze(self, text: str) -> dict:
        """
        텍스트에 YARA 룰을 매칭하고 결과를 dict로 반환.

        Returns:
            {
                "detected":            bool,
                "risk_score":          int,         # 매칭 룰들 중 (meta.risk_score * severity 가중치)의 MAX, 100 clamp
                "attack_type":         str,         # 최고점 룰의 meta.category, 없으면 rule 이름 변환
                "matched_rules":       List[Dict],  # [{rule, category, score, severity, reason}]
                "matched_categories":  List[str],   # 각 매치의 category (없으면 ""), matched_rules와 병렬
                "reason":              str,         # 사람이 읽는 요약
            }

        meta.risk_score 기본값 50.
        severity: "critical"(1.5x), "medium"(1.2x), "low"(1.0x).
        """
        matches = self.rules.match(data=text)

        if not matches:
            return {
                "detected": False,
                "risk_score": 0,
                "attack_type": "None",
                "matched_rules": [],
                "matched_categories": [],
                "reason": "탐지된 위협 패턴 없음",
            }

        rule_details = []
        for m in matches:
            base = int(m.meta.get("risk_score", 50))
            sev = m.meta.get("severity", "low")
            cat = m.meta.get("category", "")
            scaled = min(int(base * SEVERITY_MULT.get(sev, 1.0)), 100)
            rule_details.append({
                "rule": m.rule,
                "category": cat,
                "score": scaled,
                "severity": sev,
                "reason": f"[{m.rule}] 매칭 (+{scaled}점)",
            })

        # MAX 기반 점수 (가산 X — 우리 설계)
        top = max(rule_details, key=lambda r: r["score"])

        if top["category"]:
            attack_type = top["category"]
        elif "HF" in top["rule"] or "Blacklist" in top["rule"]:
            attack_type = "HF Prompt Injection"
        else:
            attack_type = top["rule"].replace("_", " ")

        return {
            "detected": True,
            "risk_score": top["score"],
            "attack_type": attack_type,
            "matched_rules": rule_details,
            "matched_categories": [r["category"] for r in rule_details],
            "reason": f"YARA 매칭: {', '.join(r['rule'] for r in rule_details)}",
        }
