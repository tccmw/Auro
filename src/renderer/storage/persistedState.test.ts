import { describe, expect, it } from 'vitest'
import {
  createLimitoPersistStorage,
  sanitizePersistedState,
  STORE_STORAGE_KEY,
  type StringStorage
} from './persistedState'

function createTestStorage(initialValue?: string): StringStorage {
  const values = new Map<string, string>()

  if (initialValue !== undefined) {
    values.set(STORE_STORAGE_KEY, initialValue)
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
        notifications: [{ id: 'n1', appId: 'chrome', date: '2026-06-02', sentAt: 'x' }]
      })
    ).toEqual({
      trackedApps: [],
      usageTimes: { '2026-06-02': { chrome: 12 } },
      settings: { trackingIntervalMs: 1000, notificationEnabled: true },
      notifications: [{ id: 'n1', appId: 'chrome', date: '2026-06-02', sentAt: 'x' }]
    })
  })

  it('removes corrupted localStorage payloads', () => {
    const storage = createTestStorage('not-json')
    const persistStorage = createLimitoPersistStorage(storage)

    expect(persistStorage.getItem(STORE_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(STORE_STORAGE_KEY)).toBeNull()
  })
})
