# HANDOFF — CCUsageWidget 세션 인수인계

> 다른 세션/작업자가 컨텍스트 없이 이어받기 위한 문서. 최종 갱신: **Phase 4(UI) 완료 — 4개 Phase 전부 완료**.

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
  명령 실행을 `CommandRunner`로 추상화. (PR #2, 이슈 #1)
- ✅ **Phase 2 (CONNECTION) 완료** — 호스트 모델·저장소(`src/main/hosts/`), safeStorage 자격증명,
  `ssh2` 래퍼(`src/main/ssh/`, `SshCommandRunner`), 연결테스트·OS감지·별칭·등록·전환·수정/삭제,
  `host:*` IPC. **`createRunnerForHost`를 SSH로 교체 → Phase 1 `setup:*`가 이제 원격에서 동작.**
  체크박스 10개를 각각 브랜치/이슈/PR로 처리(이슈 #5~#23, PR #6~#24). `typecheck`/`build`/통합 스모크/실 safeStorage 검증 완료.
  ⚠️ **실호스트 SSH 핸드셰이크는 미검증**(테스트 호스트 부재) — 사용자 호스트 제공 시 실연결 확인 필요.
- ✅ **Phase 3 (DATA) 완료** — ccusage 데이터 파이프라인(`src/main/usage/`): 6종 호출(npx 폴백)·방어적 파싱·
  2×3 그리드·30초 폴링(`poller.ts`)·연결상태 통합·상태(loading/ready/error)·`usage:*` IPC.
  체크박스 9개(이슈 #27~#43, PR #28~#44). **로컬 ccusage 실데이터 e2e 검증 완료.**
- ✅ **Phase 4 (UI) 완료** — React 렌더러(`src/renderer/src/`): 컴포넌트(Header/UsageGrid/StatusBar/HostFormModal),
  순수 로직(`lib/format·view·grid·host·form`), 2×3 그리드·상태 표시·◀▶ 전환·+ 등록 모달·접기/확장(`widget:setView/getView`)·연결 배지.
  체크박스 9개(이슈 #47~#63, PR #48~#64). typecheck/build·로직 스모크·보안 감사 + **사용자 육안 통과**.
- 🎉 **4개 Phase 전부 완료.** 진행 체크리스트의 단일 출처: `docs/IMPLEMENTATION_TODO.md` (Phase 0~4 전부 `[x]`).
- ⚠️ **이월(미검증)**: 원격 호스트 SSH 6종 실조회 — 테스트 호스트 부재. 사용자 호스트(IP/계정/인증) 제공 시 실연결 확인.
- 📌 **알려진 갭/결정 대기**: **로컬 사용량 기본 표시 미구현**. 폴러는 등록된 호스트만 조회(`getSelectedHost`),
  호스트 없으면 "등록된 호스트 없음". `createRunnerForHost('local')`은 setup 진단/검증 스모크에만 쓰이고 usage 폴러는 'local'을 안 씀.
  SPEC상 데이터 출처=등록된 원격 호스트라 의도된 동작. "로컬도 기본 표시"를 원하면 SPEC(DATA/SETUP/CLAUDE.md) 갱신 후
  별도 작업 필요(방법 A: 내장 'local' 호스트 시드+기본선택 / 방법 B: 호스트 없을 때 로컬 폴백). **사용자 결정 대기.**

## 3. 기술 스택 / 핵심 결정
- Electron + electron-vite, React 18 + TypeScript(strict)
- 원격 접속: `ssh2@^1.17.0` (Phase 2 도입 완료. 네이티브 install script는 선택사항 — 순수 JS로 동작)
- 영속화: `electron-store` v8(CJS) — ESM 마찰 회피용.
- **자격증명 보안 저장(Phase 2 확정)**: Electron `safeStorage`로 암호화한 base64만 store(`hostSecrets`)에 저장.
  평문 저장 금지. 복호화는 main 프로세스(`src/main/hosts/credentials.ts`)에서만.
- 데이터: 프로바이더별 개별 호출(`ccusage [codex|gemini] daily/monthly --json`)
- **명령 실행 추상화**: `src/main/setup/runner.ts`의 `CommandRunner` 인터페이스. 구현체 2종 —
  `LocalCommandRunner`(child_process) / `SshCommandRunner`(`src/main/ssh/runner.ts`, ssh2).
  `src/main/runnerFactory.ts`의 `createRunnerForHost(hostId)`가 등록 호스트면 SSH 러너, 'local'/미발견이면 로컬 러너 반환.
  ⇒ 점검/설치(Phase 1)·데이터 조회(Phase 3)가 러너 주입만으로 원격 동작. (ipc.ts·poller.ts 공유)
- **ccusage JSON 실측 스키마(Phase 3, 방어적 파싱 근거)**: 최상위 `{ daily|monthly: [...항목], totals: {...} }`.
  항목 날짜 키는 **`period`**(문서 추정 `date` 아님). 비용 키는 claude/gemini=`totalCost`, **codex=`costUSD`**.
  codex/gemini는 데이터 없으면 빈 배열 → `present:false`. `src/main/usage/parse.ts`가 이 변형들을 흡수.
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
  index.ts   # 앱 라이프사이클, createWindow(frameless/투명/always-on-top), 보안 webPreferences, usagePoller.start
  ipc.ts     # registerIpc(): widget:*·setup:*·host:*·usage:* 핸들러
  runnerFactory.ts # createRunnerForHost(로컬/SSH)·disposeRunner — ipc·poller 공유 seam
  store.ts   # electron-store (StoreSchema: windowBounds, setupReports, hosts, selectedHostId, hostSecrets)
  setup/     # Phase 1: 의존성 점검/설치
    types.ts        #   DependencyName/OsType/SetupReport/InstallPlanItem/InstallOutcome 등
    runner.ts       #   CommandRunner 인터페이스 + LocalCommandRunner
    os.ts           #   detectOs(uname/ver → macos/ubuntu/windows/unknown)  ← hosts 연결테스트도 재사용
    dependencies.ts #   checkAll, INSTALL_COMMANDS 매핑, buildInstallPlan/applyInstallPlan(confirm), npxFallbackCommand
    index.ts        #   runSetupCheck/summarizeStatus + store 캐시
  hosts/     # ★Phase 2: 호스트 관리
    types.ts        #   HostEntry/SshAuth/HostInput (OsType는 setup/types 재사용)
    repository.ts   #   store 기반 CRUD(list/get/add/update/remove) + 선택상태(get/setSelectedHostId)
    credentials.ts  #   safeStorage 암복호화(saveSecret/getSecret/hasSecret/deleteSecret) — 평문 금지
    connection.ts   #   buildSshConfig(키파일 로드) + testConnection(도달성+detectOs)
    alias.ts        #   defaultAlias(os, host)
    index.ts        #   facade + registerHost/switchHost/selectHost/editHost/deleteHost
  ssh/       # ★Phase 2: ssh2 래퍼
    runner.ts       #   SshCommandRunner implements CommandRunner (connect/run/dispose, 연결 재사용)
  usage/     # ★Phase 3: 데이터 조회·정규화·폴링
    types.ts        #   Provider/Period/UsageCell/UsageGrid/UsageStatus
    commands.ts     #   ccusageArgs(provider, period) — codex/gemini 프리픽스
    run.ts          #   runCcusage(runner, args) — ccusage 실패 시 npx 폴백
    parse.ts        #   parseUsage — 방어적 파싱(period/data·totalCost/costUSD 변형, 최근 항목)
    index.ts        #   fetchUsageCells(6종 병렬)·assembleGrid·getCell·fetchUsageGrid
    poller.ts       #   usagePoller 싱글톤(30s, **등록된 선택 호스트만** 조회 — ★로컬 기본표시 아님, §2 갭 참조). usage:update+host:status 푸시, loading/ready/error
src/preload/
  index.ts   # contextBridge로 window.api 노출(usage/host/setup/widget), WidgetApi·UsageGrid·HostEntry 등 타입 export
  index.d.ts # 전역 Window.api 타입
src/renderer/src/     # ★Phase 4: React UI
  App.tsx           # 루트: 상태(view/grid/hosts/selectedHostId/modal), usage.onUpdate·host.onStatus 구독, host.list 로드
  components/        # Header(별칭·◀▶·+·─□✕·연결점) / UsageGrid(2×3·상태) / StatusBar(갱신시각·배지) / HostFormModal(등록 폼)
  lib/               # 순수 로직: format(비용/토큰/시각)·view(접기/확장 전이)·grid(상태/셀)·host(별칭/전환/연결점)·form(검증/인자빌드)·types(preload 재노출)
  App.css            # glass 다크 위젯 스타일
electron.vite.config.ts, tsconfig*.json, electron-builder.yml, package.json
docs/        # SPEC 4종 + IMPLEMENTATION_TODO + HANDOFF(이 파일) + TEMP_SPEC
```

### 현재 IPC 채널 (Phase 0~4, 전체)
- **widget (Phase 4)**: `widget:setView`(접힘/정상/확장 — 리사이즈+영속화) / `widget:getView` / `widget:close`
  (구 `widget:minimize/maximize`는 제거되고 setView로 대체됨)
- **setup (Phase 1)**: `setup:check`(점검만, 설치X) / `setup:install`(동의 후 설치) / `setup:status`(캐시 조회)
- **host (Phase 2)**: `host:add`(등록=연결테스트 후 저장) / `host:list`({hosts, selectedHostId}, 비밀 미포함) /
  `host:test`(연결테스트 단독) / `host:switch`('prev'|'next' 또는 {id}, 전환 시 즉시 갱신) / `host:update` / `host:remove` /
  `host:status`(푸시 — poller가 30초 폴링에서 수행)
- **usage (Phase 3)**: `usage:update`(푸시 = `UsageGrid`, poller→렌더러) / `usage:refresh`(요청 → 즉시 폴링)
- 규칙: ccusage/SSH 접근은 **메인 프로세스 경유만**, 새 IPC는 **preload 화이트리스트에만** 추가.
- preload 노출 API: `window.api.{usage,setup,host,widget}`
  (usage: onUpdate(grid)/refresh, host: add/list/test/switch/update/remove/onStatus, widget: setView/getView/close)

## 7. 남은 작업 / 다음 후보 (4개 Phase 완료 후)
계획된 Phase 0~4는 모두 끝났다. 남은 것은 **검증 이월·선택 기능·출시 준비**다.

1. **원격 SSH 실조회 검증(이월, 우선)** — 테스트용 원격 호스트(IP/계정/인증)로 등록→연결테스트→실제 6종 조회·표시 end-to-end 확인.
   ssh2 래퍼·연결테스트는 mock/로컬로만 검증됨. 사용자 호스트 제공 시 진행.
2. **로컬 사용량 기본 표시(결정 대기)** — §2 갭 참조. 원하면 SPEC(DATA/SETUP/CLAUDE.md) 먼저 갱신 후 체크박스 워크플로우로:
   - 방법 A: 내장 'local' 호스트 시드(`repository`) + 기본 선택 → poller가 `createRunnerForHost('local')`=LocalCommandRunner로 로컬 조회.
   - 방법 B: `getSelectedHost()` 없을 때 poller가 로컬 폴백.
3. **출시 준비(선택)** — `electron-builder` 패키징(mac/win/linux) 실빌드·서명/공증, 트레이 아이콘(옵션), 최종 통합 점검(IMPLEMENTATION_TODO "최종 통합 점검" 섹션).
4. **SETUP UI 연동(선택)** — `setup:*`(의존성 점검/설치) 결과를 등록 모달/상태에 노출(누락 안내·y/n 설치). 현재 IPC만 있고 화면 미연동.

- 재사용: 데이터/동작은 전부 기존 IPC(`setup:*`/`host:*`/`usage:*`/`widget:*`)로 제공 — 렌더러는 `window.api`만.

## 8. Git 상태
- 브랜치: `main`, 원격: `https://github.com/BluewhaleYH/CCUsageWidget.git`
- 최신 커밋: Phase 4-CB9 검수 머지(PR #64). Phase 4 체크박스 9개(이슈 #47~#63, PR #48~#64 — 전부 close/merge, 브랜치 정리됨).
- 누적: Phase 1(이슈 #1) · Phase 2(#5~#23) · Phase 3(#27~#43) · Phase 4(#47~#63) 모두 close.
- **작업 단위 = TODO 체크박스 하나** (CLAUDE.md 규칙): 브랜치→이슈→진행코멘트→자체검수→푸시→PR머지+이슈close→체크갱신.
  Phase를 한 묶음으로 처리하지 말 것.
- **검증 패턴(참고)**: store/electron/ssh2 의존 로직은 esbuild 번들+해당 모듈 mock으로 node 스모크.
  파서/파이프라인은 로컬 `npx ccusage@latest` 실제 JSON. UI 순수 로직(`lib/*`)은 번들 후 node 스모크, 시각은 `npm run dev` 육안.
- 작업 흐름: 사용자가 "커밋/푸시" 요청 시에만 커밋. 커밋 메시지 한국어, 마지막 줄에
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **검증 패턴(참고)**: store/electron/ssh2가 필요한 로직은 esbuild로 번들하며 해당 모듈을 mock해 스모크.
  파서/파이프라인은 로컬 `npx ccusage@latest`의 실제 JSON으로 검증.

## 9. 작업 관례
- 대화 언어: **한국어**. 문서 본문 한국어, 코드 식별자/명령어/경로는 영어.
- 각 Phase는 SPEC 기준 + Phase 경계 검수 필수.
- 구현이 SPEC과 어긋나면 **SPEC 먼저 갱신** 후 진행, 필요 시 CLAUDE.md 동기화.
- **TODO별 Git/Issue 워크플로우 준수** (CLAUDE.md의 "TODO 작업 워크플로우" 참조):
  브랜치 생성 → 이슈 등록 → 진행 중 특이사항/수정 코멘트 → 자체 검수 통과 →
  푸시 → 이슈 close + `main` merge → TODO 체크 갱신.
