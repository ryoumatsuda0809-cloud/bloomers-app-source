'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp } from 'lucide-react'
import {
  processInterviewTurn,
  generateSummary,
  finalizeInterview,
  type InterviewState,
  type InterviewTurn,
} from '@/app/actions/idea-interview'
import { skipOnboarding } from '@/app/actions/onboarding'
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

const INITIAL_MESSAGE = `あなたのアプリのアイデア、一緒に形にしていきましょう。

4つの質問に答えていくだけで、頭の中の「なんとなく」が、実現可能な形に変わります。

まず最初に：どのような背景で、そのアプリを作ろうと思ったんですか？`

export default function IdeaInterviewPage() {
  const router = useRouter()
  const [state, setState] = useState<InterviewState>({
    phase: 'background',
    answers: {},
    history: [],
    isPhaseDone: false,
  })
  const [messages, setMessages] = useState<InterviewTurn[]>([
    { role: 'assistant', content: INITIAL_MESSAGE },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [turnCountInPhase, setTurnCountInPhase] = useState(0)
  const [showChoiceDialog, setShowChoiceDialog] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (state.phase === 'summary' && !state.finalSummary && !isSummarizing) {
      handleSummarize()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  const handleSummarize = async () => {
    setIsSummarizing(true)
    const { summary, error } = await generateSummary(state.answers)
    if (error || !summary) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'サマリー生成に失敗しました。もう一度試してください。' },
      ])
      setIsSummarizing(false)
      return
    }

    setState((prev) => ({ ...prev, finalSummary: summary, phase: 'revise' }))

    const summaryMessage = `整理してみます。

あなたのアプリの本質は：
「${summary.description}」

背景：${summary.background}
課題：${summary.problem}
理想：${summary.ideal}

この内容で進めて大丈夫ですか？修正したい部分があれば「課題」または「理想」と教えてください。`

    setMessages((prev) => [...prev, { role: 'assistant', content: summaryMessage }])
    setIsSummarizing(false)
  }

  const handleFinalize = async (): Promise<boolean> => {
    if (!state.finalSummary) return false
    const { error } = await finalizeInterview(state.finalSummary, state.answers)
    if (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '保存に失敗しました。もう一度試してください。' },
      ])
      return false
    }
    return true
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading || isSummarizing) return
    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    if (state.phase === 'revise') {
      const lower = userMessage.toLowerCase()

      if (lower.includes('課題')) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'なるほど。では、あなたが本当に解決したい課題は何ですか？',
          },
        ])
        setState((prev) => ({ ...prev, phase: 'problem', isPhaseDone: false }))
        setIsLoading(false)
        return
      }

      if (lower.includes('理想')) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'なるほど。では、あなたが本当に実現したい理想は何ですか？',
          },
        ])
        setState((prev) => ({ ...prev, phase: 'ideal', isPhaseDone: false }))
        setIsLoading(false)
        return
      }

      const confirmKeywords = ['大丈夫', 'ok', 'はい', '進めて', 'いいえ', 'これで', 'ok']
      if (confirmKeywords.some((k) => lower.includes(k))) {
        setShowChoiceDialog(true)
        setIsLoading(false)
        return
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '「課題」と「理想」のどちらを修正しますか？このままで良ければ「大丈夫」と教えてください。',
        },
      ])
      setIsLoading(false)
      return
    }

    const { reply, nextState, error } = await processInterviewTurn(userMessage, state)
    if (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'メンターに接続できませんでした。もう一度試してみてください。',
        },
      ])
      setIsLoading(false)
      return
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    setState(nextState)
    if (nextState.phase === state.phase) {
      setTurnCountInPhase((prev) => prev + 1)
    } else {
      setTurnCountInPhase(0)
    }
    setIsLoading(false)
  }

  const isDone = state.phase === 'done'

  return (
    <>
    <div className="min-h-screen bg-background flex flex-col">

      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <div>
              <p className="text-sm font-semibold text-foreground">企画を整理する</p>
              <p className="text-xs text-muted-foreground">あなたのアイデアを実現可能な形に</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await skipOnboarding()
                router.push('/')
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-lg hover:bg-muted"
            >
              スキップ
            </button>
            <button
              onClick={() => router.push('/onboarding')}
              className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-lg hover:bg-muted"
            >
              戻る
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center text-sm mr-2 shrink-0 mt-1">
                  🌸
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border text-foreground rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {(isLoading || isSummarizing) && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center text-sm mr-2 shrink-0">
                🌸
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <div
                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}

          {turnCountInPhase >= 2 &&
            !isLoading &&
            !isSummarizing &&
            state.phase !== 'revise' &&
            state.phase !== 'summary' && (
            <div className="flex justify-center py-2">
              <button
                onClick={() => {
                  const order = ['background', 'action', 'problem', 'ideal', 'summary'] as const
                  const currentIdx = order.indexOf(state.phase as typeof order[number])
                  if (currentIdx >= 0 && currentIdx < order.length - 1) {
                    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
                    const updatedAnswers = { ...state.answers }
                    if (state.phase === 'background') updatedAnswers.background = lastUserMsg
                    if (state.phase === 'action') updatedAnswers.action = lastUserMsg
                    if (state.phase === 'problem') updatedAnswers.problem = lastUserMsg
                    if (state.phase === 'ideal') updatedAnswers.ideal = lastUserMsg
                    setState(prev => ({
                      ...prev,
                      phase: order[currentIdx + 1],
                      answers: updatedAnswers,
                      isPhaseDone: true,
                    }))
                    setTurnCountInPhase(0)
                  }
                }}
                className="text-xs text-primary hover:underline px-4 py-2 rounded-lg hover:bg-accent/20 transition"
              >
                次のフェーズへ進む →
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {state.phase === 'revise' && !isLoading && !isSummarizing && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-2 flex gap-2">
          <button
            onClick={() => setShowChoiceDialog(true)}
            className="flex-1 h-10 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition"
          >
            このまま確定して進む
          </button>
        </div>
      )}

      <div className="bg-card border-t border-border px-4 py-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex gap-2">
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
            disabled={isLoading || isSummarizing || isDone}
            className="flex-1 border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground bg-background resize-none focus:outline-none focus:border-primary max-h-32 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isSummarizing || isDone}
            className="w-10 h-10 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-2xl flex items-center justify-center transition-colors shrink-0 self-end"
            aria-label="送信"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Enterで送信・Shift+Enterで改行
        </p>
      </div>

    </div>

    <AlertDialog open={showChoiceDialog} onOpenChange={setShowChoiceDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>どうしますか？</AlertDialogTitle>
          <AlertDialogDescription>
            アイデアの整理ができました。次のステップを選んでください。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-3 sm:flex-col">
          <AlertDialogAction
            onClick={() => {
              setShowChoiceDialog(false)
              setState((prev) => ({ ...prev, phase: 'background', isPhaseDone: false }))
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  content: 'では、さらに深掘りしていきましょう。\nどんな背景でこのアイデアを思いついたんですか？',
                },
              ])
            }}
            className="w-full h-auto py-4 px-4 bg-card border border-border hover:border-primary hover:bg-accent/20 text-foreground rounded-xl text-left flex flex-col gap-1"
          >
            <span className="font-semibold text-sm">🔍 深掘りする</span>
            <span className="text-xs text-muted-foreground font-normal">4つの質問でじっくり整理</span>
          </AlertDialogAction>
          <AlertDialogAction
            onClick={async () => {
              setShowChoiceDialog(false)
              const success = await handleFinalize()
              if (success) router.push('/?mentorOpen=true')
            }}
            className="w-full h-auto py-4 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-left flex flex-col gap-1"
          >
            <span className="font-semibold text-sm">🚀 パパっと整理して実装へ</span>
            <span className="text-xs text-primary-foreground/70 font-normal">すぐにクエストを作る</span>
          </AlertDialogAction>
          <AlertDialogCancel className="w-full">キャンセル</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
