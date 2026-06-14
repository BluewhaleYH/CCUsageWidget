import { contextBridge, ipcRenderer } from 'electron'
import type { UsageGrid } from '../main/usage/types'

// 렌더러가 쓰는 데이터 타입 재노출(컴파일타임 전용 — 런타임 경계 불변)
export type { UsageGrid, UsageCell, UsageStatus, Provider, Period } from '../main/usage/types'
export type { HostEntry, SshAuth } from '../main/hosts/types'
export type {
  ConnectionInput,
  ConnectionTestResult,
  RegisterHostInput,
  RegisterHostResult
} from '../main/hosts'

/**
 * 렌더러에 노출되는 안전한 API (contextBridge 화이트리스트).
 * 새 IPC가 필요하면 반드시 여기에만 추가한다 (CLAUDE.md 규칙).
 */
const api = {
  usage: {
    /** 사용량 그리드 푸시 구독(usage:update). 해제 함수를 반환한다. (DATA_SPEC §2.6) */
    onUpdate: (callback: (grid: UsageGrid) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, grid: UsageGrid): void => callback(grid)
      ipcRenderer.on('usage:update', listener)
      return () => ipcRenderer.removeListener('usage:update', listener)
    },
    /** 수동 갱신 요청(usage:refresh). 결과는 onUpdate로 전달된다. */
    refresh: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('usage:refresh')
  },
  host: {
    /** 등록(연결 테스트 후 저장). args: { input, secret? } */
    add: (args: unknown): Promise<unknown> => ipcRenderer.invoke('host:add', args),
    /** 목록 조회. { hosts, selectedHostId } (비밀 미포함) */
    list: (): Promise<unknown> => ipcRenderer.invoke('host:list'),
    /** 연결 테스트 단독 실행. args: { input, secret? } */
    test: (args: unknown): Promise<unknown> => ipcRenderer.invoke('host:test', args),
    /** 전환: 'prev'|'next' 순환, 또는 { id } 직접 선택 */
    switch: (direction: unknown): Promise<unknown> => ipcRenderer.invoke('host:switch', direction),
    /** 수정. args: { id, patch, secret? } */
    update: (args: unknown): Promise<unknown> => ipcRenderer.invoke('host:update', args),
    /** 삭제. args: { id } */
    remove: (args: unknown): Promise<unknown> => ipcRenderer.invoke('host:remove', args),
    /** 연결 상태 푸시 구독(메인→렌더러). 해제 함수를 반환한다. */
    onStatus: (callback: (status: unknown) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, status: unknown): void => callback(status)
      ipcRenderer.on('host:status', listener)
      return () => ipcRenderer.removeListener('host:status', listener)
    }
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
