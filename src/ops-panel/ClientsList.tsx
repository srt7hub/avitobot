import { useState, useEffect } from 'react'
import { opsListClients, opsGetStatus, OpsClientSummary, OpsStatus } from '../api'

interface Props {
  onOpen: (tenantId: string) => void
  onCreate: () => void
}

function statusIcon(client: OpsClientSummary) {
  if (!client.bot.isRunning && client.bot.errorCount === 0) {
    return { icon: '⏸', label: 'Стоп', color: 'text-gray-400' }
  }
  if (client.bot.errorCount > 0) {
    return { icon: '⚠', label: 'Ошибка', color: 'text-yellow-500' }
  }
  return { icon: '●', label: 'Работает', color: 'text-emerald-500' }
}

export default function ClientsList({ onOpen, onCreate }: Props) {
  const [clients, setClients] = useState<OpsClientSummary[]>([])
  const [status, setStatus] = useState<OpsStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([opsListClients(), opsGetStatus()])
      .then(([c, s]) => {
        if (c) setClients(c.clients)
        if (s) setStatus(s)
      })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false))
  }, [])

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

  const running = clients.filter(c => c.bot.isRunning && c.bot.errorCount === 0).length
  const withErrors = clients.filter(c => c.bot.errorCount > 0).length
  const stopped = clients.filter(c => !c.bot.isRunning).length
  const totalToday = clients.reduce((s, c) => s + c.bot.todayMessages, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Клиенты</h2>
        <button
          onClick={onCreate}
          className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          + Новый клиент
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-400">Клиентов пока нет. Создайте первого.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Клиент</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Статус</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Сегодня</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Ошибки</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map(client => {
                const s = statusIcon(client)
                return (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{client.name}</p>
                      <p className="text-xs text-gray-400">{client.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${s.color}`}>{s.icon} {s.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{client.bot.todayMessages}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={client.bot.errorCount > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}>
                        {client.bot.errorCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onOpen(client.id)}
                        className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1 hover:bg-gray-100 transition-colors"
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer summary */}
      {status && (
        <p className="text-xs text-gray-400 text-center">
          Итого: {clients.length} {clients.length === 1 ? 'клиент' : 'клиента'} | {running} работают | {withErrors} с ошибкой | {stopped} остановлен | Сообщений сегодня: {totalToday}
        </p>
      )}
    </div>
  )
}
