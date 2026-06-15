import { execFileSync } from 'child_process'

/**
 * GUI(Finder/Dock/패키징 앱)로 실행하면 로그인 셸의 PATH를 상속받지 못한다.
 * → Homebrew(`/opt/homebrew/bin`)·nvm 등에 설치된 `node`/`npm`/`ccusage`를 못 찾아
 *   "node 없음"으로 오검출되는 문제가 생긴다. (`npm run dev`는 터미널 PATH를 물려받아 정상)
 *
 * 시작 시 **로그인 셸의 실제 PATH**를 가져와 `process.env.PATH`에 반영해, 이후 모든 로컬
 * 명령 실행(LocalCommandRunner 등)이 사용자의 PATH를 그대로 쓰게 한다. (macOS/Linux 전용;
 * Windows는 GUI 앱도 시스템 PATH를 상속하므로 불필요)
 */
export function fixGuiPath(): void {
  if (process.platform === 'win32') return

  const shell =
    process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')

  try {
    // 로그인(-l) + 인터랙티브(-i) 셸로 PATH를 출력 — Homebrew(.zprofile)·nvm(.zshrc) 모두 커버.
    // 마커로 감싸 .zshrc 등의 부수 출력과 분리한다.
    const out = execFileSync(shell, ['-lic', 'printf "__PS__%s__PE__" "$PATH"'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const match = out.match(/__PS__([\s\S]*?)__PE__/)
    const resolved = match?.[1]?.trim()
    if (resolved) process.env.PATH = resolved
  } catch {
    // 셸 조회 실패 시 기존 PATH 유지(앱은 계속 동작; ccusage는 npx 폴백으로 보완 가능)
  }
}
