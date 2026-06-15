/** 표시용 포맷 유틸 (순수 함수 — 테스트 대상) */

/** 비용(USD) → "$0.00" */
export function formatCost(usd: number): string {
  const n = Number.isFinite(usd) ? usd : 0
  return `$${n.toFixed(2)}`
}

/** 정수 → 천 단위 콤마("21,589") */
export function formatNumber(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  return v.toLocaleString('en-US')
}

/** 토큰 수 → 축약("1.2K"/"3.4M"/"5.6B"), 1000 미만은 그대로 */
export function formatTokens(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return String(v)
}

/** ISO 시각 → "HH:MM:SS" (유효하지 않으면 "--:--:--") */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--:--'
  return d.toTimeString().slice(0, 8)
}
