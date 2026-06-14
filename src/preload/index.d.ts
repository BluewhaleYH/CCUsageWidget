import type { WidgetApi } from './index'

declare global {
  interface Window {
    api: WidgetApi
  }
}
