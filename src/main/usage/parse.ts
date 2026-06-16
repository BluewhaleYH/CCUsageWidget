import type { Period, Provider, UsageCell } from './types'

/**
 * ccusage `--json` 출력을 방어적으로 파싱해 `UsageCell`로 정규화한다. (DATA_SPEC §2.2)
 *
 * ccusage 20.x는 에이전트별 어댑터마다 JSON 구조가 다르다(Rust 소스 확인):
 * - **claude**: `modelsUsed`(배열) + `modelBreakdowns[].modelName`, 비용 `totalCost`.
 * - **gemini**(opencode): `modelsUsed`(배열), 비용 `totalCost`.
 * - **codex**: 모델이 **`models` 객체 맵**(`{"gpt-5-codex":{...}}`), 비용 `costUSD`,
 *   `inputTokens`=비캐시 입력·`cacheReadTokens`=캐시입력·`reasoningOutputTokens` 별도.
 *
 * 공통 처리(실측 기준):
 * - 배열 키: `daily`/`monthly`(= period) 우선, 없으면 `data`.
 * - 비용 키: `totalCost` / `costUSD`(codex) / `cost`.
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
  // codex는 추론 토큰을 outputTokens와 분리(reasoningOutputTokens)하므로 출력에 합산해 합계 정합.
  const outputTokens = num(item.outputTokens) + num(item.reasoningOutputTokens)
  const cacheCreationTokens = num(item.cacheCreationTokens)
  const cacheReadTokens = num(item.cacheReadTokens)
  return {
    provider,
    period,
    present: true,
    cost: num(item.totalCost ?? item.costUSD ?? item.cost),
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens:
      num(item.totalTokens) ||
      inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
    modelsUsed: parseModels(item)
  }
}

/**
 * 항목에서 사용 모델 목록을 추출한다(에이전트별 구조 모두 지원, 순서 유지·중복 제거).
 * - `modelsUsed`: 문자열 배열 (claude, gemini)
 * - `models`: **객체 맵**(키=모델명, codex) 또는 문자열/객체 배열
 * - `modelBreakdowns`/`modelBreakdown`/`breakdowns`: 객체 배열의 modelName/model/name/id (claude)
 */
function parseModels(item: Record<string, unknown>): string[] {
  const out: string[] = []
  const push = (m: unknown): void => {
    if (typeof m === 'string' && m.length > 0 && !out.includes(m)) out.push(m)
  }
  const fromObj = (o: Record<string, unknown>): unknown => o.modelName ?? o.model ?? o.name ?? o.id

  if (Array.isArray(item.modelsUsed)) item.modelsUsed.forEach(push)

  const models = item.models
  if (isRecord(models)) Object.keys(models).forEach(push) // codex: 맵의 키 = 모델명
  else if (Array.isArray(models))
    models.forEach((m) => push(isRecord(m) ? fromObj(m) : m))

  for (const key of ['modelBreakdowns', 'modelBreakdown', 'breakdowns'] as const) {
    const b = item[key]
    if (Array.isArray(b)) b.forEach((x) => isRecord(x) && push(fromObj(x)))
  }
  return out
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
