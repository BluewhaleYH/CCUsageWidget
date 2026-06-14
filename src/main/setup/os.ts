import type { CommandRunner } from './runner'
import type { OsType } from './types'

/**
 * 원격(또는 로컬) 호스트의 OS를 감지한다. (SETUP_SPEC §4.6 / CONNECTION_SPEC §3.3)
 *
 * 전략:
 * - Unix 계열: `uname -s` → `Darwin`=macos, `Linux`=ubuntu(데비안 계열 대표)
 * - Windows: `uname`이 없을 수 있어 `ver`로 보조 판별
 * - 그 외/판별 불가: unknown
 *
 * 설치 명령 결정과 CONNECTION_SPEC의 별칭 기본값 제안에 공유된다.
 */
export async function detectOs(runner: CommandRunner): Promise<OsType> {
  const uname = await runner.run('uname -s')
  if (uname.code === 0) {
    const out = uname.stdout.trim().toLowerCase()
    if (out.includes('darwin')) return 'macos'
    if (out.includes('linux')) return 'ubuntu'
  }

  // uname 실패 → Windows(cmd) 가능성: `ver`는 "Microsoft Windows [Version ...]" 출력
  const ver = await runner.run('ver')
  if (ver.code === 0 && /windows/i.test(ver.stdout)) return 'windows'

  return 'unknown'
}
