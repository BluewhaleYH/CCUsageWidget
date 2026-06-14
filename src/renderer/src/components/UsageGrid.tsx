/**
 * 2×3 사용량 그리드. (UI_SPEC §3.8 / DATA_SPEC §2.4)
 * CB1: 골격 플레이스홀더 — 실제 데이터/상태 렌더는 CB2에서 `usage:update` 연동.
 */
export function UsageGrid() {
  return <div className="usage-grid placeholder">데이터를 불러오는 중…</div>
}
