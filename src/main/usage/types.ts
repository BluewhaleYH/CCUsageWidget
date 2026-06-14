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
  totalTokens: number
}

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
  /** SSH 연결 상태 (disconnected → UI "연결 안됨") */
  connection: 'connected' | 'disconnected'
  /** 6셀 (provider×period) */
  cells: UsageCell[]
  /** 조회 중 발생한 상위 오류(선택) */
  error?: string
}
