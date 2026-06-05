import { useState, useEffect, FormEvent } from 'react'
import { fetchSettings, updateSettings, updateAvitoConfig, Settings } from '../api'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [botName, setBotName] = useState('')
  const [telegramContact, setTelegramContact] = useState('')
  const [avitoClientId, setAvitoClientId] = useState('')
  const [avitoClientSecret, setAvitoClientSecret] = useState('')
  const [avitoUserId, setAvitoUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingAvito, setSavingAvito] = useState(false)
  const [error, setError] = useState('')
  const [avitoError, setAvitoError] = useState('')
  const [saved, setSaved] = useState(false)
  const [avitoSaved, setAvitoSaved] = useState(false)

  useEffect(() => {
    fetchSettings().then(data => {
      if (data) {
        setSettings(data)
        setBotName(data.botName ?? '')
        setTelegramContact(data.telegramContact ?? '')
        setAvitoClientId(data.avitoClientId ?? '')
        setAvitoClientSecret(data.avitoClientSecret ?? '')
        setAvitoUserId(data.avitoUserId ?? '')
      }
      setLoading(false)
    }).catch(() => {
      setError('Не удалось загрузить настройки')
      setLoading(false)
    })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await updateSettings({ botName, telegramContact })
      setSaved(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvitoSubmit(e: FormEvent) {
    e.preventDefault()
    setSavingAvito(true)
    setAvitoSaved(false)
    setAvitoError('')
    try {
      await updateAvitoConfig({ avitoClientId, avitoClientSecret, avitoUserId })
      setAvitoSaved(true)
    } catch (err: unknown) {
      setAvitoError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSavingAvito(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-gray-400">Загрузка...</p>
      </div>
    )
  }

  if (!settings && error) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Настройки</h2>

      {/* Общие настройки */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Общие</h3>
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telegram для алертов</label>
            <input
              type="text"
              value={telegramContact}
              onChange={e => setTelegramContact(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="@username"
            />
            <p className="text-xs text-gray-400 mt-1">Куда приходит уведомление при запросе оператора</p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Настройки сохранены</p>}

          <button
            type="submit"
            disabled={saving}
            className="bg-gray-900 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </form>
      </div>

      {/* Avito OAuth */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Avito OAuth</h3>
        <p className="text-xs text-gray-400 mb-4">
          Ключи доступа для подключения к API Avito. Получите их в{' '}
          <a
            href="https://developers.avito.ru/cabinet/oauth"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            кабинете разработчика Avito
          </a>
          .
        </p>
        <form onSubmit={handleAvitoSubmit} className="space-y-5 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input
              type="text"
              value={avitoClientId}
              onChange={e => setAvitoClientId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
            <input
              type="password"
              value={avitoClientSecret}
              onChange={e => setAvitoClientSecret(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="••••••••••••••••••••••••••••••••"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
            <input
              type="text"
              value={avitoUserId}
              onChange={e => setAvitoUserId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="123456789"
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-1">Числовой ID вашего аккаунта Avito</p>
          </div>

          {avitoError && <p className="text-sm text-red-500">{avitoError}</p>}
          {avitoSaved && <p className="text-sm text-emerald-600">OAuth-ключи сохранены</p>}

          <button
            type="submit"
            disabled={savingAvito}
            className="bg-gray-900 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {savingAvito ? 'Сохранение...' : 'Сохранить ключи'}
          </button>
        </form>
      </div>
    </div>
  )
}
