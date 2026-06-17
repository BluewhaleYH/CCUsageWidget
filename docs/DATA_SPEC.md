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
- ccusage 20.x는 **에이전트별 어댑터마다 JSON 구조가 다르다**(Rust 소스 확인). 방어적 파싱 필수:

| 에이전트 | 비용 키 | 모델 표현 | 토큰 특이사항 |
|---------|--------|----------|--------------|
| claude | `totalCost` | `modelsUsed`(문자열 배열) + `modelBreakdowns[].modelName` | 표준 |
| gemini(opencode) | `totalCost` | `modelsUsed`(문자열 배열) | 표준 |
| codex | `costUSD` | **`models` 객체 맵** `{"gpt-5-codex":{…}}` (키=모델명) | `inputTokens`=비캐시 입력, `cacheReadTokens`=캐시 입력, `reasoningOutputTokens` 별도(출력에 합산) |

> ⚠️ codex는 `modelsUsed`/`modelBreakdowns`가 없고 `models` **객체 맵**으로만 모델을 준다.
> 파서는 `modelsUsed`(배열) / `models`(맵·배열) / `modelBreakdowns`를 **모두** 보고 모델을 추출한다.

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

### 2.3 30초 폴링 (전 호스트 백그라운드)
- 메인 프로세스에서 `setInterval` 30초 주기로 **등록된 모든 호스트를 병렬 조회**한다.
  → 렌더러가 hostId별 grid 맵을 유지하므로 좌/우 전환 시 **재요청 없이 즉시** 표시(전환 버벅임 제거).
- 호스트별 SSH 연결은 캐시 재사용. 한 호스트의 실패/지연이 다른 호스트를 막지 않음(독립 처리).
- 매 사이클에서 SSH 연결 성공 여부로 CONNECTION_SPEC의 `lastStatus`도 함께 갱신(통합).
- 호스트 추가/수동 새로고침 시 즉시 1회 조회(`usage:refresh`). **전환은 폴링을 트리거하지 않음**(데이터 이미 보유).
- 첫 조회 전까지만 `loading`을 푸시하고, 이후 갱신은 기존 셀 유지(깜빡임 방지).

### 2.3.1 종합(합산) 가상 호스트
- 등록 호스트가 **2개 이상**이면 캐러셀 맨 앞에 **종합(가상)** 패널을 추가한다(id `__aggregate__`, 별칭 `종합`).
- 데이터는 나머지 호스트들의 grid를 **(프로바이더×기간) 셀 단위로 합산**: 비용·토큰은 present 셀 합, 모델은 합집합.
  어느 호스트든 데이터가 있으면 present, 전부 없으면 "없음". (렌더러에서 계산 — 메인 추가 폴링 없음)
- 종합 패널은 의존성 점검 칩 미표시, 로그 영역은 전 호스트 활동을 시간순 병합해 보여준다.

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
- **월간 한도 대비 %**: 월간 행의 비용은 `$비용 / NN%`로 표시(NN = 비용/월간한도). 한도는 **에이전트별 티어**로 결정.
  - 티어 한도 = `T1기준액 + 오프셋`. T1: claude 20·codex 6·gemini 14. 오프셋: T1 0 / T2H 13 / T2 26 / T3H 18 / T3 36 / T4H 223 / T4 446.
  - 티어는 **열 헤더의 드롭다운**으로 에이전트별 선택. **호스트별 + 종합('__aggregate__')별**로 `electron-store`(`tiers`)에 영속.
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
