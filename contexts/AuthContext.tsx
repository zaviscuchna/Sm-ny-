'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import type { User, Business } from '@/types'
import { ALL_USERS, BUSINESSES } from '@/lib/mock-data'

const STORAGE_KEY     = 'smenky_user'
const BIZ_STORAGE_KEY = 'smenky_active_biz'
const REG_USERS_KEY   = 'smenky_reg_users'
const REG_BIZ_KEY     = 'smenky_reg_biz'

// Demo business join codes
const DEMO_CODES: Record<string, string> = {
  '111111': 'biz-1',
  '222222': 'biz-2',
  '333333': 'biz-3',
}

// Cookie helpers — cookies survive iOS PWA restarts better than localStorage
const COOKIE_USER_KEY = 'smenky_auth'
const COOKIE_BIZ_KEY  = 'smenky_biz'
const COOKIE_MAX_AGE  = 365 * 24 * 60 * 60 // 1 year

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`
}
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}
function deleteCookie(name: string) {
  document.cookie = `${name}=;path=/;max-age=0`
}

function getRegisteredUsers(): User[] {
  try { return JSON.parse(localStorage.getItem(REG_USERS_KEY) || '[]') } catch { return [] }
}
function getRegisteredBiz(): (Business & { joinCode?: string })[] {
  try { return JSON.parse(localStorage.getItem(REG_BIZ_KEY) || '[]') } catch { return [] }
}

interface RegisterData {
  name: string
  email: string
  password: string
  businessName?: string
  location?: string
  joinCode?: string
}

interface AuthResult { success: boolean; error?: string; role?: string }

interface AuthContextType {
  user:           User | null
  loading:        boolean
  activeBusiness: Business | null
  joinCode:       string | null
  login:          (email: string, password: string) => Promise<AuthResult>
  register:       (type: 'manager' | 'employee', data: RegisterData) => Promise<AuthResult>
  logout:         () => void
  switchBusiness: (bizId: string) => void
  clearBusiness:  () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,           setUser]           = useState<User | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null)
  const [joinCode,       setJoinCode]       = useState<string | null>(null)

  useEffect(() => {
    try {
      // Try localStorage first, then cookie fallback (iOS PWA clears localStorage)
      let stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) stored = getCookie(COOKIE_USER_KEY)

      if (stored) {
        const parsedUser = JSON.parse(stored)
        setUser(parsedUser)

        // Sync both storage mechanisms
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedUser))
        setCookie(COOKIE_USER_KEY, JSON.stringify(parsedUser))

        // Restore active business
        let storedBizId = localStorage.getItem(BIZ_STORAGE_KEY)
          || getCookie(COOKIE_BIZ_KEY)
          || (parsedUser as any).businessId
        if (storedBizId) {
          const allBiz = [...BUSINESSES, ...getRegisteredBiz()]
          const biz = allBiz.find(b => b.id === storedBizId)
          if (biz) {
            setActiveBusiness(biz)
            setJoinCode((biz as any).joinCode ?? null)
            localStorage.setItem(BIZ_STORAGE_KEY, biz.id)
            setCookie(COOKIE_BIZ_KEY, biz.id)
          }
        }
      }
    } catch {}
    setLoading(false)
  }, [])

  // ─── helpers ────────────────────────────────────────────────────────────────

  function storeBiz(biz: Business, code?: string) {
    setActiveBusiness(biz)
    setJoinCode(code ?? null)
    localStorage.setItem(BIZ_STORAGE_KEY, biz.id)
    setCookie(COOKIE_BIZ_KEY, biz.id)
  }

  function storeUser(u: User) {
    const json = JSON.stringify(u)
    localStorage.setItem(STORAGE_KEY, json)
    setCookie(COOKIE_USER_KEY, json)
    setUser(u)
  }

  // ─── login ──────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string): Promise<AuthResult> => {
    // 1. Check mock users (demo — accept password '123456')
    const mockUser = ALL_USERS.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (mockUser) {
      if (password !== '123456') return { success: false, error: 'Špatné heslo.' }
      storeUser(mockUser)
      if (mockUser.role === 'superadmin') {
        setActiveBusiness(null); setJoinCode(null)
        localStorage.removeItem(BIZ_STORAGE_KEY)
        deleteCookie(COOKIE_BIZ_KEY)
      } else {
        const biz = BUSINESSES.find(b => b.id === (mockUser as any).businessId) ?? BUSINESSES[0]
        storeBiz(biz)
      }
      return { success: true, role: mockUser.role }
    }

    // 2. Check localStorage registered users (fast, offline)
    const regUser = getRegisteredUsers().find(u => u.email.toLowerCase() === email.toLowerCase())
    if (regUser) {
      storeUser(regUser)
      const biz = getRegisteredBiz().find(b => b.id === (regUser as any).businessId)
      if (biz) storeBiz(biz, (biz as any).joinCode)
      return { success: true, role: regUser.role }
    }

    // 3. Check database (user registered on another device)
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data.error ?? 'Přihlášení selhalo.' }
      }
      const data = await res.json()
      if (data?.user) {
        const newUser: User & { businessId?: string } = {
          id:    data.user.id,
          name:  data.user.name,
          email: data.user.email,
          role:  data.user.role,
          color: data.user.color,
          businessId: data.user.businessId ?? data.business?.id,
        }
        storeUser(newUser)

        if (data.business) {
          const existing = getRegisteredBiz()
          if (!existing.find(b => b.id === data.business.id)) {
            localStorage.setItem(REG_BIZ_KEY, JSON.stringify([
              ...existing,
              { ...data.business, joinCode: data.joinCode },
            ]))
          }
          storeBiz(data.business, data.joinCode)
        }

        return { success: true, role: data.user.role }
      }
    } catch {}

    return { success: false, error: 'Uživatel nenalezen. Zkus demo účet nebo se zaregistruj.' }
  }

  // ─── register ───────────────────────────────────────────────────────────────

  const register = async (
    type: 'manager' | 'employee',
    data: RegisterData,
  ): Promise<AuthResult> => {
    // Check mock users (demo accounts can't be re-registered)
    if (ALL_USERS.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, error: 'Tento e-mail je již registrován.' }
    }

    // All registrations go through API → saved in DB (accessible from any device)
    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type, ...data, password: data.password }),
      })
      const result = await res.json()

      if (!res.ok) {
        return { success: false, error: result.error ?? 'Chyba při registraci.' }
      }

      const newUser: User & { businessId?: string } = {
        id:         result.user.id,
        name:       result.user.name,
        email:      result.user.email,
        role:       result.user.role,
        color:      result.user.color,
        businessId: result.user.businessId,
      }

      // Cache in localStorage + cookie
      const existingUsers = getRegisteredUsers()
      localStorage.setItem(REG_USERS_KEY, JSON.stringify([...existingUsers, newUser]))
      storeUser(newUser)

      if (result.business) {
        const existingBiz = getRegisteredBiz()
        if (!existingBiz.find(b => b.id === result.business.id)) {
          localStorage.setItem(REG_BIZ_KEY, JSON.stringify([
            ...existingBiz,
            { ...result.business, joinCode: result.joinCode },
          ]))
        }
        storeBiz(result.business, result.joinCode)
      }

      return { success: true, role: newUser.role }
    } catch (e: any) {
      return { success: false, error: `Chyba při registraci: ${e.message}` }
    }
  }

  // ─── logout / switch ─────────────────────────────────────────────────────────

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(BIZ_STORAGE_KEY)
    deleteCookie(COOKIE_USER_KEY)
    deleteCookie(COOKIE_BIZ_KEY)
    setUser(null)
    setActiveBusiness(null)
    setJoinCode(null)
  }

  const switchBusiness = (bizId: string) => {
    const allBiz = [...BUSINESSES, ...getRegisteredBiz()]
    const biz = allBiz.find(b => b.id === bizId)
    if (!biz) return
    storeBiz(biz, (biz as any).joinCode)
  }

  const clearBusiness = () => {
    setActiveBusiness(null)
    setJoinCode(null)
    localStorage.removeItem(BIZ_STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{
      user, loading, activeBusiness, joinCode,
      login, register, logout, switchBusiness, clearBusiness,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export { }

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth musí být použit uvnitř AuthProvider')
  return ctx
}
