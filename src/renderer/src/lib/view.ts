/** 위젯 뷰 상태 + 전이 로직 (순수 — 테스트 대상). (UI_SPEC §3.4~3.5) */

export type View = 'collapsed' | 'normal' | 'expanded'

/**
 * ─ (최소화=접기) 토글.
 * 접힌 상태면 normal로 펼치고, 아니면 collapsed로 접는다.
 */
export function toggleCollapse(view: View): View {
  return view === 'collapsed' ? 'normal' : 'collapsed'
}

/**
 * □ (최대화=상세 확장) 토글.
 * 확장 상태면 normal로 복귀, 아니면 expanded로 확장(접힘 상태에서도 확장 가능).
 */
export function toggleExpand(view: View): View {
  return view === 'expanded' ? 'normal' : 'expanded'
}
