import type { BrowserWindow } from 'electron'

/** 위젯 하단 로그 영역에 표시할 활동 로그 1줄. */
export interface LogEntry {
  /** ISO 시각 */
  ts: string
  /** 어느 호스트의 활동인지(렌더러가 현재 보는 호스트만 필터). null=전역 */
  hostId: string | null
  hostAlias: string | null
  message: string
  level: 'info' | 'error'
}

type GetWindow = () => BrowserWindow | null

/**
 * 메인의 활동(사용량 조회·의존성 점검/설치 등)을 렌더러 로그 영역으로 푸시한다.
 * 호스트 컨텍스트를 함께 실어 보내고, 렌더러가 현재 보는 호스트만 보여준다.
 */
class LogBus {
  private getWindow: GetWindow = () => null

  init(getWindow: GetWindow): void {
    this.getWindow = getWindow
  }

  emit(
    hostId: string | null,
    hostAlias: string | null,
    message: string,
    level: LogEntry['level'] = 'info'
  ): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    const entry: LogEntry = { ts: new Date().toISOString(), hostId, hostAlias, message, level }
    win.webContents.send('log:entry', entry)
  }
}

export const logBus = new LogBus()
