import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Header } from './components/Header'
import { HostFormModal } from './components/HostFormModal'
import { LogPanel } from './components/LogPanel'
import { SetupPanel } from './components/SetupPanel'
import { StatusBar } from './components/StatusBar'
import { UsageGrid } from './components/UsageGrid'
import { AGGREGATE_ALIAS, AGGREGATE_ID, buildAggregateGrid } from './lib/aggregate'
import { connDot } from './lib/host'
import { tiersWithDefaults, type Tier } from './lib/tier'
import type { Provider } from './lib/types'
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

/** 캐러셀에 표시할 호스트(실제 + 종합 가상). */
interface DisplayHost {
  id: string
  alias: string
  virtual: boolean
}

/**
 * 위젯 루트. (UI_SPEC §2)
 * - 등록된 모든 호스트 패널을 가로로 깔고 현재 인덱스만 노출(translateX). 데이터는 메인 백그라운드 폴링.
 * - 호스트가 2개 이상이면 맨 앞에 **종합(가상)** 패널을 추가해 나머지 합산을 보여준다.
 * - 창은 사용자 리사이즈 가능(최대 모니터 절반).
 */
function App() {
  const [grids, setGrids] = useState<Record<string, Grid>>({})
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({})
  const [tiers, setTiers] = useState<Record<string, Record<string, string>>>({})
  const [hosts, setHosts] = useState<HostEntry[]>([])
  const [viewIndex, setViewIndex] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [setupStatus, setSetupStatus] = useState<HostSetupStatus>('unknown')
  const [setupOpen, setSetupOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const loadHosts = useCallback(async () => {
    const res = (await window.api.host.list()) as HostListResult
    setHosts(res.hosts)
  }, [])

  // usage 그리드 구독 — hostId별 맵에 누적(전 호스트 폴링 결과)
  useEffect(() => {
    const off = window.api.usage.onUpdate((g) => {
      if (g.hostId) setGrids((prev) => ({ ...prev, [g.hostId as string]: g }))
    })
    void window.api.usage.refresh()
    return off
  }, [])

  // 저장된 티어 선택 로드(월간 한도 % 계산용)
  useEffect(() => {
    void window.api.tier.getAll().then(setTiers)
  }, [])

  // 활동 로그 구독 — 호스트별 버퍼에 누적
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

  // 호스트가 2개 이상이면 맨 앞에 종합(가상) 추가
  const showAgg = hosts.length >= 2
  const displayHosts = useMemo<DisplayHost[]>(() => {
    const real = hosts.map((h) => ({ id: h.id, alias: h.alias, virtual: false }))
    return showAgg ? [{ id: AGGREGATE_ID, alias: AGGREGATE_ALIAS, virtual: true }, ...real] : real
  }, [hosts, showAgg])

  const aggGrid = useMemo(
    () =>
      showAgg ? buildAggregateGrid(grids, hosts.map((h) => h.id), new Date().toISOString()) : null,
    [grids, hosts, showAgg]
  )

  const count = Math.max(1, displayHosts.length)
  const index = ((viewIndex % count) + count) % count // 순환·항상 유효
  const current = displayHosts[index] ?? null
  const gridFor = (dh: DisplayHost): Grid | null => (dh.virtual ? aggGrid : (grids[dh.id] ?? null))
  const currentGrid = current ? gridFor(current) : null
  const currentRealId = current && !current.virtual ? current.id : null

  // 현재 보는 실제 호스트의 의존성 상태: 캐시 우선, 없을 때(최초)만 원격 점검 1회.
  useEffect(() => {
    if (!currentRealId) return
    let alive = true
    void window.api.setup.status({ hostId: currentRealId }).then((r) => {
      if (!alive) return
      setSetupStatus(r.status)
      if (r.status !== 'unknown') return
      void window.api.setup.check({ hostId: currentRealId }).then((c) => {
        if (alive) setSetupStatus(c.status)
      })
    })
    return () => {
      alive = false
    }
  }, [currentRealId])

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

  // 좌/우 전환 — 인덱스만 이동(순환). 데이터는 이미 폴링됨(재요청 없음).
  const switchHost = useCallback((direction: 'prev' | 'next') => {
    setViewIndex((v) => v + (direction === 'next' ? 1 : -1))
  }, [])

  // 에이전트 티어 선택(월간 한도 %) — 호스트/종합별. 낙관적 갱신 + 영속.
  const setTier = useCallback((hostId: string, provider: Provider, tier: Tier) => {
    setTiers((prev) => ({ ...prev, [hostId]: { ...(prev[hostId] ?? {}), [provider]: tier } }))
    void window.api.tier.set({ hostId, provider, tier })
  }, [])

  // 현재(실제) 호스트 삭제(내장 로컬·종합 제외).
  const deleteCurrentHost = useCallback(async () => {
    if (!currentRealId || currentRealId === 'local') return
    const removedId = currentRealId
    await window.api.host.remove({ id: removedId })
    setConfirmDelete(false)
    setGrids((prev) => {
      const next = { ...prev }
      delete next[removedId]
      return next
    })
    await loadHosts()
  }, [currentRealId, loadHosts])

  // 로그: 실제 호스트면 그 호스트, 종합이면 전 호스트 로그를 시간순 병합
  const currentLogs: LogEntry[] = current?.virtual
    ? Object.entries(logs)
        .filter(([k]) => k !== '_global')
        .flatMap(([, v]) => v)
        .sort((a, b) => a.ts.localeCompare(b.ts))
        .slice(-LOG_CAP)
    : current
      ? (logs[current.id] ?? [])
      : []

  return (
    <div ref={rootRef} className="widget">
      <Header
        alias={current?.alias ?? '호스트 없음'}
        canSwitch={displayHosts.length > 1}
        conn={connDot(currentGrid)}
        onPrev={() => switchHost('prev')}
        onNext={() => switchHost('next')}
        onAdd={() => setModalOpen(true)}
        canDelete={!!currentRealId && currentRealId !== 'local'}
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
            {displayHosts.map((dh, i) => (
              <div
                key={dh.id}
                className={`carousel-panel${i === index ? ' active' : ''}`}
                style={{ width: `${100 / count}%` }}
              >
                <UsageGrid
                  grid={gridFor(dh)}
                  tiers={tiersWithDefaults(dh.id ? tiers[dh.id] : undefined)}
                  onTierChange={(p, t) => setTier(dh.id, p, t)}
                />
              </div>
            ))}
          </div>
        </div>
      </main>
      <StatusBar
        grid={currentGrid}
        setupStatus={current?.virtual ? null : setupStatus}
        onOpenSetup={current?.virtual ? undefined : () => setSetupOpen(true)}
      />
      <LogPanel entries={currentLogs} />

      {modalOpen && (
        <HostFormModal
          onClose={() => setModalOpen(false)}
          onRegistered={() => {
            void loadHosts()
            void window.api.usage.refresh()
          }}
        />
      )}

      {setupOpen && currentRealId && (
        <SetupPanel
          hostId={currentRealId}
          hostAlias={current?.alias ?? currentRealId}
          onClose={() => setSetupOpen(false)}
          onStatusChange={setSetupStatus}
        />
      )}

      {confirmDelete && currentRealId && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="modal confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <strong>호스트 삭제</strong>
            </div>
            <p className="confirm-msg">
              <b>{current?.alias}</b> 호스트를 삭제할까요?
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
