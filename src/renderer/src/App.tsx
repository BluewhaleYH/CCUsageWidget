import { useState } from 'react'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { UsageGrid } from './components/UsageGrid'
import { toggleCollapse, toggleExpand, type View } from './lib/view'

/**
 * 위젯 루트. (UI_SPEC §2)
 * CB1: 셸 + 컴포넌트 구조 + 뷰(접기/확장) 로컬 상태 골격.
 * 데이터/호스트 연동(usage·host IPC)은 CB2~ 이후.
 */
function App() {
  const [view, setView] = useState<View>('normal')

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
            <UsageGrid />
          </main>
          <StatusBar />
        </>
      )}
    </div>
  )
}

export default App
