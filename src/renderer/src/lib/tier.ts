import type { Provider } from './types'

/** 에이전트별 티어(구독 등급). 월간 한도 = T1 기준액 + 티어 오프셋. */
export type Tier = 'T1' | 'T2H' | 'T2' | 'T3H' | 'T3' | 'T4H' | 'T4'

/** 드롭다운 표시 순서 */
export const TIERS: Tier[] = ['T1', 'T2H', 'T2', 'T3H', 'T3', 'T4H', 'T4']

export const DEFAULT_TIER: Tier = 'T1'

/** T1 기준 월간 한도($) — 에이전트별 */
const T1_BASE: Record<Provider, number> = {
  claude: 20,
  codex: 6,
  gemini: 14
}

/** 티어별 오프셋($) — 모든 에이전트 공통(T1 기준액에 더한다) */
const TIER_OFFSET: Record<Tier, number> = {
  T1: 0,
  T2H: 13,
  T2: 26,
  T3H: 18,
  T3: 36,
  T4H: 223,
  T4: 446
}

/** 에이전트·티어의 월간 한도($). */
export function limitFor(provider: Provider, tier: Tier): number {
  return T1_BASE[provider] + TIER_OFFSET[tier]
}

/** 한도 대비 사용 비율(%, 정수 반올림). 한도 0이면 0. */
export function usagePct(cost: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.round((cost / limit) * 100)
}

/** 호스트별 에이전트 티어 맵(미설정은 기본 T1). */
export type HostTiers = Record<Provider, Tier>

export function tiersWithDefaults(partial?: Partial<Record<Provider, Tier>>): HostTiers {
  return {
    claude: partial?.claude ?? DEFAULT_TIER,
    codex: partial?.codex ?? DEFAULT_TIER,
    gemini: partial?.gemini ?? DEFAULT_TIER
  }
}
