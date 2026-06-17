interface HeaderProps {
  /** 현재 호스트 별칭(없으면 안내 문구) */
  alias: string
  /** 등록된 호스트가 있어 좌/우 전환이 가능한가 */
  canSwitch: boolean
  /** 연결 점: on(연결)/off(끊김)/none(호스트 없음 — 숨김) */
  conn: 'on' | 'off' | 'none'
  onPrev: () => void
  onNext: () => void
  onAdd: () => void
  /** 현재 호스트 삭제 가능 여부(내장 로컬은 불가) */
  canDelete: boolean
  onDelete: () => void
  /** ─ 트레이로 숨기기 */
  onHide: () => void
}

/** 컨트롤 헤더바 — 좌측 호스트 컨트롤 + 우측 숨기기(─). 헤더 드래그로 위젯 이동. (UI_SPEC §3.2) */
export function Header({
  alias,
  canSwitch,
  conn,
  onPrev,
  onNext,
  onAdd,
  canDelete,
  onDelete,
  onHide
}: HeaderProps) {
  return (
    <header className="titlebar">
      <div className="left">
        {conn !== 'none' && (
          <span className={`conn-dot ${conn}`} title={conn === 'on' ? '연결됨' : '끊김'} />
        )}
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
        {canDelete && (
          <button className="nav del" title="현재 호스트 삭제" onClick={onDelete}>
            🗑
          </button>
        )}
      </div>
      <div className="controls">
        <button onClick={onHide} title="트레이로 숨기기">
          ─
        </button>
      </div>
    </header>
  )
}
