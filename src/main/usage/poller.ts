import type { BrowserWindow } from 'electron'
import { getSelectedHost, updateHost } from '../hosts/repository'
import type { HostEntry } from '../hosts'
import { createRunnerForHost, disposeRunner } from '../runnerFactory'
import { fetchUsageGrid } from './index'
import type { UsageGrid } from './types'

/** 폴링 주기 (DATA_SPEC §2.3) */
const POLL_INTERVAL_MS = 30_000

type GetWindow = () => BrowserWindow | null

/**
 * 사용량 30초 폴링 싱글톤. (DATA_SPEC §2.3)
 * - **현재 선택된 호스트만** 조회해 `usage:update`로 푸시한다.
 * - setTimeout 체인으로 중복 폴링을 방지하고, `refreshNow()`가 타이머를 재정렬한다.
 * - 호스트 전환(`host:switch`)·수동 갱신(`usage:refresh`)에서 `refreshNow()` 호출.
 */
class UsagePoller {
  private timer: ReturnType<typeof setTimeout> | null = null
  private getWindow: GetWindow = () => null
  private polling = false
  /** 직전 결과 — 로딩 중 깜빡임 방지를 위해 셀을 유지한다. */
  private lastGrid: UsageGrid | null = null

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

  /** 1회 조회 → usage:update 푸시 + 연결 상태(lastStatus) 갱신·푸시. 중복 폴링은 무시. */
  async poll(): Promise<void> {
    if (this.polling) return
    this.polling = true
    try {
      const host = getSelectedHost() ?? null

      // 호스트 없음: 즉시 ready 그리드(연결 안됨/빈 셀)
      if (!host) {
        this.push(this.noHostGrid(), null)
        return
      }

      // 1) 로딩 상태 푸시(이전 셀 유지 → 깜빡임 방지)
      this.getWindow()?.webContents.send('usage:update', this.loadingGrid(host))

      // 2) 조회 → ready, 예외 → error
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
          cells: this.lastGrid?.cells ?? [],
          error: err instanceof Error ? err.message : String(err)
        }
      }
      this.push(grid, host)
    } finally {
      this.polling = false
    }
  }

  /** 결과 그리드를 저장·푸시하고, 호스트 연결 상태를 갱신·푸시한다. (CONNECTION_SPEC §3.6) */
  private push(grid: UsageGrid, host: HostEntry | null): void {
    this.lastGrid = grid
    const win = this.getWindow()
    win?.webContents.send('usage:update', grid)

    if (host && grid.status !== 'loading') {
      const lastStatus = grid.connection
      updateHost(host.id, { lastStatus, lastCheckedAt: grid.updatedAt })
      win?.webContents.send('host:status', { id: host.id, lastStatus, lastCheckedAt: grid.updatedAt })
    }
  }

  private async fetch(host: HostEntry, now: string): Promise<UsageGrid> {
    const runner = createRunnerForHost(host.id)
    try {
      return await fetchUsageGrid(runner, host, now)
    } finally {
      disposeRunner(runner)
    }
  }

  private loadingGrid(host: HostEntry): UsageGrid {
    return {
      hostId: host.id,
      hostAlias: host.alias,
      updatedAt: this.lastGrid?.updatedAt ?? new Date().toISOString(),
      status: 'loading',
      connection: this.lastGrid?.connection ?? 'connected',
      cells: this.lastGrid?.cells ?? []
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
