import { Fragment, useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useInView,
  useAnimation,
  useMotionValue,
  useScroll,
  useTransform,
} from 'framer-motion'
import { Link } from 'react-router-dom'
import logo from '../assets/prompta-logo.png'

const SLIDE_COUNT = 6

function HomePage() {
  const containerRef = useRef(null)
  const slide1Ref = useRef(null)
  const slide2Ref = useRef(null)
  const slide3Ref = useRef(null)
  const slide4Ref = useRef(null)
  const slide5Ref = useRef(null)
  const slide6Ref = useRef(null)
  const slideRefs = [
    slide1Ref,
    slide2Ref,
    slide3Ref,
    slide4Ref,
    slide5Ref,
    slide6Ref,
  ]

  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let rafId = null

    const updateActive = () => {
      rafId = null
      const center = container.scrollTop + container.clientHeight / 2
      let idx = 0
      slideRefs.forEach((r, i) => {
        if (!r.current) return
        const el = r.current
        const top = el.offsetTop
        const bottom = top + el.offsetHeight
        if (center >= top && center < bottom) {
          idx = i
        }
      })
      setActiveIndex(idx)
    }

    const onScroll = () => {
      if (rafId == null) {
        rafId = requestAnimationFrame(updateActive)
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    updateActive()

    return () => {
      container.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrollToSlide = (idx) => {
    slideRefs[idx]?.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <div className="home-slides" ref={containerRef}>
      <IntroTransitionSection slideRef={slide1Ref} containerRef={containerRef} />
      <ScrollRevealSection slideRef={slide2Ref} containerRef={containerRef} />
      <Slide3Result slideRef={slide3Ref} containerRef={containerRef} />
      <Slide4Features slideRef={slide4Ref} />
      <Slide5HowItWorks slideRef={slide5Ref} />
      <Slide6CTA slideRef={slide6Ref} />

      <nav className="home-dots" aria-label="페이지 슬라이드 탐색">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={`home-dot${activeIndex === i ? ' active' : ''}`}
            onClick={() => scrollToSlide(i)}
            aria-label={`슬라이드 ${i + 1}로 이동`}
            aria-current={activeIndex === i ? 'true' : undefined}
          />
        ))}
      </nav>
    </div>
  )
}

/* ============= Slides 1-2: Intro transition ============= */

function IntroTransitionSection({ slideRef, containerRef }) {
  const introProgress = useMotionValue(0)

  useEffect(() => {
    const container = containerRef.current
    const section = slideRef.current
    if (!container || !section) return

    let rafId = null

    const updateProgress = () => {
      rafId = null
      const start = section.offsetTop
      const travel = Math.max(
        1,
        section.offsetHeight - container.clientHeight,
      )
      const raw = (container.scrollTop - start) / travel
      introProgress.set(Math.min(1, Math.max(0, raw)))
    }

    const requestUpdate = () => {
      if (rafId == null) rafId = requestAnimationFrame(updateProgress)
    }

    container.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    updateProgress()

    return () => {
      container.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [containerRef, introProgress, slideRef])

  const heroOpacity = useTransform(
    introProgress,
    [0, 0.16, 0.36, 0.42],
    [1, 1, 0, 0],
  )
  const heroScale = useTransform(
    introProgress,
    [0, 0.16, 0.42],
    [1, 1, 0.76],
  )
  const heroY = useTransform(
    introProgress,
    [0, 0.16, 0.42],
    [0, 0, -64],
  )
  const heroBlur = useTransform(
    introProgress,
    [0.18, 0.42],
    ['blur(0px)', 'blur(6px)'],
  )
  const whyOpacity = useTransform(introProgress, [0.46, 0.74, 1], [0, 1, 1])
  const whyScale = useTransform(introProgress, [0.46, 0.74, 1], [0.88, 1, 1])
  const whyY = useTransform(introProgress, [0.46, 0.74, 1], [60, 0, 0])

  return (
    <section ref={slideRef} className="intro-transition-section">
      <div className="intro-transition-sticky">
        <motion.div
          className="intro-panel intro-hero-panel"
          style={{
            opacity: heroOpacity,
            scale: heroScale,
            y: heroY,
            filter: heroBlur,
          }}
        >
          <img src={logo} alt="Prompta" className="hero-logo" />
          <h1 className="hero-title">Prompta</h1>
          <p className="hero-sub">
            LLM 애플리케이션 앞단에서 프롬프트 인젝션을 막는 보안 진단 게이트웨이
          </p>
          <p className="hero-by">by YDB Team</p>

          <div className="scroll-indicator-anchor">
            <motion.div
              className="scroll-indicator"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span>스크롤하여 시작</span>
              <IconArrowDown size={20} />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="intro-panel intro-why-panel"
          style={{ opacity: whyOpacity, scale: whyScale, y: whyY }}
        >
          <h2 className="slide-title">LLM 앞단, 보호받지 못한 입력이 있다면?</h2>
          <div className="why-cards">
            {WHY_CARDS.map((card) => {
              const { Icon, title, desc } = card
              return (
                <article key={title} className="why-card">
                  <Icon size={32} />
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </article>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ============= Slide 3: Scroll Reveal ============= */

function ScrollRevealSection({ slideRef, containerRef }) {
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: slideRef,
    offset: ['start start', 'end end'],
  })
  const fillSize = useTransform(
    scrollYProgress,
    [0.08, 0.82, 1],
    ['0% 100%, 100% 100%', '100% 100%, 100% 100%', '100% 100%, 100% 100%'],
  )

  return (
    <section ref={slideRef} className="scroll-fill-outer">
      <div className="scroll-fill-sticky">
        <motion.h2
          className="scroll-fill-text"
          style={{ backgroundSize: fillSize }}
        >
          프롬프트가 LLM에 도달하기 전,
          <br />
          Prompta가 먼저 위험을 진단합니다.
        </motion.h2>
      </div>
    </section>
  )
}

/* ============= Slide 2: Why (3 cards) ============= */

const WHY_CARDS = [
  {
    Icon: IconAlertTriangle,
    title: '기존 지시 무시',
    desc: '이전 지시 잊어 같은 명령으로 시스템 프롬프트를 무력화하는 공격',
  },
  {
    Icon: IconEye,
    title: '시스템 프롬프트 노출',
    desc: '내부 지시문을 탈취해 안전장치를 우회하는 시도',
  },
  {
    Icon: IconKey,
    title: '민감정보 요구',
    desc: 'API 키, 토큰 등 실제 값을 직접 요구하는 공격',
  },
]

/* ============= Slide 3: Result (single big box) ============= */

function Slide3Result({ slideRef, containerRef }) {
  const isInView = useInView(slideRef, {
    root: containerRef,
    amount: 0.4,
  })
  const boxControls = useAnimation()
  const titleControls = useAnimation()
  const bodyControls = useAnimation()
  const emphasisControls = useAnimation()

  useEffect(() => {
    if (isInView) {
      boxControls.start({
        opacity: 1,
        scale: 1,
        transition: { duration: 0.6, ease: 'easeOut' },
      })
      titleControls.start({
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, delay: 0.2, ease: 'easeOut' },
      })
      bodyControls.start({
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, delay: 0.4, ease: 'easeOut' },
      })
      emphasisControls.start({
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, delay: 0.6, ease: 'easeOut' },
      })
    } else {
      boxControls.start({
        opacity: 0,
        scale: 0.7,
        transition: { duration: 0.4, ease: 'easeIn' },
      })
      titleControls.start({
        opacity: 0,
        y: 20,
        transition: { duration: 0.3, ease: 'easeIn' },
      })
      bodyControls.start({
        opacity: 0,
        y: 20,
        transition: { duration: 0.3, ease: 'easeIn' },
      })
      emphasisControls.start({
        opacity: 0,
        y: 20,
        transition: { duration: 0.3, ease: 'easeIn' },
      })
    }
  }, [isInView, boxControls, titleControls, bodyControls, emphasisControls])

  return (
    <section ref={slideRef} className="slide slide-result">
      <motion.div
        className="result-box"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={boxControls}
      >
        <div className="result-box-top">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={titleControls}>
            단순한
            <br />
            키워드 필터로는
            <br />
            막을 수 없습니다.
          </motion.h2>
        </div>
        <div className="result-box-bottom">
          <motion.div
            className="result-body-text"
            initial={{ opacity: 0, y: 20 }}
            animate={bodyControls}
          >
            <p>공격자는 의미를 우회하기에</p>
            <p>같은 단어라도 의도가 다르면 다르게 다뤄져야 합니다.</p>
          </motion.div>
          <motion.p
            className="emphasis"
            initial={{ opacity: 0, y: 20 }}
            animate={emphasisControls}
          >
            Rule + LLM 의미 분석 + Context 의 다층 방어가 핵심입니다.
          </motion.p>
        </div>
      </motion.div>
    </section>
  )
}

/* ============= Slide 4: Features ============= */

const FEATURES = [
  {
    Icon: IconShieldCheck,
    theme: 'rule',
    accent: '#4a9eff',
    accentRgb: '74, 158, 255',
    title: 'Rule 기반 1차 탐지',
    oneLine: 'YARA 룰과 정규표현식으로 위험 후보를 빠르게 식별',
    body: '명확한 공격 패턴을 먼저 걸러내고, 한국어와 영어 변형 표현까지 빠르게 스캔합니다.',
    weight: '가중치 0.4',
    tags: ['YARA', 'Regex', 'Scan Line', 'Pattern Filter'],
  },
  {
    Icon: IconSparkles,
    theme: 'llm',
    accent: '#a78bfa',
    accentRgb: '167, 139, 250',
    title: 'LLM 의미 분석',
    oneLine: 'LLM이 입력 의도와 문맥을 분석해 실제 공격 여부를 판단',
    body: '표면 키워드가 아니라 문장의 의도, 역할 변경 시도, 우회 표현을 함께 해석합니다.',
    weight: '가중치 0.5',
    tags: ['Intent', 'Semantic', 'LLM Judge', 'Meaning Graph'],
  },
  {
    Icon: IconLayers,
    theme: 'context',
    accent: '#2dd4bf',
    accentRgb: '45, 212, 191',
    title: 'Context 문맥 분석',
    oneLine: '이전 대화 기록을 기반으로 누적 우회 시도와 멀티턴 공격을 평가',
    body: '단일 입력만 보지 않고 대화 흐름의 누적 위험을 계산해 점진적인 공격 패턴을 탐지합니다.',
    weight: '가중치 0.1',
    tags: ['Timeline', 'Multi-turn', 'Memory', 'Layered Flow'],
  },
]

function Slide4Features({ slideRef }) {
  const [activeFeature, setActiveFeature] = useState(0)
  const activeSlide = FEATURES[activeFeature]
  const ActiveFeatureIcon = activeSlide.Icon

  const goFeature = (direction) => {
    setActiveFeature((current) => {
      const next = current + direction
      if (next < 0) return FEATURES.length - 1
      if (next >= FEATURES.length) return 0
      return next
    })
  }

  return (
    <section ref={slideRef} className="slide slide-features">
      <div className="feature-carousel">
        <div className="feature-carousel-top">
          <h2 className="feature-section-title">3중 방어 구조</h2>
          <span className="feature-count">
            {activeFeature + 1} / {FEATURES.length}
          </span>
        </div>

        <div className="feature-slider-window">
          <AnimatePresence mode="wait">
            <motion.article
              key={activeSlide.title}
              className={`feature-slide-card feature-slide-${activeSlide.theme}`}
              style={{
                '--accent': activeSlide.accent,
                '--accent-rgb': activeSlide.accentRgb,
              }}
              initial={{
                opacity: 0,
                scale: 0.78,
                y: 40,
                borderRadius: 48,
                boxShadow: '0 38px 120px rgba(0, 0, 0, 0.52)',
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                borderRadius: 0,
                boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
              }}
              exit={{
                opacity: 0,
                scale: 0.92,
                y: -12,
                filter: 'brightness(0.72) blur(2px)',
              }}
              transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="feature-slide-copy">
                <span className="feature-weight-badge">
                  {activeSlide.weight}
                </span>
                <h3 className="feature-title">{activeSlide.title}</h3>
                <p className="feature-oneline">{activeSlide.oneLine}</p>
                <p className="feature-body">{activeSlide.body}</p>
                <div className="feature-tag-row">
                  {activeSlide.tags.map((tag) => (
                    <span key={tag} className="feature-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="feature-slide-visual" aria-hidden="true">
                <span className="feature-orbit orbit-one" />
                <span className="feature-orbit orbit-two" />
                <span className="feature-scan-line" />
                <span className="feature-node node-a" />
                <span className="feature-node node-b" />
                <span className="feature-node node-c" />
                <span className="feature-icon">
                  <ActiveFeatureIcon size={48} />
                </span>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        <div className="feature-indicators" aria-label="3중 방어 구조 슬라이드">
          {FEATURES.map((feature, index) => (
            <button
              key={feature.title}
              type="button"
              className={`feature-indicator${
                activeFeature === index ? ' active' : ''
              }`}
              onClick={() => setActiveFeature(index)}
              aria-label={`${index + 1}번째 방어 구조 보기`}
              aria-current={activeFeature === index ? 'true' : undefined}
            />
          ))}
        </div>

        <button
          type="button"
          className="feature-nav-btn feature-nav-prev"
          onClick={() => goFeature(-1)}
          aria-label="이전 방어 구조 보기"
        >
          <IconArrowLeft size={22} />
        </button>
        <button
          type="button"
          className="feature-nav-btn feature-nav-next"
          onClick={() => goFeature(1)}
          aria-label="다음 방어 구조 보기"
        >
          <IconArrowRight size={22} />
        </button>
      </div>
    </section>
  )
}

/* ============= Slide 5: How it Works ============= */

function Slide5HowItWorks({ slideRef }) {
  const flowNodes = [
    { label: '사용자 입력', Icon: IconMessage },
    { label: '1차 Rule', Icon: IconShieldCheck },
    { label: '2차 LLM', Icon: IconSparkles },
    { label: '3차 Context', Icon: IconLayers },
    { label: '가중 합산', Icon: IconScale },
    { label: '판정', Icon: IconCheckShield },
  ]
  return (
    <section ref={slideRef} className="slide slide-how">
      <h2 className="slide-title">동작 구조</h2>
      <div className="flow-diagram">
        {flowNodes.map((node, i) => {
          const { Icon, label } = node
          const isLast = i === flowNodes.length - 1
          return (
            <Fragment key={label}>
              <div className="flow-node">
                <Icon size={28} />
                <span className="flow-node-label">{label}</span>
              </div>
              {!isLast && (
                <span className="flow-arrow" aria-hidden="true">
                  →
                </span>
              )}
            </Fragment>
          )
        })}
      </div>
      <div className="flow-formula">
        Final Risk Score = Rule × 0.4 + LLM × 0.5 + Context × 0.1
      </div>
    </section>
  )
}

/* ============= Slide 6: CTA ============= */

function Slide6CTA({ slideRef }) {
  return (
    <section ref={slideRef} className="slide slide-cta">
      <h2 className="cta-title">직접 진단해보세요</h2>
      <p className="cta-sub">
        프롬프트를 입력하고 위험도를 즉시 확인할 수 있습니다.
      </p>
      <div className="cta-button-wrap">
        <Link to="/console" className="cta-button">
          보안 검사 시작하기
          <IconArrowRight size={20} />
        </Link>
      </div>
    </section>
  )
}

/* ============= Icons (inline lucide-style) ============= */

function IconArrowDown({ size = 20 }) {
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
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  )
}

function IconArrowRight({ size = 20 }) {
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
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

function IconArrowLeft({ size = 20 }) {
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
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}

function IconAlertTriangle({ size = 36 }) {
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
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconEye({ size = 36 }) {
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconKey({ size = 36 }) {
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
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  )
}

function IconMessage({ size = 28 }) {
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconShieldCheck({ size = 28 }) {
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
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function IconSparkles({ size = 28 }) {
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
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  )
}

function IconLayers({ size = 28 }) {
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
      <path d="m12 2 9 5-9 5-9-5z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  )
}

function IconScale({ size = 28 }) {
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
      <path d="M12 3v18" />
      <path d="M3 7h18" />
      <path d="m6 7-3 6a4 4 0 0 0 6 0z" />
      <path d="m18 7-3 6a4 4 0 0 0 6 0z" />
      <path d="M6 21h12" />
    </svg>
  )
}

function IconCheckShield({ size = 28 }) {
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
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export default HomePage
