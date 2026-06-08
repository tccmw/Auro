import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import type { NotificationHistory, TrackedApp } from '../../shared/types'
import {
  USAGE_STORE_PERSIST_VERSION,
  backfillNotificationAppNames,
  createTrackedAppsFromInputs,
  migratePersistedState,
  useUsageStore
} from './usageStore'

const existingApps: TrackedApp[] = [
  {
    id: 'chrome',
    name: 'Chrome',
    processName: 'chrome.exe',
    dailyLimitMinutes: 60,
    notificationEnabled: true
  }
]

describe('usageStore helpers', () => {
  it('creates tracked apps from inputs without duplicating normalized process names', () => {
    const apps = createTrackedAppsFromInputs(
      [
        {
          name: 'Chrome duplicate',
          processName: 'Chrome',
          dailyLimitMinutes: 30,
          notificationEnabled: false
        },
        {
          name: 'Notion',
          processName: 'Notion.exe',
          dailyLimitMinutes: 45,
          notificationEnabled: true,
          iconDataUrl: 'data:image/png;base64,notion'
        },
        {
          name: 'Notion duplicate',
          processName: 'notion',
          dailyLimitMinutes: 90,
          notificationEnabled: true
        }
      ],
      existingApps
    )

    expect(apps).toHaveLength(1)
    expect(apps[0]).toMatchObject({
      name: 'Notion',
      processName: 'notion',
      dailyLimitMinutes: 45,
      notificationEnabled: true,
      iconDataUrl: 'data:image/png;base64,notion'
    })
  })

  it('backfills notification app names from currently tracked apps', () => {
    const notifications: NotificationHistory[] = [
      {
        id: 'chrome:2026-06-02',
        appId: 'chrome',
        date: '2026-06-02',
        sentAt: '2026-06-02T01:00:00.000Z'
      },
      {
        id: 'orphan:2026-06-02',
        appId: 'orphan',
        date: '2026-06-02',
        sentAt: '2026-06-02T02:00:00.000Z'
      }
    ]

    expect(backfillNotificationAppNames(notifications, existingApps)).toEqual([
      {
        ...notifications[0],
        appName: 'Chrome'
      },
      notifications[1]
    ])
  })

  it('backfills notification names before removing a tracked app', () => {
    useUsageStore.setState({
      trackedApps: existingApps,
      usageTimes: {},
      settings: DEFAULT_SETTINGS,
      notifications: [
        {
          id: 'chrome:2026-06-02',
          appId: 'chrome',
          date: '2026-06-02',
          sentAt: '2026-06-02T01:00:00.000Z'
        }
      ],
      trackingStatus: { running: false }
    })

    useUsageStore.getState().removeTrackedApp('chrome')

    expect(useUsageStore.getState().trackedApps).toEqual([])
    expect(useUsageStore.getState().notifications).toEqual([
      {
        id: 'chrome:2026-06-02',
        appId: 'chrome',
        appName: 'Chrome',
        date: '2026-06-02',
        sentAt: '2026-06-02T01:00:00.000Z'
      }
    ])
  })

  it('resets previous persisted versions to the initial state', () => {
    expect(
      migratePersistedState(
        {
          trackedApps: existingApps,
          usageTimes: { '2026-06-02': { chrome: 120 } },
          settings: { trackingIntervalMs: 5000, notificationEnabled: false },
          notifications: [
            {
              id: 'chrome:2026-06-02',
              appId: 'chrome',
              date: '2026-06-02',
              sentAt: '2026-06-02T01:00:00.000Z'
            }
          ]
        },
        USAGE_STORE_PERSIST_VERSION - 1
      )
    ).toEqual({
      trackedApps: [],
      usageTimes: {},
      settings: DEFAULT_SETTINGS,
      notifications: []
    })
  })
})
