import { Plus, Settings } from 'lucide-react'
import { getLocalDateKey } from '../../shared/date'
import type { TrackedApp, UsageTimes } from '../../shared/types'
import { formatDuration, getTrackedAppUsageSummaries } from '../stores/selectors'

interface UsageByAppPageProps {
  trackedApps: TrackedApp[]
  usageTimes: UsageTimes
  onEditApp: (app: TrackedApp) => void
  onOpenSettings: () => void
}

const SEGMENT_COLORS = ['#26c6b8', '#3f7df3', '#6954d8', '#a7b4df', '#f97373', '#f6b853']

function AppAvatar({ app, large = false }: { app: TrackedApp; large?: boolean }) {
  return (
    <span className={large ? 'app-avatar large usage-icon' : 'app-avatar usage-icon'}>
      {app.iconDataUrl ? <img src={app.iconDataUrl} alt={`${app.name} icon`} /> : app.name.slice(0, 1)}
    </span>
  )
}

export function UsageByAppPage({
  trackedApps,
  usageTimes,
  onEditApp,
  onOpenSettings
}: UsageByAppPageProps) {
  const today = getLocalDateKey()
  const summaries = getTrackedAppUsageSummaries(trackedApps, usageTimes, today)
  const usedSummaries = summaries.filter((summary) => summary.usageSeconds > 0)
  const topSummaries = usedSummaries.slice(0, 3)
  const totalUsageSeconds = summaries.reduce((total, summary) => total + summary.usageSeconds, 0)
  const maxUsageSeconds = Math.max(1, ...summaries.map((summary) => summary.usageSeconds))

  return (
    <section className="usage-page usage-insights-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">앱 사용량</p>
          <h2>오늘 앱별 사용 시간</h2>
        </div>
        <span>{summaries.length}개 앱</span>
      </div>

      {summaries.length === 0 ? (
        <div className="empty-state">
          <div>
            <strong>비교할 앱이 없습니다.</strong>
            <p>설정에서 추적할 앱을 추가하면 오늘 사용량 순서로 표시됩니다.</p>
          </div>
          <button type="button" className="primary-button" onClick={onOpenSettings}>
            <Plus size={16} />
            <span>앱 추가</span>
          </button>
        </div>
      ) : (
        <>
          <div className="usage-overview-grid">
            <section className="usage-summary-card total-usage-card">
              <div className="usage-total-head">
                <div>
                  <span className="panel-label">오늘 총 사용</span>
                  <strong className="total-usage-value">{formatDuration(totalUsageSeconds)}</strong>
                </div>
                <span className="usage-count-chip">{usedSummaries.length}개 사용</span>
              </div>

              <div className="stacked-usage-bar" aria-label="앱별 누적 사용량">
                {usedSummaries.length === 0 ? (
                  <span className="stacked-empty" />
                ) : (
                  usedSummaries.slice(0, 6).map((summary, index) => (
                    <span
                      key={summary.app.id}
                      style={{
                        width: `${Math.max((summary.usageSeconds / Math.max(totalUsageSeconds, 1)) * 100, 4)}%`,
                        background: SEGMENT_COLORS[index % SEGMENT_COLORS.length]
                      }}
                      title={`${summary.app.name} ${formatDuration(summary.usageSeconds)}`}
                    />
                  ))
                )}
              </div>

              <div className="usage-category-list">
                {(usedSummaries.length > 0 ? usedSummaries.slice(0, 5) : summaries.slice(0, 3)).map(
                  (summary, index) => (
                    <div className="usage-category-row" key={summary.app.id}>
                      <span
                        className="usage-color-dot"
                        style={{ background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                      />
                      <span>{summary.app.name}</span>
                      <strong>{formatDuration(summary.usageSeconds)}</strong>
                    </div>
                  )
                )}
              </div>
            </section>

            <section className="usage-summary-card most-used-card">
              <div className="panel-title-row">
                <h3>많이 사용한 앱</h3>
                <span>오늘 기준</span>
              </div>
              <div className="most-used-grid">
                {(topSummaries.length > 0 ? topSummaries : summaries.slice(0, 3)).map((summary) => (
                  <button
                    type="button"
                    className="most-used-app"
                    key={summary.app.id}
                    onClick={() => onEditApp(summary.app)}
                  >
                    <AppAvatar app={summary.app} large />
                    <span>{summary.app.name}</span>
                    <strong>{formatDuration(summary.usageSeconds)}</strong>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="usage-detail-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">상세</p>
                <h2>앱별 제한 상태</h2>
              </div>
            </div>

            <div className="usage-app-list">
              {summaries.map((summary) => {
                const relativeWidth =
                  summary.usageSeconds > 0 ? Math.max((summary.usageSeconds / maxUsageSeconds) * 100, 3) : 0
                const stateLabel = summary.limitReached
                  ? `${formatDuration(summary.overLimitSeconds)} 초과`
                  : `${formatDuration(summary.remainingSeconds)} 남음`

                return (
                  <article
                    className={summary.limitReached ? 'usage-app-row exceeded' : 'usage-app-row'}
                    key={summary.app.id}
                  >
                    <div className="usage-app-main">
                      <AppAvatar app={summary.app} />
                      <div>
                        <h3>{summary.app.name}</h3>
                        <p>{summary.app.processName}</p>
                      </div>
                    </div>

                    <div className="usage-app-values">
                      <div>
                        <span>오늘 사용</span>
                        <strong>{formatDuration(summary.usageSeconds)}</strong>
                      </div>
                      <div>
                        <span>일일 제한</span>
                        <strong>{formatDuration(summary.limitSeconds)}</strong>
                      </div>
                      <div>
                        <span>상태</span>
                        <strong className={summary.limitReached ? 'danger-text' : ''}>{stateLabel}</strong>
                      </div>
                    </div>

                    <div className="usage-app-bars">
                      <div>
                        <span>사용량 비교</span>
                        <div className="progress-track slim">
                          <div className="progress-fill" style={{ width: `${relativeWidth}%` }} />
                        </div>
                      </div>
                      <div>
                        <span>제한 진행</span>
                        <div className="progress-track slim">
                          <div
                            className={summary.limitReached ? 'progress-fill alert' : 'progress-fill'}
                            style={{ width: `${summary.percentUsed}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <button type="button" className="ghost-button compact-button" onClick={() => onEditApp(summary.app)}>
                      <Settings size={15} />
                      <span>수정</span>
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        </>
      )}
    </section>
  )
}
