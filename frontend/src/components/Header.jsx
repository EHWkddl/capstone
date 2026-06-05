import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import logo from '../assets/prompta-logo.png'

const NAV_ITEMS = [
  { to: '/', label: '홈', end: true },
  { to: '/console', label: '보안 검사' },
  { to: '/logs', label: '탐지 로그' },
  { to: '/criteria', label: '탐지 기준' },
  { to: '/test', label: '테스트 검증' },
  { to: '/guide', label: '사용 가이드' },
]

function Header() {
  // 다크모드 토글은 placeholder. 다음 단계에서 실제 기능 연결.
  const [isDark, setIsDark] = useState(true)

  return (
    <header className="gnb">
      <div className="gnb-inner">
        <Link to="/" className="gnb-logo" aria-label="Prompta 홈으로">
          <img src={logo} alt="Prompta" className="gnb-logo-img" />
        </Link>

        <nav className="gnb-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'gnb-link active' : 'gnb-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="gnb-theme-toggle"
          onClick={() => setIsDark((v) => !v)}
          aria-label="테마 전환 (준비 중)"
          title="테마 전환 (준비 중)"
        >
          {isDark ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          )}
        </button>
      </div>
    </header>
  )
}

export default Header
