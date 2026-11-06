'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUp, Plus, MessageCircle, ArrowLeft, MoreHorizontal,
  Pencil, Pin, Trash2, Paperclip, X, FileText, Sprout, Bot, Settings, ChevronRight,
  ChevronLeft, GripVertical, PanelLeft,
  Check, ChevronDown, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  getConversations,
  createConversation,
  getConversationMessages,
  sendMentorChatMessage,
  generateConversationTitle,
  renameConversation,
  pinConversation,
  deleteConversation,
  updateConversationMode,
  updateConversationStyle,
  type Conversation,
  type MentorMode,
  type ResponseStyle,
  type Attachment,
} from '@/app/actions/mentor-chat'
import {
  getCustomMentors,
  type CustomMentor,
} from '@/app/actions/custom-mentors'

type UIMessage = { role: 'user' | 'assistant'; content: string; isGreeting?: boolean; suggestions?: string[] }

const LAST_CONV_KEY = 'bloomer_last_conversation_id'
const MENTOR_SIDEBAR_WIDTH_KEY = 'bloomer_mentor_sidebar_width'
const MENTOR_SIDEBAR_OPEN_KEY = 'bloomer_mentor_sidebar_open'
const SB_MIN = 240
const SB_DEFAULT = 280
const SB_MAX = 400

const isDesktop = () => typeof window !== 'undefined' && window.innerWidth >= 1280

function getGreeting(mode: MentorMode, customMentorName?: string): string {
  if (mode === 'idea') return 'やあ！どんなアイデアを考えてる？ざっくりでいいから聞かせて 🌸'
  if (mode === 'custom') return `こんにちは、${customMentorName ?? 'あなたのメンター'}です。何でも話してね 🌸`
  return 'こんにちは！何でも聞いてください 🌸'
}

const MODE_LABELS: Record<MentorMode, { icon: LucideIcon; label: string }> = {
  idea:    { icon: Sprout,        label: 'アイデア出し' },
  general: { icon: MessageCircle, label: 'なんでも相談' },
  custom:  { icon: Bot,           label: 'カスタマイズ' },
}

export default function MentorPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [customMentors, setCustomMentors] = useState<CustomMentor[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<MentorMode>('general')
  const [activeStyle, setActiveStyle] = useState<ResponseStyle>('light')
  const [activeCustomMentorId, setActiveCustomMentorId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showModeDialog, setShowModeDialog] = useState(false)
  const [isFirstMessage, setIsFirstMessage] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)
  const [openDropdown, setOpenDropdown] = useState<'mentor' | 'model' | null>(null)
  const [selectedModel, setSelectedModel] = useState<'gemini'>('gemini')
  const [attachment, setAttachment] = useState<{ name: string; mimeType: string; data: string } | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  // サイドバー開閉・幅（SSRミスマッチ回避のためデフォルト値で初期化）
  const [sidebarWidth, setSidebarWidth] = useState(SB_DEFAULT)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const draggingRef = useRef(false)
  const hasMovedRef = useRef(false)
  const sidebarWidthRef = useRef(SB_DEFAULT)

  // hydration後にlocalStorageから復元
  useEffect(() => {
    try {
      const w = localStorage.getItem(MENTOR_SIDEBAR_WIDTH_KEY)
      if (w) {
        const n = parseInt(w, 10)
        if (!Number.isNaN(n)) {
          const clamped = Math.min(SB_MAX, Math.max(SB_MIN, n))
          setSidebarWidth(clamped)
          sidebarWidthRef.current = clamped
        }
      }
      const o = localStorage.getItem(MENTOR_SIDEBAR_OPEN_KEY)
      if (o === 'false') setSidebarOpen(false)
    } catch {}
  }, [])

  const rememberConv = (id: string) => {
    try { localStorage.setItem(LAST_CONV_KEY, id) } catch {}
  }

  const persistWidth = (w: number) => { try { localStorage.setItem(MENTOR_SIDEBAR_WIDTH_KEY, String(w)) } catch {} }
  const persistOpen = (o: boolean) => { try { localStorage.setItem(MENTOR_SIDEBAR_OPEN_KEY, String(o)) } catch {} }

  const updateWidth = (w: number) => {
    setSidebarWidth(w)
    sidebarWidthRef.current = w
  }

  const closeSidebar = () => { setSidebarOpen(false); persistOpen(false) }
  const openSidebar = () => { setSidebarOpen(true); persistOpen(true) }
  const resetSidebarWidth = () => { updateWidth(SB_DEFAULT); persistWidth(SB_DEFAULT) }

  // ドラッグ開始：クリックのみ＝リセット、移動あり＝幅変更
  const startDrag = (e: React.MouseEvent) => {
    if (!isDesktop()) return
    e.preventDefault()
    draggingRef.current = true
    hasMovedRef.current = false
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return
      hasMovedRef.current = true
      updateWidth(Math.min(SB_MAX, Math.max(SB_MIN, ev.clientX)))
    }
    const onUp = () => {
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (hasMovedRef.current) {
        persistWidth(sidebarWidthRef.current)
      } else {
        resetSidebarWidth()
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    Promise.all([
      getConversations().catch((): Conversation[] => []),
      getCustomMentors().catch((): CustomMentor[] => []),
    ]).then(([convs, mentors]) => {
      setConversations(convs)
      setCustomMentors(mentors)
      try {
        const lastId = localStorage.getItem(LAST_CONV_KEY)
        if (lastId) {
          const target = convs.find((c) => c.id === lastId)
          if (target) {
            setActiveConvId(target.id)
            setActiveMode(target.mentorMode)
            setActiveStyle(target.responseStyle)
            setActiveCustomMentorId(target.customMentorId)
            setIsFirstMessage(false)
            getConversationMessages(target.id)
              .then((msgs) => setMessages(msgs.map((m) => ({ role: m.role, content: m.content }))))
              .catch(() => setMessages([]))
          }
        }
      } catch {}
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ⋯メニュー外クリックで閉じる
  useEffect(() => {
    if (!menuOpenId) return
    const close = () => setMenuOpenId(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuOpenId])

  const handleSelectConv = async (conv: Conversation) => {
    setActiveConvId(conv.id)
    setActiveMode(conv.mentorMode)
    setActiveStyle(conv.responseStyle)
    setActiveCustomMentorId(conv.customMentorId)
    setIsFirstMessage(false)
    rememberConv(conv.id)
    try {
      const msgs = await getConversationMessages(conv.id)
      setMessages(msgs.map((m) => ({ role: m.role, content: m.content })))
    } catch {
      setMessages([])
    }
  }

  const handleCreateConv = async (mode: MentorMode) => {
    setShowModeDialog(false)
    const { conversation, error } = await createConversation(mode)
    if (error || !conversation) return
    setConversations((prev) => [conversation, ...prev])
    setActiveConvId(conversation.id)
    setActiveMode(mode)
    setActiveStyle('light')
    setActiveCustomMentorId(null)
    rememberConv(conversation.id)
    setMessages([{ role: 'assistant', content: getGreeting(mode), isGreeting: true }])
    setIsFirstMessage(true)
  }

  const handleCreateCustomConv = async (customMentorId: string) => {
    setShowModeDialog(false)
    const { conversation, error } = await createConversation('custom', customMentorId)
    if (error || !conversation) return
    setConversations((prev) => [conversation, ...prev])
    setActiveConvId(conversation.id)
    setActiveMode('custom')
    setActiveStyle('light')
    setActiveCustomMentorId(customMentorId)
    rememberConv(conversation.id)
    const mentor = customMentors.find((m) => m.id === customMentorId)
    setMessages([{ role: 'assistant', content: getGreeting('custom', mentor?.name), isGreeting: true }])
    setIsFirstMessage(true)
  }

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if ((!text && !attachment) || isLoading || !activeConvId) return

    const currentAttachment = attachment
    if (overrideText === undefined) setInput('')
    setAttachment(null)
    setIsLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: text || '(ファイルを添付しました)' }])

    const history = messages.filter((m) => !m.isGreeting).map((m) => ({ role: m.role, content: m.content }))
    const attachArg: Attachment | undefined = currentAttachment
      ? { mimeType: currentAttachment.mimeType, data: currentAttachment.data }
      : undefined

    const { reply, suggestions, error } = await sendMentorChatMessage(
      activeConvId,
      text || 'このファイルについて教えてください。',
      activeMode,
      history,
      attachArg,
      activeCustomMentorId ?? undefined,
      activeStyle
    )

    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: error || !reply ? 'メンターに接続できませんでした。' : reply, suggestions },
    ])
    setIsLoading(false)

    if (isFirstMessage && text) {
      setIsFirstMessage(false)
      const { title } = await generateConversationTitle(activeConvId, text)
      if (title) {
        setConversations((prev) => prev.map((c) => (c.id === activeConvId ? { ...c, title } : c)))
      }
    }
  }

  const openMenu = (e: React.MouseEvent, convId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpenId((prev) => (prev === convId ? null : convId))
  }

  const startRename = (conv: Conversation) => {
    setMenuOpenId(null)
    setEditingId(conv.id)
    setEditingTitle(conv.title)
  }

  const commitRename = async (convId: string) => {
    const newTitle = editingTitle.trim()
    setEditingId(null)
    if (!newTitle) return
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: newTitle } : c))
    )
    const { error } = await renameConversation(convId, newTitle)
    if (error) {
      getConversations().then(setConversations).catch(() => {})
    }
  }

  const handlePin = async (conv: Conversation) => {
    setMenuOpenId(null)
    const next = !conv.isPinned
    setConversations((prev) => {
      const updated = prev.map((c) => (c.id === conv.id ? { ...c, isPinned: next } : c))
      return [...updated].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
    })
    const { error } = await pinConversation(conv.id, next)
    if (error) {
      getConversations().then(setConversations).catch(() => {})
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    const { error } = await deleteConversation(target.id)
    if (error) return
    setConversations((prev) => prev.filter((c) => c.id !== target.id))
    if (activeConvId === target.id) {
      setActiveConvId(null)
      setMessages([])
    }
    try {
      if (localStorage.getItem(LAST_CONV_KEY) === target.id) localStorage.removeItem(LAST_CONV_KEY)
    } catch {}
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachError(null)

    const allowed = ['image/png', 'image/jpeg', 'application/pdf']
    if (!allowed.includes(file.type)) {
      setAttachError('png / jpg / pdf のみ添付できます。')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setAttachError('ファイルサイズは10MBまでです。')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] ?? ''
      setAttachment({ name: file.name, mimeType: file.type, data: base64 })
    }
    reader.onerror = () => setAttachError('ファイルの読み込みに失敗しました。')
    reader.readAsDataURL(file)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleChangeMode = async (mode: MentorMode) => {
    if (!activeConvId) return

    const prevMode = activeMode
    setActiveMode(mode)
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvId ? { ...c, mentorMode: mode } : c))
    )

    const { error } = await updateConversationMode(activeConvId, mode)
    if (error) {
      setActiveMode(prevMode)
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, mentorMode: prevMode } : c))
      )
    }
  }

  const handleChangeStyle = async (style: ResponseStyle) => {
    if (!activeConvId) return
    const prevStyle = activeStyle
    setActiveStyle(style)
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvId ? { ...c, responseStyle: style } : c))
    )
    const { error } = await updateConversationStyle(activeConvId, style)
    if (error) {
      setActiveStyle(prevStyle)
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, responseStyle: prevStyle } : c))
      )
    }
  }

  const renderConvItem = (conv: Conversation) => {
    const ConvIcon = MODE_LABELS[conv.mentorMode].icon
    return (
      <div
        key={conv.id}
        role="button"
        tabIndex={0}
        onClick={() => { if (editingId !== conv.id) handleSelectConv(conv) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && editingId !== conv.id) handleSelectConv(conv) }}
        onContextMenu={(e) => openMenu(e, conv.id)}
        className={`group relative w-full rounded-lg transition cursor-pointer ${
          activeConvId === conv.id ? 'bg-accent/30' : 'hover:bg-muted'
        }`}
      >
        <div className="px-3 py-2.5 pr-8">
          <div className="flex items-center gap-1.5">
            {conv.isPinned && <Pin className="size-3 text-primary shrink-0 fill-primary" />}
            <ConvIcon className="size-3.5 text-muted-foreground shrink-0" />

            {editingId === conv.id ? (
              <input
                autoFocus
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => commitRename(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(conv.id) }
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 min-w-0 bg-background border border-primary rounded px-1.5 py-0.5 text-sm text-foreground focus:outline-none"
              />
            ) : (
              <span className="text-sm text-foreground truncate">{conv.title}</span>
            )}
          </div>
          {editingId !== conv.id && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-5">
              {MODE_LABELS[conv.mentorMode].label}
            </p>
          )}
        </div>

        {/* ⋯ボタン（ホバーで表示） */}
        {editingId !== conv.id && (
          <button
            onClick={(e) => openMenu(e, conv.id)}
            className="absolute top-2 right-1.5 w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/10 transition"
            aria-label="メニュー"
          >
            <MoreHorizontal className="size-4" />
          </button>
        )}

        {/* ポップオーバーメニュー */}
        {menuOpenId === conv.id && (
          <div
            className="absolute top-9 right-1.5 z-50 w-40 bg-card border border-border rounded-xl shadow-lg py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => startRename(conv)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition text-left"
            >
              <Pencil className="size-3.5" />
              名前を変更
            </button>
            <button
              onClick={() => handlePin(conv)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition text-left"
            >
              <Pin className="size-3.5" />
              {conv.isPinned ? 'ピン留めを外す' : 'ピン留め'}
            </button>
            <button
              onClick={() => { setMenuOpenId(null); setDeleteTarget(conv) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition text-left"
            >
              <Trash2 className="size-3.5" />
              削除
            </button>
          </div>
        )}
      </div>
    )
  }

  // デスクトップ・スマホ両方で使うサイドバー内コンテンツ
  const renderSidebarContent = () => (
    <>
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push('/')}
            className="flex-1 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition px-1 py-1"
          >
            <ArrowLeft className="size-4" />
            ダッシュボード
          </button>
          <button
            onClick={closeSidebar}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            aria-label="サイドバーを閉じる"
            title="サイドバーを閉じる"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
        <button
          onClick={() => setShowModeDialog(true)}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 transition"
        >
          <Plus className="size-4" />
          新規チャット
        </button>
      </div>

      {/* 種類クイックアクセス */}
      <div className="px-2 py-2 border-b border-border space-y-0.5">
        <button
          onClick={() => handleCreateConv('idea')}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <Sprout className="size-4 shrink-0" /> アイデア出し
        </button>
        <button
          onClick={() => handleCreateConv('general')}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <MessageCircle className="size-4 shrink-0" /> なんでも相談
        </button>
        <button
          onClick={() => router.push('/mentor/custom')}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm text-left text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <span className="flex items-center gap-2"><Bot className="size-4 shrink-0" /> カスタマイズ</span>
          <ChevronRight className="size-3.5 shrink-0" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8 px-2">
            まだチャットがありません。
            <br />
            「新規チャット」から始めましょう。
          </p>
        )}
        {(() => {
          const pinned = conversations.filter((c) => c.isPinned)
          const recent = conversations
            .filter((c) => !c.isPinned)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          return (
            <>
              {pinned.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground px-2 pt-1 pb-0.5">ピン留め</p>
                  {pinned.map((conv) => renderConvItem(conv))}
                </>
              )}
              {recent.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground px-2 pt-2 pb-0.5">最近使った</p>
                  {recent.map((conv) => renderConvItem(conv))}
                </>
              )}
            </>
          )
        })()}
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-background flex">
      {/* デスクトップ(lg+)：開いている時 */}
      {sidebarOpen && (
        <aside
          className="hidden lg:flex shrink-0 border-r border-border bg-card flex-col h-screen relative"
          style={{ width: `${sidebarWidth}px` }}
        >
          {renderSidebarContent()}
          {/* ドラッグハンドル（xl以上のみ有効） */}
          <div
            onMouseDown={startDrag}
            className="hidden xl:flex absolute top-0 right-0 w-3 h-full cursor-col-resize items-center justify-center group"
          >
            <GripVertical className="absolute size-3 text-muted-foreground/40 group-hover:text-primary/50 transition-colors" />
          </div>
        </aside>
      )}

      {/* デスクトップ(lg+)：閉じている時の「開く」ボタン */}
      {!sidebarOpen && (
        <button
          onClick={openSidebar}
          className="hidden lg:flex fixed top-3 left-3 z-40 w-9 h-9 items-center justify-center rounded-lg bg-card border border-border hover:bg-muted transition"
          aria-label="サイドバーを開く"
        >
          <PanelLeft className="size-4" />
        </button>
      )}

      {/* スマホ(lg未満)：オーバーレイ式 */}
      {sidebarOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/40 z-30" onClick={closeSidebar} />
          <aside className="lg:hidden fixed top-0 left-0 z-40 w-72 h-screen border-r border-border bg-card flex flex-col">
            {renderSidebarContent()}
          </aside>
        </>
      )}

      {/* スマホ(lg未満)：閉じている時の「開く」ボタン */}
      {!sidebarOpen && (
        <button
          onClick={openSidebar}
          className="lg:hidden fixed top-3 left-3 z-40 w-9 h-9 flex items-center justify-center rounded-lg bg-card border border-border hover:bg-muted transition"
          aria-label="メニュー"
        >
          <PanelLeft className="size-4" />
        </button>
      )}

      {/* 右：会話エリア */}
      <main className="flex-1 flex flex-col h-screen min-w-0">
        {activeConvId ? (
          <>
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                {(() => { const Icon = MODE_LABELS[activeMode].icon; return <Icon className="size-4 text-foreground" /> })()}
                <p className="text-sm font-semibold text-foreground">
                  {MODE_LABELS[activeMode].label}メンター
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">何でも聞いてください 🌸</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className="space-y-2">
                  <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <span className="text-sm mr-1.5 mt-0.5 shrink-0">🌸</span>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap max-w-[75%] ${
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                  {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && activeMode === 'idea' && i === messages.length - 1 && !isLoading && (
                    <div className="flex flex-wrap gap-2 ml-6">
                      {m.suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(s)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary hover:bg-accent/20 text-foreground transition disabled:opacity-50"
                        >
                          <span className="text-primary font-semibold">{idx + 1}</span>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <span className="text-sm mr-1.5 shrink-0">🌸</span>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 150, 300].map((d) => (
                        <div
                          key={d}
                          className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
              </div>
            </div>

            <div className="border-t border-border p-3 shrink-0">
              <div className="max-w-3xl mx-auto">
                {attachment && (
                  <div className="mb-2 flex items-center gap-2 bg-muted rounded-lg px-3 py-2 w-fit">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="text-xs text-foreground truncate max-w-[200px]">{attachment.name}</span>
                    <button
                      onClick={() => setAttachment(null)}
                      className="text-muted-foreground hover:text-destructive transition"
                      aria-label="添付を取り消す"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}
                {attachError && (
                  <p className="mb-2 text-xs text-destructive">{attachError}</p>
                )}
                <div className="bg-muted/40 rounded-2xl border border-border">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder="メッセージを入力..."
                    rows={1}
                    disabled={isLoading}
                    className="w-full bg-transparent border-none px-3 py-3 text-sm text-foreground resize-none focus:outline-none max-h-32 disabled:opacity-50"
                  />
                  <div className="flex items-center justify-between gap-2 px-2 pb-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                        title="ファイルを添付"
                      >
                        <Paperclip className="size-4" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* メンター種類＋答え方ドロップダウン */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenDropdown(openDropdown === 'mentor' ? null : 'mentor')}
                          className="flex items-center gap-1 text-xs text-foreground px-2 py-1 rounded-lg hover:bg-muted transition"
                        >
                          <span>{MODE_LABELS[activeMode].label}</span>
                          <ChevronDown className="size-3 opacity-50" />
                        </button>
                        {openDropdown === 'mentor' && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                            <div className="absolute bottom-full right-0 mb-1 z-50 min-w-[12rem] bg-card border border-border rounded-xl shadow-lg p-1">
                              <p className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">メンター</p>
                              {(['idea', 'general', 'custom'] as MentorMode[]).map((m) => {
                                const Icon = MODE_LABELS[m].icon
                                return (
                                  <button
                                    key={m}
                                    onClick={() => { handleChangeMode(m); setOpenDropdown(null) }}
                                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted transition text-left"
                                  >
                                    <span className="flex items-center gap-2"><Icon className="size-3.5" />{MODE_LABELS[m].label}</span>
                                    {activeMode === m && <Check className="size-3.5 text-primary" />}
                                  </button>
                                )
                              })}
                              <div className="h-px bg-border my-1" />
                              <p className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">答え方</p>
                              {([
                                { v: 'light', label: 'ライト' },
                                { v: 'deep', label: '深掘り' },
                              ] as const).map((o) => (
                                <button
                                  key={o.v}
                                  onClick={() => { handleChangeStyle(o.v); setOpenDropdown(null) }}
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted transition text-left"
                                >
                                  <span>{o.label}</span>
                                  {activeStyle === o.v && <Check className="size-3.5 text-primary" />}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      {/* モデルドロップダウン */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenDropdown(openDropdown === 'model' ? null : 'model')}
                          className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded-lg hover:bg-muted transition"
                        >
                          <span>Gemini</span>
                          <ChevronDown className="size-3 opacity-50" />
                        </button>
                        {openDropdown === 'model' && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                            <div className="absolute bottom-full right-0 mb-1 z-50 min-w-[11rem] bg-card border border-border rounded-xl shadow-lg p-1">
                              <button
                                onClick={() => { setSelectedModel('gemini'); setOpenDropdown(null) }}
                                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted transition text-left"
                              >
                                <span className="flex items-center gap-2"><Sparkles className="size-3.5" />Gemini</span>
                                {selectedModel === 'gemini' && <Check className="size-3.5 text-primary" />}
                              </button>
                              {['GPT', 'Claude'].map((m) => (
                                <div key={m} className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground/50 cursor-not-allowed">
                                  <span className="flex items-center gap-2"><Sparkles className="size-3.5" />{m}</span>
                                  <span className="text-[10px]">準備中</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      {/* 送信ボタン */}
                      <button
                        onClick={() => handleSend()}
                        disabled={(!input.trim() && !attachment) || isLoading}
                        className="w-9 h-9 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-xl flex items-center justify-center transition shrink-0"
                        aria-label="送信"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <MessageCircle className="size-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              チャットを選ぶか、新規チャットを始めましょう
            </p>
          </div>
        )}
      </main>

      {/* 新規チャット：メンター種類選択ダイアログ */}
      <AlertDialog open={showModeDialog} onOpenChange={setShowModeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>どのメンターと話しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              相談したい内容に合わせて選んでください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            {(['idea', 'general'] as MentorMode[]).map((mode) => {
              const Icon = MODE_LABELS[mode].icon
              return (
                <button
                  key={mode}
                  onClick={() => handleCreateConv(mode)}
                  className="w-full h-auto py-3.5 px-4 bg-card border border-border hover:border-primary hover:bg-accent/20 text-foreground rounded-xl text-left flex items-center gap-3 transition-colors"
                >
                  <Icon className="size-5" />
                  <span className="font-medium text-sm">{MODE_LABELS[mode].label}</span>
                </button>
              )
            })}
            {customMentors.length > 0 && (
              <>
                <div className="border-t border-border my-1" />
                <p className="text-xs font-semibold text-muted-foreground px-1">マイメンター</p>
                {customMentors.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleCreateCustomConv(m.id)}
                    className="w-full h-auto py-3.5 px-4 bg-card border border-border hover:border-primary hover:bg-accent/20 text-foreground rounded-xl text-left flex items-center gap-3 transition-colors"
                  >
                    <Bot className="size-5" />
                    <span className="font-medium text-sm">{m.name}</span>
                  </button>
                ))}
              </>
            )}
            <div className="border-t border-border my-1" />
            <button
              onClick={() => { setShowModeDialog(false); router.push('/mentor/custom') }}
              className="w-full h-auto py-2.5 px-4 bg-transparent border border-dashed border-border hover:border-primary hover:bg-accent/20 text-foreground rounded-xl text-left flex items-center gap-3 transition-colors"
            >
              <Settings className="size-4" />
              <span className="text-sm">カスタムメンターを管理</span>
            </button>
            <AlertDialogCancel className="w-full">キャンセル</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>このチャットを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}」と、その会話履歴がすべて削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2">
            <AlertDialogAction
              onClick={handleDelete}
              className="w-full bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              削除する
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">キャンセル</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
