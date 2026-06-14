import { useState } from 'react'
import { buildConnArgs, emptyHostForm, validateHostForm, type HostForm } from '../lib/form'
import type { ConnectionTestResult, RegisterHostResult } from '../lib/types'

interface Props {
  onClose: () => void
  onRegistered: () => void
}

/** IP 등록 폼/모달. (UI_SPEC §3.6) — 입력 → 연결 테스트 → 등록. */
export function HostFormModal({ onClose, onRegistered }: Props) {
  const [form, setForm] = useState<HostForm>(emptyHostForm)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [test, setTest] = useState<ConnectionTestResult | null>(null)

  const set = <K extends keyof HostForm>(k: K, v: HostForm[K]): void =>
    setForm((f) => ({ ...f, [k]: v }))

  const runTest = async (): Promise<void> => {
    const errs = validateHostForm(form)
    setErrors(errs)
    setTest(null)
    if (errs.length) return
    setBusy(true)
    try {
      const args = buildConnArgs(form)
      const res = (await window.api.host.test(args)) as ConnectionTestResult
      setTest(res)
      if (res.ok && !form.alias.trim()) {
        // OS 기반 별칭 제안(사용자 수정 가능)
        const label = { macos: '맥', ubuntu: '우분투', windows: '윈도우', unknown: '호스트' }[res.os]
        set('alias', `${label} (${form.host.trim()})`)
      }
    } finally {
      setBusy(false)
    }
  }

  const submit = async (): Promise<void> => {
    const errs = validateHostForm(form)
    setErrors(errs)
    if (errs.length) return
    setBusy(true)
    try {
      const res = (await window.api.host.add(buildConnArgs(form))) as RegisterHostResult
      if (res.ok) {
        onRegistered()
        onClose()
      } else {
        setErrors([res.error])
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>호스트 등록</span>
          <button className="x" onClick={onClose} title="닫기">
            ✕
          </button>
        </div>

        <div className="field-row">
          <label>host</label>
          <input value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="10.0.0.5" />
          <label className="port-label">port</label>
          <input className="port" value={form.port} onChange={(e) => set('port', e.target.value)} />
        </div>

        <div className="field-row">
          <label>user</label>
          <input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="ubuntu" />
        </div>

        <div className="field-row">
          <label>인증</label>
          <select value={form.method} onChange={(e) => set('method', e.target.value as HostForm['method'])}>
            <option value="password">비밀번호</option>
            <option value="key">SSH 키</option>
          </select>
        </div>

        {form.method === 'password' ? (
          <div className="field-row">
            <label>비밀번호</label>
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
          </div>
        ) : (
          <>
            <div className="field-row">
              <label>키 경로</label>
              <input value={form.privateKeyPath} onChange={(e) => set('privateKeyPath', e.target.value)} placeholder="~/.ssh/id_ed25519" />
            </div>
            <div className="field-row">
              <label>패스프레이즈</label>
              <input type="password" value={form.passphrase} onChange={(e) => set('passphrase', e.target.value)} placeholder="(선택)" />
            </div>
          </>
        )}

        <div className="field-row">
          <label>별칭</label>
          <input value={form.alias} onChange={(e) => set('alias', e.target.value)} placeholder="(자동 제안)" />
        </div>

        {errors.length > 0 && (
          <ul className="form-errors">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        {test && (
          <p className={`test-result ${test.ok ? 'ok' : 'fail'}`}>
            {test.ok ? `연결 성공 · OS: ${test.os}` : `연결 실패: ${test.error ?? ''}`}
          </p>
        )}

        <div className="modal-actions">
          <button onClick={() => void runTest()} disabled={busy}>
            연결 테스트
          </button>
          <button className="primary" onClick={() => void submit()} disabled={busy}>
            등록
          </button>
        </div>
      </div>
    </div>
  )
}
