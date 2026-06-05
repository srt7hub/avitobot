import { getToken, logout } from './auth'

const BASE = '/api'

function authHeaders(): HeadersInit {
  const token = getToken()
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  })
  if (res.status === 401) {
    logout()
    return null
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

// Auth

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

// Dashboard

export interface DashboardData {
  bot: { isRunning: boolean; lastPollAt: string | null; errorCount: number }
  stats: { today: number; week: number; month: number; autoReplyRate: number }
  recentDialogues: {
    id: string
    guestName: string
    lastMessage: string
    wasHumanTakeover: boolean
    updatedAt: string
  }[]
  unhandledCount: number
}

export function fetchDashboard() {
  return request<DashboardData>('/client/dashboard')
}

export function botStart() {
  return request('/client/bot/start', { method: 'POST' })
}

export function botStop() {
  return request('/client/bot/stop', { method: 'POST' })
}

// FAQ

export interface FaqEntry {
  id: string
  question: string
  answer: string
  propertyId: string | null
  isActive: boolean
  createdAt: string
}

export interface FaqData {
  global: FaqEntry[]
  byProperty: Record<string, FaqEntry[]>
}

export interface UnhandledQuestion {
  id: string
  question: string
  createdAt: string
}

export function fetchFaq() {
  return request<FaqData>('/client/faq')
}

export function createFaq(payload: { question: string; answer: string; propertyId?: string }) {
  return request<FaqEntry>('/client/faq', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFaq(id: string, payload: { question?: string; answer?: string; isActive?: boolean }) {
  return request<FaqEntry>(`/client/faq/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteFaq(id: string) {
  return request(`/client/faq/${id}`, { method: 'DELETE' })
}

export function fetchUnhandled() {
  return request<UnhandledQuestion[]>('/client/faq/unhandled')
}

export function resolveUnhandled(id: string, answer: string) {
  return request<FaqEntry>(`/client/faq/unhandled/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  })
}

// Properties

export interface Property {
  id: string
  name: string
  address: string
  description: string
  avitoItemId: string | null
  isActive: boolean
}

export function fetchProperties() {
  return request<Property[]>('/client/properties')
}

export function createProperty(payload: { name: string; address: string; description: string }) {
  return request<Property>('/client/properties', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProperty(
  id: string,
  payload: { name?: string; address?: string; description?: string; isActive?: boolean }
) {
  return request<Property>(`/client/properties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// Settings

export interface Settings {
  botName: string
  telegramContact: string
}

export function fetchSettings() {
  return request<Settings>('/client/settings')
}

export function updateSettings(payload: { botName?: string; telegramContact?: string }) {
  return request('/client/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
