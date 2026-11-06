'use client'

import { Dialog } from 'radix-ui'

interface StepConfirmDialogProps {
  isOpen: boolean
  doneCondition: string
  onYes: () => void
  onNotYet: () => void
}

export default function StepConfirmDialog({ isOpen, doneCondition, onYes, onNotYet }: StepConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <Dialog.Root open={true} onOpenChange={(open) => { if (!open) onNotYet() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-card rounded-2xl border border-border p-6 shadow-lg space-y-5 focus:outline-none">
          <div className="space-y-1">
            <Dialog.Title className="font-heading text-base font-semibold text-foreground whitespace-pre-line">
              {doneCondition}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              完了条件を満たしているか確認してください。
            </Dialog.Description>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onNotYet}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              まだ
            </button>
            <button
              onClick={onYes}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              はい、出てる
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
