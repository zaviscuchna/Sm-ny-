'use client'

import { useState, useEffect } from 'react'
import type { User } from '@/types'
import { ALL_USERS } from '@/lib/mock-data'

const STORAGE_KEY = 'smenky_user'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setUser(JSON.parse(stored))
    } catch {}
    setLoading(false)
  }, [])

  const login = (email: string): { success: boolean; error?: string } => {
    const found = ALL_USERS.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (!found) return { success: false, error: 'Uživatel nenalezen' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(found))
    setUser(found)
    return { success: true }
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  return { user, loading, login, logout }
}
