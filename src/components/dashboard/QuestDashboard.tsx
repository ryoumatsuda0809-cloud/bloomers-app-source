'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuestStore } from '@/store/useQuestStore'
import QuestCard from '@/components/dashboard/QuestCard'
import QuestConnector from '@/components/dashboard/QuestConnector'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { updateQuestStatus } from '@/app/actions/quest'
import { createRepository } from '@/app/actions/github'
import { PartyPopper } from 'lucide-react'
import MentorPanel from '@/components/quest/MentorPanel'
import AppShell from '@/components/layout/AppShell'
import { getCustomMentors, type CustomMentor } from '@/app/actions/custom-mentors'
import { saveLastMentor } from '@/app/actions/projects'

type QuestDashboardProps = {
  activeProjectId: string
  mentorOpen?: boolean
  initialMentorMode?: 'idea' | 'general' | 'custom'
  initialCustomMentorId?: string
}

export default function QuestDashboard({ activeProjectId, mentorOpen, initialMentorMode, initialCustomMentorId }: QuestDashboardProps) {
  const router = useRouter()
  const quests = useQuestStore((state) => state.quests)
  const startQuest = useQuestStore((state) => state.startQuest)
  const completeQuest = useQuestStore((state) => state.completeQuest)
  const skipQuest = useQuestStore((state) => state.skipQuest)
  const reopenQuest = useQuestStore((state) => state.reopenQuest)
  const setQuests = useQuestStore((state) => state.setQuests)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const activeQuest = useQuestStore((state) =>
    state.quests.find((q) => q.status === 'active') ?? null
  )

  const [gitHubSaveStatus, setGitHubSaveStatus] =
    useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [gitHubRepoUrl, setGitHubRepoUrl] = useState<string>('')

  const [mentorMode, setMentorMode] = useState<'idea' | 'general' | 'custom'>(initialMentorMode ?? 'idea')
  const [customMentorId, setCustomMentorId] = useState<string | undefined>(initialCustomMentorId)
  const [customMentors, setCustomMentors] = useState<CustomMentor[]>([])

  useEffect(() => {
    getCustomMentors()
      .then((list) => {
        setCustomMentors(list)
        if (mentorMode === 'custom' && customMentorId && !list.some((cm) => cm.id === customMentorId)) {
          setMentorMode('idea')
          setCustomMentorId(undefined)
        }
      })
      .catch(() => setCustomMentors([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMentorChange = (mode: 'idea' | 'general' | 'custom', cmId?: string) => {
    setMentorMode(mode)
    setCustomMentorId(mode === 'custom' ? cmId : undefined)
    saveLastMentor(activeProjectId, mode, cmId)
      .then((res) => {
        if (res.error) console.error('[QuestDashboard] 最後のメンター保存に失敗:', res.error)
      })
      .catch((e) => console.error('[QuestDashboard] 最後のメンター保存に失敗:', e))
  }

  const handleGitHubSave = async () => {
    setGitHubSaveStatus('loading')
    const result = await createRepository('Bloomerプロジェクト')
    if (result.success && result.repoUrl) {
      setGitHubSaveStatus('success')
      setGitHubRepoUrl(result.repoUrl)
    } else {
      setGitHubSaveStatus('error')
    }
  }

  const completedCount = quests.filter((q) => q.status === 'completed').length
  const progressPct = quests.length > 0 ? Math.round((completedCount / quests.length) * 100) : 0
  const allCompleted = quests.length > 0 && completedCount === quests.length

  const handleStart = async (id: string) => {
    const snapshot = useQuestStore.getState().quests
    startQuest(id)
    const { error } = await updateQuestStatus(id, 'in_progress', activeProjectId)
    if (error) {
      setQuests(snapshot)
      return
    }
    router.refresh()
  }

  const handleComplete = async (id: string) => {
    const snapshot = useQuestStore.getState().quests
    completeQuest(id)
    const { error } = await updateQuestStatus(id, 'completed', activeProjectId)
    if (error) setQuests(snapshot)
    router.refresh()
  }

  const handleSkip = async (id: string) => {
    const snapshot = useQuestStore.getState().quests
    skipQuest(id)
    const { error } = await updateQuestStatus(id, 'skipped', activeProjectId)
    if (error) {
      setQuests(snapshot)
      return
    }
    router.refresh()
  }

  const handleReopen = async (id: string) => {
    const snapshot = useQuestStore.getState().quests
    reopenQuest(id)
    const { error } = await updateQuestStatus(id, 'not_started', activeProjectId)
    if (error) {
      setQuests(snapshot)
      return
    }
    router.refresh()
  }

  return (
    <AppShell
      showRoadmap={true}
      rightSlot={
        activeProjectId ? (
          <MentorPanel
            questId="dashboard"
            questTitle="アイデアを育てよう"
            projectId={activeProjectId}
            mode={mentorMode}
            customMentorId={customMentorId}
            customMentors={customMentors}
            onMentorChange={handleMentorChange}
            initialOpen={mentorOpen}
          />
        ) : undefined
      }
    >
      <main className="px-6 py-8 lg:px-10 xl:px-16 max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="font-heading text-2xl lg:text-3xl font-bold text-foreground mb-1">クエストダッシュボード</h1>
            <p className="text-muted-foreground text-sm">ステップをひとつずつクリアして、あなたのプロダクトを育てよう。</p>
          </div>

          <div className="lg:hidden bg-card rounded-xl p-4 shadow-sm ring-1 ring-border mb-8 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>全体の進捗</span>
                <span className="font-semibold text-primary">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-foreground">{completedCount}</p>
              <p className="text-xs text-muted-foreground">/ {quests.length} 完了</p>
            </div>
          </div>

          <div className="flex flex-col items-stretch">
            {quests.map((quest, index) => (
              <div key={quest.id}>
                <QuestCard
                  id={quest.id}
                  title={quest.title}
                  description={quest.description}
                  status={quest.status}
                  onComplete={handleComplete}
                  onStart={handleStart}
                  onSkip={handleSkip}
                  onReopen={handleReopen}
                  onGitHubSave={handleGitHubSave}
                  gitHubSaveStatus={gitHubSaveStatus}
                  gitHubRepoUrl={gitHubRepoUrl}
                  href={['active', 'in_progress', 'completed', 'skipped'].includes(quest.status) ? `/quest/${quest.id}` : undefined}
                />
                {index < quests.length - 1 && <QuestConnector fromStatus={quest.status} />}
              </div>
            ))}
          </div>

          {allCompleted && (
            <Card className="mt-10 bg-accent/20 border-accent/50 rounded-xl shadow-md">
              <CardContent className="p-10 text-center">
                <PartyPopper className="size-10 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">全クエスト完了！</h2>
                <p className="text-muted-foreground text-sm">おめでとうございます。Bloomers のロードマップを完走しました！</p>
              </CardContent>
            </Card>
          )}
        </main>
    </AppShell>
  )
}
