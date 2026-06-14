import Store from 'electron-store'

/** 창 위치/크기 */
export interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
}

/**
 * 영속 저장 스키마 (Phase 0 기본).
 * 호스트 목록·선택 상태 등은 Phase 2(CONNECTION)에서 확장한다.
 */
export interface StoreSchema {
  windowBounds?: WindowBounds
}

export const store = new Store<StoreSchema>({
  defaults: {}
})
