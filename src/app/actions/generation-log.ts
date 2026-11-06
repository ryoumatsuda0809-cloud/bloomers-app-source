'use server'

// 生成イベントの最小ログ（B-6計測基盤の種）。
// 分類・土台生成・深堀りの成功/フォールバック/エラーを記録し、フォールバック率を観測可能にする。
// 記録の失敗は本処理に一切影響させない。
import { createClient } from '@/lib/supabase/server'

export type GenerationEvent = {
  projectId?: string
  eventType: 'classification' | 'foundation_generation' | 'deep_dive' | 'stuck_report'
  questNumber?: number
  appType?: string
  outcome: 'success' | 'fallback' | 'error'
  detail?: string
}

export async function logGenerationEvent(event: GenerationEvent): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('generation_events').insert({
      user_id: user.id,
      project_id: event.projectId ?? null,
      event_type: event.eventType,
      quest_number: event.questNumber ?? null,
      app_type: event.appType ?? null,
      outcome: event.outcome,
      detail: event.detail?.slice(0, 500) ?? null,
    })
  } catch {
    // ログ失敗は無視（本処理を止めない）
  }
}
