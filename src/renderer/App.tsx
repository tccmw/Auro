import { Bell, BellOff, Gauge, Settings } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getLocalDateKey } from '../shared/date'
import type { TrackedApp } from '../shared/types'
import { AppForm } from './components/AppForm'
import { InstalledAppPicker } from './components/InstalledAppPicker'
import { TrackingStatusBar } from './components/TrackingStatusBar'
import { TrackedAppCard } from './components/TrackedAppCard'
import { UsageDashboard } from './components/UsageDashboard'
import { formatDuration, getTotalUsageSeconds } from './stores/selectors'
import { useUsageStore } from './stores/usageStore'

type ViewMode = 'dashboard' | 'settings'

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [editingApp, setEditingApp] = useState<TrackedApp | null>(null)

  const trackedApps = useUsageStore((state) => state.trackedApps)
  const usageTimes = useUsageStore((state) => state.usageTimes)
  const settings = useUsageStore((state) => state.settings)
  const notifications = useUsageStore((state) => state.notifications)
  const trackingStatus = useUsageStore((state) => state.trackingStatus)
  const addTrackedApp = useUsageStore((state) => state.addTrackedApp)
  const addTrackedApps = useUsageStore((state) => state.addTrackedApps)
  const updateTrackedApp = useUsageStore((state) => state.updateTrackedApp)
  const removeTrackedApp = useUsageStore((state) => state.removeTrackedApp)
  const updateSettings = useUsageStore((state) => state.updateSettings)

  const recentNotifications = useMemo(() => notifications.slice(0, 6), [notifications])
  const todayTotalUsage = getTotalUsageSeconds(usageTimes, getLocalDateKey())

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Limito</h1>
          <p>Windows 사용 시간 추적</p>
        </div>
        <div className="segmented-control" role="tablist" aria-label="화면 전환">
          <button
            type="button"
            className={viewMode === 'dashboard' ? 'active' : ''}
            onClick={() => setViewMode('dashboard')}
          >
            <Gauge size={17} />
            <span>대시보드</span>
          </button>
          <button
            type="button"
            className={viewMode === 'settings' ? 'active' : ''}
            onClick={() => setViewMode('settings')}
          >
            <Settings size={17} />
            <span>설정</span>
          </button>
        </div>
      </header>

      <TrackingStatusBar status={trackingStatus} />

      {viewMode === 'dashboard' ? (
        <>
          <UsageDashboard
            trackedApps={trackedApps}
            usageTimes={usageTimes}
            notifications={notifications}
          />
          <section className="content-grid">
            <div className="main-column">
              <div className="section-heading">
                <h2>앱별 현황</h2>
                <span>{trackedApps.length}개</span>
              </div>
              <div className="app-list">
                {trackedApps.length === 0 ? (
                  <div className="empty-state">등록된 앱이 없습니다.</div>
                ) : (
                  trackedApps.map((app) => (
                    <TrackedAppCard
                      key={app.id}
                      app={app}
                      usageTimes={usageTimes}
                      onEdit={(targetApp) => {
                        setEditingApp(targetApp)
                        setViewMode('settings')
                      }}
                      onRemove={removeTrackedApp}
                    />
                  ))
                )}
              </div>
            </div>
            <aside className="side-panel">
              <div className="section-heading">
                <h2>알림 이력</h2>
                <span>{recentNotifications.length}건</span>
              </div>
              <div className="notification-list">
                {recentNotifications.length === 0 ? (
                  <div className="empty-state compact">기록 없음</div>
                ) : (
                  recentNotifications.map((notification) => {
                    const app = trackedApps.find((item) => item.id === notification.appId)

                    return (
                      <div className="notification-item" key={notification.id}>
                        <strong>{app?.name ?? notification.appId}</strong>
                        <span>{notification.date}</span>
                        <time dateTime={notification.sentAt}>
                          {new Date(notification.sentAt).toLocaleTimeString('ko-KR')}
                        </time>
                      </div>
                    )
                  })
                )}
              </div>
            </aside>
          </section>
        </>
      ) : (
        <section className="settings-layout">
          <div className="settings-block">
            <div className="section-heading">
              <h2>앱 선택 등록</h2>
            </div>
            <InstalledAppPicker
              trackedApps={trackedApps}
              onAddApps={addTrackedApps}
              onRemoveApp={removeTrackedApp}
              onUpdateApp={updateTrackedApp}
            />

            {editingApp ? (
              <div className="advanced-manual open-panel">
                <div className="section-heading">
                  <h2>앱 수정</h2>
                </div>
                <AppForm
                  editingApp={editingApp}
                  onCancelEdit={() => setEditingApp(null)}
                  onCreate={(input) => addTrackedApp(input)}
                  onUpdate={(appId, input) => {
                    updateTrackedApp(appId, input)
                    setEditingApp(null)
                  }}
                />
              </div>
            ) : (
              <details className="advanced-manual">
                <summary>고급 수동 등록</summary>
                <AppForm
                  editingApp={null}
                  onCancelEdit={() => setEditingApp(null)}
                  onCreate={(input) => addTrackedApp(input)}
                  onUpdate={(appId, input) => {
                    updateTrackedApp(appId, input)
                    setEditingApp(null)
                  }}
                />
              </details>
            )}
          </div>

          <div className="settings-block">
            <div className="section-heading">
              <h2>전역 설정</h2>
            </div>
            <div className="settings-controls">
              <label>
                <span>추적 주기</span>
                <input
                  type="number"
                  min={500}
                  step={500}
                  value={settings.trackingIntervalMs}
                  onChange={(event) =>
                    updateSettings({ trackingIntervalMs: Number(event.target.value) })
                  }
                />
              </label>
              <button
                type="button"
                className={settings.notificationEnabled ? 'toggle-button active' : 'toggle-button'}
                title={settings.notificationEnabled ? '전체 알림 켜짐' : '전체 알림 꺼짐'}
                aria-pressed={settings.notificationEnabled}
                onClick={() => updateSettings({ notificationEnabled: !settings.notificationEnabled })}
              >
                {settings.notificationEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                <span>{settings.notificationEnabled ? '전체 알림 켜짐' : '전체 알림 꺼짐'}</span>
              </button>
            </div>
          </div>

          <div className="settings-block">
            <div className="section-heading">
              <h2>오늘 누적</h2>
              <span>{formatDuration(todayTotalUsage)}</span>
            </div>
            <div className="settings-app-list">
              {trackedApps.map((app) => (
                <button
                  type="button"
                  key={app.id}
                  className="settings-app-row"
                  onClick={() => setEditingApp(app)}
                >
                  <span>{app.name}</span>
                  <small>{app.processName}</small>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
