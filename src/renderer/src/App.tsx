import { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { UsageGrid } from './components/UsageGrid'
import { toggleCollapse, toggleExpand, type View } from './lib/view'
import type { UsageGrid as Grid } from './lib/types'

/**
 * 위젯 루트. (UI_SPEC §2)
 * usage:update 구독으로 그리드 데이터를 받아 렌더. 호스트 연동(◀▶/+)은 CB3~.
 */
function App() {
  const [view, setView] = useState<View>('normal')
  const [grid, setGrid] = useState<Grid | null>(null)

  useEffect(() => {
    const off = window.api.usage.onUpdate((g) => setGrid(g))
    // 구독 직후 1회 갱신 요청(초기 푸시 누락 방지)
    void window.api.usage.refresh()
    return off
  }, [])

  return (
    <div className={`widget view-${view}`}>
      <Header
        alias="CCUsageWidget"
        canSwitch={false}
        onPrev={() => {}}
        onNext={() => {}}
        onAdd={() => {}}
        onMinimize={() => setView(toggleCollapse)}
        onMaximize={() => setView(toggleExpand)}
        onClose={() => window.api.widget.close()}
      />

      {view !== 'collapsed' && (
        <>
          <main className="body">
            <UsageGrid grid={grid} />
          </main>
          <StatusBar grid={grid} />
        </>
      )}
    </div>
  )
}

export default App
