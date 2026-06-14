import type { OsType } from '../setup/types'

/**
 * 호스트 인증 방식. (CONNECTION_SPEC §2)
 * 비밀(passphrase/password)은 이 구조에 **저장하지 않는다** — safeStorage(`credentials.ts`)로 분리 보관.
 * store에는 `method`와 비민감 메타(키 경로)만 둔다.
 */
export type SshAuth =
  | { method: 'key'; privateKeyPath: string }
  | { method: 'password' }

/** 등록된 원격 호스트 1건. (CONNECTION_SPEC §2) */
export interface HostEntry {
  /** 내부 식별자 */
  id: string
  /** IP 또는 도메인 */
  host: string
  /** SSH 포트(기본 22) */
  port: number
  username: string
  auth: SshAuth
  /** 표시용 별칭 */
  alias: string
  /** 감지된 OS (setup/types의 OsType 재사용) */
  os: OsType
  /** 마지막 연결 상태 */
  lastStatus: 'connected' | 'disconnected' | 'unknown'
  /** 마지막 점검 시각 (ISO timestamp) */
  lastCheckedAt?: string
}

/**
 * 호스트 신규 등록 입력 (id/상태는 저장소가 채움).
 * 비밀은 별도 인자로 전달받아 credentials에 저장한다(여기 포함 금지).
 */
export interface HostInput {
  host: string
  port?: number
  username: string
  auth: SshAuth
  alias?: string
  os?: OsType
}
