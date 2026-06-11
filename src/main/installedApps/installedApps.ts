import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { normalizeProcessName } from '../../shared/process'
import type { InstalledAppCandidate, InstalledAppSource } from '../../shared/types'

const execFileAsync = promisify(execFile)

const INSTALLER_EXECUTABLE_TERMS = ['uninstall', 'unins', 'setup', 'installer', 'update']
const WINDOWS_INSTALLED_APPS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$items = @()
$shortcutDirs = @([Environment]::GetFolderPath('StartMenu'), [Environment]::GetFolderPath('CommonStartMenu')) | Where-Object { $_ -and (Test-Path $_) }
$shell = New-Object -ComObject WScript.Shell
foreach ($dir in $shortcutDirs) {
  Get-ChildItem -Path $dir -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      $shortcut = $shell.CreateShortcut($_.FullName)
      $items += [PSCustomObject]@{
        source = 'start-menu'
        name = [IO.Path]::GetFileNameWithoutExtension($_.Name)
        targetPath = $shortcut.TargetPath
        arguments = $shortcut.Arguments
        iconLocation = $shortcut.IconLocation
      }
    } catch {}
  }
}
$windowsAppsDir = Join-Path $env:LOCALAPPDATA 'Microsoft\\WindowsApps'
if ($windowsAppsDir -and (Test-Path $windowsAppsDir)) {
  Get-ChildItem -Path $windowsAppsDir -Filter *.exe -File -ErrorAction SilentlyContinue | ForEach-Object {
    $items += [PSCustomObject]@{
      source = 'windows-apps'
      name = [IO.Path]::GetFileNameWithoutExtension($_.Name)
      executablePath = $_.FullName
    }
  }
}
if (Get-Command Get-StartApps -ErrorAction SilentlyContinue) {
  Get-StartApps | Where-Object { $_.Name -and $_.AppID } | ForEach-Object {
    $items += [PSCustomObject]@{
      source = 'appsfolder'
      name = $_.Name
      appUserModelId = $_.AppID
    }
  }
}
$registryPaths = @(
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
Get-ItemProperty $registryPaths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName } | ForEach-Object {
  $items += [PSCustomObject]@{
    source = 'registry'
    name = $_.DisplayName
    displayIcon = $_.DisplayIcon
    publisher = $_.Publisher
    installLocation = $_.InstallLocation
    uninstallString = $_.UninstallString
  }
}
@($items) | ConvertTo-Json -Compress -Depth 3
`

interface ShortcutRawEntry {
  source: 'start-menu'
  name?: string
  targetPath?: string
  arguments?: string
  iconLocation?: string
}

interface RegistryRawEntry {
  source: 'registry'
  name?: string
  displayIcon?: string
  publisher?: string
  installLocation?: string
  uninstallString?: string
}

interface WindowsAppsRawEntry {
  source: 'windows-apps'
  name?: string
  executablePath?: string
}

interface AppsfolderRawEntry {
  source: 'appsfolder'
  name?: string
  appUserModelId?: string
}

type RawInstalledAppEntry =
  | ShortcutRawEntry
  | RegistryRawEntry
  | WindowsAppsRawEntry
  | AppsfolderRawEntry

export interface InstalledAppProvider {
  listInstalledApps: () => Promise<InstalledAppCandidate[]>
}

export interface FileIconImage {
  isEmpty?: () => boolean
  toDataURL: () => string
}

export type FileIconLoader = (
  path: string,
  options?: { size: 'small' | 'normal' | 'large' }
) => Promise<FileIconImage>

export function encodePowerShellCommand(command: string): string {
  return Buffer.from(command.trim(), 'utf16le').toString('base64')
}

export function normalizeExecutablePath(executablePath: string): string {
  return executablePath.trim().replace(/^"|"$/g, '').toLowerCase()
}

export function isWindowsExecutablePath(executablePath: string | null | undefined): executablePath is string {
  return typeof executablePath === 'string' && /\.exe$/i.test(executablePath.trim().replace(/^"|"$/g, ''))
}

export function extractExecutablePath(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  const quotedMatch = trimmed.match(/"([^"]+\.exe)"/i)

  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  const unquotedMatch = trimmed.match(/^(.+?\.exe)(?:,.*)?$/i)

  return unquotedMatch?.[1]?.trim() ?? null
}

export function extractIconPath(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  const quotedMatch = trimmed.match(/"([^"]+\.(?:exe|ico))"/i)

  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  const unquotedMatch = trimmed.match(/^(.+?\.(?:exe|ico))(?:,.*)?$/i)

  return unquotedMatch?.[1]?.trim() ?? null
}

export function isInstallerLikeExecutable(executablePath: string): boolean {
  const processName = normalizeProcessName(executablePath)
  return INSTALLER_EXECUTABLE_TERMS.some((term) => processName.includes(term))
}

export function extractProcessStartExecutable(argumentsValue: string | null | undefined): string | null {
  if (!argumentsValue) {
    return null
  }

  const processStartMatch = argumentsValue.match(
    /(?:^|\s)--processStart\s+(?:"([^"]+\.exe)"|([^\s"]+\.exe))/i
  )

  return processStartMatch?.[1] ?? processStartMatch?.[2] ?? null
}

function trimOrUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function createCandidateId(input: {
  source: InstalledAppSource
  name: string
  publisher?: string
  executablePath?: string
  processName?: string
  appUserModelId?: string
}): string {
  if (input.executablePath) {
    const normalizedPath = normalizeExecutablePath(input.executablePath)

    return input.processName && normalizeProcessName(input.executablePath) !== input.processName
      ? `${normalizedPath}::${input.processName}`
      : normalizedPath
  }

  return [input.source, input.name, input.publisher, input.appUserModelId]
    .map((part) => part?.trim().toLowerCase())
    .filter(Boolean)
    .join(':')
}

function createUntrackableCandidate(input: {
  name: string | undefined
  source: InstalledAppSource
  reason: string
  publisher?: string
  executablePath?: string | null
  iconPath?: string | null
  appUserModelId?: string
}): InstalledAppCandidate | null {
  const name = trimOrUndefined(input.name)

  if (!name) {
    return null
  }

  const executablePath = isWindowsExecutablePath(input.executablePath)
    ? input.executablePath.trim().replace(/^"|"$/g, '')
    : undefined
  const publisher = trimOrUndefined(input.publisher)
  const appUserModelId = trimOrUndefined(input.appUserModelId)

  return {
    id: createCandidateId({
      source: input.source,
      name,
      publisher,
      executablePath,
      appUserModelId
    }),
    name,
    executablePath,
    source: input.source,
    trackable: false,
    reason: input.reason,
    publisher,
    iconPath: trimOrUndefined(input.iconPath)
  }
}

function createCandidate(input: {
  name: string | undefined
  executablePath: string | null
  source: InstalledAppSource
  publisher?: string
  iconPath?: string | null
  processName?: string | null
}): InstalledAppCandidate | null {
  const name = trimOrUndefined(input.name)

  if (!name) {
    return null
  }

  if (!isWindowsExecutablePath(input.executablePath)) {
    return createUntrackableCandidate({
      name,
      executablePath: input.executablePath,
      source: input.source,
      publisher: input.publisher,
      iconPath: input.iconPath,
      reason: '프로세스 이름 확인 필요'
    })
  }

  const executablePath = input.executablePath.trim().replace(/^"|"$/g, '')
  const processName = normalizeProcessName(input.processName ?? executablePath)

  if (!processName) {
    return createUntrackableCandidate({
      name,
      executablePath,
      source: input.source,
      publisher: input.publisher,
      iconPath: input.iconPath,
      reason: '프로세스 이름 확인 필요'
    })
  }

  if (!input.processName && isInstallerLikeExecutable(executablePath)) {
    return createUntrackableCandidate({
      name,
      executablePath,
      source: input.source,
      publisher: input.publisher,
      iconPath: input.iconPath,
      reason: '설치/업데이트 실행 파일은 추적할 수 없음'
    })
  }

  return {
    id: createCandidateId({
      source: input.source,
      name,
      publisher: input.publisher,
      executablePath,
      processName
    }),
    name,
    processName,
    executablePath,
    source: input.source,
    trackable: true,
    publisher: trimOrUndefined(input.publisher),
    iconPath: trimOrUndefined(input.iconPath)
  }
}

export function createShortcutCandidate(entry: ShortcutRawEntry): InstalledAppCandidate | null {
  if (entry.arguments && /shell:|appsfolder/i.test(entry.arguments)) {
    return createUntrackableCandidate({
      name: entry.name,
      source: 'appsfolder',
      iconPath: extractIconPath(entry.iconLocation),
      reason: 'Microsoft Store 앱은 프로세스 이름 확인 필요'
    })
  }

  const processStartExecutable = extractProcessStartExecutable(entry.arguments)

  return createCandidate({
    name: entry.name,
    executablePath: entry.targetPath ?? null,
    source: 'start-menu',
    iconPath: extractIconPath(entry.iconLocation),
    processName: processStartExecutable
  })
}

export function createRegistryCandidate(entry: RegistryRawEntry): InstalledAppCandidate | null {
  const executablePath = extractExecutablePath(entry.displayIcon)

  return createCandidate({
    name: entry.name,
    executablePath,
    source: 'registry',
    publisher: entry.publisher,
    iconPath: extractIconPath(entry.displayIcon) ?? executablePath
  })
}

export function createWindowsAppsCandidate(entry: WindowsAppsRawEntry): InstalledAppCandidate | null {
  return createCandidate({
    name: entry.name,
    executablePath: entry.executablePath ?? null,
    source: 'windows-apps',
    iconPath: entry.executablePath
  })
}

export function createAppsfolderCandidate(entry: AppsfolderRawEntry): InstalledAppCandidate | null {
  return createUntrackableCandidate({
    name: entry.name,
    source: 'appsfolder',
    reason: 'Microsoft Store 앱은 프로세스 이름 확인 필요',
    appUserModelId: entry.appUserModelId
  })
}

const SOURCE_PRIORITY: Record<InstalledAppSource, number> = {
  'start-menu': 0,
  'windows-apps': 1,
  registry: 2,
  appsfolder: 3
}

function getDedupeKey(candidate: InstalledAppCandidate): string {
  if (candidate.executablePath) {
    return `path:${normalizeExecutablePath(candidate.executablePath)}`
  }

  return `metadata:${candidate.name.trim().toLowerCase()}:${candidate.publisher?.trim().toLowerCase() ?? ''}`
}

function shouldReplaceCandidate(
  existing: InstalledAppCandidate,
  candidate: InstalledAppCandidate
): boolean {
  if (existing.trackable !== candidate.trackable) {
    return candidate.trackable
  }

  return SOURCE_PRIORITY[candidate.source] < SOURCE_PRIORITY[existing.source]
}

export function dedupeInstalledAppCandidates(
  candidates: InstalledAppCandidate[]
): InstalledAppCandidate[] {
  const byDedupeKey = new Map<string, InstalledAppCandidate>()

  for (const candidate of candidates) {
    const key = getDedupeKey(candidate)
    const existing = byDedupeKey.get(key)

    if (!existing || shouldReplaceCandidate(existing, candidate)) {
      byDedupeKey.set(key, candidate)
    }
  }

  return Array.from(byDedupeKey.values()).sort((left, right) =>
    left.name.localeCompare(right.name, 'ko-KR', { sensitivity: 'base' })
  )
}

export async function attachIconDataUrls(
  candidates: InstalledAppCandidate[],
  loadFileIcon: FileIconLoader
): Promise<InstalledAppCandidate[]> {
  return Promise.all(
    candidates.map(async (candidate) => {
      const iconPath = candidate.iconPath ?? candidate.executablePath

      if (!iconPath) {
        return candidate
      }

      try {
        const icon = await loadFileIcon(iconPath, { size: 'normal' })

        if (icon.isEmpty?.()) {
          return candidate
        }

        const iconDataUrl = icon.toDataURL()

        return iconDataUrl ? { ...candidate, iconDataUrl } : candidate
      } catch {
        return candidate
      }
    })
  )
}

function toArray(value: unknown): RawInstalledAppEntry[] {
  if (Array.isArray(value)) {
    return value as RawInstalledAppEntry[]
  }

  if (value && typeof value === 'object') {
    return [value as RawInstalledAppEntry]
  }

  return []
}

export class WindowsInstalledAppAdapter implements InstalledAppProvider {
  constructor(private readonly loadFileIcon?: FileIconLoader) {}

  async listInstalledApps(): Promise<InstalledAppCandidate[]> {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        encodePowerShellCommand(WINDOWS_INSTALLED_APPS_SCRIPT)
      ],
      { windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 }
    )

    const parsed = stdout.trim() ? JSON.parse(stdout) : []
    const candidates = toArray(parsed)
      .map((entry) => {
        switch (entry.source) {
          case 'start-menu':
            return createShortcutCandidate(entry)
          case 'windows-apps':
            return createWindowsAppsCandidate(entry)
          case 'appsfolder':
            return createAppsfolderCandidate(entry)
          case 'registry':
          default:
            return createRegistryCandidate(entry)
        }
      })
      .filter((candidate): candidate is InstalledAppCandidate => candidate !== null)

    const dedupedCandidates = dedupeInstalledAppCandidates(candidates)

    if (!this.loadFileIcon) {
      return dedupedCandidates
    }

    return attachIconDataUrls(dedupedCandidates, this.loadFileIcon)
  }
}

export class EmptyInstalledAppAdapter implements InstalledAppProvider {
  async listInstalledApps(): Promise<InstalledAppCandidate[]> {
    return []
  }
}

export function createInstalledAppAdapter(
  platform = process.platform,
  loadFileIcon?: FileIconLoader
): InstalledAppProvider {
  if (platform === 'win32') {
    return new WindowsInstalledAppAdapter(loadFileIcon)
  }

  return new EmptyInstalledAppAdapter()
}
