import { useCallback, useEffect, useState } from 'react'
import { Header } from './components/Header'
import { HostFormModal } from './components/HostFormModal'
import { SetupPanel } from './components/SetupPanel'
import { StatusBar } from './components/StatusBar'
import { UsageGrid } from './components/UsageGrid'
import { canSwitch, connDot, currentAlias } from './lib/host'
import { maximize, toggleCollapse, type View } from './lib/view'
import type {
  HostEntry,
  HostListResult,
  HostSetupStatus,
  HostStatusUpdate,
  UsageGrid as Grid
} from './lib/types'

/**
 * 위젯 루트. (UI_SPEC §2)
 * usage:update 구독으로 그리드 렌더, host:* 로 호스트 목록·전환.
 */
function App() {
  const [view, setView] = useState<View>('normal')
  const [grid, setGrid] = useState<Grid | null>(null)
  const [hosts, setHosts] = useState<HostEntry[]>([])
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [setupStatus, setSetupStatus] = useState<HostSetupStatus>('unknown')
  const [setupOpen, setSetupOpen] = useState(false)

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

  // 저장된 뷰(접힘/정상/확장) 복원
  useEffect(() => {
    void window.api.widget.getView().then((v) => setView(v))
  }, [])

  // 뷰 전이 + 창 리사이즈/영속화(main)
  const applyView = useCallback((next: View) => {
    setView(next)
    void window.api.widget.setView(next)
  }, [])

  // 선택 호스트의 의존성 상태 칩: 캐시 즉시 표시 후 신선 점검(로컬은 빠름, 원격은 1회 SSH)
  useEffect(() => {
    if (!selectedHostId) return
    let alive = true
    void window.api.setup.status({ hostId: selectedHostId }).then((r) => {
      if (alive) setSetupStatus(r.status)
    })
    void window.api.setup.check({ hostId: selectedHostId }).then((r) => {
      if (alive) setSetupStatus(r.status)
    })
    return () => {
      alive = false
    }
  }, [selectedHostId])

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
        conn={connDot(grid)}
        view={view}
        onPrev={() => void switchHost('prev')}
        onNext={() => void switchHost('next')}
        onAdd={() => setModalOpen(true)}
        onMinimize={() => applyView(toggleCollapse(view))}
        onMaximize={() => applyView(maximize())}
        onClose={() => window.api.widget.close()}
      />

      {view !== 'collapsed' && (
        <>
          <main className="body">
            <UsageGrid grid={grid} />
          </main>
          <StatusBar
            grid={grid}
            setupStatus={setupStatus}
            onOpenSetup={() => setSetupOpen(true)}
          />
        </>
      )}

      {modalOpen && (
        <HostFormModal
          onClose={() => setModalOpen(false)}
          onRegistered={() => {
            void loadHosts()
            void window.api.usage.refresh()
          }}
        />
      )}

      {setupOpen && (
        <SetupPanel
          hostId={selectedHostId ?? 'local'}
          hostAlias={currentAlias(hosts, selectedHostId)}
          onClose={() => setSetupOpen(false)}
          onStatusChange={setSetupStatus}
        />
      )}
    </div>
  )
}

export default App
