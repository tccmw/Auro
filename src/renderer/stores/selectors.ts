import { getLocalDateKey } from '../../shared/date'
import type { NotificationHistory, TrackedApp, UsageTimes } from '../../shared/types'

export interface AppUsageSummary {
  app: TrackedApp
  usageSeconds: number
  limitSeconds: number
  percentUsed: number
  sharePercent: number
  remainingSeconds: number
  limitReached: boolean
}

export function getUsageForDate(usageTimes: UsageTimes, date = getLocalDateKey()): Record<string, number> {
  return usageTimes[date] ?? {}
}

function createAppUsageSummary(app: TrackedApp, usageSeconds: number, totalUsageSeconds: number): AppUsageSummary {
  const limitSeconds = Math.max(1, app.dailyLimitMinutes * 60)
  const percentUsed = Math.min(100, Math.round((usageSeconds / limitSeconds) * 100))
  const sharePercent = totalUsageSeconds > 0 ? Math.round((usageSeconds / totalUsageSeconds) * 100) : 0

  return {
    app,
    usageSeconds,
    limitSeconds,
    percentUsed,
    sharePercent,
    remainingSeconds: Math.max(0, limitSeconds - usageSeconds),
    limitReached: usageSeconds >= limitSeconds
  }
}

export function getAppUsageSummary(
  app: TrackedApp,
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): AppUsageSummary {
  const usageForDate = getUsageForDate(usageTimes, date)
  const totalUsageSeconds = Object.values(usageForDate).reduce((total, seconds) => total + seconds, 0)

  return createAppUsageSummary(app, usageForDate[app.id] ?? 0, totalUsageSeconds)
}

export function getTrackedAppUsageSummaries(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): AppUsageSummary[] {
  const usageForDate = getUsageForDate(usageTimes, date)
  const totalUsageSeconds = trackedApps.reduce(
    (total, app) => total + (usageForDate[app.id] ?? 0),
    0
  )

  return trackedApps
    .map((app) => createAppUsageSummary(app, usageForDate[app.id] ?? 0, totalUsageSeconds))
    .sort((left, right) => {
      const usageDelta = right.usageSeconds - left.usageSeconds

      if (usageDelta !== 0) {
        return usageDelta
      }

      return left.app.name.localeCompare(right.app.name, 'ko-KR', { sensitivity: 'base' })
    })
}

export function getTopUsedAppSummary(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): AppUsageSummary | null {
  return getTrackedAppUsageSummaries(trackedApps, usageTimes, date)[0] ?? null
}

export function getTotalUsageSeconds(usageTimes: UsageTimes, date = getLocalDateKey()): number {
  return Object.values(getUsageForDate(usageTimes, date)).reduce((total, seconds) => total + seconds, 0)
}

export function getExceededAppCount(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): number {
  return getTrackedAppUsageSummaries(trackedApps, usageTimes, date).filter((summary) => summary.limitReached)
    .length
}

export function getTodayNotificationCount(
  notifications: NotificationHistory[],
  date = getLocalDateKey()
): number {
  return notifications.filter((notification) => notification.date === date).length
}

export function getLimitPressurePercent(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): number {
  if (trackedApps.length === 0) {
    return 0
  }

  const summaries = getTrackedAppUsageSummaries(trackedApps, usageTimes, date)
  const totalLimitSeconds = summaries.reduce((total, summary) => total + summary.limitSeconds, 0)
  const totalUsageSeconds = summaries.reduce((total, summary) => total + summary.usageSeconds, 0)

  return totalLimitSeconds > 0 ? Math.min(100, Math.round((totalUsageSeconds / totalLimitSeconds) * 100)) : 0
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }

  return `${remainingSeconds}s`
}
