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
    node: 'winget install OpenJS.NodeJS',
    npm: 'winget install OpenJS.NodeJS',
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
  for (const check of report.checks) {
    if (check.installed) continue
    const command = getInstallCommand(report.os, check.name)
    if (command) plan.push({ name: check.name, command })
  }
  return plan
}

/** 설치 동의 콜백 — 항목별로 y(true)/n(false)를 반환한다. */
export type InstallConfirm = (item: InstallPlanItem) => boolean | Promise<boolean>

/**
 * 설치 계획을 적용한다. (SETUP_SPEC §4.3~4.4)
 * **동의(confirm)가 true일 때만** 설치 명령을 실행한다. false면 'skipped'.
 * 동의 없이는 어떤 설치 명령도 실행하지 않는다(§5 보안 규칙).
 */
export async function applyInstallPlan(
  runner: CommandRunner,
  plan: InstallPlanItem[],
  confirm: InstallConfirm
): Promise<InstallOutcome[]> {
  const outcomes: InstallOutcome[] = []
  for (const item of plan) {
    const agreed = await confirm(item)
    if (!agreed) {
      outcomes.push({ name: item.name, status: 'skipped', command: item.command })
      continue
    }

    const res = await runner.run(item.command)
    const log = [res.stdout, res.stderr].filter(Boolean).join('\n').trim()
    if (res.code === 0) {
      outcomes.push({ name: item.name, status: 'installed', command: item.command, log })
    } else {
      outcomes.push({
        name: item.name,
        status: 'failed',
        command: item.command,
        log,
        error: `exit code ${res.code}`
      })
    }
  }
  return outcomes
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
