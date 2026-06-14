import Store from 'electron-store'
import type { SetupReport } from './setup/types'

/** 창 위치/크기 */
export interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
}

/**
 * 영속 저장 스키마 (Phase 0 기본 + Phase 1 setup).
 * 호스트 목록·선택 상태 등은 Phase 2(CONNECTION)에서 확장한다.
 */
export interface StoreSchema {
  windowBounds?: WindowBounds
  /**
   * 호스트별 의존성 점검 리포트 캐시 (SETUP_SPEC §4.7).
   * 키: hostId (Phase 1은 'local'). 비민감 메타만 저장한다.
   */
  setupReports?: Record<string, SetupReport>
}

export const store = new Store<StoreSchema>({
  defaults: {}
})
