import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from './components/Header'
import { HostFormModal } from './components/HostFormModal'
import { LogPanel } from './components/LogPanel'
import { SetupPanel } from './components/SetupPanel'
import { StatusBar } from './components/StatusBar'
import { UsageGrid } from './components/UsageGrid'
import { canSwitch, connDot, currentAlias } from './lib/host'
import type {
  HostEntry,
  HostListResult,
  HostSetupStatus,
  HostStatusUpdate,
  LogEntry,
  UsageGrid as Grid
} from './lib/types'

/** 호스트별 로그 버퍼 최대 줄 수 */
const LOG_CAP = 200

/**
 * 위젯 루트. (UI_SPEC §2)
 * - 등록된 **모든 호스트 패널을 가로로 깔고**(각 패널 = 뷰포트 100% 폭), 현재 인덱스만 보이게 translateX.
 * - 창은 사용자 리사이즈 가능(최대 모니터 절반). 데이터는 메인이 모든 호스트를 백그라운드 폴링.
 */
function App() {
  const [grids, setGrids] = useState<Record<string, Grid>>({})
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({})
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

  // 활동 로그 구독 — 호스트별 버퍼에 누적(현재 보는 호스트만 표시)
  useEffect(() => {
    const off = window.api.log.onEntry((e) => {
      const entry = e as LogEntry
      const key = entry.hostId ?? '_global'
      setLogs((prev) => {
        const next = [...(prev[key] ?? []), entry]
        if (next.length > LOG_CAP) next.splice(0, next.length - LOG_CAP)
        return { ...prev, [key]: next }
      })
    })
    return off
  }, [])

  const index = Math.max(
    0,
    hosts.findIndex((h) => h.id === selectedHostId)
  )
  const currentHost = hosts[index] ?? null
  const currentGrid = currentHost ? (grids[currentHost.id] ?? null) : null
  const count = Math.max(1, hosts.length)

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
          <div
            className="carousel-strip"
            style={{
              width: `${count * 100}%`,
              transform: `translateX(-${index * (100 / count)}%)`
            }}
          >
            {hosts.map((h, i) => (
              <div
                key={h.id}
                className={`carousel-panel${i === index ? ' active' : ''}`}
                style={{ width: `${100 / count}%` }}
              >
                <UsageGrid grid={grids[h.id] ?? null} />
              </div>
            ))}
          </div>
        </div>
      </main>
      <StatusBar grid={currentGrid} setupStatus={setupStatus} onOpenSetup={() => setSetupOpen(true)} />
      <LogPanel entries={currentHost ? (logs[currentHost.id] ?? []) : []} />

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
