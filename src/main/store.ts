import Store from 'electron-store'
import type { SetupReport } from './setup/types'
import type { HostEntry } from './hosts/types'

/** 창 위치/크기 */
export interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
}

/** 위젯 뷰 상태 (UI_SPEC §3.4~3.5) */
export type WidgetView = 'collapsed' | 'normal' | 'expanded'

/** 뷰별 창 높이 프리셋(px) */
export const VIEW_HEIGHTS = {
  collapsed: 40,
  expanded: 480
} as const

/** 기본 normal 높이 */
export const DEFAULT_NORMAL_HEIGHT = 280

/**
 * 영속 저장 스키마 (Phase 0 기본 + Phase 1 setup + Phase 2 hosts).
 */
export interface StoreSchema {
  /** 정상(normal) 뷰 기준 창 위치/크기. 접힘/확장 시에도 normal 높이를 여기 보존한다. */
  windowBounds?: WindowBounds
  /** 위젯 뷰 상태(접힘/정상/확장) — 재시작 시 복원 (UI_SPEC §3.4~3.5) */
  view?: WidgetView
  /**
   * 호스트별 의존성 점검 리포트 캐시 (SETUP_SPEC §4.7).
   * 키: hostId (Phase 1은 'local'). 비민감 메타만 저장한다.
   */
  setupReports?: Record<string, SetupReport>
  /** 등록된 호스트 목록 (CONNECTION_SPEC §2). 비밀은 미포함. */
  hosts?: HostEntry[]
  /** 현재 선택된 호스트 id (좌/우 전환 상태 영속화). */
  selectedHostId?: string
  /**
   * 호스트별 자격증명(passphrase/password)의 safeStorage 암호문(base64).
   * 키: hostId. **평문 저장 금지** — 복호화는 credentials.ts 경유.
   */
  hostSecrets?: Record<string, string>
}

export const store = new Store<StoreSchema>({
  defaults: {}
})

/** 뷰 + normal 높이로부터 실제 창 높이를 구한다. */
export function viewHeight(view: WidgetView, normalHeight: number): number {
  if (view === 'collapsed') return VIEW_HEIGHTS.collapsed
  if (view === 'expanded') return VIEW_HEIGHTS.expanded
  return normalHeight
}
