import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ensureLocalHost } from './hosts'
import { registerIpc } from './ipc'
import { disposeAllRunners } from './runnerFactory'
import { fixGuiPath } from './shellPath'
import { bottomRight, sizer } from './sizing'
import { clampWidth, DEFAULT_WIDTH, MAX_WIDTH, MIN_WIDTH, store, viewHeight } from './store'
import { trayController } from './tray'
import { usagePoller } from './usage/poller'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const bounds = store.get('windowBounds')
  // 접힘(collapsed) 뷰는 폐기 — 항상 펼침(normal). 표시/숨김은 트레이 상시노출로 제어.
  const view = 'normal' as const
  const height = viewHeight(view)
  const width = clampWidth(bounds?.width ?? DEFAULT_WIDTH)
  // 크기 잠금 관리자 초기화(복원된 뷰/너비). 이후 너비는 렌더러 fitWidth가 콘텐츠에 맞춰 조정.
  sizer.init(view, width)
  // 위젯은 화면 우측 하단 구석에 고정(이동 불가).
  const pos = bottomRight(width, height)

  mainWindow = new BrowserWindow({
    width,
    height,
    x: pos.x,
    y: pos.y,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    // 높이는 뷰로만 결정 — 사용자 드래그로 조정 불가하도록 현재 뷰 높이에 고정(min=max).
    minHeight: height,
    maxHeight: height,
    show: false,
    // 위젯 형태: 프레임 없음 / 투명 / 항상 위 / 작업표시줄 숨김 / 이동 불가(우측 하단 고정)
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    movable: false,
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

  // 상시노출 상태면 표시(우측 하단), 아니면 트레이만(숨김 유지).
  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) return
    if (trayController.isAlwaysShow()) {
      sizer.reposition(mainWindow)
      mainWindow.show()
    }
  })

  mainWindow.on('close', () => {
    if (!mainWindow) return
    const b = mainWindow.getBounds()
    // 너비만 저장(위치는 우측 하단 고정, 높이는 뷰로 결정). 너비는 제약 범위로 클램프.
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

  // 시스템 트레이(숨겨진 아이콘) 상주 — 상시노출 토글로 위젯 표시/숨김
  trayController.init(() => mainWindow)

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

// 종료 시 캐시된 SSH 연결·트레이 정리
app.on('will-quit', () => {
  disposeAllRunners()
  trayController.destroy()
})
