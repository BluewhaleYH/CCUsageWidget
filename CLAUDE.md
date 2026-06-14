# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

> ℹ️ 진행 상태: **Phase 0(스캐폴딩) 완료** — electron-vite + React + TS 골격이 생성되어
> `npm run dev`로 위젯 창이 뜹니다. 이후 단계는 `docs/IMPLEMENTATION_TODO.md`를 따릅니다.
> 코드가 SPEC과 어긋나면 SPEC을 먼저 갱신한 뒤 이 문서도 동기화하세요.

## 🚀 세션 시작 시 반드시 따를 절차 (Session Startup)

새 세션이 열리면 **구현 작업을 시작하기 전에** 아래 순서를 따릅니다.

1. `docs/`의 SPEC 문서 4종을 먼저 읽는다:
   `SETUP_SPEC.md`, `CONNECTION_SPEC.md`, `DATA_SPEC.md`, `UI_SPEC.md`
2. `docs/IMPLEMENTATION_TODO.md`를 읽고 **다음 미완료(`- [ ]`) 항목부터 이어서** 진행한다.
3. 항목을 완료하면 해당 체크박스를 `- [x]`로 갱신한다.
4. 각 Phase 끝의 **🔍 검수 항목을 건너뛰지 않는다.** 검수를 통과해야 다음 Phase로 넘어간다.
5. 구현이 SPEC과 어긋나면 **SPEC을 먼저 갱신**한 뒤 진행하고, 필요 시 이 문서도 동기화한다.

## 프로젝트 개요 (Project Overview)

**CCUsageWidget**는 Electron 기반의 **크로스플랫폼 바탕화면 위젯**입니다.
**SSH로 등록된 여러 원격 컴퓨터**에서 [`ccusage`](https://ccusage.com) CLI의
`daily`·`monthly` 결과를 조회해 바탕화면에 띄우며, **Claude Code뿐 아니라
Codex·Gemini 등 여러 코딩 에이전트 CLI의 사용량·비용을 한눈에** 보여줍니다.

- **표시 데이터**: `ccusage daily` + `ccusage monthly` (claude/codex/gemini 프로바이더별)
- **데이터 출처**: **SSH로 등록된 원격 호스트**에서 실행한 `ccusage` CLI (`--json` 출력 파싱)
- **멀티 호스트**: 여러 컴퓨터를 등록하고 좌/우 전환으로 하나씩 조회 (현재 선택 호스트만 폴링)
- **갱신 주기**: 30초마다 자동 갱신 (연결 상태 점검도 이 사이클에 통합)
- **형태**: 프레임 없는(frameless) 투명 항상-위(always-on-top) 위젯

> 세부 기능 명세는 `docs/` 참조: `SETUP_SPEC.md`(의존성), `CONNECTION_SPEC.md`(SSH·호스트),
> `DATA_SPEC.md`(조회·표시), `UI_SPEC.md`(UI·윈도우).

## 기술 스택 (Tech Stack)

| 영역 | 선택 |
|------|------|
| 런타임/셸 | Electron |
| 빌드 도구 | electron-vite (Vite 기반, HMR) |
| 프론트엔드 | React 18 + TypeScript |
| 원격 접속 | `ssh2` (메인 프로세스에서 SSH 연결·원격 명령 실행) |
| 데이터 소스 | **원격 호스트의** `ccusage` CLI (설치되어 있거나 `npx`로 실행) |
| 상태 영속화 | `electron-store` (호스트 목록·창 위치/크기/설정 저장) |
| 자격증명 보안 | OS 보안 저장소(Keychain/Credential Manager/libsecret) 또는 Electron `safeStorage` |
| 패키징 | electron-builder (macOS / Windows / Linux) |

- TypeScript는 `strict` 모드를 사용합니다.

## 아키텍처 (Architecture)

Electron의 3-프로세스 모델을 따릅니다. **보안 경계를 절대 흐리지 마세요.**

### Main 프로세스 (`src/main/`)
- `BrowserWindow` 생성 및 위젯 창 속성 관리(아래 "위젯 동작" 참고).
- **SSH·원격 ccusage 실행 담당**: 렌더러는 샌드박스이므로, 등록된 원격 호스트에
  `ssh2`로 접속해 ccusage를 실행하고 `--json` 출력을 파싱합니다.
  (claude/codex/gemini × daily/monthly = 호스트당 6회 호출 — `DATA_SPEC.md` 참조)
- **호스트 관리**: 호스트 등록/테스트/전환/별칭/연결상태를 관리(`CONNECTION_SPEC.md`).
  자격증명(키 패스프레이즈·비밀번호)은 store 평문 저장 금지, 보안 저장소 사용.
- **30초 폴링**: `setInterval`로 30초마다 **현재 선택된 호스트**의 데이터를 조회하고
  연결 상태를 함께 갱신한 뒤 `webContents.send`로 렌더러에 푸시합니다.
- 호스트 목록·창 위치/설정을 `electron-store`로 영속화.

### Preload (`src/preload/`)
- `contextBridge`로 **화이트리스트된 안전한 API만** 렌더러에 노출합니다.
- 노출 API 예시:
  - `window.usage.onUpdate(callback)` — 갱신된 사용량 데이터 수신
  - `window.usage.refresh()` — 수동 갱신 요청
  - `window.host.add/list/test/switch/remove(...)` — 호스트 관리
  - `window.widget.minimize/maximize/close(...)` 등 위젯 제어
- 새 IPC가 필요하면 **반드시 여기 화이트리스트에만** 추가합니다. 임의 노출 금지.

### Renderer (`src/renderer/`)
- React 앱. main에서 받은 데이터를 카드/리스트 UI로 렌더링합니다.
- Node API에 직접 접근하지 않고, **오직 preload가 노출한 API만** 사용합니다.

### 보안 규칙 (필수)
```
contextIsolation: true
nodeIntegration: false
sandbox: true
```
이 설정은 변경하지 마세요. 모든 권한 있는 작업은 main 프로세스 ↔ IPC를 경유합니다.

## ccusage 연동 (ccusage Integration)

> ccusage는 **로컬이 아니라 선택된 원격 호스트에서 SSH로 실행**됩니다.

### 호출 명령 (프로바이더별 개별 호출)
- claude: `ccusage daily --json` / `ccusage monthly --json`
- codex: `ccusage codex daily --json` / `ccusage codex monthly --json`
- gemini: `ccusage gemini daily --json` / `ccusage gemini monthly --json`
- **미설치 대비 폴백**: ccusage가 PATH에 없으면 `npx ccusage@latest <args>`로 실행합니다.

### JSON 출력 형태 (방어적으로 파싱)
ccusage 버전에 따라 필드가 달라질 수 있으므로, 누락/형 변경에 견고하게 파싱하세요.

- **daily** (`ccusage daily --json`):
  ```jsonc
  {
    "daily": [
      {
        "date": "YYYY-MM-DD",
        "inputTokens": 0, "outputTokens": 0,
        "cacheCreationTokens": 0, "cacheReadTokens": 0,
        "totalTokens": 0, "totalCost": 0,
        "modelsUsed": ["..."], "modelBreakdowns": []
      }
    ],
    "totals": { "inputTokens": 0, "outputTokens": 0, "totalTokens": 0, "totalCost": 0 }
  }
  ```
- **monthly** (`ccusage monthly --json`): 위와 유사하되 항목 키가 `month`("YYYY-MM"),
  최상위 배열 키/요약 키가 버전에 따라 다를 수 있음(`monthly`/`data`, `totals`/`summary`).
  실제 출력을 확인해 매핑하세요.

### 상태 처리
다음 상태를 UI에 반드시 명확히 표시합니다:
- **SSH 연결 실패** → 데이터 영역을 "연결 안됨"으로 대체
- ccusage CLI 부재(설치 안 됨) → SETUP 안내/`npx` 폴백
- 실행 실패 / JSON 파싱 실패
- 특정 프로바이더 데이터 없음(빈 결과) → 해당 셀 "없음"
- 정상 + 마지막 갱신 시각

## 위젯 동작 (Widget Behavior)

- `BrowserWindow` 속성: `frame: false`, `transparent: true`, `alwaysOnTop: true`,
  `skipTaskbar: true`, `resizable`(필요 시).
- **드래그 이동**: 헤더바 등 이동 영역에 CSS `-webkit-app-region: drag`, 버튼 등
  상호작용 요소엔 `-webkit-app-region: no-drag`.
- **컨트롤 버튼**: ✕(종료), ─(최소화=**접기**: 헤더바만 남김), □(최대화=**상세 확장**),
  +(호스트 등록), ◀▶(호스트 전환). 자세한 동작은 `UI_SPEC.md`.
- **위치/크기·접힘/확장·선택 호스트 영속화**: `electron-store`에 저장, 시작 시 복원.
- (선택) **트레이 아이콘**: 표시/숨김 토글, 수동 새로고침, 종료 메뉴 제공.

## 디렉토리 구조 (Directory Structure)

electron-vite 표준 레이아웃을 따릅니다:

```
src/
  main/        # 메인 프로세스: 윈도우, SSH/원격 ccusage 실행, 호스트 관리, 폴링, IPC
    ssh/       #   ssh2 연결·원격 명령 실행 래퍼
    hosts/     #   호스트 목록 저장/관리, 자격증명 보안 저장
    usage/     #   ccusage 호출·JSON 파싱·정규화
  preload/     # contextBridge로 노출하는 안전한 API
  renderer/    # React 앱 (components, hooks, styles)
electron.vite.config.ts
electron-builder.yml   # (패키징 설정)
package.json
docs/          # 기능 명세: SETUP_SPEC / CONNECTION_SPEC / DATA_SPEC / UI_SPEC
```

## 개발 / 빌드 명령 (Dev / Build Commands)

> 아래 스크립트는 권장안입니다. 실제 `package.json` 생성 시 확정·동기화하세요.

- `npm run dev` — electron-vite 개발 서버 (HMR)
- `npm run build` — 프로덕션 번들 빌드
- `npm run build:mac` / `npm run build:win` / `npm run build:linux` — 플랫폼별 패키징

## 컨벤션 (Conventions)

- **TypeScript strict** 유지.
- **IPC 채널 네이밍**: `<도메인>:<액션>` 형식. 예) `usage:update`, `usage:refresh`,
  `host:add`, `host:list`, `host:test`, `host:switch`, `host:remove`, `host:status`,
  `widget:minimize`, `widget:maximize`, `widget:close`.
- **SSH·ccusage 접근은 무조건 main 프로세스 경유.** 렌더러/preload에서 직접 실행 금지.
- **자격증명은 평문 저장 금지** — 보안 저장소/`safeStorage` 사용. store에는 비민감 메타만.
- **새 IPC는 preload 화이트리스트에만 추가.** 그 외 경로로 Node 기능을 노출하지 않음.
- 렌더러는 preload가 노출한 `window.*` API만 사용.

## 크로스플랫폼 주의사항 (Cross-platform Notes)

위젯이 **실행되는 로컬 OS**와 **SSH로 접속하는 원격 OS**를 구분해 고려합니다.

**로컬(위젯 표시):**
- **macOS**: 투명/vibrancy 효과, 트레이 동작 확인. 패키징 시 서명/공증 고려.
- **Windows**: `skipTaskbar`로 작업표시줄 숨김 동작 확인.
- **Linux**: 투명 창은 합성기(compositor) 의존. 일부 환경에서 투명/always-on-top 제한.

**원격(데이터 조회 대상):**
- 원격 OS(macOS/Ubuntu/Windows)별로 OS 감지 명령(`uname`/`ver`)과 의존성 설치 명령이
  다름 — `SETUP_SPEC.md`의 OS별 설치 매핑 참조.
