import { describe, expect, it, vi } from 'vitest'
import type {
  BlockedAppHistory,
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

function createNotificationService(): NotificationService {
  return {
    sendLimitNotification: vi.fn().mockResolvedValue(undefined),
    sendBlockNotification: vi.fn().mockResolvedValue(undefined)
  }
}

function createForegroundProcessProvider(processName: string) {
  return {
    getActiveProcessName: vi.fn().mockResolvedValue(processName),
    terminateProcessByName: vi.fn().mockResolvedValue(undefined)
  }
}

describe('UsageTracker', () => {
  it('emits usage updates when a tracked foreground process is active', async () => {
    const usageUpdates: UsageUpdatePayload[] = []
    const processProvider = createForegroundProcessProvider('chrome')
    const notificationService = createNotificationService()

    const tracker = new UsageTracker({
      processProvider,
      notificationService,
      now: fixedNow,
      events: {
        emitUsageUpdate: (payload) => usageUpdates.push(payload),
        emitNotificationSent: vi.fn(),
        emitAppBlocked: vi.fn(),
        emitTrackingStatus: vi.fn()
      }
    })

    tracker.updateConfig({
      trackedApps: [trackedApp],
      settings: testSettings,
      usageTimes: {},
      notifications: [],
      blockedApps: []
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
    const processProvider = createForegroundProcessProvider('notepad')
    const notificationService = createNotificationService()

    const tracker = new UsageTracker({
      processProvider,
      notificationService,
      now: fixedNow,
      events: {
        emitUsageUpdate: (payload) => usageUpdates.push(payload),
        emitNotificationSent: vi.fn(),
        emitAppBlocked: vi.fn(),
        emitTrackingStatus: vi.fn()
      }
    })

    tracker.updateConfig({
      trackedApps: [trackedApp],
      settings: testSettings,
      usageTimes: {},
      notifications: [],
      blockedApps: []
    })

    await tracker.runOnce()

    expect(usageUpdates).toEqual([])
  })

  it('sends a limit notification once per app and date', async () => {
    const notifications: NotificationHistory[] = []
    const processProvider = createForegroundProcessProvider('chrome.exe')
    const notificationService = createNotificationService()

    const tracker = new UsageTracker({
      processProvider,
      notificationService,
      now: fixedNow,
      events: {
        emitUsageUpdate: vi.fn(),
        emitNotificationSent: (payload) => notifications.push(payload),
        emitAppBlocked: vi.fn(),
        emitTrackingStatus: vi.fn()
      }
    })

    tracker.updateConfig({
      trackedApps: [trackedApp],
      settings: testSettings,
      usageTimes: { '2026-06-02': { chrome: 59 } },
      notifications: [],
      blockedApps: []
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

  it('terminates and records a block when an app reaches its limit', async () => {
    const usageUpdates: UsageUpdatePayload[] = []
    const blockedApps: BlockedAppHistory[] = []
    const processProvider = createForegroundProcessProvider('chrome.exe')
    const notificationService = createNotificationService()

    const tracker = new UsageTracker({
      processProvider,
      notificationService,
      now: fixedNow,
      events: {
        emitUsageUpdate: (payload) => usageUpdates.push(payload),
        emitNotificationSent: vi.fn(),
        emitAppBlocked: (payload) => blockedApps.push(payload),
        emitTrackingStatus: vi.fn()
      }
    })

    tracker.updateConfig({
      trackedApps: [trackedApp],
      settings: testSettings,
      usageTimes: { '2026-06-02': { chrome: 59 } },
      notifications: [],
      blockedApps: []
    })

    await tracker.runOnce()

    expect(usageUpdates).toEqual([
      {
        appId: 'chrome',
        date: '2026-06-02',
        usageSeconds: 60
      }
    ])
    expect(processProvider.terminateProcessByName).toHaveBeenCalledWith('chrome.exe')
    expect(notificationService.sendBlockNotification).toHaveBeenCalledTimes(1)
    expect(blockedApps).toEqual([
      {
        id: 'blocked:chrome:2026-06-02',
        appId: 'chrome',
        appName: 'Chrome',
        date: '2026-06-02',
        blockedAt: '2026-06-02T00:00:00.000Z',
        processName: 'chrome.exe',
        usageSeconds: 60
      }
    ])
  })

  it('terminates already locked apps without incrementing usage or duplicating block records', async () => {
    const usageUpdates: UsageUpdatePayload[] = []
    const blockedApps: BlockedAppHistory[] = []
    const processProvider = createForegroundProcessProvider('chrome.exe')
    const notificationService = createNotificationService()

    const tracker = new UsageTracker({
      processProvider,
      notificationService,
      now: fixedNow,
      events: {
        emitUsageUpdate: (payload) => usageUpdates.push(payload),
        emitNotificationSent: vi.fn(),
        emitAppBlocked: (payload) => blockedApps.push(payload),
        emitTrackingStatus: vi.fn()
      }
    })

    tracker.updateConfig({
      trackedApps: [trackedApp],
      settings: testSettings,
      usageTimes: { '2026-06-02': { chrome: 60 } },
      notifications: [],
      blockedApps: []
    })

    await tracker.runOnce()
    await tracker.runOnce()

    expect(usageUpdates).toEqual([])
    expect(processProvider.terminateProcessByName).toHaveBeenCalledTimes(2)
    expect(blockedApps).toHaveLength(1)
    expect(notificationService.sendBlockNotification).toHaveBeenCalledTimes(1)
  })

  it('allows usage again on the next local date', async () => {
    const usageUpdates: UsageUpdatePayload[] = []
    const processProvider = createForegroundProcessProvider('chrome.exe')
    const notificationService = createNotificationService()

    const tracker = new UsageTracker({
      processProvider,
      now: () => new Date(2026, 5, 3, 9, 0, 0),
      notificationService,
      events: {
        emitUsageUpdate: (payload) => usageUpdates.push(payload),
        emitNotificationSent: vi.fn(),
        emitAppBlocked: vi.fn(),
        emitTrackingStatus: vi.fn()
      }
    })

    tracker.updateConfig({
      trackedApps: [trackedApp],
      settings: testSettings,
      usageTimes: { '2026-06-02': { chrome: 60 } },
      notifications: [],
      blockedApps: []
    })

    await tracker.runOnce()

    expect(usageUpdates).toEqual([
      {
        appId: 'chrome',
        date: '2026-06-03',
        usageSeconds: 1
      }
    ])
    expect(processProvider.terminateProcessByName).not.toHaveBeenCalled()
  })

  it('rejects config updates that delete locked apps and keeps the previous config', async () => {
    const statuses: TrackingStatusPayload[] = []
    const processProvider = createForegroundProcessProvider('chrome.exe')
    const notificationService = createNotificationService()

    const tracker = new UsageTracker({
      processProvider,
      now: fixedNow,
      notificationService,
      events: {
        emitUsageUpdate: vi.fn(),
        emitNotificationSent: vi.fn(),
        emitAppBlocked: vi.fn(),
        emitTrackingStatus: (payload) => statuses.push(payload)
      }
    })

    tracker.updateConfig({
      trackedApps: [trackedApp],
      settings: testSettings,
      usageTimes: { '2026-06-02': { chrome: 60 } },
      notifications: [],
      blockedApps: []
    })
    tracker.updateConfig({
      trackedApps: [],
      settings: testSettings,
      usageTimes: { '2026-06-02': { chrome: 60 } },
      notifications: [],
      blockedApps: []
    })

    await tracker.runOnce()

    expect(statuses.some((status) => status.error?.includes('내일까지 삭제할 수 없습니다'))).toBe(true)
    expect(processProvider.terminateProcessByName).toHaveBeenCalledWith('chrome.exe')
  })

  it('reports process lookup errors without throwing', async () => {
    const statuses: TrackingStatusPayload[] = []
    const processProvider: ProcessSnapshotProvider = {
      getActiveProcessName: vi.fn().mockRejectedValue(new Error('process query failed'))
    }
    const notificationService = createNotificationService()

    const tracker = new UsageTracker({
      processProvider,
      notificationService,
      now: fixedNow,
      events: {
        emitUsageUpdate: vi.fn(),
        emitNotificationSent: vi.fn(),
        emitAppBlocked: vi.fn(),
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
