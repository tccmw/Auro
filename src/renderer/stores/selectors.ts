import { getLocalDateKey } from '../../shared/date'
import type { NotificationHistory, TrackedApp, UsageTimes } from '../../shared/types'
import { getDailyLimitSeconds } from '../../shared/usageLimits'
export { isAppLockedForDate } from '../../shared/usageLimits'

export interface AppUsageSummary {
  app: TrackedApp
  usageSeconds: number
  limitSeconds: number
  percentUsed: number
  remainingSeconds: number
  overLimitSeconds: number
  limitReached: boolean
}

export interface AppRangeUsageSummary {
  app: TrackedApp
  usageSeconds: number
  percentOfTotal: number
  averageDailySeconds: number
}

export interface UsageDateTotal {
  date: string
  usageSeconds: number
}

export interface UsageRangeReport {
  dateKeys: string[]
  startDate: string
  endDate: string
  totalUsageSeconds: number
  activeAppCount: number
  appSummaries: AppRangeUsageSummary[]
  dailyTotals: UsageDateTotal[]
}

export type AiInsightTone = 'empty' | 'calm' | 'warning' | 'critical'

export interface AiUsageInsight {
  tone: AiInsightTone
  title: string
  summary: string
  detail: string
}

export type SmartLimitDirection = 'decrease' | 'increase'
export type SmartLimitConfidence = 'low' | 'medium' | 'high'

export interface SmartLimitRecommendation {
  app: TrackedApp
  currentLimitMinutes: number
  recommendedLimitMinutes: number
  averageDailySeconds: number
  todayUsageSeconds: number
  observedDayCount: number
  direction: SmartLimitDirection
  confidence: SmartLimitConfidence
  reason: string
}

export function getUsageForDate(usageTimes: UsageTimes, date = getLocalDateKey()): Record<string, number> {
  return usageTimes[date] ?? {}
}

function createAppUsageSummary(app: TrackedApp, usageSeconds: number): AppUsageSummary {
  const limitSeconds = Math.max(1, getDailyLimitSeconds(app))
  const percentUsed = Math.min(100, Math.round((usageSeconds / limitSeconds) * 100))

  return {
    app,
    usageSeconds,
    limitSeconds,
    percentUsed,
    remainingSeconds: Math.max(0, limitSeconds - usageSeconds),
    overLimitSeconds: Math.max(0, usageSeconds - limitSeconds),
    limitReached: usageSeconds >= limitSeconds
  }
}

export function getAppUsageSummary(
  app: TrackedApp,
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): AppUsageSummary {
  const usageForDate = getUsageForDate(usageTimes, date)

  return createAppUsageSummary(app, usageForDate[app.id] ?? 0)
}

export function getTrackedAppUsageSummaries(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): AppUsageSummary[] {
  const usageForDate = getUsageForDate(usageTimes, date)

  return trackedApps
    .map((app) => createAppUsageSummary(app, usageForDate[app.id] ?? 0))
    .sort((left, right) => {
      const usageDelta = right.usageSeconds - left.usageSeconds

      if (usageDelta !== 0) {
        return usageDelta
      }

      return left.app.name.localeCompare(right.app.name, 'ko-KR', { sensitivity: 'base' })
    })
}

export function getTopUsedAppSummary(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): AppUsageSummary | null {
  return getTrackedAppUsageSummaries(trackedApps, usageTimes, date)[0] ?? null
}

export function getTotalUsageSeconds(usageTimes: UsageTimes, date = getLocalDateKey()): number {
  return Object.values(getUsageForDate(usageTimes, date)).reduce((total, seconds) => total + seconds, 0)
}

export function getExceededAppCount(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): number {
  return getTrackedAppUsageSummaries(trackedApps, usageTimes, date).filter((summary) => summary.limitReached)
    .length
}

export function getTodayNotificationCount(
  notifications: NotificationHistory[],
  date = getLocalDateKey()
): number {
  return notifications.filter((notification) => notification.date === date).length
}

function createDateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)

  if (!year || !month || !day) {
    return new Date(`${dateKey}T00:00:00`)
  }

  return new Date(year, month - 1, day)
}

function createDateKeyRange(start: Date, end: Date): string[] {
  const dateKeys: string[] = []
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  while (current <= last) {
    dateKeys.push(getLocalDateKey(current))
    current.setDate(current.getDate() + 1)
  }

  return dateKeys
}

export function getWeekDateKeys(date = new Date()): string[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = start.getDay()
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1
  start.setDate(start.getDate() - daysFromMonday)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return createDateKeyRange(start, end)
}

export function getMonthDateKeys(date = new Date()): string[] {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)

  return createDateKeyRange(start, end)
}

export function getRecentDateKeys(date = getLocalDateKey(), dayCount = 7): string[] {
  const end = createDateFromKey(date)
  const start = new Date(end)
  start.setDate(end.getDate() - Math.max(1, dayCount) + 1)

  return createDateKeyRange(start, end)
}

export function getUsageRangeReport(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  dateKeys: string[]
): UsageRangeReport {
  const uniqueDateKeys = Array.from(new Set(dateKeys)).sort()
  const totalByApp = new Map<string, number>()
  const dailyTotals = uniqueDateKeys.map((date) => {
    const usageForDate = getUsageForDate(usageTimes, date)
    const usageSeconds = Object.values(usageForDate).reduce((total, seconds) => total + seconds, 0)

    for (const [appId, seconds] of Object.entries(usageForDate)) {
      totalByApp.set(appId, (totalByApp.get(appId) ?? 0) + seconds)
    }

    return { date, usageSeconds }
  })
  const totalUsageSeconds = dailyTotals.reduce((total, day) => total + day.usageSeconds, 0)
  const appSummaries = trackedApps
    .map((app) => {
      const usageSeconds = totalByApp.get(app.id) ?? 0

      return {
        app,
        usageSeconds,
        percentOfTotal:
          totalUsageSeconds > 0 ? Math.min(100, Math.round((usageSeconds / totalUsageSeconds) * 100)) : 0,
        averageDailySeconds:
          uniqueDateKeys.length > 0 ? Math.floor(usageSeconds / uniqueDateKeys.length) : 0
      }
    })
    .sort((left, right) => {
      const usageDelta = right.usageSeconds - left.usageSeconds

      if (usageDelta !== 0) {
        return usageDelta
      }

      return left.app.name.localeCompare(right.app.name, 'ko-KR', { sensitivity: 'base' })
    })

  return {
    dateKeys: uniqueDateKeys,
    startDate: uniqueDateKeys[0] ?? '',
    endDate: uniqueDateKeys[uniqueDateKeys.length - 1] ?? '',
    totalUsageSeconds,
    activeAppCount: appSummaries.filter((summary) => summary.usageSeconds > 0).length,
    appSummaries,
    dailyTotals
  }
}

function getConfidence(observedDayCount: number): SmartLimitConfidence {
  if (observedDayCount >= 5) {
    return 'high'
  }

  if (observedDayCount >= 3) {
    return 'medium'
  }

  return 'low'
}

function roundMinutesUp(value: number, step = 5): number {
  return Math.max(step, Math.ceil(value / step) * step)
}

export function getSmartLimitRecommendations(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): SmartLimitRecommendation[] {
  const dateKeys = getRecentDateKeys(date, 7)
  const todayUsage = getUsageForDate(usageTimes, date)

  return trackedApps
    .map((app): SmartLimitRecommendation | null => {
      const dailyUsages = dateKeys.map((dateKey) => usageTimes[dateKey]?.[app.id] ?? 0)
      const activeUsages = dailyUsages.filter((usageSeconds) => usageSeconds > 0)

      if (activeUsages.length === 0) {
        return null
      }

      const averageDailySeconds = Math.round(
        activeUsages.reduce((total, usageSeconds) => total + usageSeconds, 0) / activeUsages.length
      )
      const currentLimitMinutes = Math.max(1, app.dailyLimitMinutes)
      const currentLimitSeconds = currentLimitMinutes * 60
      const todayUsageSeconds = todayUsage[app.id] ?? 0
      const minimumTodayMinutes =
        todayUsageSeconds > 0 ? roundMinutesUp(Math.ceil(todayUsageSeconds / 60), 5) : 0
      let recommendedLimitMinutes = currentLimitMinutes
      let direction: SmartLimitDirection | null = null

      if (averageDailySeconds <= currentLimitSeconds * 0.72 && currentLimitMinutes > 15) {
        recommendedLimitMinutes = Math.max(
          15,
          roundMinutesUp((averageDailySeconds / 60) * 1.15, 5),
          minimumTodayMinutes
        )
        direction = 'decrease'
      } else if (averageDailySeconds >= currentLimitSeconds * 1.2) {
        recommendedLimitMinutes = Math.max(
          currentLimitMinutes + 5,
          roundMinutesUp((averageDailySeconds / 60) * 0.9, 5),
          minimumTodayMinutes
        )
        direction = 'increase'
      }

      if (!direction || Math.abs(recommendedLimitMinutes - currentLimitMinutes) < 5) {
        return null
      }

      return {
        app,
        currentLimitMinutes,
        recommendedLimitMinutes,
        averageDailySeconds,
        todayUsageSeconds,
        observedDayCount: activeUsages.length,
        direction,
        confidence: getConfidence(activeUsages.length),
        reason:
          direction === 'decrease'
            ? `최근 평균은 ${formatDuration(averageDailySeconds)}입니다. 현재 제한보다 여유가 있어 ${recommendedLimitMinutes}분으로 낮춰도 무리가 적습니다.`
            : `최근 평균은 ${formatDuration(averageDailySeconds)}입니다. 먼저 지킬 수 있는 기준으로 ${recommendedLimitMinutes}분을 추천합니다.`
      }
    })
    .filter((recommendation): recommendation is SmartLimitRecommendation => recommendation !== null)
    .sort((left, right) => {
      const confidenceOrder: Record<SmartLimitConfidence, number> = {
        high: 3,
        medium: 2,
        low: 1
      }
      const confidenceDelta = confidenceOrder[right.confidence] - confidenceOrder[left.confidence]

      if (confidenceDelta !== 0) {
        return confidenceDelta
      }

      return (
        Math.abs(right.recommendedLimitMinutes - right.currentLimitMinutes) -
        Math.abs(left.recommendedLimitMinutes - left.currentLimitMinutes)
      )
    })
}

export function getAiUsageInsight(
  trackedApps: TrackedApp[],
  usageTimes: UsageTimes,
  date = getLocalDateKey()
): AiUsageInsight {
  if (trackedApps.length === 0) {
    return {
      tone: 'empty',
      title: '분석할 앱을 추가하세요',
      summary: '추적할 앱을 등록하면 오늘 사용 흐름과 제한 추천을 자동으로 분석합니다.',
      detail: '설정에서 자주 쓰는 앱을 먼저 추가해 주세요.'
    }
  }

  const summaries = getTrackedAppUsageSummaries(trackedApps, usageTimes, date)
  const totalUsageSeconds = getTotalUsageSeconds(usageTimes, date)

  if (totalUsageSeconds === 0) {
    return {
      tone: 'empty',
      title: '아직 오늘 기록이 적습니다',
      summary: '앱 사용 기록이 쌓이면 AI 인사이트가 사용 패턴을 요약합니다.',
      detail: 'Auro를 켜둔 상태로 추적 앱을 사용하면 자동으로 분석됩니다.'
    }
  }

  const exceededSummary = summaries
    .filter((summary) => summary.limitReached)
    .sort((left, right) => right.overLimitSeconds - left.overLimitSeconds)[0]

  if (exceededSummary) {
    return {
      tone: 'critical',
      title: `${exceededSummary.app.name} 제한을 넘었습니다`,
      summary: `${formatDuration(exceededSummary.overLimitSeconds)} 초과했습니다. 오늘은 해당 앱 사용을 멈추는 쪽이 좋습니다.`,
      detail: '제한이 반복해서 초과되면 스마트 제한 추천에서 현실적인 기준으로 조정할 수 있습니다.'
    }
  }

  const nearLimitSummary = summaries.find(
    (summary) => summary.usageSeconds > 0 && summary.remainingSeconds <= 15 * 60
  )

  if (nearLimitSummary) {
    return {
      tone: 'warning',
      title: `${nearLimitSummary.app.name} 제한이 얼마 남지 않았습니다`,
      summary: `남은 시간은 ${formatDuration(nearLimitSummary.remainingSeconds)}입니다. 지금 마무리하면 제한 안에서 끝낼 수 있습니다.`,
      detail: '사용이 계속 필요하다면 다음 세션으로 나누는 편이 안정적입니다.'
    }
  }

  const recentDateKeys = getRecentDateKeys(date, 7).filter((dateKey) => dateKey !== date)
  const recentDailyTotals = recentDateKeys
    .map((dateKey) => getTotalUsageSeconds(usageTimes, dateKey))
    .filter((usageSeconds) => usageSeconds > 0)
  const recentAverageSeconds =
    recentDailyTotals.length > 0
      ? Math.round(
          recentDailyTotals.reduce((total, usageSeconds) => total + usageSeconds, 0) /
            recentDailyTotals.length
        )
      : 0

  if (recentAverageSeconds > 0 && totalUsageSeconds >= recentAverageSeconds * 1.25) {
    return {
      tone: 'warning',
      title: '오늘 사용 속도가 평소보다 빠릅니다',
      summary: `오늘은 이미 ${formatDuration(totalUsageSeconds)} 사용했습니다. 최근 평균 ${formatDuration(
        recentAverageSeconds
      )}보다 높습니다.`,
      detail: '가장 많이 쓴 앱부터 10분 단위로 끊어서 보는 것을 추천합니다.'
    }
  }

  const topSummary = summaries.find((summary) => summary.usageSeconds > 0) ?? summaries[0]

  return {
    tone: 'calm',
    title: '현재 제한 안에서 사용 중입니다',
    summary: `${topSummary.app.name} 사용이 가장 많고, 아직 ${formatDuration(topSummary.remainingSeconds)} 남았습니다.`,
    detail: '스마트 제한 추천이 보이면 적용해서 내일 기준을 더 정확하게 맞출 수 있습니다.'
  }
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }

  return `${remainingSeconds}s`
}
