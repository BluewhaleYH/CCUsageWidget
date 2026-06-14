import { BrowserWindow, ipcMain } from 'electron'
import {
  applyInstallPlan,
  buildInstallPlan,
  getReport,
  LocalCommandRunner,
  runSetupCheck,
  saveReport,
  summarizeStatus
} from './setup'
import type { CommandRunner, DependencyName, InstallOutcome, SetupReport } from './setup'

type GetWindow = () => BrowserWindow | null

interface NotImplemented {
  ok: false
  error: string
}

/** Phase 2~3에서 구현될 채널의 임시 응답 */
function notImplemented(channel: string): NotImplemented {
  return { ok: false, error: `${channel} not implemented (Phase 0 skeleton)` }
}

/**
 * 호스트별 명령 러너를 만든다 (seam).
 * - Phase 1: 로컬 러너로 동작/검증.
 * - Phase 2: hostId로 SSH 연결 정보를 찾아 `SshCommandRunner`를 반환하도록 교체한다.
 */
function createRunnerForHost(_hostId: string): CommandRunner {
  return new LocalCommandRunner()
}

/** Phase 1에서 hostId 미지정 시 사용하는 로컬 점검 키 */
const DEFAULT_HOST_ID = 'local'

/**
 * IPC 채널 등록.
 * - widget:* — 창 제어(실제 동작).
 * - setup:*  — 의존성 점검/설치 (SETUP_SPEC, Phase 1).
 * - usage:* / host:* — DATA_SPEC / CONNECTION_SPEC 단계에서 구현(stub).
 */
export function registerIpc(_getWindow: GetWindow): void {
  // --- widget 제어 ---
  ipcMain.handle('widget:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
  })
  ipcMain.handle('widget:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('widget:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
  })

  // --- setup (SETUP_SPEC, Phase 1) ---
  // 점검만 수행 — 어떤 설치 명령도 실행하지 않는다(동의 게이트는 setup:install).
  ipcMain.handle('setup:check', async (_e, args?: { hostId?: string }) => {
    const hostId = args?.hostId ?? DEFAULT_HOST_ID
    const runner = createRunnerForHost(hostId)
    const report = await runSetupCheck(runner, new Date().toISOString())
    saveReport(hostId, report)
    return { report, status: summarizeStatus(report), plan: buildInstallPlan(report) }
  })

  // 사용자 동의(y) 이후에만 호출되는 채널. names = 설치에 동의한 의존성 목록.
  ipcMain.handle(
    'setup:install',
    async (_e, args?: { hostId?: string; names?: DependencyName[] }) => {
      const hostId = args?.hostId ?? DEFAULT_HOST_ID
      const runner = createRunnerForHost(hostId)

      // 최신 점검을 기준으로 설치 계획 산출(캐시 없으면 새로 점검)
      let report: SetupReport | undefined = getReport(hostId)
      if (!report) {
        report = await runSetupCheck(runner, new Date().toISOString())
        saveReport(hostId, report)
      }

      const fullPlan = buildInstallPlan(report)
      const requested = args?.names
      const plan = requested ? fullPlan.filter((p) => requested.includes(p.name)) : fullPlan

      // setup:install 호출 자체가 동의를 의미하므로, 요청된 항목은 confirm=true.
      const outcomes: InstallOutcome[] = await applyInstallPlan(runner, plan, () => true)

      // 설치 후 재점검하여 캐시 갱신
      const updated = await runSetupCheck(runner, new Date().toISOString())
      saveReport(hostId, updated)

      return { outcomes, report: updated, status: summarizeStatus(updated) }
    }
  )

  ipcMain.handle('setup:status', (_e, args?: { hostId?: string }) => {
    const hostId = args?.hostId ?? DEFAULT_HOST_ID
    const report = getReport(hostId)
    if (!report) return { report: null, status: 'unknown' as const }
    return { report, status: summarizeStatus(report) }
  })

  // --- usage (DATA_SPEC, Phase 3) ---
  ipcMain.handle('usage:refresh', () => notImplemented('usage:refresh'))

  // --- host (CONNECTION_SPEC, Phase 2) ---
  ipcMain.handle('host:list', () => notImplemented('host:list'))
  ipcMain.handle('host:add', () => notImplemented('host:add'))
  ipcMain.handle('host:test', () => notImplemented('host:test'))
  ipcMain.handle('host:switch', () => notImplemented('host:switch'))
  ipcMain.handle('host:remove', () => notImplemented('host:remove'))
}
