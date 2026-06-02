import { describe, expect, it } from 'vitest'
import { matchTrackedApps, normalizeProcessName } from './processMatcher'
import type { TrackedApp } from '../../shared/types'

const app: TrackedApp = {
  id: 'chrome',
  name: 'Chrome',
  processName: 'chrome.exe',
  dailyLimitMinutes: 60,
  notificationEnabled: true
}

describe('processMatcher', () => {
  it('normalizes case, paths, and .exe suffixes', () => {
    expect(normalizeProcessName('CHROME.EXE')).toBe('chrome')
    expect(normalizeProcessName('C:\\Program Files\\App\\Notepad.exe')).toBe('notepad')
    expect(normalizeProcessName('/Applications/Foo')).toBe('foo')
  })

  it('matches tracked apps by normalized process name', () => {
    expect(matchTrackedApps([app], ['System', 'Chrome'])).toEqual([app])
    expect(matchTrackedApps([app], ['Code.exe'])).toEqual([])
  })
})
