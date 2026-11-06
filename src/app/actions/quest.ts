'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateQuestStatus(
  questId: string,
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped',
  projectId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: '認証セッションが見つかりません。ページを再読み込みしてください。' }
  }

  const { error } = await supabase.from('quest_progress').upsert(
    {
      user_id: user.id,
      quest_id: questId,
      status,
      project_id: projectId,
      completed_at: (status === 'completed' || status === 'skipped') ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,quest_id,project_id' }
  )

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}
