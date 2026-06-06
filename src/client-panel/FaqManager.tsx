import { useState, useEffect } from 'react'
import {
  fetchFaq, createFaq, updateFaq, deleteFaq,
  fetchUnhandled, fetchListings,
  FaqEntry, FaqData, UnhandledQuestion, Listing,
} from '../api'
import FaqForm from './components/FaqForm'
import UnhandledList from './components/UnhandledList'

export default function FaqManager() {
  const [faqData, setFaqData] = useState<FaqData | null>(null)
  const [unhandled, setUnhandled] = useState<UnhandledQuestion[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [filterPropertyId, setFilterPropertyId] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [faq, uq, lst] = await Promise.all([
        fetchFaq(),
        fetchUnhandled(),
        fetchListings(),
      ])
      if (faq) setFaqData(faq)
      if (uq) setUnhandled(uq)
      if (lst) setListings(lst.listings)
    } catch {
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function getAllEntries(): FaqEntry[] {
    if (!faqData) return []
    const all: FaqEntry[] = [...faqData.global]
    for (const entries of Object.values(faqData.byProperty)) {
      all.push(...entries)
    }
    return all
  }

  function getFilteredEntries(): FaqEntry[] {
    if (!filterPropertyId) return getAllEntries()
    if (filterPropertyId === '__global__') return faqData?.global ?? []
    return faqData?.byProperty[filterPropertyId] ?? []
  }

  async function handleAdd(question: string, answer: string, propertyId?: string) {
    await createFaq({ question, answer, propertyId })
    setShowAddForm(false)
    await load()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Удалить этот ответ?')) return
    await deleteFaq(id)
    await load()
  }

  function startEdit(entry: FaqEntry) {
    setEditingId(entry.id)
    setEditQuestion(entry.question)
    setEditAnswer(entry.answer)
  }

  async function saveEdit(id: string) {
    setEditLoading(true)
    try {
      await updateFaq(id, { question: editQuestion, answer: editAnswer })
      setEditingId(null)
      await load()
    } finally {
      setEditLoading(false)
    }
  }

  function handleUnhandledResolved(id: string) {
    setUnhandled(prev => prev.filter(q => q.id !== id))
    load()
  }

  const entries = getFilteredEntries()
  const propertyName = (propertyId: string | null) => {
    if (!propertyId) return 'Все объекты'
    return listings.find(l => l.propertyId === propertyId)?.title ?? 'Объект'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-gray-400">Загрузка...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900">База знаний бота</h2>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          + Добавить ответ
        </button>
      </div>

      {showAddForm && (
        <FaqForm
          listings={listings}
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Объект:</label>
        <select
          value={filterPropertyId}
          onChange={e => setFilterPropertyId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
        >
          <option value="">Все объекты</option>
          <optgroup label="Общее">
            <option value="__global__">Глобальные (для всех)</option>
          </optgroup>
          {listings.length > 0 && (
            <optgroup label="По квартирам">
              {listings.map(l => (
                <option key={l.propertyId} value={l.propertyId}>{l.title}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-400">Нет ответов. Добавьте первый.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              {editingId === entry.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editQuestion}
                    onChange={e => setEditQuestion(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                  <textarea
                    value={editAnswer}
                    onChange={e => setEditAnswer(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(entry.id)}
                      disabled={editLoading}
                      className="bg-gray-900 text-white rounded-lg px-4 py-1.5 text-sm hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      {editLoading ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="border border-gray-200 text-gray-600 rounded-lg px-4 py-1.5 text-sm hover:bg-gray-50 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-800">{entry.question}</p>
                  <p className="text-sm text-gray-500 mt-1">{entry.answer}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">{propertyName(entry.propertyId)}</span>
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEdit(entry)}
                        className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <UnhandledList questions={unhandled} onResolved={handleUnhandledResolved} />
    </div>
  )
}
