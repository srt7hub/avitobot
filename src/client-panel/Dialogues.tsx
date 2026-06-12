import { useState, useEffect } from 'react'
import {
  fetchDialogues, fetchDialogue, setDialogueBot,
  DialogueSummary, DialogueFull,
} from '../api'

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'вчера'
  if (diffDays < 7) return d.toLocaleDateString('ru', { weekday: 'short' })
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleString('ru', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function MessageBubble({ role, content, processedAt }: { role: string; content: string; processedAt: string }) {
  const isBot = role === 'BOT'
  return (
    <div className={`flex ${isBot ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isBot ? 'bg-gray-900 text-white' : 'bg-white border border-gray-100 text-gray-800'}`}>
        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        <p className={`text-xs mt-1 ${isBot ? 'text-gray-400' : 'text-gray-400'}`}>{formatFull(processedAt)}</p>
      </div>
    </div>
  )
}

function DialogueView({
  dialogue, onBack, onBotToggle,
}: {
  dialogue: DialogueFull
  onBack: () => void
  onBotToggle: (disabled: boolean) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggleBot() {
    setSaving(true)
    setError('')
    const next = !dialogue.botDisabled
    try {
      await setDialogueBot(dialogue.id, next)
      onBotToggle(next)
    } catch {
      setError('Не удалось изменить статус бота')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
        >
          ← Назад
        </button>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{dialogue.guestName}</h2>
          <p className="text-xs text-gray-400">
            {dialogue.propertyName && `${dialogue.propertyName} · `}
            {dialogue.messageCount} сообщений
            {dialogue.isHumanTakeover && ' · ⚠ передан оператору'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div>
          <p className="text-sm font-medium text-gray-800">
            {dialogue.botDisabled ? 'Бот отключён в этом чате' : 'Бот отвечает в этом чате'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {dialogue.botDisabled
              ? 'Гостю отвечаете только вы — автоответы не отправляются'
              : 'Отключите, чтобы вести переписку вручную'}
          </p>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        <button
          onClick={toggleBot}
          disabled={saving}
          role="switch"
          aria-checked={!dialogue.botDisabled}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            dialogue.botDisabled ? 'bg-gray-300' : 'bg-gray-900'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              dialogue.botDisabled ? 'translate-x-1' : 'translate-x-6'
            }`}
          />
        </button>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 space-y-3 min-h-40">
        {dialogue.messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Сообщений нет</p>
        ) : (
          dialogue.messages.map(m => (
            <MessageBubble key={m.id} role={m.role} content={m.content} processedAt={m.processedAt} />
          ))
        )}
      </div>
    </div>
  )
}

export default function Dialogues() {
  const [dialogues, setDialogues] = useState<DialogueSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<DialogueFull | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function load(p: number) {
    setLoading(true)
    setError('')
    try {
      const result = await fetchDialogues(p)
      if (result) {
        setDialogues(result.dialogues)
        setTotal(result.total)
        setPage(result.page)
        setPages(result.pages)
      }
    } catch {
      setError('Не удалось загрузить диалоги')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [])

  async function openDialogue(id: string) {
    setLoadingDetail(true)
    try {
      const result = await fetchDialogue(id)
      if (result) setSelected(result)
    } catch {
      setError('Не удалось загрузить диалог')
    } finally {
      setLoadingDetail(false)
    }
  }

  if (selected) {
    return (
      <DialogueView
        dialogue={selected}
        onBack={() => setSelected(null)}
        onBotToggle={(disabled) => {
          setSelected({ ...selected, botDisabled: disabled })
          setDialogues(ds => ds.map(d => (d.id === selected.id ? { ...d, botDisabled: disabled } : d)))
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">История диалогов</h2>
        <span className="text-sm text-gray-400">{total} диалогов</span>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-sm text-gray-400">Загрузка...</p>
        </div>
      ) : dialogues.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-400">Диалогов пока нет</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {dialogues.map(d => (
              <button
                key={d.id}
                onClick={() => openDialogue(d.id)}
                disabled={loadingDetail}
                className="w-full text-left bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:border-gray-300 transition-colors disabled:opacity-60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">{d.guestName}</p>
                      {d.botDisabled && (
                        <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 flex-shrink-0">бот выкл.</span>
                      )}
                      {d.isHumanTakeover && (
                        <span className="text-xs bg-orange-100 text-orange-600 rounded-full px-2 py-0.5 flex-shrink-0">оператор</span>
                      )}
                    </div>
                    {d.propertyName && (
                      <p className="text-xs text-gray-400 mt-0.5">{d.propertyName}</p>
                    )}
                    {d.lastMessage && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {d.lastMessage.role === 'BOT' ? '🤖 ' : '👤 '}
                        {d.lastMessage.content}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {d.lastMessageAt && (
                      <p className="text-xs text-gray-400">{formatTime(d.lastMessageAt)}</p>
                    )}
                    <p className="text-xs text-gray-300 mt-0.5">{d.messageCount} сообщ.</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => load(page - 1)}
                disabled={page === 1}
                className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-colors"
              >
                ← Назад
              </button>
              <span className="text-sm text-gray-400">{page} / {pages}</span>
              <button
                onClick={() => load(page + 1)}
                disabled={page === pages}
                className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-colors"
              >
                Вперёд →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
