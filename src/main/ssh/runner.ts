import { Client, type ConnectConfig } from 'ssh2'
import type { CommandResult, CommandRunner } from '../setup/runner'

/**
 * SSH 연결 설정. 자격증명은 호출부에서 복호화(safeStorage)·키 로드 후 주입한다.
 * (credentials/repository와의 wiring은 후속 체크박스)
 */
export interface SshConnectConfig {
  host: string
  port: number
  username: string
  /** 키 인증: 개인키 본문(파일 내용) */
  privateKey?: string | Buffer
  /** 키 패스프레이즈(safeStorage에서 복호화) */
  passphrase?: string
  /** 비밀번호 인증(safeStorage에서 복호화) */
  password?: string
  /** 연결 타임아웃(ms) */
  readyTimeout?: number
}

/** SSH 연결 실패 시 run()이 반환하는 종료 코드(관례적 SSH 오류 코드) */
const SSH_CONNECT_FAILURE_CODE = 255

/**
 * ssh2 기반 원격 명령 실행 러너. (CONNECTION_SPEC §3.1)
 *
 * Phase 1의 `CommandRunner` 인터페이스를 구현하므로, 의존성 점검/설치(setup/*)와
 * 데이터 조회(Phase 3)가 이 러너만 주입하면 그대로 원격에서 동작한다.
 *
 * - 하나의 연결을 재사용한다(여러 ccusage 호출 등). 사용 후 `dispose()`로 닫는다.
 * - `run()`은 연결 실패 시에도 reject하지 않고 `{ code: 255, stderr }`로 resolve한다
 *   (LocalCommandRunner와 동일한 견고성 — 호출부는 code===0 여부만 보면 됨).
 *   연결 가능 여부를 명시적으로 판별해야 하는 경우 `connect()`를 사용한다.
 */
export class SshCommandRunner implements CommandRunner {
  private client: Client | null = null
  private connecting: Promise<void> | null = null
  /** 원격 로그인 셸 PATH(1회 조회 캐시). null = 미조회/조회 실패(프리픽스 미적용). */
  private remotePath: string | null = null
  /** PATH 조회 공유 Promise — 병렬 호출이 같은 조회 1회를 await(경쟁 방지). */
  private pathProbe: Promise<void> | null = null

  constructor(private readonly config: SshConnectConfig) {}

  /** 명시적으로 연결한다. 실패 시 reject(연결 테스트용). */
  connect(): Promise<void> {
    if (this.client) return Promise.resolve()
    if (this.connecting) return this.connecting

    this.connecting = new Promise<void>((resolve, reject) => {
      const client = new Client()
      const connectConfig: ConnectConfig = {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        privateKey: this.config.privateKey,
        passphrase: this.config.passphrase,
        password: this.config.password,
        readyTimeout: this.config.readyTimeout ?? 15_000
      }
      client
        .on('ready', () => {
          this.client = client
          this.connecting = null
          resolve()
        })
        .on('error', (err) => {
          this.connecting = null
          reject(err)
        })
        // 연결이 끊기면 다음 호출이 자동 재연결하도록 상태를 리셋한다(끊긴 채 멈춤 방지).
        .on('close', () => {
          if (this.client === client) {
            this.client = null
            this.pathProbe = null
            this.remotePath = null
          }
        })
        .connect(connectConfig)
    })
    return this.connecting
  }

  // timeoutMs는 인터페이스 호환용(현재 SSH는 미사용 — 원격 설치 장시간 허용)
  async run(command: string, _timeoutMs?: number): Promise<CommandResult> {
    try {
      await this.connect()
    } catch (err) {
      return {
        code: SSH_CONNECT_FAILURE_CODE,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err)
      }
    }
    await this.ensureRemotePath()
    return this.exec(this.withPath(command))
  }

  /**
   * 원격 로그인 셸 PATH를 1회 조회해 캐시한다. (GUI의 fixGuiPath와 동일 개념의 원격판)
   * `client.exec`는 **비로그인 비대화형 셸**이라 Homebrew/nvm/npm 전역 bin이 PATH에 없어
   * `ccusage`/`node`가 미검출된다. 로그인 셸로 PATH를 받아 이후 명령에 프리픽스로 주입한다.
   * 조회 실패(Windows 등)면 프리픽스 없이 원본 실행(안전 폴백).
   *
   * **공유 Promise**로 캐싱 — 6종 호출이 동시에 진입해도 조회는 1회만 하고 모두 같은
   * 결과를 await한다(과거: 동기 플래그라 첫 호출만 조회하고 나머지는 프리픽스 없이 실행 →
   * ccusage 미검출 → npx 폴백으로 매우 느렸음).
   */
  private ensureRemotePath(): Promise<void> {
    if (this.pathProbe) return this.pathProbe
    this.pathProbe = (async () => {
      try {
        // 로그인(-l) + 인터랙티브(-i) 셸 — nvm(.zshrc/.bashrc)·Homebrew(.zprofile) PATH 모두 커버.
        // (-l만 쓰면 nvm 미로드 → 시스템 node가 잡혀 버전 오검출). 마커로 rc 부수 출력과 PATH 분리.
        const res = await this.exec(
          `\${SHELL:-/bin/sh} -lic 'printf "__PS__%s__PE__" "$PATH"'`
        )
        const path = res.stdout.match(/__PS__([\s\S]*?)__PE__/)?.[1]?.trim() ?? ''
        // 유닉스 PATH처럼 보일 때만 사용(콜론 구분 절대경로). 그 외(Windows/실패)는 폴백.
        if (res.code === 0 && path.includes('/')) this.remotePath = path
      } catch {
        // 폴백: 프리픽스 미적용
      }
    })()
    return this.pathProbe
  }

  /** 원격 PATH가 조회됐으면 명령 앞에 PATH 프리픽스를 붙인다. */
  private withPath(command: string): string {
    if (!this.remotePath) return command
    // 단일따옴표 이스케이프('→'\''), 로그인 PATH를 앞에 둬 우선 검색.
    const escaped = this.remotePath.replace(/'/g, `'\\''`)
    return `PATH='${escaped}':"$PATH" ${command}`
  }

  /** 연결된 클라이언트에서 명령을 실행하고 결과를 모은다. */
  private exec(command: string): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve) => {
      const client = this.client
      if (!client) {
        resolve({ code: SSH_CONNECT_FAILURE_CODE, stdout: '', stderr: 'not connected' })
        return
      }
      client.exec(command, (err, stream) => {
        if (err) {
          resolve({ code: SSH_CONNECT_FAILURE_CODE, stdout: '', stderr: err.message })
          return
        }
        let stdout = ''
        let stderr = ''
        let exitCode = 0
        stream
          .on('close', (code: number | null) => {
            resolve({ code: code ?? 0, stdout, stderr })
          })
          .on('exit', (code: number | null) => {
            if (typeof code === 'number') exitCode = code
          })
          .on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8')
          })
        stream.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8')
        })
        // exitCode는 일부 환경에서 'close'에 code가 null로 올 때를 대비한 보조값
        void exitCode
      })
    })
  }

  /** 연결을 닫는다. */
  dispose(): void {
    if (this.client) {
      this.client.end()
      this.client = null
    }
  }
}
