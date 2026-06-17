import type { BrowserWindow } from 'electron'
import { listHosts, updateHost } from '../hosts/repository'
import type { HostEntry } from '../hosts'
import { logBus } from '../logBus'
import { createRunnerForHost, disposeRunner } from '../runnerFactory'
import { fetchUsageGrid, type UsageLog } from './index'
import type { UsageGrid } from './types'

/** 폴링 주기 (DATA_SPEC §2.3) */
const POLL_INTERVAL_MS = 30_000

type GetWindow = () => BrowserWindow | null

/**
 * 사용량 30초 폴링 싱글톤. (DATA_SPEC §2.3)
 * - **등록된 모든 호스트를 병렬로** 조회해 호스트별 `usage:update`를 푸시한다.
 *   (렌더러는 hostId별 grid 맵을 유지 → 좌/우 전환 시 재요청 없이 즉시 표시)
 * - 호스트별 SSH 연결은 캐시 재사용(runnerFactory). 느린 호스트가 다른 호스트를 막지 않음(병렬·독립 처리).
 * - 첫 조회 전까지만 loading을 푸시하고, 이후 갱신은 기존 셀을 유지(깜빡임 방지).
 */
class UsagePoller {
  private timer: ReturnType<typeof setTimeout> | null = null
  private getWindow: GetWindow = () => null
  private polling = false
  /** 호스트별 직전 결과 — 갱신 중 셀 유지(깜빡임 방지). */
  private lastGrids = new Map<string, UsageGrid>()

  /** 폴링 시작 — 즉시 1회 조회 후 30초 주기. */
  start(getWindow: GetWindow): void {
    this.getWindow = getWindow
    void this.poll()
    this.schedule()
  }

  /** 폴링 중지. */
  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  /** 즉시 1회 갱신 + 타이머 재정렬. */
  refreshNow(): void {
    void this.poll()
    this.schedule()
  }

  /** 다음 폴링을 30초 뒤로 예약(기존 타이머는 취소). */
  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      void this.poll()
      this.schedule()
    }, POLL_INTERVAL_MS)
  }

  /** 모든 호스트를 병렬 조회 → 호스트별 usage:update 푸시. 중복 사이클은 무시. */
  async poll(): Promise<void> {
    if (this.polling) return
    this.polling = true
    try {
      const hosts = listHosts()
      if (hosts.length === 0) {
        this.send('usage:update', this.noHostGrid())
        return
      }
      await Promise.all(hosts.map((h) => this.pollHost(h)))
    } finally {
      this.polling = false
    }
  }

  /** 단일 호스트 조회 → 결과 푸시 + 연결 상태 갱신. (독립 try/catch — 한 호스트 실패가 전체를 막지 않음) */
  private async pollHost(host: HostEntry): Promise<void> {
    // 최초(직전 결과 없음)에만 loading 푸시. 이후 갱신은 기존 셀 유지(깜빡임 방지).
    if (!this.lastGrids.has(host.id)) {
      this.send('usage:update', {
        hostId: host.id,
        hostAlias: host.alias,
        updatedAt: new Date().toISOString(),
        status: 'loading',
        connection: 'connected',
        cells: []
      })
    }

    const now = new Date().toISOString()
    let grid: UsageGrid
    try {
      grid = await this.fetch(host, now)
    } catch (err) {
      grid = {
        hostId: host.id,
        hostAlias: host.alias,
        updatedAt: now,
        status: 'error',
        connection: 'disconnected',
        cells: this.lastGrids.get(host.id)?.cells ?? [],
        error: err instanceof Error ? err.message : String(err)
      }
    }

    this.lastGrids.set(host.id, grid)
    this.send('usage:update', grid)

    if (grid.status !== 'loading') {
      const lastStatus = grid.connection
      updateHost(host.id, { lastStatus, lastCheckedAt: grid.updatedAt })
      this.send('host:status', { id: host.id, lastStatus, lastCheckedAt: grid.updatedAt })
    }
  }

  /** 렌더러로 안전하게 전송 — 창이 파괴됐으면(닫힘/dev 재시작) 무시한다. */
  private send(channel: string, payload: unknown): void {
    const win = this.getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }

  private async fetch(host: HostEntry, now: string): Promise<UsageGrid> {
    const runner = createRunnerForHost(host.id)
    const onLog: UsageLog = (provider, period, phase, detail) => {
      const label = `${provider} ${period}`
      if (phase === 'start') logBus.emit(host.id, host.alias, `${label} 결과 받아오는 중…`)
      else if (phase === 'done') logBus.emit(host.id, host.alias, `${label} 완료 ($${detail})`)
      else if (phase === 'empty') logBus.emit(host.id, host.alias, `${label} 데이터 없음`)
      else logBus.emit(host.id, host.alias, `${label} 실패: ${detail ?? '오류'}`, 'error')
    }
    try {
      return await fetchUsageGrid(runner, host, now, onLog)
    } finally {
      disposeRunner(runner)
    }
  }

  private noHostGrid(): UsageGrid {
    return {
      hostId: null,
      hostAlias: null,
      updatedAt: new Date().toISOString(),
      status: 'ready',
      connection: 'disconnected',
      cells: []
    }
  }
}

export const usagePoller = new UsagePoller()
