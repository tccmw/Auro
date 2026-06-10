import type { DateKey, TrackedApp, UsageTimes } from './types'

export function getDailyLimitSeconds(app: TrackedApp): number {
  if (app.dailyLimitMinutes <= 0) {
    return 0
  }

  return app.dailyLimitMinutes * 60
}

export function isLimitReached(app: TrackedApp, usageSeconds: number): boolean {
  const limitSeconds = getDailyLimitSeconds(app)

  return limitSeconds > 0 && usageSeconds >= limitSeconds
}

export function isAppLockedForDate(
  app: TrackedApp,
  usageTimes: UsageTimes,
  date: DateKey
): boolean {
  return isLimitReached(app, usageTimes[date]?.[app.id] ?? 0)
}
