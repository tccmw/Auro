import { describe, expect, it } from 'vitest'
import type { InstalledAppCandidate, TrackedApp } from '../../shared/types'
import {
  filterInstalledAppCandidates,
  getCandidateIconPresentation,
  getRegisteredAppForCandidate,
  isCandidateRegistered,
  sortInstalledAppCandidates,
  toTrackedAppInputs
} from './installedAppPickerUtils'

const candidates: InstalledAppCandidate[] = [
  {
    id: 'figma',
    name: 'Figma',
    processName: 'figma',
    executablePath: 'C:\\Figma\\Figma.exe',
    source: 'start-menu',
    publisher: 'Figma'
  },
  {
    id: 'notion',
    name: 'Notion',
    processName: 'notion',
    executablePath: 'C:\\Notion\\Notion.exe',
    source: 'registry',
    publisher: 'Notion Labs'
  }
]

const trackedApps: TrackedApp[] = [
  {
    id: 'tracked-figma',
    name: 'Figma',
    processName: 'Figma.exe',
    dailyLimitMinutes: 60,
    notificationEnabled: true
  }
]

describe('installedAppPickerUtils', () => {
  it('filters candidates by name, process, publisher, or executable path', () => {
    expect(filterInstalledAppCandidates(candidates, 'labs')).toEqual([candidates[1]])
    expect(filterInstalledAppCandidates(candidates, 'figma.exe')).toEqual([candidates[0]])
  })

  it('detects already registered candidates by normalized process name', () => {
    expect(isCandidateRegistered(candidates[0], trackedApps)).toBe(true)
    expect(isCandidateRegistered(candidates[1], trackedApps)).toBe(false)
  })

  it('returns the registered app for candidates by normalized process name', () => {
    expect(
      getRegisteredAppForCandidate(
        {
          ...candidates[0],
          processName: 'figma'
        },
        trackedApps
      )
    ).toEqual(trackedApps[0])
  })

  it('sorts registered apps first, pending apps second, and unselected apps last', () => {
    const selectedIds = new Set(['notion'])
    const chromeCandidate: InstalledAppCandidate = {
      id: 'chrome',
      name: 'Chrome',
      processName: 'chrome',
      executablePath: 'C:\\Chrome\\chrome.exe',
      source: 'start-menu'
    }

    expect(
      sortInstalledAppCandidates([chromeCandidate, candidates[1], candidates[0]], trackedApps, selectedIds)
        .map((candidate) => candidate.id)
    ).toEqual(['figma', 'notion', 'chrome'])
  })

  it('converts only unregistered selected candidates to tracked app inputs', () => {
    expect(toTrackedAppInputs(candidates, trackedApps, 45, false)).toEqual([
      {
        name: 'Notion',
        processName: 'notion',
        dailyLimitMinutes: 45,
        notificationEnabled: false
      }
    ])
  })

  it('returns image icon presentation when icon data is available', () => {
    expect(
      getCandidateIconPresentation({
        ...candidates[0],
        iconDataUrl: 'data:image/png;base64,abc'
      })
    ).toEqual({
      type: 'image',
      src: 'data:image/png;base64,abc',
      alt: 'Figma 아이콘'
    })
  })

  it('returns initial fallback icon presentation without icon data', () => {
    expect(getCandidateIconPresentation(candidates[1])).toEqual({
      type: 'fallback',
      label: 'N'
    })
  })
})
