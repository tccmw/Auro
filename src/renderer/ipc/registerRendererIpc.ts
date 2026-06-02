import { useUsageStore } from '../stores/usageStore'

export function registerRendererIpc(): () => void {
  if (!window.limitoApi) {
    return () => undefined
  }

  const unsubscribeUsage = window.limitoApi.onUsageUpdate((payload) => {
    useUsageStore.getState().applyUsageUpdate(payload)
  })
  const unsubscribeNotification = window.limitoApi.onNotificationSent((payload) => {
    useUsageStore.getState().addNotification(payload)
  })
  const unsubscribeStatus = window.limitoApi.onTrackingStatus((payload) => {
    useUsageStore.getState().setTrackingStatus(payload)
  })

  void useUsageStore.getState().hydrateMainProcessSettings()

  return () => {
    unsubscribeUsage()
    unsubscribeNotification()
    unsubscribeStatus()
  }
}
