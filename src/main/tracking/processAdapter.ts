import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ProcessSnapshotProvider {
  getActiveProcessName: () => Promise<string | null>
}

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

function encodePowerShellCommand(command: string): string {
  return Buffer.from(command.trim(), 'utf16le').toString('base64')
}

export function parseActiveProcessName(stdout: string): string | null {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? null
}

export class WindowsProcessAdapter implements ProcessSnapshotProvider {
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
}

export class EmptyProcessAdapter implements ProcessSnapshotProvider {
  async getActiveProcessName(): Promise<string | null> {
    return null
  }
}

export function createProcessAdapter(platform = process.platform): ProcessSnapshotProvider {
  if (platform === 'win32') {
    return new WindowsProcessAdapter()
  }

  return new EmptyProcessAdapter()
}
