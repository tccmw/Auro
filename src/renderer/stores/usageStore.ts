import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../shared/defaults'
import { getLocalDateKey } from '../../shared/date'
import { normalizeProcessName } from '../../shared/process'
import type {
  AppSettings,
  BlockedAppHistory,
  NotificationHistory,
  TrackingStatusPayload,
  TrackedApp,
  UsageTimes,
  UsageUpdatePayload
} from '../../shared/types'
import { isAppLockedForDate } from '../../shared/usageLimits'
import {
  createAuroPersistStorage,
  STORE_STORAGE_KEY,
  type PersistedLimitoState
} from '../storage/persistedState'

export const USAGE_STORE_PERSIST_VERSION = 1

export interface TrackedAppInput {
  name: string
  processName: string
  dailyLimitMinutes: number
  notificationEnabled: boolean
  iconDataUrl?: string
}

export interface UsageStore extends PersistedLimitoState {
  trackingStatus: TrackingStatusPayload
  addTrackedApp: (input: TrackedAppInput) => void
  addTrackedApps: (inputs: TrackedAppInput[]) => void
  updateTrackedApp: (appId: string, updates: Partial<TrackedAppInput>) => void
  removeTrackedApp: (appId: string) => void
  updateSettings: (settings: Partial<AppSettings>) => void
  applyUsageUpdate: (payload: UsageUpdatePayload) => void
  addNotification: (notification: NotificationHistory) => void
  addBlockedApp: (blockedApp: BlockedAppHistory) => void
  setTrackingStatus: (status: TrackingStatusPayload) => void
  hydrateMainProcessSettings: () => Promise<void>
}

function createTrackedApp(input: TrackedAppInput): TrackedApp {
  const app: TrackedApp = {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: input.name.trim(),
    processName: input.processName.trim(),
    dailyLimitMinutes: Math.max(1, Math.round(Number(input.dailyLimitMinutes))),
    notificationEnabled: input.notificationEnabled
  }

  if (input.iconDataUrl) {
    app.iconDataUrl = input.iconDataUrl
  }

  return app
}

export function createTrackedAppsFromInputs(
  inputs: TrackedAppInput[],
  existingApps: TrackedApp[]
): TrackedApp[] {
  const existingProcessNames = new Set(
    existingApps.map((app) => normalizeProcessName(app.processName)).filter(Boolean)
  )
  const apps: TrackedApp[] = []

  for (const input of inputs) {
    const name = input.name.trim()
    const processName = normalizeProcessName(input.processName)

    if (!name || !processName || existingProcessNames.has(processName)) {
      continue
    }

    existingProcessNames.add(processName)
    apps.push(
      createTrackedApp({
        ...input,
        name,
        processName
      })
    )
  }

  return apps
}

export function backfillNotificationAppNames(
  notifications: NotificationHistory[],
  trackedApps: TrackedApp[]
): NotificationHistory[] {
  return notifications.map((notification) => {
    if (notification.appName) {
      return notification
    }

    const app = trackedApps.find((trackedApp) => trackedApp.id === notification.appId)

    return app ? { ...notification, appName: app.name } : notification
  })
}

export function createInitialPersistedState(): PersistedLimitoState {
  return {
    trackedApps: [],
    usageTimes: {},
    settings: DEFAULT_SETTINGS,
    notifications: [],
    blockedApps: []
  }
}

export function migratePersistedState(
  persistedState: unknown,
  version: number
): PersistedLimitoState {
  if (version < USAGE_STORE_PERSIST_VERSION) {
    return createInitialPersistedState()
  }

  return {
    ...createInitialPersistedState(),
    ...(persistedState as Partial<PersistedLimitoState>)
  }
}

function syncPayloadFromState(state: UsageStore): PersistedLimitoState {
  return {
    trackedApps: state.trackedApps,
    usageTimes: state.usageTimes,
    settings: state.settings,
    notifications: state.notifications,
    blockedApps: state.blockedApps
  }
}

function backfillBlockedAppNames(
  blockedApps: BlockedAppHistory[],
  trackedApps: TrackedApp[]
): BlockedAppHistory[] {
  return blockedApps.map((blockedApp) => {
    if (blockedApp.appName) {
      return blockedApp
    }

    const app = trackedApps.find((trackedApp) => trackedApp.id === blockedApp.appId)

    return app ? { ...blockedApp, appName: app.name } : blockedApp
  })
}

async function syncMainProcess(state: UsageStore): Promise<void> {
  const api = typeof window === 'undefined' ? undefined : window.auroApi ?? window.limitoApi

  if (!api) {
    return
  }

  await api.updateSettings(syncPayloadFromState(state))
}

export const useUsageStore = create<UsageStore>()(
  persist(
    (set, get) => ({
      trackedApps: [],
      usageTimes: {},
      settings: DEFAULT_SETTINGS,
      notifications: [],
      blockedApps: [],
      trackingStatus: { running: false },
      addTrackedApp: (input) => {
        const app = createTrackedApp(input)
        set((state) => ({ trackedApps: [...state.trackedApps, app] }))
        void get().hydrateMainProcessSettings()
      },
      addTrackedApps: (inputs) => {
        set((state) => {
          const apps = createTrackedAppsFromInputs(inputs, state.trackedApps)

          if (apps.length === 0) {
            return state
          }

          return {
            trackedApps: [...state.trackedApps, ...apps]
          }
        })
        void get().hydrateMainProcessSettings()
      },
      updateTrackedApp: (appId, updates) => {
        set((state) => ({
          trackedApps: state.trackedApps.map((app) =>
            app.id === appId && !isAppLockedForDate(app, state.usageTimes, getLocalDateKey())
              ? {
                  ...app,
                  ...updates,
                  name: updates.name?.trim() ?? app.name,
                  processName: updates.processName?.trim() ?? app.processName,
                  dailyLimitMinutes:
                    updates.dailyLimitMinutes === undefined
                      ? app.dailyLimitMinutes
                      : Math.max(1, Math.round(Number(updates.dailyLimitMinutes))),
                  iconDataUrl: updates.iconDataUrl ?? app.iconDataUrl
                }
              : app
          )
        }))
        void get().hydrateMainProcessSettings()
      },
      removeTrackedApp: (appId) => {
        set((state) => ({
          trackedApps: state.trackedApps.filter(
            (app) => app.id !== appId || isAppLockedForDate(app, state.usageTimes, getLocalDateKey())
          ),
          notifications: backfillNotificationAppNames(state.notifications, state.trackedApps),
          blockedApps: backfillBlockedAppNames(state.blockedApps, state.trackedApps)
        }))
        void get().hydrateMainProcessSettings()
      },
      updateSettings: (settings) => {
        set((state) => ({
          settings: sanitizeSettings({ ...state.settings, ...settings })
        }))
        void get().hydrateMainProcessSettings()
      },
      applyUsageUpdate: (payload) => {
        set((state) => ({
          usageTimes: {
            ...state.usageTimes,
            [payload.date]: {
              ...(state.usageTimes[payload.date] ?? {}),
              [payload.appId]: payload.usageSeconds
            }
          }
        }))
      },
      addNotification: (notification) => {
        set((state) => {
          if (state.notifications.some((item) => item.id === notification.id)) {
            return {
              notifications: state.notifications.map((item) =>
                item.id === notification.id && !item.appName && notification.appName
                  ? { ...item, appName: notification.appName }
                  : item
              )
            }
          }

          return {
            notifications: [notification, ...state.notifications].slice(0, 200)
          }
        })
      },
      addBlockedApp: (blockedApp) => {
        set((state) => {
          if (state.blockedApps.some((item) => item.id === blockedApp.id)) {
            return {
              blockedApps: state.blockedApps.map((item) =>
                item.id === blockedApp.id && !item.appName && blockedApp.appName
                  ? { ...item, appName: blockedApp.appName }
                  : item
              )
            }
          }

          return {
            blockedApps: [blockedApp, ...state.blockedApps].slice(0, 200)
          }
        })
      },
      setTrackingStatus: (status) => {
        set({ trackingStatus: status })
      },
      hydrateMainProcessSettings: async () => {
        await syncMainProcess(get())
      }
    }),
    {
      name: STORE_STORAGE_KEY,
      version: USAGE_STORE_PERSIST_VERSION,
      storage: createAuroPersistStorage(),
      migrate: (persistedState, version) => migratePersistedState(persistedState, version),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PersistedLimitoState>
        const trackedApps = persisted.trackedApps ?? currentState.trackedApps
        const notifications = persisted.notifications ?? currentState.notifications
        const blockedApps = persisted.blockedApps ?? currentState.blockedApps

        return {
          ...currentState,
          ...persisted,
          trackedApps,
          notifications: backfillNotificationAppNames(notifications, trackedApps),
          blockedApps: backfillBlockedAppNames(blockedApps, trackedApps)
        }
      },
      partialize: (state) => syncPayloadFromState(state),
      onRehydrateStorage: () => (state) => {
        if (state) {
          void state.hydrateMainProcessSettings()
        }
      }
    }
  )
)
