import { formatTime } from '../lib/format'
import { statusLabel, statusSeverity } from '../lib/setup'
import { limitFor, TIERS } from '../lib/tier'
import type { HostSetupStatus, Provider, UsageGrid as Grid } from '../lib/types'

const TIER_PROVIDERS: Array<{ key: Provider; label: string }> = [
  { key: 'claude', label: 'Claude' },
  { key: 'codex', label: 'Codex*' },
  { key: 'gemini', label: 'Gemini' }
]

/** 한도값 참고표(hover 팝오버). */
function TierInfo() {
  return (
    <span className="tier-info">
      <button type="button" className="tier-info-btn" aria-label="한도값 안내">
        !
      </button>
      <div className="tier-info-pop">
        <div className="tier-info-title">월간 한도($) — 티어별</div>
        <table className="tier-table">
          <thead>
            <tr>
              <th>티어</th>
              {TIER_PROVIDERS.map((p) => (
                <th key={p.key}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t}>
                <td>{t}</td>
                {TIER_PROVIDERS.map((p) => (
                  <td key={p.key}>${limitFor(p.key, t)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tier-note">* Codex = ChatGPT + Codex 합산 사용량 기준</p>
      </div>
    </span>
  )
}

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
        <TierInfo />
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
