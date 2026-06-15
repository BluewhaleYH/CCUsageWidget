import { buildSshConfig, credentials, LOCAL_HOST_ID, repository } from './hosts'
import { LocalCommandRunner, type CommandRunner } from './setup'
import { SshCommandRunner } from './ssh/runner'

/** 로컬 실행 키 — 내장 로컬 호스트 id와 동일('local'). */
export const DEFAULT_HOST_ID = LOCAL_HOST_ID

/**
 * 호스트별 명령 러너를 만든다. (ipc.ts·usage/poller.ts 공유 seam)
 * - hostId가 'local'이거나 호스트를 찾을 수 없으면 로컬 러너(진단·폴백).
 * - 등록된 호스트면 복호화한 자격증명으로 `SshCommandRunner`를 만들어 **원격** 실행.
 *   ⇒ Phase 1 setup:* 점검/설치와 Phase 3 데이터 조회가 이 한 곳으로 원격에서 동작한다.
 */
export function createRunnerForHost(hostId: string): CommandRunner {
  if (hostId === DEFAULT_HOST_ID) return new LocalCommandRunner()
  const host = repository.getHost(hostId)
  if (!host) return new LocalCommandRunner()
  const secret = credentials.getSecret(hostId)
  return new SshCommandRunner(buildSshConfig(host, secret))
}

/** SshCommandRunner면 연결을 닫는다(LocalCommandRunner는 무시). */
export function disposeRunner(runner: CommandRunner): void {
  if (runner instanceof SshCommandRunner) runner.dispose()
}
