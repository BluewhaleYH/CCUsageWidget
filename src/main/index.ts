import { app, shell, BrowserWindow, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ensureLocalHost } from './hosts'
import { registerIpc } from './ipc'
import { logBus } from './logBus'
import { disposeAllRunners } from './runnerFactory'
import { fixGuiPath } from './shellPath'
import { applyResizeBounds, bottomRight, initLogVisible, minHeight } from './sizing'
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, MIN_WIDTH, store } from './store'
import { trayController } from './tray'
import { usagePoller } from './usage/poller'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const bounds = store.get('windowBounds')
  // 로그 영역 표시 상태를 먼저 복원(최소 높이 계산에 반영)
  initLogVisible(store.get('logVisible') ?? true)
  const width = Math.max(MIN_WIDTH, bounds?.width ?? DEFAULT_WIDTH)
  const height = Math.max(minHeight(), bounds?.height ?? DEFAULT_HEIGHT)
  // 저장된 위치가 있으면 복원, 없으면(최초) 우측 하단 구석. 이후 드래그 이동·리사이즈 가능.
  const pos =
    bounds?.x != null && bounds?.y != null
      ? { x: bounds.x, y: bounds.y }
      : bottomRight(width, height)

  mainWindow = new BrowserWindow({
    width,
    height,
    x: pos.x,
    y: pos.y,
    minWidth: MIN_WIDTH,
    minHeight: minHeight(),
    show: false,
    // 위젯 형태: 프레임 없음 / 투명 / 항상 위 / 작업표시줄 숨김 / 드래그 이동·리사이즈 가능
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    movable: true,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // 숨김(트레이) 상태에서도 렌더러가 throttle되지 않도록 — 백그라운드 데이터 갱신 유지
      backgroundThrottling: false,
      // 보안 규칙 (CLAUDE.md): 절대 완화 금지
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 최대 크기 = 현재 모니터 절반(최소/최대 제약 적용 + 초과 시 클램프)
  applyResizeBounds(mainWindow)

  // 항상 **최상위 레이어**에 둔다 — 전체화면 앱·다른 always-on-top 창 위에도 가리지 않게.
  // (screen-saver = 가장 높은 레벨, visibleOnFullScreen = macOS 전체화면 스페이스 위에도 표시)
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // 상시노출 상태면 표시(저장된 위치), 아니면 트레이만(숨김 유지).
  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) return
    if (trayController.isAlwaysShow()) mainWindow.show()
  })

  const saveBounds = (): void => {
    if (!mainWindow) return
    const b = mainWindow.getBounds()
    // 위치(이동) + 크기(리사이즈) 저장.
    store.set('windowBounds', { x: b.x, y: b.y, width: b.width, height: b.height })
  }

  // 이동/리사이즈 후 저장(멈춤 400ms 디바운스). 이동 시 모니터가 바뀌었을 수 있으니 최대 크기 재계산.
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleSave = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveBounds, 400)
  }
  mainWindow.on('move', () => {
    if (mainWindow) applyResizeBounds(mainWindow) // 다른 모니터로 옮겼을 때 절반-최대 추종
    scheduleSave()
  })
  mainWindow.on('resize', scheduleSave)
  mainWindow.on('close', saveBounds)

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

  // 로그 버스 — 메인 활동을 위젯 하단 로그 영역으로 푸시
  logBus.init(() => mainWindow)

  // 시스템 트레이(숨겨진 아이콘) 상주 — 좌클릭/핫키로 위젯 표시/숨김
  trayController.init(() => mainWindow)

  // 글로벌 핫키로 표시/숨김 토글 (Cmd/Ctrl+Shift+U)
  globalShortcut.register('CommandOrControl+Shift+U', () => trayController.toggle())
  // 글로벌 핫키로 로그 영역 토글 (Cmd/Ctrl+Shift+L) — 렌더러에 알림
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('log:toggle')
  })

  // 30초 사용량 폴링 시작 (DATA_SPEC §2.3) — 현재 선택 호스트만 조회해 usage:update 푸시
  usagePoller.start(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 트레이 상주 앱 — 창을 숨겨도 종료하지 않는다. 종료는 트레이 '종료'(app.quit)로만.
app.on('window-all-closed', () => {
  // 의도적으로 비움(트레이로 상주)
})

// 종료 시 글로벌 핫키 해제 + 캐시된 SSH 연결·트레이 정리
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  disposeAllRunners()
  trayController.destroy()
})
