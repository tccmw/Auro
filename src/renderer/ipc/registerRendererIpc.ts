import { useUsageStore } from '../stores/usageStore'

export function registerRendererIpc(): () => void {
  const api = window.auroApi ?? window.limitoApi

  if (!api) {
    return () => undefined
  }

  const unsubscribeUsage = api.onUsageUpdate((payload) => {
    useUsageStore.getState().applyUsageUpdate(payload)
  })
  const unsubscribeNotification = api.onNotificationSent((payload) => {
    useUsageStore.getState().addNotification(payload)
  })
  const unsubscribeBlocked = api.onAppBlocked((payload) => {
    useUsageStore.getState().addBlockedApp(payload)
  })
  const unsubscribeStatus = api.onTrackingStatus((payload) => {
    useUsageStore.getState().setTrackingStatus(payload)
  })

  void useUsageStore.getState().hydrateMainProcessSettings()

  return () => {
    unsubscribeUsage()
    unsubscribeNotification()
    unsubscribeBlocked()
    unsubscribeStatus()
  }
}
