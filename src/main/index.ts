import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpc } from './ipc'
import { DEFAULT_NORMAL_HEIGHT, store, viewHeight } from './store'
import { usagePoller } from './usage/poller'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const bounds = store.get('windowBounds')
  const view = store.get('view') ?? 'normal'
  const normalHeight = bounds?.height ?? DEFAULT_NORMAL_HEIGHT

  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 360,
    height: viewHeight(view, normalHeight),
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 280,
    minHeight: 36,
    show: false,
    // 위젯 형태: 프레임 없음 / 투명 / 항상 위 / 작업표시줄 숨김
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // 보안 규칙 (CLAUDE.md): 절대 완화 금지
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.on('close', () => {
    if (!mainWindow) return
    const b = mainWindow.getBounds()
    const view = store.get('view') ?? 'normal'
    // normal 뷰일 때만 높이까지 저장. 접힘/확장 중엔 normal 높이를 보존한다.
    if (view === 'normal') {
      store.set('windowBounds', b)
    } else {
      const prev = store.get('windowBounds')
      store.set('windowBounds', {
        x: b.x,
        y: b.y,
        width: b.width,
        height: prev?.height ?? DEFAULT_NORMAL_HEIGHT
      })
    }
  })

  // 외부 링크는 기본 브라우저로
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.bluewhaleyh.ccusagewidget')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc(() => mainWindow)
  createWindow()

  // 30초 사용량 폴링 시작 (DATA_SPEC §2.3) — 현재 선택 호스트만 조회해 usage:update 푸시
  usagePoller.start(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
