import { useState } from 'react'
import { UnhandledQuestion, resolveUnhandled } from '../../api'

interface Props {
  questions: UnhandledQuestion[]
  onResolved: (id: string) => void
}

interface ResolveFormProps {
  question: UnhandledQuestion
  onDone: (id: string) => void
  onCancel: () => void
}

function ResolveForm({ question, onDone, onCancel }: ResolveFormProps) {
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!answer.trim()) return
    setLoading(true)
    setError('')
    try {
      await resolveUnhandled(question.id, answer.trim())
      onDone(question.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        rows={2}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
        placeholder="Введите ответ..."
        autoFocus
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading || !answer.trim()}
          className="bg-gray-900 text-white rounded-lg px-3 py-1 text-xs font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Сохранение...' : 'Сохранить в FAQ'}
        </button>
        <button
          onClick={onCancel}
          className="border border-gray-200 text-gray-600 rounded-lg px-3 py-1 text-xs hover:bg-gray-50 transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}

export default function UnhandledList({ questions, onResolved }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  const visible = questions.filter(q => !hiddenIds.has(q.id))

  if (visible.length === 0) return null

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Непонятные вопросы ({visible.length})
      </h3>
      <div className="space-y-2">
        {visible.map(q => (
          <div key={q.id} className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <p className="text-sm text-gray-800">«{q.question}»</p>
            {expandedId === q.id ? (
              <ResolveForm
                question={q}
                onDone={id => {
                  onResolved(id)
                  setExpandedId(null)
                }}
                onCancel={() => setExpandedId(null)}
              />
            ) : (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setExpandedId(q.id)}
                  className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1 hover:bg-white transition-colors"
                >
                  Добавить ответ
                </button>
                <button
                  onClick={() => setHiddenIds(prev => new Set(prev).add(q.id))}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Скрыть
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
