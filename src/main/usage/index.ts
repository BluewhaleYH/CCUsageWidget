import type { CommandRunner } from '../setup'
import type { HostEntry } from '../hosts'
import { ccusageArgs } from './commands'
import { parseUsage } from './parse'
import { runCcusage } from './run'
import {
  PERIODS,
  PROVIDERS,
  type Period,
  type Provider,
  type UsageCell,
  type UsageGrid
} from './types'

export * from './types'
export { ccusageArgs } from './commands'
export { runCcusage } from './run'
export { parseUsage } from './parse'

/** 6종 조회 결과 묶음 */
export interface FetchResult {
  cells: UsageCell[]
  /** 하나라도 성공하면 connected, 전부 실패하면 disconnected */
  connection: 'connected' | 'disconnected'
}

/** 호출 단위(프로바이더×기간) — daily 먼저, 프로바이더 순 */
const TARGETS: Array<{ provider: Provider; period: Period }> = PERIODS.flatMap((period) =>
  PROVIDERS.map((provider) => ({ provider, period }))
)

/** 조회 진행 로그 콜백 (위젯 로그 영역용). phase: start|done|empty|fail */
export type UsageLog = (
  provider: Provider,
  period: Period,
  phase: 'start' | 'done' | 'empty' | 'fail',
  detail?: string
) => void

/**
 * 선택 호스트(러너)에서 ccusage 6종(daily/monthly × claude/codex/gemini)을 조회한다. (DATA_SPEC §2.1)
 *
 * - **병렬** 실행. 러너가 `SshCommandRunner`면 단일 연결을 재사용한다(첫 호출에서 connect 후 exec 다회).
 * - 각 호출은 **독립적으로 성공/실패** 처리: 실패한 셀은 `present:false`로 채운다.
 * - 전부 실패하면 연결 문제로 보고 `connection:'disconnected'`.
 */
export async function fetchUsageCells(
  runner: CommandRunner,
  onLog?: UsageLog
): Promise<FetchResult> {
  const results = await Promise.all(
    TARGETS.map(async ({ provider, period }) => {
      onLog?.(provider, period, 'start')
      const res = await runCcusage(runner, ccusageArgs(provider, period))
      // 실패 시 raw='' → parseUsage가 present:false 셀을 반환
      const cell = parseUsage(provider, period, res.raw)
      if (!res.ok) onLog?.(provider, period, 'fail', res.error)
      else if (!cell.present) onLog?.(provider, period, 'empty')
      else onLog?.(provider, period, 'done', cell.cost.toFixed(2))
      return { ok: res.ok, cell }
    })
  )

  const connection = results.some((r) => r.ok) ? 'connected' : 'disconnected'
  return { cells: results.map((r) => r.cell), connection }
}

/**
 * 조회 결과 + 호스트 메타를 2×3 그리드로 조립한다. (DATA_SPEC §2.4)
 */
export function assembleGrid(opts: {
  host: Pick<HostEntry, 'id' | 'alias'> | null
  fetchResult: FetchResult
  now: string
  error?: string
}): UsageGrid {
  return {
    hostId: opts.host?.id ?? null,
    hostAlias: opts.host?.alias ?? null,
    updatedAt: opts.now,
    status: 'ready',
    connection: opts.fetchResult.connection,
    cells: opts.fetchResult.cells,
    error: opts.error
  }
}

/** 그리드에서 특정 셀을 꺼낸다(2×3 매핑 — Phase 4 UI 렌더링용). */
export function getCell(
  grid: UsageGrid,
  provider: Provider,
  period: Period
): UsageCell | undefined {
  return grid.cells.find((c) => c.provider === provider && c.period === period)
}

/**
 * 러너로 6종을 조회하고 그리드까지 조립한다. (poller가 사용)
 */
export async function fetchUsageGrid(
  runner: CommandRunner,
  host: Pick<HostEntry, 'id' | 'alias'> | null,
  now: string,
  onLog?: UsageLog
): Promise<UsageGrid> {
  const fetchResult = await fetchUsageCells(runner, onLog)
  return assembleGrid({ host, fetchResult, now })
}
