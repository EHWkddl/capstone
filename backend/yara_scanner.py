import yara
import os

class YaraScanner:
    def __init__(self, rule_path: str = "index.yar"):
        """서버 시작 시 YARA 룰을 메모리에 적재"""

        if not os.path.exists(rule_path):
            raise FileNotFoundError(
                f"YARA 룰 파일을 찾을 수 없습니다: {rule_path}"
            )

        try:
            self.rules = yara.compile(
                filepath=rule_path
            )

        except yara.Error as e:

            if (
                "Illegal byte sequence" in str(e)
                or "invalid" in str(e)
            ):

                print(
                    f"💡 [알림] {rule_path} 한글 인코딩 감지 → UTF-8 로드"
                )

                with open(
                    rule_path,
                    "r",
                    encoding="utf-8"
                ) as f:

                    rule_text=f.read()

                self.rules=yara.compile(
                    source=rule_text
                )

            else:
                raise e


    def analyze(self,text:str)->dict:
        """텍스트 분석 후 위험도 계산"""

        matches=self.rules.match(
            data=text
        )

        if matches:

            total_risk_score=0

            detected_attacks=[]

            reasons=[]

            matched_rules=[]


            for match in matches:

                score=match.meta.get(
                    "risk_score",
                    0
                )

                severity=match.meta.get(
                    "severity",
                    "low"
                )

                # =====================
                # severity 가중치
                # =====================
                if severity=="critical":

                    score=int(
                        score*1.5
                    )

                elif severity=="medium":

                    score=int(
                        score*1.2
                    )

                total_risk_score+=score

                detected_attacks.append(
                    match.rule
                )

                # 화면 표시용
                display_score=min(
                    score,
                    100
                )

                reasons.append(
                    f"[{match.rule}] 매칭 (+{display_score}점)"
                )

                matched_rules.append({

                    "rule":
                    match.rule,

                    # 내부 계산값
                    "raw_score":
                    score,

                    # 화면 표시용
                    "display_score":
                    display_score,

                    "severity":
                    severity,

                    "reason":
                    f"{match.rule} 탐지"

                })


            return{

                "detected":
                True,

                # 최종 점수는 최대100
                "risk_score":
                min(
                    total_risk_score,
                    100
                ),

                "attack_types":
                list(
                    set(
                        detected_attacks
                    )
                ),

                "matched_rules":
                matched_rules,

                "reasons":
                reasons
            }


        return{

            "detected":
            False,

            "risk_score":
            0,

            "attack_types":
            ["Normal"],

            "matched_rules":
            [],

            "reasons":
            ["탐지된 위협 패턴 없음"]
        }