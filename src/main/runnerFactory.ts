import { buildSshConfig, credentials, LOCAL_HOST_ID, repository } from './hosts'
import { LocalCommandRunner, type CommandRunner } from './setup'
import { SshCommandRunner } from './ssh/runner'

/** 로컬 실행 키 — 내장 로컬 호스트 id와 동일('local'). */
export const DEFAULT_HOST_ID = LOCAL_HOST_ID

/**
 * 호스트별 SSH 러너 캐시. (성능: 폴링·setup 점검마다 핸드셰이크 반복 제거)
 * 한 호스트의 SSH 연결을 재사용하고, 연결이 끊기면 러너 내부에서 자동 재연결한다.
 */
const sshRunners = new Map<string, SshCommandRunner>()

/**
 * 호스트별 명령 러너를 만든다. (ipc.ts·usage/poller.ts 공유 seam)
 * - hostId가 'local'이거나 호스트를 찾을 수 없으면 로컬 러너(진단·폴백).
 * - 등록된 호스트면 복호화한 자격증명으로 `SshCommandRunner`를 만들어 **원격** 실행.
 *   같은 호스트의 SSH 러너는 **캐시**해 연결을 재사용한다(전환·폴링·setup 공유).
 *   ⇒ Phase 1 setup:* 점검/설치와 Phase 3 데이터 조회가 이 한 곳으로 원격에서 동작한다.
 */
export function createRunnerForHost(hostId: string): CommandRunner {
  if (hostId === DEFAULT_HOST_ID) return new LocalCommandRunner()
  const host = repository.getHost(hostId)
  if (!host) return new LocalCommandRunner()

  const cached = sshRunners.get(hostId)
  if (cached) return cached

  const secret = credentials.getSecret(hostId)
  const runner = new SshCommandRunner(buildSshConfig(host, secret))
  sshRunners.set(hostId, runner)
  return runner
}

/**
 * 캐시된 SSH 러너는 연결을 유지하므로 no-op이다(LocalCommandRunner도 무시).
 * 연결 해제는 호스트 변경/삭제(`invalidateRunner`)·앱 종료(`disposeAllRunners`)에서만 한다.
 */
export function disposeRunner(_runner: CommandRunner): void {
  // 캐시 재사용을 위해 의도적으로 연결을 닫지 않는다.
}

/** 호스트의 캐시된 SSH 연결을 닫고 캐시에서 제거한다. (자격증명/주소 변경·삭제 시) */
export function invalidateRunner(hostId: string): void {
  const runner = sshRunners.get(hostId)
  if (runner) {
    runner.dispose()
    sshRunners.delete(hostId)
  }
}

/** 모든 캐시된 SSH 연결을 닫는다. (앱 종료 시) */
export function disposeAllRunners(): void {
  for (const runner of sshRunners.values()) runner.dispose()
  sshRunners.clear()
}
