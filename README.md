# CCUsageWidget

**로컬 컴퓨터**와 **SSH로 등록한 여러 원격 컴퓨터**에서 [`ccusage`](https://ccusage.com) CLI의
`daily`/`monthly` 사용량을 조회해, **Claude Code·Codex·Gemini** 등 코딩 에이전트 CLI의
사용량·비용을 한눈에 보여주는 **Electron 크로스플랫폼 데스크톱 위젯**입니다.

- 프레임 없는 투명 always-on-top 위젯, 30초 자동 갱신
- **로컬 컴퓨터는 내장 `로컬` 호스트로 기본 표시** (SSH 없이 바로 조회)
- `+`로 원격 호스트(SSH) 등록, `◀▶`로 전환 — 현재 선택 호스트만 폴링
- 2×3 그리드(일일·월 × claude·codex·gemini), 비용($)+토큰, 접기/확장
- 의존성 점검/설치(node·npm·ccusage) 패널, ccusage 미설치 시 `npx ccusage@latest` 폴백

## 요구사항

- **위젯 실행(로컬)**: [Node.js](https://nodejs.org) 18+ 와 npm
- **사용량 조회 대상(로컬/원격)**: 해당 컴퓨터에 `node`·`npm`·`ccusage`
  (ccusage가 없으면 `npx ccusage@latest`로 폴백 — node/npm은 필요).
  앱의 **의존성 점검/설치 패널**에서 상태 확인·설치를 할 수 있습니다.

## 개발 실행

```bash
git clone https://github.com/BluewhaleYH/CCUsageWidget.git
cd CCUsageWidget
npm install        # electron 바이너리 자동 다운로드
npm run dev        # 위젯 창 표시 (HMR). 로컬 사용량이 기본 표시됨
```

기타 스크립트:

```bash
npm run build      # 프로덕션 번들(out/) — electron-vite
npm run typecheck  # 타입체크 (main + renderer)
```

## 빌드 / 패키징 (설치파일)

각 OS에서 해당 명령을 실행하면 설치파일이 `release/`에 생성됩니다.

| OS | 명령 | 산출물(`release/`) |
|----|------|--------------------|
| macOS | `npm run build:mac` | `*.dmg` |
| Windows | `npm run build:win` | `*.exe` (NSIS 설치파일) |
| Linux | `npm run build:linux` | `*.AppImage` |

산출물 파일명 예: `CCUsageWidget-0.0.1-mac-arm64.dmg`

> ⚠️ **크로스빌드는 권장하지 않습니다.** Windows 설치파일은 **Windows에서**, macOS는 macOS에서
> 빌드하세요(wine/도구 의존, 불안정). 멀티 OS 자동 빌드는 CI(GitHub Actions) 도입 시 한 번에
> 처리할 수 있습니다(현재 후순위).
>
> - 코드 서명/공증은 미설정(무서명 로컬 빌드). 배포 시 별도 인증서·공증 필요.
> - `ssh2`의 네이티브 `cpu-features`는 선택사항이라 빌드 도구가 없어도 순수 JS로 동작합니다.
>   (패키징 안정화를 위해 `npmRebuild: false`)

## 보안 / 아키텍처 (요약)

Electron 3-프로세스 모델. 보안 경계 고정: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`. SSH·ccusage 실행 등 모든 권한 작업은 **main 프로세스**에서, 렌더러는 preload가
노출한 `window.api`만 사용합니다.

## 문서

- [`docs/SETUP_SPEC.md`](docs/SETUP_SPEC.md) — 의존성 점검/설치
- [`docs/CONNECTION_SPEC.md`](docs/CONNECTION_SPEC.md) — SSH·호스트 관리
- [`docs/DATA_SPEC.md`](docs/DATA_SPEC.md) — 조회·표시(로컬/원격)
- [`docs/UI_SPEC.md`](docs/UI_SPEC.md) — 위젯 UI·윈도우
- [`docs/IMPLEMENTATION_TODO.md`](docs/IMPLEMENTATION_TODO.md) · [`docs/HANDOFF.md`](docs/HANDOFF.md)

## 라이선스

MIT
