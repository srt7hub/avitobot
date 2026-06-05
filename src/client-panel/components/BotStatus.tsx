interface Props {
  isRunning: boolean
  onStart: () => void
  onStop: () => void
  loading: boolean
}

export default function BotStatus({ isRunning, onStart, onStop, loading }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`w-3 h-3 rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-gray-300'}`}
        />
        <div>
          <p className={`font-medium text-sm ${isRunning ? 'text-emerald-600' : 'text-gray-400'}`}>
            {isRunning ? 'Бот работает' : 'Бот остановлен'}
          </p>
        </div>
      </div>
      <button
        onClick={isRunning ? onStop : onStart}
        disabled={loading}
        className={`text-sm px-4 py-1.5 rounded-lg border font-medium disabled:opacity-50 transition-colors ${
          isRunning
            ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
            : 'bg-gray-900 text-white border-gray-900 hover:bg-gray-700'
        }`}
      >
        {loading ? '...' : isRunning ? 'Остановить' : 'Запустить'}
      </button>
    </div>
  )
}
