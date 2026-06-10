import { sanitizeSettings } from '../../shared/defaults'
import { getLocalDateKey } from '../../shared/date'
import type {
  AppSettings,
  BlockedAppHistory,
  NotificationHistory,
  SettingsUpdatePayload,
  TrackingStatusPayload,
  TrackedApp,
  UsageTimes,
  UsageUpdatePayload
} from '../../shared/types'
import type { NotificationService } from '../notification/notifier'
import type { ProcessSnapshotProvider, ProcessTerminator } from './processAdapter'
import { matchTrackedApp } from './processMatcher'
import {
  createBlockedAppHistory,
  createNotificationHistory,
  getUsageSeconds,
  hasBlockedAppBeenRecorded,
  incrementUsageSeconds,
  isLimitReached,
  shouldSendLimitNotification
} from './usageLogic'

export interface UsageTrackerEvents {
  emitUsageUpdate: (payload: UsageUpdatePayload) => void
  emitNotificationSent: (payload: NotificationHistory) => void
  emitAppBlocked: (payload: BlockedAppHistory) => void
  emitTrackingStatus: (payload: TrackingStatusPayload) => void
}

export interface UsageTrackerOptions {
  processProvider: ProcessSnapshotProvider & Partial<ProcessTerminator>
  notificationService: NotificationService
  events: UsageTrackerEvents
  now?: () => Date
}

export class UsageTracker {
  private trackedApps: TrackedApp[] = []
  private settings: AppSettings = sanitizeSettings(undefined)
  private usageTimes: UsageTimes = {}
  private notifications: NotificationHistory[] = []
  private blockedApps: BlockedAppHistory[] = []
  private timer: NodeJS.Timeout | undefined
  private tickInProgress = false
  private readonly processProvider: ProcessSnapshotProvider
  private readonly processTerminator: ProcessTerminator | undefined
  private readonly notificationService: NotificationService
  private readonly events: UsageTrackerEvents
  private readonly now: () => Date

  constructor(options: UsageTrackerOptions) {
    this.processProvider = options.processProvider
    this.processTerminator = options.processProvider.terminateProcessByName
      ? (options.processProvider as ProcessTerminator)
      : undefined
    this.notificationService = options.notificationService
    this.events = options.events
    this.now = options.now ?? (() => new Date())
  }

  updateConfig(payload: SettingsUpdatePayload): void {
    const lockedMutationError = this.getLockedConfigMutationError(payload)

    if (lockedMutationError) {
      this.events.emitTrackingStatus({
        running: Boolean(this.timer),
        error: lockedMutationError
      })
      return
    }

    this.trackedApps = payload.trackedApps
    this.settings = sanitizeSettings(payload.settings)

    if (payload.usageTimes) {
      this.usageTimes = payload.usageTimes
    }

    if (payload.notifications) {
      this.notifications = payload.notifications
    }

    if (payload.blockedApps) {
      this.blockedApps = mergeBlockedAppHistories(payload.blockedApps, this.blockedApps)
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
        const existingUsageSeconds = getUsageSeconds(this.usageTimes, date, activeApp.id)

        if (isLimitReached(activeApp, existingUsageSeconds)) {
          await this.blockAppExecution(activeApp, existingUsageSeconds, date)
        } else {
          const result = incrementUsageSeconds(this.usageTimes, date, activeApp.id, incrementSeconds)
          this.usageTimes = result.usageTimes
          this.events.emitUsageUpdate({
            appId: activeApp.id,
            date,
            usageSeconds: result.usageSeconds
          })

          await this.maybeSendNotification(activeApp, result.usageSeconds, date)

          if (isLimitReached(activeApp, result.usageSeconds)) {
            await this.blockAppExecution(activeApp, result.usageSeconds, date)
          }
        }
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

  private async blockAppExecution(app: TrackedApp, usageSeconds: number, date: string): Promise<void> {
    if (!this.processTerminator) {
      this.events.emitTrackingStatus({
        running: true,
        error: 'App blocking is not available in this environment.'
      })
      return
    }

    try {
      await this.processTerminator.terminateProcessByName(app.processName)
    } catch (error) {
      this.events.emitTrackingStatus({
        running: true,
        error: error instanceof Error ? error.message : String(error)
      })
      return
    }

    if (hasBlockedAppBeenRecorded(this.blockedApps, app.id, date)) {
      return
    }

    const blockedApp = createBlockedAppHistory(app, date, usageSeconds, this.now())
    this.blockedApps = [blockedApp, ...this.blockedApps].slice(0, 200)
    this.events.emitAppBlocked(blockedApp)

    try {
      await this.notificationService.sendBlockNotification(app, usageSeconds)
    } catch (error) {
      this.events.emitTrackingStatus({
        running: true,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private getLockedConfigMutationError(payload: SettingsUpdatePayload): string | null {
    const date = getLocalDateKey(this.now())

    for (const app of this.trackedApps) {
      const currentUsageSeconds = getUsageSeconds(this.usageTimes, date, app.id)

      if (!isLimitReached(app, currentUsageSeconds)) {
        continue
      }

      const incomingApp = payload.trackedApps.find((candidate) => candidate.id === app.id)

      if (!incomingApp) {
        return `${app.name}은 오늘 제한 시간을 초과해 내일까지 삭제할 수 없습니다.`
      }

      if (!areTrackedAppsEqual(app, incomingApp)) {
        return `${app.name}은 오늘 제한 시간을 초과해 내일까지 수정할 수 없습니다.`
      }

      const incomingUsageSeconds = payload.usageTimes?.[date]?.[app.id]

      if (
        typeof incomingUsageSeconds === 'number' &&
        Number.isFinite(incomingUsageSeconds) &&
        incomingUsageSeconds < currentUsageSeconds
      ) {
        return `${app.name}의 오늘 사용 시간은 제한 초과 후 줄일 수 없습니다.`
      }
    }

    return null
  }
}

function areTrackedAppsEqual(left: TrackedApp, right: TrackedApp): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.processName === right.processName &&
    left.dailyLimitMinutes === right.dailyLimitMinutes &&
    left.notificationEnabled === right.notificationEnabled &&
    (left.iconDataUrl ?? '') === (right.iconDataUrl ?? '')
  )
}

function mergeBlockedAppHistories(
  incomingBlockedApps: BlockedAppHistory[],
  currentBlockedApps: BlockedAppHistory[]
): BlockedAppHistory[] {
  const blockedAppsById = new Map<string, BlockedAppHistory>()

  for (const blockedApp of incomingBlockedApps) {
    blockedAppsById.set(blockedApp.id, blockedApp)
  }

  for (const blockedApp of currentBlockedApps) {
    blockedAppsById.set(blockedApp.id, blockedApp)
  }

  return [...blockedAppsById.values()]
    .sort((left, right) => new Date(right.blockedAt).getTime() - new Date(left.blockedAt).getTime())
    .slice(0, 200)
}
