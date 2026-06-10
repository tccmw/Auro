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

export interface AppRangeUsageSummary {
  app: TrackedApp
  usageSeconds: number
  percentOfTotal: number
  averageDailySeconds: number
}

export interface UsageDateTotal {
  date: string
  usageSeconds: number
}

export interface UsageRangeReport {
  dateKeys: string[]
  startDate: string
  endDate: string
  totalUsageSeconds: number
  activeAppCount: number
  appSummaries: AppRangeUsageSummary[]
  dailyTotals: UsageDateTotal[]
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

function createDateKeyRange(start: Date, end: Date): string[] {
  const dateKeys: string[] = []
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  while (current <= last) {
    dateKeys.push(getLocalDateKey(current))
    current.setDate(current.getDate() + 1)
  }

  return dateKeys
}

export function getWeekDateKeys(date = new Date()): string[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = start.getDay()
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1
  start.setDate(start.getDate() - daysFromMonday)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return createDateKeyRange(start, end)
}

export function getMonthDateKeys(date = new Date()): string[] {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)

  return createDateKeyRange(start, end)
}

export function getUsageRangeReport(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  dateKeys: string[]
): UsageRangeReport {
  const uniqueDateKeys = Array.from(new Set(dateKeys)).sort()
  const totalByApp = new Map<string, number>()
  const dailyTotals = uniqueDateKeys.map((date) => {
    const usageForDate = getUsageForDate(usageTimes, date)
    const usageSeconds = Object.values(usageForDate).reduce((total, seconds) => total + seconds, 0)

    for (const [appId, seconds] of Object.entries(usageForDate)) {
      totalByApp.set(appId, (totalByApp.get(appId) ?? 0) + seconds)
    }

    return { date, usageSeconds }
  })
  const totalUsageSeconds = dailyTotals.reduce((total, day) => total + day.usageSeconds, 0)
  const appSummaries = trackedApps
    .map((app) => {
      const usageSeconds = totalByApp.get(app.id) ?? 0

      return {
        app,
        usageSeconds,
        percentOfTotal:
          totalUsageSeconds > 0 ? Math.min(100, Math.round((usageSeconds / totalUsageSeconds) * 100)) : 0,
        averageDailySeconds:
          uniqueDateKeys.length > 0 ? Math.floor(usageSeconds / uniqueDateKeys.length) : 0
      }
    })
    .sort((left, right) => {
      const usageDelta = right.usageSeconds - left.usageSeconds

      if (usageDelta !== 0) {
        return usageDelta
      }

      return left.app.name.localeCompare(right.app.name, 'ko-KR', { sensitivity: 'base' })
    })

  return {
    dateKeys: uniqueDateKeys,
    startDate: uniqueDateKeys[0] ?? '',
    endDate: uniqueDateKeys[uniqueDateKeys.length - 1] ?? '',
    totalUsageSeconds,
    activeAppCount: appSummaries.filter((summary) => summary.usageSeconds > 0).length,
    appSummaries,
    dailyTotals
  }
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
