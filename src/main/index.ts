import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ensureLocalHost } from './hosts'
import { registerIpc } from './ipc'
import { fixGuiPath } from './shellPath'
import { clampWidth, DEFAULT_WIDTH, MAX_WIDTH, MIN_WIDTH, store, viewHeight } from './store'
import { usagePoller } from './usage/poller'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const bounds = store.get('windowBounds')
  const view = store.get('view') ?? 'normal'
  const height = viewHeight(view)

  mainWindow = new BrowserWindow({
    width: clampWidth(bounds?.width ?? DEFAULT_WIDTH),
    height,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    // 높이는 뷰로만 결정 — 사용자 드래그로 조정 불가하도록 현재 뷰 높이에 고정(min=max).
    minHeight: height,
    maxHeight: height,
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
    // 위치·너비만 저장(높이는 뷰로 결정). 너비는 제약 범위로 클램프.
    store.set('windowBounds', { x: b.x, y: b.y, width: clampWidth(b.width), height: b.height })
  })

  // 창이 파괴되면 폴링 중지 + 참조 해제(파괴된 창에 push 방지)
  mainWindow.on('closed', () => {
    usagePoller.stop()
    mainWindow = null
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
  // GUI/패키징 실행 시 누락되는 로그인 셸 PATH 복구 (node/npm/ccusage 검출) — 최우선
  fixGuiPath()

  electronApp.setAppUserModelId('com.bluewhaleyh.ccusagewidget')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 내장 로컬 호스트 보장 + 기본 선택 (DATA_SPEC §1) — 폴링 전에 수행
  ensureLocalHost()

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
