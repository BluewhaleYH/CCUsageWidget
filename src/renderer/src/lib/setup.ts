import type { DependencyName, HostSetupStatus, InstallPlanItem } from './types'

/** 설치 계획에서 의존성 이름 목록을 뽑는다(setup.install 인자). */
export function planNames(plan: InstallPlanItem[]): DependencyName[] {
  return plan.map((p) => p.name)
}

/** setup 상태 → 표시 라벨. (SETUP_SPEC §4.7) */
export function statusLabel(status: HostSetupStatus): string {
  switch (status) {
    case 'ok':
      return '정상'
    case 'missing-node':
      return 'node 없음'
    case 'ccusage-fallback':
      return 'ccusage 없음 (npx 폴백)'
    case 'install-failed':
      return '설치 실패'
    case 'unknown':
    default:
      return '미점검'
  }
}

/** setup 상태 → 심각도(칩 색상용) */
export function statusSeverity(status: HostSetupStatus): 'ok' | 'warn' | 'error' | 'unknown' {
  switch (status) {
    case 'ok':
      return 'ok'
    case 'ccusage-fallback':
      return 'warn'
    case 'missing-node':
    case 'install-failed':
      return 'error'
    case 'unknown':
    default:
      return 'unknown'
  }
}
