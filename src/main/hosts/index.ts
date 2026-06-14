import { defaultAlias } from './alias'
import { buildSshConfig, testConnection, type ConnectionInput } from './connection'
import * as credentials from './credentials'
import * as repository from './repository'
import type { HostEntry } from './types'

// hosts 모듈 facade — 호출부(IPC 등)는 여기서 가져다 쓴다.
export * from './types'
export { defaultAlias } from './alias'
export { buildSshConfig, testConnection } from './connection'
export type { ConnectionInput, ConnectionTestResult } from './connection'
export * as repository from './repository'
export * as credentials from './credentials'

/** 등록 입력(폼 데이터 + 별칭 후보) */
export interface RegisterHostInput extends ConnectionInput {
  /** 사용자가 입력한 별칭(없으면 OS 기반 기본값 제안) */
  alias?: string
}

export type RegisterHostResult =
  | { ok: true; host: HostEntry }
  | { ok: false; error: string }

/**
 * IP 등록 플로우. (CONNECTION_SPEC §3.2)
 * 저장 전 **연결 테스트**를 먼저 수행하고, 성공해야만 저장한다.
 *
 * @param input 호스트 입력(host/port/username/auth + 선택 alias)
 * @param secret 키 패스프레이즈 또는 비밀번호(safeStorage로 보관). 불필요하면 생략.
 */
export async function registerHost(
  input: RegisterHostInput,
  secret?: string
): Promise<RegisterHostResult> {
  // 1) 연결 테스트 + OS 감지
  let config: ReturnType<typeof buildSshConfig>
  try {
    config = buildSshConfig(input, secret)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  const test = await testConnection(config)
  if (!test.ok) {
    return { ok: false, error: test.error ?? '연결에 실패했습니다.' }
  }

  // 2) 별칭 결정(사용자 입력 우선, 없으면 OS 기반 기본값)
  const alias = input.alias?.trim() || defaultAlias(test.os, input.host)

  // 3) 저장
  const entry = repository.addHost({
    host: input.host,
    port: input.port,
    username: input.username,
    auth: input.auth,
    alias,
    os: test.os
  })

  // 4) 자격증명 보관(safeStorage). 실패 시 호스트 롤백.
  if (secret) {
    try {
      credentials.saveSecret(entry.id, secret)
    } catch (err) {
      repository.removeHost(entry.id)
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  // 5) 연결 성공 상태 반영
  const saved =
    repository.updateHost(entry.id, {
      lastStatus: 'connected',
      lastCheckedAt: new Date().toISOString()
    }) ?? entry

  return { ok: true, host: saved }
}

/** 전환 방향 또는 직접 선택할 호스트 id */
export type SwitchDirection = 'prev' | 'next'

/**
 * 특정 호스트를 직접 선택한다. 존재하지 않는 id면 무시하고 현재 선택 반환.
 */
export function selectHost(id: string): HostEntry | undefined {
  if (repository.getHost(id)) repository.setSelectedHostId(id)
  return repository.getSelectedHost()
}

/**
 * 등록된 호스트를 좌/우로 순환 전환한다. (CONNECTION_SPEC §3.5)
 * - 빈 목록: 선택 해제 후 undefined.
 * - 미선택 상태: next→첫 항목, prev→마지막 항목.
 * - 양 끝에서 순환.
 * 선택 상태는 저장되어 재시작 시 복원된다.
 */
export function switchHost(direction: SwitchDirection): HostEntry | undefined {
  const ids = repository.listHosts().map((h) => h.id)
  if (ids.length === 0) {
    repository.setSelectedHostId(undefined)
    return undefined
  }

  const current = repository.getSelectedHostId()
  const idx = current ? ids.indexOf(current) : -1
  const len = ids.length

  let target: number
  if (idx === -1) {
    target = direction === 'next' ? 0 : len - 1
  } else {
    target = direction === 'next' ? (idx + 1) % len : (idx - 1 + len) % len
  }

  repository.setSelectedHostId(ids[target])
  return repository.getSelectedHost()
}
