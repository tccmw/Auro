export const IPC_CHANNELS = {
  INSTALLED_APPS_LIST: 'installed-apps:list',
  SETTINGS_UPDATE: 'settings:update',
  USAGE_UPDATE: 'usage:update',
  NOTIFICATION_SENT: 'notification:sent',
  APP_BLOCKED: 'app:block',
  TRACKING_STATUS: 'tracking:status'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
