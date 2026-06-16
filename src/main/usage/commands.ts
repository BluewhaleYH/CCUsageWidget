import type { Period, Provider } from './types'

/**
 * 프로바이더별 ccusage 서브커맨드 프리픽스. (DATA_SPEC §2.1)
 * 각 프로바이더는 전용 서브커맨드를 쓴다 — 서브커맨드 없는 `ccusage daily`는
 * **전체 에이전트 집계**라 claude 칸에 codex/gemini 데이터가 섞이므로 `claude`도 명시한다.
 */
const PROVIDER_PREFIX: Record<Provider, string> = {
  claude: 'claude ',
  codex: 'codex ',
  gemini: 'gemini '
}

/**
 * ccusage 호출 인자를 만든다. (실행 바이너리 `ccusage`/`npx ccusage@latest`는 run.ts가 앞에 붙임)
 * 예: ('claude','daily') → 'daily --json', ('codex','monthly') → 'codex monthly --json'
 */
export function ccusageArgs(provider: Provider, period: Period): string {
  return `${PROVIDER_PREFIX[provider]}${period} --json`
}
