# Architecture

이 문서는 Electron + React + TypeScript 기반 생산성 앱의 시스템 구조를 설명합니다. 핵심 설계 기준은 UI와 백그라운드 추적 로직을 분리하고, IPC를 통해 필요한 데이터만 동기화하는 것입니다.

## 전체 시스템 구조

```txt
[Operating System]
Running Processes
        |
        v
[Main Process]
Process Tracking
Usage Timer
Notification
IPC Handlers
        |
        | IPC: usage:update, notification:sent
        v
[Renderer Process]
React UI
Zustand Store
localStorage Persist
        |
        v
[User]
Dashboard / Settings / Statistics
```

Electron 앱은 Main Process와 Renderer Process로 나뉩니다. Main Process는 운영체제와 가까운 작업을 처리하고, Renderer Process는 사용자 인터페이스와 화면 상태를 담당합니다.

## Main Process

Main Process는 앱의 백그라운드 로직을 담당합니다.

주요 책임은 다음과 같습니다.

- 실행 중인 앱 목록 조회
- 사용자가 등록한 앱이 실행 중인지 확인
- 앱별 사용 시간 누적
- 제한 시간 초과 여부 판단
- Electron Notification API를 통한 알림 표시
- Renderer Process와 IPC 통신

시간 추적 로직을 Main Process에 두는 이유는 Renderer 창이 최소화되거나 UI 렌더링이 지연되더라도 타이머가 안정적으로 동작해야 하기 때문입니다. 생산성 앱의 핵심 기능은 화면 표시가 아니라 백그라운드 추적이므로, UI 생명주기에 종속되지 않는 위치에 배치합니다.

## Renderer Process

Renderer Process는 React 기반 UI를 담당합니다.

주요 책임은 다음과 같습니다.

- 추적 앱 목록 표시
- 앱별 사용 시간 표시
- 제한 시간 설정 UI 제공
- 일간 사용 통계 표시
- Zustand store 관리
- localStorage 저장 및 복원
- 사용자 설정 변경 시 IPC로 Main Process에 전달

Renderer Process는 운영체제 프로세스를 직접 조회하지 않습니다. 시스템 접근 로직을 UI에서 분리하면 테스트하기 쉽고, OS별 프로세스 감지 방식이 바뀌더라도 UI 변경을 최소화할 수 있습니다.

## IPC 통신 흐름

```txt
[Renderer Process]
사용자 앱 등록 / 제한 시간 변경
        |
        | ipcRenderer.invoke("settings:update")
        v
[Main Process]
설정 반영
추적 대상 갱신
        |
        | webContents.send("usage:update")
        v
[Renderer Process]
Zustand store 업데이트
UI 실시간 반영
localStorage 저장
```

주요 IPC 채널은 다음과 같이 설계합니다.

| 채널 | 방향 | 목적 |
| --- | --- | --- |
| `settings:update` | Renderer -> Main | 추적 앱과 제한 시간 설정 전달 |
| `usage:update` | Main -> Renderer | 앱별 사용 시간 변경 사항 전달 |
| `notification:sent` | Main -> Renderer | 알림 발생 기록 전달 |
| `tracking:status` | Main -> Renderer | 추적 루프 상태 전달 |

IPC payload는 가능한 작게 유지합니다. 매 tick마다 전체 상태를 보내면 IPC 비용과 렌더링 비용이 커지므로, 변경된 `appId`, `date`, `usageSeconds` 중심으로 전달합니다.

## 앱 사용 시간 추적 흐름

```txt
[Interval Tick]
        |
        v
[Process Tracker]
현재 실행 중인 앱 조회
        |
        v
[Tracked Apps Matcher]
등록된 앱과 실행 프로세스 비교
        |
        v
[Usage Timer]
실행 중인 앱 사용 시간 +1초
        |
        v
[Limit Checker]
제한 시간 초과 여부 확인
        |
        v
[IPC Sync]
Renderer에 usage:update 전송
```

추적 주기는 기본적으로 1초 단위로 설계합니다. 이 값은 사용자의 체감 실시간성과 시스템 부하 사이의 균형점입니다. 프로세스 조회 비용이 큰 환경에서는 추적 주기를 늘리거나, 프로세스 목록 조회와 UI 업데이트 주기를 분리할 수 있습니다.

## 알림 시스템 흐름

```txt
[Usage Timer]
사용 시간 증가
        |
        v
[Limit Checker]
usageTime >= limitMinutes
        |
        v
[Notification Guard]
오늘 이미 알림을 보냈는지 확인
        |
        v
[Electron Notification]
데스크톱 알림 표시
        |
        v
[Renderer Sync]
notifications 상태 업데이트
```

알림은 제한 시간을 넘을 때마다 반복해서 표시하지 않습니다. 앱별, 날짜별로 알림 발송 여부를 기록해 중복 알림을 방지합니다.

현재 단계에서는 앱 강제 종료나 차단 기능을 수행하지 않습니다. 제한 시간 초과는 사용자에게 알려주는 이벤트로만 처리합니다.

## 데이터 저장 구조

초기 저장소는 localStorage를 사용합니다. localStorage는 Renderer Process에서 접근 가능하므로 Zustand persist middleware 또는 별도 storage adapter를 통해 상태를 저장합니다.

```ts
{
  trackedApps: [
    {
      id: "chrome",
      name: "Google Chrome",
      processName: "chrome.exe",
      dailyLimitMinutes: 120
    }
  ],
  usageTimes: {
    "2026-06-02": {
      "chrome": 3600
    }
  },
  settings: {
    trackingIntervalMs: 1000,
    notificationEnabled: true
  },
  notifications: [
    {
      appId: "chrome",
      date: "2026-06-02",
      sentAt: "2026-06-02T09:30:00+09:00"
    }
  ]
}
```

localStorage는 구현이 단순하지만 데이터량이 증가하면 조회와 마이그레이션이 어려워집니다. 따라서 저장소 접근은 컴포넌트 내부에서 직접 수행하지 않고 adapter로 분리해 SQLite 이전 가능성을 열어둡니다.

## 상태 흐름

```txt
[Main Process]
추적 결과 생성
        |
        v
[IPC Event]
usage:update
        |
        v
[Zustand Store]
usageTimes 갱신
notifications 갱신
        |
        v
[React Components]
Dashboard 재렌더링
통계 UI 갱신
        |
        v
[localStorage]
상태 persist
```

상태의 원천은 기능별로 구분합니다. 추적 이벤트의 원천은 Main Process이고, 화면 상태와 저장 상태의 원천은 Renderer Process의 Zustand store입니다.

## 백그라운드 로직

백그라운드 추적은 Electron 앱이 실행되는 동안 Main Process에서 유지됩니다. 창이 최소화되더라도 Main Process의 interval은 계속 동작해야 합니다.

성능을 위해 매 tick마다 전체 UI 상태를 보내지 않고, 변경된 앱 사용 시간만 전송하는 방식이 바람직합니다. 또한 오류가 발생하더라도 추적 루프 전체가 중단되지 않도록 프로세스 조회 실패와 알림 실패는 각각 독립적으로 처리합니다.

## 실시간 UI 동기화

Renderer Process는 IPC 이벤트를 수신해 Zustand action을 실행합니다. UI 컴포넌트는 전체 store를 구독하지 않고 필요한 selector만 구독합니다.

예를 들어 대시보드의 개별 앱 타이머는 특정 `appId`의 사용 시간만 구독합니다. 이렇게 하면 1초 단위 업데이트에서도 화면 전체가 불필요하게 다시 렌더링되는 일을 줄일 수 있습니다.
