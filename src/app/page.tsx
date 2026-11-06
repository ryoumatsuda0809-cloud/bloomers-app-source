import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mergeQuestsWithProgress } from '@/lib/quest-utils'
import { getOnboardingStatus } from '@/app/actions/onboarding'
import type { IdeaCard } from '@/app/actions/onboarding'
import QuestStoreInitializer from '@/components/dashboard/QuestStoreInitializer'
import QuestDashboard from '@/components/dashboard/QuestDashboard'

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams
  const mentorOpen = params?.mentorOpen === 'true'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const onboardingCompleted = await getOnboardingStatus()
  if (!onboardingCompleted) {
    redirect('/onboarding')
  }

  const { data: activeProject } = await supabase
    .from('project_ideas')
    .select('id, last_mentor_type, last_custom_mentor_id, idea_card')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const activeProjectId = activeProject?.id ?? ''
  const ap = activeProject as {
    id?: string
    last_mentor_type?: string
    last_custom_mentor_id?: string
    idea_card?: IdeaCard
  } | null
  const initialMentorMode = (ap?.last_mentor_type as 'idea' | 'general' | 'custom') ?? 'idea'
  const initialCustomMentorId = ap?.last_custom_mentor_id ?? undefined

  const { data: rows } = await supabase
    .from('quest_progress')
    .select('quest_id, status')
    .eq('user_id', user.id)
    .eq('project_id', activeProjectId)

  const progressMap: Record<string, 'not_started' | 'in_progress' | 'completed'> =
    rows ? Object.fromEntries(rows.map((r) => [r.quest_id, r.status])) : {}

  const activeIdeaCard = ap?.idea_card ?? null
  const initialQuests = mergeQuestsWithProgress(progressMap, activeIdeaCard ?? undefined)

  return (
    <main className="min-h-screen bg-background">
      <QuestStoreInitializer quests={initialQuests} />
      <QuestDashboard
        activeProjectId={activeProjectId}
        mentorOpen={mentorOpen}
        initialMentorMode={initialMentorMode}
        initialCustomMentorId={initialCustomMentorId}
      />
    </main>
  )
}
