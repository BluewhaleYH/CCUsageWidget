import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Header } from './components/Header'
import { HostFormModal } from './components/HostFormModal'
import { SetupPanel } from './components/SetupPanel'
import { StatusBar } from './components/StatusBar'
import { UsageGrid } from './components/UsageGrid'
import { visibleProviders } from './lib/grid'
import { canSwitch, connDot, currentAlias } from './lib/host'
import { contentWidth, gridWidth } from './lib/layout'
import type {
  HostEntry,
  HostListResult,
  HostSetupStatus,
  HostStatusUpdate,
  UsageGrid as Grid
} from './lib/types'

/** usage-grid 자체 우측 패딩(px) — 패널 폭에 포함. */
const PANEL_PAD = 2

/**
 * 위젯 루트. (UI_SPEC §2)
 * - 등록된 **모든 호스트 패널을 가로로 깔고**, 현재 인덱스만 보이도록 translateX로 이동.
 * - 데이터는 메인이 모든 호스트를 백그라운드 폴링해 hostId별로 푸시 → 전환은 재요청 없이 즉시.
 */
function App() {
  const [grids, setGrids] = useState<Record<string, Grid>>({})
  const [hosts, setHosts] = useState<HostEntry[]>([])
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [setupStatus, setSetupStatus] = useState<HostSetupStatus>('unknown')
  const [setupOpen, setSetupOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const loadHosts = useCallback(async () => {
    const res = (await window.api.host.list()) as HostListResult
    setHosts(res.hosts)
    setSelectedHostId(res.selectedHostId)
  }, [])

  // usage 그리드 구독 — hostId별 맵에 누적(전 호스트 폴링 결과)
  useEffect(() => {
    const off = window.api.usage.onUpdate((g) => {
      if (g.hostId) setGrids((prev) => ({ ...prev, [g.hostId as string]: g }))
    })
    void window.api.usage.refresh()
    return off
  }, [])

  const index = Math.max(
    0,
    hosts.findIndex((h) => h.id === selectedHostId)
  )
  const currentHost = hosts[index] ?? null
  const currentGrid = currentHost ? (grids[currentHost.id] ?? null) : null

  /** 호스트의 표시 에이전트 수(최소 1 — 빈 패널도 폭 확보). */
  const agentCount = useCallback(
    (hostId: string): number => {
      const g = grids[hostId]
      return Math.max(1, g ? visibleProviders(g).length : 0)
    },
    [grids]
  )

  /** 각 패널 폭(px) = 그리드 폭 + usage-grid 우측 패딩. */
  const panelWidth = useCallback(
    (hostId: string): number => gridWidth(agentCount(hostId)) + PANEL_PAD,
    [agentCount]
  )

  // 현재 패널까지의 누적 오프셋(translateX) — 현재 인덱스만 보이게 strip을 이동
  const offset = useMemo(
    () => hosts.slice(0, index).reduce((sum, h) => sum + panelWidth(h.id), 0),
    [hosts, index, panelWidth]
  )

  // 현재 호스트의 에이전트 수에 맞춰 창 너비를 맞춘다(전환·데이터 도착 시)
  useEffect(() => {
    if (!currentHost) return
    void window.api.widget.fitWidth(contentWidth(agentCount(currentHost.id)))
  }, [currentHost, agentCount])

  // 현재(active) 패널 콘텐츠 높이를 측정해 창 높이를 맞춤(하단 빈 공간 제거).
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = (): void => {
      const header = root.querySelector('.titlebar') as HTMLElement | null
      const data = root.querySelector(
        '.carousel-panel.active .usage-grid, .carousel-panel.active .usage-msg'
      ) as HTMLElement | null
      const footer = root.querySelector('.statusbar') as HTMLElement | null
      let h = (header?.offsetHeight ?? 0) + 2 // + 위젯 테두리
      if (data) h += data.scrollHeight + 12 // + 본문(.body) 상하 패딩(6+6)
      if (footer) h += footer.offsetHeight
      void window.api.widget.fitHeight(Math.ceil(h))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    const data = root.querySelector('.carousel-panel.active .usage-grid, .carousel-panel.active .usage-msg')
    if (data) ro.observe(data)
    return () => ro.disconnect()
  }, [grids, selectedHostId, hosts])

  // 선택 호스트의 의존성 상태 칩: 캐시 우선, 캐시 없을 때(최초)만 원격 점검 1회.
  useEffect(() => {
    if (!selectedHostId) return
    let alive = true
    void window.api.setup.status({ hostId: selectedHostId }).then((r) => {
      if (!alive) return
      setSetupStatus(r.status)
      if (r.status !== 'unknown') return
      void window.api.setup.check({ hostId: selectedHostId }).then((c) => {
        if (alive) setSetupStatus(c.status)
      })
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

  // 좌/우 전환 — 인덱스(선택)만 이동. 데이터는 이미 폴링됨(재요청 없음).
  const switchHost = useCallback(
    async (direction: 'prev' | 'next') => {
      await window.api.host.switch(direction)
      await loadHosts()
    },
    [loadHosts]
  )

  // 현재 호스트 삭제(내장 로컬 제외). 메인이 자격증명 정리 + 다음 호스트 재선택.
  const deleteCurrentHost = useCallback(async () => {
    if (!currentHost || currentHost.id === 'local') return
    const removedId = currentHost.id
    await window.api.host.remove({ id: removedId })
    setConfirmDelete(false)
    setGrids((prev) => {
      const next = { ...prev }
      delete next[removedId]
      return next
    })
    await loadHosts()
  }, [currentHost, loadHosts])

  return (
    <div ref={rootRef} className="widget">
      <Header
        alias={currentAlias(hosts, selectedHostId)}
        canSwitch={canSwitch(hosts)}
        conn={connDot(currentGrid)}
        onPrev={() => void switchHost('prev')}
        onNext={() => void switchHost('next')}
        onAdd={() => setModalOpen(true)}
        canDelete={!!currentHost && currentHost.id !== 'local'}
        onDelete={() => setConfirmDelete(true)}
        onHide={() => window.api.widget.hide()}
      />

      <main className="body">
        <div className="carousel-viewport">
          <div className="carousel-strip" style={{ transform: `translateX(${-offset}px)` }}>
            {hosts.map((h, i) => (
              <div
                key={h.id}
                className={`carousel-panel${i === index ? ' active' : ''}`}
                style={{ width: panelWidth(h.id) }}
              >
                <UsageGrid grid={grids[h.id] ?? null} />
              </div>
            ))}
          </div>
        </div>
      </main>
      <StatusBar grid={currentGrid} setupStatus={setupStatus} onOpenSetup={() => setSetupOpen(true)} />

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

      {confirmDelete && currentHost && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="modal confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <strong>호스트 삭제</strong>
            </div>
            <p className="confirm-msg">
              <b>{currentAlias(hosts, currentHost.id)}</b> 호스트를 삭제할까요?
              <br />
              등록 정보와 자격증명이 함께 제거됩니다.
            </p>
            <div className="modal-actions">
              <button onClick={() => setConfirmDelete(false)}>취소</button>
              <button className="danger" onClick={() => void deleteCurrentHost()}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
