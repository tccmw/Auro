import { describe, expect, it, vi } from 'vitest'
import type {
  NotificationHistory,
  TrackingStatusPayload,
  TrackedApp,
  UsageUpdatePayload
} from '../../shared/types'
import type { NotificationService } from '../notification/notifier'
import type { ProcessSnapshotProvider } from './processAdapter'
import { UsageTracker } from './usageTracker'

const trackedApp: TrackedApp = {
  id: 'chrome',
  name: 'Chrome',
  processName: 'chrome.exe',
  dailyLimitMinutes: 1,
  notificationEnabled: true
}

const testSettings = {
  trackingIntervalMs: 1000,
  notificationEnabled: true,
  launchAtLoginEnabled: false
}

function fixedNow(): Date {
  return new Date(2026, 5, 2, 9, 0, 0)
}

describe('UsageTracker', () => {
  it('emits usage updates when a tracked foreground process is active', async () => {
    const usageUpdates: UsageUpdatePayload[] = []
    const processProvider: ProcessSnapshotProvider = {
      getActiveProcessName: vi.fn().mockResolvedValue('chrome')
    }
    const notificationService: NotificationService = {
      sendLimitNotification: vi.fn()
    }

    const tracker = new UsageTracker({
      processProvider,
      notificationService,
      now: fixedNow,
      events: {
        emitUsageUpdate: (payload) => usageUpdates.push(payload),
        emitNotificationSent: vi.fn(),
        emitTrackingStatus: vi.fn()
      }
    })

    tracker.updateConfig({
      trackedApps: [trackedApp],
      settings: testSettings,
      usageTimes: {},
      notifications: []
    })

    await tracker.runOnce()

    expect(usageUpdates).toEqual([
      {
        appId: 'chrome',
        date: '2026-06-02',
        usageSeconds: 1
      }
    ])
  })

  it('does not emit usage updates when the foreground process is not tracked', async () => {
    const usageUpdates: UsageUpdatePayload[] = []
    const processProvider: ProcessSnapshotProvider = {
      getActiveProcessName: vi.fn().mockResolvedValue('notepad')
    }
    const notificationService: NotificationService = {
      sendLimitNotification: vi.fn()
    }

    const tracker = new UsageTracker({
      processProvider,
      notificationService,
      now: fixedNow,
      events: {
        emitUsageUpdate: (payload) => usageUpdates.push(payload),
        emitNotificationSent: vi.fn(),
        emitTrackingStatus: vi.fn()
      }
    })

    tracker.updateConfig({
      trackedApps: [trackedApp],
      settings: testSettings,
      usageTimes: {},
      notifications: []
    })

    await tracker.runOnce()

    expect(usageUpdates).toEqual([])
  })

  it('sends a limit notification once per app and date', async () => {
    const notifications: NotificationHistory[] = []
    const processProvider: ProcessSnapshotProvider = {
      getActiveProcessName: vi.fn().mockResolvedValue('chrome.exe')
    }
    const notificationService: NotificationService = {
      sendLimitNotification: vi.fn().mockResolvedValue(undefined)
    }

    const tracker = new UsageTracker({
      processProvider,
      notificationService,
      now: fixedNow,
      events: {
        emitUsageUpdate: vi.fn(),
        emitNotificationSent: (payload) => notifications.push(payload),
        emitTrackingStatus: vi.fn()
      }
    })

    tracker.updateConfig({
      trackedApps: [trackedApp],
      settings: testSettings,
      usageTimes: { '2026-06-02': { chrome: 59 } },
      notifications: []
    })

    await tracker.runOnce()
    await tracker.runOnce()

    expect(notificationService.sendLimitNotification).toHaveBeenCalledTimes(1)
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      id: 'chrome:2026-06-02',
      appId: 'chrome',
      appName: 'Chrome',
      date: '2026-06-02'
    })
  })

  it('reports process lookup errors without throwing', async () => {
    const statuses: TrackingStatusPayload[] = []
    const processProvider: ProcessSnapshotProvider = {
      getActiveProcessName: vi.fn().mockRejectedValue(new Error('process query failed'))
    }
    const notificationService: NotificationService = {
      sendLimitNotification: vi.fn()
    }

    const tracker = new UsageTracker({
      processProvider,
      notificationService,
      now: fixedNow,
      events: {
        emitUsageUpdate: vi.fn(),
        emitNotificationSent: vi.fn(),
        emitTrackingStatus: (payload) => statuses.push(payload)
      }
    })

    await tracker.runOnce()

    expect(statuses[statuses.length - 1]).toEqual({
      running: true,
      error: 'process query failed'
    })
  })
})
