import { useState, FormEvent } from 'react'
import { Property } from '../../api'

interface Props {
  properties: Property[]
  initialQuestion?: string
  onSave: (question: string, answer: string, propertyId?: string) => Promise<void>
  onCancel: () => void
}

export default function FaqForm({ properties, initialQuestion = '', onSave, onCancel }: Props) {
  const [question, setQuestion] = useState(initialQuestion)
  const [answer, setAnswer] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSave(question.trim(), answer.trim(), propertyId || undefined)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Вопрос</label>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          required
          maxLength={500}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          placeholder="Есть ли парковка?"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Ответ</label>
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          required
          maxLength={2000}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
          placeholder="Да, бесплатная парковка во дворе..."
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Объект</label>
        <select
          value={propertyId}
          onChange={e => setPropertyId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
        >
          <option value="">Все объекты</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-gray-900 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-gray-200 text-gray-600 rounded-lg px-4 py-1.5 text-sm hover:bg-gray-50 transition-colors"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}
