'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export const SIDEBAR_MIN_WIDTH = 240
export const SIDEBAR_MAX_WIDTH = 400
export const SIDEBAR_DEFAULT_WIDTH = 280
const STORAGE_KEY = 'bloomer_sidebar_width'

type SidebarContextType = {
  isOpen: boolean
  width: number
  toggle: () => void
  open: () => void
  close: () => void
  setWidth: (w: number) => void
  resetWidth: () => void
}

const SidebarContext = createContext<SidebarContextType | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true)
  const [width, setWidthState] = useState<number>(SIDEBAR_DEFAULT_WIDTH)

  // hydration後にlocalStorageから復元（SSRミスマッチを防ぐためuseEffect内で行う）
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed)) {
          setWidthState(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, parsed)))
        }
      }
    } catch {
      // localStorage読み取り失敗時はデフォルト値を維持
    }
  }, [])

  const setWidth = (w: number) => {
    const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, w))
    setWidthState(clamped)
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped))
    } catch {
      // localStorage書き込み失敗時は状態のみ更新
    }
  }

  const resetWidth = () => {
    setWidthState(SIDEBAR_DEFAULT_WIDTH)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        width,
        toggle: () => setIsOpen((v) => !v),
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        setWidth,
        resetWidth,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar(): SidebarContextType {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    return {
      isOpen: true,
      width: SIDEBAR_DEFAULT_WIDTH,
      toggle: () => {},
      open: () => {},
      close: () => {},
      setWidth: () => {},
      resetWidth: () => {},
    }
  }
  return ctx
}
