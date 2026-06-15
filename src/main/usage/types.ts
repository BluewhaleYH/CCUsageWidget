/**
 * 사용량 데이터 공용 타입. (DATA_SPEC §2.2)
 */

/** 코딩 에이전트 프로바이더 */
export type Provider = 'claude' | 'codex' | 'gemini'

/** 조회 기간 */
export type Period = 'daily' | 'monthly'

/** 전체 프로바이더 / 기간 (호출·그리드 구성 순서) */
export const PROVIDERS: Provider[] = ['claude', 'codex', 'gemini']
export const PERIODS: Period[] = ['daily', 'monthly']

/** 정규화된 단일 셀(프로바이더×기간). (DATA_SPEC §2.2) */
export interface UsageCell {
  provider: Provider
  period: Period
  /** 데이터 존재 여부 (false → UI "없음") */
  present: boolean
  /** 총 비용(USD) */
  cost: number
  inputTokens: number
  outputTokens: number
  /** 캐시 생성 토큰 */
  cacheCreationTokens: number
  /** 캐시 읽기 토큰 */
  cacheReadTokens: number
  totalTokens: number
  /** 사용된 모델 목록 */
  modelsUsed: string[]
}

/**
 * 그리드 진행 상태. (DATA_SPEC §2.5 로딩/에러 구분)
 * - loading: 조회 중(이전 셀을 유지한 채 표시)
 * - ready: 조회 완료(정상 — 연결 여부는 `connection`, 셀별 데이터는 `cell.present`로 구분)
 * - error: 조회 중 예외(러너 생성/실행 실패 등)
 */
export type UsageStatus = 'loading' | 'ready' | 'error'

/**
 * 한 호스트의 사용량 그리드(2행[기간] × 3열[프로바이더] = 6셀) + 메타. (DATA_SPEC §2.4)
 * 렌더러로 `usage:update`에 실어 푸시한다.
 */
export interface UsageGrid {
  /** 대상 호스트(없으면 null = 등록된 호스트 없음) */
  hostId: string | null
  hostAlias: string | null
  /** 마지막 갱신 시각(ISO) */
  updatedAt: string
  /** 진행 상태 (로딩/정상/에러) */
  status: UsageStatus
  /** SSH 연결 상태 (disconnected → UI "연결 안됨") */
  connection: 'connected' | 'disconnected'
  /** 6셀 (provider×period) */
  cells: UsageCell[]
  /** 조회 중 발생한 상위 오류 메시지(선택) */
  error?: string
}
