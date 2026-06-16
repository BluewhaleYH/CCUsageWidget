import type { Period, Provider, UsageCell, UsageGrid } from './types'

/** 데이터 영역 표시 상태. (UI_SPEC §3.8) */
export type GridDisplayState = 'loading' | 'no-host' | 'disconnected' | 'error' | 'ready'

/**
 * 그리드의 표시 상태를 판정한다.
 * - 그리드 없음(초기): loading
 * - 호스트 없음: no-host ("등록된 호스트 없음")
 * - 에러: error
 * - 연결 안됨(로딩 중이 아님): disconnected ("연결 안됨")
 * - 그 외: ready (셀 표시 — 로딩 중이면 직전 셀 유지)
 */
export function gridState(grid: UsageGrid | null): GridDisplayState {
  if (!grid) return 'loading'
  if (grid.hostId === null) return 'no-host'
  if (grid.status === 'error') return 'error'
  if (grid.connection === 'disconnected' && grid.status !== 'loading') return 'disconnected'
  return 'ready'
}

/** 표시 순서 고정(Claude/Codex/Gemini). */
const PROVIDER_ORDER: Provider[] = ['claude', 'codex', 'gemini']

/**
 * 데이터가 하나라도 있는(어느 기간이든 present) 프로바이더만 표시 순서대로 반환한다.
 * 데이터 없는 에이전트(열)는 숨기므로, 이 목록으로 그리드 열·창 너비를 결정한다.
 */
export function visibleProviders(grid: UsageGrid): Provider[] {
  return PROVIDER_ORDER.filter((p) => grid.cells.some((c) => c.provider === p && c.present))
}

/** 그리드에서 (provider, period) 셀을 찾는다. */
export function gridCell(
  grid: UsageGrid,
  provider: Provider,
  period: Period
): UsageCell | undefined {
  return grid.cells.find((c) => c.provider === provider && c.period === period)
}
