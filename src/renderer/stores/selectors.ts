import { getLocalDateKey } from '../../shared/date'
import type { TrackedApp, UsageTimes } from '../../shared/types'

export interface AppUsageSummary {
  app: TrackedApp
  usageSeconds: number
  limitSeconds: number
  percentUsed: number
  limitReached: boolean
}

export function getUsageForDate(usageTimes: UsageTimes, date = getLocalDateKey()): Record<string, number> {
  return usageTimes[date] ?? {}
}

export function getAppUsageSummary(
  app: TrackedApp,
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): AppUsageSummary {
  const usageSeconds = usageTimes[date]?.[app.id] ?? 0
  const limitSeconds = Math.max(1, app.dailyLimitMinutes * 60)
  const percentUsed = Math.min(100, Math.round((usageSeconds / limitSeconds) * 100))

  return {
    app,
    usageSeconds,
    limitSeconds,
    percentUsed,
    limitReached: usageSeconds >= limitSeconds
  }
}

export function getTotalUsageSeconds(usageTimes: UsageTimes, date = getLocalDateKey()): number {
  return Object.values(getUsageForDate(usageTimes, date)).reduce((total, seconds) => total + seconds, 0)
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`
  }

  if (minutes > 0) {
    return `${minutes}분 ${remainingSeconds}초`
  }

  return `${remainingSeconds}초`
}
