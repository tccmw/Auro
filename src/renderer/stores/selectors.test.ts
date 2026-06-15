import { describe, expect, it } from 'vitest'
import type { NotificationHistory, TrackedApp, UsageTimes } from '../../shared/types'
import {
  formatDuration,
  getAiUsageInsight,
  getMonthDateKeys,
  getExceededAppCount,
  getRecentDateKeys,
  getSmartLimitRecommendations,
  getTodayNotificationCount,
  getTopUsedAppSummary,
  getTrackedAppUsageSummaries,
  getUsageRangeReport,
  getWeekDateKeys
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

  it('creates Monday-to-Sunday week date keys', () => {
    expect(getWeekDateKeys(new Date(2026, 5, 10))).toEqual([
      '2026-06-08',
      '2026-06-09',
      '2026-06-10',
      '2026-06-11',
      '2026-06-12',
      '2026-06-13',
      '2026-06-14'
    ])
  })

  it('creates month date keys for the selected local month', () => {
    const monthKeys = getMonthDateKeys(new Date(2026, 5, 10))

    expect(monthKeys[0]).toBe('2026-06-01')
    expect(monthKeys[monthKeys.length - 1]).toBe('2026-06-30')
    expect(monthKeys).toHaveLength(30)
  })

  it('creates recent date keys ending on the selected date', () => {
    expect(getRecentDateKeys('2026-06-10', 3)).toEqual([
      '2026-06-08',
      '2026-06-09',
      '2026-06-10'
    ])
  })

  it('aggregates usage across a date range by app and day', () => {
    const report = getUsageRangeReport(apps, usageTimes, ['2026-06-08', '2026-06-09'])

    expect(report).toMatchObject({
      startDate: '2026-06-08',
      endDate: '2026-06-09',
      totalUsageSeconds: 3900,
      activeAppCount: 2,
      dailyTotals: [
        { date: '2026-06-08', usageSeconds: 3900 },
        { date: '2026-06-09', usageSeconds: 0 }
      ]
    })
    expect(report.appSummaries).toMatchObject([
      {
        app: apps[1],
        usageSeconds: 2100,
        percentOfTotal: 54,
        averageDailySeconds: 1050
      },
      {
        app: apps[0],
        usageSeconds: 1800,
        percentOfTotal: 46,
        averageDailySeconds: 900
      }
    ])
  })

  it('recommends smart daily limits from recent active usage', () => {
    const recommendationUsage: UsageTimes = {
      '2026-06-08': {
        code: 1800,
        browser: 3600
      },
      '2026-06-09': {
        code: 1800,
        browser: 3600
      },
      '2026-06-10': {
        code: 1800,
        browser: 3600
      }
    }
    const recommendations = getSmartLimitRecommendations(apps, recommendationUsage, '2026-06-10')
    const codeRecommendation = recommendations.find((recommendation) => recommendation.app.id === 'code')
    const browserRecommendation = recommendations.find(
      (recommendation) => recommendation.app.id === 'browser'
    )

    expect(codeRecommendation).toMatchObject({
      currentLimitMinutes: 60,
      recommendedLimitMinutes: 35,
      direction: 'decrease',
      confidence: 'medium'
    })
    expect(browserRecommendation).toMatchObject({
      currentLimitMinutes: 30,
      recommendedLimitMinutes: 60,
      direction: 'increase',
      confidence: 'medium'
    })
  })

  it('returns a critical AI insight when a limit is exceeded', () => {
    expect(getAiUsageInsight(apps, usageTimes, '2026-06-08')).toMatchObject({
      tone: 'critical'
    })
  })
})
