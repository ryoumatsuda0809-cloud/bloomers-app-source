'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { signUp, signIn } from '@/app/actions/auth'
import { Mail, Lock, CheckCircle2 } from 'lucide-react'

const authSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
})

type AuthFormValues = z.infer<typeof authSchema>

const features = [
  'AIが全力で伴走。コードは書かなくていい',
  '「詰まり」を即解決するメンター機能',
  'あなたのアイデアが本物のプロダクトに',
]

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
  })

  const onSubmit = async (values: AuthFormValues) => {
    setServerError(null)
    const action = mode === 'signup' ? signUp : signIn
    const { error } = await action(values.email, values.password)
    if (error) {
      setServerError(error)
      return
    }
    router.push('/')
  }

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next)
    setServerError(null)
    reset()
  }

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">

      {/* ── カード全体（丸角コンテナ） ─────────────────────── */}
      <div className="w-full max-w-4xl flex rounded-3xl overflow-hidden shadow-2xl shadow-black/10">

        {/* ── 左パネル（PC のみ） ──────────────────────────── */}
        <div
          className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10"
          style={{
            background: 'linear-gradient(145deg, oklch(0.420 0.210 355), oklch(0.700 0.130 340))',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌸</span>
            <span className="text-lg font-bold tracking-tight text-white">Bloomers</span>
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="font-heading text-4xl font-bold text-white leading-snug">
                作りたいを、<br />形に。
              </h1>
              <p className="mt-3 text-white/65 text-sm leading-relaxed">
                初心者でも、アイデアがあれば大丈夫。<br />
                AIと一緒にプロダクトを作り上げよう。
              </p>
            </div>

            <ul className="space-y-3.5">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <CheckCircle2 className="size-4 text-white/80 mt-0.5 shrink-0" />
                  <span className="text-white/75 text-sm leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-white/25 text-xs">© 2025 Bloomers</p>
        </div>

        {/* ── 右パネル（フォーム） ─────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 bg-card">

          {/* モバイル用ロゴ */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <span className="text-2xl">🌸</span>
            <span className="text-xl font-bold tracking-tight text-foreground">Bloomers</span>
          </div>

          <div className="w-full max-w-sm">

            {/* ヘッダー */}
            <div className="mb-7">
              <h2 className="text-xl font-bold text-foreground">
                {mode === 'login' ? 'おかえりなさい' : 'はじめよう'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === 'login' ? 'アカウントにログイン' : '無料でアカウントを作成'}
              </p>
            </div>

            {/* タブ切り替え（ピル型トグル） */}
            <div className="flex bg-muted rounded-2xl p-1 mb-7">
              {(['login', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={[
                    'flex-1 py-2 text-sm font-medium rounded-xl transition-all duration-200',
                    mode === m
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  {m === 'login' ? 'ログイン' : '新規登録'}
                </button>
              ))}
            </div>

            {/* フォーム */}
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">

              {/* メール */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  メールアドレス
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    className="h-11 pl-10 text-sm rounded-xl"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* パスワード */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">
                  パスワード
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="6文字以上"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    aria-invalid={!!errors.password}
                    className="h-11 pl-10 text-sm rounded-xl"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              {serverError && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2.5">
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 font-semibold rounded-xl mt-1"
              >
                {isSubmitting
                  ? '処理中...'
                  : mode === 'login'
                  ? 'ログイン'
                  : 'アカウントを作成'}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              登録することで
              <span className="text-foreground/60">利用規約</span>
              に同意したことになります
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
