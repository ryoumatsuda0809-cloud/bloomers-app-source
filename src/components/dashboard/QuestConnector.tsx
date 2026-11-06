'use client'

import { ChevronDown } from 'lucide-react'
import type { QuestStatus } from '@/store/useQuestStore'

interface QuestConnectorProps {
  fromStatus: QuestStatus
}

const CONNECTOR_CONFIG: Record<
  QuestStatus,
  { line: string; arrow: string; dashed: boolean }
> = {
  completed: {
    line: 'border-primary',
    arrow: 'text-primary',
    dashed: false,
  },
  active: {
    line: 'border-primary',
    arrow: 'text-primary',
    dashed: true,
  },
  in_progress: {
    line: 'border-primary',
    arrow: 'text-primary',
    dashed: true,
  },
  skipped: {
    line: 'border-border',
    arrow: 'text-muted-foreground',
    dashed: true,
  },
  unlocked: {
    line: 'border-accent',
    arrow: 'text-accent-foreground',
    dashed: true,
  },
  locked: {
    line: 'border-border',
    arrow: 'text-muted-foreground',
    dashed: true,
  },
}

export default function QuestConnector({ fromStatus }: QuestConnectorProps) {
  const { line, arrow, dashed } = CONNECTOR_CONFIG[fromStatus]
  const isActive = fromStatus === 'active'

  return (
    <div className="flex flex-col items-center py-1">
      <div
        className={`w-0 h-6 border-l-2 ${line} ${dashed ? 'border-dashed' : ''} ${isActive ? 'animate-pulse' : ''}`}
      />
      <ChevronDown
        className={`size-4 -mt-1 ${arrow} ${isActive ? 'animate-pulse' : ''}`}
        strokeWidth={2.5}
      />
    </div>
  )
}
