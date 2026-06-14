import { store } from '../store'
import { checkAll } from './dependencies'
import { detectOs } from './os'
import type { CommandRunner } from './runner'
import type { HostSetupStatus, SetupReport } from './types'

export * from './types'
export { LocalCommandRunner } from './runner'
export type { CommandRunner, CommandResult } from './runner'
export {
  DEPENDENCIES,
  INSTALL_COMMANDS,
  checkDependency,
  checkAll,
  getInstallCommand,
  buildInstallPlan,
  applyInstallPlan,
  npxFallbackCommand
} from './dependencies'
export type { InstallConfirm } from './dependencies'
export { detectOs } from './os'

/**
 * 한 호스트(러너)에 대해 OS 감지 + 전체 의존성 점검을 수행한다. (SETUP_SPEC §4.1, §4.6)
 * 결과는 캐싱하지 않는다(순수). 캐싱은 `saveReport` 사용.
 */
export async function runSetupCheck(runner: CommandRunner, now: string): Promise<SetupReport> {
  const os = await detectOs(runner)
  const checks = await checkAll(runner)
  return { os, checks, checkedAt: now }
}

/** 점검 리포트로부터 표시/캐시용 요약 상태를 도출한다. (SETUP_SPEC §4.7) */
export function summarizeStatus(report: SetupReport): HostSetupStatus {
  const find = (name: string): boolean =>
    report.checks.find((c) => c.name === name)?.installed ?? false

  const node = find('node')
  const npm = find('npm')
  const ccusage = find('ccusage')

  if (!node || !npm) return 'missing-node'
  if (!ccusage) return 'ccusage-fallback' // node/npm 있으므로 npx 폴백 가능
  return 'ok'
}

// --- 캐시 (electron-store) ---

/** 호스트별 점검 리포트를 저장한다. (비민감 메타만) */
export function saveReport(hostId: string, report: SetupReport): void {
  const reports = { ...(store.get('setupReports') ?? {}) }
  reports[hostId] = report
  store.set('setupReports', reports)
}

/** 캐시된 점검 리포트를 조회한다. */
export function getReport(hostId: string): SetupReport | undefined {
  return store.get('setupReports')?.[hostId]
}
