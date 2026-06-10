import { describe, expect, it } from 'vitest'
import type { TrackedApp } from '../../shared/types'
import {
  createBlockedAppHistory,
  createNotificationHistory,
  hasBlockedAppBeenRecorded,
  hasNotificationBeenSent,
  incrementUsageSeconds,
  isAppLockedForDate,
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

  it('checks locked state by app, date, and usage', () => {
    expect(isAppLockedForDate(app, { '2026-06-02': { chrome: 60 } }, '2026-06-02')).toBe(true)
    expect(isAppLockedForDate(app, { '2026-06-02': { chrome: 60 } }, '2026-06-03')).toBe(false)
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

  it('creates notification history with an app name snapshot', () => {
    expect(createNotificationHistory(app, '2026-06-02', new Date('2026-06-02T01:00:00.000Z'))).toEqual({
      id: 'chrome:2026-06-02',
      appId: 'chrome',
      appName: 'Chrome',
      date: '2026-06-02',
      sentAt: '2026-06-02T01:00:00.000Z'
    })
  })

  it('creates block history and detects duplicate block records by app and date', () => {
    const blockedApp = createBlockedAppHistory(
      app,
      '2026-06-02',
      60,
      new Date('2026-06-02T01:00:00.000Z')
    )

    expect(blockedApp).toEqual({
      id: 'blocked:chrome:2026-06-02',
      appId: 'chrome',
      appName: 'Chrome',
      date: '2026-06-02',
      blockedAt: '2026-06-02T01:00:00.000Z',
      processName: 'chrome.exe',
      usageSeconds: 60
    })
    expect(hasBlockedAppBeenRecorded([blockedApp], 'chrome', '2026-06-02')).toBe(true)
    expect(hasBlockedAppBeenRecorded([blockedApp], 'chrome', '2026-06-03')).toBe(false)
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
