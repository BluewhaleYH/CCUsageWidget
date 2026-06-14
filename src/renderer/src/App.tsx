import { useCallback, useEffect, useState } from 'react'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { UsageGrid } from './components/UsageGrid'
import { canSwitch, currentAlias } from './lib/host'
import { toggleCollapse, toggleExpand, type View } from './lib/view'
import type { HostEntry, HostListResult, HostStatusUpdate, UsageGrid as Grid } from './lib/types'

/**
 * 위젯 루트. (UI_SPEC §2)
 * usage:update 구독으로 그리드 렌더, host:* 로 호스트 목록·전환.
 */
function App() {
  const [view, setView] = useState<View>('normal')
  const [grid, setGrid] = useState<Grid | null>(null)
  const [hosts, setHosts] = useState<HostEntry[]>([])
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null)

  const loadHosts = useCallback(async () => {
    const res = (await window.api.host.list()) as HostListResult
    setHosts(res.hosts)
    setSelectedHostId(res.selectedHostId)
  }, [])

  // usage 그리드 구독
  useEffect(() => {
    const off = window.api.usage.onUpdate((g) => setGrid(g))
    void window.api.usage.refresh()
    return off
  }, [])

  // 호스트 목록 로드 + 연결 상태 푸시 구독
  useEffect(() => {
    void loadHosts()
    const off = window.api.host.onStatus((s) => {
      const u = s as HostStatusUpdate
      setHosts((prev) =>
        prev.map((h) =>
          h.id === u.id ? { ...h, lastStatus: u.lastStatus, lastCheckedAt: u.lastCheckedAt } : h
        )
      )
    })
    return off
  }, [loadHosts])

  const switchHost = useCallback(
    async (direction: 'prev' | 'next') => {
      await window.api.host.switch(direction)
      await loadHosts() // 선택 변경 반영 (그리드는 host:switch가 즉시 갱신 푸시)
    },
    [loadHosts]
  )

  return (
    <div className={`widget view-${view}`}>
      <Header
        alias={currentAlias(hosts, selectedHostId)}
        canSwitch={canSwitch(hosts)}
        onPrev={() => void switchHost('prev')}
        onNext={() => void switchHost('next')}
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
