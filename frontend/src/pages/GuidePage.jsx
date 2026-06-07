/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'

/* ============= Code samples ============= */

const CODE_SAMPLES = {
  curl: `curl -X POST http://localhost:8000/api/analyze \\
  -H "Content-Type: application/json" \\
  -d '{
    "conversation_id": "user-session-001",
    "user_input": "오늘 날씨 알려줘",
    "use_security": true
  }'`,
  python: `import requests

response = requests.post(
    "http://localhost:8000/api/analyze",
    json={
        "conversation_id": "user-session-001",
        "user_input": "오늘 날씨 알려줘",
        "use_security": True
    }
)
result = response.json()

if result["decision"] == "Block":
    return {"error": "차단된 요청입니다"}
elif result["decision"] == "Warning":
    log_warning(result)

# Allow 또는 Warning 시 LLM 호출 진행`,
  javascript: `const response = await fetch("http://localhost:8000/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    conversation_id: "user-session-001",
    user_input: "오늘 날씨 알려줘",
    use_security: true
  })
})
const result = await response.json()

if (result.decision === "Block") {
  showError("차단된 요청입니다")
  return
}
// Allow 또는 Warning 시 LLM 호출 진행`,
}

const TABS = [
  { key: 'curl', label: 'curl' },
  { key: 'python', label: 'Python' },
  { key: 'javascript', label: 'JavaScript' },
]

const REQUEST_FIELDS = [
  {
    name: 'conversation_id',
    type: 'string',
    required: true,
    desc: '대화 세션 고유 ID. 멀티턴 추적용',
  },
  {
    name: 'user_input',
    type: 'string',
    required: true,
    desc: '사용자가 입력한 프롬프트 텍스트',
  },
  {
    name: 'use_security',
    type: 'boolean',
    required: false,
    desc: '보안 진단 활성화 여부 (기본 true)',
  },
]

const RESPONSE_FIELDS = [
  { name: 'decision', type: 'string', desc: '"Allow" / "Warning" / "Block"' },
  { name: 'final_risk_score', type: 'number', desc: '0~100 최종 위험 점수' },
  { name: 'rule_score', type: 'number', desc: 'YARA 룰 1차 점수' },
  { name: 'llm_score', type: 'number', desc: 'Gemini 의미 분석 점수' },
  { name: 'context_score', type: 'number', desc: '이전 대화 누적 점수' },
  { name: 'attack_type', type: 'string', desc: '공격 유형 한국어 라벨' },
  { name: 'intent', type: 'string', desc: 'LLM 분석 의도 분류' },
  { name: 'reason', type: 'string', desc: '판단 근거 텍스트' },
  { name: 'confidence', type: 'number', desc: 'LLM 신뢰도 (0.0~1.0)' },
  { name: 'matched_rules', type: 'array', desc: '매칭된 룰 목록' },
  { name: 'override', type: 'boolean', desc: '강제 차단 발동 여부' },
  { name: 'scoring_mode', type: 'string', desc: '"normal" / "fail_soft"' },
]

const CHECKLIST = [
  {
    text: (
      <>
        <strong>Block</strong> 응답 시 LLM 호출을 차단하고 사용자에게 에러
        메시지를 표시하세요.
      </>
    ),
  },
  {
    text: (
      <>
        <strong>Warning</strong> 응답 시 로그를 남기고 운영자 모니터링 대상에
        포함하세요.
      </>
    ),
  },
  {
    text: (
      <>
        <strong>conversation_id</strong> 는 사용자 세션 단위로 유지해 멀티턴
        추적이 가능하도록 하세요.
      </>
    ),
  },
  {
    text: (
      <>
        <strong>scoring_mode</strong> 가 <code>"fail_soft"</code> 인 경우 LLM
        API 장애 상태이므로 별도 알림을 권장합니다.
      </>
    ),
  },
  {
    text: (
      <>
        <strong>matched_rules</strong> 와 <strong>reason</strong> 필드를 로그에
        함께 보관해 사후 분석에 활용하세요.
      </>
    ),
  },
]

const FAQ = [
  {
    q: 'Block 점수의 임계값을 조정할 수 있나요?',
    a: '현재 임계값(70점)은 백엔드 설정 파일에서 변경 가능합니다. 다만 OWASP 권장 패턴에 따라 70점을 기본값으로 유지하는 것을 권장합니다.',
  },
  {
    q: 'LLM API 호출 비용은 어떻게 절감할 수 있나요?',
    a: 'YARA 룰에서 명백한 공격은 LLM 호출 없이 즉시 차단됩니다. 또한 Fail-Soft 정책으로 LLM 미호출 환경에서도 Rule 기반으로 운영 가능합니다.',
  },
  {
    q: '다국어 입력은 지원하나요?',
    a: '현재 한국어와 영어를 우선 지원합니다. 룰셋에 두 언어 변형이 모두 포함되어 있으며, Gemini 의미 분석은 다국어를 자연어 그대로 처리합니다.',
  },
  {
    q: 'YDB TEAM에는 누가 있나요?',
    a: '팀장 정효민, 백엔드 개발자 이예빈, 프론트엔드 개발자 김정서, 보안과 AI에 관심이 많은 장준서와 안태규가 있습니다.',
  },
]

/* ============= Page ============= */

function GuidePage() {
  const [activeTab, setActiveTab] = useState('curl')
  const [copied, setCopied] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CODE_SAMPLES[activeTab])
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch (e) {
      // clipboard 가 차단된 환경 — fallback 표시만 짧게 보여줌
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    }
  }

  const toggleFaq = (idx) => {
    setOpenFaq((current) => (current === idx ? -1 : idx))
  }

  return (
    <div className="docs-page">
      <header className="docs-header">
        <span className="docs-header-icon" aria-hidden="true">
          <IconBookOpen size={36} />
        </span>
        <div className="docs-header-text">
          <h1>사용 가이드</h1>
          <p>
            Prompta 보안진단 API 를 외부 서비스에서 활용하는 방법을 안내합니다.
          </p>
        </div>
      </header>

      {/* ====== Section 1: Quick start (3 STEP) ====== */}
      <section className="docs-section">
        <h2 className="docs-section-title">1. 빠른 시작</h2>
        <p className="docs-section-desc">
          세 단계로 게이트웨이를 통합할 수 있습니다.
        </p>

        <div className="guide-step-grid">
          <article className="guide-step-card">
            <span className="guide-step-number">01</span>
            <h3 className="guide-step-title">엔드포인트 호출</h3>
            <p className="guide-step-desc">
              POST /api/analyze 에 사용자 입력을 전송합니다.
            </p>
          </article>

          <article className="guide-step-card">
            <span className="guide-step-number">02</span>
            <h3 className="guide-step-title">응답 분석</h3>
            <p className="guide-step-desc">
              decision 필드 값에 따라 LLM 전달 여부를 결정합니다.
            </p>
          </article>

          <article className="guide-step-card">
            <span className="guide-step-number">03</span>
            <h3 className="guide-step-title">정책 적용</h3>
            <p className="guide-step-desc">
              Block / Warning / Allow 에 맞춰 사용자에게 응답을 처리합니다.
            </p>
          </article>
        </div>
      </section>

      {/* ====== Section 2: API 호출 예시 (tabs + copy) ====== */}
      <section className="docs-section">
        <h2 className="docs-section-title">2. API 호출 예시</h2>
        <p className="docs-section-desc">
          요청 본문에 <code>conversation_id</code>, <code>user_input</code>,{' '}
          <code>use_security</code> 세 필드를 포함하세요. 멀티턴 분석을
          활용하려면 <code>conversation_id</code> 를 같은 세션에서 일관되게
          유지합니다.
        </p>

        <div className="guide-code-card">
          <div className="guide-code-header">
            <div className="guide-code-tabs" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`guide-code-tab${
                    activeTab === tab.key ? ' is-active' : ''
                  }`}
                  onClick={() => {
                    setActiveTab(tab.key)
                    setCopied(false)
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`guide-copy-btn${copied ? ' is-copied' : ''}`}
              onClick={handleCopy}
              aria-label="코드 복사"
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
          <pre className="guide-code-block">
            <code>{CODE_SAMPLES[activeTab]}</code>
          </pre>
        </div>
      </section>

      {/* ====== Section 3: 요청 / 응답 필드 명세 ====== */}
      <section className="docs-section">
        <h2 className="docs-section-title">3. 요청 · 응답 필드 명세</h2>
        <p className="docs-section-desc">
          API 가 받는 요청 본문과 반환하는 응답 본문의 필드 구조입니다.
        </p>

        <div className="guide-fields-row">
          <div>
            <h3 className="guide-fields-block-title">요청 (Request)</h3>
            <table className="guide-field-table">
              <thead>
                <tr>
                  <th>필드명</th>
                  <th>타입</th>
                  <th>필수</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {REQUEST_FIELDS.map((field) => (
                  <tr key={field.name}>
                    <td>
                      <span className="guide-field-name">{field.name}</span>
                    </td>
                    <td>
                      <span className="guide-field-type">{field.type}</span>
                    </td>
                    <td>
                      {field.required ? (
                        <span className="guide-field-required">필수</span>
                      ) : (
                        <span className="guide-field-optional">선택</span>
                      )}
                    </td>
                    <td className="guide-field-desc">{field.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="guide-fields-block-title">응답 (Response)</h3>
            <table className="guide-field-table">
              <thead>
                <tr>
                  <th>필드명</th>
                  <th>타입</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {RESPONSE_FIELDS.map((field) => (
                  <tr key={field.name}>
                    <td>
                      <span className="guide-field-name">{field.name}</span>
                    </td>
                    <td>
                      <span className="guide-field-type">{field.type}</span>
                    </td>
                    <td className="guide-field-desc">{field.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ====== Section 4: 운영 권장사항 ====== */}
      <section className="docs-section">
        <h2 className="docs-section-title">4. 운영 권장사항</h2>
        <p className="docs-section-desc">
          실제 서비스에서 게이트웨이를 안정적으로 운영하기 위한
          체크리스트입니다.
        </p>

        <div className="docs-card">
          <ul className="guide-checklist">
            {CHECKLIST.map((item, idx) => (
              <li key={idx} className="guide-checklist-item">
                <span className="guide-checklist-icon" aria-hidden="true">
                  <IconCheck size={14} />
                </span>
                <p className="guide-checklist-text">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ====== Section 5: FAQ ====== */}
      <section className="docs-section">
        <h2 className="docs-section-title">5. 자주 묻는 질문</h2>
        <p className="docs-section-desc">
          통합 과정에서 자주 받는 질문을 정리했습니다.
        </p>

        <div className="guide-faq">
          {FAQ.map((item, idx) => {
            const isOpen = openFaq === idx
            return (
              <div
                key={idx}
                className={`guide-faq-item${isOpen ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="guide-faq-question"
                  aria-expanded={isOpen}
                  onClick={() => toggleFaq(idx)}
                >
                  <span className="guide-faq-q-prefix">Q.</span>
                  <span className="guide-faq-q-text">{item.q}</span>
                  <span className="guide-faq-chevron" aria-hidden="true">
                    <IconChevronDown size={18} />
                  </span>
                </button>
                {isOpen && (
                  <div className="guide-faq-answer-wrap">
                    <p className="guide-faq-answer">
                      <span className="guide-faq-a-prefix">A.</span>
                      <span>{item.a}</span>
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default GuidePage

/* ============= Inline icons ============= */

function IconBookOpen({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function IconCopy({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconCheck({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconChevronDown({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
