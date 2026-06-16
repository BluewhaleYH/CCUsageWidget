# DATA_SPEC — 데이터 조회 & 표시

> 선택된 원격 호스트에서 ccusage daily/monthly 데이터를 조회·정규화하고,
> 일일/월 × claude/codex/gemini 그리드로 표시하는 기능 명세.
> 관련 원본: `docs/TEMP_SPEC.md` L25(조회), L26-27(레이아웃·없음), L34(연결 안됨)

## 1. 개요 & 범위

현재 UI에 보이도록 선택된 호스트에서 ccusage를 실행해 사용량을 가져온다.
30초마다 갱신하며, 프로바이더(claude/codex/gemini)별로 데이터를 분리해 표시한다.
SSH 연결·호스트 선택은 `CONNECTION_SPEC.md`, 화면 배치는 `UI_SPEC.md` 참조.

> **데이터 출처(확정)**: **위젯이 실행되는 로컬 컴퓨터**는 내장 호스트(`local`)로 항상 제공되며
> 신규 실행 시 **기본 선택**된다(로컬 ccusage를 SSH 없이 직접 실행). 원격 컴퓨터는 그 옆에 등록되고
> ◀▶로 전환한다. 즉 선택 호스트가 `local`이면 로컬에서, 원격이면 SSH로 ccusage를 실행한다.
> (러너 추상화 `createRunnerForHost(hostId)` — `local`→LocalCommandRunner, 그 외→SshCommandRunner)

## 2. 구현 단계 (Implementation Steps)

### 2.1 ccusage 실행 (확정: 프로바이더별 개별 호출)
선택 호스트에서 아래 명령을 **각각** 실행한다. (daily·monthly × claude·codex·gemini = 6회)
선택 호스트가 내장 `local`이면 로컬에서 직접, 원격이면 SSH로 실행한다.

| 프로바이더 | daily | monthly |
|-----------|-------|---------|
| claude | `ccusage claude daily --json` | `ccusage claude monthly --json` |
| codex | `ccusage codex daily --json` | `ccusage codex monthly --json` |
| gemini | `ccusage gemini daily --json` | `ccusage gemini monthly --json` |

> ⚠️ 서브커맨드 없는 `ccusage daily`는 **전체 에이전트 집계**(claude 칸에 codex/gemini가 섞임). 반드시 프로바이더 서브커맨드(`claude`/`codex`/`gemini`)를 명시한다.

- ccusage 미설치 시 `npx ccusage@latest <args>` 폴백 (SETUP_SPEC 참조)
- 각 호출은 독립적으로 성공/실패 처리(한 프로바이더 실패가 전체를 막지 않음)
- 6회 호출은 가능한 한 묶어서(병렬/단일 SSH 세션 재사용) 부하·지연 최소화

### 2.2 JSON 파싱·정규화
- ccusage 버전에 따라 키가 다를 수 있어 **방어적 파싱**.
- 공통 모델로 정규화:

```ts
interface UsageCell {
  provider: 'claude' | 'codex' | 'gemini';
  period: 'daily' | 'monthly';
  present: boolean;            // 데이터 존재 여부 (false → "없음")
  cost: number;                // 총 비용(USD)
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number; // 캐시 생성 토큰
  cacheReadTokens: number;     // 캐시 읽기 토큰
  totalTokens: number;
  modelsUsed: string[];        // 사용 모델 목록
}
```
- daily는 "오늘"(가장 최근) 항목, monthly는 "이번 달"(가장 최근) 항목을 대표값으로 추출. 비어있으면 `present=false`.
- 비용 키는 버전/프로바이더에 따라 `totalCost`/`costUSD`(codex)/`cost` 중 하나 — 방어적으로 처리.
  항목 날짜 키는 `period`(실측). `modelsUsed`가 없으면 `modelBreakdowns[].modelName`에서 폴백.

### 2.3 30초 폴링
- 메인 프로세스에서 `setInterval` 30초 주기로 **현재 선택된 호스트**만 조회.(TEMP L25)
- 매 사이클에서 SSH 연결 성공 여부로 CONNECTION_SPEC의 `lastStatus`도 함께 갱신(통합).
- 호스트 전환 시 즉시 1회 조회 후 타이머 재정렬.
- 수동 새로고침 경로 제공(`usage:refresh`).

### 2.4 표시 레이아웃 모델
- **세로 분할**: 위 "일일 조회" / 아래 "월 조회" (TEMP L26)
- **가로 분할**: claude / codex / gemini (TEMP L27)
- 결과적으로 **2행 × 3열 그리드**:

```
            Claude        Codex         Gemini
 ┌────────┬────────────┬────────────┬────────────┐
 │        │  $135.90   │            │            │
 │ 일일   │  [모델칩]   │   없음      │   없음      │
 │        │  Input …   │            │            │
 │        │  … Total   │            │            │
 ├────────┼────────────┼────────────┼────────────┤
 │ 월     │   (동일)    │   없음      │   없음      │
 └────────┴────────────┴────────────┴────────────┘
```
- **레이아웃(확정)**: **2×3 그리드** — 행 = 기간(일일/월간), 열 = 프로바이더(Claude/Codex/Gemini, 대문자 라벨).
- **각 칸 표시(ccusage 전체 항목)**: 비용($) 메인 + **모델 칩**(여러 개면 줄바꿈, 에이전트 접두 제외 — 예: `opus-4-8`) +
  토큰 세부(Input / Output / Cache Create / Cache Read / **Total**). 콘텐츠 간 **넉넉한 세로 간격**.
- 토큰 수는 **K/M/B 축약**(우측 정렬·tabular-nums), **전체 숫자는 hover 툴팁**. 데이터 없으면 `없음`.
- 넘치면 데이터 영역 **세로 스크롤**(헤더 행 sticky).

### 2.5 상태별 표시
- **데이터 없음**(`present=false`): 해당 셀에 **"없음"** 표시 (TEMP L27)
- **연결 안됨**(SSH 실패): 그리드 전체(또는 데이터 영역)를 **"연결 안됨"** 으로 대체 (TEMP L34)
- **로딩/에러**: 조회 중·파싱 실패 상태 구분 표시
- **마지막 갱신 시각** 표시

### 2.6 IPC / 푸시
- `usage:update` — 정규화된 그리드 데이터(6셀) + 메타(호스트, 갱신시각, 연결상태)를 렌더러로 푸시
- `usage:refresh` — 수동 갱신 요청(렌더러 → 메인)

## 3. 완료 기준 (Checklist)
- [ ] 선택 호스트에서 6종(daily/monthly × 3 프로바이더) ccusage 호출
- [ ] 방어적 JSON 파싱 + 공통 모델 정규화
- [ ] 30초 폴링(현재 호스트), 전환 시 즉시 갱신, 수동 새로고침
- [ ] 2×3 그리드에 비용+토큰 표시
- [ ] 데이터 없음 "없음", 연결 실패 "연결 안됨", 로딩/에러/갱신시각 표시
- [ ] `usage:update` / `usage:refresh` IPC 동작

## 4. 연관 문서
- `CONNECTION_SPEC.md` — 호스트 선택·SSH·연결 상태(30초 통합)
- `SETUP_SPEC.md` — ccusage 존재/설치, npx 폴백
- `UI_SPEC.md` — 그리드·상태의 실제 화면 배치
