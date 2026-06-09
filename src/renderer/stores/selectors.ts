import { getLocalDateKey } from '../../shared/date'
import type { NotificationHistory, TrackedApp, UsageTimes } from '../../shared/types'

export interface AppUsageSummary {
  app: TrackedApp
  usageSeconds: number
  limitSeconds: number
  percentUsed: number
  remainingSeconds: number
  overLimitSeconds: number
  limitReached: boolean
}

export function getUsageForDate(usageTimes: UsageTimes, date = getLocalDateKey()): Record<string, number> {
  return usageTimes[date] ?? {}
}

function createAppUsageSummary(app: TrackedApp, usageSeconds: number): AppUsageSummary {
  const limitSeconds = Math.max(1, app.dailyLimitMinutes * 60)
  const percentUsed = Math.min(100, Math.round((usageSeconds / limitSeconds) * 100))

  return {
    app,
    usageSeconds,
    limitSeconds,
    percentUsed,
    remainingSeconds: Math.max(0, limitSeconds - usageSeconds),
    overLimitSeconds: Math.max(0, usageSeconds - limitSeconds),
    limitReached: usageSeconds >= limitSeconds
  }
}

export function getAppUsageSummary(
  app: TrackedApp,
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): AppUsageSummary {
  const usageForDate = getUsageForDate(usageTimes, date)

  return createAppUsageSummary(app, usageForDate[app.id] ?? 0)
}

export function getTrackedAppUsageSummaries(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): AppUsageSummary[] {
  const usageForDate = getUsageForDate(usageTimes, date)

  return trackedApps
    .map((app) => createAppUsageSummary(app, usageForDate[app.id] ?? 0))
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
