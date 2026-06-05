import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: '홈', end: true },
  { to: '/console', label: '보안 검사' },
  { to: '/logs', label: '탐지 로그' },
  { to: '/criteria', label: '탐지 기준' },
  { to: '/test', label: '테스트 검증' },
  { to: '/guide', label: '사용 가이드' },
]

// 사이드바 골격만. 표시/숨김 제어는 다음 단계 (홈 페이지 마지막 슬라이드에서만 등장).
function Sidebar() {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive ? 'sidebar-link active' : 'sidebar-link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
