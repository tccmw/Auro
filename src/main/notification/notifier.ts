import { Notification } from 'electron'
import type { TrackedApp } from '../../shared/types'

export interface NotificationService {
  sendLimitNotification: (app: TrackedApp, usageSeconds: number) => Promise<void>
  sendBlockNotification: (app: TrackedApp, usageSeconds: number) => Promise<void>
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

  async sendBlockNotification(app: TrackedApp, usageSeconds: number): Promise<void> {
    if (!Notification.isSupported()) {
      throw new Error('Desktop notifications are not supported in this environment.')
    }

    const usedMinutes = Math.floor(usageSeconds / 60)
    const limitMinutes = app.dailyLimitMinutes

    new Notification({
      title: `${app.name} 실행 차단`,
      body: `오늘 ${usedMinutes}분 사용해 ${limitMinutes}분 제한을 넘었습니다. 앱을 종료했으며 내일 다시 사용할 수 있습니다.`
    }).show()
  }
}
