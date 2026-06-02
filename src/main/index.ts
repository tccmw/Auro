import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { IPC_CHANNELS } from '../shared/ipc'
import type { IpcChannel } from '../shared/ipc'
import type { NotificationHistory, TrackingStatusPayload, UsageUpdatePayload } from '../shared/types'
import { createInstalledAppAdapter } from './installedApps/installedApps'
import { registerIpcHandlers } from './ipc/ipcHandlers'
import { ElectronNotificationService } from './notification/notifier'
import { createProcessAdapter } from './tracking/processAdapter'
import { UsageTracker } from './tracking/usageTracker'

let mainWindow: BrowserWindow | null = null

function sendToRenderer<T>(channel: IpcChannel, payload: T): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  })
}

const tracker = new UsageTracker({
  processProvider: createProcessAdapter(),
  notificationService: new ElectronNotificationService(),
  events: {
    emitUsageUpdate: (payload: UsageUpdatePayload) => sendToRenderer(IPC_CHANNELS.USAGE_UPDATE, payload),
    emitNotificationSent: (payload: NotificationHistory) =>
      sendToRenderer(IPC_CHANNELS.NOTIFICATION_SENT, payload),
    emitTrackingStatus: (payload: TrackingStatusPayload) =>
      sendToRenderer(IPC_CHANNELS.TRACKING_STATUS, payload)
  }
})

registerIpcHandlers(tracker, createInstalledAppAdapter(process.platform, app.getFileIcon.bind(app)))

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 780,
    minWidth: 940,
    minHeight: 620,
    title: 'Limito',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  createWindow()
  tracker.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    tracker.stop()
    app.quit()
  }
})
