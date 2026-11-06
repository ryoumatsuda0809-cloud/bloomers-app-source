'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, MessageCircle, Copy, Check, Terminal } from 'lucide-react'
import { QUEST_CONFIG } from '@/lib/quest-utils'

type CopyState = 'idle' | 'copied'

function AISelectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const questId = searchParams.get('questId') ?? ''
  const questTitle = searchParams.get('questTitle') ?? ''
  const stepTitle = searchParams.get('stepTitle') ?? ''
  const mentorMessage = searchParams.get('mentorMessage') ?? ''

  const [claudeCodeCopyState, setClaudeCodeCopyState] = useState<CopyState>('idle')
  const [claudeCopyState, setClaudeCopyState] = useState<CopyState>('idle')
  const [showClaudeCodeGuide, setShowClaudeCodeGuide] = useState(false)

  const config = QUEST_CONFIG[questId as keyof typeof QUEST_CONFIG]
  const hiddenPrompt = config?.hiddenPrompt ?? ''

  const claudePrompt = `以下のクエストのステップで詰まっています。一緒に考えてください。

クエスト：${questTitle}
ステップ：${stepTitle}
このステップの意味：${mentorMessage}

技術用語を使わず、友達のような口調で助言してください。`

  const handleGemini = () => {
    const params = new URLSearchParams({
      questId,
      questTitle,
      stepTitle,
      mentorMessage,
      help: `「${stepTitle}」で詰まっています。助けてください。`,
    })
    router.push(`/chat?${params.toString()}`)
  }

  const handleClaude = async () => {
    try {
      await navigator.clipboard.writeText(claudePrompt)
      setClaudeCopyState('copied')
      setTimeout(() => {
        setClaudeCopyState('idle')
        window.open('https://claude.ai', '_blank', 'noopener,noreferrer')
      }, 800)
    } catch {
      window.open('https://claude.ai', '_blank', 'noopener,noreferrer')
    }
  }

  const handleClaudeCode = async () => {
    try {
      await navigator.clipboard.writeText(hiddenPrompt)
      setClaudeCodeCopyState('copied')
      setShowClaudeCodeGuide(true)
      setTimeout(() => setClaudeCodeCopyState('idle'), 2000)
    } catch {
      setShowClaudeCodeGuide(true)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">

        <div>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition text-sm py-2"
          >
            <ArrowLeft className="size-4" /> 戻る
          </button>
        </div>

        <div className="space-y-1">
          <h1 className="font-heading text-xl font-bold text-foreground">
            どのAIに相談しますか？
          </h1>
          {stepTitle && (
            <p className="text-sm text-muted-foreground">
              {questTitle} — {stepTitle}
            </p>
          )}
        </div>

        <div className="space-y-3">

          {/* Gemini */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <MessageCircle className="size-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">Gemini</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  考えを整理する・メンターに相談する
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  今詰まっていることをそのまま話してください。
                  友達のような口調で一緒に考えてくれます。
                </p>
              </div>
            </div>
            <button
              onClick={handleGemini}
              className="w-full h-9 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition"
            >
              Geminiに相談する
            </button>
          </div>

          {/* Claude */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <MessageCircle className="size-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">Claude</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  深く考えたい・アイデアを掘り下げたい
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  今のステップの文脈をコピーして、
                  Claude.aiを開きます。貼り付けるだけで始められます。
                </p>
              </div>
            </div>
            <button
              onClick={handleClaude}
              className="w-full h-9 bg-card border border-border text-foreground text-sm font-semibold rounded-lg hover:bg-muted transition flex items-center justify-center gap-2"
            >
              {claudeCopyState === 'copied' ? (
                <>
                  <Check className="size-4 text-primary" />
                  コピーしました。Claude.aiを開いています...
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  文脈をコピーしてClaude.aiへ
                </>
              )}
            </button>
          </div>

          {/* Claude Code */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Terminal className="size-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">Claude Code</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  実装を進めたい・コードを書かせたい
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  このステップ専用のプロンプトをコピーします。
                  ターミナルのClaude Codeに貼り付けるだけで実装が始まります。
                </p>
              </div>
            </div>

            {hiddenPrompt ? (
              <button
                onClick={handleClaudeCode}
                className="w-full h-9 bg-card border border-border text-foreground text-sm font-semibold rounded-lg hover:bg-muted transition flex items-center justify-center gap-2"
              >
                {claudeCodeCopyState === 'copied' ? (
                  <>
                    <Check className="size-4 text-primary" />
                    コピーしました
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    プロンプトをコピーする
                  </>
                )}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                このステップにはプロンプトが設定されていません
              </p>
            )}

            {showClaudeCodeGuide && (
              <div className="bg-muted/60 rounded-lg px-4 py-3 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">貼り付け先：</p>
                <p>1. ターミナルを開く</p>
                <p>2. <code className="bg-muted px-1 rounded">claude</code> と入力してEnter</p>
                <p>3. コピーしたプロンプトを貼り付けてEnter</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default function AISelectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    }>
      <AISelectContent />
    </Suspense>
  )
}
