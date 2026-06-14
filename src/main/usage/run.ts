import { npxFallbackCommand } from '../setup'
import type { CommandRunner } from '../setup'

/** ccusage 1회 실행 결과(원시 stdout) */
export interface CcusageResult {
  ok: boolean
  /** 표준출력 원문(JSON). 실패 시 빈 문자열 */
  raw: string
  /** npx 폴백으로 실행했는지 */
  usedNpx: boolean
  error?: string
}

/**
 * ccusage를 1회 실행한다. (DATA_SPEC §2.1, §4.5 폴백)
 * 먼저 `ccusage <args>`를 시도하고, 실패하면 `npx ccusage@latest <args>`로 폴백한다.
 * (미설치 환경 대비 — setup의 `npxFallbackCommand` 재사용)
 *
 * 연결 자체가 실패하면(러너가 비정상 코드 반환) 폴백도 실패하므로 ok=false로 반환된다.
 * 연결 실패와 명령 실패의 구분은 상위(fetchUsageGrid)에서 처리한다.
 */
export async function runCcusage(runner: CommandRunner, args: string): Promise<CcusageResult> {
  const direct = await runner.run(`ccusage ${args}`)
  if (direct.code === 0) {
    return { ok: true, raw: direct.stdout, usedNpx: false }
  }

  const fallback = await runner.run(npxFallbackCommand(args))
  if (fallback.code === 0) {
    return { ok: true, raw: fallback.stdout, usedNpx: true }
  }

  return {
    ok: false,
    raw: '',
    usedNpx: true,
    error: fallback.stderr || direct.stderr || `exit ${direct.code}/${fallback.code}`
  }
}
