function App() {
  return (
    <div className="widget">
      <header className="titlebar">
        <div className="left">
          <button className="nav" title="이전 호스트" disabled>
            ◀
          </button>
          <span className="alias">CCUsageWidget</span>
          <button className="nav" title="다음 호스트" disabled>
            ▶
          </button>
          <button className="nav add" title="호스트 등록" disabled>
            +
          </button>
        </div>
        <div className="controls">
          <button onClick={() => window.api.widget.minimize()} title="접기">
            ─
          </button>
          <button onClick={() => window.api.widget.maximize()} title="확장">
            □
          </button>
          <button onClick={() => window.api.widget.close()} title="종료">
            ✕
          </button>
        </div>
      </header>

      <main className="body">
        <p className="placeholder">CCUsageWidget</p>
        <p className="hint">Phase 0 — 스캐폴딩 완료</p>
        <p className="hint">다음: Phase 1 (SETUP)</p>
      </main>

      <footer className="statusbar">
        <span>준비됨</span>
      </footer>
    </div>
  )
}

export default App
