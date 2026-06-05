const TOKEN_KEY = 'jwt'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

interface JwtPayload {
  userId: string
  tenantId: string | null
  role: 'CLIENT' | 'OPS'
  exp: number
}

function decodeToken(): JwtPayload | null {
  const token = getToken()
  if (!token) return null
  try {
    return JSON.parse(atob(token.split('.')[1])) as JwtPayload
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  const payload = decodeToken()
  return payload !== null && payload.exp * 1000 > Date.now()
}

export function getRole(): 'CLIENT' | 'OPS' | null {
  return decodeToken()?.role ?? null
}

export function logout(): void {
  removeToken()
  window.location.hash = '/login'
}
