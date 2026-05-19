// rules.yar

rule Prompt_Injection
{
    meta:
        description = "프롬프트 인젝션 시도 탐지"
        risk_score = 80
        severity = "critical"

    strings:
        $re1 = /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|commands?)/ nocase
        $re2 = /system\s+prompt/ nocase
        $kr1 = /이전\s*지시.*무시/
        $kr2 = /시스템\s*프롬프트.*보여/

    condition:
        any of them
}


rule Jailbreak
{
    meta:
        description = "탈옥(Jailbreak) 시도 탐지"
        risk_score = 80
        severity = "critical"

    strings:

        $re1 = /(you\s*are\s*now|acting\s*as|become)\s+.*(dan|developer\s*mode|jailbroken|unrestricted)/ nocase

        $re2 = /(no\s*limitations?|without\s*any\s*restrictions?)/ nocase

        $kr1 = /(DAN|탈옥|무제한|해커|개발자\s*모드|jailbreak)/

        $kr2 = /(제약|제한|규칙).{0,20}(무시|우회|해제)/

    condition:
        any of them
}