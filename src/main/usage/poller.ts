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
      const { grid, host } = await this.buildGrid()
      const win = this.getWindow()
      win?.webContents.send('usage:update', grid)

      // 폴링 사이클에 연결 상태 갱신 통합 (CONNECTION_SPEC §3.6)
      if (host) {
        const lastStatus = grid.connection
        updateHost(host.id, { lastStatus, lastCheckedAt: grid.updatedAt })
        win?.webContents.send('host:status', {
          id: host.id,
          lastStatus,
          lastCheckedAt: grid.updatedAt
        })
      }
    } finally {
      this.polling = false
    }
  }

  private async buildGrid(): Promise<{ grid: UsageGrid; host: HostEntry | null }> {
    const now = new Date().toISOString()
    const host = getSelectedHost() ?? null

    // 등록/선택된 호스트가 없으면 빈 그리드(연결 안됨)로 푸시
    if (!host) {
      return {
        grid: { hostId: null, hostAlias: null, updatedAt: now, connection: 'disconnected', cells: [] },
        host: null
      }
    }

    const runner = createRunnerForHost(host.id)
    try {
      return { grid: await fetchUsageGrid(runner, host, now), host }
    } finally {
      disposeRunner(runner)
    }
  }
}

export const usagePoller = new UsagePoller()
