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
        .connect(connectConfig)
    })
    return this.connecting
  }

  async run(command: string): Promise<CommandResult> {
    try {
      await this.connect()
    } catch (err) {
      return {
        code: SSH_CONNECT_FAILURE_CODE,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err)
      }
    }
    return this.exec(command)
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
