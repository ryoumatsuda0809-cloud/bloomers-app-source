'use server'

import { createClient } from '@/lib/supabase/server'
import type { PersonalityData, IdeaCard } from '@/app/actions/onboarding'

export type ProjectIdea = {
  id: string
  title: string
  description: string
  personalityData: PersonalityData
  ideaCard: IdeaCard
  isActive: boolean
  isPinned: boolean
  status: string
  createdAt: string
  questNotes: Record<string, string>
  lastMentorType?: string
  lastCustomMentorId?: string
}

export async function saveProjectIdea(
  personality: PersonalityData,
  ideaCard: IdeaCard
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('project_ideas')
    .insert({
      user_id: user.id,
      title: ideaCard.title,
      description: ideaCard.description,
      personality_data: personality,
      idea_card: ideaCard,
      is_active: false,
    })

  if (error) return { error: 'プロジェクトの保存に失敗しました。' }
  return { success: true }
}

export async function getProjectIdeas(): Promise<ProjectIdea[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('project_ideas')
    .select('*')
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    personalityData: row.personality_data,
    ideaCard: row.idea_card,
    isActive: row.is_active,
    isPinned: row.is_pinned ?? false,
    status: row.status ?? 'active',
    createdAt: row.created_at,
    questNotes: (row.quest_notes ?? {}) as Record<string, string>,
    lastMentorType: row.last_mentor_type ?? 'idea',
    lastCustomMentorId: row.last_custom_mentor_id ?? undefined,
  }))
}

export async function setActiveProject(
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  // 全部のis_activeをfalseに
  await supabase
    .from('project_ideas')
    .update({ is_active: false })
    .eq('user_id', user.id)

  // 選択したものだけtrueに
  const { error } = await supabase
    .from('project_ideas')
    .update({ is_active: true })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'プロジェクトの切り替えに失敗しました。' }

  // paused を active に戻す（completed は維持）
  await supabase
    .from('project_ideas')
    .update({ status: 'active' })
    .eq('id', projectId)
    .eq('user_id', user.id)
    .neq('status', 'completed')

  // profilesのselected_ideaも更新
  const { data } = await supabase
    .from('project_ideas')
    .select('idea_card')
    .eq('id', projectId)
    .single()

  if (data?.idea_card) {
    await supabase
      .from('profiles')
      .update({ selected_idea: data.idea_card })
      .eq('id', user.id)
  }

  return { success: true }
}

export async function pinProjectIdea(
  projectId: string,
  isPinned: boolean
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('project_ideas')
    .update({ is_pinned: isPinned })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'ピン留めに失敗しました。' }
  return { success: true }
}

export async function pauseProject(
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('project_ideas')
    .update({ status: 'paused', is_active: false })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: '中断の保存に失敗しました。' }
  return { success: true }
}

export async function renameProjectIdea(
  id: string,
  title: string
): Promise<{ success?: boolean; error?: string }> {
  const trimmed = title.trim()
  if (!trimmed) return { error: '名前を入力してください。' }
  if (trimmed.length > 100) return { error: '名前が長すぎます（100文字以内）。' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('project_ideas')
    .update({ title: trimmed })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: '名前の変更に失敗しました。' }
  return { success: true }
}

export async function deleteProjectIdea(
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('project_ideas')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: '削除に失敗しました。' }
  return { success: true }
}

export async function getQuestNotes(
  projectId: string
): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('project_ideas')
    .select('quest_notes')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return {}
  return (data.quest_notes ?? {}) as Record<string, string>
}

export async function saveQuestNote(
  projectId: string,
  questId: string,
  note: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { data: current } = await supabase
    .from('project_ideas')
    .select('quest_notes')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  const notes = (current?.quest_notes ?? {}) as Record<string, string>
  notes[questId] = note

  const { error } = await supabase
    .from('project_ideas')
    .update({ quest_notes: notes })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'メモの保存に失敗しました。' }
  return { success: true }
}

export async function saveLastMentor(
  projectId: string,
  mentorType: 'idea' | 'general' | 'custom',
  customMentorId?: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }
  try {
    const { error } = await supabase
      .from('project_ideas')
      .update({
        last_mentor_type: mentorType,
        last_custom_mentor_id: mentorType === 'custom' ? (customMentorId ?? null) : null,
      })
      .eq('id', projectId)
      .eq('user_id', user.id)
    if (error) return { error: error.message }
    return { success: true }
  } catch {
    return { error: '最後のメンターの保存に失敗しました。' }
  }
}
