import { limitFor, TIERS } from '../lib/tier'
import type { Provider } from '../lib/types'

const TIER_PROVIDERS: Array<{ key: Provider; label: string }> = [
  { key: 'claude', label: 'Claude' },
  { key: 'codex', label: 'Codex*' },
  { key: 'gemini', label: 'Gemini' }
]

/** ! 버튼 — hover 시 티어별 월간 한도($) 참고표를 보여준다. (Codex는 ChatGPT+Codex 합산) */
export function TierInfo() {
  return (
    <span className="tier-info">
      <button type="button" className="tier-info-btn" aria-label="한도값 안내">
        !
      </button>
      <div className="tier-info-pop">
        <div className="tier-info-title">월간 한도($) — 티어별</div>
        <table className="tier-table">
          <thead>
            <tr>
              <th>티어</th>
              {TIER_PROVIDERS.map((p) => (
                <th key={p.key}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t}>
                <td>{t}</td>
                {TIER_PROVIDERS.map((p) => (
                  <td key={p.key}>${limitFor(p.key, t)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tier-note">* Codex = ChatGPT + Codex 합산 사용량 기준</p>
      </div>
    </span>
  )
}
