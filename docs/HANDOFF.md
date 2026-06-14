# HANDOFF — CCUsageWidget 세션 인수인계

> 다른 세션/작업자가 컨텍스트 없이 이어받기 위한 문서. 최종 갱신: **Phase 2(CONNECTION) 완료 시점**.

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
- ⏭️ **다음: Phase 3 (DATA)** — 선택 호스트에서 ccusage 6종(daily/monthly × claude/codex/gemini) 호출·정규화·30초 폴링·표시.
- 진행 체크리스트의 단일 출처: `docs/IMPLEMENTATION_TODO.md` (Phase 0·1·2 전부 `[x]`).

## 3. 기술 스택 / 핵심 결정
- Electron + electron-vite, React 18 + TypeScript(strict)
- 원격 접속: `ssh2@^1.17.0` (Phase 2 도입 완료. 네이티브 install script는 선택사항 — 순수 JS로 동작)
- 영속화: `electron-store` v8(CJS) — ESM 마찰 회피용.
- **자격증명 보안 저장(Phase 2 확정)**: Electron `safeStorage`로 암호화한 base64만 store(`hostSecrets`)에 저장.
  평문 저장 금지. 복호화는 main 프로세스(`src/main/hosts/credentials.ts`)에서만.
- 데이터: 프로바이더별 개별 호출(`ccusage [codex|gemini] daily/monthly --json`)
- **명령 실행 추상화**: `src/main/setup/runner.ts`의 `CommandRunner` 인터페이스. 구현체 2종 —
  `LocalCommandRunner`(child_process) / `SshCommandRunner`(`src/main/ssh/runner.ts`, ssh2).
  `ipc.ts`의 `createRunnerForHost(hostId)`가 등록 호스트면 SSH 러너, 'local'/미발견이면 로컬 러너 반환.
  ⇒ 점검/설치(Phase 1)·데이터 조회(Phase 3)가 러너 주입만으로 원격 동작.
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
  ipc.ts     # registerIpc(): widget:*·setup:*·host:* 핸들러 + createRunnerForHost(로컬/SSH) + sendHostStatus
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
src/preload/
  index.ts   # contextBridge로 window.api 노출(usage/host/setup/widget), WidgetApi 타입 export
  index.d.ts # 전역 Window.api 타입
src/renderer/
  index.html, src/main.tsx, src/App.tsx(플레이스홀더 위젯), src/App.css(투명·드래그)
electron.vite.config.ts, tsconfig*.json, electron-builder.yml, package.json
docs/        # SPEC 4종 + IMPLEMENTATION_TODO + HANDOFF(이 파일) + TEMP_SPEC
```

### 현재 IPC 채널 (Phase 0~2)
- 동작: `widget:minimize` `widget:maximize` `widget:close`
- **setup (Phase 1)**: `setup:check`(점검만, 설치X) / `setup:install`(동의 후 설치) / `setup:status`(캐시 조회)
- **host (Phase 2 구현)**: `host:add`(등록=연결테스트 후 저장) / `host:list`({hosts, selectedHostId}, 비밀 미포함) /
  `host:test`(연결테스트 단독) / `host:switch`('prev'|'next' 또는 {id}) / `host:update` / `host:remove` /
  `host:status`(푸시, `sendHostStatus`로 Phase 3 폴링에서 사용)
- stub(미구현, `{ok:false,error}`): `usage:refresh`
- 푸시 예정: `usage:update`(메인→렌더러)
- 규칙: ccusage/SSH 접근은 **메인 프로세스 경유만**, 새 IPC는 **preload 화이트리스트에만** 추가.
- preload 노출 API: `window.api.{usage,setup,host,widget}` (host에 add/list/test/switch/update/remove/onStatus)

## 7. 다음 작업 (Phase 3 — DATA) 착수 포인트
- 기준 문서: `docs/DATA_SPEC.md` (관련: `CONNECTION_SPEC.md` §3.6 30초 폴링에 연결상태 통합)
- 핵심 작업:
  1. 선택 호스트(`repository.getSelectedHost`)에서 SSH로 ccusage **6종** 호출:
     daily/monthly × claude/codex/gemini. 러너는 `createRunnerForHost(selectedId)`로 획득(이미 SSH 연결됨).
     ccusage 미설치 시 `setup`의 `npxFallbackCommand`로 폴백.
  2. 6종 묶음 처리(연결 1개 재사용 — `SshCommandRunner`는 connect 1회 후 exec 다회) + 개별 성공/실패 처리.
  3. 방어적 JSON 파싱 → 공통 `UsageCell` 모델 정규화(daily/monthly 키 차이 흡수).
  4. 30초 폴링(`setInterval`, 현재 호스트만), 호스트 전환 시 즉시 갱신, `usage:refresh` 수동 갱신.
     폴링 사이클에서 연결 성공/실패로 `lastStatus` 갱신 후 `sendHostStatus`(ipc.ts)로 `host:status` 푸시.
  5. `usage:update` 푸시(메인→렌더러), `usage:refresh` 실제 구현(현재 stub).
- 재사용: `createRunnerForHost`/`SshCommandRunner`(연결 재사용), `setup/dependencies`의 `npxFallbackCommand`,
  `hosts/repository`(선택 호스트), `ipc.ts sendHostStatus`(상태 푸시 헬퍼는 이미 존재).
- Phase 끝 🔍 **검수**: 실제 호스트 6종 조회·표시, 없음/연결안됨 상태, 30초 갱신 확인.

> ⚠️ **실호스트 SSH 미검증 이월**: Phase 2에서 ssh2 래퍼/연결테스트는 mock으로만 검증됨.
> Phase 3는 실제 ccusage 출력이 필요하므로, **사용자에게 테스트용 원격 호스트(IP/계정/인증)를 먼저 요청**하는 것이 좋다.
> 호스트가 없으면 ccusage JSON 샘플로 파싱/정규화 로직만 선구현하고 실연결은 이월.

## 8. Git 상태
- 브랜치: `main`, 원격: `https://github.com/BluewhaleYH/CCUsageWidget.git`
- 최신 커밋: `e1f85cc Merge pull request #24 ...` (Phase 2-CB10 검수)
- Phase 2는 체크박스 10개를 각각 브랜치/이슈/PR로 처리(이슈 #5~#23, PR #6~#24 — 전부 close/merge, 브랜치 정리됨).
- **작업 단위 = TODO 체크박스 하나** (CLAUDE.md 규칙): 브랜치→이슈→진행코멘트→자체검수→푸시→PR머지+이슈close→체크갱신.
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
