'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

interface NextQuestPreviewProps {
  nextQuestId: string | null
  nextQuestTitle: string | null
  nextEstimatedMinutes: number | null
}

export default function NextQuestPreview({ nextQuestId, nextQuestTitle, nextEstimatedMinutes }: NextQuestPreviewProps) {
  const router = useRouter()

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        {nextQuestId && nextQuestTitle ? (
          <>
            <p className="text-sm text-muted-foreground">次のクエストが解放されました</p>
            <div className="bg-card border border-border rounded-xl p-6 space-y-3">
              <p className="text-lg font-semibold text-foreground">{nextQuestTitle}</p>
              {nextEstimatedMinutes && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                  約{nextEstimatedMinutes}分
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-center space-y-2">
            <p className="font-heading text-2xl font-bold text-foreground">全クエスト完了！</p>
            <p className="text-sm text-muted-foreground">ロードマップを完走しました。</p>
          </div>
        )}
        <button
          onClick={() => router.push('/')}
          className="w-full inline-flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
        >
          ダッシュボードに戻る <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
