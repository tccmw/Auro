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

function AppIcon({ app }: { app: TrackedApp }) {
  return (
    <span className="app-avatar card-avatar">
      {app.iconDataUrl ? <img src={app.iconDataUrl} alt={`${app.name} icon`} /> : app.name.slice(0, 1)}
    </span>
  )
}

export function TrackedAppCard({
  app,
  usageTimes,
  onEdit,
  onRemove
}: TrackedAppCardProps) {
  const summary = getAppUsageSummary(app, usageTimes, getLocalDateKey())
  const statusLabel = summary.limitReached
    ? `${formatDuration(summary.overLimitSeconds)} 초과`
    : summary.usageSeconds > 0
      ? `${formatDuration(summary.remainingSeconds)} 남음`
      : '사용 전'

  return (
    <article className={summary.limitReached ? 'app-card exceeded' : 'app-card'}>
      <div className="app-card-header">
        <div className="app-title-row">
          <AppIcon app={app} />
          <div>
            <h3>{app.name}</h3>
            <p>{app.processName}</p>
          </div>
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
        <div>
          <span>오늘 사용</span>
          <strong>{formatDuration(summary.usageSeconds)}</strong>
        </div>
        <span className={summary.limitReached ? 'status-chip alert' : 'status-chip'}>{statusLabel}</span>
      </div>

      <div className="progress-track" aria-label={`${app.name} 제한 진행`}>
        <div
          className={summary.limitReached ? 'progress-fill alert' : 'progress-fill'}
          style={{ width: `${summary.percentUsed}%` }}
        />
      </div>

      <div className="usage-meta">
        <span>사용 {formatDuration(summary.usageSeconds)}</span>
        <span>제한 {formatDuration(summary.limitSeconds)}</span>
      </div>
    </article>
  )
}
