import type { OsType } from '../setup/types'

/** OS별 기본 별칭 라벨 (CONNECTION_SPEC §3.4) */
const OS_LABEL: Record<OsType, string> = {
  macos: '맥',
  ubuntu: '우분투',
  windows: '윈도우',
  unknown: '호스트'
}

/**
 * OS 감지 결과로 기본 별칭을 제안한다. (CONNECTION_SPEC §3.4)
 * 예: ('macos', '10.0.0.5') → '맥 (10.0.0.5)'
 * 사용자가 자유롭게 수정할 수 있으며, 이 값은 제안 기본값으로만 쓰인다.
 */
export function defaultAlias(os: OsType, host: string): string {
  const label = OS_LABEL[os] ?? OS_LABEL.unknown
  const trimmed = host.trim()
  return trimmed ? `${label} (${trimmed})` : label
}
