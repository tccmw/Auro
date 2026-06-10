import { app, BrowserWindow, Menu, Tray } from 'electron'
import { join } from 'node:path'
import { IPC_CHANNELS } from '../shared/ipc'
import type { IpcChannel } from '../shared/ipc'
import type {
  NotificationHistory,
  SettingsUpdatePayload,
  TrackingStatusPayload,
  UsageUpdatePayload
} from '../shared/types'
import { createInstalledAppAdapter } from './installedApps/installedApps'
import { registerIpcHandlers } from './ipc/ipcHandlers'
import { ElectronNotificationService } from './notification/notifier'
import { createProcessAdapter } from './tracking/processAdapter'
import { UsageTracker } from './tracking/usageTracker'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
const appIconPath = join(app.getAppPath(), 'src/main/assets/auro-icon.png')

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

function applyAppSettings(payload: SettingsUpdatePayload): void {
  if (process.platform !== 'win32') {
    return
  }

  app.setLoginItemSettings({
    openAtLogin: payload.settings.launchAtLoginEnabled
  })
}

registerIpcHandlers(
  tracker,
  createInstalledAppAdapter(process.platform, app.getFileIcon.bind(app)),
  applyAppSettings
)

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
  }

  mainWindow?.show()
  mainWindow?.focus()
}

function quitApp(): void {
  isQuitting = true
  tracker.stop()
  app.quit()
}

function createTray(): void {
  if (tray) {
    return
  }

  tray = new Tray(appIconPath)
  tray.setToolTip('Auro')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Auro 열기',
        click: showMainWindow
      },
      { type: 'separator' },
      {
        label: '종료',
        click: quitApp
      }
    ])
  )
  tray.on('double-click', showMainWindow)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 780,
    minWidth: 940,
    minHeight: 620,
    title: 'Auro',
    icon: appIconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.setMenu(null)
  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return
    }

    event.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  app.setName('Auro')
  Menu.setApplicationMenu(null)
  createWindow()
  createTray()
  tracker.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
  }
})
