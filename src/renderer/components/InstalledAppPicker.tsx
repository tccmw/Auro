import { Bell, BellOff, CheckSquare, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getLocalDateKey } from '../../shared/date'
import type { InstalledAppCandidate, TrackedApp, UsageTimes } from '../../shared/types'
import { isAppLockedForDate } from '../../shared/usageLimits'
import type { TrackedAppInput } from '../stores/usageStore'
import {
  filterInstalledAppCandidates,
  getCandidateIconPresentation,
  getRegisteredAppForCandidate,
  sortInstalledAppCandidates,
  toTrackedAppInputs
} from './installedAppPickerUtils'

interface InstalledAppPickerProps {
  trackedApps: TrackedApp[]
  usageTimes: UsageTimes
  onAddApps: (inputs: TrackedAppInput[]) => void
  onRemoveApp: (appId: string) => void
  onUpdateApp: (appId: string, updates: Partial<TrackedAppInput>) => void
}

function getSourceLabel(
  candidate: InstalledAppCandidate,
  registeredApp?: TrackedApp,
  pending = false,
  locked = false
): string {
  if (locked) {
    return '내일까지 잠김'
  }

  if (registeredApp) {
    return '추적 중'
  }

  if (pending) {
    return '추가 예정'
  }

  return candidate.source === 'start-menu' ? '시작 메뉴' : '설치 목록'
}

export function InstalledAppPicker({
  trackedApps,
  usageTimes,
  onAddApps,
  onRemoveApp,
  onUpdateApp
}: InstalledAppPickerProps) {
  const [candidates, setCandidates] = useState<InstalledAppCandidate[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [dailyLimitMinutes, setDailyLimitMinutes] = useState(60)
  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadInstalledApps = async (): Promise<void> => {
    const api = window.auroApi ?? window.limitoApi

    if (!api) {
      setError('Auro 데스크톱 API를 찾을 수 없습니다.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const installedApps = await api.listInstalledApps()
      setCandidates(installedApps)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInstalledApps()
  }, [])

  const filteredCandidates = useMemo(
    () => filterInstalledAppCandidates(candidates, query),
    [candidates, query]
  )
  const sortedCandidates = useMemo(
    () => sortInstalledAppCandidates(filteredCandidates, trackedApps, selectedIds),
    [filteredCandidates, selectedIds, trackedApps]
  )
  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedIds.has(candidate.id)),
    [candidates, selectedIds]
  )
  const addableInputs = useMemo(
    () => toTrackedAppInputs(selectedCandidates, trackedApps, dailyLimitMinutes, notificationEnabled),
    [dailyLimitMinutes, notificationEnabled, selectedCandidates, trackedApps]
  )

  const today = getLocalDateKey()

  const toggleCandidate = (
    candidate: InstalledAppCandidate,
    registeredApp?: TrackedApp,
    locked = false
  ): void => {
    if (locked) {
      return
    }

    if (registeredApp) {
      onRemoveApp(registeredApp.id)
      return
    }

    setSelectedIds((current) => {
      const next = new Set(current)

      if (next.has(candidate.id)) {
        next.delete(candidate.id)
      } else {
        next.add(candidate.id)
      }

      return next
    })
  }

  return (
    <div className="installed-app-picker">
      <div className="picker-intro">
        <div>
          <h3>설치된 앱에서 선택</h3>
          <p>검색 후 체크하면 기본 제한과 알림 설정이 함께 적용됩니다.</p>
        </div>
        <button
          type="button"
          className="ghost-button compact-button"
          onClick={() => void loadInstalledApps()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          <span>새로고침</span>
        </button>
      </div>

      <div className="picker-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="앱 이름, 프로세스, 게시자 검색"
          />
        </label>
        <label className="compact-field">
          <span>기본 제한</span>
          <input
            min={1}
            type="number"
            value={dailyLimitMinutes}
            onChange={(event) => setDailyLimitMinutes(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          className={notificationEnabled ? 'toggle-button active' : 'toggle-button'}
          title={notificationEnabled ? '일괄 추가 알림 켜짐' : '일괄 추가 알림 꺼짐'}
          aria-pressed={notificationEnabled}
          onClick={() => setNotificationEnabled((current) => !current)}
        >
          {notificationEnabled ? <Bell size={18} /> : <BellOff size={18} />}
          <span>{notificationEnabled ? '알림 켜짐' : '알림 꺼짐'}</span>
        </button>
      </div>

      <div className="picker-summary">
        <span>{sortedCandidates.length}개 표시</span>
        <span>{addableInputs.length}개 추가 예정</span>
      </div>

      {error && <div className="inline-error">{error}</div>}

      <div className="candidate-list" aria-busy={loading}>
        {loading ? (
          <div className="loading-panel" role="status" aria-live="polite">
            <span className="loading-spinner" aria-hidden="true" />
            <div>
              <strong>설치된 앱을 찾고 있습니다.</strong>
              <p>시작 메뉴와 설치 목록을 확인하는 중입니다.</p>
            </div>
          </div>
        ) : sortedCandidates.length === 0 ? (
          <div className="empty-state compact">표시할 앱이 없습니다.</div>
        ) : (
          sortedCandidates.map((candidate) => {
            const registeredApp = getRegisteredAppForCandidate(candidate, trackedApps)
            const locked = registeredApp
              ? isAppLockedForDate(registeredApp, usageTimes, today)
              : false
            const pending = !registeredApp && selectedIds.has(candidate.id)
            const checked = Boolean(registeredApp) || pending
            const icon = getCandidateIconPresentation(candidate)

            return (
              <label
                className={[
                  'candidate-row',
                  registeredApp ? 'registered' : '',
                  pending ? 'pending' : '',
                  locked ? 'locked' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={candidate.id}
                title={locked ? '오늘 제한 시간을 초과해 내일까지 삭제/수정할 수 없습니다.' : undefined}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={() => toggleCandidate(candidate, registeredApp, locked)}
                />
                <span className={icon.type === 'image' ? 'candidate-avatar image' : 'candidate-avatar'}>
                  {icon.type === 'image' ? <img src={icon.src} alt={icon.alt} /> : icon.label}
                </span>
                <span className="candidate-body">
                  <strong>{candidate.name}</strong>
                  <small>
                    {candidate.processName}
                    {candidate.publisher ? ` · ${candidate.publisher}` : ''}
                  </small>
                </span>
                {registeredApp ? (
                  <span className="candidate-limit-field" onClick={(event) => event.stopPropagation()}>
                    <input
                      aria-label={`${candidate.name} 일일 제한`}
                      min={1}
                      type="number"
                      value={registeredApp.dailyLimitMinutes}
                      disabled={locked}
                      onChange={(event) =>
                        onUpdateApp(registeredApp.id, {
                          dailyLimitMinutes: Number(event.target.value)
                        })
                      }
                    />
                    <span>분</span>
                  </span>
                ) : null}
                <span className="candidate-source">
                  {getSourceLabel(candidate, registeredApp, pending, locked)}
                </span>
              </label>
            )
          })
        )}
      </div>

      <div className="picker-actions">
        <span>{addableInputs.length > 0 ? '선택한 앱을 추적 목록에 추가합니다.' : '추가할 앱을 선택하세요.'}</span>
        <button
          type="button"
          className="primary-button"
          disabled={addableInputs.length === 0}
          onClick={() => {
            onAddApps(addableInputs)
            setSelectedIds(new Set())
          }}
        >
          <CheckSquare size={16} />
          <span>선택 앱 추가</span>
        </button>
      </div>
    </div>
  )
}
