import { formatCost, formatTokens } from '../lib/format'
import { gridCell, gridState } from '../lib/grid'
import type { Period, Provider, UsageCell, UsageGrid as Grid } from '../lib/types'

const PROVIDERS: Provider[] = ['claude', 'codex', 'gemini']
const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'daily', label: '일일' },
  { key: 'monthly', label: '월' }
]

/**
 * 2×3 사용량 그리드. (UI_SPEC §3.8 / DATA_SPEC §2.4~2.5)
 * 행=기간(일일/월) × 열=프로바이더(claude/codex/gemini), 셀=비용($)+토큰.
 * 상태: 호스트 없음 / 연결 안됨 / 오류 / 로딩.
 */
export function UsageGrid({ grid }: { grid: Grid | null }) {
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
            {p}
          </span>
        ))}
      </div>
      {PERIODS.map(({ key, label }) => (
        <div key={key} className="grid-row">
          <span className="rowlabel">{label}</span>
          {PROVIDERS.map((p) => (
            <Cell key={p} cell={gridCell(g, p, key)} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Cell({ cell }: { cell: UsageCell | undefined }) {
  if (!cell || !cell.present) return <span className="cell none">없음</span>
  return (
    <span className="cell">
      <b className="cost">{formatCost(cell.cost)}</b>
      <i className="tok">{formatTokens(cell.totalTokens)}</i>
    </span>
  )
}
