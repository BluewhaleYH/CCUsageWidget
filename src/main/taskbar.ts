import { app, type BrowserWindow } from 'electron'
import type { WidgetView } from './store'

/**
 * 최소화(collapsed) 상태에서만 작업표시줄/Dock에 노출한다. (UI_SPEC 위젯 동작)
 * - **Windows/Linux**: `setSkipTaskbar` 토글(작업표시줄 표시/숨김).
 * - **macOS**: `app.dock` 표시/숨김(skipTaskbar는 mac Dock에 무효).
 *
 * 펼침(normal)은 데스크톱 위젯이므로 작업표시줄/Dock에서 숨겨 깔끔하게 띄우고,
 * 최소화하면 작업표시줄/Dock에 나타나 다시 찾거나 포커스할 수 있게 한다.
 */
export function applyTaskbarVisibility(win: BrowserWindow, view: WidgetView): void {
  const showInTaskbar = view === 'collapsed'
  win.setSkipTaskbar(!showInTaskbar)
  if (process.platform === 'darwin' && app.dock) {
    if (showInTaskbar) void app.dock.show()
    else app.dock.hide()
  }
}
