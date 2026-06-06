import { useState, useEffect, FormEvent } from 'react'
import { fetchProperties, createProperty, updateProperty, Property, fetchAvitoItems, AvitoItem } from '../api'

function statusLabel(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: 'Активно', color: 'text-emerald-600' },
    old: { label: 'Старое', color: 'text-yellow-600' },
    blocked: { label: 'Заблокировано', color: 'text-red-500' },
    rejected: { label: 'Отклонено', color: 'text-red-500' },
    removed: { label: 'Удалено', color: 'text-gray-400' },
    closed: { label: 'Закрыто', color: 'text-gray-400' },
  }
  return map[status] ?? { label: status, color: 'text-gray-500' }
}

function AvitoItemCard({ item }: { item: AvitoItem }) {
  const [imgIdx, setImgIdx] = useState(0)
  const images = item.images
    .map(img => img['640x480'] || img['208x156'] || img['1280x960'])
    .filter(Boolean) as string[]
  const status = statusLabel(item.status)
  const addressText = item.address ?? null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {images.length > 0 ? (
        <div className="relative">
          <img
            src={images[imgIdx]}
            alt={item.title}
            className="w-full h-48 object-cover"
          />
          {images.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIdx ? 'bg-white' : 'bg-white/50'}`}
                />
              ))}
            </div>
          )}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setImgIdx(i => Math.max(0, i - 1))}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs transition-colors"
              >
                ‹
              </button>
              <button
                onClick={() => setImgIdx(i => Math.min(images.length - 1, i + 1))}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs transition-colors"
              >
                ›
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400 text-xs">Нет фото</span>
        </div>
      )}
      <div className="p-4 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-800 leading-tight">{item.title}</p>
          <span className={`text-xs font-medium flex-shrink-0 ${status.color}`}>● {status.label}</span>
        </div>
        {item.price !== null && (
          <p className="text-base font-bold text-gray-900">
            {item.price === 0 ? 'Цена не указана' : `${item.price.toLocaleString('ru-RU')} ₽`}
          </p>
        )}
        {addressText && (
          <p className="text-xs text-gray-500">{addressText}</p>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-blue-600 hover:underline mt-1"
        >
          Открыть на Авито →
        </a>
      </div>
    </div>
  )
}

export default function Properties() {
  const [tab, setTab] = useState<'local' | 'avito'>('avito')

  const [properties, setProperties] = useState<Property[]>([])
  const [loadingLocal, setLoadingLocal] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editActive, setEditActive] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  const [addName, setAddName] = useState('')
  const [addAddress, setAddAddress] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const [avitoItems, setAvitoItems] = useState<AvitoItem[]>([])
  const [loadingAvito, setLoadingAvito] = useState(true)
  const [avitoError, setAvitoError] = useState('')

  async function loadLocal() {
    setLoadingLocal(true)
    setError('')
    try {
      const result = await fetchProperties()
      if (result) setProperties(result)
    } catch {
      setError('Не удалось загрузить объекты')
    } finally {
      setLoadingLocal(false)
    }
  }

  async function loadAvito() {
    setLoadingAvito(true)
    setAvitoError('')
    try {
      const result = await fetchAvitoItems()
      if (result) setAvitoItems(result.items)
    } catch (err: unknown) {
      setAvitoError(err instanceof Error ? err.message : 'Не удалось загрузить объявления с Авито')
    } finally {
      setLoadingAvito(false)
    }
  }

  useEffect(() => { loadLocal(); loadAvito() }, [])

  function startEdit(p: Property) {
    setEditingId(p.id)
    setEditName(p.name)
    setEditAddress(p.address)
    setEditDescription(p.description)
    setEditActive(p.isActive)
  }

  async function saveEdit() {
    if (!editingId) return
    setEditLoading(true)
    try {
      await updateProperty(editingId, {
        name: editName,
        address: editAddress,
        description: editDescription,
        isActive: editActive,
      })
      setEditingId(null)
      await loadLocal()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!addName.trim()) return
    setAddLoading(true)
    try {
      await createProperty({ name: addName, address: addAddress, description: addDescription })
      setSubmitMsg('Заявка отправлена. Наша команда добавит объект в течение 24 часов.')
      setShowAddForm(false)
      setAddName('')
      setAddAddress('')
      setAddDescription('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка при отправке')
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Объекты</h2>
        {tab === 'local' && (
          <button
            onClick={() => { setShowAddForm(v => !v); setSubmitMsg('') }}
            className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            + Добавить объект
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('avito')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'avito' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Объявления Авито
        </button>
        <button
          onClick={() => setTab('local')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'local' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Объекты бота
        </button>
      </div>

      {tab === 'avito' && (
        <div>
          {loadingAvito ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-gray-400">Загрузка объявлений...</p>
            </div>
          ) : avitoError ? (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-sm text-red-600">{avitoError}</p>
            </div>
          ) : avitoItems.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <p className="text-sm text-gray-400">Объявлений на Авито не найдено.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3">Найдено объявлений: {avitoItems.length}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {avitoItems.map(item => (
                  <AvitoItemCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'local' && (
        <div className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {submitMsg && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-sm text-emerald-700">{submitMsg}</p>
            </div>
          )}

          {showAddForm && (
            <form onSubmit={handleAdd} className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Новый объект</h3>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Название *</label>
                <input
                  type="text"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  placeholder="Квартира на Ленина, 45"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Адрес</label>
                <input
                  type="text"
                  value={addAddress}
                  onChange={e => setAddAddress(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  placeholder="ул. Ленина, 45, кв. 12"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Описание для бота</label>
                <textarea
                  value={addDescription}
                  onChange={e => setAddDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                  placeholder="Что бот должен знать: правила, особенности, условия..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="bg-gray-900 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {addLoading ? 'Отправка...' : 'Отправить заявку'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="border border-gray-200 text-gray-600 rounded-lg px-4 py-1.5 text-sm hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}

          {loadingLocal ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-gray-400">Загрузка...</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <p className="text-sm text-gray-400">Объектов пока нет.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {properties.map(p => (
                <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  {editingId === p.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Название</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Адрес</label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={e => setEditAddress(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Описание для бота</label>
                        <textarea
                          value={editDescription}
                          onChange={e => setEditDescription(e.target.value)}
                          rows={3}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={e => setEditActive(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Активен</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
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
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.name}</p>
                        {p.address && <p className="text-sm text-gray-500 mt-0.5">{p.address}</p>}
                        {p.avitoItemId && (
                          <p className="text-xs text-gray-400 mt-1">Авито ID: {p.avitoItemId}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs font-medium ${p.isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {p.isActive ? '● Активен' : '○ Неактивен'}
                        </span>
                        <button
                          onClick={() => startEdit(p)}
                          className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1 hover:bg-gray-50 transition-colors"
                        >
                          Редактировать
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
