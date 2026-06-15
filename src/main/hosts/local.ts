import type { OsType } from '../setup/types'
import * as repository from './repository'
import type { HostEntry } from './types'

/**
 * 내장 "로컬" 호스트. (DATA_SPEC §1)
 * 위젯이 실행되는 컴퓨터를 SSH 없이 직접 조회하는 기본 호스트.
 * id는 runnerFactory의 로컬 키와 동일해야 한다('local' → LocalCommandRunner).
 */
export const LOCAL_HOST_ID = 'local'

/** process.platform → OsType */
export function localOs(): OsType {
  switch (process.platform) {
    case 'darwin':
      return 'macos'
    case 'linux':
      return 'ubuntu'
    case 'win32':
      return 'windows'
    default:
      return 'unknown'
  }
}

/** 내장 로컬 호스트 엔트리를 만든다. */
export function buildLocalHost(): HostEntry {
  return {
    id: LOCAL_HOST_ID,
    host: 'localhost',
    port: 0,
    username: '',
    auth: { method: 'password' },
    alias: '로컬',
    os: localOs(),
    lastStatus: 'unknown',
    builtin: true
  }
}

/**
 * 내장 로컬 호스트가 항상 목록 맨 앞에 존재하도록 보장하고,
 * 선택된 호스트가 없으면 로컬을 기본 선택한다. (앱 시작 시 1회 호출)
 */
export function ensureLocalHost(): void {
  const hosts = repository.listHosts()
  if (!hosts.some((h) => h.id === LOCAL_HOST_ID)) {
    repository.setHosts([buildLocalHost(), ...hosts])
  }
  if (!repository.getSelectedHostId()) {
    repository.setSelectedHostId(LOCAL_HOST_ID)
  }
}
