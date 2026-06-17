import type { Period, Provider, UsageCell, UsageGrid } from './types'

/** 종합(가상) 호스트 id — 실제 호스트와 충돌하지 않는 예약 키. */
export const AGGREGATE_ID = '__aggregate__'
export const AGGREGATE_ALIAS = '종합'

const PROVIDERS: Provider[] = ['claude', 'codex', 'gemini']
const PERIODS: Period[] = ['daily', 'monthly']

/**
 * 여러 호스트의 grid를 (프로바이더×기간) 셀 단위로 합산한 **종합 grid**를 만든다.
 * - 비용·토큰: 각 호스트의 present 셀을 합산. 모델: 합집합(중복 제거).
 * - 어느 호스트든 데이터가 있으면 present:true, 전부 없으면 false("없음").
 */
export function buildAggregateGrid(
  grids: Record<string, UsageGrid>,
  hostIds: string[],
  now: string
): UsageGrid {
  const cells: UsageCell[] = []
  for (const period of PERIODS) {
    for (const provider of PROVIDERS) {
      let present = false
      let cost = 0
      let inputTokens = 0
      let outputTokens = 0
      let cacheCreationTokens = 0
      let cacheReadTokens = 0
      let totalTokens = 0
      const models = new Set<string>()
      for (const id of hostIds) {
        const cell = grids[id]?.cells.find((c) => c.provider === provider && c.period === period)
        if (!cell || !cell.present) continue
        present = true
        cost += cell.cost
        inputTokens += cell.inputTokens
        outputTokens += cell.outputTokens
        cacheCreationTokens += cell.cacheCreationTokens
        cacheReadTokens += cell.cacheReadTokens
        totalTokens += cell.totalTokens
        cell.modelsUsed.forEach((m) => models.add(m))
      }
      cells.push({
        provider,
        period,
        present,
        cost,
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens,
        totalTokens,
        modelsUsed: [...models]
      })
    }
  }
  return {
    hostId: AGGREGATE_ID,
    hostAlias: AGGREGATE_ALIAS,
    updatedAt: now,
    status: 'ready',
    connection: 'connected',
    cells
  }
}
