import { useEffect, useRef } from 'react'
import type { LogEntry } from '../lib/types'

/** ISO → HH:MM:SS */
function clock(ts: string): string {
  const d = new Date(ts)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * 위젯 하단 로그 영역 — 현재 보는 호스트의 활동 로그.
 * 형식: `HH:MM:SS :: pc이름 :: 메시지`. 새 로그가 오면 자동으로 맨 아래로 스크롤.
 */
export function LogPanel({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries])

  return (
    <div className="logpanel" ref={ref}>
      {entries.length === 0 ? (
        <div className="log-empty">활동 로그가 여기에 표시됩니다…</div>
      ) : (
        entries.map((e, i) => (
          <div key={i} className={`log-line${e.level === 'error' ? ' err' : ''}`}>
            <span className="log-time">{clock(e.ts)}</span>
            <span className="log-sep">::</span>
            <span className="log-host">{e.hostAlias ?? '—'}</span>
            <span className="log-sep">::</span>
            <span className="log-msg">{e.message}</span>
          </div>
        ))
      )}
    </div>
  )
}
