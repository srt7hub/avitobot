import { useState, useEffect, FormEvent } from 'react'

function PasswordField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-300"
        placeholder={placeholder}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        tabIndex={-1}
      >
        {show ? '🙈' : '👁'}
      </button>
    </div>
  )
}
import { fetchSettings, updateSettings, updateAvitoConfig, checkAvitoConnection, updateTelegramConfig, testTelegramConnection, fetchAvitoOAuthUrl, Settings } from '../api'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [botName, setBotName] = useState('')
  const [telegramContact, setTelegramContact] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [avitoClientId, setAvitoClientId] = useState('')
  const [avitoClientSecret, setAvitoClientSecret] = useState('')
  const [avitoUserId, setAvitoUserId] = useState('')
  const [tgBotToken, setTgBotToken] = useState('')
  const [tgChatId, setTgChatId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingAvito, setSavingAvito] = useState(false)
  const [savingTg, setSavingTg] = useState(false)
  const [checkingAvito, setCheckingAvito] = useState(false)
  const [avitoCheckResult, setAvitoCheckResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [error, setError] = useState('')
  const [avitoError, setAvitoError] = useState('')
  const [tgError, setTgError] = useState('')
  const [saved, setSaved] = useState(false)
  const [avitoSaved, setAvitoSaved] = useState(false)
  const [tgSaved, setTgSaved] = useState(false)

  useEffect(() => {
    fetchSettings().then(data => {
      if (data) {
        setSettings(data)
        setBotName(data.botName ?? '')
        setTelegramContact(data.telegramContact ?? '')
        setCustomPrompt(data.customPrompt ?? '')
        setAvitoClientId(data.avitoClientId ?? '')
        setAvitoClientSecret(data.avitoClientSecret ?? '')
        setAvitoUserId(data.avitoUserId ?? '')
        setTgBotToken(data.telegramBotToken ?? '')
        setTgChatId(data.telegramChatId ?? '')
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
      await updateSettings({ botName, telegramContact, customPrompt })
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
    setAvitoCheckResult(null)
    try {
      await updateAvitoConfig({ avitoClientId, avitoClientSecret, avitoUserId })
      setSettings(s => s ? { ...s, avitoClientId, avitoClientSecret, avitoUserId } : s)
      setAvitoSaved(true)
    } catch (err: unknown) {
      setAvitoError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSavingAvito(false)
    }
  }

  async function handleTgSubmit(e: FormEvent) {
    e.preventDefault()
    setSavingTg(true)
    setTgSaved(false)
    setTgError('')
    try {
      await updateTelegramConfig({ telegramBotToken: tgBotToken, telegramChatId: tgChatId })
      setSettings(s => s ? { ...s, telegramBotToken: tgBotToken, telegramChatId: tgChatId } : s)
      setTgSaved(true)
    } catch (err: unknown) {
      setTgError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSavingTg(false)
    }
  }

  const [testingTg, setTestingTg] = useState(false)
  const [tgTestResult, setTgTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [oauthResult, setOauthResult] = useState<{ ok: boolean; error?: string } | null>(() => {
    const raw = sessionStorage.getItem('avito_oauth_result')
    if (!raw) return null
    sessionStorage.removeItem('avito_oauth_result')
    try {
      const parsed = JSON.parse(raw) as { ok: boolean; reason?: string }
      return { ok: parsed.ok, error: parsed.reason }
    } catch { return null }
  })

  async function handleTgTest() {
    setTestingTg(true)
    setTgTestResult(null)
    try {
      const result = await testTelegramConnection()
      setTgTestResult(result ?? { ok: false, error: 'Нет ответа' })
    } catch {
      setTgTestResult({ ok: false, error: 'Ошибка подключения' })
    } finally {
      setTestingTg(false)
    }
  }

  async function handleAvitoOAuth() {
    setOauthLoading(true)
    setOauthResult(null)
    try {
      const result = await fetchAvitoOAuthUrl()
      if (result?.url) {
        window.location.href = result.url
      }
    } catch (err: unknown) {
      setOauthResult({ ok: false, error: err instanceof Error ? err.message : 'Ошибка' })
      setOauthLoading(false)
    }
  }

  async function handleCheckAvito() {
    setCheckingAvito(true)
    setAvitoCheckResult(null)
    try {
      const result = await checkAvitoConnection()
      setAvitoCheckResult(result ?? { ok: false, error: 'Нет ответа' })
    } catch {
      setAvitoCheckResult({ ok: false, error: 'Ошибка подключения' })
    } finally {
      setCheckingAvito(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-gray-400">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Настройки</h2>

{/* Системный промпт */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Инструкция для бота</h3>
        <p className="text-xs text-gray-400 mb-4">
          Дополнительный контекст для AI — правила общения, тон, особые инструкции. Если пусто, бот работает по умолчанию.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            rows={6}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-y font-mono"
            placeholder={`Пример:\nОтвечай вежливо и кратко. Если гость спрашивает про цену — уточни даты заезда. Не обсуждай скидки без согласования с хозяином.`}
          />
          {saved && <p className="text-sm text-emerald-600">Настройки сохранены</p>}
          <button
            type="submit"
            disabled={saving}
            className="bg-gray-900 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить инструкцию'}
          </button>
        </form>
      </div>

      {/* Telegram уведомления */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Telegram уведомления</h3>
        <p className="text-xs text-gray-400 mb-4">
          Бот будет слать уведомления о каждом диалоге, запросе оператора и неизвестных вопросах.
          Создайте бота через <span className="font-mono">@BotFather</span>, получите токен и Chat ID.
        </p>
        <form onSubmit={handleTgSubmit} className="space-y-5 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bot Token</label>
            <PasswordField value={tgBotToken} onChange={setTgBotToken} placeholder="123456789:ABC..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chat ID</label>
            <input
              type="text"
              value={tgChatId}
              onChange={e => setTgChatId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="-1001234567890"
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-1">Используйте @userinfobot чтобы узнать Chat ID</p>
          </div>
          {tgError && <p className="text-sm text-red-500">{tgError}</p>}
          {tgSaved && <p className="text-sm text-emerald-600">Telegram настроен</p>}
          {tgTestResult && (
            <div className={`rounded-lg px-4 py-3 text-sm ${tgTestResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {tgTestResult.ok ? '✓ Тестовое сообщение отправлено' : `✗ Ошибка: ${tgTestResult.error}`}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={savingTg}
              className="bg-gray-900 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {savingTg ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={handleTgTest}
              disabled={testingTg || !settings?.telegramChatId}
              className="border border-gray-200 text-gray-700 rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {testingTg ? 'Отправка...' : 'Отправить тест'}
            </button>
          </div>
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
            <PasswordField value={avitoClientSecret} onChange={setAvitoClientSecret} placeholder="Client Secret" />
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

          {avitoCheckResult && (
            <div className={`rounded-lg px-4 py-3 text-sm ${avitoCheckResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {avitoCheckResult.ok ? '✓ Подключение успешно — Avito API отвечает' : `✗ Ошибка: ${avitoCheckResult.error}`}
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button
              type="submit"
              disabled={savingAvito}
              className="bg-gray-900 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {savingAvito ? 'Сохранение...' : 'Сохранить ключи'}
            </button>
            <button
              type="button"
              onClick={handleCheckAvito}
              disabled={checkingAvito}
              className="border border-gray-200 text-gray-700 rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {checkingAvito ? 'Проверка...' : 'Проверить подключение'}
            </button>
          </div>

          <div className="border-t border-gray-100 pt-4 mt-2">
            <p className="text-xs text-gray-500 mb-3">
              Для доступа к объявлениям нужна авторизация через Авито. После сохранения ключей нажмите кнопку ниже — вас перенаправят на страницу Авито для подтверждения доступа.
            </p>
            {oauthResult && (
              <div className={`rounded-lg px-4 py-3 text-sm mb-3 ${oauthResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {oauthResult.ok ? '✓ Авито успешно авторизован — объявления доступны' : `✗ Ошибка авторизации: ${oauthResult.error}`}
              </div>
            )}
            <button
              type="button"
              onClick={handleAvitoOAuth}
              disabled={oauthLoading || !avitoClientId}
              className="flex items-center gap-2 bg-[#00AFFE] hover:bg-[#0099e0] text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {oauthLoading ? 'Переход...' : 'Войти через Авито'}
            </button>
            {!avitoClientId && <p className="text-xs text-gray-400 mt-1">Сначала сохраните Client ID</p>}
          </div>
        </form>
      </div>
    </div>
  )
}
