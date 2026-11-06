'use client'

import { useState } from 'react'
import { Copy } from 'lucide-react'

interface QuestHeaderProps {
  title: string
  estimatedMinutes: number
  difficulty: 1 | 2 | 3
  hiddenPrompt: string
}

export default function QuestHeader({ title, estimatedMinutes, difficulty, hiddenPrompt }: QuestHeaderProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hiddenPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-2">
      <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
          約{estimatedMinutes}分
        </span>
        <span className="flex items-center gap-0.5" aria-label={`難易度 ${difficulty}`}>
          {[1, 2, 3].map((dot) => (
            <span
              key={dot}
              className={`inline-block w-1.5 h-1.5 rounded-full ${dot <= difficulty ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            />
          ))}
        </span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Copy className="size-3" />
          {copied ? 'コピーしました' : 'Claude Codeへコピー'}
        </button>
      </div>
    </div>
  )
}
