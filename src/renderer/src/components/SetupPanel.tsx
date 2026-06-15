import { useEffect, useState } from 'react'
import { planNames, statusLabel, statusSeverity } from '../lib/setup'
import type { HostSetupStatus, SetupCheckResult, SetupInstallResult } from '../lib/types'

interface Props {
  hostId: string
  hostAlias: string
  onClose: () => void
  /** 점검/설치로 상태가 바뀌면 알림(칩 갱신) */
  onStatusChange: (status: HostSetupStatus) => void
}

/**
 * 의존성 점검/설치 패널. (SETUP_SPEC §4.2~4.4)
 * 열릴 때 현재 호스트를 점검하고, 누락 시 설치 명령 안내 + 동의(설치)까지.
 */
export function SetupPanel({ hostId, hostAlias, onClose, onStatusChange }: Props) {
  const [check, setCheck] = useState<SetupCheckResult | null>(null)
  const [install, setInstall] = useState<SetupInstallResult | null>(null)
  const [busy, setBusy] = useState(false)

  const runCheck = async (): Promise<void> => {
    setBusy(true)
    setInstall(null)
    try {
      const res = await window.api.setup.check({ hostId })
      setCheck(res)
      onStatusChange(res.status)
    } finally {
      setBusy(false)
    }
  }

  const runInstall = async (): Promise<void> => {
    if (!check) return
    setBusy(true)
    try {
      const res = await window.api.setup.install({ hostId, names: planNames(check.plan) })
      setInstall(res)
      setCheck({ report: res.report, status: res.status, plan: [] })
      onStatusChange(res.status)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void runCheck()
    // hostId 고정 패널이므로 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const status = check?.status ?? 'unknown'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>의존성 점검 · {hostAlias}</span>
          <button className="x" onClick={onClose} title="닫기">
            ✕
          </button>
        </div>

        {!check ? (
          <p className="setup-msg">점검 중…</p>
        ) : (
          <>
            <p className="setup-os">OS: {check.report.os}</p>
            <ul className="dep-list">
              {check.report.checks.map((c) => (
                <li key={c.name} className={c.installed ? 'on' : 'off'}>
                  <span className="dep-name">{c.name}</span>
                  <span className="dep-state">
                    {c.installed ? `✓ ${c.version ?? '설치됨'}` : '✗ 없음'}
                  </span>
                </li>
              ))}
            </ul>

            <p className={`setup-status ${statusSeverity(status)}`}>상태: {statusLabel(status)}</p>
            {status === 'ccusage-fallback' && (
              <p className="setup-note">ccusage 미설치 — 현재 `npx ccusage@latest` 폴백으로 동작 중</p>
            )}

            {check.plan.length > 0 && (
              <div className="install-plan">
                <p className="plan-title">설치할 항목:</p>
                <ul>
                  {check.plan.map((p) => (
                    <li key={p.name}>
                      <code>{p.command}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {install && (
              <ul className="outcome-list">
                {install.outcomes.map((o) => (
                  <li key={o.name} className={o.status}>
                    {o.name}: {o.status}
                    {o.error ? ` (${o.error})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="modal-actions">
          <button onClick={() => void runCheck()} disabled={busy}>
            다시 점검
          </button>
          {check && check.plan.length > 0 && (
            <button className="primary" onClick={() => void runInstall()} disabled={busy}>
              설치
            </button>
          )}
          <button onClick={onClose} disabled={busy}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
