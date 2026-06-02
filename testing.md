# Testing Strategy

이 문서는 데스크톱 생산성 앱의 테스트 전략을 정의합니다. 테스트는 Unit Test, Integration Test, E2E Test로 구분하며, 비즈니스 로직과 Electron 환경 의존 로직을 분리해서 검증합니다.

## Unit Test

## 테스트 대상

상태 변경 함수, 제한 시간 계산 함수, 날짜별 사용 시간 누적 함수, 알림 중복 방지 함수

### 목적

핵심 비즈니스 로직이 UI와 Electron 환경에 의존하지 않고 정확하게 동작하는지 검증합니다.

### 테스트 시나리오

- 앱 실행 감지 결과가 등록 앱과 정확히 매칭되는지 확인합니다.
- 시간 누적 함수가 같은 날짜와 `appId`에 사용 시간을 더하는지 확인합니다.
- 날짜가 변경되면 새로운 날짜 키에 사용 시간이 기록되는지 확인합니다.
- 제한 시간 초과 여부가 `usageSeconds >= limitMinutes * 60` 기준으로 계산되는지 확인합니다.
- 이미 알림을 보낸 앱은 같은 날짜에 다시 알림 대상이 되지 않는지 확인합니다.
- localStorage에 저장할 상태에서 임시 UI 상태가 제외되는지 확인합니다.

### 기대 결과

각 함수는 동일한 입력에 대해 예측 가능한 결과를 반환합니다. 날짜, 앱 ID, 제한 시간 조건이 바뀌어도 기존 상태를 불필요하게 변경하지 않습니다.

### 실패 케이스

- 사용 시간이 다른 날짜에 누적됩니다.
- 제한 시간과 초 단위 변환이 어긋납니다.
- 알림 중복 방지 로직이 `appId`만 보고 날짜를 고려하지 않습니다.
- 손상된 저장 데이터가 복원 시 앱을 중단시킵니다.

### 비고

Unit Test는 Jest 또는 Vitest로 구성하고, Electron API는 mock 처리합니다. 순수 함수로 분리된 로직이 많을수록 테스트 비용이 낮아집니다.

## Integration Test

## 테스트 대상

Main Process 추적 루프, IPC handler, Zustand store, localStorage adapter

### 목적

Main Process에서 생성된 추적 이벤트가 Renderer Process 상태와 localStorage에 올바르게 반영되는지 검증합니다.

### 테스트 시나리오

- `tasklist` 또는 프로세스 조회 mock 결과에 등록 앱이 포함되면 `usage:update` 이벤트가 발생합니다.
- Renderer가 `usage:update`를 수신하면 Zustand store의 `usageTimes`가 갱신됩니다.
- 제한 시간을 초과하면 `notification:sent` 이벤트가 한 번만 발생합니다.
- 앱 시작 시 localStorage에서 복원된 `trackedApps`가 Main Process로 전달됩니다.
- 날짜 변경 시 이전 날짜 데이터는 유지되고 새 날짜 데이터가 생성됩니다.
- localStorage 저장 실패 시 사용자 상태가 메모리상에서 유지됩니다.

### 기대 결과

IPC 이벤트 흐름이 끊기지 않고, Main Process와 Renderer Process의 설정 기준이 일치합니다. 사용자가 등록한 앱과 제한 시간 설정이 백그라운드 추적 루프에 정확히 반영되어야 합니다.

### 실패 케이스

- Renderer 복원 전에 Main Process가 빈 설정으로 추적을 시작합니다.
- IPC 이벤트가 너무 자주 발생해 UI가 지연됩니다.
- localStorage 저장 실패가 전체 추적 중단으로 이어집니다.
- 알림 이력이 저장되지 않아 앱 재시작 후 중복 알림이 발생합니다.

### 비고

Integration Test에서는 Electron IPC를 직접 띄우기보다 thin wrapper를 만들고 mock event bus로 검증하는 방식이 유지보수에 유리합니다.

## E2E Test

## 테스트 대상

사용자 기준 전체 앱 흐름

### 목적

실제 사용자가 앱을 등록하고 제한 시간을 설정한 뒤, 사용 시간 증가와 알림 표시까지 확인할 수 있는지 검증합니다.

### 테스트 시나리오

- 사용자가 앱을 등록하면 대시보드에 등록 앱이 표시됩니다.
- 테스트용 프로세스가 실행 중일 때 사용 시간이 증가합니다.
- 제한 시간을 짧게 설정하면 제한 시간 초과 알림이 표시됩니다.
- 앱을 재시작해도 등록 앱과 사용 시간이 복원됩니다.
- 날짜 변경 조건을 mock 처리하면 새 날짜 통계가 분리되어 표시됩니다.
- 앱 창을 최소화해도 Main Process의 타이머가 계속 동작합니다.

### 기대 결과

사용자는 별도 조작 없이 실시간 사용 시간 변화를 확인할 수 있고, 제한 시간 초과 시 OS 알림을 받습니다. 앱 재시작 후에도 주요 데이터는 유지됩니다.

### 실패 케이스

- 최소화 상태에서 타이머가 멈춥니다.
- 알림 권한 문제를 UI에서 확인할 수 없습니다.
- 앱 재시작 후 설정이 초기화됩니다.
- 사용 시간이 UI에는 표시되지만 localStorage에는 저장되지 않습니다.

### 비고

E2E Test는 Playwright 기반 Electron 테스트를 고려합니다. OS 알림은 환경 의존성이 크므로 실제 알림 호출 여부와 알림 기록 저장 여부를 분리해서 검증합니다.

## 필수 테스트 시나리오 매핑

| 시나리오 | 권장 테스트 레벨 | 검증 포인트 |
| --- | --- | --- |
| 앱 실행 감지 테스트 | Unit / Integration | 프로세스 목록과 `trackedApps` 매칭 |
| 시간 누적 테스트 | Unit / Integration | tick 단위 사용 시간 증가 |
| 날짜 변경 테스트 | Unit / E2E | 날짜별 `usageTimes` 분리 |
| 제한 시간 초과 테스트 | Unit / Integration | 제한 시간 계산과 알림 조건 |
| 알림 표시 테스트 | Integration / E2E | Electron Notification 호출과 이력 저장 |
| 상태 저장 테스트 | Integration / E2E | localStorage persist와 앱 재시작 복원 |
