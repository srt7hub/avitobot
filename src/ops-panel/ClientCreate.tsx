import { useState, FormEvent } from 'react'
import { opsCreateClient } from '../api'

interface Props {
  onCreated: (tenantId: string) => void
  onCancel: () => void
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export default function ClientCreate({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [botName, setBotName] = useState('Менеджер')
  const [managerEmail, setManagerEmail] = useState('')
  const [managerPassword, setManagerPassword] = useState('')
  const [managerName, setManagerName] = useState('')
  const [telegramContact, setTelegramContact] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleNameChange(val: string) {
    setName(val)
    if (!slugManual) setSlug(toSlug(val))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await opsCreateClient({
        name, slug, botName, managerEmail, managerPassword, managerName, telegramContact,
      })
      if (result?.tenantId) onCreated(result.tenantId)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания клиента')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Назад
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Новый клиент</h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название компании</label>
            <input
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="ИП Сидоров"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (латиница)</label>
            <input
              type="text"
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugManual(true) }}
              required
              pattern="[a-z0-9-]+"
              title="Только строчные латинские буквы, цифры и дефис"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 font-mono"
              placeholder="sidorov"
            />
            <p className="text-xs text-gray-400 mt-1">Автоматически из названия. Только a-z, 0-9, -</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя бота</label>
            <input
              type="text"
              value={botName}
              onChange={e => setBotName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="Менеджер"
            />
            <p className="text-xs text-gray-400 mt-1">Как бот представляется гостям</p>
          </div>

          <hr className="border-gray-100" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Данные для входа в панель</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email менеджера</label>
            <input
              type="email"
              value={managerEmail}
              onChange={e => setManagerEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="manager@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Временный пароль</label>
            <input
              type="password"
              value={managerPassword}
              onChange={e => setManagerPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя менеджера</label>
            <input
              type="text"
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="Рифат"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telegram контакт</label>
            <input
              type="text"
              value={telegramContact}
              onChange={e => setTelegramContact(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="@username"
            />
            <p className="text-xs text-gray-400 mt-1">Для Human Takeover алертов</p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-gray-900 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Создание...' : 'Создать клиента'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="border border-gray-200 text-gray-600 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
