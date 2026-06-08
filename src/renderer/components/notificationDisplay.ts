import type { NotificationHistory, TrackedApp } from '../../shared/types'

export function getNotificationDisplayName(
  notification: NotificationHistory,
  trackedApps: TrackedApp[]
): string {
  if (notification.appName?.trim()) {
    return notification.appName
  }

  return trackedApps.find((app) => app.id === notification.appId)?.name ?? notification.appId
}
