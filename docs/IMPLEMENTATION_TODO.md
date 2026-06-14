# IMPLEMENTATION_TODO — CCUsageWidget 구현 체크리스트

> SPEC 문서(`SETUP_SPEC.md`, `CONNECTION_SPEC.md`, `DATA_SPEC.md`, `UI_SPEC.md`)를
> 바탕으로 한 **구현 순서 TODO**입니다. 위에서부터 순서대로 진행합니다.

## 사용 규칙
- 항목 완료 시 `- [ ]` → `- [x]`로 갱신합니다.
- **각 Phase 끝의 "🔍 검수" 항목을 통과하기 전에는 다음 Phase로 넘어가지 않습니다.**
- 구현 중 SPEC과 어긋나는 점을 발견하면 SPEC을 먼저 갱신한 뒤 진행합니다.

## 진행 상태 요약
- [x] Phase 0 — 프로젝트 스캐폴딩
- [ ] Phase 1 — SETUP (의존성 점검/설치)
- [ ] Phase 2 — CONNECTION (원격 연결·호스트 관리)
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
- [ ] 원격 호스트 대상 node/npm/ccusage 점검 로직(`command -v`, 버전)
- [ ] 점검 결과 모델 `{ name, installed, version? }` 수집
- [ ] 누락 항목 안내 UI(무엇이 없는지 + 설치 명령 표시)
- [ ] y/n 동의 입력 처리(y=설치, n=건너뜀·"미설치" 표시)
- [ ] OS별 설치 명령 매핑 테이블(mac/ubuntu/windows)로 설치 실행 + 진행/결과 표시
- [ ] ccusage 미설치 시 `npx ccusage@latest` 폴백
- [ ] 점검/설치 결과 캐싱 및 상태 표시
- [ ] 🔍 **검수**: SETUP_SPEC 완료 기준 충족, y/n→설치 흐름 동작, 폴백 동작 확인 → Phase 2 진행 승인

## Phase 2 — CONNECTION (원격 연결·호스트 관리) · `CONNECTION_SPEC.md`
- [ ] `HostEntry` 데이터 모델 정의 + `electron-store` 저장
- [ ] 자격증명 보안 저장(키 패스프레이즈/비밀번호 → 보안 저장소/`safeStorage`)
- [ ] `ssh2` 기반 SSH 연결·원격 명령 실행 래퍼(`src/main/ssh`)
- [ ] IP 등록 플로우(입력 폼 → 연결 테스트 → 저장) — 로직
- [ ] 연결 테스트(`uname`/`ver` 도달성) + OS 자동 감지
- [ ] OS별 별칭 기본값 제안 및 사용자 수정
- [ ] IP 전환(좌/우 순환) + 현재 선택 상태 영속화
- [ ] 항목 수정/삭제
- [ ] IPC: `host:add` `host:list` `host:test` `host:switch` `host:update` `host:remove` `host:status`
- [ ] 🔍 **검수**: 키/비밀번호 인증 연결, 등록/전환/별칭 동작, 자격증명 평문 미저장 확인 → Phase 3 진행 승인

## Phase 3 — DATA (조회·표시) · `DATA_SPEC.md`
- [ ] 선택 호스트에서 SSH로 ccusage 6종 호출(daily/monthly × claude/codex/gemini)
- [ ] 6종 호출 묶음 처리(병렬/세션 재사용) + 개별 성공·실패 처리
- [ ] 방어적 JSON 파싱 → 공통 `UsageCell` 모델 정규화
- [ ] 30초 폴링(현재 호스트), 호스트 전환 시 즉시 갱신, `usage:refresh` 수동 갱신
- [ ] 폴링 사이클에 연결 상태(`lastStatus`) 갱신 통합
- [ ] 2×3 그리드 데이터 구성(비용 + 토큰)
- [ ] 상태 처리: 데이터 없음 "없음", SSH 실패 "연결 안됨", 로딩/에러/갱신시각
- [ ] IPC: `usage:update`(푸시) / `usage:refresh`(요청)
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
