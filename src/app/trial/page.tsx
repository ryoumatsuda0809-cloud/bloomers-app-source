'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TRIAL_SAMPLES } from '@/lib/trial-samples'
import { saveTrialProject } from '@/app/actions/onboarding'

export default function TrialPage() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStart = async () => {
    const sample = TRIAL_SAMPLES.find((s) => s.id === selectedId)
    if (!sample) return

    setIsLoading(true)
    setError(null)
    const result = await saveTrialProject(sample.ideaCard)
    if (result.error) {
      setError(result.error)
      setIsLoading(false)
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/onboarding')}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition text-muted-foreground"
            aria-label="戻る"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌸</span>
            <span className="text-lg font-bold text-foreground">サンプルで始める</span>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-xl font-bold text-foreground">
            サンプルを1つ選んでください
          </h1>
          <p className="text-muted-foreground text-sm">
            選んだアイデアで、本格的な開発をすぐに始められます。後から自分のアイデアを追加することもできます。
          </p>
        </div>

        <div className="space-y-3">
          {TRIAL_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => setSelectedId(sample.id)}
              className={`w-full h-auto py-4 px-5 border rounded-2xl transition text-left ${
                selectedId === sample.id
                  ? 'bg-primary/10 border-primary'
                  : 'bg-card border-border hover:border-primary hover:bg-muted'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{sample.emoji}</span>
                <div className="min-w-0">
                  <p className={`font-semibold text-sm ${selectedId === sample.id ? 'text-primary' : 'text-foreground'}`}>
                    {sample.ideaCard.title}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {sample.ideaCard.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          onClick={handleStart}
          disabled={!selectedId || isLoading}
          className="w-full h-12 bg-primary text-primary-foreground text-sm font-semibold rounded-2xl hover:bg-primary/90 transition disabled:opacity-50"
        >
          {isLoading ? '準備中...' : 'このアイデアで始める'}
        </button>

      </div>
    </div>
  )
}
