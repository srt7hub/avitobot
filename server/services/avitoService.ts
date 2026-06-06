import prisma from '../prisma.js'

const BASE_URL = 'https://api.avito.ru'
const TOKEN_URL = 'https://api.avito.ru/token/'

export interface AvitoTokenState {
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

export interface AvitoChat {
  id: string
  item_id: string
  users: Array<{ id: number; name: string }>
  last_message?: { created: number; content?: { text?: string } }
  context?: { value?: { id?: number | string } }
}

export interface AvitoMessage {
  id: string
  author_id: number
  created: number
  content?: { text?: string }
  isRead: boolean
  type: string
}

export interface TenantAvitoConfig {
  id: string
  tenantId: string
  avitoClientId: string
  avitoClientSecret: string
  avitoUserId: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: Date | null
  pollingEnabled: boolean
}

// Per-tenant in-memory token cache (accessToken + expiresAt)
const tokenCache = new Map<string, AvitoTokenState>()

async function loadTokenFromDB(tenantId: string): Promise<AvitoTokenState | null> {
  const cfg = await prisma.tenantAvitoConfig.findUnique({ where: { tenantId } })
  if (!cfg?.accessToken) return null
  return {
    accessToken: cfg.accessToken,
    refreshToken: cfg.refreshToken || undefined,
    expiresAt: cfg.tokenExpiresAt?.getTime() ?? 0,
  }
}

async function saveTokenToDB(tenantId: string, state: AvitoTokenState): Promise<void> {
  await prisma.tenantAvitoConfig.update({
    where: { tenantId },
    data: {
      accessToken: state.accessToken,
      refreshToken: state.refreshToken ?? '',
      tokenExpiresAt: new Date(state.expiresAt),
    },
  })
  tokenCache.set(tenantId, state)
}

async function fetchNewToken(config: TenantAvitoConfig): Promise<AvitoTokenState> {
  const { avitoClientId: clientId, avitoClientSecret: clientSecret, tenantId } = config
  const cached = tokenCache.get(tenantId)
  const refreshToken = cached?.refreshToken || config.refreshToken || undefined

  if (refreshToken) {
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          scope: 'messenger:read messenger:write items:info',
        }),
      })
      if (res.ok) {
        const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }
        const state: AvitoTokenState = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || refreshToken,
          expiresAt: Date.now() + data.expires_in * 1000,
        }
        await saveTokenToDB(tenantId, state)
        return state
      }
    } catch (err) {
      console.warn(`[avitoService][${tenantId}] refresh_token grant failed, falling back to client_credentials`, err)
    }
  }

  // Fallback: client_credentials
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'messenger:read messenger:write items:info',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[avitoService][${tenantId}] Failed to get token: ${res.status} ${body}`)
  }

  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }
  const state: AvitoTokenState = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  await saveTokenToDB(tenantId, state)
  return state
}

export async function refreshTokenIfNeeded(config: TenantAvitoConfig): Promise<AvitoTokenState> {
  const bufferMs = 60 * 1000
  let state = tokenCache.get(config.tenantId)

  if (!state) {
    state = await loadTokenFromDB(config.tenantId) ?? undefined
    if (state) tokenCache.set(config.tenantId, state)
  }

  if (!state?.accessToken || Date.now() >= (state.expiresAt - bufferMs)) {
    state = await fetchNewToken(config)
  }

  return state
}

async function withToken<T>(config: TenantAvitoConfig, fn: (token: string, userId: string) => Promise<T>): Promise<T> {
  const state = await refreshTokenIfNeeded(config)
  return fn(state.accessToken, config.avitoUserId)
}

export async function getChats(config: TenantAvitoConfig, limit = 100, offset = 0): Promise<AvitoChat[]> {
  return withToken(config, async (token, userId) => {
    const res = await fetch(
      `${BASE_URL}/messenger/v2/accounts/${userId}/chats?limit=${limit}&offset=${offset}&unread_only=false`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }
    )
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`[avitoService][${config.tenantId}] getChats failed: ${res.status} ${body}`)
    }
    const data = await res.json() as { chats: AvitoChat[] }
    return (data.chats || []).map(chat => ({
      ...chat,
      item_id: String(chat.context?.value?.id || chat.item_id || ''),
    }))
  })
}

export async function getAllChats(config: TenantAvitoConfig): Promise<AvitoChat[]> {
  const all: AvitoChat[] = []
  const limit = 100
  let offset = 0
  while (true) {
    const page = await getChats(config, limit, offset)
    all.push(...page)
    if (page.length < limit) break
    offset += limit
  }
  return all
}

export async function getMessages(config: TenantAvitoConfig, chatId: string): Promise<AvitoMessage[]> {
  return withToken(config, async (token, userId) => {
    const res = await fetch(
      `${BASE_URL}/messenger/v3/accounts/${userId}/chats/${chatId}/messages/`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }
    )
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`[avitoService][${config.tenantId}] getMessages failed: ${res.status} ${body}`)
    }
    const data = await res.json() as { messages: Array<Record<string, unknown>> }
    return (data.messages || []).map(m => ({
      ...m,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      isRead: Boolean((m as any).isRead ?? (m as any).read ?? false),
    })) as AvitoMessage[]
  })
}

export async function sendMessage(config: TenantAvitoConfig, chatId: string, text: string): Promise<void> {
  return withToken(config, async (token, userId) => {
    const res = await fetch(
      `${BASE_URL}/messenger/v1/accounts/${userId}/chats/${chatId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { text }, type: 'text' }),
        signal: AbortSignal.timeout(15_000),
      }
    )
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`[avitoService][${config.tenantId}] sendMessage failed: ${res.status} ${body}`)
    }
  })
}

export async function markAsRead(config: TenantAvitoConfig, chatId: string): Promise<void> {
  return withToken(config, async (token, userId) => {
    const res = await fetch(
      `${BASE_URL}/messenger/v1/accounts/${userId}/chats/${chatId}/read`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      }
    )
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`[avitoService][${config.tenantId}] markAsRead failed: ${res.status} ${body}`)
    }
  })
}

export interface AvitoItem {
  id: number
  title: string
  price: number | null
  address: string | null
  images: Array<{ '208x156'?: string; '640x480'?: string; '1280x960'?: string }>
  status: string
  url: string
}

export async function getItemsByUser(config: TenantAvitoConfig): Promise<AvitoItem[]> {
  return withToken(config, async (token, userId) => {
    const res = await fetch(
      `${BASE_URL}/core/v1/items?per_page=50&page=1&status=active,old,blocked,rejected,removed,closed`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }
    )
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`[avitoService][${config.tenantId}] getItemsByUser failed: ${res.status} ${body}`)
    }
    const data = await res.json() as { resources: AvitoItem[] }
    return data.resources || []
  })
}
