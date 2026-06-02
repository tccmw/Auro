import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../shared/defaults'
import { normalizeProcessName } from '../../shared/process'
import type {
  AppSettings,
  NotificationHistory,
  TrackingStatusPayload,
  TrackedApp,
  UsageTimes,
  UsageUpdatePayload
} from '../../shared/types'
import {
  createLimitoPersistStorage,
  STORE_STORAGE_KEY,
  type PersistedLimitoState
} from '../storage/persistedState'

export interface TrackedAppInput {
  name: string
  processName: string
  dailyLimitMinutes: number
  notificationEnabled: boolean
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
  setTrackingStatus: (status: TrackingStatusPayload) => void
  hydrateMainProcessSettings: () => Promise<void>
}

function createTrackedApp(input: TrackedAppInput): TrackedApp {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: input.name.trim(),
    processName: input.processName.trim(),
    dailyLimitMinutes: Math.max(1, Math.round(Number(input.dailyLimitMinutes))),
    notificationEnabled: input.notificationEnabled
  }
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

function syncPayloadFromState(state: UsageStore): PersistedLimitoState {
  return {
    trackedApps: state.trackedApps,
    usageTimes: state.usageTimes,
    settings: state.settings,
    notifications: state.notifications
  }
}

async function syncMainProcess(state: UsageStore): Promise<void> {
  if (typeof window === 'undefined' || !window.limitoApi) {
    return
  }

  await window.limitoApi.updateSettings(syncPayloadFromState(state))
}

export const useUsageStore = create<UsageStore>()(
  persist(
    (set, get) => ({
      trackedApps: [],
      usageTimes: {},
      settings: DEFAULT_SETTINGS,
      notifications: [],
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
            app.id === appId
              ? {
                  ...app,
                  ...updates,
                  name: updates.name?.trim() ?? app.name,
                  processName: updates.processName?.trim() ?? app.processName,
                  dailyLimitMinutes:
                    updates.dailyLimitMinutes === undefined
                      ? app.dailyLimitMinutes
                      : Math.max(1, Math.round(Number(updates.dailyLimitMinutes)))
                }
              : app
          )
        }))
        void get().hydrateMainProcessSettings()
      },
      removeTrackedApp: (appId) => {
        set((state) => ({
          trackedApps: state.trackedApps.filter((app) => app.id !== appId)
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
            return state
          }

          return {
            notifications: [notification, ...state.notifications].slice(0, 200)
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
      storage: createLimitoPersistStorage(),
      partialize: (state) => syncPayloadFromState(state),
      onRehydrateStorage: () => (state) => {
        if (state) {
          void state.hydrateMainProcessSettings()
        }
      }
    }
  )
)
