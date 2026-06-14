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
import {
  buildSshConfig,
  credentials,
  deleteHost,
  editHost,
  registerHost,
  repository,
  selectHost,
  switchHost,
  testConnection,
  type ConnectionInput,
  type HostEntry,
  type RegisterHostInput,
  type SwitchDirection
} from './hosts'
import { SshCommandRunner } from './ssh/runner'

type GetWindow = () => BrowserWindow | null

interface NotImplemented {
  ok: false
  error: string
}

/** Phase 3에서 구현될 채널의 임시 응답 */
function notImplemented(channel: string): NotImplemented {
  return { ok: false, error: `${channel} not implemented (Phase 0 skeleton)` }
}

/** hostId 미지정 시 사용하는 로컬 점검 키 (Phase 1) */
const DEFAULT_HOST_ID = 'local'

/**
 * 호스트별 명령 러너를 만든다 (seam).
 * - hostId가 'local'이거나 호스트를 찾을 수 없으면 로컬 러너(진단·폴백).
 * - 등록된 호스트면 복호화한 자격증명으로 `SshCommandRunner`를 만들어 **원격** 실행.
 *   ⇒ Phase 1의 setup:* 점검/설치가 이 한 곳으로 원격에서 동작한다.
 */
function createRunnerForHost(hostId: string): CommandRunner {
  if (hostId === DEFAULT_HOST_ID) return new LocalCommandRunner()
  const host = repository.getHost(hostId)
  if (!host) return new LocalCommandRunner()
  const secret = credentials.getSecret(hostId)
  const config = buildSshConfig(host, secret)
  return new SshCommandRunner(config)
}

/**
 * IPC 채널 등록.
 * - widget:* — 창 제어.
 * - setup:*  — 의존성 점검/설치 (Phase 1).
 * - host:*   — 호스트 관리 (Phase 2).
 * - usage:*  — DATA_SPEC (Phase 3, stub).
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
  ipcMain.handle('setup:check', async (_e, args?: { hostId?: string }) => {
    const hostId = args?.hostId ?? DEFAULT_HOST_ID
    const runner = createRunnerForHost(hostId)
    const report = await runSetupCheck(runner, new Date().toISOString())
    saveReport(hostId, report)
    disposeRunner(runner)
    return { report, status: summarizeStatus(report), plan: buildInstallPlan(report) }
  })

  ipcMain.handle(
    'setup:install',
    async (_e, args?: { hostId?: string; names?: DependencyName[] }) => {
      const hostId = args?.hostId ?? DEFAULT_HOST_ID
      const runner = createRunnerForHost(hostId)

      let report: SetupReport | undefined = getReport(hostId)
      if (!report) {
        report = await runSetupCheck(runner, new Date().toISOString())
        saveReport(hostId, report)
      }

      const fullPlan = buildInstallPlan(report)
      const requested = args?.names
      const plan = requested ? fullPlan.filter((p) => requested.includes(p.name)) : fullPlan

      const outcomes: InstallOutcome[] = await applyInstallPlan(runner, plan, () => true)

      const updated = await runSetupCheck(runner, new Date().toISOString())
      saveReport(hostId, updated)
      disposeRunner(runner)

      return { outcomes, report: updated, status: summarizeStatus(updated) }
    }
  )

  ipcMain.handle('setup:status', (_e, args?: { hostId?: string }) => {
    const hostId = args?.hostId ?? DEFAULT_HOST_ID
    const report = getReport(hostId)
    if (!report) return { report: null, status: 'unknown' as const }
    return { report, status: summarizeStatus(report) }
  })

  // --- host (CONNECTION_SPEC, Phase 2) ---
  // host:list 는 비밀을 포함하지 않는다(HostEntry에 비밀 미포함).
  ipcMain.handle('host:list', () => ({
    hosts: repository.listHosts(),
    selectedHostId: repository.getSelectedHostId() ?? null
  }))

  ipcMain.handle(
    'host:add',
    async (_e, args: { input: RegisterHostInput; secret?: string }) =>
      registerHost(args.input, args.secret)
  )

  ipcMain.handle(
    'host:test',
    async (_e, args: { input: ConnectionInput; secret?: string }) => {
      const config = buildSshConfig(args.input, args.secret)
      return testConnection(config)
    }
  )

  // direction: 'prev'|'next' 순환, 또는 { id } 직접 선택
  ipcMain.handle(
    'host:switch',
    (_e, args: SwitchDirection | { id: string }): HostEntry | undefined => {
      if (typeof args === 'string') return switchHost(args)
      return selectHost(args.id)
    }
  )

  ipcMain.handle(
    'host:update',
    (
      _e,
      args: { id: string; patch: Partial<Omit<HostEntry, 'id'>>; secret?: string }
    ): HostEntry | undefined => editHost(args.id, args.patch, args.secret)
  )

  ipcMain.handle('host:remove', (_e, args: { id: string }) => deleteHost(args.id))

  // host:status 는 푸시 채널(메인→렌더러). 실제 푸시는 Phase 3의 30초 폴링에서 sendHostStatus로 수행.

  // --- usage (DATA_SPEC, Phase 3) ---
  ipcMain.handle('usage:refresh', () => notImplemented('usage:refresh'))
}

/** SshCommandRunner면 연결을 닫는다(LocalCommandRunner는 무시). */
function disposeRunner(runner: CommandRunner): void {
  if (runner instanceof SshCommandRunner) runner.dispose()
}

/**
 * 호스트 연결 상태를 렌더러로 푸시한다. (CONNECTION_SPEC §3.6 — Phase 3 폴링에서 호출)
 */
export function sendHostStatus(
  win: BrowserWindow | null,
  status: { id: string; lastStatus: HostEntry['lastStatus']; lastCheckedAt: string }
): void {
  win?.webContents.send('host:status', status)
}
