import { exec } from 'child_process'

/**
 * 명령 실행 추상화.
 *
 * 점검/설치 로직은 "명령을 어디서 실행하는가"에 의존하지 않도록 이 인터페이스에만 의존한다.
 * - Phase 1: `LocalCommandRunner`(로컬 child_process)로 동작·검증.
 * - Phase 2: 동일 인터페이스의 `SshCommandRunner`(ssh2)를 추가해 호스트별 러너만 교체한다.
 *   (CONNECTION_SPEC §3.1 — 모든 SSH 동작은 main 프로세스에서만 수행)
 */
export interface CommandResult {
  /** 종료 코드. 정상 종료=0 */
  code: number
  stdout: string
  stderr: string
}

export interface CommandRunner {
  /** 명령 실행. timeoutMs를 주면 그 시간(ms) 후 강제 종료(설치 등 장시간 명령용). */
  run(command: string, timeoutMs?: number): Promise<CommandResult>
}

/** 로컬 머신에서 명령을 실행하는 러너 (Phase 1 동작/진단용) */
export class LocalCommandRunner implements CommandRunner {
  constructor(private readonly timeoutMs = 60_000) {}

  run(command: string, timeoutMs?: number): Promise<CommandResult> {
    return new Promise((resolve) => {
      exec(command, { timeout: timeoutMs ?? this.timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
        // exec 콜백의 error.code는 number(종료코드) 또는 'ETIMEDOUT' 등 문자열일 수 있다.
        const code =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? ((error as { code: number }).code)
            : error
              ? 1
              : 0
        resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
      })
    })
  }
}
