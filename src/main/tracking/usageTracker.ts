import { sanitizeSettings } from '../../shared/defaults'
import { getLocalDateKey } from '../../shared/date'
import type {
  AppSettings,
  NotificationHistory,
  SettingsUpdatePayload,
  TrackingStatusPayload,
  TrackedApp,
  UsageTimes,
  UsageUpdatePayload
} from '../../shared/types'
import type { NotificationService } from '../notification/notifier'
import type { ProcessSnapshotProvider } from './processAdapter'
import { matchTrackedApp } from './processMatcher'
import {
  createNotificationHistory,
  incrementUsageSeconds,
  shouldSendLimitNotification
} from './usageLogic'

export interface UsageTrackerEvents {
  emitUsageUpdate: (payload: UsageUpdatePayload) => void
  emitNotificationSent: (payload: NotificationHistory) => void
  emitTrackingStatus: (payload: TrackingStatusPayload) => void
}

export interface UsageTrackerOptions {
  processProvider: ProcessSnapshotProvider
  notificationService: NotificationService
  events: UsageTrackerEvents
  now?: () => Date
}

export class UsageTracker {
  private trackedApps: TrackedApp[] = []
  private settings: AppSettings = sanitizeSettings(undefined)
  private usageTimes: UsageTimes = {}
  private notifications: NotificationHistory[] = []
  private timer: NodeJS.Timeout | undefined
  private tickInProgress = false
  private readonly processProvider: ProcessSnapshotProvider
  private readonly notificationService: NotificationService
  private readonly events: UsageTrackerEvents
  private readonly now: () => Date

  constructor(options: UsageTrackerOptions) {
    this.processProvider = options.processProvider
    this.notificationService = options.notificationService
    this.events = options.events
    this.now = options.now ?? (() => new Date())
  }

  updateConfig(payload: SettingsUpdatePayload): void {
    this.trackedApps = payload.trackedApps
    this.settings = sanitizeSettings(payload.settings)

    if (payload.usageTimes) {
      this.usageTimes = payload.usageTimes
    }

    if (payload.notifications) {
      this.notifications = payload.notifications
    }

    if (this.timer) {
      this.restart()
    }
  }

  start(): void {
    if (this.timer) {
      return
    }

    this.timer = setInterval(() => {
      void this.runOnce()
    }, this.settings.trackingIntervalMs)

    void this.runOnce()
    this.events.emitTrackingStatus({ running: true })
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }

    this.events.emitTrackingStatus({ running: false })
  }

  restart(): void {
    this.stop()
    this.start()
  }

  async runOnce(): Promise<void> {
    if (this.tickInProgress) {
      return
    }

    this.tickInProgress = true

    try {
      const activeProcessName = await this.processProvider.getActiveProcessName()
      const activeApp = matchTrackedApp(this.trackedApps, activeProcessName)
      const date = getLocalDateKey(this.now())
      const incrementSeconds = Math.max(1, Math.round(this.settings.trackingIntervalMs / 1000))

      if (activeApp) {
        const result = incrementUsageSeconds(this.usageTimes, date, activeApp.id, incrementSeconds)
        this.usageTimes = result.usageTimes
        this.events.emitUsageUpdate({ appId: activeApp.id, date, usageSeconds: result.usageSeconds })

        await this.maybeSendNotification(activeApp, result.usageSeconds, date)
      }

      this.events.emitTrackingStatus({ running: true, lastCheckedAt: this.now().toISOString() })
    } catch (error) {
      this.events.emitTrackingStatus({
        running: true,
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      this.tickInProgress = false
    }
  }

  private async maybeSendNotification(app: TrackedApp, usageSeconds: number, date: string): Promise<void> {
    if (
      !shouldSendLimitNotification({
        app,
        usageSeconds,
        settings: this.settings,
        notifications: this.notifications,
        date
      })
    ) {
      return
    }

    try {
      await this.notificationService.sendLimitNotification(app, usageSeconds)
      const notification = createNotificationHistory(app, date, this.now())
      this.notifications = [...this.notifications, notification]
      this.events.emitNotificationSent(notification)
    } catch (error) {
      this.events.emitTrackingStatus({
        running: true,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
}
