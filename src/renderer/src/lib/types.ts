/**
 * 렌더러가 쓰는 공유 데이터 타입.
 * preload(Phase 3-CB8)가 재노출한 main 데이터 모델을 안정 경로로 재노출한다.
 * (컴파일타임 전용 — 런타임 경계 불변)
 */
export type { UsageGrid, UsageCell, UsageStatus, Provider, Period } from '../../../preload'
export type { HostEntry, SshAuth } from '../../../preload'
export type {
  ConnectionInput,
  ConnectionTestResult,
  RegisterHostInput,
  RegisterHostResult
} from '../../../preload'
export type {
  SetupReport,
  DependencyCheck,
  HostSetupStatus,
  InstallPlanItem,
  InstallOutcome,
  DependencyName,
  SetupCheckResult,
  SetupInstallResult,
  SetupStatusResult
} from '../../../preload'

import type { HostEntry } from '../../../preload'

/** host:list 응답 형태 (메인 ipc 계약) */
export interface HostListResult {
  hosts: HostEntry[]
  selectedHostId: string | null
}

/** 위젯 하단 로그 영역의 활동 로그 1줄(main logBus와 동일 형태). */
export interface LogEntry {
  ts: string
  hostId: string | null
  hostAlias: string | null
  message: string
  level: 'info' | 'error'
}

/** host:status 푸시 페이로드 */
export interface HostStatusUpdate {
  id: string
  lastStatus: HostEntry['lastStatus']
  lastCheckedAt: string
}
