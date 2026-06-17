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
import {
  createRunnerForHost,
  DEFAULT_HOST_ID,
  disposeRunner,
  invalidateRunner
} from './runnerFactory'
import { logBus } from './logBus'
import { trayController } from './tray'
import { usagePoller } from './usage/poller'

/** 로그 표시용 호스트 별칭(없으면 hostId). */
function hostAliasOf(hostId: string): string {
  return repository.getHost(hostId)?.alias ?? hostId
}

type GetWindow = () => BrowserWindow | null

/**
 * IPC 채널 등록.
 * - widget:* — 창 제어(숨기기).
 * - setup:*  — 의존성 점검/설치 (Phase 1).
 * - host:*   — 호스트 관리 (Phase 2).
 * - usage:*  — 데이터 조회 (Phase 3).
 */
export function registerIpc(_getWindow: GetWindow): void {
  // --- widget 제어 ---
  // 위젯 ─ — 앱을 닫지 않고 트레이로 숨긴다(상시노출 off). 종료는 트레이 '종료'.
  ipcMain.handle('widget:hide', () => {
    trayController.setAlwaysShow(false)
  })

  // --- setup (SETUP_SPEC, Phase 1) ---
  ipcMain.handle('setup:check', async (_e, args?: { hostId?: string }) => {
    const hostId = args?.hostId ?? DEFAULT_HOST_ID
    const alias = hostAliasOf(hostId)
    const runner = createRunnerForHost(hostId)
    logBus.emit(hostId, alias, '의존성 점검 중…')
    const report = await runSetupCheck(runner, new Date().toISOString())
    saveReport(hostId, report)
    disposeRunner(runner)
    const summary = report.checks
      .map((c) => `${c.name} ${c.installed ? `✓${c.version ? ' ' + c.version : ''}` : '✗ 없음'}`)
      .join(' · ')
    logBus.emit(hostId, alias, `점검 완료 (OS: ${report.os}) — ${summary}`)
    return { report, status: summarizeStatus(report), plan: buildInstallPlan(report) }
  })

  ipcMain.handle(
    'setup:install',
    async (_e, args?: { hostId?: string; names?: DependencyName[] }) => {
      const hostId = args?.hostId ?? DEFAULT_HOST_ID
      const alias = hostAliasOf(hostId)
      const runner = createRunnerForHost(hostId)

      let report: SetupReport | undefined = getReport(hostId)
      if (!report) {
        report = await runSetupCheck(runner, new Date().toISOString())
        saveReport(hostId, report)
      }

      const fullPlan = buildInstallPlan(report)
      const requested = args?.names
      const plan = requested ? fullPlan.filter((p) => requested.includes(p.name)) : fullPlan

      logBus.emit(hostId, alias, `의존성 설치 시작 (${plan.length}개)…`)
      const outcomes: InstallOutcome[] = await applyInstallPlan(runner, plan, () => true, {
        onStart: (item) => logBus.emit(hostId, alias, `${item.name} 설치 중: ${item.command}`),
        onStep: (item, out) => {
          if (out.status === 'installed') logBus.emit(hostId, alias, `${item.name} 설치 완료`)
          else if (out.status === 'failed')
            logBus.emit(hostId, alias, `${item.name} 설치 실패: ${out.error ?? '오류'}`, 'error')
        }
      })

      const updated = await runSetupCheck(runner, new Date().toISOString())
      saveReport(hostId, updated)
      disposeRunner(runner)
      logBus.emit(hostId, alias, `설치 후 재점검 완료 — 상태: ${summarizeStatus(updated)}`)

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

  // direction: 'prev'|'next' 순환, 또는 { id } 직접 선택.
  // 모든 호스트를 백그라운드 폴링하므로 전환 시 재조회 불필요 — 선택 상태만 영속화(렌더러가 인덱스 이동).
  ipcMain.handle(
    'host:switch',
    (_e, args: SwitchDirection | { id: string }): HostEntry | undefined =>
      typeof args === 'string' ? switchHost(args) : selectHost(args.id)
  )

  ipcMain.handle(
    'host:update',
    (
      _e,
      args: { id: string; patch: Partial<Omit<HostEntry, 'id'>>; secret?: string }
    ): HostEntry | undefined => {
      // 주소/자격증명이 바뀌었을 수 있으니 캐시된 SSH 연결을 무효화(다음 호출이 재연결).
      invalidateRunner(args.id)
      return editHost(args.id, args.patch, args.secret)
    }
  )

  ipcMain.handle('host:remove', (_e, args: { id: string }) => {
    invalidateRunner(args.id)
    return deleteHost(args.id)
  })

  // host:status 는 푸시 채널(메인→렌더러). 실제 푸시는 Phase 3의 30초 폴링에서 sendHostStatus로 수행.

  // --- usage (DATA_SPEC, Phase 3) ---
  // 수동 갱신: 즉시 1회 폴링(타이머 재정렬). 결과는 usage:update 푸시로 전달된다.
  ipcMain.handle('usage:refresh', () => {
    usagePoller.refreshNow()
    return { ok: true }
  })

  // host:status 푸시(연결 상태)는 usage/poller.ts의 폴링 사이클에서 수행한다. (CONNECTION_SPEC §3.6)
}
