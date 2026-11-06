'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ArrowUp, LifeBuoy, ChevronUp, ChevronDown, Check, Lightbulb, MessageCircle, Sparkles } from 'lucide-react'
import { useSidebar } from '@/components/providers/SidebarProvider'
import {
  getMentorContext,
  generateMentorSystemPrompt,
  generateIdeaMentorSystemPrompt,
  generateGeneralMentorSystemPrompt,
  generateCustomMentorSystemPrompt,
  sendMentorMessage,
  generateStuckOptions,
} from '@/app/actions/mentor-panel'
import { getMentorHistory, saveMentorMessage, type MentorType } from '@/app/actions/chat'
import { recordSkillResult } from '@/app/actions/skill'
import { MENTOR_TEMPERATURE } from '@/lib/mentor-base'
import type { SetupStep } from '@/app/actions/setup'

type Message = {
  role: 'user' | 'assistant'
  content: string
  options?: string[]
  isGreeting?: boolean
}

interface MentorPanelProps {
  questId: string
  questTitle: string
  stepTitle?: string
  projectId: string
  mode?: 'idea' | 'quest' | 'general' | 'custom'
  customMentorId?: string
  customMentors?: { id: string; name: string }[]
  onMentorChange?: (mode: 'idea' | 'general' | 'custom', customMentorId?: string) => void
  initialOpen?: boolean
  desktopOpen?: boolean
  onDesktopClose?: () => void
  injectedHint?: { text: string; nonce: number }
  questNumber?: 2 | 3 | 4 | 5
  currentStepData?: SetupStep
  onStepCompleted?: (stepId: string) => void
}

const FALLBACK_SYSTEM_PROMPT = `あなたはBloomerのメンターです。
ユーザーが詰まっている時に、技術用語を使わず友達のような口調で助けてください。
1回の返答は3文以内。答えから直接書き始めてください。`

const FALLBACK_IDEA_SYSTEM_PROMPT = `あなたはBloomerのアイデアメンターです。
ユーザーが作りたいアプリのアイデアを一緒に育てます。
技術用語を使わず友達のような口調で話してください。
1回の返答は3文以内。答えから直接書き始めてください。`

export default function MentorPanel({
  questId,
  questTitle,
  stepTitle,
  projectId,
  mode = 'quest',
  customMentorId,
  customMentors = [],
  onMentorChange,
  initialOpen = false,
  desktopOpen,
  onDesktopClose,
  injectedHint,
  questNumber,
  currentStepData,
  onStepCompleted,
}: MentorPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isOpen: sidebarIsOpen } = useSidebar()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false)
  const [selectedModel, setSelectedModel] = useState<'gemini'>('gemini')
  const [openDropdown, setOpenDropdown] = useState<'mentor' | 'model' | null>(null)
  const [gaveBottomOutThisCycle, setGaveBottomOutThisCycle] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // initialOpen=true なら1回だけ展開し、URLから ?mentorOpen=true を除去する
  useEffect(() => {
    if (initialOpen) {
      setIsExpanded(true)
      router.replace(pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const init = async () => {
      if (mode === 'idea') {
        const { prompt, error } = await generateIdeaMentorSystemPrompt(questTitle)
        setSystemPrompt(prompt && !error ? prompt : FALLBACK_IDEA_SYSTEM_PROMPT)
      } else if (mode === 'general') {
        const { prompt, error } = await generateGeneralMentorSystemPrompt()
        setSystemPrompt(prompt && !error ? prompt : FALLBACK_SYSTEM_PROMPT)
      } else if (mode === 'custom' && customMentorId) {
        const { prompt, error } = await generateCustomMentorSystemPrompt(customMentorId)
        setSystemPrompt(prompt && !error ? prompt : FALLBACK_SYSTEM_PROMPT)
      } else {
        const context = await getMentorContext(projectId, questTitle, stepTitle ?? '')
        const { prompt, error } = await generateMentorSystemPrompt(questTitle, {
          ...context,
          stepId: currentStepData?.id,
          doneCondition: currentStepData?.done_condition,
          stuckPoints: currentStepData?.stuck_points,
        })
        setSystemPrompt(prompt && !error ? prompt : FALLBACK_SYSTEM_PROMPT)
      }
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questId, projectId, mode, customMentorId, currentStepData?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!injectedHint || !injectedHint.text) return
    setMessages((prev) => [...prev, { role: 'assistant', content: injectedHint.text }])
    setIsExpanded(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectedHint?.nonce])

  useEffect(() => {
    setGaveBottomOutThisCycle(false)
    const loadHistory = async () => {
      try {
        const history = await getMentorHistory(projectId, questId, mode as MentorType)
        if (history.length > 0) {
          setMessages(
            history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }))
          )
        } else {
          setMessages([])
        }
      } catch {
        setMessages([])
      }
    }
    loadHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questId, projectId, mode])

  const handleStuck = async () => {
    if (isLoading || isGeneratingOptions) return
    setIsGeneratingOptions(true)

    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: 'ここで詰まってますか？どのあたりが難しいか教えてください。' },
    ])

    const { options } = await generateStuckOptions(stepTitle ?? '', questTitle)
    if (options) {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], options }
        return updated
      })
    }
    setIsGeneratingOptions(false)
  }

  const handleSend = async (messageText?: string) => {
    const text = (messageText ?? input).trim()
    if (!text || isLoading) return

    setInput('')
    setIsLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: text }])

    const effectiveMentorType = mode as MentorType
    const userSaveRes = await saveMentorMessage(
      projectId, questId, 'user', text,
      effectiveMentorType,
      mode === 'custom' ? customMentorId : undefined
    )
    if (userSaveRes.error) console.error('[MentorPanel] ユーザーメッセージの保存に失敗:', userSaveRes.error)

    const prompt = systemPrompt || FALLBACK_SYSTEM_PROMPT
    const history = messages.filter((m) => !m.isGreeting).map((m) => ({ role: m.role, content: m.content }))

    const temperature =
      mode === 'quest' ? MENTOR_TEMPERATURE.quest :
      mode === 'idea' ? MENTOR_TEMPERATURE.dashboardIdea :
      mode === 'general' ? MENTOR_TEMPERATURE.general :
      MENTOR_TEMPERATURE.custom
    const toolContext =
      mode === 'quest' && questNumber ? { projectId, questNumber } : undefined
    const { reply, error, completedStepId } = await sendMentorMessage(text, history, prompt, temperature, toolContext)

    if (completedStepId) onStepCompleted?.(completedStepId)

    let cleanReply = reply
    if ((mode === 'quest' || mode === 'general' || mode === 'custom') && cleanReply) {
      let gaveBottomOut = gaveBottomOutThisCycle
      if (cleanReply.includes('%%%GAVE_ANSWER%%%')) {
        gaveBottomOut = true
        setGaveBottomOutThisCycle(true)
        cleanReply = cleanReply.replace(/%%%GAVE_ANSWER%%%/g, '').trim()
      }
      if (cleanReply.includes('%%%SOLVED%%%')) {
        const x: 0 | 1 = gaveBottomOut ? 0 : 1
        recordSkillResult(x, gaveBottomOut, projectId, questId)
          .then((r) => { if (r.error) console.error('[skill] 記録失敗:', r.error) })
          .catch((e) => console.error('[skill] 記録失敗:', e))
        setGaveBottomOutThisCycle(false)
        cleanReply = cleanReply.replace(/%%%SOLVED%%%/g, '').trim()
      }
    }

    const assistantContent = error || !cleanReply
      ? 'メンターに接続できませんでした。もう一度試してみてください。'
      : cleanReply

    setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }])

    if (!error && cleanReply) {
      const assistantSaveRes = await saveMentorMessage(
        projectId, questId, 'assistant', cleanReply,
        effectiveMentorType,
        mode === 'custom' ? customMentorId : undefined
      )
      if (assistantSaveRes.error) console.error('[MentorPanel] アシスタントメッセージの保存に失敗:', assistantSaveRes.error)
    }

    setIsLoading(false)
  }

  const selectValue =
    mode === 'custom' && customMentorId ? `custom:${customMentorId}` :
    mode === 'general' ? 'general' : 'idea'

  const handleSelectChange = (v: string) => {
    if (!onMentorChange) return
    if (v === 'idea') onMentorChange('idea')
    else if (v === 'general') onMentorChange('general')
    else if (v.startsWith('custom:')) onMentorChange('custom', v.slice(7))
  }

  const mentorLabel =
    mode === 'general' ? 'なんでも相談' :
    mode === 'custom' ? (customMentors.find((c) => c.id === customMentorId)?.name ?? 'カスタム') :
    mode === 'quest' ? 'メンター' :
    'アイデア出し'

  const mentorOptions = [
    { value: 'idea', label: 'アイデア出し', icon: Lightbulb },
    { value: 'general', label: 'なんでも相談', icon: MessageCircle },
    ...customMentors.map((cm) => ({ value: `custom:${cm.id}`, label: cm.name, icon: Sparkles })),
  ]

  return (
    <>
      {/* デスクトップ（xl以上）：右カラム常駐（desktopOpen制御対応） */}
      {(desktopOpen ?? true) && (
        <aside className="hidden xl:flex flex-col w-80 shrink-0 border-l border-border bg-card sticky top-0 h-screen">
          <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">🌸</span>
              <p className="text-xs font-semibold text-foreground truncate">{mentorLabel}</p>
            </div>
            {onDesktopClose && (
              <button
                onClick={onDesktopClose}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground shrink-0"
                aria-label="メンターを閉じる"
              >
                <span className="text-sm">»</span>
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  詰まったことがあれば<br />何でも聞いてください
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <span className="text-sm mr-1.5 mt-0.5 shrink-0">🌸</span>
                )}
                <div className="space-y-2 max-w-[85%]">
                  <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}>
                    {m.content}
                  </div>
                  {m.options && (
                    <div className="space-y-1.5">
                      {m.options.map((opt, j) => (
                        <button
                          key={j}
                          onClick={() => handleSend(opt)}
                          disabled={isLoading}
                          className="w-full text-left text-xs px-3 py-2 rounded-xl border border-border bg-card hover:border-primary hover:bg-accent/20 transition text-foreground"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(isLoading || isGeneratingOptions) && (
              <div className="flex justify-start">
                <span className="text-sm mr-1.5 shrink-0">🌸</span>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <div
                        key={delay}
                        className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-border p-3 shrink-0">
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
                placeholder="何でも聞いてください..."
                rows={1}
                disabled={isLoading}
                className="w-full bg-transparent border-none px-3 py-2.5 text-xs text-foreground resize-none focus:outline-none max-h-24 disabled:opacity-50"
              />
              <div className="flex items-center justify-between gap-2 px-2 pb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {onMentorChange && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === 'mentor' ? null : 'mentor')}
                        className="flex items-center gap-1 text-xs text-foreground px-2 py-1 rounded-lg hover:bg-muted transition"
                      >
                        <Sparkles className="size-3 text-muted-foreground" />
                        <span>{mentorLabel}</span>
                        <ChevronDown className="size-3 opacity-50" />
                      </button>
                      {openDropdown === 'mentor' && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                          <div className="absolute bottom-full left-0 mb-1 z-50 min-w-[10rem] bg-card border border-border rounded-xl shadow-lg p-1">
                            {mentorOptions.map((opt) => {
                              const Icon = opt.icon
                              const isSel = selectValue === opt.value
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => { handleSelectChange(opt.value); setOpenDropdown(null) }}
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted transition text-left"
                                >
                                  <span className="flex items-center gap-2"><Icon className="size-3.5" />{opt.label}</span>
                                  {isSel && <Check className="size-3.5 text-primary" />}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
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
                        <div className="absolute bottom-full left-0 mb-1 z-50 min-w-[11rem] bg-card border border-border rounded-xl shadow-lg p-1">
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
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleStuck}
                    disabled={isLoading || isGeneratingOptions}
                    title="詰まったら押す"
                    className="w-7 h-7 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-accent/20 hover:text-primary transition disabled:opacity-50"
                  >
                    <LifeBuoy className="size-3.5" />
                  </button>
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    className="w-7 h-7 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-xl flex items-center justify-center transition"
                    aria-label="送信"
                  >
                    <ArrowUp className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* スマホ・タブレット（xl未満）：VS Codeのターミナル風の下部ドックパネル。
          展開中も背景を塞がず、後ろのダッシュボードを操作できる（閉じるのはヘッダーの∨） */}
      {!sidebarIsOpen && (
        <>
          {/* 下部パネル（角丸・浮かせる） */}
          <div className="xl:hidden fixed bottom-0 inset-x-0 z-40 bg-card border border-border shadow-lg rounded-t-2xl overflow-hidden">

            {/* 展開ヘッダー（展開時のみ・∨で閉じる） */}
            {isExpanded && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-base">🌸</span>
                  <span className="text-xs font-semibold text-foreground">{mentorLabel}</span>
                </div>
                <button
                  onClick={() => { setIsExpanded(false); setIsFocused(false) }}
                  aria-label="閉じる"
                  className="p-1 rounded-lg hover:bg-muted transition"
                >
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* チャット履歴（展開時のみ・約45vh） */}
            {isExpanded && (
              <div className="overflow-y-auto p-3 space-y-3 h-[45vh]">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      詰まったことがあれば<br />何でも聞いてください
                    </p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <span className="text-sm mr-1.5 mt-0.5 shrink-0">🌸</span>
                    )}
                    <div className="space-y-2 max-w-[85%]">
                      <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      }`}>
                        {m.content}
                      </div>
                      {m.options && (
                        <div className="space-y-1.5">
                          {m.options.map((opt, j) => (
                            <button
                              key={j}
                              onClick={() => handleSend(opt)}
                              disabled={isLoading}
                              className="w-full text-left text-xs px-3 py-2 rounded-xl border border-border bg-card hover:border-primary hover:bg-accent/20 transition text-foreground"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(isLoading || isGeneratingOptions) && (
                  <div className="flex justify-start">
                    <span className="text-sm mr-1.5 shrink-0">🌸</span>
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                      <div className="flex gap-1">
                        {[0, 150, 300].map((delay) => (
                          <div
                            key={delay}
                            className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}

            {/* 入力欄（常駐） */}
            <div className="p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
              {/* フォーカス時かつ未展開なら「∧開く」ボタン */}
              {isFocused && !isExpanded && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setIsExpanded(true)}
                  className="w-full flex items-center justify-center gap-1.5 mb-2 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition"
                >
                  <ChevronUp className="size-3.5" />
                  メンターを開く
                </button>
              )}
              <div className="bg-muted/40 rounded-2xl border border-border">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="何でも聞いてください..."
                  rows={1}
                  disabled={isLoading}
                  className="w-full bg-transparent border-none px-3 py-2.5 text-xs text-foreground resize-none focus:outline-none max-h-24 disabled:opacity-50"
                />
                <div className="flex items-center justify-between gap-2 px-2 pb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {onMentorChange && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenDropdown(openDropdown === 'mentor' ? null : 'mentor')}
                          className="flex items-center gap-1 text-xs text-foreground px-2 py-1 rounded-lg hover:bg-muted transition"
                        >
                          <Sparkles className="size-3 text-muted-foreground" />
                          <span>{mentorLabel}</span>
                          <ChevronDown className="size-3 opacity-50" />
                        </button>
                        {openDropdown === 'mentor' && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                            <div className="absolute bottom-full left-0 mb-1 z-50 min-w-[10rem] bg-card border border-border rounded-xl shadow-lg p-1">
                              {mentorOptions.map((opt) => {
                                const Icon = opt.icon
                                const isSel = selectValue === opt.value
                                return (
                                  <button
                                    key={opt.value}
                                    onClick={() => { handleSelectChange(opt.value); setOpenDropdown(null) }}
                                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted transition text-left"
                                  >
                                    <span className="flex items-center gap-2"><Icon className="size-3.5" />{opt.label}</span>
                                    {isSel && <Check className="size-3.5 text-primary" />}
                                  </button>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
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
                          <div className="absolute bottom-full left-0 mb-1 z-50 min-w-[11rem] bg-card border border-border rounded-xl shadow-lg p-1">
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
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={handleStuck}
                      disabled={isLoading || isGeneratingOptions}
                      title="詰まったら押す"
                      className="w-7 h-7 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-accent/20 hover:text-primary transition disabled:opacity-50"
                    >
                      <LifeBuoy className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isLoading}
                      className="w-7 h-7 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-xl flex items-center justify-center transition"
                      aria-label="送信"
                    >
                      <ArrowUp className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
