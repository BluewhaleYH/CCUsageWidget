import { formatCost, formatNumber, formatTokens } from '../lib/format'
import { gridCell, gridState, visibleProviders } from '../lib/grid'
import { AGENT_WIDTH, LABEL_WIDTH } from '../lib/layout'
import type { Period, Provider, UsageCell, UsageGrid as Grid } from '../lib/types'

const PROVIDER_LABEL: Record<Provider, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini'
}
const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'daily', label: '일일' },
  { key: 'monthly', label: '월간' }
]

/**
 * 모델 칩 라벨을 패밀리명으로 단축한다. 에이전트 접두(헤더에 이미 표시)와 버전을 제거.
 * 예: claude-opus-4-8 → opus, gpt-5-codex → gpt, gpt-5 → gpt, gemini-2.5-pro → pro.
 * (첫 숫자 토큰 이전의 알파벳 토큰; 숫자로 시작하면 숫자 없는 토큰만)
 */
function shortModel(model: string): string {
  const noAgent = model.replace(/^(claude|codex|gemini)-/i, '')
  const tokens = noAgent.split('-')
  const lead: string[] = []
  for (const t of tokens) {
    if (/\d/.test(t)) break
    lead.push(t)
  }
  if (lead.length > 0) return lead.join('-')
  const alpha = tokens.filter((t) => !/\d/.test(t))
  return alpha.length > 0 ? alpha.join('-') : noAgent
}

/** 단축 모델명 목록(중복 제거) — 버전만 다른 동일 패밀리는 하나로 합친다. */
function shortModels(models: string[]): string[] {
  return Array.from(new Set(models.map(shortModel)))
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
  // 데이터가 전혀 없는 에이전트(열)는 숨긴다 — 어느 기간이든 데이터 있으면 표시.
  const providers = visibleProviders(g)
  if (providers.length === 0)
    return <div className="usage-grid msg">표시할 데이터 없음</div>

  // 에이전트 칸은 320px 고정 — 라벨(42px) + 프로바이더 N개. 창 너비는 이 콘텐츠에 맞춤(App).
  const cols = {
    gridTemplateColumns: `${LABEL_WIDTH}px ${`${AGENT_WIDTH}px `.repeat(providers.length).trim()}`
  }
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
  const models = shortModels(cell.modelsUsed)
  return (
    <div className="cell">
      <b className="cost">{formatCost(cell.cost)}</b>
      {models.length > 0 && (
        <div className="models">
          {models.map((m) => (
            <span key={m} className="model-chip">
              {m}
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
