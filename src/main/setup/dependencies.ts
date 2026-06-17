import type { CommandRunner } from './runner'
import type {
  DependencyCheck,
  DependencyName,
  InstallOutcome,
  InstallPlanItem,
  OsType,
  SetupReport
} from './types'

/** 점검·설치 대상 의존성 (점검 순서대로) */
export const DEPENDENCIES: DependencyName[] = ['node', 'npm', 'ccusage']

/** 의존성별 실행 바이너리 이름 */
const BINARY: Record<DependencyName, string> = {
  node: 'node',
  npm: 'npm',
  ccusage: 'ccusage'
}

/**
 * 단일 의존성 점검. (SETUP_SPEC §4.1)
 * `<bin> --version`으로 존재+버전 확인, 실패 시 `command -v <bin>`으로 존재만 재확인.
 */
export async function checkDependency(
  runner: CommandRunner,
  name: DependencyName
): Promise<DependencyCheck> {
  const bin = BINARY[name]

  const versionRes = await runner.run(`${bin} --version`)
  if (versionRes.code === 0) {
    return { name, installed: true, version: parseVersion(versionRes.stdout) }
  }

  // 버전 명령 실패 → PATH 존재 여부만이라도 확인 (셸/플랫폼 차이 방어)
  const whichRes = await runner.run(`command -v ${bin}`)
  if (whichRes.code === 0 && whichRes.stdout.trim().length > 0) {
    return { name, installed: true }
  }

  return { name, installed: false }
}

/** 모든 의존성 점검 */
export async function checkAll(runner: CommandRunner): Promise<DependencyCheck[]> {
  const results: DependencyCheck[] = []
  for (const name of DEPENDENCIES) {
    results.push(await checkDependency(runner, name))
  }
  return results
}

/**
 * OS별 설치 명령 매핑 테이블. (SETUP_SPEC §4.4)
 * 내부 화이트리스트 — 여기 정의된 명령만 실행한다(임의 명령 실행 금지, §5).
 * 매핑이 없으면 해당 OS에서 자동 설치를 제공하지 않는다(undefined).
 */
export const INSTALL_COMMANDS: Record<OsType, Partial<Record<DependencyName, string>>> = {
  macos: {
    node: 'brew install node',
    npm: 'brew install node', // npm은 node와 함께 설치됨
    ccusage: 'npm install -g ccusage'
  },
  ubuntu: {
    node: 'sudo apt-get install -y nodejs npm',
    npm: 'sudo apt-get install -y nodejs npm',
    ccusage: 'npm install -g ccusage'
  },
  windows: {
    // 무인 설치 — 소스/패키지 약관 자동 동의(없으면 프롬프트에서 멈춰 실패)
    node: 'winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements',
    npm: 'winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements',
    ccusage: 'npm install -g ccusage'
  },
  unknown: {
    // OS 미감지 시 node/npm 자동 설치는 제공하지 않음. ccusage는 npm 전제로 시도 가능.
    ccusage: 'npm install -g ccusage'
  }
}

/** 특정 OS에서 의존성 설치 명령을 반환한다. 없으면 null. */
export function getInstallCommand(os: OsType, name: DependencyName): string | null {
  return INSTALL_COMMANDS[os]?.[name] ?? null
}

/**
 * 점검 리포트로부터 설치 계획을 만든다. (SETUP_SPEC §4.2)
 * 누락 + 설치 명령이 존재하는 항목만 포함한다.
 */
export function buildInstallPlan(report: SetupReport): InstallPlanItem[] {
  const plan: InstallPlanItem[] = []
  const seen = new Set<string>()
  for (const check of report.checks) {
    if (check.installed) continue
    const command = getInstallCommand(report.os, check.name)
    if (!command) continue
    // 같은 명령(예: node+npm = 'brew install node')은 1회만 실행한다.
    if (seen.has(command)) continue
    seen.add(command)
    plan.push({ name: check.name, command })
  }
  return plan
}

/** 설치 동의 콜백 — 항목별로 y(true)/n(false)를 반환한다. */
export type InstallConfirm = (item: InstallPlanItem) => boolean | Promise<boolean>

/** 설치 진행 단계 콜백 (로그 영역용). */
export type InstallStep = (item: InstallPlanItem, outcome: InstallOutcome) => void

/** 설치 명령 타임아웃(ms) — node/brew 등은 60초를 넘길 수 있어 넉넉히. */
const INSTALL_TIMEOUT_MS = 300_000

/**
 * 설치 계획을 적용한다. (SETUP_SPEC §4.3~4.4)
 * **동의(confirm)가 true일 때만** 설치 명령을 실행한다. false면 'skipped'.
 * 동의 없이는 어떤 설치 명령도 실행하지 않는다(§5 보안 규칙).
 * `onStart`/`onStep`으로 진행 상황을 알린다(로그 영역).
 */
export async function applyInstallPlan(
  runner: CommandRunner,
  plan: InstallPlanItem[],
  confirm: InstallConfirm,
  hooks?: { onStart?: (item: InstallPlanItem) => void; onStep?: InstallStep }
): Promise<InstallOutcome[]> {
  const outcomes: InstallOutcome[] = []
  for (const item of plan) {
    const agreed = await confirm(item)
    if (!agreed) {
      const out: InstallOutcome = { name: item.name, status: 'skipped', command: item.command }
      outcomes.push(out)
      hooks?.onStep?.(item, out)
      continue
    }

    hooks?.onStart?.(item)
    const res = await runner.run(item.command, INSTALL_TIMEOUT_MS)
    const log = [res.stdout, res.stderr].filter(Boolean).join('\n').trim()
    const out: InstallOutcome =
      res.code === 0
        ? { name: item.name, status: 'installed', command: item.command, log }
        : {
            name: item.name,
            status: 'failed',
            command: item.command,
            log,
            // 출력 마지막 줄을 에러 요약으로(없으면 종료코드)
            error: lastLine(log) || `exit code ${res.code}`
          }
    outcomes.push(out)
    hooks?.onStep?.(item, out)
  }
  return outcomes
}

/** 출력에서 의미있는 마지막 줄(에러 요약용). */
function lastLine(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return lines.length > 0 ? lines[lines.length - 1] : ''
}

/**
 * ccusage 폴백 실행 명령. (SETUP_SPEC §4.5)
 * ccusage 미설치 시 데이터 조회에서 1회성으로 `npx ccusage@latest <args>`를 사용한다.
 * (실제 사용처는 DATA_SPEC / Phase 3)
 */
export function npxFallbackCommand(args: string): string {
  return `npx ccusage@latest ${args}`.trim()
}

/** `--version` 출력에서 버전 문자열만 추출 (예: "v20.11.0", "10.2.4") */
function parseVersion(raw: string): string {
  const first = raw.trim().split(/\r?\n/)[0]?.trim() ?? ''
  const match = first.match(/\d+\.\d+\.\d+[^\s]*/)
  return match ? match[0] : first
}
