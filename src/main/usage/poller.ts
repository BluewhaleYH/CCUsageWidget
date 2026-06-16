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
  /** 폴 진행 중 들어온 재갱신 요청 — 현재 폴이 끝나면 새 호스트로 재폴한다. */
  private pending = false
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

  /**
   * 1회 조회 → usage:update 푸시 + 연결 상태(lastStatus) 갱신·푸시.
   * - 이미 폴 진행 중이면 `pending`만 세우고 종료 → 현재 폴이 끝난 뒤 새 호스트로 **재폴**.
   * - 폴 도중 선택 호스트가 바뀌면 그 결과는 **stale로 폐기**(이전 호스트 데이터 잔상 방지).
   */
  async poll(): Promise<void> {
    if (this.polling) {
      this.pending = true
      return
    }
    this.polling = true
    try {
      do {
        this.pending = false
        const host = getSelectedHost() ?? null

        // 호스트 없음: 즉시 ready 그리드(연결 안됨/빈 셀)
        if (!host) {
          this.push(this.noHostGrid(), null)
          continue
        }

        // 1) 로딩 상태 푸시(같은 호스트면 셀 유지 → 깜빡임 방지, 다른 호스트면 빈 셀)
        this.send('usage:update', this.loadingGrid(host))

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
            cells: this.lastGrid?.hostId === host.id ? (this.lastGrid?.cells ?? []) : [],
            error: err instanceof Error ? err.message : String(err)
          }
        }

        // 폴 도중 호스트가 바뀌었으면 이 결과는 stale → 폐기하고 새 호스트로 재폴
        if (getSelectedHost()?.id !== host.id) {
          this.pending = true
          continue
        }
        this.push(grid, host)
      } while (this.pending)
    } finally {
      this.polling = false
    }
  }

  /** 결과 그리드를 저장·푸시하고, 호스트 연결 상태를 갱신·푸시한다. (CONNECTION_SPEC §3.6) */
  private push(grid: UsageGrid, host: HostEntry | null): void {
    this.lastGrid = grid
    this.send('usage:update', grid)

    if (host && grid.status !== 'loading') {
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
    try {
      return await fetchUsageGrid(runner, host, now)
    } finally {
      disposeRunner(runner)
    }
  }

  private loadingGrid(host: HostEntry): UsageGrid {
    // 직전 결과가 같은 호스트일 때만 셀 재사용(깜빡임 방지).
    // 다른 호스트면 이전 데이터가 보이지 않도록 빈 셀로 시작한다.
    const sameHost = this.lastGrid?.hostId === host.id
    return {
      hostId: host.id,
      hostAlias: host.alias,
      updatedAt: sameHost ? (this.lastGrid?.updatedAt ?? new Date().toISOString()) : new Date().toISOString(),
      status: 'loading',
      connection: sameHost ? (this.lastGrid?.connection ?? 'connected') : 'connected',
      cells: sameHost ? (this.lastGrid?.cells ?? []) : []
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
