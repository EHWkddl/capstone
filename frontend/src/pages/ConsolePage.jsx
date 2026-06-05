import SecurityConsole from '../components/SecurityConsole'

function ConsolePage() {
  return (
    <div className="console-page-container">
      <header className="console-page-header">
        <h1>입력 보안 검사</h1>
        <p>사용자 프롬프트를 입력하고 보안 위험도를 검사해보세요.</p>
      </header>
      <SecurityConsole variant="full" />
    </div>
  )
}

export default ConsolePage
