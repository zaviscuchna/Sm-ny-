'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Branch } from '@/types'
import { useAuth } from './AuthContext'
import { getBranchesForBusiness } from '@/lib/db'
import { isRegistered } from '@/lib/db'

interface BranchContextType {
  branches: Branch[]
  activeBranch: Branch | null
  setActiveBranch: (branch: Branch | null) => void
  refreshBranches: () => Promise<void>
  loading: boolean
}

const BranchContext = createContext<BranchContextType | null>(null)

const BRANCH_STORAGE_KEY = 'smenky_active_branch'

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { activeBusiness } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshBranches = useCallback(async () => {
    if (!activeBusiness || !isRegistered(activeBusiness.id)) {
      setBranches([])
      setActiveBranchState(null)
      return
    }
    setLoading(true)
    try {
      const b = await getBranchesForBusiness(activeBusiness.id)
      setBranches(b)
      // Restore saved branch or default to first
      const savedId = localStorage.getItem(BRANCH_STORAGE_KEY)
      const saved = savedId ? b.find(br => br.id === savedId) : null
      if (saved) {
        setActiveBranchState(saved)
      } else if (activeBranch && b.find(br => br.id === activeBranch.id)) {
        // Keep current
      } else {
        setActiveBranchState(null)
      }
    } catch {
      setBranches([])
    }
    setLoading(false)
  }, [activeBusiness?.id])

  useEffect(() => {
    refreshBranches()
  }, [refreshBranches])

  const setActiveBranch = (branch: Branch | null) => {
    setActiveBranchState(branch)
    if (branch) {
      localStorage.setItem(BRANCH_STORAGE_KEY, branch.id)
    } else {
      localStorage.removeItem(BRANCH_STORAGE_KEY)
    }
  }

  return (
    <BranchContext.Provider value={{ branches, activeBranch, setActiveBranch, refreshBranches, loading }}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const ctx = useContext(BranchContext)
  if (!ctx) throw new Error('useBranch musí být použit uvnitř BranchProvider')
  return ctx
}
