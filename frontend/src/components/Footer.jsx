import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <strong>Prompta</strong>
          <p>LLM 애플리케이션 앞단에서 입력 위험을 진단하는 보안 게이트웨이</p>
        </div>
        <nav className="site-footer-links" aria-label="Footer navigation">
          <Link to="/console">보안 검사</Link>
          <Link to="/logs">탐지 로그</Link>
          <Link to="/criteria">탐지 기준</Link>
          <Link to="/guide">사용 가이드</Link>
        </nav>
        <p className="site-footer-copy">
          YDB Team · © 2026 YDB Team. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default Footer
