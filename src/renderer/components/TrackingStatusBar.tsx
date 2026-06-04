import { AlertTriangle, CheckCircle2, CircleOff } from 'lucide-react'
import type { TrackingStatusPayload } from '../../shared/types'

interface TrackingStatusBarProps {
  status: TrackingStatusPayload
}

export function TrackingStatusBar({ status }: TrackingStatusBarProps) {
  const icon = status.error ? (
    <AlertTriangle size={17} />
  ) : status.running ? (
    <CheckCircle2 size={17} />
  ) : (
    <CircleOff size={17} />
  )

  const label = status.error ? status.error : status.running ? '추적 루프 실행 중' : '추적 대기'

  return (
    <div className={status.error ? 'status-bar error' : 'status-bar'}>
      {icon}
      <span>{label}</span>
      {status.lastCheckedAt && (
        <time dateTime={status.lastCheckedAt}>
          {new Date(status.lastCheckedAt).toLocaleTimeString('ko-KR')}
        </time>
      )}
    </div>
  )
}
