import { describe, expect, it } from 'vitest'
import {
  attachIconDataUrls,
  createRegistryCandidate,
  createShortcutCandidate,
  dedupeInstalledAppCandidates,
  encodePowerShellCommand,
  extractExecutablePath,
  isInstallerLikeExecutable
} from './installedApps'

describe('installedApps', () => {
  it('encodes PowerShell scripts for EncodedCommand', () => {
    const encoded = encodePowerShellCommand("Write-Output 'Auro'")
    const decoded = Buffer.from(encoded, 'base64').toString('utf16le')

    expect(decoded).toBe("Write-Output 'Auro'")
  })

  it('extracts executable paths from DisplayIcon values', () => {
    expect(extractExecutablePath('"C:\\Program Files\\App\\App.exe",0')).toBe(
      'C:\\Program Files\\App\\App.exe'
    )
    expect(extractExecutablePath('C:\\Program Files\\App\\App.exe,1')).toBe(
      'C:\\Program Files\\App\\App.exe'
    )
    expect(extractExecutablePath('C:\\Program Files\\App\\App.ico')).toBeNull()
  })

  it('creates shortcut candidates only when process names can be inferred', () => {
    expect(
      createShortcutCandidate({
        source: 'start-menu',
        name: 'Figma',
        targetPath: 'C:\\Users\\user\\AppData\\Local\\Figma\\Figma.exe'
      })
    ).toMatchObject({
      name: 'Figma',
      processName: 'figma',
      source: 'start-menu'
    })

    expect(
      createShortcutCandidate({
        source: 'start-menu',
        name: 'Store app',
        targetPath: 'C:\\Windows\\explorer.exe',
        arguments: 'shell:AppsFolder\\Some.App'
      })
    ).toBeNull()
  })

  it('filters non-exe and installer-like registry candidates', () => {
    expect(
      createRegistryCandidate({
        source: 'registry',
        name: 'Chrome',
        displayIcon: '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",0',
        publisher: 'Google'
      })
    ).toMatchObject({
      name: 'Chrome',
      processName: 'chrome',
      source: 'registry',
      publisher: 'Google'
    })

    expect(
      createRegistryCandidate({
        source: 'registry',
        name: 'Updater',
        displayIcon: 'C:\\Program Files\\Updater\\Update.exe'
      })
    ).toBeNull()
    expect(isInstallerLikeExecutable('C:\\Program Files\\App\\uninstall.exe')).toBe(true)
  })

  it('dedupes executable paths and prefers Start Menu candidates', () => {
    const registryCandidate = createRegistryCandidate({
      source: 'registry',
      name: 'Registry Figma',
      displayIcon: 'C:\\Users\\user\\AppData\\Local\\Figma\\Figma.exe',
      publisher: 'Figma'
    })
    const shortcutCandidate = createShortcutCandidate({
      source: 'start-menu',
      name: 'Figma',
      targetPath: 'C:\\Users\\user\\AppData\\Local\\Figma\\Figma.exe'
    })

    expect(registryCandidate).not.toBeNull()
    expect(shortcutCandidate).not.toBeNull()

    const deduped = dedupeInstalledAppCandidates([registryCandidate!, shortcutCandidate!])

    expect(deduped).toHaveLength(1)
    expect(deduped[0]).toMatchObject({ name: 'Figma', source: 'start-menu' })
  })

  it('attaches icon data URLs when file icon loading succeeds', async () => {
    const candidate = createShortcutCandidate({
      source: 'start-menu',
      name: 'Figma',
      targetPath: 'C:\\Users\\user\\AppData\\Local\\Figma\\Figma.exe'
    })

    expect(candidate).not.toBeNull()

    const candidates = await attachIconDataUrls([candidate!], async () => ({
      isEmpty: () => false,
      toDataURL: () => 'data:image/png;base64,abc'
    }))

    expect(candidates[0]).toMatchObject({
      iconDataUrl: 'data:image/png;base64,abc'
    })
  })

  it('keeps candidates when file icon loading fails', async () => {
    const candidate = createShortcutCandidate({
      source: 'start-menu',
      name: 'Notion',
      targetPath: 'C:\\Users\\user\\AppData\\Local\\Notion\\Notion.exe'
    })

    expect(candidate).not.toBeNull()

    const candidates = await attachIconDataUrls([candidate!], async () => {
      throw new Error('icon load failed')
    })

    expect(candidates[0]).toEqual(candidate)
  })
})
