import { AlertTriangle } from 'lucide-react'
import type { LimitEventItem } from './limitEvents'
import { formatLimitEventTime } from './limitEvents'

interface LimitEventListProps {
  events: LimitEventItem[]
  emptyLabel?: string
}

export function LimitEventList({ events, emptyLabel = '표시할 이벤트가 없습니다.' }: LimitEventListProps) {
  if (events.length === 0) {
    return (
      <div className="empty-state compact">
        <AlertTriangle size={17} />
        <span>{emptyLabel}</span>
      </div>
    )
  }

  return (
    <div className="notification-list">
      {events.map((event) => (
        <div className="notification-item" key={event.id}>
          <span className={event.kind === 'blocked' ? 'notification-dot blocked' : 'notification-dot'} />
          <div>
            <strong>{event.appName}</strong>
            <span>{event.kind === 'blocked' ? `${event.date} · 실행 차단` : `${event.date} · 제한 알림`}</span>
          </div>
          <time dateTime={event.occurredAt}>{formatLimitEventTime(event.occurredAt)}</time>
        </div>
      ))}
    </div>
  )
}
