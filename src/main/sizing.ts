import { screen, type BrowserWindow } from 'electron'
import { MIN_HEIGHT, MIN_WIDTH } from './store'

/** 우측 하단 구석 여백(px). */
const EDGE_MARGIN = 12

/** 주 디스플레이 작업영역 기준, 주어진 크기를 우측 하단에 앵커한 좌표(최초 실행 기본 위치). */
export function bottomRight(width: number, height: number): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: Math.round(workArea.x + workArea.width - width - EDGE_MARGIN),
    y: Math.round(workArea.y + workArea.height - height - EDGE_MARGIN)
  }
}

/** 창이 놓인 디스플레이 작업영역의 **가로·세로 절반**을 최대 크기로 잡는다. */
function halfMonitorMax(win: BrowserWindow): { maxW: number; maxH: number } {
  const b = win.getBounds()
  const { workArea } = screen.getDisplayNearestPoint({
    x: b.x + Math.floor(b.width / 2),
    y: b.y + Math.floor(b.height / 2)
  })
  return { maxW: Math.floor(workArea.width / 2), maxH: Math.floor(workArea.height / 2) }
}

/**
 * 리사이즈 제약을 적용한다 — 최소(MIN_WIDTH×MIN_HEIGHT), 최대(현재 모니터 절반).
 * 현재 크기가 최대를 넘으면 줄여서 맞춘다. (창 생성/이동 시 호출 — 모니터가 바뀌어도 추종)
 */
export function applyResizeBounds(win: BrowserWindow): void {
  const { maxW, maxH } = halfMonitorMax(win)
  win.setMinimumSize(MIN_WIDTH, MIN_HEIGHT)
  win.setMaximumSize(Math.max(MIN_WIDTH, maxW), Math.max(MIN_HEIGHT, maxH))
  const b = win.getBounds()
  const w = Math.min(b.width, maxW)
  const h = Math.min(b.height, maxH)
  if (w !== b.width || h !== b.height) win.setBounds({ x: b.x, y: b.y, width: w, height: h })
}
