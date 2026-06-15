import { AlertTriangle, Bell, CheckCircle2, Clock, ListChecks, Plus, Sparkles, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { getLocalDateKey } from '../../shared/date'
import type { BlockedAppHistory, NotificationHistory, TrackedApp, UsageTimes } from '../../shared/types'
import {
  formatDuration,
  getAiUsageInsight,
  getExceededAppCount,
  getSmartLimitRecommendations,
  getTodayNotificationCount,
  getTotalUsageSeconds,
  getTrackedAppUsageSummaries
} from '../stores/selectors'
import { LimitEventList } from './LimitEventList'
import {
  filterLimitEvents,
  getLimitEventFilterLabel,
  getLimitEvents,
  type LimitEventFilter
} from './limitEvents'

interface UsageDashboardProps {
  trackedApps: TrackedApp[]
  usageTimes: UsageTimes
  notifications: NotificationHistory[]
  blockedApps: BlockedAppHistory[]
  onOpenSettings: () => void
  onOpenUsage: () => void
  onOpenEvents: () => void
  onApplyLimitRecommendation: (appId: string, dailyLimitMinutes: number) => void
}

const EVENT_FILTERS: LimitEventFilter[] = ['all', 'notification', 'blocked']

function AppAvatar({ app, large = false }: { app: TrackedApp; large?: boolean }) {
  return (
    <span className={large ? 'app-avatar large' : 'app-avatar'}>
      {app.iconDataUrl ? <img src={app.iconDataUrl} alt={`${app.name} icon`} /> : app.name.slice(0, 1)}
    </span>
  )
}

export function UsageDashboard({
  trackedApps,
  usageTimes,
  notifications,
  blockedApps,
  onOpenSettings,
  onOpenUsage,
  onOpenEvents,
  onApplyLimitRecommendation
}: UsageDashboardProps) {
  const [eventFilter, setEventFilter] = useState<LimitEventFilter>('all')
  const today = getLocalDateKey()
  const summaries = getTrackedAppUsageSummaries(trackedApps, usageTimes, today)
  const topSummary = summaries.find((summary) => summary.usageSeconds > 0) ?? summaries[0] ?? null
  const totalUsageSeconds = getTotalUsageSeconds(usageTimes, today)
  const exceededCount = getExceededAppCount(trackedApps, usageTimes, today)
  const todayNotifications = getTodayNotificationCount(notifications, today)
  const todayBlockedApps = blockedApps.filter((blockedApp) => blockedApp.date === today).length
  const activeAppCount = summaries.filter((summary) => summary.usageSeconds > 0).length
  const recentLimitEvents = filterLimitEvents(
    getLimitEvents(notifications, blockedApps, trackedApps),
    eventFilter
  ).slice(0, 5)
  const maxUsageSeconds = Math.max(1, ...summaries.map((summary) => summary.usageSeconds))
  const aiInsight = getAiUsageInsight(trackedApps, usageTimes, today)
  const limitRecommendations = getSmartLimitRecommendations(trackedApps, usageTimes, today).slice(0, 3)

  const metrics = [
    {
      label: '오늘 총 사용',
      value: formatDuration(totalUsageSeconds),
      hint: activeAppCount > 0 ? `${activeAppCount}개 앱 사용` : '기록 없음',
      icon: Clock
    },
    {
      label: '추적 앱',
      value: `${trackedApps.length}개`,
      hint: trackedApps.length > 0 ? '제한 적용 중' : '추가 필요',
      icon: ListChecks
    },
    {
      label: '초과 앱',
      value: `${exceededCount}개`,
      hint: exceededCount > 0 ? '확인 필요' : '초과 없음',
      icon: AlertTriangle
    },
    {
      label: '오늘 알림',
      value: `${todayNotifications + todayBlockedApps}건`,
      hint: todayNotifications + todayBlockedApps > 0 ? '확인 필요' : '알림 없음',
      icon: Bell
    }
  ]

  return (
    <section className="dashboard-stack">
      <div className="metric-grid" aria-label="오늘 요약">
        {metrics.map((metric) => {
          const Icon = metric.icon

          return (
            <article className="metric-card" key={metric.label}>
              <span className="metric-icon">
                <Icon size={19} />
              </span>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.hint}</small>
            </article>
          )
        })}
      </div>

      <div className="ai-dashboard-grid">
        <section className={`focus-panel ai-insight-panel ${aiInsight.tone}`}>
          <div className="ai-panel-head">
            <span className="ai-panel-icon">
              <Sparkles size={19} />
            </span>
            <div>
              <p className="eyebrow">AI 인사이트</p>
              <h2>{aiInsight.title}</h2>
            </div>
          </div>
          <p className="ai-insight-summary">{aiInsight.summary}</p>
          <p className="ai-insight-detail">{aiInsight.detail}</p>
        </section>

        <section className="focus-panel smart-limit-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">AI 추천</p>
              <h2>스마트 제한 추천</h2>
            </div>
            <WandSparkles size={19} />
          </div>

          {limitRecommendations.length === 0 ? (
            <div className="empty-state compact">
              최근 사용 패턴과 현재 제한이 크게 어긋나지 않습니다.
            </div>
          ) : (
            <div className="smart-limit-list">
              {limitRecommendations.map((recommendation) => {
                const limitLocked =
                  recommendation.todayUsageSeconds >= recommendation.currentLimitMinutes * 60

                return (
                  <article className="smart-limit-row" key={recommendation.app.id}>
                    <div className="smart-limit-main">
                      <strong>{recommendation.app.name}</strong>
                      <span>{recommendation.reason}</span>
                    </div>
                    <div className="smart-limit-values">
                      <span>{recommendation.currentLimitMinutes}분</span>
                      <strong>{recommendation.recommendedLimitMinutes}분</strong>
                    </div>
                    <button
                      type="button"
                      className="primary-button compact-button"
                      disabled={limitLocked}
                      title={limitLocked ? '오늘 제한을 이미 넘은 앱은 내일까지 변경할 수 없습니다.' : '추천 제한 적용'}
                      onClick={() =>
                        onApplyLimitRecommendation(
                          recommendation.app.id,
                          recommendation.recommendedLimitMinutes
                        )
                      }
                    >
                      <CheckCircle2 size={15} />
                      <span>적용</span>
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <div className="focus-layout">
        <section className="focus-panel focus-overview">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">요약</p>
              <h2>오늘 사용 현황</h2>
            </div>
            <button type="button" className="ghost-button compact-button" onClick={onOpenUsage}>
              앱 사용량 보기
            </button>
          </div>

          {trackedApps.length === 0 ? (
            <div className="empty-state feature-empty">
              <div>
                <strong>추적할 앱을 추가하세요.</strong>
                <p>설치된 앱을 선택하면 사용량, 제한 진행률, 알림 상태가 이 화면에 표시됩니다.</p>
              </div>
              <button type="button" className="primary-button" onClick={onOpenSettings}>
                <Plus size={16} />
                <span>앱 추가</span>
              </button>
            </div>
          ) : (
            <>
              <div className="focus-summary simple">
                <div className="top-app-block">
                  {topSummary && <AppAvatar app={topSummary.app} large />}
                  <div>
                    <span>가장 많이 사용한 앱</span>
                    <strong>{topSummary ? topSummary.app.name : '기록 없음'}</strong>
                    <p>
                      {topSummary
                        ? `${formatDuration(topSummary.usageSeconds)} 사용 · ${
                            topSummary.limitReached
                              ? `${formatDuration(topSummary.overLimitSeconds)} 초과`
                              : `${formatDuration(topSummary.remainingSeconds)} 남음`
                          }`
                        : '오늘 기록된 사용량이 없습니다.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="usage-share-list" aria-label="앱별 사용 시간">
                {summaries.slice(0, 6).map((summary) => (
                  <div className="usage-share-row" key={summary.app.id}>
                    <AppAvatar app={summary.app} />
                    <div className="usage-share-body">
                      <div>
                        <strong>{summary.app.name}</strong>
                        <span>{formatDuration(summary.usageSeconds)}</span>
                      </div>
                      <div className="progress-track slim">
                        <div
                          className={summary.limitReached ? 'progress-fill alert' : 'progress-fill'}
                          style={{
                            width: `${summary.usageSeconds > 0 ? Math.max((summary.usageSeconds / maxUsageSeconds) * 100, 3) : 0}%`
                          }}
                        />
                      </div>
                    </div>
                    <span className={summary.limitReached ? 'status-chip alert' : 'status-chip'}>
                      {summary.limitReached
                        ? `${formatDuration(summary.overLimitSeconds)} 초과`
                        : `${formatDuration(summary.remainingSeconds)} 남음`}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="focus-panel alerts-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">알림</p>
              <h2>최근 제한 이벤트</h2>
            </div>
            <button type="button" className="panel-link-button" onClick={onOpenEvents}>
              모두 보기
            </button>
          </div>

          <div className="event-filter-row" role="tablist" aria-label="제한 이벤트 필터">
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

          <LimitEventList
            events={recentLimitEvents}
            emptyLabel={`${getLimitEventFilterLabel(eventFilter)} 이벤트가 없습니다.`}
          />
        </aside>
      </div>
    </section>
  )
}
