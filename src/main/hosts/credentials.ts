import { safeStorage } from 'electron'
import { store } from '../store'

/**
 * 호스트 자격증명(SSH 키 passphrase / 비밀번호) 보안 저장. (CONNECTION_SPEC §2)
 *
 * - Electron `safeStorage`로 암호화한 뒤 base64 문자열만 electron-store(`hostSecrets`)에 둔다.
 * - **평문은 어디에도 저장하지 않는다.** store에는 비밀의 암호문(base64)만 존재.
 * - 복호화는 main 프로세스에서만 수행하며, 결과 비밀은 메모리에서만 사용한다.
 *
 * safeStorage는 OS 보안 저장소(macOS Keychain / Windows DPAPI / Linux libsecret)를 키로 사용한다.
 */

/** 현재 환경에서 암호화 사용 가능 여부 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * 비밀을 암호화하여 저장한다.
 * 암호화가 불가능한 환경이면 평문 저장을 피하기 위해 오류를 던진다.
 */
export function saveSecret(hostId: string, secret: string): void {
  if (!isEncryptionAvailable()) {
    throw new Error('safeStorage 암호화를 사용할 수 없습니다 — 자격증명을 저장하지 않습니다.')
  }
  const encrypted = safeStorage.encryptString(secret) // Buffer
  const secrets = { ...(store.get('hostSecrets') ?? {}) }
  secrets[hostId] = encrypted.toString('base64')
  store.set('hostSecrets', secrets)
}

/**
 * 저장된 비밀을 복호화하여 반환한다. 없거나 복호화 실패 시 undefined.
 */
export function getSecret(hostId: string): string | undefined {
  const b64 = store.get('hostSecrets')?.[hostId]
  if (!b64) return undefined
  if (!isEncryptionAvailable()) return undefined
  try {
    return safeStorage.decryptString(Buffer.from(b64, 'base64'))
  } catch {
    return undefined
  }
}

/** 저장된 비밀이 있는지(복호화 없이) 여부 */
export function hasSecret(hostId: string): boolean {
  return Boolean(store.get('hostSecrets')?.[hostId])
}

/** 비밀을 삭제한다(호스트 삭제 시 호출). */
export function deleteSecret(hostId: string): void {
  const secrets = store.get('hostSecrets')
  if (!secrets || !(hostId in secrets)) return
  const next = { ...secrets }
  delete next[hostId]
  store.set('hostSecrets', next)
}
