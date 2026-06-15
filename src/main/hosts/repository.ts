import { randomUUID } from 'crypto'
import { store } from '../store'
import type { HostEntry, HostInput } from './types'

/**
 * 호스트 저장소 — electron-store 기반 순수 CRUD + 선택 상태. (CONNECTION_SPEC §2, §3.5)
 * SSH·자격증명·연결테스트는 다루지 않는다(후속 체크박스에서 조합).
 */

/** 등록된 호스트 목록 반환 */
export function listHosts(): HostEntry[] {
  return store.get('hosts') ?? []
}

/** 호스트 목록을 통째로 설정한다(시드/마이그레이션용). */
export function setHosts(hosts: HostEntry[]): void {
  store.set('hosts', hosts)
}

/** id로 호스트 1건 조회 */
export function getHost(id: string): HostEntry | undefined {
  return listHosts().find((h) => h.id === id)
}

/**
 * 신규 호스트를 저장하고 저장된 엔트리를 반환한다.
 * id는 새로 발급, 상태는 'unknown'으로 초기화한다. (연결테스트/별칭은 호출부에서 채워 전달)
 */
export function addHost(input: HostInput & { alias: string }): HostEntry {
  const entry: HostEntry = {
    id: randomUUID(),
    host: input.host,
    port: input.port ?? 22,
    username: input.username,
    auth: input.auth,
    alias: input.alias,
    os: input.os ?? 'unknown',
    lastStatus: 'unknown'
  }
  store.set('hosts', [...listHosts(), entry])
  return entry
}

/**
 * 기존 호스트를 부분 수정한다. id는 변경 불가.
 * 존재하지 않으면 undefined.
 */
export function updateHost(
  id: string,
  patch: Partial<Omit<HostEntry, 'id'>>
): HostEntry | undefined {
  const hosts = listHosts()
  const idx = hosts.findIndex((h) => h.id === id)
  if (idx === -1) return undefined
  const updated: HostEntry = { ...hosts[idx], ...patch, id }
  const next = [...hosts]
  next[idx] = updated
  store.set('hosts', next)
  return updated
}

/** 호스트를 삭제한다. 삭제되었으면 true. (자격증명/선택 정리는 호출부 책임) */
export function removeHost(id: string): boolean {
  const hosts = listHosts()
  const next = hosts.filter((h) => h.id !== id)
  if (next.length === hosts.length) return false
  store.set('hosts', next)
  return true
}

// --- 선택 상태 (CONNECTION_SPEC §3.5) ---

/** 현재 선택된 호스트 id (없으면 undefined) */
export function getSelectedHostId(): string | undefined {
  return store.get('selectedHostId')
}

/** 현재 선택된 호스트 엔트리 */
export function getSelectedHost(): HostEntry | undefined {
  const id = getSelectedHostId()
  return id ? getHost(id) : undefined
}

/** 선택 호스트를 지정한다. undefined면 선택 해제(빈 상태). */
export function setSelectedHostId(id: string | undefined): void {
  if (id === undefined) store.delete('selectedHostId')
  else store.set('selectedHostId', id)
}
