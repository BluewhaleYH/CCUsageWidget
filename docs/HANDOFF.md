# HANDOFF — CCUsageWidget 인수인계

> 컨텍스트 없이 이어받기 위한 문서. **최종 갱신: v0.3.0 (2026-06-19)** — 사용자 배포 중, 안정화 단계.
> 초기 4-Phase 빌드(SETUP/CONNECTION/DATA/UI)는 모두 끝났고, 이후 실사용 피드백 기반으로
> v0.1 → v0.3 까지 반복 개선했다. 이 문서는 **현재 동작하는 제품 상태**를 기준으로 한다.

---

## 1. 한 줄 요약 / 현재 모습

**로컬 + SSH 원격 컴퓨터들**에서 `ccusage` CLI(claude/codex/gemini × daily/monthly)를 조회해
사용량·비용·**월간 한도 대비 %**를 보여주는 **Electron 크로스플랫폼 위젯**. **Windows 1순위.**

- **트레이 상주**: 시스템 트레이(윈도우=숨겨진 아이콘) 아이콘. 좌클릭 또는 핫키 `Ctrl/Cmd+Shift+U`로 표시/숨김.
- **항상 최상위**(전체화면 앱 위에도), **드래그 이동**, **리사이즈 가능**(최대 = 모니터 절반).
- **전 호스트 캐러셀**: 등록된 모든 컴퓨터를 가로로 깔고 ◀▶로 전환(현재 인덱스만 노출, 재요청 없이 즉시).
  호스트 2개 이상이면 맨 앞에 **종합(합산)** 가상 패널.
- **60초 백그라운드 폴링**(전 호스트). 하단 **활동 로그 영역**(전 호스트 통합, `Ctrl/Cmd+Shift+L` 토글).
- **에이전트별 티어**로 월간 한도 대비 % 표시. 우상단 `!` 버튼 hover로 한도표.

---

## 2. 실행 / 빌드 / 릴리스

```bash
npm run dev          # electron-vite 개발(HMR). 렌더러 변경은 즉시, 메인 변경은 재시작 필요
npm run typecheck    # tsc (node + web) — 커밋 전 필수
npm run build        # 프로덕션 번들
npm run build:mac|win|linux   # 로컬 패키징(보통은 CI 사용)
```

**릴리스(자동 CI)**: `v*` 태그를 push하면 `.github/workflows/release.yml`이 mac/win/linux를 빌드해
GitHub Release에 자산 첨부. 절차:
1. `chore/release-vX.Y.Z` 브랜치 → `npm version X.Y.Z --no-git-tag-version` → 커밋 → PR 머지
2. `main`에서 `git tag vX.Y.Z && git push origin vX.Y.Z`
3. CI 완료 확인(`gh run watch`), 자산 3종 확인.

> ⚠️ 워크플로우 파일(.yml) push엔 gh `workflow` 스코프 필요(`gh auth refresh -s workflow`).
> 무서명 빌드 — macOS dmg "손상됨"은 `xattr -cr <앱>` + `codesign --force --deep --sign - <앱>`,
> Windows는 SmartScreen "추가 정보→실행".

---

## 3. 아키텍처 (Electron 3-프로세스 — 보안 경계 절대 유지)

`contextIsolation:true / nodeIntegration:false / sandbox:true`. 모든 특권 작업은 main ↔ IPC.

### Main (`src/main/`)
- `index.ts` — BrowserWindow 생성(트레이/리사이즈/최상위/드래그), 앱 수명주기, 글로벌 핫키(U/L).
- `tray.ts` / `trayIcon.ts` — 시스템 트레이(메뉴=종료만). 아이콘은 base64 PNG 임베드(패키징 안전).
- `sizing.ts` — 창 크기 제약(최소~모니터 절반), 우측하단 기본 위치, **로그 영역 토글 시 창 높이 가감**.
- `store.ts` — electron-store 스키마(windowBounds, alwaysShow, logVisible, hosts, selectedHostId,
  setupReports, hostSecrets, **tiers**). 크기 상수.
- `ipc.ts` — 모든 IPC 핸들러(widget/setup/host/usage/tier). `logBus`로 활동 로그 push.
- `logBus.ts` — main 활동을 `log:entry`로 렌더러에 push(호스트 컨텍스트 포함).
- `runnerFactory.ts` — hostId→CommandRunner. `local`→LocalCommandRunner, 그 외→**SSH 러너 캐시**(연결 재사용).
- `shellPath.ts` — GUI/패키징 실행 시 로그인 셸 PATH 복구(`fixGuiPath`, `-lic`).
- `ssh/runner.ts` — ssh2 래퍼. **연결 직후 원격 로그인 PATH(`-lic`) 조회→명령에 프리픽스**(nvm/brew 검출),
  연결 드롭 시 자동 재연결, PATH 조회는 공유 Promise(병렬 경쟁 방지).
- `hosts/` — 호스트 CRUD(`repository`), 자격증명 safeStorage(`credentials`), 로컬 호스트(`local`), 별칭/연결테스트.
- `setup/` — OS 감지(`os`), 의존성 점검/설치(`dependencies`: INSTALL_COMMANDS·dedup·300s 타임아웃·onStep 훅), 캐시(`index`).
- `usage/` — `commands`(에이전트별 서브커맨드), `run`(ccusage→npx 폴백), `parse`(**에이전트별 JSON 차이 흡수**),
  `index`(6종 조회·종합), `poller`(전 호스트 60초 병렬 폴링).

### Preload (`src/preload/index.ts`)
- contextBridge 화이트리스트 `window.api`: `usage`, `log`, `tier`, `widget`, `setup`, `host`. **새 IPC는 여기에만**.

### Renderer (`src/renderer/src/`)
- `App.tsx` — 루트. grids 맵(hostId→grid), 통합 로그 버퍼, tiers, 캐러셀(viewIndex 순환), 종합 패널.
- `components/` — `Header`(호스트 컨트롤+`!`TierInfo+숨기기), `UsageGrid`(2×3, 티어 드롭다운, 월간 %),
  `StatusBar`(갱신시각·setup칩·로그토글), `LogPanel`, `TierInfo`, `HostFormModal`, `SetupPanel`.
- `lib/` — `aggregate`(종합 합산), `tier`(한도/%), `grid`/`host`/`format`/`layout` 순수 헬퍼.
  > `lib/view.ts`는 **사용 안 함**(접힘 뷰 폐기 잔재) — 정리 대상.

---

## 4. 데이터/도메인 핵심

### ccusage 호출 (에이전트별 JSON 구조가 다름 — `usage/parse.ts` 핵심)
- claude: `ccusage claude daily/monthly --json` — `modelsUsed`(배열)+`modelBreakdowns`, 비용 `totalCost`.
- gemini: `ccusage gemini …` — `modelsUsed`(배열), 비용 `totalCost`.
- codex: `ccusage codex …` — 모델이 **`models` 객체 맵**, 비용 `costUSD`, `reasoningOutputTokens`(출력에 합산).
- ccusage 20.x는 **네이티브 바이너리**(Rust). 미설치 시 `npx ccusage@latest` 폴백.

### 티어 한도 (`lib/tier.ts`) — 월간 cost 사용률 %
`limit = T1기준액 + 오프셋`. T1: claude $20·codex $6·gemini $14.
오프셋: T1 0 / T2H 13 / T2 26 / T3H 18 / T3 36 / T4H 223 / T4 446.
**Codex만 단독 한도 = 위 값의 1/2**(ChatGPT와 한도 반씩 공유, 여기선 Codex 사용량만 집계).
티어는 에이전트별·**호스트별 + 종합별**로 store(`tiers`)에 영속.

---

## 5. 주요 동작 결정 / 함정 (왜 이렇게 했나)

- **전 호스트 폴링**: 캐러셀이 모든 호스트 데이터를 미리 가져야 전환이 즉시 → 60초마다 전부 병렬 폴링(연결 캐시 재사용).
  느린 원격이 많으면 부하↑ (의도된 트레이드오프).
- **SSH PATH**: 원격 `ccusage`/`node` 미검출·버전 오검출의 원인은 비로그인 셸 PATH. `-lic`로 로그인+인터랙티브
  PATH를 받아 프리픽스. (nvm은 인터랙티브 rc에 설정되므로 `-i` 필수.)
- **의존성 설치**가 "안 되던" 주원인: **60초 타임아웃**이 `brew install node`를 죽임 → 300초로. + node/npm dedup,
  winget 약관 자동동의. 권한(EACCES)·sudo 비번·brew 부재는 자동 해결 불가 → **에러를 그대로 노출**(로그+SetupPanel).
- **로그 토글**: 숨기면 **창 높이를 로그 영역(97px)만큼 줄여** 데이터 영역 크기 유지(`sizing.setLogArea`), 최소높이 240↔143.
- **창 크기 잠금 제거됨**(과거): 콘텐츠 fit-lock → 사용자 리사이즈로 전환. 캐러셀 패널=뷰포트 100%, 칸=`1fr`.
- **선택 영속**: 호스트 선택은 렌더러 viewIndex(순환)로 관리. 종합은 가상(`__aggregate__`).

---

## 6. 알려진 한계 / 다음에 할 만한 것

- 의존성 설치: 원격 sudo(비번 필요)·Homebrew 미설치·전역 npm 권한은 미해결. 실패 메시지 보고 호스트별 대응 정교화 여지.
- 무서명 패키징(서명/공증 미적용) — 배포 시 OS 경고. 코드사이닝 도입 가능.
- "윈도우→우분투 느림" 추정만 함(미측정). 필요 시 ccusage 호출 타이밍 계측.
- `lib/view.ts` 등 죽은 코드 정리.
- 티어 한도 수치는 사용자가 제공한 값(하드코딩) — ccusage가 한도를 안 주므로 수동 유지.

---

## 7. 작업 워크플로우 (이 저장소 관례)

- **작업 단위 = 작은 변경 1개**. 변경마다 `브랜치 → 이슈 → 커밋/푸시 → PR → 머지` 1회. Phase/여러 변경을 묶지 않음.
- **커밋/PR 한국어**, 커밋 끝에 `Co-Authored-By: Claude …`.
- **머지하면 묻지 말고 바로 릴리스**(버전 범프+태그) — 사용자가 패키지로만 테스트 가능(기억된 선호).
- **검수**: typecheck + build 필수. 순수 로직은 esbuild 번들 + 모킹 스모크(.mjs)로 검증(sizing/parse/tier/aggregate 등).
- SPEC(`docs/*_SPEC.md`)과 어긋나면 **SPEC 먼저 갱신** 후 진행.
- 릴리스 페이지는 **마일스톤만 공개**(0.2.0, 0.3.0…), 패치 릴리스는 draft로 숨김(`gh release edit vX --draft`).

---

## 8. 빠른 좌표 (자주 만지는 곳)

| 하고 싶은 것 | 파일 |
|---|---|
| 새 IPC | `preload/index.ts`(화이트리스트) + `main/ipc.ts`(핸들러) |
| 표시 셀/그리드 | `renderer/components/UsageGrid.tsx`, `lib/grid.ts` |
| 종합 합산 | `renderer/lib/aggregate.ts` |
| 티어/한도/% | `renderer/lib/tier.ts`, `components/TierInfo.tsx` |
| ccusage 파싱 | `main/usage/parse.ts` (에이전트별 차이) |
| 폴링/로그 | `main/usage/poller.ts`, `main/logBus.ts` |
| 창 크기/위치/로그토글 | `main/sizing.ts`, `main/index.ts` |
| 의존성 점검/설치 | `main/setup/dependencies.ts`, `components/SetupPanel.tsx` |
| SSH/원격 PATH | `main/ssh/runner.ts`, `main/runnerFactory.ts` |
