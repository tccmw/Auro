import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import type { SettingsUpdatePayload } from '../../shared/types'
import type { InstalledAppProvider } from '../installedApps/installedApps'
import type { UsageTracker } from '../tracking/usageTracker'

export function registerIpcHandlers(
  tracker: UsageTracker,
  installedAppProvider: InstalledAppProvider
): void {
  ipcMain.handle(IPC_CHANNELS.INSTALLED_APPS_LIST, () => installedAppProvider.listInstalledApps())

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_event, payload: SettingsUpdatePayload) => {
    tracker.updateConfig(payload)
  })
}
