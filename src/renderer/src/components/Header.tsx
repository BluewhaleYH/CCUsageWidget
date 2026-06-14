interface HeaderProps {
  /** 현재 호스트 별칭(없으면 안내 문구) */
  alias: string
  /** 등록된 호스트가 있어 좌/우 전환이 가능한가 */
  canSwitch: boolean
  onPrev: () => void
  onNext: () => void
  onAdd: () => void
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
}

/** 컨트롤 헤더바 — 드래그 이동 영역, 좌측 호스트 컨트롤 + 우측 창 컨트롤. (UI_SPEC §3.2) */
export function Header({
  alias,
  canSwitch,
  onPrev,
  onNext,
  onAdd,
  onMinimize,
  onMaximize,
  onClose
}: HeaderProps) {
  return (
    <header className="titlebar">
      <div className="left">
        <button className="nav" title="이전 호스트" onClick={onPrev} disabled={!canSwitch}>
          ◀
        </button>
        <span className="alias">{alias}</span>
        <button className="nav" title="다음 호스트" onClick={onNext} disabled={!canSwitch}>
          ▶
        </button>
        <button className="nav add" title="호스트 등록" onClick={onAdd}>
          +
        </button>
      </div>
      <div className="controls">
        <button onClick={onMinimize} title="접기">
          ─
        </button>
        <button onClick={onMaximize} title="확장">
          □
        </button>
        <button onClick={onClose} title="종료">
          ✕
        </button>
      </div>
    </header>
  )
}
