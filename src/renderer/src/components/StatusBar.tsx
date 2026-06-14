import { formatTime } from '../lib/format'
import type { UsageGrid as Grid } from '../lib/types'

/**
 * 상태 푸터 — 마지막 갱신 시각 + 연결 인디케이터. (UI_SPEC §3.8)
 */
export function StatusBar({ grid }: { grid: Grid | null }) {
  const loading = grid?.status === 'loading'
  const connected = grid?.connection === 'connected'
  const updatedLabel = loading
    ? '갱신 중…'
    : grid
      ? `갱신: ${formatTime(grid.updatedAt)}`
      : '준비됨'

  return (
    <footer className="statusbar">
      <span className="updated">{updatedLabel}</span>
      {grid && grid.hostId !== null && (
        <span className={`badge ${connected ? 'on' : 'off'}`}>
          {connected ? '● 연결됨' : '● 끊김'}
        </span>
      )}
    </footer>
  )
}
