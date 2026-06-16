import { formatCost, formatNumber, formatTokens } from '../lib/format'
import { gridCell, gridState } from '../lib/grid'
import type { Period, Provider, UsageCell, UsageGrid as Grid } from '../lib/types'

const PROVIDERS: Provider[] = ['claude', 'codex', 'gemini']
const PROVIDER_LABEL: Record<Provider, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini'
}
const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'daily', label: '일일' },
  { key: 'monthly', label: '월간' }
]

/** 모델 칩 라벨에서 에이전트 접두 제거 (claude-opus-4-8 → opus-4-8). 프로바이더는 헤더에 이미 표시. */
function stripAgent(model: string): string {
  return model.replace(/^(claude|codex|gemini)-/i, '')
}

type TokenField = 'inputTokens' | 'outputTokens' | 'cacheCreationTokens' | 'cacheReadTokens' | 'totalTokens'
const METRICS: Array<{ label: string; field: TokenField; total?: boolean }> = [
  { label: 'Input', field: 'inputTokens' },
  { label: 'Output', field: 'outputTokens' },
  { label: 'Cache Create', field: 'cacheCreationTokens' },
  { label: 'Cache Read', field: 'cacheReadTokens' },
  { label: 'Total', field: 'totalTokens', total: true }
]

/**
 * 2×3 사용량 그리드. (UI_SPEC §3.8 / DATA_SPEC §2.4)
 * 행=기간(일일/월간) × 열=프로바이더(Claude/Codex/Gemini).
 * 각 칸 = 비용 + 모델 칩 + 토큰 세부(Input/…/Total, K·M·B 축약).
 */
export function UsageGrid({ grid }: { grid: Grid | null }) {
  const state = gridState(grid)
  if (state === 'loading') return <div className="usage-grid msg">데이터를 불러오는 중…</div>
  if (state === 'no-host') return <div className="usage-grid msg">등록된 호스트 없음 · + 로 등록</div>
  if (state === 'disconnected') return <div className="usage-grid msg warn">연결 안됨</div>
  if (state === 'error')
    return <div className="usage-grid msg warn">오류: {grid?.error ?? '조회 실패'}</div>

  const g = grid as Grid
  // 데이터가 전혀 없는 에이전트(열)는 숨긴다 — 일일·월간 모두 없으면 제외.
  const providers = PROVIDERS.filter((p) =>
    PERIODS.some(({ key }) => gridCell(g, p, key)?.present)
  )
  if (providers.length === 0)
    return <div className="usage-grid msg">표시할 데이터 없음</div>

  // 표시 열 수에 맞춰 컬럼 너비(라벨 + 프로바이더 N개)를 동적으로 설정.
  const cols = { gridTemplateColumns: `42px ${'1fr '.repeat(providers.length).trim()}` }
  return (
    <div className="usage-grid">
      <div className="grid-row head" style={cols}>
        <span className="rowlabel" />
        {providers.map((p) => (
          <span key={p} className="colhead">
            {PROVIDER_LABEL[p]}
          </span>
        ))}
      </div>
      {PERIODS.map(({ key, label }) => (
        <div key={key} className="grid-row" style={cols}>
          <span className="rowlabel">{label}</span>
          {providers.map((p) => (
            <Cell key={p} cell={gridCell(g, p, key)} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Cell({ cell }: { cell: UsageCell | undefined }) {
  if (!cell || !cell.present) return <div className="cell none">없음</div>
  const models = cell.modelsUsed
  return (
    <div className="cell">
      <b className="cost">{formatCost(cell.cost)}</b>
      {models.length > 0 && (
        <div className="models">
          {models.map((m) => (
            <span key={m} className="model-chip" title={m}>
              {stripAgent(m)}
            </span>
          ))}
        </div>
      )}
      <div className="metrics">
        {METRICS.map((mt) => (
          <div key={mt.label} className={mt.total ? 'metric total' : 'metric'}>
            <span className="k">{mt.label}</span>
            <span className="v" title={formatNumber(cell[mt.field])}>
              {formatTokens(cell[mt.field])}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
