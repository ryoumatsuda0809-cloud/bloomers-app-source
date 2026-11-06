'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type AuthResult = { error?: string | null }

// Supabase の英語エラーメッセージを日本語に変換する
function toJapaneseError(message: string): string {
  if (message.includes('User already registered') || message.includes('already been registered')) {
    return 'このメールアドレスは既に登録されています。'
  }
  if (message.includes('Invalid login credentials')) {
    return 'メールアドレスまたはパスワードが正しくありません。'
  }
  if (message.includes('Email not confirmed')) {
    return '確認メールのリンクをクリックしてからログインしてください。'
  }
  if (message.includes('Password should be at least')) {
    return 'パスワードは6文字以上で入力してください。'
  }
  if (message.includes('Unable to validate email address')) {
    return '有効なメールアドレスを入力してください。'
  }
  if (
    message.includes('rate limit') ||
    message.includes('over_email') ||
    message.includes('too many')
  ) {
    return 'しばらく時間をおいてから再度お試しください。'
  }
  return message
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) return { error: toJapaneseError(error.message) }

  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: data.user.id }, { onConflict: 'id' })

    if (profileError) {
      return { error: 'アカウントの初期設定に失敗しました。もう一度お試しください。' }
    }
  }

  revalidatePath('/', 'layout')
  return {}
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: toJapaneseError(error.message) }

  revalidatePath('/', 'layout')
  return { error: null }
}
