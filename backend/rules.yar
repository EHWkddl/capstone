// rules.yar
rule Prompt_Injection {
    meta:
        description = "프롬프트 인젝션 시도 탐지"
        risk_score = 80
    strings:
        $re1 = /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|commands?)/ nocase
        $re2 = /system\s+prompt/ nocase
        $kr1 = /이전\s*지시.*무시/
        $kr2 = /시스템\s*프롬프트.*보여/
    condition:
        any of them
}

rule Jailbreak {
    meta:
        description = "탈옥(Jailbreak) 시도 탐지"
        risk_score = 80
    strings:
        $re1 = /(you\s*are\s*now|acting\s*as|become)\s+.*(dan|developer\s*mode|jailbroken)/ nocase
        $re2 = /(no\s*limitations?|without\s*any\s*restrictions?)/ nocase
        $kr1 = /지금부터\s*(너는|당신은)\s*.*(역할|모드)/
        $kr2 = /제약\s*(없이|없는|사항을\s*무시)/
    condition:
        any of them
}