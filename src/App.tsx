import { useState, useEffect } from 'react'
import { isAuthenticated, logout } from './auth'
import Login from './client-panel/Login'
import Dashboard from './client-panel/Dashboard'
import FaqManager from './client-panel/FaqManager'
import Properties from './client-panel/Properties'
import SettingsPage from './client-panel/Settings'

type Page = 'login' | 'dashboard' | 'faq' | 'properties' | 'settings'

function getPageFromHash(): Page {
  const hash = window.location.hash.replace('#/', '').replace('#', '')
  if (['dashboard', 'faq', 'properties', 'settings'].includes(hash)) return hash as Page
  return 'dashboard'
}

const NAV: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'faq', label: 'База знаний' },
  { id: 'properties', label: 'Объекты' },
  { id: 'settings', label: 'Настройки' },
]

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    if (!isAuthenticated()) return 'login'
    return getPageFromHash()
  })

  useEffect(() => {
    function onHashChange() {
      if (!isAuthenticated()) {
        setPage('login')
        return
      }
      setPage(getPageFromHash())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function navigate(p: Page) {
    window.location.hash = `/${p}`
    setPage(p)
  }

  function handleLogout() {
    logout()
    setPage('login')
  }

  if (page === 'login') {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <span className="text-sm font-semibold text-gray-900">AvitoBot</span>
            <nav className="flex items-center gap-1">
              {NAV.map(item => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    page === item.id
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {page === 'dashboard' && (
          <Dashboard onNavigate={navigate} onLogout={handleLogout} />
        )}
        {page === 'faq' && <FaqManager />}
        {page === 'properties' && <Properties />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}
