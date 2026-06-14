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
