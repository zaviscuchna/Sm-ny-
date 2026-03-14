'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import type { User, Business } from '@/types'
import { ALL_USERS, BUSINESSES } from '@/lib/mock-data'

const STORAGE_KEY       = 'smenky_user'
const BIZ_SESSION_KEY   = 'smenky_active_biz'
const REG_USERS_KEY     = 'smenky_reg_users'
const REG_BIZ_KEY       = 'smenky_reg_biz'

// Business join codes (last 6 digits of id for demo businesses)
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
function getRegisteredBiz(): Business[] {
  try { return JSON.parse(localStorage.getItem(REG_BIZ_KEY) || '[]') } catch { return [] }
}

interface RegisterData {
  name: string
  email: string
  businessName?: string
  location?: string
  joinCode?: string
}

interface AuthContextType {
  user:           User | null
  loading:        boolean
  activeBusiness: Business | null
  login:          (email: string) => { success: boolean; error?: string; role?: string }
  register:       (type: 'manager' | 'employee', data: RegisterData) => { success: boolean; error?: string; role?: string }
  logout:         () => void
  switchBusiness: (bizId: string) => void
  clearBusiness:  () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,           setUser]           = useState<User | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setUser(JSON.parse(stored))

      const storedBizId = sessionStorage.getItem(BIZ_SESSION_KEY)
      if (storedBizId) {
        const allBiz = [...BUSINESSES, ...getRegisteredBiz()]
        const biz = allBiz.find(b => b.id === storedBizId)
        if (biz) setActiveBusiness(biz)
      }
    } catch {}
    setLoading(false)
  }, [])

  const login = (email: string): { success: boolean; error?: string; role?: string } => {
    const allUsers = [...ALL_USERS, ...getRegisteredUsers()]
    const found = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (!found) return { success: false, error: 'Uživatel nenalezen. Zkus demo účet nebo se zaregistruj.' }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(found))
    setUser(found)

    if (found.role === 'superadmin') {
      setActiveBusiness(null)
      sessionStorage.removeItem(BIZ_SESSION_KEY)
    } else {
      // Check registered biz first, then fall back to demo biz-1
      const regBiz = getRegisteredBiz()
      const biz = regBiz.find(b => b.id === (found as any).businessId)
        ?? BUSINESSES.find(b => b.id === (found as any).businessId)
        ?? BUSINESSES[0]
      setActiveBusiness(biz)
      sessionStorage.setItem(BIZ_SESSION_KEY, biz.id)
    }
    return { success: true, role: found.role }
  }

  const register = (
    type: 'manager' | 'employee',
    data: RegisterData
  ): { success: boolean; error?: string; role?: string } => {
    const allUsers = [...ALL_USERS, ...getRegisteredUsers()]
    if (allUsers.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, error: 'Tento e-mail je již registrován.' }
    }

    let biz: Business | null = null

    if (type === 'manager') {
      // Create new business
      biz = {
        id: `biz-reg-${Date.now()}`,
        name: data.businessName!,
        location: data.location ?? '',
      }
      const existing = getRegisteredBiz()
      localStorage.setItem(REG_BIZ_KEY, JSON.stringify([...existing, biz]))
    } else {
      // Employee — find business by join code
      const code = data.joinCode?.trim() ?? ''
      const bizId = DEMO_CODES[code]
        ?? getRegisteredBiz().find(b => b.id.endsWith(code))?.id
      if (!bizId) return { success: false, error: 'Kód podniku nebyl nalezen. Zkus 111111 pro demo.' }
      const allBiz = [...BUSINESSES, ...getRegisteredBiz()]
      biz = allBiz.find(b => b.id === bizId) ?? null
      if (!biz) return { success: false, error: 'Podnik nenalezen.' }
    }

    const newUser: User & { businessId?: string } = {
      id:         `u-reg-${Date.now()}`,
      name:       data.name,
      email:      data.email,
      role:       type === 'manager' ? 'manager' : 'employee',
      color:      randomColor(),
      businessId: biz?.id,
    }

    const existing = getRegisteredUsers()
    localStorage.setItem(REG_USERS_KEY, JSON.stringify([...existing, newUser]))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
    setUser(newUser)

    if (biz) {
      setActiveBusiness(biz)
      sessionStorage.setItem(BIZ_SESSION_KEY, biz.id)
    }

    return { success: true, role: newUser.role }
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(BIZ_SESSION_KEY)
    setUser(null)
    setActiveBusiness(null)
  }

  const switchBusiness = (bizId: string) => {
    const allBiz = [...BUSINESSES, ...getRegisteredBiz()]
    const biz = allBiz.find(b => b.id === bizId)
    if (!biz) return
    setActiveBusiness(biz)
    sessionStorage.setItem(BIZ_SESSION_KEY, bizId)
  }

  const clearBusiness = () => {
    setActiveBusiness(null)
    sessionStorage.removeItem(BIZ_SESSION_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, loading, activeBusiness, login, register, logout, switchBusiness, clearBusiness }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth musí být použit uvnitř AuthProvider')
  return ctx
}
