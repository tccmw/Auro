import { DEFAULT_SETTINGS, sanitizeSettings } from '../../shared/defaults'
export {
  getDailyLimitSeconds,
  isAppLockedForDate,
  isLimitReached
} from '../../shared/usageLimits'
import { isLimitReached } from '../../shared/usageLimits'
import type {
  AppSettings,
  BlockedAppHistory,
  NotificationHistory,
  TrackedApp,
  UsageTimes
} from '../../shared/types'

export function getUsageSeconds(usageTimes: UsageTimes, date: string, appId: string): number {
  return usageTimes[date]?.[appId] ?? 0
}

export function setUsageSeconds(
  usageTimes: UsageTimes,
  date: string,
  appId: string,
  usageSeconds: number
): UsageTimes {
  return {
    ...usageTimes,
    [date]: {
      ...(usageTimes[date] ?? {}),
      [appId]: Math.max(0, Math.floor(usageSeconds))
    }
  }
}

export function incrementUsageSeconds(
  usageTimes: UsageTimes,
  date: string,
  appId: string,
  incrementSeconds: number
): { usageTimes: UsageTimes; usageSeconds: number } {
  const nextUsageSeconds = getUsageSeconds(usageTimes, date, appId) + Math.max(1, Math.floor(incrementSeconds))

  return {
    usageTimes: setUsageSeconds(usageTimes, date, appId, nextUsageSeconds),
    usageSeconds: nextUsageSeconds
  }
}

export function hasNotificationBeenSent(
  notifications: NotificationHistory[],
  appId: string,
  date: string
): boolean {
  return notifications.some((notification) => notification.appId === appId && notification.date === date)
}

export function hasBlockedAppBeenRecorded(
  blockedApps: BlockedAppHistory[],
  appId: string,
  date: string
): boolean {
  return blockedApps.some((blockedApp) => blockedApp.appId === appId && blockedApp.date === date)
}

export function shouldSendLimitNotification(input: {
  app: TrackedApp
  usageSeconds: number
  settings?: AppSettings
  notifications: NotificationHistory[]
  date: string
}): boolean {
  const settings = sanitizeSettings(input.settings ?? DEFAULT_SETTINGS)

  return (
    settings.notificationEnabled &&
    input.app.notificationEnabled &&
    isLimitReached(input.app, input.usageSeconds) &&
    !hasNotificationBeenSent(input.notifications, input.app.id, input.date)
  )
}

export function createNotificationHistory(app: TrackedApp, date: string, sentAt = new Date()): NotificationHistory {
  return {
    id: `${app.id}:${date}`,
    appId: app.id,
    appName: app.name,
    date,
    sentAt: sentAt.toISOString()
  }
}

export function createBlockedAppHistory(
  app: TrackedApp,
  date: string,
  usageSeconds: number,
  blockedAt = new Date()
): BlockedAppHistory {
  return {
    id: `blocked:${app.id}:${date}`,
    appId: app.id,
    appName: app.name,
    date,
    blockedAt: blockedAt.toISOString(),
    processName: app.processName,
    usageSeconds: Math.max(0, Math.floor(usageSeconds))
  }
}
