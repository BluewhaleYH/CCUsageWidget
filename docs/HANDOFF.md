# HANDOFF — CCUsageWidget 세션 인수인계

> 다른 세션/작업자가 컨텍스트 없이 이어받기 위한 문서. 최종 갱신: Phase 0 완료 시점.

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
- ⏭️ **다음: Phase 1 (SETUP)** — 원격 의존성(node/npm/ccusage) 점검 → 안내 → y/n → 설치.
- 진행 체크리스트의 단일 출처: `docs/IMPLEMENTATION_TODO.md` (Phase 0 전부 `[x]`).

## 3. 기술 스택 / 핵심 결정
- Electron + electron-vite, React 18 + TypeScript(strict)
- 원격 접속: `ssh2` (Phase 2 도입 예정)
- 영속화: `electron-store` v8(CJS) — ESM 마찰 회피용. 자격증명은 평문 저장 금지(보안 저장소/safeStorage)
- 데이터: 프로바이더별 개별 호출(`ccusage [codex|gemini] daily/monthly --json`)
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
  ipc.ts     # registerIpc(): widget:* 동작 + usage:*/host:* stub(notImplemented)
  store.ts   # electron-store (StoreSchema: windowBounds — Phase 2에서 호스트 확장)
src/preload/
  index.ts   # contextBridge로 window.api 노출(usage/host/widget), WidgetApi 타입 export
  index.d.ts # 전역 Window.api 타입
src/renderer/
  index.html, src/main.tsx, src/App.tsx(플레이스홀더 위젯), src/App.css(투명·드래그)
electron.vite.config.ts, tsconfig*.json, electron-builder.yml, package.json
docs/        # SPEC 4종 + IMPLEMENTATION_TODO + HANDOFF(이 파일) + TEMP_SPEC
```

### 현재 IPC 채널 (Phase 0)
- 동작: `widget:minimize` `widget:maximize` `widget:close`
- stub(미구현, `{ok:false,error}` 반환): `usage:refresh`, `host:list|add|test|switch|remove`
- 푸시 예정: `usage:update`(메인→렌더러), `host:status`
- 규칙: ccusage/SSH 접근은 **메인 프로세스 경유만**, 새 IPC는 **preload 화이트리스트에만** 추가.

## 7. 다음 작업 (Phase 1 — SETUP) 착수 포인트
- 기준 문서: `docs/SETUP_SPEC.md`
- 핵심 흐름: 원격 호스트의 node/npm/ccusage 점검 → 누락 안내 → **y/n 입력** → y면 설치
  (OS별 설치 명령 매핑) → ccusage 없으면 `npx ccusage@latest` 폴백.
- 선행 의존: 원격 실행은 Phase 2(CONNECTION)의 SSH 래퍼가 필요 →
  Phase 1에서 점검 로직의 **인터페이스/계약**을 먼저 잡고, 실제 SSH 연동은 Phase 2와 맞물려 진행 권장.
  (또는 로컬 점검부터 구현 후 원격으로 확장)
- Phase 끝에 `docs/IMPLEMENTATION_TODO.md`의 🔍 **검수** 통과 필수.

## 8. Git 상태
- 브랜치: `main`, 원격: `https://github.com/BluewhaleYH/CCUsageWidget.git`
- 최신 커밋: `f14c76d feat: Phase 0 프로젝트 스캐폴딩 (electron-vite + React + TS)`
- 작업 흐름: 사용자가 "커밋/푸시" 요청 시에만 커밋. 커밋 메시지 한국어, 마지막 줄에
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## 9. 작업 관례
- 대화 언어: **한국어**. 문서 본문 한국어, 코드 식별자/명령어/경로는 영어.
- 각 Phase는 SPEC 기준 + Phase 경계 검수 필수.
- 구현이 SPEC과 어긋나면 **SPEC 먼저 갱신** 후 진행, 필요 시 CLAUDE.md 동기화.
- **TODO별 Git/Issue 워크플로우 준수** (CLAUDE.md의 "TODO 작업 워크플로우" 참조):
  브랜치 생성 → 이슈 등록 → 진행 중 특이사항/수정 코멘트 → 자체 검수 통과 →
  푸시 → 이슈 close + `main` merge → TODO 체크 갱신.
