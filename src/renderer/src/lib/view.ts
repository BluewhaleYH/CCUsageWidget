/** 위젯 뷰 상태 + 전이 로직 (순수 — 테스트 대상). (UI_SPEC §3.4~3.5) */

export type View = 'collapsed' | 'normal'

/**
 * ─ (최소화=접기) 토글. 접힘 ↔ 펼침.
 */
export function toggleCollapse(view: View): View {
  return view === 'collapsed' ? 'normal' : 'collapsed'
}

/**
 * □ (최대화) — 항상 펼침(데이터 표시). 최소화 상태에서 펼치는 단순 동작.
 */
export function maximize(): View {
  return 'normal'
}
