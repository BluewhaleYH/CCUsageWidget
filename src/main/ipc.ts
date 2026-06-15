import { BrowserWindow, ipcMain } from 'electron'
import {
  applyInstallPlan,
  buildInstallPlan,
  getReport,
  runSetupCheck,
  saveReport,
  summarizeStatus
} from './setup'
import type { DependencyName, InstallOutcome, SetupReport } from './setup'
import {
  buildSshConfig,
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
import { createRunnerForHost, DEFAULT_HOST_ID, disposeRunner } from './runnerFactory'
import { store, viewHeight, type WidgetView } from './store'
import { usagePoller } from './usage/poller'

type GetWindow = () => BrowserWindow | null

/**
 * IPC 채널 등록.
 * - widget:* — 창 제어(접기/확장/종료).
 * - setup:*  — 의존성 점검/설치 (Phase 1).
 * - host:*   — 호스트 관리 (Phase 2).
 * - usage:*  — 데이터 조회 (Phase 3).
 */
export function registerIpc(_getWindow: GetWindow): void {
  // --- widget 제어 (UI_SPEC §3.4~3.5) ---
  // 접기(헤더만)/펼침(데이터 표시 고정 높이)로 리사이즈 + view 영속화. 너비는 유지.
  ipcMain.handle('widget:setView', (e, view: WidgetView) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    const b = win.getBounds()
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: viewHeight(view) })
    store.set('view', view)
  })
  ipcMain.handle('widget:getView', () => store.get('view') ?? 'normal')
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
      const result = typeof args === 'string' ? switchHost(args) : selectHost(args.id)
      // 전환 시 즉시 1회 갱신 (DATA_SPEC §2.3)
      usagePoller.refreshNow()
      return result
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
  // 수동 갱신: 즉시 1회 폴링(타이머 재정렬). 결과는 usage:update 푸시로 전달된다.
  ipcMain.handle('usage:refresh', () => {
    usagePoller.refreshNow()
    return { ok: true }
  })

  // host:status 푸시(연결 상태)는 usage/poller.ts의 폴링 사이클에서 수행한다. (CONNECTION_SPEC §3.6)
}
