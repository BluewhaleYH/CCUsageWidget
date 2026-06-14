import type { RegisterHostInput } from './types'

/** 등록 폼 상태(모두 문자열 입력) */
export interface HostForm {
  host: string
  port: string
  username: string
  method: 'password' | 'key'
  password: string
  privateKeyPath: string
  passphrase: string
  alias: string
}

export const emptyHostForm: HostForm = {
  host: '',
  port: '22',
  username: '',
  method: 'password',
  password: '',
  privateKeyPath: '',
  passphrase: '',
  alias: ''
}

/** 폼 검증 — 오류 메시지 배열(빈 배열이면 통과). (CONNECTION_SPEC §3.2) */
export function validateHostForm(f: HostForm): string[] {
  const errs: string[] = []
  if (!f.host.trim()) errs.push('host(IP/도메인)를 입력하세요')
  if (!f.username.trim()) errs.push('username을 입력하세요')
  if (f.port.trim() && !Number.isInteger(Number(f.port))) errs.push('port는 정수여야 합니다')
  if (f.method === 'key' && !f.privateKeyPath.trim()) errs.push('키 파일 경로를 입력하세요')
  if (f.method === 'password' && !f.password) errs.push('비밀번호를 입력하세요')
  return errs
}

/**
 * 폼 → IPC 인자(`{ input, secret }`)로 변환한다.
 * - 키 인증: secret = passphrase(선택), input.auth = { method:'key', privateKeyPath }
 * - 비밀번호 인증: secret = password, input.auth = { method:'password' }
 */
export function buildConnArgs(f: HostForm): { input: RegisterHostInput; secret?: string } {
  const input: RegisterHostInput =
    f.method === 'key'
      ? {
          host: f.host.trim(),
          port: f.port.trim() ? Number(f.port) : 22,
          username: f.username.trim(),
          auth: { method: 'key', privateKeyPath: f.privateKeyPath.trim() },
          alias: f.alias.trim() || undefined
        }
      : {
          host: f.host.trim(),
          port: f.port.trim() ? Number(f.port) : 22,
          username: f.username.trim(),
          auth: { method: 'password' },
          alias: f.alias.trim() || undefined
        }
  const secret = (f.method === 'key' ? f.passphrase : f.password) || undefined
  return { input, secret }
}
