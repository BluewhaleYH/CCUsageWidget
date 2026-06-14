/**
 * 렌더러가 쓰는 공유 데이터 타입.
 * preload(Phase 3-CB8)가 재노출한 main 데이터 모델을 안정 경로로 재노출한다.
 * (컴파일타임 전용 — 런타임 경계 불변)
 */
export type { UsageGrid, UsageCell, UsageStatus, Provider, Period } from '../../../preload'
