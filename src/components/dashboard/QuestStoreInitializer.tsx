'use client'

import { useEffect } from 'react'
import { useQuestStore } from '@/store/useQuestStore'
import type { Quest } from '@/store/useQuestStore'

interface Props {
  quests: Quest[]
}

export default function QuestStoreInitializer({ quests }: Props) {
  useEffect(() => {
    useQuestStore.setState({ quests })
  }, [quests])

  return null
}
