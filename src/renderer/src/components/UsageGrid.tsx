import { formatCost, formatNumber, formatTokens } from '../lib/format'
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
  { key: 'monthly', label: '월간' }
]

/**
 * 사용량 표시. (UI_SPEC §3.8 / DATA_SPEC §2.4)
 * 기간(일일/월간) 섹션마다 프로바이더(Claude/Codex/Gemini) 카드 3개.
 * 카드: 비용 + 모델 칩 + 토큰 세부(Input/Output/Cache/Total, K·M·B 축약).
 */
export function UsageGrid({ grid }: { grid: Grid | null }) {
  const state = gridState(grid)

  if (state === 'loading') return <div className="usage-grid msg">데이터를 불러오는 중…</div>
  if (state === 'no-host')
    return <div className="usage-grid msg">등록된 호스트 없음 · + 로 등록</div>
  if (state === 'disconnected') return <div className="usage-grid msg warn">연결 안됨</div>
  if (state === 'error')
    return <div className="usage-grid msg warn">오류: {grid?.error ?? '조회 실패'}</div>

  const g = grid as Grid
  return (
    <div className="usage-grid">
      {PERIODS.map(({ key, label }) => (
        <section key={key} className="period">
          <h2 className="period-title">{label}</h2>
          <div className="cards">
            {PROVIDERS.map((p) => (
              <Card key={p} name={PROVIDER_LABEL[p]} cell={gridCell(g, p, key)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function Card({ name, cell }: { name: string; cell: UsageCell | undefined }) {
  if (!cell || !cell.present) {
    return (
      <div className="card empty">
        <div className="card-head">{name}</div>
        <div className="card-none">없음</div>
      </div>
    )
  }
  return (
    <div className="card">
      <div className="card-head">{name}</div>
      <div className="cost">{formatCost(cell.cost)}</div>
      {cell.modelsUsed.length > 0 && (
        <div className="models">
          {cell.modelsUsed.map((m) => (
            <span key={m} className="model-chip" title={m}>
              {m}
            </span>
          ))}
        </div>
      )}
      <div className="metrics">
        <Metric k="Input" v={cell.inputTokens} />
        <Metric k="Output" v={cell.outputTokens} />
        <Metric k="Cache Create" v={cell.cacheCreationTokens} />
        <Metric k="Cache Read" v={cell.cacheReadTokens} />
        <Metric k="Total" v={cell.totalTokens} total />
      </div>
    </div>
  )
}

/** 라벨 + 축약 값(전체 숫자는 hover 툴팁) */
function Metric({ k, v, total }: { k: string; v: number; total?: boolean }) {
  return (
    <div className={total ? 'metric total' : 'metric'}>
      <span className="k">{k}</span>
      <span className="v" title={formatNumber(v)}>
        {formatTokens(v)}
      </span>
    </div>
  )
}
