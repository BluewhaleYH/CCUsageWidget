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

/**
 * 창 크기 제약 / 기본값. (사용자 리사이즈; 최대는 현재 모니터 작업영역의 가로·세로 절반 — 동적)
 */
export const MIN_WIDTH = 280
export const MIN_HEIGHT = 240
export const DEFAULT_WIDTH = 560
export const DEFAULT_HEIGHT = 420

/**
 * 영속 저장 스키마 (Phase 0 기본 + Phase 1 setup + Phase 2 hosts).
 */
export interface StoreSchema {
  /** 창 위치/크기(사용자 드래그 이동·리사이즈 결과). 재시작 시 복원. */
  windowBounds?: WindowBounds
  /**
   * 상시노출 여부 — 트레이에서 토글. true면 위젯을 우측 하단에 고정 표시, false면 트레이만.
   * 재시작 시 복원.
   */
  alwaysShow?: boolean
  /** 하단 로그 영역 표시 여부(기본 true) — 숨기면 창 높이가 로그 영역만큼 줄어든다. */
  logVisible?: boolean
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
   * 에이전트 티어 선택(월간 한도 대비 % 계산용). 호스트별 + 종합('__aggregate__').
   * 키: hostId → { claude|codex|gemini → 티어 문자열 }. 미설정은 기본 T1.
   */
  tiers?: Record<string, Record<string, string>>
  /**
   * 호스트별 자격증명(passphrase/password)의 safeStorage 암호문(base64).
   * 키: hostId. **평문 저장 금지** — 복호화는 credentials.ts 경유.
   */
  hostSecrets?: Record<string, string>
}

export const store = new Store<StoreSchema>({
  defaults: {}
})
