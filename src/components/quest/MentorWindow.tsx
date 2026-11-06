interface MentorWindowProps {
  message: string
}

export default function MentorWindow({ message }: MentorWindowProps) {
  return (
    <div className="bg-muted/40 rounded-xl p-4 border border-border space-y-2">
      <p className="text-xs text-muted-foreground">なぜこれが必要？</p>
      <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{message}</p>
      <span className="inline-block px-2.5 py-0.5 rounded-full bg-accent/30 text-accent-foreground text-xs">
        🛡 安全確認済み
      </span>
    </div>
  )
}
