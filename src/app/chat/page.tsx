'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  getChatHistory,
  sendMessage,
  clearChatHistory,
} from '@/app/actions/chat'
import { skipOnboarding, saveOnboardingData, generateIdeaCardFromText } from '@/app/actions/onboarding'
import type { ChatMessage, QuestContext } from '@/app/actions/chat'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
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

function ChatContent() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [isIdeaConfirmed, setIsIdeaConfirmed] = useState(false)
  const [isDiscoverMode, setIsDiscoverMode] = useState(false)
  const [genreLabel, setGenreLabel] = useState<string>('')
  const [questContext, setQuestContext] = useState<QuestContext | null>(null)
  const [mentorMode, setMentorMode] = useState<'idea' | 'dev' | 'general'>('general')
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [top5Ideas, setTop5Ideas] = useState<string[]>([])
  const [selectedIdeaIndex, setSelectedIdeaIndex] = useState<number | null>(null)
  const [showIdeaChoiceDialog, setShowIdeaChoiceDialog] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    getChatHistory().then((history) => {
      if (history.length === 0) {
        const genreLabel = searchParams.get('genreLabel')
        const welcomeContent = genreLabel
          ? `こんにちは！🌸 「${genreLabel}」に興味があるんですね。\n\nそこで感じた「これ不便だな」「こんなのあったらいいな」って、どんな小さなことでも聞かせてください。`
          : 'こんにちは！🌸 作りたいものを一緒に見つけよう。\n\nまず聞かせて、最近「これ不便だな」って思ったことある？どんな小さなことでもいいよ。'
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: welcomeContent,
          createdAt: new Date().toISOString(),
        }])
      } else {
        setMessages(history)
      }
      setIsHistoryLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const questId = searchParams.get('questId')
    const questTitle = searchParams.get('questTitle')
    const stepTitle = searchParams.get('stepTitle')
    const mentorMessage = searchParams.get('mentorMessage')

    if (questId && questTitle && stepTitle && mentorMessage) {
      setQuestContext({ questId, questTitle, stepTitle, mentorMessage })
    }
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('mode') === 'discover') {
      setIsDiscoverMode(true)
      const label = searchParams.get('genreLabel') ?? ''
      setGenreLabel(label)
    }
  }, [searchParams])

  useEffect(() => {
    const helpMessage = searchParams.get('help')
    if (!helpMessage || isHistoryLoading) return

    // デコードしてinputにセット
    setInput(decodeURIComponent(helpMessage))
  }, [searchParams, isHistoryLoading])

  useEffect(() => {
    const helpMessage = searchParams.get('help')
    if (!helpMessage || isHistoryLoading) return

    const decoded = decodeURIComponent(helpMessage)

    // 少し待ってから自動送信
    const timer = setTimeout(async () => {
      if (!decoded.trim() || isLoading) return
      setIsLoading(true)

      const tempUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: decoded,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, tempUserMsg])

      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }))

      const { reply, ideaGenerated } = await sendMessage(decoded, history, questContext ?? undefined, isDiscoverMode ? (genreLabel || true) : undefined)

      const top5Match = reply.match(/%%%TOP5%%%([\s\S]*?)%%%END%%%/)
      if (top5Match && isDiscoverMode) {
        try {
          const ideas = JSON.parse(top5Match[1].trim()) as string[]
          setTop5Ideas(ideas)
        } catch { /* パース失敗は無視 */ }
      }
      const finalReply = reply.replace(/%%%TOP5%%%([\s\S]*?)%%%END%%%/, '').trim()

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: finalReply,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])

      if (ideaGenerated) {
        setIsIdeaConfirmed(true)
        const confirmMsg: ChatMessage = {
          id: `confirm-${Date.now()}`,
          role: 'assistant',
          content: 'アイデアが決まりました！\nダッシュボードでクエストを始めましょう。',
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, confirmMsg])
        setTimeout(() => router.push('/'), 3000)
      }

      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [isHistoryLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (messageText?: string) => {
    const text = (messageText ?? input).trim()
    if (!text || isLoading) return

    const userMessage = text
    if (!messageText) setInput('')
    setIsLoading(true)

    // ユーザーメッセージを即時表示
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    // 履歴を構築（welcomeメッセージは除く）
    const history = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }))

    const { reply, ideaGenerated } = await sendMessage(userMessage, history, questContext ?? undefined, isDiscoverMode ? (genreLabel || true) : undefined)

    const top5Match = reply.match(/%%%TOP5%%%([\s\S]*?)%%%END%%%/)
    if (top5Match && isDiscoverMode) {
      try {
        const ideas = JSON.parse(top5Match[1].trim()) as string[]
        setTop5Ideas(ideas)
      } catch { /* パース失敗は無視 */ }
    }
    const finalReply = reply.replace(/%%%TOP5%%%([\s\S]*?)%%%END%%%/, '').trim()

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: finalReply,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantMsg])

    if (ideaGenerated) {
      setIsIdeaConfirmed(true)
      const confirmMsg: ChatMessage = {
        id: `confirm-${Date.now()}`,
        role: 'assistant',
        content: 'アイデアが決まりました！\nダッシュボードでクエストを始めましょう。',
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, confirmMsg])
      setTimeout(() => router.push('/'), 3000)
    }

    setIsLoading(false)
  }

  const handleClear = () => {
    setShowClearDialog(true)
  }

  const handleClearConfirm = async () => {
    await clearChatHistory()
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: 'こんにちは！🌸 作りたいものを一緒に見つけよう。\n\nまず聞かせて、最近「これ不便だな」って思ったことある？',
      createdAt: new Date().toISOString(),
    }])
  }

  return (
    <>
    <div className="min-h-screen bg-background flex flex-col">

      {/* ヘッダー */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-3 -ml-3 text-muted-foreground hover:text-foreground transition"
            aria-label="ダッシュボードに戻る"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Bloomerメンター</p>
              <p className="text-xs text-muted-foreground">あなたのアイデアを一緒に見つけよう</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDiscoverMode && !isIdeaConfirmed && (
            <button
              onClick={async () => {
                await skipOnboarding()
                router.push('/')
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-lg hover:bg-muted"
            >
              スキップ
            </button>
          )}
          <button
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            リセット
          </button>
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto">
        {isHistoryLoading ? (
          <div className="space-y-4 max-w-2xl mx-auto w-full px-4 py-6">
            <div className="flex justify-start gap-2">
              <Skeleton className="w-7 h-7 rounded-full shrink-0" />
              <Skeleton className="h-16 w-64 rounded-2xl" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-10 w-48 rounded-2xl" />
            </div>
            <div className="flex justify-start gap-2">
              <Skeleton className="w-7 h-7 rounded-full shrink-0" />
              <Skeleton className="h-20 w-72 rounded-2xl" />
            </div>
          </div>
        ) : (
        <div className="px-4 py-6 pb-4 space-y-4 max-w-2xl mx-auto w-full">
        {questContext && (
          <div className="bg-muted/60 border border-border rounded-xl px-4 py-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground text-sm mb-0.5">
              {questContext.questTitle} — {questContext.stepTitle}
            </p>
            <p>{questContext.mentorMessage}</p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center text-sm mr-2 shrink-0 mt-1">
                🌸
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-card border border-border text-foreground rounded-bl-sm'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center text-sm mr-2 shrink-0">
              🌸
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {top5Ideas.length > 0 && selectedIdeaIndex === null && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center text-sm mr-2 shrink-0 mt-1">
              🌸
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%] space-y-2">
              <p className="text-sm font-medium text-foreground">どれが一番刺さりますか？</p>
              {top5Ideas.map((idea, i) => (
                <button
                  key={idea}
                  onClick={() => {
                    setSelectedIdeaIndex(i)
                    setShowIdeaChoiceDialog(true)
                  }}
                  className="w-full text-left text-xs px-3 py-2 rounded-xl border border-border bg-background hover:border-primary hover:bg-accent/20 transition"
                >
                  <span className="font-semibold text-primary mr-2">{i + 1}.</span>
                  {idea}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
        </div>
        )}
      </div>

      {/* 入力欄 */}
      {!isIdeaConfirmed && (
        <div className="bg-card border-t border-border px-4 py-3 sticky bottom-0">
          <div className="max-w-2xl mx-auto flex gap-2">
            <div className="relative self-end">
              <button
                onClick={() => setShowModeMenu(!showModeMenu)}
                className="w-10 h-10 flex items-center justify-center rounded-2xl border border-border bg-card hover:bg-muted transition text-muted-foreground font-bold"
                aria-label="メンターモードを選択"
              >
                +
              </button>
              {showModeMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowModeMenu(false)} />
                  <div className="absolute bottom-12 left-0 bg-card border border-border rounded-2xl shadow-lg py-2 z-40 w-52">
                    {[
                      { mode: 'idea' as const, icon: '🌱', label: 'アイデアを一緒に考える' },
                      { mode: 'dev' as const, icon: '🔧', label: '開発の問題を解決する' },
                      { mode: 'general' as const, icon: '💬', label: 'なんでも相談する' },
                    ].map((item) => (
                      <button
                        key={item.mode}
                        onClick={() => { setMentorMode(item.mode); setShowModeMenu(false) }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-muted ${
                          mentorMode === item.mode ? 'text-primary font-semibold' : 'text-foreground'
                        }`}
                      >
                        <span>{item.icon}</span>
                        {item.label}
                        {mentorMode === item.mode && <span className="ml-auto text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
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
              className="flex-1 border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:border-primary max-h-32"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-2xl flex items-center justify-center transition shrink-0 self-end"
              aria-label="メッセージを送信"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Enterで送信・Shift+Enterで改行
          </p>
        </div>
      )}

      {isIdeaConfirmed && (
        <div className="bg-card border-t border-border px-4 py-4 sticky bottom-0">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => router.push('/')}
              className="w-full h-11 bg-primary text-primary-foreground text-sm font-semibold rounded-2xl hover:bg-primary/90 transition flex items-center justify-center gap-2"
            >
              ダッシュボードへ進む
              <ArrowRight className="size-4" />
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              3秒後に自動で移動します
            </p>
          </div>
        </div>
      )}

    </div>

    <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>会話をリセットしますか？</AlertDialogTitle>
          <AlertDialogDescription>
            これまでの会話履歴が削除されます。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2">
          <AlertDialogAction
            onClick={handleClearConfirm}
            className="w-full bg-destructive/10 text-destructive hover:bg-destructive/20"
          >
            リセットする
          </AlertDialogAction>
          <AlertDialogCancel className="w-full">キャンセル</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={showIdeaChoiceDialog} onOpenChange={setShowIdeaChoiceDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>どうしますか？</AlertDialogTitle>
          <AlertDialogDescription>
            {selectedIdeaIndex !== null && top5Ideas[selectedIdeaIndex]
              ? `「${top5Ideas[selectedIdeaIndex]}」を選びましたね。`
              : 'アイデアが選ばれました。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-3">
          <AlertDialogAction
            onClick={() => {
              setShowIdeaChoiceDialog(false)
              const idea = selectedIdeaIndex !== null ? top5Ideas[selectedIdeaIndex] : ''
              setTop5Ideas([])
              setSelectedIdeaIndex(null)
              handleSend(`${idea}についてもっと深掘りしたいです。`)
            }}
            className="w-full h-auto py-4 px-4 bg-card border border-border hover:border-primary hover:bg-accent/20 text-foreground rounded-xl text-left flex flex-col gap-1"
          >
            <span className="font-semibold text-sm">🔍 深掘りする</span>
            <span className="text-xs text-muted-foreground font-normal">もっと詳しく考える</span>
          </AlertDialogAction>
          <AlertDialogAction
            onClick={async () => {
              setShowIdeaChoiceDialog(false)
              const idea = selectedIdeaIndex !== null ? top5Ideas[selectedIdeaIndex] : ''
              setTop5Ideas([])
              setSelectedIdeaIndex(null)
              setMessages((prev) => [
                ...prev,
                {
                  id: `generating-${Date.now()}`,
                  role: 'assistant',
                  content: `「${idea}」であなた専用のクエストを作っています...\n少々お待ちください 🌸`,
                  createdAt: new Date().toISOString(),
                },
              ])
              const personality = { timeUsage: '', mbti: '', localPain: idea }
              const ideaCard = await generateIdeaCardFromText(idea)
              const result = await saveOnboardingData(personality, ideaCard, [ideaCard])
              if (result.error) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `error-${Date.now()}`,
                    role: 'assistant',
                    content: 'クエストの作成に失敗しました。もう一度試してください。',
                    createdAt: new Date().toISOString(),
                  },
                ])
                return
              }
              router.push('/?mentorOpen=true')
            }}
            className="w-full h-auto py-4 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-left flex flex-col gap-1"
          >
            <span className="font-semibold text-sm">🚀 このまま実装へ</span>
            <span className="text-xs text-primary-foreground/70 font-normal">すぐクエストを作る</span>
          </AlertDialogAction>
          <AlertDialogCancel className="w-full">キャンセル</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}
