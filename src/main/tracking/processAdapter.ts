import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { normalizeProcessName } from '../../shared/process'

const execFileAsync = promisify(execFile)
const WINDOWS_TERMINATE_PROCESS_SCRIPT = `
param([string]$target)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$processes = @(Get-Process -ErrorAction Stop | Where-Object { $_.ProcessName -eq $target })
foreach ($process in $processes) {
  & taskkill.exe /PID $process.Id /F /T 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
    throw "Failed to terminate process $($process.ProcessName) ($($process.Id))."
  }
}
`

export interface ProcessSnapshotProvider {
  getRunningProcesses: () => Promise<string[]>
}

export interface ProcessTerminator {
  terminateProcessByName: (processName: string) => Promise<void>
}

export function assertSafeWindowsProcessName(processName: string): void {
  if (!processName || /[*?]/.test(processName)) {
    throw new Error('Invalid process name for app blocking.')
  }
}

export function createWindowsTerminateProcessArguments(processName: string): string[] {
  return [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `& { ${WINDOWS_TERMINATE_PROCESS_SCRIPT} }`,
    processName
  ]
}

export class WindowsProcessAdapter implements ProcessSnapshotProvider, ProcessTerminator {
  async getRunningProcesses(): Promise<string[]> {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-Command', 'Get-Process | Select-Object -ExpandProperty ProcessName'],
      { windowsHide: true, timeout: 5000 }
    )

    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }

  async terminateProcessByName(processName: string): Promise<void> {
    const normalizedProcessName = normalizeProcessName(processName)

    if (!normalizedProcessName) {
      return
    }

    assertSafeWindowsProcessName(normalizedProcessName)

    await execFileAsync(
      'powershell.exe',
      createWindowsTerminateProcessArguments(normalizedProcessName),
      { windowsHide: true, timeout: 5000 }
    )
  }
}

export class EmptyProcessAdapter implements ProcessSnapshotProvider {
  async getRunningProcesses(): Promise<string[]> {
    return []
  }

  async terminateProcessByName(): Promise<void> {
    throw new Error('App blocking is only supported on Windows in this version.')
  }
}

export function createProcessAdapter(platform = process.platform): ProcessSnapshotProvider & ProcessTerminator {
  if (platform === 'win32') {
    return new WindowsProcessAdapter()
  }

  return new EmptyProcessAdapter()
}
