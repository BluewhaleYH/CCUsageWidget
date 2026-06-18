import { screen, type BrowserWindow } from 'electron'
import { MIN_HEIGHT, MIN_WIDTH } from './store'

/** 우측 하단 구석 여백(px). */
const EDGE_MARGIN = 12

/** 하단 로그 영역 높이(px) — .logpanel(96) + border(1). 숨김/표시 시 창 높이를 이만큼 가감. */
export const LOG_AREA_HEIGHT = 97

/** 현재 로그 영역 표시 여부(최소 높이·창 높이 계산에 사용). */
let logAreaVisible = true

/** 시작 시 저장된 로그 표시 상태로 초기화(창 높이는 이미 그 상태로 저장돼 있음 — 변경 안 함). */
export function initLogVisible(visible: boolean): void {
  logAreaVisible = visible
}

/** 로그 영역 유무에 따른 최소 높이(로그 표시: MIN_HEIGHT, 숨김: 그만큼 낮게). */
export function minHeight(): number {
  return logAreaVisible ? MIN_HEIGHT : MIN_HEIGHT - LOG_AREA_HEIGHT
}

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
  const minH = minHeight()
  win.setMinimumSize(MIN_WIDTH, minH)
  win.setMaximumSize(Math.max(MIN_WIDTH, maxW), Math.max(minH, maxH))
  const b = win.getBounds()
  const w = Math.min(b.width, maxW)
  const h = Math.min(b.height, maxH)
  if (w !== b.width || h !== b.height) win.setBounds({ x: b.x, y: b.y, width: w, height: h })
}

/**
 * 로그 영역 표시/숨김에 맞춰 **창 높이를 로그 영역만큼 가감**한다(데이터 영역 크기는 유지).
 * 상단(좌상단) 고정 — 아래쪽에서 줄거나 늘어난다. 이미 그 상태면 no-op.
 */
export function setLogArea(win: BrowserWindow, visible: boolean): void {
  if (visible === logAreaVisible) return
  logAreaVisible = visible
  const minH = minHeight()
  const { maxH } = halfMonitorMax(win)
  const b = win.getBounds()
  const target = b.height + (visible ? LOG_AREA_HEIGHT : -LOG_AREA_HEIGHT)
  const h = Math.max(minH, Math.min(maxH, target))
  win.setMinimumSize(MIN_WIDTH, minH)
  win.setBounds({ x: b.x, y: b.y, width: b.width, height: h })
}
