import { ArrowLeft, Bell, Lock } from 'lucide-react'
import { useState } from 'react'
import type { BlockedAppHistory, NotificationHistory, TrackedApp } from '../../shared/types'
import { LimitEventList } from './LimitEventList'
import {
  filterLimitEvents,
  getLimitEventFilterLabel,
  getLimitEvents,
  type LimitEventFilter
} from './limitEvents'

interface LimitEventsPageProps {
  trackedApps: TrackedApp[]
  notifications: NotificationHistory[]
  blockedApps: BlockedAppHistory[]
  onBack: () => void
}

const EVENT_FILTERS: LimitEventFilter[] = ['all', 'notification', 'blocked']

export function LimitEventsPage({
  trackedApps,
  notifications,
  blockedApps,
  onBack
}: LimitEventsPageProps) {
  const [eventFilter, setEventFilter] = useState<LimitEventFilter>('all')
  const events = getLimitEvents(notifications, blockedApps, trackedApps)
  const filteredEvents = filterLimitEvents(events, eventFilter)

  return (
    <section className="event-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">알림</p>
          <h2>제한 이벤트 전체 보기</h2>
        </div>
        <button type="button" className="ghost-button compact-button" onClick={onBack}>
          <ArrowLeft size={15} />
          <span>대시보드</span>
        </button>
      </div>

      <div className="event-summary-grid">
        <article className="event-summary-card">
          <Bell size={17} />
          <span>제한 알림</span>
          <strong>{notifications.length}건</strong>
        </article>
        <article className="event-summary-card">
          <Lock size={17} />
          <span>실행 차단</span>
          <strong>{blockedApps.length}건</strong>
        </article>
      </div>

      <div className="event-filter-row wide" role="tablist" aria-label="제한 이벤트 필터">
        {EVENT_FILTERS.map((filter) => (
          <button
            type="button"
            key={filter}
            className={eventFilter === filter ? 'active' : ''}
            aria-pressed={eventFilter === filter}
            onClick={() => setEventFilter(filter)}
          >
            {getLimitEventFilterLabel(filter)}
          </button>
        ))}
      </div>

      <section className="event-list-panel">
        <div className="panel-title-row">
          <h3>{getLimitEventFilterLabel(eventFilter)}</h3>
          <span>{filteredEvents.length}건</span>
        </div>
        <LimitEventList
          events={filteredEvents}
          emptyLabel={`${getLimitEventFilterLabel(eventFilter)} 이벤트가 없습니다.`}
        />
      </section>
    </section>
  )
}
