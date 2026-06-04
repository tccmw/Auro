import { describe, expect, it } from 'vitest'
import type { TrackedApp } from '../../shared/types'
import {
  hasNotificationBeenSent,
  incrementUsageSeconds,
  isLimitReached,
  shouldSendLimitNotification
} from './usageLogic'

const app: TrackedApp = {
  id: 'chrome',
  name: 'Chrome',
  processName: 'chrome.exe',
  dailyLimitMinutes: 1,
  notificationEnabled: true
}

describe('usageLogic', () => {
  it('increments usage by date and app', () => {
    const result = incrementUsageSeconds({}, '2026-06-02', 'chrome', 1)

    expect(result.usageSeconds).toBe(1)
    expect(result.usageTimes).toEqual({ '2026-06-02': { chrome: 1 } })
  })

  it('checks daily limits in seconds', () => {
    expect(isLimitReached(app, 59)).toBe(false)
    expect(isLimitReached(app, 60)).toBe(true)
  })

  it('guards duplicate notifications by app and date', () => {
    const notifications = [
      {
        id: 'chrome:2026-06-02',
        appId: 'chrome',
        date: '2026-06-02',
        sentAt: '2026-06-02T01:00:00.000Z'
      }
    ]

    expect(hasNotificationBeenSent(notifications, 'chrome', '2026-06-02')).toBe(true)
    expect(
      shouldSendLimitNotification({
        app,
        usageSeconds: 60,
        settings: { trackingIntervalMs: 1000, notificationEnabled: true },
        notifications,
        date: '2026-06-02'
      })
    ).toBe(false)
  })

  it('respects global and per-app notification toggles', () => {
    expect(
      shouldSendLimitNotification({
        app,
        usageSeconds: 60,
        settings: { trackingIntervalMs: 1000, notificationEnabled: false },
        notifications: [],
        date: '2026-06-02'
      })
    ).toBe(false)

    expect(
      shouldSendLimitNotification({
        app: { ...app, notificationEnabled: false },
        usageSeconds: 60,
        settings: { trackingIntervalMs: 1000, notificationEnabled: true },
        notifications: [],
        date: '2026-06-02'
      })
    ).toBe(false)
  })
})
