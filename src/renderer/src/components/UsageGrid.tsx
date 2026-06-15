import { formatCost, formatTokens } from '../lib/format'
import { gridCell, gridState } from '../lib/grid'
import type { Period, Provider, UsageCell, UsageGrid as Grid } from '../lib/types'

const PROVIDERS: Provider[] = ['claude', 'codex', 'gemini']
/** 표시용 프로바이더 라벨(대문자 시작) */
const PROVIDER_LABEL: Record<Provider, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini'
}
const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'daily', label: '일일' },
  { key: 'monthly', label: '월' }
]

/**
 * 2×3 사용량 그리드. (UI_SPEC §3.8 / DATA_SPEC §2.4~2.5)
 * 행=기간(일일/월) × 열=프로바이더(claude/codex/gemini), 셀=비용($)+토큰.
 * 상태: 호스트 없음 / 연결 안됨 / 오류 / 로딩.
 */
export function UsageGrid({ grid, expanded }: { grid: Grid | null; expanded: boolean }) {
  const state = gridState(grid)

  if (state === 'loading') return <div className="usage-grid msg">데이터를 불러오는 중…</div>
  if (state === 'no-host')
    return <div className="usage-grid msg">등록된 호스트 없음 · + 로 등록</div>
  if (state === 'disconnected') return <div className="usage-grid msg warn">연결 안됨</div>
  if (state === 'error')
    return <div className="usage-grid msg warn">오류: {grid?.error ?? '조회 실패'}</div>

  // ready — grid는 non-null
  const g = grid as Grid
  return (
    <div className="usage-grid">
      <div className="grid-row head">
        <span className="rowlabel" />
        {PROVIDERS.map((p) => (
          <span key={p} className="colhead">
            {PROVIDER_LABEL[p]}
          </span>
        ))}
      </div>
      {PERIODS.map(({ key, label }) => (
        <div key={key} className="grid-row">
          <span className="rowlabel">{label}</span>
          {PROVIDERS.map((p) => (
            <Cell key={p} cell={gridCell(g, p, key)} expanded={expanded} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Cell({ cell, expanded }: { cell: UsageCell | undefined; expanded: boolean }) {
  if (!cell || !cell.present) return <span className="cell none">없음</span>
  return (
    <span className="cell">
      <b className="cost">{formatCost(cell.cost)}</b>
      <i className="tok">{formatTokens(cell.totalTokens)}</i>
      {expanded && (
        <em className="io">
          ↑{formatTokens(cell.inputTokens)} ↓{formatTokens(cell.outputTokens)}
        </em>
      )}
    </span>
  )
}
