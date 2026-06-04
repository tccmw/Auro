import { Bell, BellOff, Pencil, Trash2 } from 'lucide-react'
import { getLocalDateKey } from '../../shared/date'
import type { TrackedApp, UsageTimes } from '../../shared/types'
import { formatDuration, getAppUsageSummary } from '../stores/selectors'

interface TrackedAppCardProps {
  app: TrackedApp
  usageTimes: UsageTimes
  onEdit: (app: TrackedApp) => void
  onRemove: (appId: string) => void
}

export function TrackedAppCard({
  app,
  usageTimes,
  onEdit,
  onRemove
}: TrackedAppCardProps) {
  const summary = getAppUsageSummary(app, usageTimes, getLocalDateKey())

  return (
    <article className={summary.limitReached ? 'app-card exceeded' : 'app-card'}>
      <div className="app-card-header">
        <div>
          <h3>{app.name}</h3>
          <p>{app.processName}</p>
        </div>
        <div className="icon-row">
          <span className="notification-pill" title={app.notificationEnabled ? '알림 켜짐' : '알림 꺼짐'}>
            {app.notificationEnabled ? <Bell size={15} /> : <BellOff size={15} />}
          </span>
          <button type="button" className="icon-button" title="앱 수정" onClick={() => onEdit(app)}>
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-button danger"
            title="앱 삭제"
            onClick={() => onRemove(app.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="usage-row">
        <strong>{formatDuration(summary.usageSeconds)}</strong>
        <span>{app.dailyLimitMinutes}분 제한</span>
      </div>
      <div className="progress-track" aria-label={`${app.name} 사용률`}>
        <div className="progress-fill" style={{ width: `${summary.percentUsed}%` }} />
      </div>
      <div className="usage-meta">
        <span>{summary.percentUsed}%</span>
        <span>{summary.limitReached ? '초과' : '추적 중'}</span>
      </div>
    </article>
  )
}
