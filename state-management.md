# State Management

이 문서는 Zustand 기반 상태 관리 구조와 Electron 환경에서의 상태 동기화 전략을 설명합니다.

## 왜 Zustand를 선택했는가

Zustand는 Electron Renderer 환경에서 실시간으로 변경되는 앱 사용 시간 상태를 관리하기에 적합합니다. 사용 시간은 1초 단위로 자주 변경될 수 있으므로 상태 관리 도구는 가볍고 구독 단위가 명확해야 합니다.

Zustand는 boilerplate가 적고 TypeScript 타입 정의가 단순합니다. 또한 selector 기반 구독이 가능해 특정 컴포넌트가 필요한 상태만 구독하도록 만들 수 있습니다.

## Context API 대신 Zustand를 선택한 이유

Context API는 Provider의 value가 변경되면 하위 컴포넌트가 넓게 영향을 받을 수 있습니다. 사용 시간처럼 자주 바뀌는 데이터를 Context로 관리하면 대시보드 전체가 불필요하게 다시 렌더링될 가능성이 높습니다.

Zustand는 store 외부 action과 selector를 통해 상태 변경 범위를 좁힐 수 있습니다. 예를 들어 특정 앱 타이머 컴포넌트는 전체 `usageTimes`가 아니라 해당 `appId`의 사용 시간만 구독할 수 있습니다.

## store 구조

예상 store 구조는 다음과 같습니다.

```ts
{
  trackedApps: [],
  usageTimes: {},
  settings: {},
  notifications: []
}
```

TypeScript 기준으로는 다음과 같은 형태를 권장합니다.

```ts
type UsageStore = {
  trackedApps: TrackedApp[];
  usageTimes: Record<string, Record<string, number>>;
  settings: {
    trackingIntervalMs: number;
    notificationEnabled: boolean;
  };
  notifications: NotificationHistory[];

  addTrackedApp: (app: TrackedApp) => void;
  updateLimit: (appId: string, limitMinutes: number) => void;
  applyUsageUpdate: (payload: UsageUpdatePayload) => void;
  addNotification: (payload: NotificationHistory) => void;
  resetDailyUsage: (date: string) => void;
};
```

## 상태 분리 이유

`trackedApps`는 사용자가 관리하는 설정성 데이터이고, `usageTimes`는 Main Process에서 발생하는 실시간 데이터입니다. `settings`는 앱 전체 동작 정책이며, `notifications`는 제한 시간 초과 이벤트의 이력입니다.

이 상태들을 분리하면 특정 기능 수정이 다른 상태에 영향을 주는 일을 줄일 수 있습니다. 예를 들어 알림 히스토리 정책을 변경해도 시간 누적 로직은 그대로 유지할 수 있습니다.

## persist 여부

localStorage에 persist할 상태는 다음과 같습니다.

- `trackedApps`
- `usageTimes`
- `settings`
- `notifications`

반대로 UI에서만 사용하는 임시 상태는 persist하지 않습니다.

- 모달 열림 여부
- 현재 선택된 탭
- 입력 중인 폼 값
- 로딩 표시 상태

persist된 데이터는 앱 시작 시 복원되고, 복원 직후 `trackedApps`와 `settings`를 Main Process에 전달해 추적 기준을 동기화합니다.

## 상태 흐름

```txt
[Main Process]
usage:update 이벤트 생성
        |
        v
[IPC Listener]
Renderer에서 이벤트 수신
        |
        v
[Zustand Action]
applyUsageUpdate 실행
        |
        v
[Store State]
usageTimes 갱신
        |
        v
[React Selector]
필요한 컴포넌트만 재렌더링
        |
        v
[localStorage]
변경 상태 저장
```

## 실시간 업데이트 방식

Main Process는 매 추적 주기마다 변경된 앱의 사용 시간만 Renderer Process로 보냅니다. Renderer Process는 `applyUsageUpdate` action을 통해 기존 `usageTimes`에 변경분을 병합합니다.

전체 상태를 매번 교체하지 않고 변경된 `appId`와 `date`만 갱신하면 렌더링 비용과 localStorage 쓰기 비용을 줄일 수 있습니다.

## 상태 변경 시점

| 상태 | 변경 시점 |
| --- | --- |
| `trackedApps` | 사용자가 앱을 등록, 수정, 삭제할 때 |
| `usageTimes` | Main Process의 `usage:update` 이벤트를 수신할 때 |
| `settings` | 사용자가 추적 주기, 알림 설정, 제한 시간을 변경할 때 |
| `notifications` | Main Process의 `notification:sent` 이벤트를 수신할 때 |

날짜 변경은 Main Process의 tick 또는 Renderer 초기화 시점에서 감지합니다. 날짜가 바뀌면 새 날짜 키를 기준으로 사용 시간을 기록합니다.

## 렌더링 최적화 고려 사항

사용 시간은 자주 변경되므로 컴포넌트는 전체 store를 구독하지 않고 필요한 selector만 구독해야 합니다. 앱 목록 컴포넌트는 `trackedApps`만 구독하고, 특정 앱의 타이머 컴포넌트는 해당 `appId`의 사용 시간만 구독하는 방식이 적합합니다.

통계 계산은 렌더링마다 새로 수행하지 않고 memoization 또는 selector 함수로 분리합니다. localStorage 저장은 상태 변경마다 즉시 수행하기보다 persist middleware의 debounce 전략을 고려합니다.

## Electron 환경에서의 상태 관리 고려 사항

Renderer Process 상태는 창 새로고침이나 crash에 영향을 받을 수 있습니다. 따라서 Main Process의 추적 상태와 Renderer Process의 저장 상태를 시작 시 명확하게 동기화해야 합니다.

Main Process는 localStorage에 직접 접근하지 않습니다. 저장 책임은 Renderer Process에 두고, Main Process는 IPC를 통해 필요한 설정을 전달받는 구조를 유지합니다.

이 구조는 저장소를 SQLite로 이전할 때도 유리합니다. Renderer의 storage adapter만 교체하거나, 저장 책임을 Main Process로 옮기는 방식으로 점진적 변경이 가능합니다.
