import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { sanitizeSettings } from '../../shared/defaults'
import type { AppSettings, NotificationHistory, TrackedApp, UsageTimes } from '../../shared/types'

export const STORE_STORAGE_KEY = 'limito-usage-store'

export interface PersistedLimitoState {
  trackedApps: TrackedApp[]
  usageTimes: UsageTimes
  settings: AppSettings
  notifications: NotificationHistory[]
}

export interface StringStorage {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

function createMemoryStorage(): StringStorage {
  const values = new Map<string, string>()

  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value)
    },
    removeItem: (name) => {
      values.delete(name)
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeTrackedApp(value: unknown): TrackedApp | null {
  if (!isRecord(value)) {
    return null
  }

  const dailyLimitMinutes = Number(value.dailyLimitMinutes)

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.processName !== 'string' ||
    !Number.isFinite(dailyLimitMinutes)
  ) {
    return null
  }

  return {
    id: value.id,
    name: value.name,
    processName: value.processName,
    dailyLimitMinutes: Math.max(1, Math.round(dailyLimitMinutes)),
    notificationEnabled:
      typeof value.notificationEnabled === 'boolean' ? value.notificationEnabled : true
  }
}

function sanitizeUsageTimes(value: unknown): UsageTimes {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).map(([date, appUsage]) => [
      date,
      isRecord(appUsage)
        ? Object.fromEntries(
            Object.entries(appUsage)
              .map(([appId, seconds]) => [appId, Math.max(0, Math.floor(Number(seconds)))])
              .filter(([, seconds]) => Number.isFinite(seconds))
          )
        : {}
    ])
  )
}

function sanitizeNotifications(value: unknown): NotificationHistory[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((notification): notification is NotificationHistory => {
    return (
      isRecord(notification) &&
      typeof notification.id === 'string' &&
      typeof notification.appId === 'string' &&
      typeof notification.date === 'string' &&
      typeof notification.sentAt === 'string'
    )
  })
}

export function sanitizePersistedState(value: unknown): PersistedLimitoState {
  const state = isRecord(value) ? value : {}
  const trackedApps = Array.isArray(state.trackedApps)
    ? state.trackedApps.map(sanitizeTrackedApp).filter((app): app is TrackedApp => app !== null)
    : []

  return {
    trackedApps,
    usageTimes: sanitizeUsageTimes(state.usageTimes),
    settings: sanitizeSettings(isRecord(state.settings) ? state.settings : undefined),
    notifications: sanitizeNotifications(state.notifications)
  }
}

function getBrowserStorage(): StringStorage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }

  return createMemoryStorage()
}

export function createLimitoPersistStorage(
  storage: StringStorage = getBrowserStorage()
): PersistStorage<PersistedLimitoState> {
  return {
    getItem: (name) => {
      const rawValue = storage.getItem(name)

      if (!rawValue) {
        return null
      }

      try {
        const parsed = JSON.parse(rawValue) as StorageValue<PersistedLimitoState>

        return {
          state: sanitizePersistedState(parsed.state),
          version: parsed.version
        }
      } catch {
        storage.removeItem(name)
        return null
      }
    },
    setItem: (name, value) => {
      storage.setItem(name, JSON.stringify(value))
    },
    removeItem: (name) => {
      storage.removeItem(name)
    }
  }
}
