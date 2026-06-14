import { readFileSync } from 'fs'
import { detectOs } from '../setup/os'
import type { OsType } from '../setup/types'
import { SshCommandRunner, type SshConnectConfig } from '../ssh/runner'
import type { SshAuth } from './types'

/** 연결 테스트 입력(저장 전 등록 폼 데이터로도 사용) */
export interface ConnectionInput {
  host: string
  port?: number
  username: string
  auth: SshAuth
}

/** 연결 테스트 결과 (CONNECTION_SPEC §3.3) */
export interface ConnectionTestResult {
  ok: boolean
  os: OsType
  error?: string
}

/**
 * 호스트 입력 + 복호화된 비밀로 SSH 연결 설정을 구성한다.
 * - 키 인증: `privateKeyPath`의 파일을 읽어 본문을 싣고, secret은 passphrase로 사용.
 * - 비밀번호 인증: secret을 password로 사용.
 * 키 파일을 읽을 수 없으면 오류를 던진다.
 */
export function buildSshConfig(input: ConnectionInput, secret?: string): SshConnectConfig {
  const base: SshConnectConfig = {
    host: input.host,
    port: input.port ?? 22,
    username: input.username
  }
  if (input.auth.method === 'key') {
    base.privateKey = readFileSync(input.auth.privateKeyPath)
    if (secret) base.passphrase = secret
  } else {
    if (secret) base.password = secret
  }
  return base
}

/**
 * SSH 도달성 확인 + OS 자동 감지. (CONNECTION_SPEC §3.3)
 * 연결에 성공하면 `detectOs`(setup/os.ts 재사용)로 OS를 판별한다.
 * 연결 자체가 실패하면 `{ ok:false, os:'unknown', error }`.
 */
export async function testConnection(config: SshConnectConfig): Promise<ConnectionTestResult> {
  const runner = new SshCommandRunner(config)
  try {
    await runner.connect()
    const os = await detectOs(runner)
    return { ok: true, os }
  } catch (err) {
    return { ok: false, os: 'unknown', error: err instanceof Error ? err.message : String(err) }
  } finally {
    runner.dispose()
  }
}
