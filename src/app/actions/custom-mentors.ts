'use server'

import { createClient } from '@/lib/supabase/server'

export type CustomMentor = {
  id: string
  name: string
  systemPrompt: string
  linkedKnowledgeIds: string[]
  createdAt: string
  updatedAt: string
}

export async function createCustomMentor(
  name: string,
  systemPrompt: string,
  linkedKnowledgeIds: string[]
): Promise<{ mentor?: CustomMentor; error?: string }> {
  if (!name.trim()) return { error: 'メンター名を入力してください。' }
  if (!systemPrompt.trim()) return { error: 'システムプロンプトを入力してください。' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { data, error } = await supabase
    .from('custom_mentors')
    .insert({
      user_id: user.id,
      name: name.trim(),
      system_prompt: systemPrompt.trim(),
      linked_knowledge_ids: linkedKnowledgeIds,
    })
    .select()
    .single()

  if (error || !data) return { error: 'メンターの作成に失敗しました。' }

  return {
    mentor: {
      id: data.id,
      name: data.name,
      systemPrompt: data.system_prompt,
      linkedKnowledgeIds: (data.linked_knowledge_ids as string[]) ?? [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  }
}

export async function getCustomMentors(): Promise<CustomMentor[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('custom_mentors')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    systemPrompt: row.system_prompt,
    linkedKnowledgeIds: (row.linked_knowledge_ids as string[]) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function getCustomMentor(id: string): Promise<CustomMentor | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('custom_mentors')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    name: data.name,
    systemPrompt: data.system_prompt,
    linkedKnowledgeIds: (data.linked_knowledge_ids as string[]) ?? [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function updateCustomMentor(
  id: string,
  name: string,
  systemPrompt: string,
  linkedKnowledgeIds: string[]
): Promise<{ success?: boolean; error?: string }> {
  if (!name.trim()) return { error: 'メンター名を入力してください。' }
  if (!systemPrompt.trim()) return { error: 'システムプロンプトを入力してください。' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('custom_mentors')
    .update({
      name: name.trim(),
      system_prompt: systemPrompt.trim(),
      linked_knowledge_ids: linkedKnowledgeIds,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'メンターの更新に失敗しました。' }
  return { success: true }
}

export async function deleteCustomMentor(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('custom_mentors')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'メンターの削除に失敗しました。' }
  return { success: true }
}
