import type { HostEntry, UsageGrid } from './types'

/** 호스트 없음 표시 문구 */
export const NO_HOST_LABEL = '등록된 호스트 없음'

/** 현재 선택 호스트의 별칭(없으면 안내 문구). (UI_SPEC §3.7) */
export function currentAlias(hosts: HostEntry[], selectedId: string | null): string {
  if (hosts.length === 0) return NO_HOST_LABEL
  const h = hosts.find((x) => x.id === selectedId) ?? hosts[0]
  return h?.alias ?? NO_HOST_LABEL
}

/** 좌/우 전환이 의미 있으려면 호스트가 2개 이상이어야 한다. */
export function canSwitch(hosts: HostEntry[]): boolean {
  return hosts.length > 1
}

/**
 * 헤더 연결 점 상태. (접힌 상태에서도 연결 여부를 보여준다)
 * - none: 호스트 없음(점 숨김)
 * - on: 연결됨, off: 끊김
 */
export function connDot(grid: UsageGrid | null): 'on' | 'off' | 'none' {
  if (!grid || grid.hostId === null) return 'none'
  return grid.connection === 'connected' ? 'on' : 'off'
}
