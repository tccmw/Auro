import { Activity, Bell, Clock, ListChecks } from 'lucide-react'
import { getLocalDateKey } from '../../shared/date'
import type { NotificationHistory, TrackedApp, UsageTimes } from '../../shared/types'
import { formatDuration, getAppUsageSummary, getTotalUsageSeconds } from '../stores/selectors'

interface UsageDashboardProps {
  trackedApps: TrackedApp[]
  usageTimes: UsageTimes
  notifications: NotificationHistory[]
}

export function UsageDashboard({
  trackedApps,
  usageTimes,
  notifications
}: UsageDashboardProps) {
  const today = getLocalDateKey()
  const totalUsageSeconds = getTotalUsageSeconds(usageTimes, today)
  const exceededCount = trackedApps.filter(
    (app) => getAppUsageSummary(app, usageTimes, today).limitReached
  ).length
  const todayNotifications = notifications.filter((notification) => notification.date === today).length

  return (
    <section className="dashboard-band">
      <div className="metric">
        <Clock size={20} />
        <span>오늘 총 사용</span>
        <strong>{formatDuration(totalUsageSeconds)}</strong>
      </div>
      <div className="metric">
        <ListChecks size={20} />
        <span>등록 앱</span>
        <strong>{trackedApps.length}개</strong>
      </div>
      <div className="metric">
        <Activity size={20} />
        <span>초과 앱</span>
        <strong>{exceededCount}개</strong>
      </div>
      <div className="metric">
        <Bell size={20} />
        <span>오늘 알림</span>
        <strong>{todayNotifications}건</strong>
      </div>
    </section>
  )
}
