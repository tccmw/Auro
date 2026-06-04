import type { TrackedApp } from '../../shared/types'
export { normalizeProcessName } from '../../shared/process'
import { normalizeProcessName } from '../../shared/process'

export function createProcessNameSet(processNames: string[]): Set<string> {
  return new Set(
    processNames
      .map(normalizeProcessName)
      .filter((processName) => processName.length > 0)
  )
}

export function matchTrackedApps(trackedApps: TrackedApp[], runningProcessNames: string[]): TrackedApp[] {
  const runningProcesses = createProcessNameSet(runningProcessNames)

  return trackedApps.filter((app) => runningProcesses.has(normalizeProcessName(app.processName)))
}
