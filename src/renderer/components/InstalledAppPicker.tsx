import { Bell, BellOff, CheckSquare, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { InstalledAppCandidate, TrackedApp } from '../../shared/types'
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
  onAddApps: (inputs: TrackedAppInput[]) => void
  onRemoveApp: (appId: string) => void
  onUpdateApp: (appId: string, updates: Partial<TrackedAppInput>) => void
}

export function InstalledAppPicker({
  trackedApps,
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
    if (!window.limitoApi) {
      setError('Electron API를 찾을 수 없습니다.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const installedApps = await window.limitoApi.listInstalledApps()
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

  const toggleCandidate = (candidate: InstalledAppCandidate, registeredApp?: TrackedApp): void => {
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
      <div className="picker-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="앱 검색"
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
        <button type="button" className="ghost-button" onClick={() => void loadInstalledApps()}>
          <RefreshCw size={16} />
          <span>새로고침</span>
        </button>
      </div>

      <div className="picker-summary">
        <span>{sortedCandidates.length}개 표시</span>
        <span>{addableInputs.length}개 추가 예정</span>
      </div>

      {error && <div className="inline-error">{error}</div>}

      <div className="candidate-list" aria-busy={loading}>
        {loading ? (
          <div className="empty-state compact">앱 목록을 읽는 중입니다.</div>
        ) : sortedCandidates.length === 0 ? (
          <div className="empty-state compact">표시할 앱이 없습니다.</div>
        ) : (
          sortedCandidates.map((candidate) => {
            const registeredApp = getRegisteredAppForCandidate(candidate, trackedApps)
            const pending = !registeredApp && selectedIds.has(candidate.id)
            const checked = Boolean(registeredApp) || pending
            const icon = getCandidateIconPresentation(candidate)

            return (
              <label
                className={[
                  'candidate-row',
                  registeredApp ? 'registered' : '',
                  pending ? 'pending' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={candidate.id}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCandidate(candidate, registeredApp)}
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
                  <label className="candidate-limit-field" onClick={(event) => event.stopPropagation()}>
                    <span>분</span>
                    <input
                      min={1}
                      type="number"
                      value={registeredApp.dailyLimitMinutes}
                      onChange={(event) =>
                        onUpdateApp(registeredApp.id, {
                          dailyLimitMinutes: Number(event.target.value)
                        })
                      }
                    />
                  </label>
                ) : null}
                <span className="candidate-source">
                  {registeredApp
                    ? '추적 중'
                    : pending
                      ? '추가 예정'
                      : candidate.source === 'start-menu'
                        ? '시작 메뉴'
                        : '설치 목록'}
                </span>
              </label>
            )
          })
        )}
      </div>

      <div className="picker-actions">
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
