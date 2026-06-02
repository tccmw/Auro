import type { AppSettings } from './types'

export const DEFAULT_SETTINGS: AppSettings = {
  trackingIntervalMs: 1000,
  notificationEnabled: true
}

export const MIN_TRACKING_INTERVAL_MS = 500
export const MAX_TRACKING_INTERVAL_MS = 60_000

export function sanitizeSettings(settings: Partial<AppSettings> | null | undefined): AppSettings {
  const interval = Number(settings?.trackingIntervalMs)

  return {
    trackingIntervalMs:
      Number.isFinite(interval) && interval >= MIN_TRACKING_INTERVAL_MS
        ? Math.min(Math.round(interval), MAX_TRACKING_INTERVAL_MS)
        : DEFAULT_SETTINGS.trackingIntervalMs,
    notificationEnabled:
      typeof settings?.notificationEnabled === 'boolean'
        ? settings.notificationEnabled
        : DEFAULT_SETTINGS.notificationEnabled
  }
}
