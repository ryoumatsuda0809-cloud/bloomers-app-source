'use client'

import { useState, useEffect } from 'react'
import { Dialog } from 'radix-ui'

interface DecisionDialogProps {
  questId: string
  question: string
  isOpen: boolean
  onComplete: () => void
}

const INVALID_PATTERNS = ['テスト', 'あああ', 'test', 'aaa']

export default function DecisionDialog({ questId, question, isOpen, onComplete }: DecisionDialogProps) {
  const [answer, setAnswer] = useState('')
  const [savedAnswer, setSavedAnswer] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const stored = localStorage.getItem(`bloomer_decision_${questId}`)
    setSavedAnswer(stored)
    setChecked(true)
    if (stored !== null) {
      onComplete()
    }
  }, [isOpen, questId, onComplete])

  const handleSave = (value: string) => {
    localStorage.setItem(`bloomer_decision_${questId}`, value)
    onComplete()
  }

  const isValidAnswer =
    answer.trim().length >= 3 &&
    !INVALID_PATTERNS.some((p) => answer.includes(p))

  if (!isOpen || !checked || savedAnswer !== null) return null

  return (
    <Dialog.Root open={true} onOpenChange={(open) => { if (!open) handleSave('') }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-card rounded-2xl border border-border p-6 shadow-lg space-y-5 focus:outline-none">
          <div className="space-y-1">
            <Dialog.Title className="font-heading text-base font-semibold text-foreground whitespace-pre-line">
              {question}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              あなたの考えを教えてください。スキップすることもできます。
            </Dialog.Description>
          </div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            placeholder="ひと言でも大丈夫です"
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => handleSave('')}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              このままでいい
            </button>
            <button
              onClick={() => handleSave(answer.trim())}
              disabled={!isValidAnswer}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              次のクエストへ
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
