import type { Period, Provider, UsageCell } from './types'

/**
 * ccusage `--json` 출력을 방어적으로 파싱해 `UsageCell`로 정규화한다. (DATA_SPEC §2.2)
 *
 * ccusage 버전/프로바이더에 따라 키가 다르므로 견고하게 처리한다(실측 기준):
 * - 배열 키: `daily`/`monthly`(= period) 우선, 없으면 `data`.
 * - 항목 비용 키: `totalCost` / `costUSD`(codex) / `cost`.
 * - 대표값: **최근(마지막) 항목** = 오늘/이번달 (ccusage는 기간 오름차순 반환).
 * - 빈 배열 또는 JSON 파싱 실패 → `present:false`(zeros).
 */
export function parseUsage(provider: Provider, period: Period, raw: string): UsageCell {
  const empty = emptyCell(provider, period)

  let root: unknown
  try {
    root = JSON.parse(raw)
  } catch {
    return empty
  }
  if (!isRecord(root)) return empty

  const rows = pickArray(root, period)
  if (rows.length === 0) return empty

  const item = rows[rows.length - 1] // 최근 항목
  if (!isRecord(item)) return empty

  const inputTokens = num(item.inputTokens)
  const outputTokens = num(item.outputTokens)
  return {
    provider,
    period,
    present: true,
    cost: num(item.totalCost ?? item.costUSD ?? item.cost),
    inputTokens,
    outputTokens,
    cacheCreationTokens: num(item.cacheCreationTokens),
    cacheReadTokens: num(item.cacheReadTokens),
    totalTokens: num(item.totalTokens) || inputTokens + outputTokens,
    modelsUsed: parseModels(item)
  }
}

/** modelsUsed(문자열 배열) 또는 modelBreakdowns[].modelName에서 모델 목록 추출 */
function parseModels(item: Record<string, unknown>): string[] {
  const direct = item.modelsUsed
  if (Array.isArray(direct)) return direct.filter((m): m is string => typeof m === 'string')
  const breakdowns = item.modelBreakdowns
  if (Array.isArray(breakdowns)) {
    return breakdowns
      .map((b) => (isRecord(b) && typeof b.modelName === 'string' ? b.modelName : null))
      .filter((m): m is string => m !== null)
  }
  return []
}

/** period(daily/monthly) → 없으면 data → 그 외 첫 배열 필드를 찾는다. */
function pickArray(root: Record<string, unknown>, period: Period): unknown[] {
  const candidate = root[period] ?? root['data']
  if (Array.isArray(candidate)) return candidate
  // 최후의 보루: 최상위에서 첫 번째 배열 값
  for (const v of Object.values(root)) {
    if (Array.isArray(v)) return v
  }
  return []
}

function emptyCell(provider: Provider, period: Period): UsageCell {
  return {
    provider,
    period,
    present: false,
    cost: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    modelsUsed: []
  }
}

/** 숫자만 통과(그 외 0). -0 정규화. */
function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v === 0 ? 0 : v
  return 0
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
