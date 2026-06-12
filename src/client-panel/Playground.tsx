import { useState, useEffect, useRef } from 'react'
import { fetchProperties, playgroundReply, Property } from '../api'

type ChatMessage =
  | { role: 'user' | 'assistant'; content: string }
  | { role: 'error'; content: string }

// Сценарии = фазы гостя. Управляют гейтингом чувствительных данных в боте
// (код двери / wifi выдаются только в фазах заезда/проживания/выезда).
const PHASE_OPTIONS: { value: string; label: string }[] = [
  { value: 'NO_BOOKING', label: 'Гость без брони' },
  { value: 'AWAITING_PAYMENT', label: 'Забронировал, не оплатил' },
  { value: 'PAID_BEFORE', label: 'Оплатил, ещё не заехал' },
  { value: 'STAYING', label: 'Заехал / проживает' },
  { value: 'POST_STAY_ACTIVE', label: 'Выехал' },
]

export default function Playground() {
  const [properties, setProperties] = useState<Property[]>([])
  const [propertyId, setPropertyId] = useState('') // '' = авто (первый объект)
  const [phase, setPhase] = useState('NO_BOOKING')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProperties()
      .then(props => { if (props) setProperties(props.filter(p => p.isActive)) })
      .catch(() => { /* селектор просто не покажем */ })
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function send() {
    const text = input.trim()
    if (!text || sending) return

    // Только реальные сообщения диалога уходят в API (без системных плашек ошибок).
    const history = messages.filter(
      (m): m is { role: 'user' | 'assistant'; content: string } => m.role !== 'error'
    )
    const nextHistory = [...history, { role: 'user' as const, content: text }]

    setMessages([...messages, { role: 'user', content: text }])
    setInput('')
    setSending(true)

    try {
      const res = await playgroundReply({
        messages: nextHistory,
        propertyId: propertyId || undefined,
        phase,
      })
      if (res) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply }])
      } else {
        setMessages(prev => [...prev, { role: 'error', content: 'Не удалось получить ответ, попробуйте ещё раз' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'error', content: 'Не удалось получить ответ, попробуйте ещё раз' }])
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Тест бота</h2>
        <p className="text-sm text-gray-400 mt-1">
          Напишите боту как гость — увидите, как он ответит. Это тестовый чат: он не виден гостям и не влияет на реальные диалоги.
        </p>
      </div>

      {/* Параметры теста */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4">
        {properties.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Объект
            <select
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="">Авто (первый объект)</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Сценарий
          <select
            value={phase}
            onChange={e => setPhase(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            {PHASE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Лента сообщений */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[28rem]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-center px-6">
              <p className="text-sm text-gray-300">
                Например: «Здравствуйте, квартира свободна на выходные?»
              </p>
            </div>
          )}
          {messages.map((m, i) => {
            if (m.role === 'error') {
              return (
                <div key={i} className="text-center">
                  <span className="inline-block text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                    {m.content}
                  </span>
                </div>
              )
            }
            const isGuest = m.role === 'user'
            return (
              <div key={i} className={`flex ${isGuest ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                    isGuest
                      ? 'bg-gray-900 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            )
          })}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-400 rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm">
                бот печатает…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Поле ввода */}
        <div className="border-t border-gray-100 p-3 flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
            maxLength={1000}
            placeholder="Напишите сообщение…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-50"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="bg-gray-900 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Отправить
          </button>
        </div>
      </div>

      {messages.length > 0 && (
        <button
          onClick={() => setMessages([])}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          Очистить
        </button>
      )}
    </div>
  )
}
