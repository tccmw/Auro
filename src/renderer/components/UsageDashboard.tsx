import { AlertTriangle, Bell, Clock, ListChecks, Plus, Target } from 'lucide-react'
import type { CSSProperties } from 'react'
import { getLocalDateKey } from '../../shared/date'
import type { NotificationHistory, TrackedApp, UsageTimes } from '../../shared/types'
import {
  formatDuration,
  getExceededAppCount,
  getLimitPressurePercent,
  getTodayNotificationCount,
  getTotalUsageSeconds,
  getTrackedAppUsageSummaries
} from '../stores/selectors'
import { getNotificationDisplayName } from './notificationDisplay'

interface UsageDashboardProps {
  trackedApps: TrackedApp[]
  usageTimes: UsageTimes
  notifications: NotificationHistory[]
  onOpenSettings: () => void
}

function formatNotificationTime(sentAt: string): string {
  return new Date(sentAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function AppAvatar({ app, large = false }: { app: TrackedApp; large?: boolean }) {
  return (
    <span className={large ? 'app-avatar large' : 'app-avatar'}>
      {app.iconDataUrl ? <img src={app.iconDataUrl} alt={`${app.name} icon`} /> : app.name.slice(0, 1)}
    </span>
  )
}

export function UsageDashboard({
  trackedApps,
  usageTimes,
  notifications,
  onOpenSettings
}: UsageDashboardProps) {
  const today = getLocalDateKey()
  const summaries = getTrackedAppUsageSummaries(trackedApps, usageTimes, today)
  const topSummary = summaries.find((summary) => summary.usageSeconds > 0) ?? summaries[0] ?? null
  const totalUsageSeconds = getTotalUsageSeconds(usageTimes, today)
  const exceededCount = getExceededAppCount(trackedApps, usageTimes, today)
  const todayNotifications = getTodayNotificationCount(notifications, today)
  const limitPressure = getLimitPressurePercent(trackedApps, usageTimes, today)
  const activeAppCount = summaries.filter((summary) => summary.usageSeconds > 0).length
  const recentNotifications = notifications.slice(0, 5)

  const metrics = [
    {
      label: '오늘 총 사용',
      value: formatDuration(totalUsageSeconds),
      hint: activeAppCount > 0 ? `${activeAppCount}개 앱 사용` : '기록 없음',
      icon: Clock
    },
    {
      label: '추적 앱',
      value: `${trackedApps.length}개`,
      hint: trackedApps.length > 0 ? '제한 적용 중' : '추가 필요',
      icon: ListChecks
    },
    {
      label: '제한 사용률',
      value: `${limitPressure}%`,
      hint: exceededCount > 0 ? `${exceededCount}개 초과` : '정상 범위',
      icon: Target
    },
    {
      label: '오늘 알림',
      value: `${todayNotifications}건`,
      hint: todayNotifications > 0 ? '확인 필요' : '알림 없음',
      icon: Bell
    }
  ]

  return (
    <section className="dashboard-stack">
      <div className="metric-grid" aria-label="오늘 요약">
        {metrics.map((metric) => {
          const Icon = metric.icon

          return (
            <article className="metric-card" key={metric.label}>
              <span className="metric-icon">
                <Icon size={19} />
              </span>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.hint}</small>
            </article>
          )
        })}
      </div>

      <div className="focus-layout">
        <section className="focus-panel focus-overview">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">요약</p>
              <h2>오늘 사용 현황</h2>
            </div>
            <span className="panel-note">실시간 집계</span>
          </div>

          {trackedApps.length === 0 ? (
            <div className="empty-state feature-empty">
              <div>
                <strong>추적할 앱을 추가하세요.</strong>
                <p>설치된 앱을 선택하면 사용량, 제한 진행률, 알림 상태가 이 화면에 표시됩니다.</p>
              </div>
              <button type="button" className="primary-button" onClick={onOpenSettings}>
                <Plus size={16} />
                <span>앱 추가</span>
              </button>
            </div>
          ) : (
            <>
              <div className="focus-summary">
                <div className="top-app-block">
                  {topSummary && <AppAvatar app={topSummary.app} large />}
                  <div>
                    <span>가장 많이 사용한 앱</span>
                    <strong>{topSummary ? topSummary.app.name : '기록 없음'}</strong>
                    <p>
                      {topSummary
                        ? `${formatDuration(topSummary.usageSeconds)} 사용 · 제한의 ${topSummary.percentUsed}%`
                        : '오늘 기록된 사용량이 없습니다.'}
                    </p>
                  </div>
                </div>

                <div
                  className="pressure-ring"
                  style={{ '--ring-progress': `${limitPressure * 3.6}deg` } as CSSProperties}
                  aria-label={`제한 사용률 ${limitPressure}%`}
                >
                  <strong>{limitPressure}%</strong>
                  <span>제한 사용률</span>
                </div>
              </div>

              <div className="usage-share-list" aria-label="앱별 사용 비율">
                {summaries.slice(0, 6).map((summary) => (
                  <div className="usage-share-row" key={summary.app.id}>
                    <AppAvatar app={summary.app} />
                    <div className="usage-share-body">
                      <div>
                        <strong>{summary.app.name}</strong>
                        <span>{formatDuration(summary.usageSeconds)}</span>
                      </div>
                      <div className="progress-track slim">
                        <div
                          className={summary.limitReached ? 'progress-fill alert' : 'progress-fill'}
                          style={{
                            width: `${summary.usageSeconds > 0 ? Math.max(summary.sharePercent, 3) : 0}%`
                          }}
                        />
                      </div>
                    </div>
                    <span className={summary.limitReached ? 'status-chip alert' : 'status-chip'}>
                      {summary.limitReached ? '초과' : `${summary.sharePercent}%`}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="focus-panel alerts-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">알림</p>
              <h2>최근 제한 알림</h2>
            </div>
            <span className="panel-note">{recentNotifications.length}건</span>
          </div>

          {recentNotifications.length === 0 ? (
            <div className="empty-state compact">
              <AlertTriangle size={17} />
              <span>아직 제한 알림이 없습니다.</span>
            </div>
          ) : (
            <div className="notification-list">
              {recentNotifications.map((notification) => (
                <div className="notification-item" key={notification.id}>
                  <span className="notification-dot" />
                  <div>
                    <strong>{getNotificationDisplayName(notification, trackedApps)}</strong>
                    <span>{notification.date}</span>
                  </div>
                  <time dateTime={notification.sentAt}>{formatNotificationTime(notification.sentAt)}</time>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
