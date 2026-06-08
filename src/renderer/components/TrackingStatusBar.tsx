import { AlertTriangle, CheckCircle2, CircleOff } from 'lucide-react'
import type { TrackingStatusPayload } from '../../shared/types'

interface TrackingStatusBarProps {
  status: TrackingStatusPayload
}

function formatCheckedTime(lastCheckedAt: string): string {
  return new Date(lastCheckedAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function TrackingStatusBar({ status }: TrackingStatusBarProps) {
  const icon = status.error ? (
    <AlertTriangle size={17} />
  ) : status.running ? (
    <CheckCircle2 size={17} />
  ) : (
    <CircleOff size={17} />
  )

  const label = status.error
    ? status.error
    : status.running
      ? '실시간 사용량을 추적하고 있습니다.'
      : '추적 루프가 대기 중입니다.'

  return (
    <div className={status.error ? 'status-bar error' : 'status-bar'}>
      {icon}
      <span>{label}</span>
      {status.lastCheckedAt && (
        <time dateTime={status.lastCheckedAt}>마지막 확인 {formatCheckedTime(status.lastCheckedAt)}</time>
      )}
    </div>
  )
}
