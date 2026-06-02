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
  onCancelEdit: () => void
  onCreate: (input: TrackedAppInput) => void
  onUpdate: (appId: string, input: TrackedAppInput) => void
}

export function AppForm({ editingApp, onCancelEdit, onCreate, onUpdate }: AppFormProps) {
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
      notificationEnabled: editingApp.notificationEnabled
    })
  }, [editingApp])

  const isValid = form.name.trim().length > 0 && form.processName.trim().length > 0

  return (
    <form
      className="app-form"
      onSubmit={(event) => {
        event.preventDefault()

        if (!isValid) {
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
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Google Chrome"
          />
        </label>
        <label>
          <span>프로세스 이름</span>
          <input
            value={form.processName}
            onChange={(event) =>
              setForm((current) => ({ ...current, processName: event.target.value }))
            }
            placeholder="chrome.exe"
          />
        </label>
        <label>
          <span>일일 제한</span>
          <input
            min={1}
            type="number"
            value={form.dailyLimitMinutes}
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
      <div className="form-actions">
        {editingApp && (
          <button type="button" className="ghost-button" onClick={onCancelEdit}>
            <X size={16} />
            <span>취소</span>
          </button>
        )}
        <button type="submit" className="primary-button" disabled={!isValid}>
          <Save size={16} />
          <span>{editingApp ? '저장' : '등록'}</span>
        </button>
      </div>
    </form>
  )
}
