export type DateKey = string

export interface TrackedApp {
  id: string
  name: string
  processName: string
  dailyLimitMinutes: number
  notificationEnabled: boolean
  iconDataUrl?: string
}

export type InstalledAppSource = 'start-menu' | 'registry'

export interface InstalledAppCandidate {
  id: string
  name: string
  processName: string
  executablePath: string
  source: InstalledAppSource
  publisher?: string
  iconPath?: string
  iconDataUrl?: string
}

export type UsageTimes = Record<DateKey, Record<string, number>>

export interface AppSettings {
  trackingIntervalMs: number
  notificationEnabled: boolean
  launchAtLoginEnabled: boolean
}

export interface NotificationHistory {
  id: string
  appId: string
  appName?: string
  date: DateKey
  sentAt: string
}

export interface BlockedAppHistory {
  id: string
  appId: string
  appName?: string
  date: DateKey
  blockedAt: string
  processName: string
  usageSeconds: number
}

export interface SettingsUpdatePayload {
  trackedApps: TrackedApp[]
  settings: AppSettings
  usageTimes?: UsageTimes
  notifications?: NotificationHistory[]
  blockedApps?: BlockedAppHistory[]
}

export interface UsageUpdatePayload {
  appId: string
  date: DateKey
  usageSeconds: number
}

export interface TrackingStatusPayload {
  running: boolean
  lastCheckedAt?: string
  error?: string
}

export interface AuroApi {
  listInstalledApps: () => Promise<InstalledAppCandidate[]>
  updateSettings: (payload: SettingsUpdatePayload) => Promise<void>
  onUsageUpdate: (callback: (payload: UsageUpdatePayload) => void) => () => void
  onNotificationSent: (callback: (payload: NotificationHistory) => void) => () => void
  onAppBlocked: (callback: (payload: BlockedAppHistory) => void) => () => void
  onTrackingStatus: (callback: (payload: TrackingStatusPayload) => void) => () => void
}

export type LimitoApi = AuroApi
