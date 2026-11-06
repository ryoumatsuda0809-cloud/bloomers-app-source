'use server'

import { createClient } from '@/lib/supabase/server'

export async function recordSkillResult(
  x: 0 | 1,
  gaveBottomOut: boolean,
  projectId?: string,
  questId?: string
): Promise<{ success?: boolean; error?: string; skillLevel?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  try {
    const { data: profile, error: readErr } = await supabase
      .from('profiles')
      .select('skill_level')
      .eq('id', user.id)
      .single()
    if (readErr) return { error: readErr.message }

    const prevM = typeof profile?.skill_level === 'number' ? profile.skill_level : 0.5
    const newM = 0.3 * x + 0.7 * prevM

    const { error: updErr } = await supabase
      .from('profiles')
      .update({ skill_level: newM })
      .eq('id', user.id)
    if (updErr) return { error: updErr.message }

    const { error: logErr } = await supabase
      .from('skill_logs')
      .insert({
        user_id: user.id,
        project_id: projectId ?? null,
        quest_id: questId ?? null,
        x,
        gave_bottom_out: gaveBottomOut,
      })
    if (logErr) return { error: logErr.message }

    return { success: true, skillLevel: newM }
  } catch {
    return { error: 'スキル記録に失敗しました。' }
  }
}
