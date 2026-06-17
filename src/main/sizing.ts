import { screen, type BrowserWindow } from 'electron'
import {
  clampWidth,
  COLLAPSED_HEIGHT,
  MAX_WIDTH,
  MIN_WIDTH,
  SHOWN_HEIGHT,
  SHOWN_MAX,
  SHOWN_MIN,
  type WidgetView
} from './store'

/** 우측 하단 구석 여백(px). */
const EDGE_MARGIN = 12

/** 주 디스플레이 작업영역 기준, 주어진 크기를 우측 하단에 앵커한 좌표. */
export function bottomRight(width: number, height: number): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: Math.round(workArea.x + workArea.width - width - EDGE_MARGIN),
    y: Math.round(workArea.y + workArea.height - height - EDGE_MARGIN)
  }
}

/**
 * 창 크기를 뷰/콘텐츠에 맞춰 **잠가서**(min=max) 관리한다. (UI_SPEC 위젯 동작)
 * - **너비**: 콘텐츠(표시 에이전트 수×320 + 여백)에 맞춤 — 렌더러 `widget:fitWidth`로 전달.
 * - **높이**: collapsed=헤더만(고정), normal=콘텐츠 높이(`widget:fitHeight`).
 *
 * 너비·높이 잠금이 서로 덮어쓰지 않도록 두 값을 한곳에서 보관하고, 변경 시 함께 적용한다.
 * (과거: fitHeight가 매번 너비 잠금을 MIN_WIDTH로 풀어버려 너비 고정과 충돌)
 */
class WindowSizer {
  private view: WidgetView = 'normal'
  private width = clampWidth(SHOWN_HEIGHT) // placeholder, init()에서 실제 너비로 교체
  private normalHeight = SHOWN_HEIGHT

  /** 시작 시 복원된 뷰/너비로 초기화. */
  init(view: WidgetView, width: number): void {
    this.view = view
    this.width = clampWidth(width)
    this.normalHeight = SHOWN_HEIGHT
  }

  /** 뷰 전환(접힘/펼침) — 높이만 바뀌고 너비는 유지. */
  setView(win: BrowserWindow, view: WidgetView): void {
    this.view = view
    this.apply(win)
  }

  /** 펼침 콘텐츠 높이 반영(접힘 상태에서는 무시). */
  fitHeight(win: BrowserWindow, height: number): void {
    if (this.view !== 'normal') return
    this.normalHeight = Math.max(SHOWN_MIN, Math.min(SHOWN_MAX, Math.round(height)))
    this.apply(win)
  }

  /** 콘텐츠 너비 반영(에이전트 수 변화). */
  fitWidth(win: BrowserWindow, width: number): void {
    this.width = clampWidth(width)
    this.apply(win)
  }

  private height(): number {
    return this.view === 'collapsed' ? COLLAPSED_HEIGHT : this.normalHeight
  }

  /** 현재 위치를 우측 하단에 재앵커한다(크기 변화 없이). 표시 직전·디스플레이 변경 시 사용. */
  reposition(win: BrowserWindow): void {
    const { x, y } = bottomRight(this.width, this.height())
    win.setBounds({ x, y })
  }

  /** 현재 너비·높이로 우측 하단에 앵커해 리사이즈 후 그 크기에 잠근다(드래그 불가). */
  private apply(win: BrowserWindow): void {
    const w = this.width
    const h = this.height()
    const { x, y } = bottomRight(w, h)
    // 잠금 잠시 풀고 리사이즈 후 재잠금(min=max → 사용자 드래그로 조정 불가).
    win.setMinimumSize(MIN_WIDTH, COLLAPSED_HEIGHT)
    win.setMaximumSize(MAX_WIDTH, SHOWN_MAX)
    win.setBounds({ x, y, width: w, height: h })
    win.setMinimumSize(w, h)
    win.setMaximumSize(w, h)
  }
}

export const sizer = new WindowSizer()
