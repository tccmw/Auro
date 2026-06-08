import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type {
  AuroApi,
  InstalledAppCandidate,
  NotificationHistory,
  SettingsUpdatePayload,
  TrackingStatusPayload,
  UsageUpdatePayload
} from '../shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => {
    callback(payload)
  }

  ipcRenderer.on(channel, listener)

  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: AuroApi = {
  listInstalledApps: async () => {
    return ipcRenderer.invoke(IPC_CHANNELS.INSTALLED_APPS_LIST) as Promise<InstalledAppCandidate[]>
  },
  updateSettings: async (payload: SettingsUpdatePayload) => {
    await ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, payload)
  },
  onUsageUpdate: (callback) => subscribe<UsageUpdatePayload>(IPC_CHANNELS.USAGE_UPDATE, callback),
  onNotificationSent: (callback) =>
    subscribe<NotificationHistory>(IPC_CHANNELS.NOTIFICATION_SENT, callback),
  onTrackingStatus: (callback) => subscribe<TrackingStatusPayload>(IPC_CHANNELS.TRACKING_STATUS, callback)
}

contextBridge.exposeInMainWorld('auroApi', api)
contextBridge.exposeInMainWorld('limitoApi', api)
