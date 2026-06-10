import { Bell, BellOff, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { TrackedApp } from '../../shared/types'
import type { TrackedAppInput } from '../stores/usageStore'

const EMPTY_FORM: TrackedAppInput = {
  name: '',
  processName: '',
  dailyLimitMinutes: 60,
  notificationEnabled: true
}

interface AppFormProps {
  editingApp: TrackedApp | null
  locked?: boolean
  onCancelEdit: () => void
  onCreate: (input: TrackedAppInput) => void
  onUpdate: (appId: string, input: TrackedAppInput) => void
}

export function AppForm({ editingApp, locked = false, onCancelEdit, onCreate, onUpdate }: AppFormProps) {
  const [form, setForm] = useState<TrackedAppInput>(EMPTY_FORM)

  useEffect(() => {
    if (!editingApp) {
      setForm(EMPTY_FORM)
      return
    }

    setForm({
      name: editingApp.name,
      processName: editingApp.processName,
      dailyLimitMinutes: editingApp.dailyLimitMinutes,
      notificationEnabled: editingApp.notificationEnabled,
      iconDataUrl: editingApp.iconDataUrl
    })
  }, [editingApp])

  const isValid = form.name.trim().length > 0 && form.processName.trim().length > 0

  return (
    <form
      className="app-form"
      onSubmit={(event) => {
        event.preventDefault()

        if (!isValid || locked) {
          return
        }

        if (editingApp) {
          onUpdate(editingApp.id, form)
        } else {
          onCreate(form)
        }

        setForm(EMPTY_FORM)
      }}
    >
      <div className="form-grid">
        <label>
          <span>앱 이름</span>
          <input
            value={form.name}
            disabled={locked}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Google Chrome"
          />
        </label>
        <label>
          <span>프로세스 이름</span>
          <input
            value={form.processName}
            disabled={locked}
            onChange={(event) =>
              setForm((current) => ({ ...current, processName: event.target.value }))
            }
            placeholder="chrome.exe"
          />
        </label>
        <label>
          <span>일일 제한(분)</span>
          <input
            min={1}
            type="number"
            value={form.dailyLimitMinutes}
            disabled={locked}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                dailyLimitMinutes: Number(event.target.value)
              }))
            }
          />
        </label>
        <button
          type="button"
          className={form.notificationEnabled ? 'toggle-button active' : 'toggle-button'}
          title={form.notificationEnabled ? '앱 알림 켜짐' : '앱 알림 꺼짐'}
          aria-pressed={form.notificationEnabled}
          disabled={locked}
          onClick={() =>
            setForm((current) => ({
              ...current,
              notificationEnabled: !current.notificationEnabled
            }))
          }
        >
          {form.notificationEnabled ? <Bell size={18} /> : <BellOff size={18} />}
          <span>{form.notificationEnabled ? '알림 켜짐' : '알림 꺼짐'}</span>
        </button>
      </div>
      {locked && <div className="inline-lock">오늘 제한 시간을 초과해 내일까지 수정할 수 없습니다.</div>}
      <div className="form-actions">
        {editingApp && (
          <button type="button" className="ghost-button" onClick={onCancelEdit}>
            <X size={16} />
            <span>취소</span>
          </button>
        )}
        <button type="submit" className="primary-button" disabled={!isValid || locked}>
          <Save size={16} />
          <span>{editingApp ? '저장' : '등록'}</span>
        </button>
      </div>
    </form>
  )
}
