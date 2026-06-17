# SETUP_SPEC — 환경/의존성 점검 및 설치

> CCUsageWidget가 동작하기 위해 필요한 모듈/프로그램을 **점검**하고, 누락 시
> 사용자에게 **안내 후 동의(y/n)를 받아 설치**하는 기능 명세.
> 관련 원본: `docs/TEMP_SPEC.md` L9 (필요 모듈/프로그램 설치)

## 1. 개요 & 범위

이 위젯은 **SSH로 등록된 원격 컴퓨터**에서 `ccusage` CLI를 실행해 사용량을 조회한다.
따라서 의존성은 두 곳에서 필요하다.

- **로컬(위젯이 실행되는 PC)**: 위젯 앱 자체는 Electron 번들에 포함되어 별도 설치 불필요.
  단, SSH 클라이언트 동작에 필요한 런타임은 앱에 내장.
  **로컬도 데이터 조회 대상(내장 `local` 호스트, 기본 선택)** 이므로, 로컬에서 사용량을 보려면
  로컬에 `node`/`npm`/`ccusage`(또는 `npx ccusage@latest` 폴백)가 있어야 한다. (DATA_SPEC §1 참조)
- **원격 머신(데이터 조회 대상)**: `node`, `npm`, `ccusage`가 설치되어 있어야 한다.

본 문서의 핵심은 **원격 머신의 의존성 점검 → 안내 → y/n 동의 → 설치** 흐름이다.

## 2. 의존성 정의

| 대상 | 항목 | 점검 명령(예) | 비고 |
|------|------|--------------|------|
| 원격 | node | `node --version` / `command -v node` | ccusage 실행 전제 |
| 원격 | npm | `npm --version` / `command -v npm` | ccusage 설치 수단 |
| 원격 | ccusage | `ccusage --version` / `command -v ccusage` | 핵심 도구. 미설치 시 `npx ccusage@latest` 폴백 가능 |

## 3. 동작 방식 (확정)

> 누락 항목을 **안내**하고, 콘솔/UI에서 **y/n 입력**을 받아 **y이면 설치를 진행**한다.
> n이면 건너뛰고 해당 항목은 "미설치"로 표시한다.

## 4. 구현 단계 (Implementation Steps)

### 4.1 의존성 점검 (Check)
- 등록된 각 원격 호스트에 SSH 접속 후, 위 표의 점검 명령을 실행한다.
- 각 항목의 결과를 `{ name, installed: boolean, version?: string }`로 수집한다.
- (로컬 점검도 동일 패턴으로 보조 수행 가능 — 진단 목적)

### 4.2 누락 항목 안내 (Notify)
- 미설치 항목을 모아 사용자에게 명확히 보여준다.
  - 예: `다음 항목이 없습니다: node, ccusage`
- 항목별로 어떤 설치가 수행될지(설치 명령)를 함께 안내한다.
- **구현된 UI**: 푸터의 **상태 칩**으로 요약 상태(`정상`/`ccusage 없음(npx 폴백)`/`node 없음`/…)를 노출하고,
  칩 클릭 시 **점검/설치 패널**(SetupPanel)에서 OS·항목별 설치 여부·버전·**설치 명령**을 보여준다. (UI_SPEC §3.10)

### 4.3 동의 입력 (Confirm y/n)
- 각 누락 항목(또는 일괄)에 대해 동의를 받는다.
  - 동의(y) → 4.4 설치 진행
  - 거부(n) → 건너뜀, 해당 항목 "미설치"로 표시 (npx 폴백/안내)
- **구현된 동의 게이트**: 점검(`setup:check`)은 절대 설치하지 않는다. 패널의 **[설치] 버튼 클릭이 곧 동의**이며,
  그때만 `setup:install`이 호출된다(로직은 `applyInstallPlan`의 `confirm` 콜백으로 모델링).
  현재 선택 호스트(로컬/원격) 모두 동일. (CLI 표준입력 프롬프트도 허용 — 보조)

### 4.4 설치 진행 (Install)
- `y` 동의 시, 원격 머신에 SSH로 설치 명령을 실행한다.
- **OS별 설치 전략** (4.6 OS 감지 결과 활용, 내부 화이트리스트 테이블 `INSTALL_COMMANDS`):
  - **ccusage**: `npm install -g ccusage` (node·npm 선행 필요)
  - **node/npm**:
    - macOS: `brew install node` (Homebrew 존재 시)
    - Ubuntu/Debian: `sudo apt-get install -y nodejs npm`
    - Windows: `winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements`
      (약관 자동 동의 — 없으면 프롬프트에서 멈춰 실패)
- **node+npm는 같은 명령**이면 계획에서 **1회로 dedup**(중복 설치 방지).
- 설치 명령은 장시간(brew/winget 등) 걸릴 수 있어 **타임아웃 300초**를 둔다.
- 설치 진행 상황은 **위젯 하단 로그 영역**에 남기고(시작/완료/실패), 실패 시 **명령 출력(stdout/stderr)과
  에러 요약**을 SETUP 패널에 표시해 원인을 알 수 있게 한다.
- ⚠️ 권한 문제(예: 시스템 node의 `npm -g` EACCES, `sudo` 비밀번호 필요)는 자동 해결 불가 — 에러를 그대로 노출한다.

### 4.5 폴백 (Fallback)
- ccusage 설치를 건너뛰거나 실패한 경우, 데이터 조회 시
  `npx ccusage@latest <args>`로 1회성 실행을 시도한다. (node/npm은 필요)

### 4.6 OS 감지 (보조)
- 설치 명령 결정을 위해 원격 OS를 감지한다. (`uname -s`, Windows는 `ver`)
- 감지 결과는 CONNECTION_SPEC의 별칭 기본값과 설치 전략에 공유한다.
  → 자세한 내용은 `CONNECTION_SPEC.md` 참조.

### 4.7 결과 캐싱/상태 표시
- 호스트별 점검·설치 결과를 저장(electron-store, `setupReports[hostId]`)하고, 위젯에서 상태를 표시한다.
- 상태 예: `정상` / `node 없음` / `ccusage 없음(npx 폴백)` / `설치 실패`

### 4.8 IPC 계약
- `setup:check` (`{ hostId? }`) — OS 감지 + 의존성 점검만 수행(설치 없음). `{ report, status, plan }` 반환.
- `setup:install` (`{ hostId?, names? }`) — **동의(y) 이후에만 호출**. 요청 항목 설치 후 재점검. `{ outcomes, report, status }` 반환.
- `setup:status` (`{ hostId? }`) — 캐시된 점검 리포트/요약 상태 조회.
- 구현 메모: 명령 실행은 `CommandRunner` 추상화 경유(Phase 1=로컬, Phase 2=SSH로 교체). 동의는
  `applyInstallPlan(runner, plan, confirm)`의 `confirm` 콜백으로 모델링(UI 입력은 Phase 4 연동).
- `hostId` 미지정 시 Phase 1은 로컬 점검 키(`local`) 사용.

## 5. 보안·주의 사항
- `sudo`가 필요한 설치는 비밀번호/권한 문제로 실패할 수 있음 → 실패 메시지를 명확히 안내.
- 임의 명령 실행을 최소화하고, 내부 정의된 화이트리스트 명령만 사용한다.
- 설치 명령은 사용자 `y` 동의 없이는 절대 실행하지 않는다.

## 6. 완료 기준 (Checklist)
- [x] 원격(러너 추상화)에서 node/npm/ccusage 존재·버전 점검
- [x] 누락 항목 안내(설치 plan: 항목+명령) 산출 — UI 표시는 Phase 4
- [x] y/n 동의 입력 처리 (`confirm` 콜백; setup:install이 동의 게이트) — UI 입력은 Phase 4
- [x] OS별 설치 명령 매핑으로 설치 실행 및 결과(InstallOutcome) 반환
- [x] ccusage 미설치 시 `npx ccusage@latest` 폴백 명령 제공 (사용처는 Phase 3)
- [x] 점검/설치 결과 저장(`setupReports`) 및 요약 상태 도출

> Phase 1 완료: 로직/IPC 계약 구현 + 로컬 러너로 검증. 안내·동의의 **화면 표시**는 Phase 4(UI),
> **원격 실행**은 Phase 2(SSH 러너 교체)에서 연동된다.

## 7. 연관 문서
- `CONNECTION_SPEC.md` — SSH 연결·OS 감지·호스트 관리
- `DATA_SPEC.md` — ccusage 실행 및 데이터 표시 (폴백 사용처)
