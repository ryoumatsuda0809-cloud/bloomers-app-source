'use client'

import { type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import AppSidebar from './AppSidebar'
import { useSidebar } from '@/components/providers/SidebarProvider'

type AppShellProps = {
  children: ReactNode
  showRoadmap?: boolean
  rightSlot?: ReactNode
}

export default function AppShell({ children, showRoadmap = false, rightSlot }: AppShellProps) {
  const { toggle } = useSidebar()

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar showRoadmap={showRoadmap} />

      <div className="flex-1 min-w-0 overflow-x-hidden">
        {/* モバイルのみトグルバー表示（デスクトップはアイコンレール🌸で開く） */}
        <div className="lg:hidden sticky top-0 z-20 flex items-center gap-2 px-4 py-3 bg-background/80 backdrop-blur border-b border-border">
          <button
            onClick={toggle}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition text-muted-foreground"
            aria-label="メニュー開閉"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold text-foreground">🌸 Bloomers</span>
        </div>

        {children}
      </div>

      {rightSlot}
    </div>
  )
}
