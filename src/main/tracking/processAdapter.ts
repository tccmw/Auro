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

const WINDOWS_FOREGROUND_PROCESS_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class AuroForegroundWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$handle = [AuroForegroundWindow]::GetForegroundWindow()
if ($handle -eq [IntPtr]::Zero) { return }

$processId = 0
[void][AuroForegroundWindow]::GetWindowThreadProcessId($handle, [ref]$processId)
if ($processId -le 0) { return }

(Get-Process -Id $processId -ErrorAction Stop).ProcessName
`

export interface ProcessSnapshotProvider {
  getActiveProcessName: () => Promise<string | null>
}

export interface ProcessTerminator {
  terminateProcessByName: (processName: string) => Promise<void>
}

function encodePowerShellCommand(command: string): string {
  return Buffer.from(command.trim(), 'utf16le').toString('base64')
}

export function parseActiveProcessName(stdout: string): string | null {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? null
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
  async getActiveProcessName(): Promise<string | null> {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        encodePowerShellCommand(WINDOWS_FOREGROUND_PROCESS_SCRIPT)
      ],
      { windowsHide: true, timeout: 5000 }
    )

    return parseActiveProcessName(stdout)
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

export class EmptyProcessAdapter implements ProcessSnapshotProvider, ProcessTerminator {
  async getActiveProcessName(): Promise<string | null> {
    return null
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
