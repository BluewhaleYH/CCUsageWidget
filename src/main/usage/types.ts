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
