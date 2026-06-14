import { BrowserWindow, ipcMain } from 'electron'

type GetWindow = () => BrowserWindow | null

interface NotImplemented {
  ok: false
  error: string
}

/** Phase 1~3에서 구현될 채널의 임시 응답 */
function notImplemented(channel: string): NotImplemented {
  return { ok: false, error: `${channel} not implemented (Phase 0 skeleton)` }
}

/**
 * IPC 채널 등록 (Phase 0 골격).
 * - widget:* 는 실제 동작(창 제어)을 연결.
 * - usage:* / host:* 는 stub. 각각 DATA_SPEC / CONNECTION_SPEC 단계에서 구현.
 */
export function registerIpc(_getWindow: GetWindow): void {
  // --- widget 제어 ---
  ipcMain.handle('widget:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
  })
  ipcMain.handle('widget:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('widget:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
  })

  // --- usage (DATA_SPEC, Phase 3) ---
  ipcMain.handle('usage:refresh', () => notImplemented('usage:refresh'))

  // --- host (CONNECTION_SPEC, Phase 2) ---
  ipcMain.handle('host:list', () => notImplemented('host:list'))
  ipcMain.handle('host:add', () => notImplemented('host:add'))
  ipcMain.handle('host:test', () => notImplemented('host:test'))
  ipcMain.handle('host:switch', () => notImplemented('host:switch'))
  ipcMain.handle('host:remove', () => notImplemented('host:remove'))
}
