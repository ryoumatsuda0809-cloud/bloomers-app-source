'use client'

import { useState, useEffect } from 'react'
import type { SetupStep } from '@/app/actions/setup'

interface ThinkingStepProps {
  step: SetupStep
  questId: string
  onComplete: (stepId: string, answer: string) => void
}

const BLOCK_LIST = ['テスト', 'test', 'あああ', 'aaa', 'てすと']

export default function ThinkingStep({ step, questId, onComplete }: ThinkingStepProps) {
  const storageKey = `bloomer_answer_${questId}_${step.id}`
  const [answer, setAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      setAnswer(saved)
      setHasPrevious(true)
    }
  }, [storageKey])

  const isValid =
    answer.trim().length >= 3 &&
    !BLOCK_LIST.some((w) => answer.toLowerCase().includes(w.toLowerCase()))

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return
    setIsSubmitting(true)
    localStorage.setItem(storageKey, answer.trim())
    onComplete(step.id, answer.trim())
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground leading-relaxed font-medium">
        {step.question}
      </p>

      <textarea
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value)
          setHasPrevious(false)
        }}
        placeholder={step.placeholder ?? 'あなたの考えを書いてください...'}
        rows={3}
        className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:border-primary bg-background"
      />

      <p className="text-xs text-muted-foreground">
        {answer.trim().length < 3
          ? `あと${3 - answer.trim().length}文字以上入力してください`
          : '✓ 入力完了'}
      </p>

      <button
        onClick={handleSubmit}
        disabled={!isValid || isSubmitting}
        className="w-full h-10 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting
          ? '保存中...'
          : hasPrevious
          ? '変更して次へ'
          : '保存して次へ'}
      </button>
    </div>
  )
}
