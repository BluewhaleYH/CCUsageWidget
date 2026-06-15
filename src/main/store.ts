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

/** 위젯 뷰 상태 (UI_SPEC §3.4~3.5) — 접힘(헤더만) / 펼침 2단계 */
export type WidgetView = 'collapsed' | 'normal'

/** 접힘(헤더만) 높이 */
export const COLLAPSED_HEIGHT = 40
/** 펼침 높이 — 일일/월간 데이터가 잘 보이는 고정 높이 */
export const SHOWN_HEIGHT = 640

/** 창 너비 제약 / 기본값 */
export const MIN_WIDTH = 960
export const MAX_WIDTH = 1280
export const DEFAULT_WIDTH = 1000

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

/** 뷰별 창 높이. (collapsed=헤더만, normal=데이터 표시 고정 높이) */
export function viewHeight(view: WidgetView): number {
  return view === 'collapsed' ? COLLAPSED_HEIGHT : SHOWN_HEIGHT
}

/** 너비를 [MIN_WIDTH, MAX_WIDTH]로 클램프 */
export function clampWidth(w: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)))
}
