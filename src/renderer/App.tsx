import { Bell, BellOff, CalendarDays, Gauge, Settings, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getLocalDateKey } from '../shared/date'
import type { TrackedApp } from '../shared/types'
import { AppForm } from './components/AppForm'
import { InstalledAppPicker } from './components/InstalledAppPicker'
import { TrackingStatusBar } from './components/TrackingStatusBar'
import { TrackedAppCard } from './components/TrackedAppCard'
import { UsageDashboard } from './components/UsageDashboard'
import {
  formatDuration,
  getTotalUsageSeconds,
  getTrackedAppUsageSummaries
} from './stores/selectors'
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

  const today = getLocalDateKey()
  const todayTotalUsage = getTotalUsageSeconds(usageTimes, today)
  const todaySummaries = useMemo(
    () => getTrackedAppUsageSummaries(trackedApps, usageTimes, today),
    [trackedApps, today, usageTimes]
  )
  const todayLabel = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <div>
            <h1>Auro</h1>
            <p>앱 사용 시간과 제한을 관리합니다.</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="date-chip">
            <CalendarDays size={16} />
            <span>{todayLabel}</span>
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
        </div>
      </header>

      <TrackingStatusBar status={trackingStatus} />

      {viewMode === 'dashboard' ? (
        <>
          <UsageDashboard
            trackedApps={trackedApps}
            usageTimes={usageTimes}
            notifications={notifications}
            onOpenSettings={() => setViewMode('settings')}
          />

          <section className="app-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">앱 목록</p>
                <h2>앱별 제한 현황</h2>
              </div>
              <span>{trackedApps.length}개 추적 중</span>
            </div>

            {trackedApps.length === 0 ? (
              <div className="empty-state">
                <div>
                  <strong>아직 추적 중인 앱이 없습니다.</strong>
                  <p>설정에서 설치된 앱을 선택하면 이 영역에 제한 카드가 표시됩니다.</p>
                </div>
                <button type="button" className="ghost-button" onClick={() => setViewMode('settings')}>
                  <SlidersHorizontal size={16} />
                  <span>앱 설정 열기</span>
                </button>
              </div>
            ) : (
              <div className="app-list">
                {trackedApps.map((app) => (
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
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="settings-layout">
          <div className="settings-primary">
            <div className="section-heading">
              <div>
                <p className="eyebrow">앱 등록</p>
                <h2>앱 등록 및 제한</h2>
              </div>
              <span>설치 앱 우선</span>
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
                  <div>
                    <p className="eyebrow">앱 수정</p>
                    <h2>{editingApp.name} 수정</h2>
                  </div>
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

          <aside className="settings-sidebar">
            <div className="settings-block">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">추적 설정</p>
                  <h2>전역 설정</h2>
                </div>
              </div>
              <div className="settings-controls">
                <label>
                  <span>추적 주기(ms)</span>
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
                <div>
                  <p className="eyebrow">오늘</p>
                  <h2>오늘 요약</h2>
                </div>
                <span>{formatDuration(todayTotalUsage)}</span>
              </div>
              <div className="settings-app-list">
                {todaySummaries.length === 0 ? (
                  <div className="empty-state compact">등록된 앱이 없습니다.</div>
                ) : (
                  todaySummaries.map((summary) => (
                    <button
                      type="button"
                      key={summary.app.id}
                      className="settings-app-row"
                      onClick={() => setEditingApp(summary.app)}
                    >
                      <span>
                        <strong>{summary.app.name}</strong>
                        <small>{formatDuration(summary.usageSeconds)}</small>
                      </span>
                      <span className="settings-row-meter">
                        <i style={{ width: `${summary.percentUsed}%` }} />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      )}
    </main>
  )
}
