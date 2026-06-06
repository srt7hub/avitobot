import { useState, useEffect } from 'react'
import { isAuthenticated, getRole, logout } from './auth'

import Login from './client-panel/Login'
import Dashboard from './client-panel/Dashboard'
import FaqManager from './client-panel/FaqManager'
import Properties from './client-panel/Properties'
import SettingsPage from './client-panel/Settings'
import Dialogues from './client-panel/Dialogues'

import OpsLayout from './ops-panel/OpsLayout'
import ClientsList from './ops-panel/ClientsList'
import ClientCreate from './ops-panel/ClientCreate'
import ClientDetail from './ops-panel/ClientDetail'

// ─── Client Panel routing ─────────────────────────────────────────────────────

type ClientPage = 'dashboard' | 'faq' | 'properties' | 'settings' | 'dialogues'

const CLIENT_PAGES: ClientPage[] = ['dashboard', 'faq', 'properties', 'settings', 'dialogues']

function getClientPage(): ClientPage {
  const hash = window.location.hash.replace('#/', '').replace('#', '')
  return CLIENT_PAGES.includes(hash as ClientPage) ? (hash as ClientPage) : 'dashboard'
}

const CLIENT_NAV: { id: ClientPage; label: string }[] = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'faq', label: 'База знаний' },
  { id: 'properties', label: 'Объекты' },
  { id: 'dialogues', label: 'Диалоги' },
  { id: 'settings', label: 'Настройки' },
]

function ClientApp() {
  const [page, setPage] = useState<ClientPage>(getClientPage)

  useEffect(() => {
    function onHash() { setPage(getClientPage()) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function navigate(p: ClientPage) {
    window.location.hash = `/${p}`
    setPage(p)
  }

  function handleLogout() { logout() }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <span className="text-sm font-semibold text-gray-900">AvitoBot</span>
            <nav className="flex items-center gap-1">
              {CLIENT_NAV.map(item => (
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
      <main className="max-w-2xl mx-auto px-4 py-6">
        {page === 'dashboard' && <Dashboard onNavigate={navigate} onLogout={handleLogout} />}
        {page === 'faq' && <FaqManager />}
        {page === 'properties' && <Properties />}
        {page === 'dialogues' && <Dialogues />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}

// ─── Ops Panel routing ────────────────────────────────────────────────────────

type OpsView =
  | { type: 'list' }
  | { type: 'create' }
  | { type: 'detail'; tenantId: string; fresh?: boolean }

function OpsApp() {
  const [view, setView] = useState<OpsView>({ type: 'list' })

  const opsPage = view.type === 'list' || view.type === 'detail' ? 'clients' : 'create'

  return (
    <OpsLayout page={opsPage} onNavigate={() => setView({ type: 'list' })}>
      {view.type === 'list' && (
        <ClientsList
          onOpen={id => setView({ type: 'detail', tenantId: id })}
          onCreate={() => setView({ type: 'create' })}
        />
      )}
      {view.type === 'create' && (
        <ClientCreate
          onCreated={id => setView({ type: 'detail', tenantId: id, fresh: true })}
          onCancel={() => setView({ type: 'list' })}
        />
      )}
      {view.type === 'detail' && (
        <ClientDetail
          tenantId={view.tenantId}
          onBack={() => setView({ type: 'list' })}
          createdJustNow={view.fresh}
        />
      )}
    </OpsLayout>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated)

  useEffect(() => {
    function onHash() { setAuthed(isAuthenticated()) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (!authed) return <Login />

  const role = getRole()
  if (role === 'OPS') return <OpsApp />
  return <ClientApp />
}
