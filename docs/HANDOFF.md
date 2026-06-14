# HANDOFF — CCUsageWidget 세션 인수인계

> 다른 세션/작업자가 컨텍스트 없이 이어받기 위한 문서. 최종 갱신: **Phase 1(SETUP) 완료 시점**.

## 0. 가장 먼저 할 일 (세션 시작 절차)
1. `CLAUDE.md` 읽기 (프로젝트 청사진 + 세션 시작 규칙)
2. `docs/`의 SPEC 4종 읽기: `SETUP_SPEC.md`, `CONNECTION_SPEC.md`, `DATA_SPEC.md`, `UI_SPEC.md`
3. `docs/IMPLEMENTATION_TODO.md`에서 **다음 미완료 항목**부터 이어가기
4. 이 문서(`HANDOFF.md`)의 환경 설정·실행법 확인

## 1. 프로젝트 한 줄 요약
**SSH로 등록된 여러 원격 컴퓨터**에서 `ccusage` CLI(daily/monthly)를 조회해
claude/codex/gemini 사용량·비용을 보여주는 **Electron 크로스플랫폼 데스크톱 위젯**.
30초 자동 갱신. 프레임 없는 투명 always-on-top 형태.

## 2. 현재 진행 상태
- ✅ **Phase 0 (스캐폴딩) 완료** — electron-vite + React 18 + TS(strict) 골격, 보안 설정,
  IPC 골격, electron-store, electron-builder 초안. `build`/`typecheck`/`dev` 검증 완료.
- ✅ **Phase 1 (SETUP) 완료** — 의존성 점검/설치 로직(`src/main/setup/`)과 `setup:*` IPC 계약.
  명령 실행을 `CommandRunner`로 추상화(로컬 now / Phase 2서 SSH 러너로 교체). `typecheck`/`build`/스모크 검증 완료.
  (PR #2 머지, 이슈 #1 close)
- ⏭️ **다음: Phase 2 (CONNECTION)** — `HostEntry` 모델·자격증명 보안저장·`ssh2` 래퍼·호스트 등록/테스트/전환.
- 진행 체크리스트의 단일 출처: `docs/IMPLEMENTATION_TODO.md` (Phase 0·1 전부 `[x]`).

## 3. 기술 스택 / 핵심 결정
- Electron + electron-vite, React 18 + TypeScript(strict)
- 원격 접속: `ssh2` (Phase 2 도입 예정)
- 영속화: `electron-store` v8(CJS) — ESM 마찰 회피용. 자격증명은 평문 저장 금지(보안 저장소/safeStorage)
- 데이터: 프로바이더별 개별 호출(`ccusage [codex|gemini] daily/monthly --json`)
- **명령 실행 추상화(Phase 1 도입)**: `src/main/setup/runner.ts`의 `CommandRunner` 인터페이스.
  지금은 `LocalCommandRunner`(child_process), Phase 2에서 `SshCommandRunner`(ssh2)를 추가해
  `ipc.ts`의 `createRunnerForHost(hostId)` seam만 교체하면 점검/설치/조회가 원격에서 동작.
- 보안(절대 완화 금지): `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`

## 4. 개발 환경 설정 (새 머신/세션)
```bash
# 1) Node (없으면)
brew install node

# 2) 의존성
cd <repo>
npm install
```
- 이 환경은 npm **install-script 승인제**. `package.json > allowScripts`에
  `electron`, `esbuild` 승인 등록됨. 새 머신에서 막히면 `npm approve-scripts electron esbuild`.

### ⚠️ electron 바이너리 postinstall 이슈 (중요)
자동화/제약 환경에서 `electron` postinstall이 `node_modules/electron/dist`에 바이너리를
완전히 풀지 못해 `path.txt`/`dist/version`이 비는 경우가 있음.
- 증상: `npm run dev` 시 `Error: Electron uninstall`.
- 점검: `node -e "console.log(require('electron'))"` → 바이너리 경로가 나오면 정상.
- 복구(택1):
  - 일반 터미널: `rm -rf node_modules/electron && npm install electron`
  - 수동: 캐시 zip(`~/Library/Caches/electron/<hash>/electron-*.zip`)을
    `node_modules/electron/dist`에 풀고, `node_modules/electron/path.txt`에
    `Electron.app/Contents/MacOS/Electron`(mac) 기록.
- 자세한 내용: `docs/IMPLEMENTATION_TODO.md`의 "환경 메모".

## 5. 실행 / 검증 명령
```bash
npm run dev        # electron-vite dev (HMR) — 위젯 창 표시
npm run build      # 프로덕션 번들
npm run typecheck  # tsc (node + web)
npm run build:mac  # / :win / :linux — 패키징(electron-builder)
```
- 검증 기준: `build` + `typecheck` 통과, `dev`로 프레임리스 투명 창 정상 표시.

## 6. 디렉토리 / 핵심 파일
```
src/main/
  index.ts   # 앱 라이프사이클, createWindow(frameless/투명/always-on-top), 보안 webPreferences
  ipc.ts     # registerIpc(): widget:*·setup:* 동작 + usage:*/host:* stub. createRunnerForHost seam
  store.ts   # electron-store (StoreSchema: windowBounds, setupReports — Phase 2에서 호스트 확장)
  setup/     # ★Phase 1: 의존성 점검/설치
    types.ts        #   DependencyName/OsType/SetupReport/InstallPlanItem/InstallOutcome 등
    runner.ts       #   CommandRunner 인터페이스 + LocalCommandRunner (Phase 2서 SshCommandRunner 추가)
    os.ts           #   detectOs(uname/ver → macos/ubuntu/windows/unknown)
    dependencies.ts #   checkAll, INSTALL_COMMANDS 매핑, buildInstallPlan/applyInstallPlan(confirm), npxFallbackCommand
    index.ts        #   runSetupCheck/summarizeStatus + store 캐시(saveReport/getReport)
src/preload/
  index.ts   # contextBridge로 window.api 노출(usage/host/setup/widget), WidgetApi 타입 export
  index.d.ts # 전역 Window.api 타입
src/renderer/
  index.html, src/main.tsx, src/App.tsx(플레이스홀더 위젯), src/App.css(투명·드래그)
electron.vite.config.ts, tsconfig*.json, electron-builder.yml, package.json
docs/        # SPEC 4종 + IMPLEMENTATION_TODO + HANDOFF(이 파일) + TEMP_SPEC
```

### 현재 IPC 채널 (Phase 0~1)
- 동작: `widget:minimize` `widget:maximize` `widget:close`
- **setup (Phase 1 구현)**: `setup:check`(점검만, 설치X) / `setup:install`(동의 후 설치) / `setup:status`(캐시 조회)
- stub(미구현, `{ok:false,error}` 반환): `usage:refresh`, `host:list|add|test|switch|remove`
- 푸시 예정: `usage:update`(메인→렌더러), `host:status`
- 규칙: ccusage/SSH 접근은 **메인 프로세스 경유만**, 새 IPC는 **preload 화이트리스트에만** 추가.

## 7. 다음 작업 (Phase 2 — CONNECTION) 착수 포인트
- 기준 문서: `docs/CONNECTION_SPEC.md` (관련: `SETUP_SPEC.md` §4.6 OS 감지 — 이미 `setup/os.ts`에 구현됨)
- 핵심 작업:
  1. `HostEntry` 데이터 모델(`CONNECTION_SPEC` §2) 정의 + `electron-store` 저장(`StoreSchema`에 `hosts`·선택상태 추가).
  2. 자격증명 보안 저장: 키 패스프레이즈/비밀번호는 **평문 저장 금지** → OS 키체인 또는 Electron `safeStorage`.
  3. `src/main/ssh/`에 `ssh2` 기반 `SshCommandRunner`(★ `CommandRunner` 구현) + 연결 래퍼.
     → `ipc.ts`의 `createRunnerForHost(hostId)`가 호스트 정보로 SSH 러너를 반환하도록 교체.
     → 이 한 곳만 바꾸면 Phase 1의 `setup:*` 점검/설치가 그대로 원격에서 동작.
  4. 등록(연결테스트 후 저장)·테스트(`uname`/`ver` 도달성+OS감지, `setup/os.ts` 재사용)·전환(좌/우 순환)·수정/삭제.
  5. IPC 구현: `host:add|list|test|switch|update|remove` + `host:status` 푸시.
- `OsType` 유니온은 `src/main/setup/types.ts`에 이미 있음 → `HostEntry.os`에서 재사용(중복 정의 금지).
- Phase 끝에 `docs/IMPLEMENTATION_TODO.md`의 🔍 **검수** 통과 필수
  (키/비밀번호 인증 연결, 등록/전환/별칭, 자격증명 평문 미저장 확인).

## 8. Git 상태
- 브랜치: `main`, 원격: `https://github.com/BluewhaleYH/CCUsageWidget.git`
- 최신 커밋: `33fbdc7 Merge pull request #2 ...` (Phase 1 SETUP) / 직전 `375a590 feat: Phase 1 SETUP ...`
- 작업 흐름: 사용자가 "커밋/푸시" 요청 시에만 커밋. 커밋 메시지 한국어, 마지막 줄에
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **TODO별 워크플로우**(CLAUDE.md): 브랜치 → 이슈 등록 → 진행 코멘트 → 자체 검수 → 푸시 →
  PR 머지 + 이슈 close → TODO 체크 갱신. (Phase 1은 `todo/phase1-setup-deps` / 이슈 #1 / PR #2로 수행)

## 9. 작업 관례
- 대화 언어: **한국어**. 문서 본문 한국어, 코드 식별자/명령어/경로는 영어.
- 각 Phase는 SPEC 기준 + Phase 경계 검수 필수.
- 구현이 SPEC과 어긋나면 **SPEC 먼저 갱신** 후 진행, 필요 시 CLAUDE.md 동기화.
- **TODO별 Git/Issue 워크플로우 준수** (CLAUDE.md의 "TODO 작업 워크플로우" 참조):
  브랜치 생성 → 이슈 등록 → 진행 중 특이사항/수정 코멘트 → 자체 검수 통과 →
  푸시 → 이슈 close + `main` merge → TODO 체크 갱신.
