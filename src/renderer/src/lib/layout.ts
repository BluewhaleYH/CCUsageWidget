/**
 * 그리드/창 너비 레이아웃 상수. **App.css의 실제 값과 일치해야 한다.**
 * 에이전트 칸은 320px 고정이고, 창 너비를 콘텐츠(에이전트 수)에 맞춘다.
 */
export const AGENT_WIDTH = 320 // .grid-row 프로바이더 열 너비(고정)
export const LABEL_WIDTH = 42 // .grid-row 첫 열(기간 라벨) 너비
export const COLUMN_GAP = 8 // .grid-row gap
/** 본문/테두리/그리드 여백 합(좌우): .body padding 16 + .widget border 2 + .usage-grid padding-right 2 */
export const CHROME_WIDTH = 20

/** 표시 에이전트 수 n에 맞는 창 콘텐츠 너비(px). */
export function contentWidth(n: number): number {
  // 그리드 아이템 = 라벨 + 에이전트 n개 → 사이 간격 n개
  return LABEL_WIDTH + n * AGENT_WIDTH + n * COLUMN_GAP + CHROME_WIDTH
}
