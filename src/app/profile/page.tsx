'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, LogOut, Sun, Moon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import AppShell from '@/components/layout/AppShell'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
]
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateToneOverride } from '@/app/actions/onboarding'
import { createClient } from '@/lib/supabase/client'
import type { PersonalityData, IdeaCard } from '@/app/actions/onboarding'

export default function ProfilePage() {
  const router = useRouter()
  const [personality, setPersonality] = useState<PersonalityData | null>(null)
  const [selectedIdea, setSelectedIdea] = useState<IdeaCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [toneOverride, setToneOverride] = useState<'gentle' | 'balanced' | 'strict' | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'))
  }, [])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const handleToggleTheme = (dark: boolean) => {
    setIsDarkMode(dark)
    if (dark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    try { localStorage.setItem('bloomer_theme', dark ? 'dark' : 'light') } catch {}
  }

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('personality_data, selected_idea, tone_override')
        .eq('id', user.id)
        .single()

      if (data?.personality_data) setPersonality(data.personality_data)
      if (data?.selected_idea) setSelectedIdea(data.selected_idea)
      if (data?.tone_override !== undefined) setToneOverride(data.tone_override ?? null)
      setIsLoading(false)
    }
    load()
  }, [router])

  const handleSave = async () => {
    if (!personality) return
    setIsSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({ personality_data: personality })
      .eq('id', user.id)

    setSaved(true)
    setIsSaving(false)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleToneChange = async (tone: 'gentle' | 'balanced' | 'strict' | null) => {
    setToneOverride(tone)
    await updateToneOverride(tone)
  }

  if (isLoading) {
    return (
      <AppShell showRoadmap={false}>
        <div className="px-4 py-8">
          <div className="max-w-lg mx-auto space-y-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-48" />
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell showRoadmap={false}>
      <div className="px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="size-4" /> ダッシュボードに戻る
          </button>
        </div>

        <h1 className="font-heading text-2xl font-bold text-foreground">プロフィール</h1>

        {/* 現在のプロジェクト */}
        {selectedIdea && (
          <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">現在のプロジェクト</p>
            <p className="text-lg font-bold text-foreground">{selectedIdea.title}</p>
            <p className="text-sm text-muted-foreground">{selectedIdea.description}</p>
          </div>
        )}

        {/* 回答の編集 */}
        {personality && (
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold text-foreground">あなたの回答</p>

            <div className="space-y-1">
              <label htmlFor="profile-time-usage" className="text-xs text-muted-foreground">一番時間を使っていること</label>
              <input
                id="profile-time-usage"
                value={personality.timeUsage}
                onChange={(e) => setPersonality({ ...personality, timeUsage: e.target.value })}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">MBTI</label>
              <div className="grid grid-cols-4 gap-2">
                {MBTI_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPersonality({ ...personality, mbti: type })}
                    className={`h-10 rounded-xl text-xs font-medium transition border ${
                      personality.mbti === type
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-muted border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {personality.mbti && (
                <p className="text-xs text-primary mt-1">
                  選択中: {personality.mbti}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="profile-local-pain" className="text-xs text-muted-foreground">地元・日常の不便</label>
              <textarea
                id="profile-local-pain"
                value={personality.localPain}
                onChange={(e) => setPersonality({ ...personality, localPain: e.target.value })}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none h-20"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full rounded-xl transition-colors ${
                saved
                  ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {saved ? '保存しました' : isSaving ? '保存中...' : '変更を保存する'}
            </Button>
          </div>
        )}

        {/* メンターの話し方 */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">メンターの話し方</p>
          <p className="text-xs text-muted-foreground">未設定だと、MBTIから自動で決まります。</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: null, label: '自動（診断から）' },
              { v: 'gentle' as const, label: 'やさしい' },
              { v: 'balanced' as const, label: 'バランス' },
              { v: 'strict' as const, label: 'ビシッと' },
            ] as const).map((opt) => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => handleToneChange(opt.v)}
                className={`text-sm py-2 rounded-lg border transition ${
                  toneOverride === opt.v
                    ? 'border-primary bg-accent/30 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* アイデアを探し直す */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">
            別のアイデアを探す
          </p>
          <p className="text-xs text-muted-foreground">
            メンターと話しながら、新しいアイデアを見つけられます。
          </p>
          <button
            onClick={() => router.push('/chat?mode=discover')}
            className="w-full h-10 bg-card border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition"
          >
            メンターとアイデアを探す
          </button>
        </div>

        {/* ログアウト */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-xs text-muted-foreground font-medium mb-3">設定</p>

          {/* テーマ切り替え */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-foreground flex items-center gap-2">
              {isDarkMode ? <Moon className="size-4" /> : <Sun className="size-4" />}
              {isDarkMode ? 'ダークモード' : 'ライトモード'}
            </span>
            <button
              onClick={() => handleToggleTheme(!isDarkMode)}
              role="switch"
              aria-checked={isDarkMode}
              aria-label="テーマ切り替え"
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                isDarkMode ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-flex size-5 items-center justify-center rounded-full bg-white shadow transition-transform ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              >
                {isDarkMode
                  ? <Moon className="size-3 text-primary" />
                  : <Sun className="size-3 text-amber-500" />}
              </span>
            </button>
          </div>

          <button
            onClick={() => setShowLogoutDialog(true)}
            className="w-full flex items-center justify-center gap-2 text-sm text-destructive border border-destructive/30 rounded-xl py-2.5 hover:bg-destructive/10 transition"
          >
            <LogOut className="size-4" />
            ログアウト
          </button>
        </div>

      </div>
      </div>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ログアウトしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              またいつでも戻ってこられます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2">
            <AlertDialogAction
              onClick={handleSignOut}
              className="w-full bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              ログアウト
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">キャンセル</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
