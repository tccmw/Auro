import { describe, expect, it } from 'vitest'
import {
  createLimitoPersistStorage,
  LEGACY_STORE_STORAGE_KEY,
  sanitizePersistedState,
  STORE_STORAGE_KEY,
  type StringStorage
} from './persistedState'

function createTestStorage(initialValue?: string, initialKey = STORE_STORAGE_KEY): StringStorage {
  const values = new Map<string, string>()

  if (initialValue !== undefined) {
    values.set(initialKey, initialValue)
  }

  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => {
      values.delete(name)
    }
  }
}

describe('persistedState', () => {
  it('sanitizes malformed persisted state back to defaults', () => {
    expect(
      sanitizePersistedState({
        trackedApps: [{ id: 'bad', name: 1 }],
        usageTimes: { '2026-06-02': { chrome: '12', broken: 'nope' } },
        settings: { trackingIntervalMs: -1 },
        notifications: [{ id: 'n1', appId: 'chrome', appName: 'Chrome', date: '2026-06-02', sentAt: 'x' }]
      })
    ).toEqual({
      trackedApps: [],
      usageTimes: { '2026-06-02': { chrome: 12 } },
      settings: { trackingIntervalMs: 1000, notificationEnabled: true },
      notifications: [{ id: 'n1', appId: 'chrome', appName: 'Chrome', date: '2026-06-02', sentAt: 'x' }]
    })
  })

  it('preserves optional tracked app icon data', () => {
    expect(
      sanitizePersistedState({
        trackedApps: [
          {
            id: 'figma',
            name: 'Figma',
            processName: 'figma.exe',
            dailyLimitMinutes: 90,
            notificationEnabled: true,
            iconDataUrl: 'data:image/png;base64,figma'
          }
        ]
      }).trackedApps
    ).toEqual([
      {
        id: 'figma',
        name: 'Figma',
        processName: 'figma.exe',
        dailyLimitMinutes: 90,
        notificationEnabled: true,
        iconDataUrl: 'data:image/png;base64,figma'
      }
    ])
  })

  it('migrates legacy Limito storage payloads to the Auro storage key', () => {
    const payload = JSON.stringify({
      state: {
        trackedApps: [],
        usageTimes: {},
        settings: { trackingIntervalMs: 1000, notificationEnabled: true },
        notifications: []
      },
      version: 1
    })
    const storage = createTestStorage(payload, LEGACY_STORE_STORAGE_KEY)
    const persistStorage = createLimitoPersistStorage(storage)

    expect(persistStorage.getItem(STORE_STORAGE_KEY)).toEqual({
      state: {
        trackedApps: [],
        usageTimes: {},
        settings: { trackingIntervalMs: 1000, notificationEnabled: true },
        notifications: []
      },
      version: 1
    })
    expect(storage.getItem(STORE_STORAGE_KEY)).toBe(payload)
    expect(storage.getItem(LEGACY_STORE_STORAGE_KEY)).toBeNull()
  })

  it('removes corrupted localStorage payloads', () => {
    const storage = createTestStorage('not-json')
    const persistStorage = createLimitoPersistStorage(storage)

    expect(persistStorage.getItem(STORE_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(STORE_STORAGE_KEY)).toBeNull()
  })
})
