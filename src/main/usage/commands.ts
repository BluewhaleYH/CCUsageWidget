import type { Period, Provider } from './types'

/**
 * 프로바이더별 ccusage 서브커맨드 프리픽스. (DATA_SPEC §2.1)
 * claude는 기본(프리픽스 없음), codex/gemini는 서브커맨드.
 */
const PROVIDER_PREFIX: Record<Provider, string> = {
  claude: '',
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
