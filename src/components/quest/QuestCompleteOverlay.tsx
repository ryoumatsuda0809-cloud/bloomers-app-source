'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface QuestCompleteOverlayProps {
  questTitle: string
  onNext: () => void
}

export default function QuestCompleteOverlay({ questTitle, onNext }: QuestCompleteOverlayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className={`fixed inset-0 bg-background z-50 flex flex-col items-center justify-center px-6 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        <CheckCircle2 className="size-12 text-primary" />
        <div className="space-y-2">
          <h2 className="font-heading text-2xl font-bold text-foreground">クエスト完了</h2>
          <p className="text-muted-foreground text-sm">{questTitle}</p>
        </div>
        <button
          onClick={onNext}
          className="px-8 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
        >
          次へ進む
        </button>
      </div>
    </div>
  )
}
