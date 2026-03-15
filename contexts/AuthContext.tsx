'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import type { User, Business } from '@/types'
import { ALL_USERS, BUSINESSES } from '@/lib/mock-data'
import { supabaseEnabled } from '@/lib/supabase'
import {
  dbCreateBusiness, dbCreateUser, dbGetUserByEmail,
  dbGetBusinessByJoinCode, dbGetBusiness,
} from '@/lib/db'

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

const AVATAR_COLORS = ['#6366f1','#f59e0b','#10b981','#ec4899','#3b82f6','#8b5cf6','#14b8a6','#f97316']
const randomColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]

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
  joinCode:       string | null   // join code for active registered business
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

    // 2. Check localStorage registered users
    const regUser = getRegisteredUsers().find(u => u.email.toLowerCase() === email.toLowerCase())
    if (regUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(regUser))
      setUser(regUser)
      const bizList = getRegisteredBiz()
      const biz = bizList.find(b => b.id === (regUser as any).businessId)
      if (biz) storeBiz(biz, (biz as any).joinCode)
      return { success: true, role: regUser.role }
    }

    // 3. Check Supabase (registered users that may have been created on another device)
    if (supabaseEnabled) {
      try {
        const dbUser = await dbGetUserByEmail(email)
        if (dbUser) {
          const newUser: User = {
            id:    dbUser.id,
            name:  dbUser.name,
            email: dbUser.email,
            role:  dbUser.role,
            color: dbUser.color,
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
          setUser(newUser)

          if (dbUser.businessId) {
            const bizData = await dbGetBusiness(dbUser.businessId)
            if (bizData) {
              const biz = bizData.business
              // Also cache in localStorage for fast reload
              const existing = getRegisteredBiz()
              if (!existing.find(b => b.id === biz.id)) {
                localStorage.setItem(REG_BIZ_KEY, JSON.stringify([
                  ...existing,
                  { ...biz, joinCode: bizData.joinCode },
                ]))
              }
              storeBiz(biz, bizData.joinCode)
            }
          }

          return { success: true, role: dbUser.role }
        }
      } catch {}
    }

    return { success: false, error: 'Uživatel nenalezen. Zkus demo účet nebo se zaregistruj.' }
  }

  // ─── register ───────────────────────────────────────────────────────────────

  const register = async (
    type: 'manager' | 'employee',
    data: RegisterData,
  ): Promise<AuthResult> => {
    const allUsers = [...ALL_USERS, ...getRegisteredUsers()]
    if (allUsers.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, error: 'Tento e-mail je již registrován.' }
    }

    let biz: Business | null = null
    let code: string | undefined

    if (type === 'manager') {
      if (supabaseEnabled) {
        try {
          const result = await dbCreateBusiness(data.businessName!, data.location ?? '')
          biz  = result.business
          code = result.joinCode
        } catch (e: any) {
          return { success: false, error: `Chyba při vytváření podniku: ${e.message}` }
        }
      } else {
        // Offline fallback — localStorage only
        biz  = { id: `biz-reg-${Date.now()}`, name: data.businessName!, location: data.location ?? '' }
        code = String(Math.floor(100000 + Math.random() * 900000))
      }

      // Cache biz with join code in localStorage
      const existing = getRegisteredBiz()
      localStorage.setItem(REG_BIZ_KEY, JSON.stringify([...existing, { ...biz, joinCode: code }]))

    } else {
      // Employee: look up business by join code
      const codeStr = data.joinCode?.trim() ?? ''
      const demoBizId = DEMO_CODES[codeStr]

      if (demoBizId) {
        biz = BUSINESSES.find(b => b.id === demoBizId) ?? null
      } else if (supabaseEnabled) {
        try {
          const result = await dbGetBusinessByJoinCode(codeStr)
          if (result) { biz = result.business; code = result.joinCode }
        } catch {}
      }

      if (!biz) {
        // Try localStorage registered businesses
        const regBiz = getRegisteredBiz()
        const found = regBiz.find(b =>
          (b as any).joinCode === codeStr ||
          b.id.replace(/\D/g, '').slice(-6).padStart(6, '0') === codeStr
        )
        if (found) { biz = found; code = (found as any).joinCode }
      }

      if (!biz) return { success: false, error: 'Kód podniku nebyl nalezen. Zkus 111111 pro demo.' }
    }

    const newUser: User & { businessId?: string } = {
      id:         `u-reg-${Date.now()}`,
      name:       data.name,
      email:      data.email,
      role:       type === 'manager' ? 'manager' : 'employee',
      color:      randomColor(),
      businessId: biz?.id,
    }

    // Write to Supabase if configured and it's a registered (non-demo) business
    if (supabaseEnabled && biz && biz.id.startsWith('biz-reg-')) {
      try {
        await dbCreateUser({
          id:         newUser.id,
          name:       newUser.name,
          email:      newUser.email,
          role:       newUser.role,
          businessId: biz.id,
          color:      newUser.color!,
        })
      } catch (e: any) {
        return { success: false, error: `Chyba při registraci: ${e.message}` }
      }
    }

    // Always cache in localStorage
    const existing = getRegisteredUsers()
    localStorage.setItem(REG_USERS_KEY, JSON.stringify([...existing, newUser]))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
    setUser(newUser)

    if (biz) storeBiz(biz, code)
    return { success: true, role: newUser.role }
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

// Re-export dbGetBusinessByJoinCode so register page can call it directly if needed
export { dbGetBusinessByJoinCode }

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth musí být použit uvnitř AuthProvider')
  return ctx
}
