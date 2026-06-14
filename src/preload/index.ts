import { contextBridge, ipcRenderer } from 'electron'

/**
 * 렌더러에 노출되는 안전한 API (contextBridge 화이트리스트).
 * 새 IPC가 필요하면 반드시 여기에만 추가한다 (CLAUDE.md 규칙).
 */
const api = {
  usage: {
    /** 사용량 갱신 푸시 구독. 해제 함수를 반환한다. */
    onUpdate: (callback: (data: unknown) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, data: unknown): void => callback(data)
      ipcRenderer.on('usage:update', listener)
      return () => ipcRenderer.removeListener('usage:update', listener)
    },
    /** 수동 갱신 요청 */
    refresh: (): Promise<unknown> => ipcRenderer.invoke('usage:refresh')
  },
  host: {
    add: (entry: unknown): Promise<unknown> => ipcRenderer.invoke('host:add', entry),
    list: (): Promise<unknown> => ipcRenderer.invoke('host:list'),
    test: (entry: unknown): Promise<unknown> => ipcRenderer.invoke('host:test', entry),
    switch: (direction: unknown): Promise<unknown> => ipcRenderer.invoke('host:switch', direction),
    remove: (id: unknown): Promise<unknown> => ipcRenderer.invoke('host:remove', id)
  },
  setup: {
    /** 의존성 점검(설치는 수행하지 않음). { report, status, plan } 반환 */
    check: (args?: { hostId?: string }): Promise<unknown> =>
      ipcRenderer.invoke('setup:check', args),
    /** 동의(y)한 의존성 설치. names 생략 시 누락 전체. { outcomes, report, status } 반환 */
    install: (args?: { hostId?: string; names?: string[] }): Promise<unknown> =>
      ipcRenderer.invoke('setup:install', args),
    /** 캐시된 점검 상태 조회. { report, status } 반환 */
    status: (args?: { hostId?: string }): Promise<unknown> =>
      ipcRenderer.invoke('setup:status', args)
  },
  widget: {
    minimize: (): Promise<void> => ipcRenderer.invoke('widget:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('widget:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('widget:close')
  }
}

export type WidgetApi = typeof api

// contextIsolation은 항상 true (CLAUDE.md 보안 규칙). contextBridge로만 노출한다.
try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error('contextBridge expose 실패:', error)
}
