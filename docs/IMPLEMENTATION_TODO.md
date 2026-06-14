# IMPLEMENTATION_TODO — CCUsageWidget 구현 체크리스트

> SPEC 문서(`SETUP_SPEC.md`, `CONNECTION_SPEC.md`, `DATA_SPEC.md`, `UI_SPEC.md`)를
> 바탕으로 한 **구현 순서 TODO**입니다. 위에서부터 순서대로 진행합니다.

## 사용 규칙
- 항목 완료 시 `- [ ]` → `- [x]`로 갱신합니다.
- **각 Phase 끝의 "🔍 검수" 항목을 통과하기 전에는 다음 Phase로 넘어가지 않습니다.**
- 구현 중 SPEC과 어긋나는 점을 발견하면 SPEC을 먼저 갱신한 뒤 진행합니다.

## 진행 상태 요약
- [x] Phase 0 — 프로젝트 스캐폴딩
- [x] Phase 1 — SETUP (의존성 점검/설치)
- [x] Phase 2 — CONNECTION (원격 연결·호스트 관리)
- [ ] Phase 3 — DATA (조회·표시)
- [ ] Phase 4 — UI (위젯 UI·윈도우)

---

## Phase 0 — 프로젝트 스캐폴딩
- [x] electron-vite + React 18 + TypeScript(strict) 프로젝트 초기화
- [x] `src/main`, `src/preload`, `src/renderer` 기본 골격 생성
- [x] 보안 설정 적용: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- [x] `electron-store` 설정(설정·호스트 목록 저장소)
- [x] preload `contextBridge` 기본 골격 + IPC 라우팅 골격
- [x] `electron-builder` 패키징 설정(mac/win/linux) 초안
- [x] `npm run dev`로 빈 위젯 창이 정상 표시되는지 확인
- [x] 🔍 **검수**: 빌드/실행 성공, 보안 설정 확인, 디렉토리 구조가 CLAUDE.md와 일치 → Phase 1 진행 승인
  - 검증: `npm run build` ✓, `npm run typecheck` ✓, `npm run dev` → Electron 창 정상 기동 ✓
  - 비고: electron 바이너리 postinstall이 환경 제약으로 자동 완료되지 않아 수동 보정함(아래 "환경 메모" 참조)

## Phase 1 — SETUP (의존성 점검/설치) · `SETUP_SPEC.md`
- [x] 원격 호스트 대상 node/npm/ccusage 점검 로직(`command -v`, 버전) — `CommandRunner` 추상화(로컬 now / SSH Phase 2)
- [x] 점검 결과 모델 `{ name, installed, version? }` 수집(`DependencyCheck`/`SetupReport`)
- [x] 누락 항목 안내(설치 plan: 항목+명령) 산출 — 화면 표시는 Phase 4(UI)
- [x] y/n 동의 입력 처리(`confirm` 콜백; `setup:install`이 동의 게이트) — 화면 입력은 Phase 4
- [x] OS별 설치 명령 매핑 테이블(mac/ubuntu/windows)로 설치 실행 + 결과(`InstallOutcome`) 반환
- [x] ccusage 미설치 시 `npx ccusage@latest` 폴백 명령 제공(사용처는 Phase 3)
- [x] 점검/설치 결과 캐싱(`setupReports`) 및 요약 상태(`summarizeStatus`)
- [x] 🔍 **검수**: SETUP_SPEC 완료 기준 충족, y/n→설치 흐름 동작, 폴백 동작 확인 → Phase 2 진행 승인
  - 검증: `npm run typecheck` ✓, `npm run build` ✓, 스모크(로컬 점검·OS감지·설치명령 매핑·confirm=false 미실행·confirm=true 실행·npx 폴백) ✓
  - 비고: 실제 전역 설치는 미실행(검수 안전). 안내·동의의 화면 연동은 Phase 4, 원격 실행은 Phase 2에서 SSH 러너로 교체

## Phase 2 — CONNECTION (원격 연결·호스트 관리) · `CONNECTION_SPEC.md`
- [x] `HostEntry` 데이터 모델 정의 + `electron-store` 저장 — `hosts/types.ts`·`hosts/repository.ts`, store 스키마(hosts/selectedHostId/hostSecrets). 검수: typecheck/build + repository CRUD 스모크 ✓ (이슈 #5)
- [x] 자격증명 보안 저장(키 패스프레이즈/비밀번호 → `safeStorage`) — `hosts/credentials.ts`(암호문 base64만 저장, 평문 금지). 검수: typecheck/build + mock 스모크(평문 미저장 포함) ✓ (이슈 #7)
- [x] `ssh2` 기반 SSH 연결·원격 명령 실행 래퍼(`src/main/ssh`) — `SshCommandRunner`(CommandRunner 구현, 연결재사용/255 resolve/dispose). 검수: typecheck/build + ssh2 mock 스모크 ✓ (이슈 #9)
- [x] IP 등록 플로우(입력 폼 → 연결 테스트 → 저장) — 로직: `hosts/index.ts registerHost`(테스트 성공 시만 저장, 실패 롤백). 검수: typecheck/build + mock 스모크 ✓ (이슈 #15)
- [x] 연결 테스트(`uname`/`ver` 도달성) + OS 자동 감지 — `hosts/connection.ts`(buildSshConfig+testConnection, detectOs 재사용). 검수: typecheck/build + ssh2/fs mock 스모크 ✓ (이슈 #11)
- [x] OS별 별칭 기본값 제안 및 사용자 수정 — `hosts/alias.ts` defaultAlias. 검수: typecheck/build + 매핑 스모크 ✓ (이슈 #13)
- [x] IP 전환(좌/우 순환) + 현재 선택 상태 영속화 — `hosts/index.ts switchHost/selectHost`. 검수: typecheck/build + 순환 스모크 ✓ (이슈 #17)
- [x] 항목 수정/삭제 — `hosts/index.ts editHost/deleteHost`(삭제 시 자격증명 제거+선택 전환). 검수: typecheck/build + mock 스모크 ✓ (이슈 #19)
- [x] IPC: `host:add/list/test/switch/update/remove` + `host:status` 푸시 — `ipc.ts` 실제 핸들러 + createRunnerForHost SSH 교체, preload host.update/onStatus. 검수: typecheck/build ✓ (이슈 #21)
- [x] 🔍 **검수**: 키/비밀번호 인증 연결, 등록/전환/별칭 동작, 자격증명 평문 미저장 확인 → Phase 3 진행 승인 (이슈 #23)
  - 통합 스모크(mock ssh2/electron): 키·비밀번호 등록→OS 감지→별칭→list→전환 순환→수정→삭제(자격증명 제거) + **store 전체 평문 비밀 부재** ✓
  - 실제 Electron `safeStorage` 라운드트립(이 환경): isEncryptionAvailable=true, 복호 일치, 암호문에 평문 부재 ✓
  - typecheck/build ✓
  - ⚠️ 미수행(플래그): **실제 원격 호스트로의 SSH 핸드셰이크**(키/비밀번호) — 사용자 호스트 제공 시 수행. ssh2 래퍼/연결테스트 로직은 mock 검증 완료.

## Phase 3 — DATA (조회·표시) · `DATA_SPEC.md`
- [x] ccusage 호출 명령 빌더 + 단일 호출(npx 폴백) — `usage/commands.ts`+`run.ts`. 검수: typecheck/build + 실제 로컬 npx 폴백 호출 ✓ (이슈 #27) · (6종 묶음은 다음 항목)
- [x] 6종 호출 묶음 처리(병렬/세션 재사용) + 개별 성공·실패 처리 — `usage/index.ts fetchUsageCells`. 검수: typecheck/build + mock 스모크(격리·disconnected) ✓ (이슈 #31)
- [x] 방어적 JSON 파싱 → 공통 `UsageCell` 모델 정규화 — `usage/parse.ts`(period/data·totalCost/costUSD 변형 흡수, 최근 항목, 빈값/malformed 안전). 검수: 실제 JSON+변형 스모크 ✓ (이슈 #29)
- [x] 30초 폴링(현재 호스트), 호스트 전환 시 즉시 갱신, `usage:refresh` 수동 갱신 — `usage/poller.ts`+`runnerFactory.ts`+index/ipc 배선. 검수: typecheck/build + poller 스모크 ✓ (이슈 #35)
- [x] 폴링 사이클에 연결 상태(`lastStatus`) 갱신 통합 — poller에서 connection→updateHost+host:status 푸시. 검수: typecheck/build + 상태 전이 스모크 ✓ (이슈 #37)
- [x] 2×3 그리드 데이터 구성(비용 + 토큰) — `usage` UsageGrid/assembleGrid/getCell/fetchUsageGrid. 검수: typecheck/build + 그리드 스모크 ✓ (이슈 #33)
- [x] 상태 처리: 데이터 없음 "없음", SSH 실패 "연결 안됨", 로딩/에러/갱신시각 — UsageGrid.status + poller 로딩→ready/error. 검수: typecheck/build + 상태 스모크 ✓ (이슈 #39)
- [x] IPC: `usage:update`(푸시=UsageGrid) / `usage:refresh`(요청→refreshNow) — preload 타입 계약 확정. 검수: typecheck/build + 누출 0 ✓ (이슈 #41)
- [ ] 🔍 **검수**: 실제 호스트에서 6종 조회·표시, 없음/연결안됨 상태, 30초 갱신 확인 → Phase 4 진행 승인

## Phase 4 — UI (위젯 UI·윈도우) · `UI_SPEC.md`
- [ ] frameless/transparent/always-on-top/skipTaskbar 셸 + 드래그 영역
- [ ] 컨트롤 헤더바: ✕ 종료 / ─ 최소화(접기) / □ 최대화(상세 확장)
- [ ] 최소화=접기(헤더만), 최대화=상세 확장 동작 + 상태 영속화
- [ ] + 버튼 IP 등록 폼/모달(CONNECTION 로직 연동)
- [ ] ◀▶ 버튼 호스트 전환 + 현재 별칭 표시(+ 호스트 없음 안내)
- [ ] 데이터 영역(2×3) 렌더링 + 상태 표시(로딩/에러/연결안됨/갱신시각)
- [ ] 전체 레이아웃·크기·반응형
- [ ] preload 화이트리스트 API만 사용 확인
- [ ] 🔍 **검수**: 전 컨트롤 동작, 상태 표시, 보안 경계 준수, 전체 통합 동작 확인 → 출시 후보 점검

---

## 최종 통합 점검
- [ ] 4개 SPEC 완료 기준 전수 교차 확인
- [ ] mac/win/linux 크로스플랫폼 동작 점검(로컬 표시 + 원격 OS 조회)
- [ ] 패키징 빌드 산출물 확인

---

## 환경 메모 (Environment Notes)
- **개발 머신 사전 요구사항**: Node.js(Homebrew로 설치, `brew install node`), npm.
- **electron 바이너리 postinstall 이슈**: 자동화/제약 환경에서 `electron`의 postinstall
  (`node install.js`)이 `node_modules/electron/dist`에 바이너리를 완전히 풀지 못해
  `path.txt`/`dist/version`이 비는 경우가 있었음. 증상: `electron-vite dev` 시 `Electron uninstall`.
  - 다운로드·zip 자체는 정상(`~/Library/Caches/electron/...`). 추출/쓰기 단계만 실패.
  - **복구법**: 캐시 zip을 `node_modules/electron/dist`에 풀고
    `node_modules/electron/path.txt`에 `Electron.app/Contents/MacOS/Electron`(mac 기준) 기록.
    또는 일반 터미널에서 `rm -rf node_modules/electron && npm install electron` 재설치.
  - 검증: `node -e "console.log(require('electron'))"`가 바이너리 경로를 출력하면 정상.
- **npm allow-scripts**: 이 환경은 install script 승인제. `package.json`의 `allowScripts`에
  `electron`, `esbuild` 승인 등록됨.
