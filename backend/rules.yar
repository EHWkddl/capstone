// rules.yar

rule Prompt_Injection
{
    meta:
        description = "프롬프트 인젝션 시도 탐지"
        risk_score = 80
        severity = "critical"

    strings:
        $re1 = /ignore\s+(all\s+|the\s+)?(previous|above|prior)\s+(instructions?|prompts?|commands?)/ nocase
        $re3 = /(forget|disregard|reset|wipe|drop|skip|throw\s+away)\s+(all\s+|the\s+|your\s+|our\s+)?(previous|prior|above|earlier|prompt|instructions?|commands?|tasks?|context|guidelines?|setup|conversation|messages?)/ nocase
        $re4 = /pretend\s+(the\s+|your\s+|all\s+)?\w*\s*(was|were)?\s*(never|not)\s+(given|provided|set|exist)/ nocase
        $re5 = /(we\s+(agreed|discussed)|earlier\s+we|as\s+we\s+(agreed|discussed)|remember\s+(we|you)\s+said|building\s+on\s+our|reverting\s+to\s+our)/ nocase
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

        $re3 = /(without\s+(any\s+)?(refusal|moderation|filter|safety|guardrails?|disclaimer)|as\s+if\s+\w+\s+had\s+no\s+(moderation|filter|safety)|skip\s+the\s+disclaimer)/ nocase

        $re2 = /(no\s*limitations?|without\s*any\s*restrictions?)/ nocase

        $kr1 = /(DAN|탈옥|무제한|해커|개발자\s*모드|jailbreak)/

        $kr2 = /(제약|제한|규칙|필터링|검열)\s*(없이|를\s*신경\s*쓰지|을\s*깨고)|(제약|제한)\s*없이/

    condition:
        any of them
}