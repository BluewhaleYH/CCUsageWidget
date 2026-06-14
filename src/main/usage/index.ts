import type { CommandRunner } from '../setup'
import { ccusageArgs } from './commands'
import { parseUsage } from './parse'
import { runCcusage } from './run'
import { PERIODS, PROVIDERS, type Period, type Provider, type UsageCell } from './types'

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

/**
 * 선택 호스트(러너)에서 ccusage 6종(daily/monthly × claude/codex/gemini)을 조회한다. (DATA_SPEC §2.1)
 *
 * - **병렬** 실행. 러너가 `SshCommandRunner`면 단일 연결을 재사용한다(첫 호출에서 connect 후 exec 다회).
 * - 각 호출은 **독립적으로 성공/실패** 처리: 실패한 셀은 `present:false`로 채운다.
 * - 전부 실패하면 연결 문제로 보고 `connection:'disconnected'`.
 */
export async function fetchUsageCells(runner: CommandRunner): Promise<FetchResult> {
  const results = await Promise.all(
    TARGETS.map(async ({ provider, period }) => {
      const res = await runCcusage(runner, ccusageArgs(provider, period))
      // 실패 시 raw='' → parseUsage가 present:false 셀을 반환
      const cell = parseUsage(provider, period, res.raw)
      return { ok: res.ok, cell }
    })
  )

  const connection = results.some((r) => r.ok) ? 'connected' : 'disconnected'
  return { cells: results.map((r) => r.cell), connection }
}
