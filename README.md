# Desktop App Usage Tracker

Electron + React + TypeScript 기반의 데스크톱 생산성 관리 앱입니다. 사용자가 등록한 데스크톱 앱의 실행 상태를 감지하고, 앱별 사용 시간을 일간 단위로 누적하며, 사용자가 설정한 제한 시간을 초과하면 데스크톱 알림을 제공합니다.

현재 버전의 목표는 앱 사용을 강제로 차단하는 것이 아니라, 사용자가 자신의 사용 패턴을 실시간으로 인지하고 스스로 조절할 수 있도록 돕는 것입니다.

## 프로젝트 목적

이 프로젝트는 단순 타이머 앱이 아니라 운영체제에서 실행 중인 프로세스 정보를 기반으로 실제 앱 사용 시간을 추적하는 데 목적이 있습니다.

Electron의 Main Process는 백그라운드에서 프로세스 감지와 시간 누적을 담당하고, React 기반 Renderer Process는 사용 시간, 제한 시간, 통계 정보를 사용자에게 실시간으로 보여줍니다. 이 구조는 UI와 시스템 로직을 분리해 유지보수를 쉽게 만들고, 향후 SQLite 저장소, 주간 리포트, 앱 차단 기능으로 확장할 수 있는 기반을 제공합니다.

## 핵심 기능

- 실행 중인 데스크톱 앱 감지
- 사용자가 추적할 앱 등록
- 앱별 일간 사용 시간 누적
- 앱별 제한 시간 설정
- 제한 시간 초과 시 데스크톱 알림 표시
- 일간 사용 통계 제공
- Zustand 기반 상태 관리
- localStorage 기반 데이터 저장
- Electron IPC를 통한 Main Process와 Renderer Process 간 상태 동기화

## 기술 스택

| 기술 | 사용 이유 |
| --- | --- |
| Electron | 데스크톱 환경의 프로세스 조회, 알림, 백그라운드 실행을 지원하기 위해 사용 |
| React | 사용 시간, 설정, 통계 화면을 컴포넌트 기반으로 구성하기 위해 사용 |
| TypeScript | IPC payload, store 상태, 앱 설정 구조를 명확하게 관리하기 위해 사용 |
| Zustand | 실시간으로 자주 변경되는 사용 시간 상태를 가볍고 예측 가능하게 관리하기 위해 사용 |
| Node.js | Main Process에서 OS 프로세스 조회와 백그라운드 로직을 실행하기 위해 사용 |
| localStorage | 초기 MVP 단계에서 별도 DB 없이 설정과 일간 사용 데이터를 저장하기 위해 사용 |
| Electron IPC | Main Process의 추적 결과를 Renderer Process에 전달하고 설정 변경을 반영하기 위해 사용 |

## 설치 방법

```bash
npm install
```

## 실행 방법

```bash
npm run dev
```

개발 환경에서는 Electron Main Process와 React 개발 서버가 함께 실행됩니다. 운영 빌드에서는 Renderer 번들을 Electron 창에서 로드합니다.

```bash
npm run build
npm run electron
```

## 폴더 구조

```txt
src/
  main/
    index.ts              # Electron Main Process 진입점
    tracking/
      processTracker.ts   # 실행 중인 앱 감지
      usageTimer.ts       # 앱별 사용 시간 누적
    notification/
      notifier.ts         # 데스크톱 알림 처리
    ipc/
      ipcHandlers.ts      # Renderer와 통신하는 IPC 핸들러

  renderer/
    main.tsx              # React 진입점
    App.tsx
    stores/
      usageStore.ts       # Zustand 상태 관리
    components/
      AppList.tsx
      UsageDashboard.tsx
      LimitSettings.tsx
    pages/
      DashboardPage.tsx
      SettingsPage.tsx
    storage/
      localStorageAdapter.ts

  shared/
    types/
      app.ts              # trackedApps, usageTimes, settings 타입
      ipc.ts              # IPC payload 타입
```

## 주요 설계 포인트

### Main Process와 Renderer Process 책임 분리

Main Process는 운영체제와 가까운 로직을 담당합니다. 실행 중인 앱 감지, 시간 누적, 알림 발송 같은 백그라운드 로직은 UI 렌더링과 분리되어야 안정적으로 동작합니다.

Renderer Process는 사용자가 보는 화면과 상태 표현을 담당합니다. Main Process에서 받은 추적 결과를 Zustand store에 반영하고, 변경된 상태를 UI에 실시간으로 렌더링합니다.

### IPC 기반 상태 동기화

사용 시간 추적 결과는 Main Process에서 생성되고 Renderer Process로 전달됩니다. 사용자가 제한 시간을 수정하거나 추적 앱을 등록하면 Renderer Process가 IPC로 Main Process에 설정 변경을 전달합니다.

이 흐름은 “시스템 이벤트는 Main Process에서 생성하고, UI 상태는 Renderer Process에서 표현한다”는 기준을 유지하기 때문에 역할 경계가 명확하고 유지보수가 쉽습니다.

### localStorage 중심 저장 전략

초기 단계에서는 localStorage를 사용해 `trackedApps`, `usageTimes`, `settings`, `notifications`를 저장합니다. 별도 DB 설정이 필요 없고, MVP 기능 검증에 적합합니다.

다만 localStorage는 대량 통계 조회나 장기 데이터 분석에는 한계가 있으므로, 향후 SQLite로 이전할 수 있도록 저장소 접근은 `localStorageAdapter` 같은 어댑터로 분리합니다.

### 실시간 업데이트와 성능 고려

사용 시간은 1초 단위로 갱신될 수 있으므로 전체 상태를 매번 다시 계산하거나 저장하지 않습니다. Main Process는 변경된 앱 사용 시간만 IPC로 전달하고, Renderer Process는 Zustand selector를 통해 필요한 컴포넌트만 다시 렌더링합니다.

localStorage 저장은 상태 변경마다 즉시 수행하기보다 debounce 또는 persist middleware를 사용해 저장 빈도를 제어하는 것이 좋습니다.

## 향후 개선 방향

- SQLite 기반 장기 사용 통계 저장
- 주간/월간 리포트 제공
- 앱 카테고리별 사용 시간 분석
- OS별 프로세스 감지 모듈 분리
- 제한 시간 초과 시 집중 모드 전환
- 시스템 트레이 백그라운드 실행
- 앱 강제 종료 또는 차단 기능
- 알림 히스토리와 리포트 내보내기
