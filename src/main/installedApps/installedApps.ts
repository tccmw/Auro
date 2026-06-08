import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { normalizeProcessName } from '../../shared/process'
import type { InstalledAppCandidate, InstalledAppSource } from '../../shared/types'

const execFileAsync = promisify(execFile)

const INSTALLER_EXECUTABLE_TERMS = ['uninstall', 'unins', 'setup', 'installer', 'update']
const WINDOWS_INSTALLED_APPS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
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
}

type RawInstalledAppEntry = ShortcutRawEntry | RegistryRawEntry

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

export function isInstallerLikeExecutable(executablePath: string): boolean {
  const processName = normalizeProcessName(executablePath)
  return INSTALLER_EXECUTABLE_TERMS.some((term) => processName.includes(term))
}

function createCandidate(input: {
  name: string | undefined
  executablePath: string | null
  source: InstalledAppSource
  publisher?: string
  iconPath?: string | null
}): InstalledAppCandidate | null {
  if (!input.name?.trim() || !isWindowsExecutablePath(input.executablePath)) {
    return null
  }

  if (isInstallerLikeExecutable(input.executablePath)) {
    return null
  }

  const executablePath = input.executablePath.trim().replace(/^"|"$/g, '')
  const processName = normalizeProcessName(executablePath)

  if (!processName) {
    return null
  }

  return {
    id: normalizeExecutablePath(executablePath),
    name: input.name.trim(),
    processName,
    executablePath,
    source: input.source,
    publisher: input.publisher?.trim() || undefined,
    iconPath: input.iconPath?.trim() || undefined
  }
}

export function createShortcutCandidate(entry: ShortcutRawEntry): InstalledAppCandidate | null {
  if (entry.arguments && /shell:|appsfolder/i.test(entry.arguments)) {
    return null
  }

  return createCandidate({
    name: entry.name,
    executablePath: entry.targetPath ?? null,
    source: 'start-menu',
    iconPath: extractExecutablePath(entry.iconLocation)
  })
}

export function createRegistryCandidate(entry: RegistryRawEntry): InstalledAppCandidate | null {
  const executablePath = extractExecutablePath(entry.displayIcon)

  return createCandidate({
    name: entry.name,
    executablePath,
    source: 'registry',
    publisher: entry.publisher,
    iconPath: executablePath
  })
}

export function dedupeInstalledAppCandidates(
  candidates: InstalledAppCandidate[]
): InstalledAppCandidate[] {
  const byExecutablePath = new Map<string, InstalledAppCandidate>()

  for (const candidate of candidates) {
    const key = normalizeExecutablePath(candidate.executablePath)
    const existing = byExecutablePath.get(key)

    if (!existing || (existing.source === 'registry' && candidate.source === 'start-menu')) {
      byExecutablePath.set(key, candidate)
    }
  }

  return Array.from(byExecutablePath.values()).sort((left, right) =>
    left.name.localeCompare(right.name, 'ko-KR', { sensitivity: 'base' })
  )
}

export async function attachIconDataUrls(
  candidates: InstalledAppCandidate[],
  loadFileIcon: FileIconLoader
): Promise<InstalledAppCandidate[]> {
  return Promise.all(
    candidates.map(async (candidate) => {
      try {
        const icon = await loadFileIcon(candidate.executablePath, { size: 'normal' })

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
      { windowsHide: true, timeout: 10_000, maxBuffer: 4 * 1024 * 1024 }
    )

    const parsed = stdout.trim() ? JSON.parse(stdout) : []
    const candidates = toArray(parsed)
      .map((entry) =>
        entry.source === 'start-menu' ? createShortcutCandidate(entry) : createRegistryCandidate(entry)
      )
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
