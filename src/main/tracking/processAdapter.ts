import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ProcessSnapshotProvider {
  getRunningProcesses: () => Promise<string[]>
}

export class WindowsProcessAdapter implements ProcessSnapshotProvider {
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
}

export class EmptyProcessAdapter implements ProcessSnapshotProvider {
  async getRunningProcesses(): Promise<string[]> {
    return []
  }
}

export function createProcessAdapter(platform = process.platform): ProcessSnapshotProvider {
  if (platform === 'win32') {
    return new WindowsProcessAdapter()
  }

  return new EmptyProcessAdapter()
}
