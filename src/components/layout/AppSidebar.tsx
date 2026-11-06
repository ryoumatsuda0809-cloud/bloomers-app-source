'use client'

import { useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSidebar } from '@/components/providers/SidebarProvider'
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '@/components/providers/SidebarProvider'
import { useQuestStore } from '@/store/useQuestStore'
import { Map, FolderKanban, MessageCircle, User, NotebookPen, GripVertical } from 'lucide-react'

type AppSidebarProps = {
  showRoadmap?: boolean
}

const NAV_ITEMS = [
  { href: '/', label: 'ロードマップ', icon: Map },
  { href: '/projects', label: 'マイプロジェクト', icon: FolderKanban },
  { href: '/mentor', label: 'メンターと話す', icon: MessageCircle },
  { href: '/notes', label: 'メモ', icon: NotebookPen },
]

const PROFILE_ITEM = { href: '/profile', label: 'プロフィール', icon: User }

// デスクトップ判定（1280px以上）
const isDesktop = () => typeof window !== 'undefined' && window.innerWidth >= 1280

export default function AppSidebar({ showRoadmap = false }: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isOpen, width, close, open, setWidth, resetWidth } = useSidebar()
  const quests = useQuestStore((state) => state.quests)
  // ドラッグ中に実際に移動したかどうかを追跡（クリックとドラッグを区別）
  const hasMovedRef = useRef(false)

  const handleNavClick = (href: string) => {
    router.push(href)
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      close()
    }
  }

  const startDrag = useCallback((e: React.MouseEvent) => {
    // スマホ・タブレットではドラッグ無効
    if (!isDesktop()) return

    e.preventDefault()
    hasMovedRef.current = false
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const onMove = (ev: MouseEvent) => {
      hasMovedRef.current = true
      const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, ev.clientX))
      setWidth(clamped)
    }

    const onUp = () => {
      // 移動なし（クリックのみ）→ デフォルト幅280pxにリセット
      if (!hasMovedRef.current) {
        resetWidth()
      }
      hasMovedRef.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [setWidth, resetWidth])

  const canShowRoadmapDetail = showRoadmap && quests.length > 0

  // 閉じた時：デスクトップのみ w-14 アイコンレール。モバイルは hidden
  if (!isOpen) {
    return (
      <aside className="hidden lg:flex flex-col items-center w-14 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0 py-3 gap-1">
        <button
          onClick={open}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition text-base shrink-0"
          aria-label="サイドバーを開く"
        >
          🌸
        </button>

        <div className="flex-1 flex flex-col gap-0.5 mt-2 w-full items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                title={item.label}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition ${
                  active
                    ? 'bg-accent/30 text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="size-4" />
              </button>
            )
          })}
        </div>

        {/* 下部固定：プロフィール */}
        <button
          onClick={() => router.push(PROFILE_ITEM.href)}
          title={PROFILE_ITEM.label}
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition shrink-0 ${
            pathname === PROFILE_ITEM.href
              ? 'bg-accent/30 text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <User className="size-4" />
        </button>
      </aside>
    )
  }

  // 開いた時：フルサイドバー
  return (
    <>
      {/* モバイルオーバーレイ */}
      <div className="lg:hidden fixed inset-0 bg-black/40 z-30" onClick={close} />

      <aside
        className="fixed lg:sticky top-0 left-0 z-40 h-screen shrink-0 border-r border-border bg-sidebar flex flex-col"
        style={{ width: `${width}px` }}
      >
        {/* ロゴ + 閉じるボタン */}
        <div className="px-4 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">🌸</span>
            <span className="font-heading text-base font-bold text-foreground tracking-tight truncate">Bloomers</span>
          </div>
          <button
            onClick={close}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground shrink-0 ml-2"
            aria-label="サイドバーを閉じる"
          >
            <span className="text-sm leading-none">«</span>
          </button>
        </div>

        {/* ロードマップ詳細（ダッシュボードのみ） */}
        {canShowRoadmapDetail && (
          <div className="px-3 py-3 border-b border-border overflow-y-auto max-h-64 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground px-2 mb-2 uppercase tracking-wider">ロードマップ</p>
            <div className="space-y-0.5">
              {quests.map((q) => (
                <div
                  key={q.id}
                  className={`text-xs px-2 py-1.5 rounded-lg truncate ${
                    q.status === 'active' || q.status === 'in_progress'
                      ? 'text-foreground font-semibold bg-accent/30'
                      : q.status === 'completed'
                      ? 'text-foreground/60'
                      : 'text-muted-foreground/60'
                  }`}
                >
                  {q.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ナビゲーション */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => handleNavClick(item.href)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition text-left ${
                  active
                    ? 'bg-accent/30 text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* 下部固定：プロフィール */}
        <div className="px-3 py-3 border-t border-border shrink-0">
          <button
            onClick={() => handleNavClick(PROFILE_ITEM.href)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition text-left ${
              pathname === PROFILE_ITEM.href
                ? 'bg-accent/30 text-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <User className="size-4 shrink-0" />
            {PROFILE_ITEM.label}
          </button>
        </div>

        {/* ドラッグハンドル（デスクトップのみ・右端絶対配置）
            - ドラッグ: 240〜400px で幅変更
            - クリック（移動なし）: デフォルト280pxにリセット */}
        <div
          onMouseDown={startDrag}
          title="ドラッグで幅変更 / クリックでリセット"
          className="hidden xl:flex absolute top-0 right-0 w-3 h-full cursor-col-resize items-center justify-center group"
          aria-hidden="true"
        >
          <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/40 group-active:bg-primary/60 transition-colors" />
          <GripVertical className="absolute size-3 text-muted-foreground/40 group-hover:text-primary/50 transition-colors" />
        </div>
      </aside>
    </>
  )
}
