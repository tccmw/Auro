import { describe, expect, it } from 'vitest'
import type { NotificationHistory, TrackedApp } from '../../shared/types'
import { getNotificationDisplayName } from './notificationDisplay'

const trackedApps: TrackedApp[] = [
  {
    id: 'chrome',
    name: 'Chrome',
    processName: 'chrome',
    dailyLimitMinutes: 60,
    notificationEnabled: true
  }
]

describe('notificationDisplay', () => {
  it('uses the notification app name snapshot first', () => {
    const notification: NotificationHistory = {
      id: 'chrome:2026-06-02',
      appId: 'chrome',
      appName: 'Chrome Snapshot',
      date: '2026-06-02',
      sentAt: '2026-06-02T01:00:00.000Z'
    }

    expect(getNotificationDisplayName(notification, trackedApps)).toBe('Chrome Snapshot')
  })

  it('falls back to the current tracked app name', () => {
    const notification: NotificationHistory = {
      id: 'chrome:2026-06-02',
      appId: 'chrome',
      date: '2026-06-02',
      sentAt: '2026-06-02T01:00:00.000Z'
    }

    expect(getNotificationDisplayName(notification, trackedApps)).toBe('Chrome')
  })

  it('falls back to the app id only when no name source exists', () => {
    const notification: NotificationHistory = {
      id: 'orphan:2026-06-02',
      appId: 'orphan',
      date: '2026-06-02',
      sentAt: '2026-06-02T01:00:00.000Z'
    }

    expect(getNotificationDisplayName(notification, trackedApps)).toBe('orphan')
  })
})
