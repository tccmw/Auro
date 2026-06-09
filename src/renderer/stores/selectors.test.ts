import { describe, expect, it } from 'vitest'
import type { NotificationHistory, TrackedApp, UsageTimes } from '../../shared/types'
import {
  formatDuration,
  getExceededAppCount,
  getTodayNotificationCount,
  getTopUsedAppSummary,
  getTrackedAppUsageSummaries
} from './selectors'

const apps: TrackedApp[] = [
  {
    id: 'code',
    name: 'VS Code',
    processName: 'Code.exe',
    dailyLimitMinutes: 60,
    notificationEnabled: true
  },
  {
    id: 'browser',
    name: 'Browser',
    processName: 'browser.exe',
    dailyLimitMinutes: 30,
    notificationEnabled: true
  }
]

const usageTimes: UsageTimes = {
  '2026-06-08': {
    code: 1800,
    browser: 2100
  }
}

describe('selectors', () => {
  it('sorts tracked app summaries and calculates limit state', () => {
    expect(getTrackedAppUsageSummaries(apps, usageTimes, '2026-06-08')).toMatchObject([
      {
        app: apps[1],
        usageSeconds: 2100,
        percentUsed: 100,
        remainingSeconds: 0,
        overLimitSeconds: 300,
        limitReached: true
      },
      {
        app: apps[0],
        usageSeconds: 1800,
        percentUsed: 50,
        remainingSeconds: 1800,
        overLimitSeconds: 0,
        limitReached: false
      }
    ])
  })

  it('recalculates remaining time when a daily limit changes', () => {
    const updatedApps: TrackedApp[] = [
      {
        ...apps[0],
        dailyLimitMinutes: 20
      }
    ]

    expect(getTrackedAppUsageSummaries(updatedApps, usageTimes, '2026-06-08')).toMatchObject([
      {
        app: updatedApps[0],
        usageSeconds: 1800,
        remainingSeconds: 0,
        overLimitSeconds: 600,
        limitReached: true
      }
    ])
  })

  it('returns the top used app summary', () => {
    expect(getTopUsedAppSummary(apps, usageTimes, '2026-06-08')?.app.id).toBe('browser')
  })

  it('calculates exceeded app count', () => {
    expect(getExceededAppCount(apps, usageTimes, '2026-06-08')).toBe(1)
  })

  it('counts notifications for the selected date', () => {
    const notifications: NotificationHistory[] = [
      { id: 'n1', appId: 'code', date: '2026-06-08', sentAt: '2026-06-08T01:00:00.000Z' },
      { id: 'n2', appId: 'code', date: '2026-06-07', sentAt: '2026-06-07T01:00:00.000Z' }
    ]

    expect(getTodayNotificationCount(notifications, '2026-06-08')).toBe(1)
  })

  it('formats durations for compact dashboard display', () => {
    expect(formatDuration(3720)).toBe('1h 2m')
    expect(formatDuration(75)).toBe('1m 15s')
    expect(formatDuration(7)).toBe('7s')
  })
})
