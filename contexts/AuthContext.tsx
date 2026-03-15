'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import type { User, Business } from '@/types'
import { ALL_USERS, BUSINESSES } from '@/lib/mock-data'

const STORAGE_KEY     = 'smenky_user'
const BIZ_SESSION_KEY = 'smenky_active_biz'
const REG_USERS_KEY   = 'smenky_reg_users'
const REG_BIZ_KEY     = 'smenky_reg_biz'

// Demo business join codes
const DEMO_CODES: Record<string, string> = {
  '111111': 'biz-1',
  '222222': 'biz-2',
  '333333': 'biz-3',
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
  login:          (email: string) => Promise<AuthResult>
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
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setUser(JSON.parse(stored))

      const storedBizId = sessionStorage.getItem(BIZ_SESSION_KEY)
      if (storedBizId) {
        const allBiz = [...BUSINESSES, ...getRegisteredBiz()]
        const biz = allBiz.find(b => b.id === storedBizId)
        if (biz) {
          setActiveBusiness(biz)
          setJoinCode((biz as any).joinCode ?? null)
        }
      }
    } catch {}
    setLoading(false)
  }, [])

  // ─── helpers ────────────────────────────────────────────────────────────────

  function storeBiz(biz: Business, code?: string) {
    setActiveBusiness(biz)
    setJoinCode(code ?? null)
    sessionStorage.setItem(BIZ_SESSION_KEY, biz.id)
  }

  // ─── login ──────────────────────────────────────────────────────────────────

  const login = async (email: string): Promise<AuthResult> => {
    // 1. Check mock users
    const mockUser = ALL_USERS.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (mockUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser))
      setUser(mockUser)
      if (mockUser.role === 'superadmin') {
        setActiveBusiness(null); setJoinCode(null)
        sessionStorage.removeItem(BIZ_SESSION_KEY)
      } else {
        const biz = BUSINESSES.find(b => b.id === (mockUser as any).businessId) ?? BUSINESSES[0]
        storeBiz(biz)
      }
      return { success: true, role: mockUser.role }
    }

    // 2. Check localStorage registered users (fast, offline)
    const regUser = getRegisteredUsers().find(u => u.email.toLowerCase() === email.toLowerCase())
    if (regUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(regUser))
      setUser(regUser)
      const biz = getRegisteredBiz().find(b => b.id === (regUser as any).businessId)
      if (biz) storeBiz(biz, (biz as any).joinCode)
      return { success: true, role: regUser.role }
    }

    // 3. Check database (user registered on another device)
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data) {
        const newUser: User = {
          id:    data.user.id,
          name:  data.user.name,
          email: data.user.email,
          role:  data.user.role,
          color: data.user.color,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
        setUser(newUser)

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
    // Check mock + localStorage first
    const allUsers = [...ALL_USERS, ...getRegisteredUsers()]
    if (allUsers.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, error: 'Tento e-mail je již registrován.' }
    }

    // Check demo codes (employee joining demo business — no DB needed)
    if (type === 'employee') {
      const codeStr    = data.joinCode?.trim() ?? ''
      const demoBizId  = DEMO_CODES[codeStr]
      if (demoBizId) {
        const biz = BUSINESSES.find(b => b.id === demoBizId)
        if (biz) {
          const newUser: User & { businessId?: string } = {
            id:    `u-reg-${Date.now()}`,
            name:  data.name,
            email: data.email,
            role:  'employee',
            color: '#6366f1',
            businessId: biz.id,
          }
          const existing = getRegisteredUsers()
          localStorage.setItem(REG_USERS_KEY, JSON.stringify([...existing, newUser]))
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
          setUser(newUser)
          storeBiz(biz)
          return { success: true, role: 'employee' }
        }
      }
    }

    // Call register API (creates in DB)
    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type, ...data }),
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

      // Cache in localStorage
      const existingUsers = getRegisteredUsers()
      localStorage.setItem(REG_USERS_KEY, JSON.stringify([...existingUsers, newUser]))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
      setUser(newUser)

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
    sessionStorage.removeItem(BIZ_SESSION_KEY)
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
    sessionStorage.removeItem(BIZ_SESSION_KEY)
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
