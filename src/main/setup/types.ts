/**
 * SETUP_SPEC 공용 타입.
 * 원격(또는 로컬) 호스트의 node/npm/ccusage 의존성 점검·설치 흐름에서 사용한다.
 */

/** 점검·설치 대상 의존성 */
export type DependencyName = 'node' | 'npm' | 'ccusage'

/**
 * 호스트 OS 종류.
 * CONNECTION_SPEC의 `HostEntry.os`와 동일 유니온 — Phase 2에서 공유한다.
 */
export type OsType = 'macos' | 'ubuntu' | 'windows' | 'unknown'

/** 단일 의존성 점검 결과 */
export interface DependencyCheck {
  name: DependencyName
  installed: boolean
  /** 감지된 버전 문자열(가능한 경우) */
  version?: string
}

/** 한 호스트에 대한 점검 리포트 */
export interface SetupReport {
  os: OsType
  checks: DependencyCheck[]
  /** ISO timestamp */
  checkedAt: string
}

/** 설치 계획 항목 — 누락 의존성과 실행할 설치 명령 */
export interface InstallPlanItem {
  name: DependencyName
  command: string
}

/** 설치 시도 결과 */
export interface InstallOutcome {
  name: DependencyName
  /** installed=동의 후 설치 성공, skipped=동의 거부(n), failed=설치 실패 */
  status: 'installed' | 'skipped' | 'failed'
  command?: string
  /** 설치 명령의 표준출력/표준에러 로그(요약) */
  log?: string
  error?: string
}

/**
 * 캐시/표시용 요약 상태.
 * - ok: 전부 설치됨
 * - missing-node: node(또는 npm) 부재 → ccusage 실행 불가
 * - ccusage-fallback: node/npm은 있으나 ccusage 부재 → npx 폴백 사용
 * - install-failed: 설치 시도 실패 이력
 * - unknown: 미점검
 */
export type HostSetupStatus =
  | 'ok'
  | 'missing-node'
  | 'ccusage-fallback'
  | 'install-failed'
  | 'unknown'
