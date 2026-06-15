import type { JSX } from 'react'
import { formatCost, formatNumber, formatTokens } from '../lib/format'
import { gridCell, gridState } from '../lib/grid'
import type { Provider, UsageCell, UsageGrid as Grid } from '../lib/types'

const PROVIDERS: Provider[] = ['claude', 'codex', 'gemini']
const PROVIDER_LABEL: Record<Provider, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini'
}

/** 표의 지표 행 정의 (Cost는 비용, 나머지는 토큰) */
type TokenField = 'inputTokens' | 'outputTokens' | 'cacheCreationTokens' | 'cacheReadTokens' | 'totalTokens'
const METRICS: Array<{ label: string; field?: TokenField; cost?: boolean; total?: boolean }> = [
  { label: 'Cost', cost: true },
  { label: 'Input', field: 'inputTokens' },
  { label: 'Output', field: 'outputTokens' },
  { label: 'Cache Create', field: 'cacheCreationTokens' },
  { label: 'Cache Read', field: 'cacheReadTokens' },
  { label: 'Total', field: 'totalTokens', total: true }
]

/**
 * 사용량 표. (UI_SPEC §3.8 / DATA_SPEC §2.4)
 * 프로바이더(Claude/Codex/Gemini) 그룹 × [일일/월간] 열, 지표(Cost/Input/…/Total) 행.
 * 토큰은 K/M/B 축약(전체 숫자는 hover), 모델은 칩으로 표시.
 */
export function UsageGrid({ grid }: { grid: Grid | null }) {
  const state = gridState(grid)
  if (state === 'loading') return <div className="usage-msg">데이터를 불러오는 중…</div>
  if (state === 'no-host') return <div className="usage-msg">등록된 호스트 없음 · + 로 등록</div>
  if (state === 'disconnected') return <div className="usage-msg warn">연결 안됨</div>
  if (state === 'error')
    return <div className="usage-msg warn">오류: {grid?.error ?? '조회 실패'}</div>

  const g = grid as Grid
  return (
    <div className="usage">
      <table className="usage-table">
        <thead>
          <tr>
            <th />
            <th>일일</th>
            <th>월간</th>
          </tr>
        </thead>
        {PROVIDERS.map((p) => (
          <ProviderGroup
            key={p}
            name={PROVIDER_LABEL[p]}
            daily={gridCell(g, p, 'daily')}
            monthly={gridCell(g, p, 'monthly')}
          />
        ))}
      </table>
    </div>
  )
}

function ProviderGroup({
  name,
  daily,
  monthly
}: {
  name: string
  daily?: UsageCell
  monthly?: UsageCell
}) {
  const present = Boolean(daily?.present || monthly?.present)
  const models = Array.from(
    new Set([...(daily?.modelsUsed ?? []), ...(monthly?.modelsUsed ?? [])])
  )
  return (
    <tbody className="pgroup">
      <tr className="pgroup-head">
        <td colSpan={3}>
          <span className="pname">{name}</span>
          {models.map((m) => (
            <span key={m} className="model-chip" title={m}>
              {m}
            </span>
          ))}
        </td>
      </tr>
      {present ? (
        METRICS.map((mt) => (
          <tr key={mt.label} className={mt.total ? 'metric total' : 'metric'}>
            <td className="k">{mt.label}</td>
            <td className="v">{cellValue(daily, mt)}</td>
            <td className="v">{cellValue(monthly, mt)}</td>
          </tr>
        ))
      ) : (
        <tr className="pnone">
          <td colSpan={3}>없음</td>
        </tr>
      )}
    </tbody>
  )
}

/** 셀 값 표시: 비용은 $, 토큰은 축약(K/M/B) + 전체 숫자 hover. 데이터 없으면 "—" */
function cellValue(
  cell: UsageCell | undefined,
  mt: { field?: TokenField; cost?: boolean }
): JSX.Element | string {
  if (!cell || !cell.present) return <span className="dim">—</span>
  if (mt.cost) return formatCost(cell.cost)
  const v = cell[mt.field as TokenField]
  return <span title={formatNumber(v)}>{formatTokens(v)}</span>
}
