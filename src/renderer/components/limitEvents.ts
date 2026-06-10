import type { BlockedAppHistory, NotificationHistory, TrackedApp } from '../../shared/types'
import { getNotificationDisplayName } from './notificationDisplay'

export type LimitEventFilter = 'all' | 'notification' | 'blocked'

export interface LimitEventItem {
  id: string
  appId: string
  appName: string
  date: string
  occurredAt: string
  kind: 'notification' | 'blocked'
}

function getBlockedAppDisplayName(blockedApp: BlockedAppHistory, trackedApps: TrackedApp[]): string {
  if (blockedApp.appName?.trim()) {
    return blockedApp.appName
  }

  return trackedApps.find((app) => app.id === blockedApp.appId)?.name ?? blockedApp.appId
}

export function getLimitEvents(
  notifications: NotificationHistory[],
  blockedApps: BlockedAppHistory[],
  trackedApps: TrackedApp[]
): LimitEventItem[] {
  return [
    ...notifications.map((notification) => ({
      id: `notification:${notification.id}`,
      appId: notification.appId,
      appName: getNotificationDisplayName(notification, trackedApps),
      date: notification.date,
      occurredAt: notification.sentAt,
      kind: 'notification' as const
    })),
    ...blockedApps.map((blockedApp) => ({
      id: `blocked:${blockedApp.id}`,
      appId: blockedApp.appId,
      appName: getBlockedAppDisplayName(blockedApp, trackedApps),
      date: blockedApp.date,
      occurredAt: blockedApp.blockedAt,
      kind: 'blocked' as const
    }))
  ].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
}

export function filterLimitEvents(events: LimitEventItem[], filter: LimitEventFilter): LimitEventItem[] {
  if (filter === 'all') {
    return events
  }

  return events.filter((event) => event.kind === filter)
}

export function getLimitEventFilterLabel(filter: LimitEventFilter): string {
  if (filter === 'notification') {
    return '알림'
  }

  if (filter === 'blocked') {
    return '제한'
  }

  return '전체'
}

export function formatLimitEventTime(occurredAt: string): string {
  return new Date(occurredAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}
