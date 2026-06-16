# CONNECTION_SPEC — 원격 연결 & IP 관리

> SSH로 원격 컴퓨터를 등록·전환·테스트하고, OS별 별칭을 관리하는 기능 명세.
> 관련 원본: `docs/TEMP_SPEC.md` L10(SSH 테스트), L18(IP 등록), L19(IP 전환), L33(별칭), L34(연결 실패 감지)

## 1. 개요 & 범위

위젯은 여러 원격 컴퓨터를 등록해두고, 한 번에 하나의 호스트를 선택해 사용량을 조회한다.
이 문서는 **호스트 등록 / 연결 테스트 / 전환 / 별칭 / 연결 상태 모니터링**을 다룬다.
실제 ccusage 실행·표시는 `DATA_SPEC.md`, 버튼의 화면 동작은 `UI_SPEC.md` 참조.

모든 SSH 동작은 **메인 프로세스**에서만 수행한다. (렌더러는 IPC로 요청)

## 2. 호스트 데이터 모델

`electron-store`에 호스트 목록을 저장한다.

```ts
interface HostEntry {
  id: string;                 // 내부 식별자
  host: string;               // IP 또는 도메인
  port: number;               // 기본 22
  username: string;
  auth: SshAuth;              // 아래
  alias: string;              // 표시용 별칭
  os: 'macos' | 'ubuntu' | 'windows' | 'unknown';
  lastStatus: 'connected' | 'disconnected' | 'unknown';
  lastCheckedAt?: string;     // ISO timestamp
}

type SshAuth =
  | { method: 'key'; privateKeyPath: string; passphrase?: string }
  | { method: 'password'; /* 비밀번호 본문은 저장소에 평문 보관 금지 */ };
```

### 인증 정보 보안 (확정: 키 + 비밀번호 모두 지원)
- **SSH 키**: `privateKeyPath`만 store에 저장. passphrase는 OS 키체인에 보관.
- **비밀번호**: store에 평문 저장 금지. **OS 보안 저장소(macOS Keychain / Windows Credential
  Manager / libsecret)** 또는 Electron `safeStorage`로 암호화하여 보관.
- store에는 `auth.method`와 비민감 메타데이터만 둔다.

## 3. 구현 단계 (Implementation Steps)

### 3.1 SSH 라이브러리
- 메인 프로세스에서 `ssh2`(Node) 사용. 키/비밀번호 인증, 원격 명령 실행 지원.
- **원격 PATH 복구**: `ssh2`의 `exec`는 **비로그인 비대화형 셸**이라 원격 로그인
  PATH(Homebrew/nvm/npm 전역 bin)를 상속받지 못해 `node`/`ccusage`가 미검출된다.
  연결 직후 **로그인+인터랙티브 셸**로 PATH를 1회 조회
  (`${SHELL:-/bin/sh} -lic 'printf "__PS__%s__PE__" "$PATH"'`, 마커로 rc 부수 출력과 분리)해
  캐시하고, 이후 모든 명령을 `PATH='<원격PATH>':"$PATH" <command>`로 실행한다.
  > ⚠️ **인터랙티브(-i) 필수**: nvm은 `.zshrc`/`.bashrc`(인터랙티브 rc)에 설정되므로 `-l`만으로는
  > nvm이 로드되지 않아 시스템 node가 잡혀 **버전이 오검출**된다. 로컬 `fixGuiPath`와 동일하게 `-lic` 사용.

  조회 실패(Windows 등)면 프리픽스 없이 원본 실행(안전 폴백). 로컬 GUI의 `fixGuiPath`와 같은 개념.

### 3.2 IP 등록 플로우 (플러스 버튼)
1. UI에서 입력 폼 표시: host, port, username, 인증 방식(키 경로 또는 비밀번호), alias(선택)
2. 저장 전 **연결 테스트(3.3)** 를 먼저 수행
3. 성공 시: OS 자동 감지 결과로 alias 기본값 제안 → 사용자 확정 → `host:add`로 저장
4. 실패 시: 오류 사유 표시, 저장하지 않음
> 화면/버튼 동작은 `UI_SPEC.md`, 본 단계는 등록 로직.

### 3.3 연결 테스트
- SSH 접속 후 가벼운 명령으로 도달성 확인: Unix `uname -s`, Windows `ver`
- 결과로 **OS 자동 감지** → `os` 필드 설정
- 반환: 성공/실패 + 감지된 OS + 에러 메시지(실패 시)
- SETUP_SPEC의 의존성 점검(node/npm/ccusage)도 이 연결 위에서 수행 가능.

### 3.4 OS별 별칭 (Alias)
- OS 감지 결과로 기본 별칭 제안: `맥`, `우분투`, `윈도우` (+ host 일부)
- 사용자가 자유롭게 수정 가능. 별칭은 좌/우 전환 시 표시명으로 사용.

### 3.5 IP 전환 (좌/우 버튼)
- 등록된 호스트 목록을 **순환**(왼쪽=이전, 오른쪽=다음)
- 현재 선택된 호스트 id를 상태로 관리하고 저장(재시작 시 복원)
- 전환 시 DATA_SPEC의 데이터 조회 대상이 즉시 갱신됨
> 화면 동작은 `UI_SPEC.md`, 본 단계는 선택 상태 관리 로직.

### 3.6 연결 상태 모니터링 (확정: 30초, 데이터 조회와 통합)
- 별도 타이머를 두지 않고 **DATA_SPEC의 30초 폴링 사이클에 통합**한다.
- 매 조회 시 SSH 연결 성공 여부로 `lastStatus`(connected/disconnected) + `lastCheckedAt` 갱신
- 연결 실패 시 `lastStatus='disconnected'` → DATA 영역을 "연결 안됨"으로 대체 (DATA_SPEC 참조)

### 3.7 항목 수정/삭제
- 기존 호스트의 host/port/username/auth/alias 수정
- 호스트 삭제(삭제 시 현재 선택이었다면 다음 항목으로 전환 또는 빈 상태)

### 3.8 IPC 계약
- `host:add` — 등록(내부에서 연결 테스트 수행)
- `host:list` — 목록 조회(민감정보 제외)
- `host:test` — 연결 테스트 단독 실행
- `host:switch` — 현재 선택 호스트 변경(방향: prev/next 또는 id)
- `host:update` — 항목 수정
- `host:remove` — 항목 삭제
- (상태 푸시) `host:status` — lastStatus 변경 시 렌더러로 통지

## 4. 완료 기준 (Checklist)
- [ ] 호스트 등록(키/비밀번호) + 저장(민감정보는 보안 저장소)
- [ ] 연결 테스트 + OS 자동 감지
- [ ] OS별 별칭 기본값 제안 및 수정
- [ ] 좌/우 전환으로 현재 호스트 변경 및 상태 영속화
- [ ] 30초 사이클에서 연결 상태 갱신(connected/disconnected)
- [ ] 항목 수정/삭제
- [ ] IPC 채널 동작

## 5. 연관 문서
- `SETUP_SPEC.md` — 연결 위에서 수행하는 의존성 점검/설치
- `DATA_SPEC.md` — 30초 폴링·데이터 조회(연결 상태 통합), "연결 안됨" 표시
- `UI_SPEC.md` — 플러스/좌우 버튼의 화면 동작, 등록 폼 UI
