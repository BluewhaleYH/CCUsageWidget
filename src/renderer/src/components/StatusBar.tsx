import { formatTime } from '../lib/format'
import { statusLabel, statusSeverity } from '../lib/setup'
import type { HostSetupStatus, UsageGrid as Grid } from '../lib/types'

interface Props {
  grid: Grid | null
  /** 현재 호스트의 의존성 점검 상태. null이면 칩 숨김(예: 종합 가상 호스트) */
  setupStatus: HostSetupStatus | null
  /** 칩 클릭 시 점검/설치 패널 열기(없으면 표시 전용) */
  onOpenSetup?: () => void
  /** 로그 영역 표시 여부 + 토글(버튼) */
  logVisible: boolean
  onToggleLog: () => void
}

/**
 * 상태 푸터 — 마지막 갱신 시각 + setup 상태 칩 + 연결 인디케이터. (UI_SPEC §3.8 / SETUP_SPEC §4.7)
 */
export function StatusBar({ grid, setupStatus, onOpenSetup, logVisible, onToggleLog }: Props) {
  const loading = grid?.status === 'loading'
  const connected = grid?.connection === 'connected'
  const updatedLabel = loading
    ? '갱신 중…'
    : grid
      ? `갱신: ${formatTime(grid.updatedAt)}`
      : '준비됨'

  const chipProps =
    setupStatus !== null
      ? {
          className: `setup-chip ${statusSeverity(setupStatus)}`,
          title: '의존성 점검/설치',
          children: statusLabel(setupStatus)
        }
      : null

  return (
    <footer className="statusbar">
      <span className="updated">{updatedLabel}</span>
      <span className="right">
        <button
          type="button"
          className={`log-toggle${logVisible ? ' on' : ''}`}
          onClick={onToggleLog}
          title="로그 영역 (Ctrl/Cmd+Shift+L)"
        >
          {logVisible ? '숨기기' : '펼치기'}
        </button>
        {chipProps &&
          (onOpenSetup ? (
            <button type="button" onClick={onOpenSetup} {...chipProps} />
          ) : (
            <span {...chipProps} />
          ))}
        {grid && grid.hostId !== null && (
          <span className={`badge ${connected ? 'on' : 'off'}`}>
            {connected ? '● 연결됨' : '● 끊김'}
          </span>
        )}
      </span>
    </footer>
  )
}
