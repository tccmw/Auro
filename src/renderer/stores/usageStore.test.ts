import { describe, expect, it } from 'vitest'
import type { TrackedApp } from '../../shared/types'
import { createTrackedAppsFromInputs } from './usageStore'

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
          notificationEnabled: true
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
      notificationEnabled: true
    })
  })
})
