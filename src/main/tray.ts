import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron'
import { store } from './store'
import { TRAY_ICON_DATA_URL } from './trayIcon'

type GetWindow = () => BrowserWindow | null

/**
 * 시스템 트레이(윈도우의 숨겨진 아이콘 영역) 상주 컨트롤러.
 * - 좌클릭 / 우클릭 메뉴의 '상시노출'로 위젯을 우측 하단에 표시·숨김.
 * - '종료'로 앱을 끝낸다. 위젯 ✕는 닫지 않고 상시노출만 끈다(트레이 상주).
 */
class TrayController {
  private tray: Tray | null = null
  private getWindow: GetWindow = () => null

  /** 트레이 생성 + 메뉴(종료만). 표시/숨김 토글은 좌클릭·핫키로. */
  init(getWindow: GetWindow): void {
    this.getWindow = getWindow
    const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL)
    this.tray = new Tray(icon)
    this.tray.setToolTip('CCUsageWidget (좌클릭/핫키로 표시·숨김)')
    this.tray.on('click', () => this.toggle())
    this.tray.setContextMenu(Menu.buildFromTemplate([{ label: '종료', click: () => app.quit() }]))
  }

  /** 저장된 상시노출 여부(기본: 표시). */
  isAlwaysShow(): boolean {
    return store.get('alwaysShow') ?? true
  }

  /** 상시노출 토글. */
  toggle(): void {
    this.setAlwaysShow(!this.isAlwaysShow())
  }

  /** 상시노출 설정 — 위젯 표시/숨김 + 영속 + 메뉴 체크 갱신. */
  setAlwaysShow(value: boolean): void {
    store.set('alwaysShow', value)
    const win = this.getWindow()
    if (win) {
      if (value) win.show() // 마지막 위치 그대로 표시(사용자가 옮긴 자리 유지)
      else win.hide()
    }
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}

export const trayController = new TrayController()
