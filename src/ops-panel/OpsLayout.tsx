import { logout } from '../auth'

type OpsPage = 'clients' | 'create'

interface Props {
  page: OpsPage
  onNavigate: (page: OpsPage) => void
  children: React.ReactNode
}

export default function OpsLayout({ page, onNavigate, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-48 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">AvitoBot</p>
          <p className="text-xs text-gray-400">Ops Panel</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <button
            onClick={() => onNavigate('clients')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              page === 'clients' || page === 'create'
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Клиенты
          </button>
        </nav>
        <div className="px-2 py-3 border-t border-gray-100">
          <button
            onClick={() => logout()}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
