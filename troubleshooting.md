# Troubleshooting

이 문서는 개발 및 운영 중 발생할 수 있는 대표적인 문제와 해결 방법을 정리합니다.

## Windows tasklist 인코딩 문제

### 원인

Windows 한국어 환경에서 `tasklist` 결과가 CP949 등 로컬 코드 페이지로 출력될 수 있습니다. UTF-8로 가정하고 파싱하면 프로세스 이름이나 CSV 컬럼이 깨져 앱 매칭이 실패할 수 있습니다.

### 해결 방법

`tasklist /fo csv /nh`처럼 파싱 가능한 형식을 사용하고, 필요하면 Buffer로 받은 뒤 `iconv-lite`로 명시적으로 디코딩합니다. 가능하다면 PowerShell `Get-Process` 또는 Node.js 프로세스 조회 라이브러리를 사용해 텍스트 인코딩 의존성을 줄입니다.

프로세스 감지 로직은 `processTracker` 같은 모듈에 격리하고, OS 명령어 실행 결과를 직접 UI에 전달하지 않습니다.

### 결과

프로세스 이름 비교가 안정적으로 동작하고, 한글 Windows 환경에서도 앱 감지 실패율이 줄어듭니다.

### 회고

OS 명령어 출력은 개발 환경과 사용자 환경이 다를 수 있습니다. 프로세스 감지 로직은 OS별 adapter로 분리하는 것이 유지보수에 유리합니다.

## Electron IPC 통신 지연

### 원인

Main Process가 매초 전체 상태를 Renderer Process로 전송하거나, Renderer Process가 수신할 때마다 큰 객체를 재계산하면 IPC 지연과 UI 렌더링 지연이 발생할 수 있습니다.

### 해결 방법

IPC payload는 변경된 `appId`, `date`, `usageSeconds`만 포함하도록 줄입니다. Renderer Process에서는 전체 store를 교체하지 않고 변경분만 병합합니다.

통계 계산은 selector 또는 memoization으로 분리하고, localStorage 저장은 debounce를 적용합니다.

### 결과

실시간 UI 업데이트는 유지하면서도 IPC 메시지 크기와 렌더링 비용이 줄어듭니다.

### 회고

실시간 기능에서는 “얼마나 자주 보내는가”보다 “무엇을 보내는가”가 중요합니다. Main Process와 Renderer Process 사이의 데이터 계약을 작게 유지해야 합니다.

## 상태 동기화 문제

### 원인

앱 시작 시 Renderer Process의 localStorage 복원이 끝나기 전에 Main Process가 추적을 시작하면 빈 설정으로 동작할 수 있습니다. 이 경우 등록 앱이 있는데도 사용 시간이 증가하지 않습니다.

### 해결 방법

Renderer 초기화 후 `settings:update` IPC를 호출해 복원된 `trackedApps`와 `settings`를 Main Process에 전달합니다.

Main Process는 초기 설정을 받기 전까지 추적 루프를 대기하거나 기본적으로 no-op 상태로 둡니다. 설정 수신 이후부터 프로세스 감지와 시간 누적을 시작합니다.

### 결과

앱 재시작 후에도 저장된 설정 기준으로 추적이 정상적으로 이어집니다.

### 회고

Electron 앱에서는 Main Process가 먼저 실행됩니다. 따라서 Renderer 상태 복원과 Main Process 초기화 순서를 명시적으로 설계해야 합니다.

## 앱 최소화 시 타이머 정지 문제

### 원인

타이머를 Renderer Process의 React 컴포넌트나 브라우저 timer에 의존하면 창 최소화, 비활성화, 렌더링 throttling에 영향을 받을 수 있습니다.

### 해결 방법

시간 추적 interval은 Main Process에서 실행합니다. Renderer Process는 Main Process가 보낸 결과를 표시만 합니다.

창이 최소화되어도 Main Process는 계속 실행되도록 하고, 필요하면 시스템 트레이 동작을 추가합니다.

### 결과

UI 상태와 관계없이 백그라운드 추적이 유지됩니다.

### 회고

데스크톱 생산성 앱의 핵심 로직은 UI 생명주기에 묶이면 안 됩니다. 사용자에게 보이는 화면과 실제 추적 로직은 분리해야 합니다.

## localStorage 저장 누락 문제

### 원인

사용 시간이 매초 갱신될 때 저장 타이밍이 겹치거나, 앱 종료 직전에 persist가 완료되지 않으면 일부 데이터가 저장되지 않을 수 있습니다. 또한 JSON 직렬화 오류나 용량 제한도 저장 누락의 원인이 됩니다.

### 해결 방법

Zustand persist를 사용하되, 저장 대상 상태를 명확히 제한합니다. 사용 시간 저장은 debounce를 적용하고, 앱 종료 또는 창 닫힘 이벤트에서 마지막 상태를 flush합니다.

저장 실패 시 로그를 남기고 사용자에게 데이터 저장 상태를 표시합니다. 장기적으로는 사용 통계와 알림 이력을 SQLite로 이전할 수 있도록 storage adapter를 유지합니다.

### 결과

앱 재시작 후 사용 시간과 설정 복원 안정성이 높아집니다.

### 회고

localStorage는 초기 구현에는 적합하지만 장기 통계 저장소로는 제한이 있습니다. 데이터가 늘어나면 SQLite로 이전할 수 있도록 저장소 접근 계층을 유지해야 합니다.
