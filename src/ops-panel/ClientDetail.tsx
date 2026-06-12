import { useState, useEffect, FormEvent } from 'react'
import {
  opsGetClient, opsSaveAvitoConfig, opsTestAvito, opsBotRestart,
  opsListFaq, opsCreateFaq, opsUpdateFaq, opsDeleteFaq,
  opsGetPrompt, opsSavePrompt,
  opsListProperties, opsCreateProperty, opsUpdateProperty,
  opsListDialogues, opsGetMessages,
  OpsClientDetail, OpsDialogue, OpsMessage, FaqEntry, Property,
} from '../api'
import StatCard from '../client-panel/components/StatCard'

type Tab = 'overview' | 'avito' | 'content' | 'logs'
type ContentTab = 'faq' | 'prompt' | 'properties'

interface Props {
  tenantId: string
  onBack: () => void
  createdJustNow?: boolean
}

// ─── Avito Tab ────────────────────────────────────────────────────────────────

function AvitoTab({ tenantId, detail }: { tenantId: string; detail: OpsClientDetail }) {
  const [clientId, setClientId] = useState(detail.avitoConfig?.avitoClientId ?? '')
  const [clientSecret, setClientSecret] = useState('')
  const [userId, setUserId] = useState(detail.avitoConfig?.avitoUserId ?? '')
  const [refreshToken, setRefreshToken] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')

  const hasSavedConfig = detail.avitoConfig !== null

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!clientId || !userId) { setError('Client ID и User ID обязательны'); return }
    setSaving(true); setError(''); setSaved(false); setTestResult(null)
    try {
      await opsSaveAvitoConfig(tenantId, {
        avitoClientId: clientId,
        avitoClientSecret: clientSecret,
        avitoUserId: userId,
        refreshToken,
      })
      setSaved(true)
      setClientSecret('')
      setRefreshToken('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true); setTestResult(null)
    try {
      const res = await opsTestAvito(tenantId)
      if (res?.ok) {
        setTestResult({ ok: true, msg: `Подключение работает. Найдено ${res.chatCount} чатов.` })
      } else {
        setTestResult({ ok: false, msg: `Ошибка: ${res?.error ?? 'неизвестно'}` })
      }
    } catch {
      setTestResult({ ok: false, msg: 'Ошибка соединения' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-lg">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Подключение Авито</h3>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 font-mono"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Client Secret {hasSavedConfig && <span className="text-gray-400">(оставьте пустым чтобы не менять)</span>}
          </label>
          <input
            type="password"
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            required={!hasSavedConfig}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 font-mono"
            placeholder={hasSavedConfig ? '****' : 'Client Secret'}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 font-mono"
            placeholder="12345678"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Refresh Token {hasSavedConfig && <span className="text-gray-400">(оставьте пустым чтобы не менять)</span>}
          </label>
          <input
            type="password"
            value={refreshToken}
            onChange={e => setRefreshToken(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 font-mono"
            placeholder={hasSavedConfig ? '****' : 'Refresh Token'}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Конфигурация сохранена</p>}

        {testResult && (
          <div className={`rounded-lg p-3 text-sm ${testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {testResult.ok ? '✅' : '❌'} {testResult.msg}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !hasSavedConfig}
            className="border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {testing ? 'Проверка...' : 'Тест подключения'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── FAQ sub-tab ──────────────────────────────────────────────────────────────

function FaqSubTab({ tenantId }: { tenantId: string }) {
  const [entries, setEntries] = useState<FaqEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addQ, setAddQ] = useState(''); const [addA, setAddA] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editQ, setEditQ] = useState(''); const [editA, setEditA] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const data = await opsListFaq(tenantId)
    if (data) setEntries(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [tenantId])

  async function handleAdd() {
    if (!addQ.trim() || !addA.trim()) return
    setSaving(true)
    await opsCreateFaq(tenantId, { question: addQ, answer: addA })
    setAddQ(''); setAddA(''); setShowAdd(false); setSaving(false)
    load()
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    await opsUpdateFaq(tenantId, id, { question: editQ, answer: editA })
    setEditId(null); setSaving(false); load()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Удалить этот ответ?')) return
    await opsDeleteFaq(tenantId, id)
    load()
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Загрузка...</p>

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(v => !v)} className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-gray-700 transition-colors">
          + Добавить
        </button>
      </div>
      {showAdd && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2">
          <input type="text" value={addQ} onChange={e => setAddQ(e.target.value)} placeholder="Вопрос" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          <textarea value={addA} onChange={e => setAddA(e.target.value)} rows={2} placeholder="Ответ" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="bg-gray-900 text-white rounded-lg px-3 py-1 text-xs disabled:opacity-50 hover:bg-gray-700 transition-colors">Сохранить</button>
            <button onClick={() => setShowAdd(false)} className="border border-gray-200 rounded-lg px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors">Отмена</button>
          </div>
        </div>
      )}
      {entries.length === 0 && !showAdd && <p className="text-sm text-gray-400 py-2">FAQ пуст</p>}
      {entries.map(e => (
        <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-4">
          {editId === e.id ? (
            <div className="space-y-2">
              <input type="text" value={editQ} onChange={ev => setEditQ(ev.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              <textarea value={editA} onChange={ev => setEditA(ev.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
              <div className="flex gap-2">
                <button onClick={() => handleSaveEdit(e.id)} disabled={saving} className="bg-gray-900 text-white rounded-lg px-3 py-1 text-xs disabled:opacity-50 transition-colors">Сохранить</button>
                <button onClick={() => setEditId(null)} className="border border-gray-200 rounded-lg px-3 py-1 text-xs text-gray-600 transition-colors">Отмена</button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-800">{e.question}</p>
              <p className="text-sm text-gray-500 mt-1">{e.answer}</p>
              <div className="flex gap-3 mt-2">
                <button onClick={() => { setEditId(e.id); setEditQ(e.question); setEditA(e.answer) }} className="text-xs text-gray-500 hover:text-gray-800 transition-colors">Изменить</button>
                <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors">Удалить</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Prompt sub-tab ───────────────────────────────────────────────────────────

function PromptSubTab({ tenantId }: { tenantId: string }) {
  const [basePrompt, setBasePrompt] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [effectivePrompt, setEffectivePrompt] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showBase, setShowBase] = useState(false)
  const [showEffective, setShowEffective] = useState(false)

  function apply(data: { basePrompt: string; customPrompt: string; effectivePrompt: string; isCustom: boolean }) {
    setBasePrompt(data.basePrompt)
    setCustomPrompt(data.customPrompt)
    setEffectivePrompt(data.effectivePrompt)
    setIsCustom(data.isCustom)
  }

  useEffect(() => {
    opsGetPrompt(tenantId).then(data => {
      if (data) apply(data)
      setLoading(false)
    })
  }, [tenantId])

  async function reload() {
    const data = await opsGetPrompt(tenantId)
    if (data) apply(data)
  }

  async function handleSave() {
    setSaving(true); setSaved(false)
    await opsSavePrompt(tenantId, customPrompt)
    await reload()
    setSaved(true); setSaving(false)
  }

  async function handleReset() {
    if (!window.confirm('Удалить доп. инструкцию клиента? Бот будет работать только по базовому промпту.')) return
    setSaving(true); setSaved(false)
    await opsSavePrompt(tenantId, '')
    await reload()
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Загрузка...</p>

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
        <p className="text-xs text-orange-700">
          ⚠ Доп. инструкция клиента дописывается к базовому промпту отдельной секцией и влияет на все ответы бота. Базовые правила (Авито, гейтинг кода двери, FAQ) остаются всегда.
        </p>
      </div>

      {/* Базовый промпт — read-only, генерируется кодом */}
      <div className="border border-gray-100 rounded-xl">
        <button
          onClick={() => setShowBase(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Базовый промпт (общий для всех, только чтение)</span>
          <span className="text-gray-400">{showBase ? '▲' : '▼'}</span>
        </button>
        {showBase && (
          <textarea
            value={basePrompt}
            readOnly
            rows={16}
            className="w-full border-t border-gray-100 px-4 py-3 text-xs font-mono text-gray-500 bg-gray-50 resize-y focus:outline-none rounded-b-xl"
          />
        )}
      </div>

      {/* Доп. инструкция клиента — редактируемая */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Доп. инструкция клиента (customPrompt)</label>
          {isCustom
            ? <span className="text-xs text-emerald-600">● Задана</span>
            : <span className="text-xs text-gray-400">○ Пусто — только базовый</span>}
        </div>
        <textarea
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          rows={8}
          placeholder="Тон, особые правила объекта, нюансы. Например: «Обращайся на вы. Заезд строго после 15:00. С животными нельзя.» Не дублируй базовые правила."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-300 resize-y"
        />
        {saved && <p className="text-sm text-emerald-600">Сохранено</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {saving ? 'Сохранение...' : 'Сохранить инструкцию'}
          </button>
          {isCustom && (
            <button onClick={handleReset} disabled={saving} className="border border-gray-200 text-gray-600 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors">
              Очистить
            </button>
          )}
        </div>
      </div>

      {/* Итоговый промпт — что реально получает бот */}
      <div className="border border-gray-100 rounded-xl">
        <button
          onClick={() => setShowEffective(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Итоговый промпт (что получает бот, только чтение)</span>
          <span className="text-gray-400">{showEffective ? '▲' : '▼'}</span>
        </button>
        {showEffective && (
          <textarea
            value={effectivePrompt}
            readOnly
            rows={18}
            className="w-full border-t border-gray-100 px-4 py-3 text-xs font-mono text-gray-500 bg-gray-50 resize-y focus:outline-none rounded-b-xl"
          />
        )}
      </div>
    </div>
  )
}

// ─── Properties sub-tab ───────────────────────────────────────────────────────

function PropertiesSubTab({ tenantId }: { tenantId: string }) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState(''); const [addAddr, setAddAddr] = useState('')
  const [addDesc, setAddDesc] = useState(''); const [addAvitoId, setAddAvitoId] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState(''); const [editAddr, setEditAddr] = useState('')
  const [editDesc, setEditDesc] = useState(''); const [editAvitoId, setEditAvitoId] = useState('')
  const [editActive, setEditActive] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const data = await opsListProperties(tenantId)
    if (data) setProperties(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [tenantId])

  async function handleAdd() {
    if (!addName.trim()) return
    setSaving(true)
    await opsCreateProperty(tenantId, { name: addName, address: addAddr, description: addDesc, avitoItemId: addAvitoId })
    setAddName(''); setAddAddr(''); setAddDesc(''); setAddAvitoId('')
    setShowAdd(false); setSaving(false); load()
  }

  function startEdit(p: Property) {
    setEditId(p.id); setEditName(p.name); setEditAddr(p.address)
    setEditDesc(p.description); setEditAvitoId(p.avitoItemId ?? ''); setEditActive(p.isActive)
  }

  async function saveEdit() {
    if (!editId) return
    setSaving(true)
    await opsUpdateProperty(tenantId, editId, { name: editName, address: editAddr, description: editDesc, avitoItemId: editAvitoId, isActive: editActive })
    setEditId(null); setSaving(false); load()
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Загрузка...</p>

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(v => !v)} className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-gray-700 transition-colors">+ Добавить объект</button>
      </div>
      {showAdd && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2">
          <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder="Название *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          <input type="text" value={addAddr} onChange={e => setAddAddr(e.target.value)} placeholder="Адрес" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          <textarea value={addDesc} onChange={e => setAddDesc(e.target.value)} rows={2} placeholder="Описание для бота" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
          <input type="text" value={addAvitoId} onChange={e => setAddAvitoId(e.target.value)} placeholder="Avito Item ID" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="bg-gray-900 text-white rounded-lg px-3 py-1 text-xs disabled:opacity-50 hover:bg-gray-700 transition-colors">Сохранить</button>
            <button onClick={() => setShowAdd(false)} className="border border-gray-200 rounded-lg px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors">Отмена</button>
          </div>
        </div>
      )}
      {properties.length === 0 && !showAdd && <p className="text-sm text-gray-400 py-2">Объектов нет</p>}
      {properties.map(p => (
        <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
          {editId === p.id ? (
            <div className="space-y-2">
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              <input type="text" value={editAddr} onChange={e => setEditAddr(e.target.value)} placeholder="Адрес" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} placeholder="Описание для бота" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
              <input type="text" value={editAvitoId} onChange={e => setEditAvitoId(e.target.value)} placeholder="Avito Item ID" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} />
                <span className="text-sm text-gray-700">Активен</span>
              </label>
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="bg-gray-900 text-white rounded-lg px-3 py-1 text-xs disabled:opacity-50 transition-colors">Сохранить</button>
                <button onClick={() => setEditId(null)} className="border border-gray-200 rounded-lg px-3 py-1 text-xs text-gray-600 transition-colors">Отмена</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-800">{p.name}</p>
                {p.address && <p className="text-xs text-gray-500">{p.address}</p>}
                <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {p.avitoItemId || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${p.isActive ? 'text-emerald-600' : 'text-gray-400'}`}>{p.isActive ? '✓' : '—'}</span>
                <button onClick={() => startEdit(p)} className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 transition-colors">Изм.</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

function LogsTab({ tenantId }: { tenantId: string }) {
  const [dialogues, setDialogues] = useState<OpsDialogue[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [messages, setMessages] = useState<OpsMessage[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  useEffect(() => {
    opsListDialogues(tenantId).then(d => { if (d) setDialogues(d); setLoading(false) })
  }, [tenantId])

  async function openChat(d: OpsDialogue) {
    if (openId === d.id) { setOpenId(null); return }
    setOpenId(d.id); setLoadingMsgs(true)
    const msgs = await opsGetMessages(tenantId, d.id)
    if (msgs) setMessages(msgs)
    setLoadingMsgs(false)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Загрузка...</p>

  if (dialogues.length === 0) return <p className="text-sm text-gray-400 py-4">Диалогов нет</p>

  return (
    <div className="space-y-2">
      {dialogues.map(d => {
        const last = d.messages[0]
        const isHT = d.pausedUntil !== null
        return (
          <div key={d.id} className="bg-white rounded-xl border border-gray-100">
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => openChat(d)}
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800">{d.guestName || 'Гость'}</span>
                {last && (
                  <span className="text-sm text-gray-400 ml-2 truncate">
                    «{last.content.slice(0, 50)}»
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-400">{isHT ? 'ОП' : 'AI'} · {formatTime(d.updatedAt)}</span>
                <button className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors">
                  {openId === d.id ? 'Закрыть' : 'Открыть'}
                </button>
              </div>
            </div>
            {openId === d.id && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl">
                {loadingMsgs ? (
                  <p className="text-xs text-gray-400">Загрузка...</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map(m => (
                      <div key={m.id} className={`flex gap-2 ${m.role === 'BOT' ? 'justify-end' : ''}`}>
                        <div className={`max-w-xs rounded-xl px-3 py-2 text-sm ${m.role === 'BOT' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                          <p className="text-xs opacity-60 mb-1">[{formatTime(m.processedAt)}] {m.role === 'GUEST' ? 'Гость' : 'Бот'}</p>
                          <p>{m.content}</p>
                        </div>
                      </div>
                    ))}
                    {messages.length === 0 && <p className="text-xs text-gray-400">Сообщений нет</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Content Tab ──────────────────────────────────────────────────────────────

function ContentTab({ tenantId }: { tenantId: string }) {
  const [sub, setSub] = useState<ContentTab>('faq')

  const subTabs: { id: ContentTab; label: string }[] = [
    { id: 'faq', label: 'FAQ' },
    { id: 'prompt', label: 'Промпт' },
    { id: 'properties', label: 'Объекты' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-100 pb-0">
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`px-3 py-2 text-sm rounded-t-lg transition-colors ${sub === t.id ? 'bg-white border border-gray-100 border-b-white -mb-px font-medium text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'faq' && <FaqSubTab tenantId={tenantId} />}
      {sub === 'prompt' && <PromptSubTab tenantId={tenantId} />}
      {sub === 'properties' && <PropertiesSubTab tenantId={tenantId} />}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ tenantId, detail, onReload }: { tenantId: string; detail: OpsClientDetail; onReload: () => void }) {
  const [botLoading, setBotLoading] = useState(false)
  const s = detail.botSession

  async function handleRestart() {
    setBotLoading(true)
    try { await opsBotRestart(tenantId); onReload() }
    finally { setBotLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <StatCard label="Сегодня" value={s?.messagesDay ?? 0} />
        <StatCard label="Неделя" value={s?.messagesWeek ?? 0} />
        <StatCard label="30 дней" value={s?.messagesMonth ?? 0} />
        <StatCard label="FAQ" value={detail.stats.totalFaq} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${s?.isRunning ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          <div>
            <p className={`text-sm font-medium ${s?.isRunning ? 'text-emerald-600' : 'text-gray-400'}`}>
              {s?.isRunning ? 'Бот работает' : 'Бот остановлен'}
            </p>
            {(s?.errorCount ?? 0) > 0 && (
              <p className="text-xs text-yellow-600">Ошибок: {s?.errorCount}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleRestart}
          disabled={botLoading}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {botLoading ? '...' : 'Перезапустить'}
        </button>
      </div>

      {detail.recentErrors.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-600 mb-2">Последние ошибки</p>
          {detail.recentErrors.map((e, i) => (
            <p key={i} className="text-xs text-red-700 font-mono">{e}</p>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">Объекты ({detail.properties.length})</p>
        {detail.properties.length === 0 ? (
          <p className="text-sm text-gray-400">Нет объектов</p>
        ) : (
          <ul className="space-y-1">
            {detail.properties.map(p => (
              <li key={p.id} className="text-sm text-gray-700 flex justify-between">
                <span>{p.name}</span>
                <span className={`text-xs ${p.isActive ? 'text-emerald-600' : 'text-gray-400'}`}>{p.isActive ? 'Активен' : 'Неактивен'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Main ClientDetail ────────────────────────────────────────────────────────

export default function ClientDetail({ tenantId, onBack, createdJustNow }: Props) {
  const [detail, setDetail] = useState<OpsClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')

  async function load() {
    setLoading(true); setError('')
    try {
      const data = await opsGetClient(tenantId)
      if (data) setDetail(data)
      else setError('Клиент не найден')
    } catch {
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tenantId])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Обзор' },
    { id: 'avito', label: 'Авито' },
    { id: 'content', label: 'Контент' },
    { id: 'logs', label: 'Логи' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Все клиенты
        </button>
        {detail && (
          <h2 className="text-lg font-semibold text-gray-900">{detail.tenant.name}</h2>
        )}
      </div>

      {createdJustNow && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <p className="text-sm text-emerald-700">Клиент создан. Настройте Авито-подключение.</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-40">
          <p className="text-sm text-gray-400">Загрузка...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-40">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {detail && !loading && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-100">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm transition-colors ${tab === t.id ? 'border-b-2 border-gray-900 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && <OverviewTab tenantId={tenantId} detail={detail} onReload={load} />}
          {tab === 'avito' && <AvitoTab tenantId={tenantId} detail={detail} />}
          {tab === 'content' && <ContentTab tenantId={tenantId} />}
          {tab === 'logs' && <LogsTab tenantId={tenantId} />}
        </>
      )}
    </div>
  )
}
