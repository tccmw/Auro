import { describe, expect, it } from 'vitest'
import {
  attachIconDataUrls,
  createAppsfolderCandidate,
  createRegistryCandidate,
  createShortcutCandidate,
  createWindowsAppsCandidate,
  dedupeInstalledAppCandidates,
  encodePowerShellCommand,
  extractExecutablePath,
  extractIconPath,
  extractProcessStartExecutable,
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
    expect(extractIconPath('C:\\Program Files\\App\\App.ico,0')).toBe(
      'C:\\Program Files\\App\\App.ico'
    )
  })

  it('creates shortcut candidates when process names can be inferred', () => {
    expect(
      createShortcutCandidate({
        source: 'start-menu',
        name: 'Figma',
        targetPath: 'C:\\Users\\user\\AppData\\Local\\Figma\\Figma.exe'
      })
    ).toMatchObject({
      name: 'Figma',
      processName: 'figma',
      source: 'start-menu',
      trackable: true
    })

    expect(
      createShortcutCandidate({
        source: 'start-menu',
        name: 'Store app',
        targetPath: 'C:\\Windows\\explorer.exe',
        arguments: 'shell:AppsFolder\\Some.App'
      })
    ).toMatchObject({
      name: 'Store app',
      source: 'appsfolder',
      trackable: false
    })
    expect(
      createShortcutCandidate({
        source: 'start-menu',
        name: 'Store app',
        targetPath: 'C:\\Windows\\explorer.exe',
        arguments: 'shell:AppsFolder\\Some.App'
      })?.executablePath
    ).toBeUndefined()
  })

  it('infers process names from Squirrel updater shortcuts', () => {
    expect(extractProcessStartExecutable('--processStart Discord.exe')).toBe('Discord.exe')

    expect(
      createShortcutCandidate({
        source: 'start-menu',
        name: 'Discord',
        targetPath: 'C:\\Users\\user\\AppData\\Local\\Discord\\Update.exe',
        arguments: '--processStart Discord.exe',
        iconLocation: 'C:\\Users\\user\\AppData\\Local\\Discord\\app.ico,0'
      })
    ).toMatchObject({
      name: 'Discord',
      processName: 'discord',
      executablePath: 'C:\\Users\\user\\AppData\\Local\\Discord\\Update.exe',
      iconPath: 'C:\\Users\\user\\AppData\\Local\\Discord\\app.ico',
      trackable: true
    })
  })

  it('keeps registry candidates and marks missing or installer-like process names untrackable', () => {
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
      publisher: 'Google',
      trackable: true
    })

    expect(
      createRegistryCandidate({
        source: 'registry',
        name: 'Updater',
        displayIcon: 'C:\\Program Files\\Updater\\Update.exe'
      })
    ).toMatchObject({
      name: 'Updater',
      trackable: false
    })
    expect(
      createRegistryCandidate({
        source: 'registry',
        name: 'Runtime',
        publisher: 'Runtime Publisher'
      })
    ).toMatchObject({
      name: 'Runtime',
      publisher: 'Runtime Publisher',
      trackable: false
    })
    expect(isInstallerLikeExecutable('C:\\Program Files\\App\\uninstall.exe')).toBe(true)
  })

  it('creates WindowsApps alias and AppsFolder candidates', () => {
    expect(
      createWindowsAppsCandidate({
        source: 'windows-apps',
        name: 'chatgpt',
        executablePath: 'C:\\Users\\user\\AppData\\Local\\Microsoft\\WindowsApps\\chatgpt.exe'
      })
    ).toMatchObject({
      name: 'chatgpt',
      processName: 'chatgpt',
      source: 'windows-apps',
      trackable: true
    })

    expect(
      createAppsfolderCandidate({
        source: 'appsfolder',
        name: 'Microsoft To Do',
        appUserModelId: 'Microsoft.Todos_8wekyb3d8bbwe!App'
      })
    ).toMatchObject({
      name: 'Microsoft To Do',
      source: 'appsfolder',
      trackable: false
    })
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

  it('dedupes by executable path and prefers trackable candidates', () => {
    const registryCandidate = createRegistryCandidate({
      source: 'registry',
      name: 'Discord',
      displayIcon: 'C:\\Users\\user\\AppData\\Local\\Discord\\Update.exe'
    })
    const shortcutCandidate = createShortcutCandidate({
      source: 'start-menu',
      name: 'Discord',
      targetPath: 'C:\\Users\\user\\AppData\\Local\\Discord\\Update.exe',
      arguments: '--processStart Discord.exe'
    })

    expect(registryCandidate).not.toBeNull()
    expect(shortcutCandidate).not.toBeNull()

    const deduped = dedupeInstalledAppCandidates([registryCandidate!, shortcutCandidate!])

    expect(deduped).toHaveLength(1)
    expect(deduped[0]).toMatchObject({ processName: 'discord', trackable: true })
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
