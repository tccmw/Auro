import { Notification } from 'electron'
import type { TrackedApp } from '../../shared/types'

export interface NotificationService {
  sendLimitNotification: (app: TrackedApp, usageSeconds: number) => Promise<void>
}

export class ElectronNotificationService implements NotificationService {
  async sendLimitNotification(app: TrackedApp, usageSeconds: number): Promise<void> {
    if (!Notification.isSupported()) {
      throw new Error('Desktop notifications are not supported in this environment.')
    }

    const usedMinutes = Math.floor(usageSeconds / 60)
    const limitMinutes = app.dailyLimitMinutes

    new Notification({
      title: `${app.name} 제한 시간 도달`,
      body: `오늘 ${usedMinutes}분 사용했습니다. 설정한 제한은 ${limitMinutes}분입니다.`
    }).show()
  }
}
