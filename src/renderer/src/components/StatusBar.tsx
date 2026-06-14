/**
 * 상태 푸터 — 마지막 갱신 시각 + 연결 인디케이터. (UI_SPEC §3.8)
 * CB1: 골격 — 실제 갱신시각/연결상태는 CB2~3에서 연동.
 */
export function StatusBar() {
  return (
    <footer className="statusbar">
      <span className="updated">준비됨</span>
    </footer>
  )
}
