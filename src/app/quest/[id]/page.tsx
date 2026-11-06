'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useParams, useSearchParams, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateStepCompletion, updateQuestStepCompletion, ensureQuestSteps } from '@/app/actions/setup'
import type { SetupStep } from '@/app/actions/setup'
import { updateQuestStatus } from '@/app/actions/quest'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ExternalLink, AlertTriangle } from 'lucide-react'
import { QUEST_CONFIG } from '@/lib/quest-utils'
import QuestHeader from '@/components/quest/QuestHeader'
import MentorWindow from '@/components/quest/MentorWindow'
import MentorPanel from '@/components/quest/MentorPanel'
import StepConfirmDialog from '@/components/quest/StepConfirmDialog'
import QuestCompleteOverlay from '@/components/quest/QuestCompleteOverlay'
import DecisionDialog from '@/components/quest/DecisionDialog'
import NextQuestPreview from '@/components/quest/NextQuestPreview'
import ThinkingStep from '@/components/quest/ThinkingStep'
import { saveStepAnswer } from '@/app/actions/setup'
import { getQuestNotes, saveQuestNote } from '@/app/actions/projects'
import { getMentorHistory } from '@/app/actions/chat'
import type { ChatMessage } from '@/app/actions/chat'

export default function QuestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          <div className="h-8 w-56 bg-muted rounded animate-pulse" />
        </div>
      </div>
    }>
      <QuestContent />
    </Suspense>
  )
}

function QuestContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const isReviewMode = searchParams.get('review') === '1'

  // q1 は専用の検証インタビューページへ
  useEffect(() => {
    if (id === 'q1') {
      router.replace(`/quest/q1-validation${isReviewMode ? '?review=1' : ''}`)
    }
  }, [id, isReviewMode, router])

  const [steps, setSteps] = useState<SetupStep[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [isCompletingId, setIsCompletingId] = useState<string | null>(null)

  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false)
  const [showDecisionDialog, setShowDecisionDialog] = useState(false)
  const [showNextQuestPreview, setShowNextQuestPreview] = useState(false)
  const [note, setNote] = useState('')
  const [noteSaveStatus, setNoteSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [mentorOpen, setMentorOpen] = useState(false)
  const [mentorHistory, setMentorHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [confirmingStepId, setConfirmingStepId] = useState<string | null>(null)
  const [injectedHint, setInjectedHint] = useState<{ text: string; nonce: number } | undefined>(undefined)
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const wasCompleteOnLoad = useRef(false)
  const completionTriggered = useRef(false)

  // デスクトップ幅（xl=1280px以上）でのみメンターを右カラム常駐で開いた状態にする
  useEffect(() => {
    if (window.matchMedia('(min-width: 1280px)').matches) {
      setMentorOpen(true)
    }
  }, [])

  useEffect(() => {
    const config = QUEST_CONFIG[id as keyof typeof QUEST_CONFIG]
    if (!config) return

    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('project_ideas')
        .select(`id, ${config.columnName}`)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        setProjectId(data.id)
        const stepsData = (data as Record<string, unknown>)[config.columnName]
        let loadedSteps = (stepsData ?? []) as SetupStep[]

        // q2〜q5 でステップが空なら遅延生成（既存プロジェクト救済 + 新規の保険）
        if (loadedSteps.length === 0 && config.questNumber !== null) {
          loadedSteps = await ensureQuestSteps(data.id, config.questNumber as 2 | 3 | 4 | 5)
        }

        setSteps(loadedSteps)
        const firstIncomplete = loadedSteps.findIndex((s) => !s.completed)
        setCurrentStep(firstIncomplete === -1 ? 0 : firstIncomplete)
      } else {
        setHasError(true)
      }
      setIsLoading(false)
    }
    load()
  }, [router, id])

  const config = QUEST_CONFIG[id as keyof typeof QUEST_CONFIG]
  if (!config) notFound()

  const allCompleted = steps.length > 0 && steps.every((s) => s.completed)

  // 初回ロード時の完了状態を記録 — ロード後に初めて完了した場合のみオーバーレイを表示
  useEffect(() => {
    if (!isLoading) {
      wasCompleteOnLoad.current = allCompleted
    }
  }, [isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isReviewMode) return
    if (
      !isLoading &&
      allCompleted &&
      !wasCompleteOnLoad.current &&
      !completionTriggered.current &&
      projectId
    ) {
      completionTriggered.current = true
      void updateQuestStatus(id, 'completed', projectId)
      setShowCompleteOverlay(true)
    }
  }, [allCompleted, isLoading, projectId, id, isReviewMode])

  useEffect(() => {
    if (!projectId) return
    getQuestNotes(projectId).then((notes) => {
      setNote(notes[id] ?? '')
    }).catch(() => {})
    getMentorHistory(projectId, id).then((history: ChatMessage[]) => {
      setMentorHistory(history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })))
    }).catch(() => {})
  }, [projectId, id])

  const handleNoteChange = (value: string) => {
    setNote(value)
    setNoteSaveStatus('saving')
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current)
    noteSaveTimer.current = setTimeout(async () => {
      if (!projectId) return
      const { error } = await saveQuestNote(projectId, id, value)
      setNoteSaveStatus(error ? 'idle' : 'saved')
      if (!error) setTimeout(() => setNoteSaveStatus('idle'), 2000)
    }, 800)
  }

  const handleStepButtonClick = (step: SetupStep) => {
    if (step.done_condition) {
      setConfirmingStepId(step.id)
      return
    }
    void handleStepToggle(step.id)
  }

  const handleConfirmYes = () => {
    const stepId = confirmingStepId
    setConfirmingStepId(null)
    if (stepId) void handleStepToggle(stepId)
  }

  const handleConfirmNotYet = () => {
    const step = steps.find((s) => s.id === confirmingStepId)
    setConfirmingStepId(null)
    const hint = step?.stuck_points?.[0]?.hint_l1
    setMentorOpen(true)
    if (hint) {
      setInjectedHint({ text: hint, nonce: Date.now() })
    }
  }

  // ローカルUIの完了反映のみ（DB書き込みは呼び出し側の責務）。
  // メンターのツール経由の完了は、DBを既に`completeStepIfActive`側で書き込み済みのため
  // これだけを呼んで二重書き込みを避ける。
  const applyStepCompletedLocally = (stepId: string) => {
    const updated = steps.map((s) =>
      s.id === stepId ? { ...s, completed: true } : s
    )
    setSteps(updated)

    const nextIndex = updated.findIndex((s) => !s.completed)
    if (nextIndex !== -1) {
      setCurrentStep(nextIndex)
    }
  }

  const handleStepToggle = async (stepId: string) => {
    setIsCompletingId(stepId)
    applyStepCompletedLocally(stepId)

    if (id === 'q1') {
      await updateStepCompletion(projectId, stepId, true)
    } else {
      await updateQuestStepCompletion(projectId, config.questNumber as 2 | 3 | 4 | 5, stepId, true)
    }
    setIsCompletingId(null)
  }

  const handleThinkingComplete = async (stepId: string, answer: string) => {
    setIsCompletingId(stepId)

    await saveStepAnswer(projectId, id, stepId, answer)

    const updated = steps.map((s) =>
      s.id === stepId ? { ...s, completed: true, userAnswer: answer } : s
    )
    setSteps(updated)

    if (id === 'q1') {
      await updateStepCompletion(projectId, stepId, true)
    } else {
      await updateQuestStepCompletion(
        projectId,
        config.questNumber as 2 | 3 | 4 | 5,
        stepId,
        true
      )
    }

    setIsCompletingId(null)

    const nextIndex = updated.findIndex((s) => !s.completed)
    if (nextIndex !== -1) {
      setCurrentStep(nextIndex)
    }
  }

  const questKeys = Object.keys(QUEST_CONFIG) as (keyof typeof QUEST_CONFIG)[]
  const currentIndex = questKeys.indexOf(id as keyof typeof QUEST_CONFIG)
  const nextQuestKey = currentIndex < questKeys.length - 1 ? questKeys[currentIndex + 1] : null
  const nextQuestConfig = nextQuestKey ? QUEST_CONFIG[nextQuestKey] : null

  const handleQuestCompleteNext = () => {
    setShowCompleteOverlay(false)
    if (config.decisionQuestion) {
      setShowDecisionDialog(true)
    } else {
      setShowNextQuestPreview(true)
    }
  }

  const handleDecisionComplete = () => {
    setShowDecisionDialog(false)
    setShowNextQuestPreview(true)
  }

  const completedCount = steps.filter((s) => s.completed).length

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <AlertTriangle className="size-10 text-destructive mx-auto" />
          <p className="text-foreground font-medium">
            アクティブなプロジェクトが見つかりません
          </p>
          <button
            onClick={() => router.push('/projects')}
            className="text-sm text-primary hover:underline"
          >
            マイプロジェクトに戻る
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col xl:flex-row">

        {/* メインコンテンツ */}
        <div className="flex-1 min-w-0 px-4 py-8 xl:overflow-y-auto">
          <div className="max-w-lg mx-auto space-y-6">

            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition text-sm py-2"
            >
              <ArrowLeft className="size-4" /> ダッシュボードに戻る
            </button>

            <QuestHeader
              title={config.title}
              estimatedMinutes={config.estimatedMinutes}
              difficulty={config.difficulty}
              hiddenPrompt={config.hiddenPrompt}
            />

            <p className="text-sm text-muted-foreground">
              {completedCount} / {steps.length} ステップ完了
            </p>

            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${steps.length > 0 ? (completedCount / steps.length) * 100 : 0}%` }}
              />
            </div>

            <MentorWindow message={config.mentorMessage} />

            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`bg-card rounded-2xl border p-5 space-y-3 transition ${
                    step.completed
                      ? 'border-accent bg-accent/30'
                      : index === currentStep
                      ? 'border-primary shadow-sm'
                      : 'border-border opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                      step.completed
                        ? 'bg-accent text-accent-foreground'
                        : index === currentStep
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {step.completed ? '✓' : index + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${
                        step.completed ? 'text-accent-foreground' : 'text-foreground'
                      }`}>
                        {step.title}
                      </p>
                      {index === currentStep && !step.completed && (
                        <p className="text-muted-foreground text-xs mt-1">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {index === currentStep && !step.completed && !isReviewMode && (
                    <div className="space-y-2 pl-10">
                      {step.type === 'thinking' ? (
                        <ThinkingStep
                          step={step}
                          questId={id}
                          onComplete={handleThinkingComplete}
                        />
                      ) : (
                        <>
                          {step.link && (
                            <a
                              href={step.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="size-3" /> {step.linkLabel ?? 'リンクを開く'}
                            </a>
                          )}
                          <button
                            onClick={() => handleStepButtonClick(step)}
                            disabled={isCompletingId === step.id}
                            className="w-full h-10 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition disabled:opacity-70"
                          >
                            {isCompletingId === step.id ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                確認中...
                              </span>
                            ) : 'できた'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 見直しモード：メンター会話履歴 */}
            {isReviewMode && mentorHistory.length > 0 && (
              <div className="border-t border-border pt-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">💬 このクエストでのメンターとの会話</h3>
                <div className="space-y-2">
                  {mentorHistory.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.role === 'assistant' && <span className="text-sm mr-1.5 mt-0.5 shrink-0">🌸</span>}
                      <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap max-w-[80%] ${
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* メモ欄（常時表示・完了後も編集可・左カラム最下部） */}
            <div className="border-t border-border pt-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">📝 このクエストのメモ</h3>
                <span className="text-xs text-muted-foreground">
                  {noteSaveStatus === 'saving' && '保存中...'}
                  {noteSaveStatus === 'saved' && '保存しました'}
                </span>
              </div>
              <textarea
                value={note}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder="気づいたこと、学んだことを自由に書いてください。後からいつでも見直せます。"
                rows={4}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground resize-y focus:outline-none focus:border-primary bg-background min-h-[100px]"
              />
            </div>

            {/* モバイルFABのための下部余白 */}
            <div className="xl:hidden h-24" />

          </div>
        </div>

        {/* MentorPanel（デスクトップ開閉対応 + モバイルSheet を内包）*/}
        {projectId && (
          <MentorPanel
            questId={id}
            questTitle={config.title}
            stepTitle={steps[currentStep]?.title ?? ''}
            projectId={projectId}
            desktopOpen={mentorOpen}
            onDesktopClose={() => setMentorOpen(false)}
            injectedHint={injectedHint}
            questNumber={config.questNumber !== null ? (config.questNumber as 2 | 3 | 4 | 5) : undefined}
            currentStepData={steps[currentStep]}
            onStepCompleted={applyStepCompletedLocally}
          />
        )}

        {/* デスクトップ：メンターが閉じている時の再展開フローティングボタン */}
        {projectId && !mentorOpen && (
          <button
            onClick={() => setMentorOpen(true)}
            className="hidden xl:flex fixed bottom-6 right-6 z-40 w-12 h-12 items-center justify-center rounded-full bg-card border border-border shadow-lg hover:bg-muted transition text-xl"
            aria-label="メンターを開く"
          >
            🌸
          </button>
        )}

      </div>

      {confirmingStepId && (
        <StepConfirmDialog
          isOpen={!!confirmingStepId}
          doneCondition={steps.find((s) => s.id === confirmingStepId)?.done_condition ?? ''}
          onYes={handleConfirmYes}
          onNotYet={handleConfirmNotYet}
        />
      )}

      {showCompleteOverlay && (
        <QuestCompleteOverlay
          questTitle={config.title}
          onNext={handleQuestCompleteNext}
        />
      )}

      {showDecisionDialog && config.decisionQuestion && (
        <DecisionDialog
          questId={id}
          question={config.decisionQuestion}
          isOpen={showDecisionDialog}
          onComplete={handleDecisionComplete}
        />
      )}

      {showNextQuestPreview && (
        <NextQuestPreview
          nextQuestId={nextQuestKey ?? null}
          nextQuestTitle={nextQuestConfig?.title ?? null}
          nextEstimatedMinutes={nextQuestConfig?.estimatedMinutes ?? null}
        />
      )}
    </>
  )
}
