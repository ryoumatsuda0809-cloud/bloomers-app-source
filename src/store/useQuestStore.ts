import { create } from 'zustand'

export type QuestStatus = 'locked' | 'unlocked' | 'active' | 'in_progress' | 'completed' | 'skipped'

export interface Quest {
  id: string
  title: string
  description: string
  order: number
  status: QuestStatus
  dependsOn: string[]
}

interface QuestState {
  quests: Quest[]
  setQuests: (quests: Quest[]) => void
  startQuest: (id: string) => void
  completeQuest: (id: string) => void
  skipQuest: (id: string) => void
  reopenQuest: (id: string) => void
  resetStore: () => void
}

export const useQuestStore = create<QuestState>()((set) => ({
  quests: [],

  setQuests: (quests) => set({ quests }),

  startQuest: (id) =>
    set((state) => ({
      quests: state.quests.map((q) =>
        q.id === id && (q.status === 'active' || q.status === 'unlocked')
          ? { ...q, status: 'in_progress' as QuestStatus }
          : q
      ),
    })),

  completeQuest: (id: string) => {
    set((state) => {
      const updatedQuests = state.quests.map((q) =>
        q.id === id ? { ...q, status: 'completed' as QuestStatus } : q
      )
      const clearedIds = updatedQuests
        .filter((q) => q.status === 'completed' || q.status === 'skipped')
        .map((q) => q.id)

      let nextActiveAssigned = false
      const finalQuests = [...updatedQuests]
        .sort((a, b) => a.order - b.order)
        .map((q) => {
          if (q.status === 'completed' || q.status === 'skipped') return q
          const isUnlocked = q.dependsOn.every((depId) => clearedIds.includes(depId))
          if (!isUnlocked) return { ...q, status: 'locked' as QuestStatus }
          if (!nextActiveAssigned) {
            nextActiveAssigned = true
            return { ...q, status: 'active' as QuestStatus }
          }
          return { ...q, status: 'unlocked' as QuestStatus }
        })

      return { quests: finalQuests }
    })
  },

  skipQuest: (id) => {
    set((state) => {
      const updatedQuests = state.quests.map((q) =>
        q.id === id ? { ...q, status: 'skipped' as QuestStatus } : q
      )
      const clearedIds = new Set(
        updatedQuests
          .filter((q) => q.status === 'completed' || q.status === 'skipped')
          .map((q) => q.id)
      )

      let nextAssigned = false
      return {
        quests: updatedQuests.map((q) => {
          if (q.status === 'completed' || q.status === 'skipped' || q.status === 'in_progress') return q
          const isUnlocked = q.dependsOn.every((dep) => clearedIds.has(dep))
          if (!isUnlocked) return { ...q, status: 'locked' as QuestStatus }
          if (!nextAssigned) { nextAssigned = true; return { ...q, status: 'active' as QuestStatus } }
          return { ...q, status: 'unlocked' as QuestStatus }
        }),
      }
    })
  },

  reopenQuest: (id) =>
    set((state) => {
      const clearedIds = new Set(
        state.quests
          .filter((q) => q.id !== id && (q.status === 'completed' || q.status === 'skipped'))
          .map((q) => q.id)
      )
      const hasActiveElsewhere = state.quests.some(
        (q) => q.id !== id && (q.status === 'active' || q.status === 'in_progress')
      )
      return {
        quests: state.quests.map((q) => {
          if (q.id !== id) return q
          const isUnlocked = q.dependsOn.every((dep) => clearedIds.has(dep))
          if (!isUnlocked) return { ...q, status: 'locked' as QuestStatus }
          return { ...q, status: (hasActiveElsewhere ? 'unlocked' : 'active') as QuestStatus }
        }),
      }
    }),

  resetStore: () => set({ quests: [] }),
}))
