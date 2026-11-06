"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Lock, RotateCcw, Sparkles, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { QuestStatus } from "@/store/useQuestStore";

interface QuestCardProps {
  id: string;
  title: string;
  description: string;
  status: QuestStatus;
  onComplete: (id: string) => Promise<void>;
  onStart?: (id: string) => Promise<void>;
  onSkip?: (id: string) => Promise<void>;
  onReopen?: (id: string) => Promise<void>;
  onGitHubSave?: () => Promise<void>;
  gitHubSaveStatus?: 'idle' | 'loading' | 'success' | 'error';
  gitHubRepoUrl?: string;
  href?: string;
}

const STATUS_CONFIG = {
  active: {
    bar: "bg-primary",
    badge: "bg-accent text-accent-foreground",
    badgeLabel: "進行中",
    icon: <Sparkles className="size-4 text-primary shrink-0" />,
    ring: "ring-2 ring-primary shadow-md",
  },
  in_progress: {
    bar: "bg-primary",
    badge: "bg-primary/20 text-primary",
    badgeLabel: "取り組み中",
    icon: <Sparkles className="size-4 text-primary shrink-0 animate-pulse" />,
    ring: "ring-2 ring-primary shadow-md",
  },
  completed: {
    bar: "bg-accent",
    badge: "bg-accent/50 text-accent-foreground",
    badgeLabel: "完了",
    icon: <CheckCircle2 className="size-4 text-primary shrink-0" />,
    ring: "opacity-70",
  },
  skipped: {
    bar: "bg-muted",
    badge: "bg-muted text-muted-foreground",
    badgeLabel: "スキップ済み",
    icon: <SkipForward className="size-4 text-muted-foreground shrink-0" />,
    ring: "opacity-60",
  },
  unlocked: {
    bar: "bg-accent/60",
    badge: "bg-accent/40 text-accent-foreground",
    badgeLabel: "解放済み",
    icon: <Circle className="size-4 text-primary/70 shrink-0" />,
    ring: "",
  },
  locked: {
    bar: "bg-muted",
    badge: "bg-muted text-muted-foreground",
    badgeLabel: "ロック中",
    icon: <Lock className="size-4 text-muted-foreground shrink-0" />,
    ring: "opacity-50",
  },
} as const;

export default function QuestCard({
  id,
  title,
  description,
  status,
  onComplete,
  onStart,
  onSkip,
  onReopen,
  onGitHubSave,
  gitHubSaveStatus = 'idle',
  gitHubRepoUrl = '',
  href,
}: QuestCardProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const config = STATUS_CONFIG[status];

  const withSubmit = async (fn: () => Promise<void>) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try { await fn(); } finally { setIsSubmitting(false); }
  };

  return (
    <Card
      className={`relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 ${config.ring}`}
    >
      {/* アクセントバー */}
      <div className={`h-1.5 w-full ${config.bar} shrink-0`} />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {config.icon}
            <CardTitle className="text-sm font-bold leading-snug truncate">
              {title}
            </CardTitle>
          </div>
          <Badge
            variant="secondary"
            className={`shrink-0 text-xs px-2 py-0.5 ${config.badge}`}
          >
            {config.badgeLabel}
          </Badge>
        </div>
        <CardDescription className="text-xs mt-1 leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>

      <CardFooter className="pt-0 flex flex-col gap-2">
        {/* active: 「クエストを進める」ボタン — onStart → in_progress 更新後に遷移 */}
        {status === 'active' && href && (
          <button
            onClick={() => withSubmit(async () => {
              if (onStart) await onStart(id);
              router.push(href);
            })}
            disabled={isSubmitting}
            className="w-full h-10 bg-card border border-primary/40 text-primary text-sm font-semibold rounded-xl hover:bg-accent/30 transition flex items-center justify-center disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                準備中...
              </span>
            ) : 'クエストを進める'}
          </button>
        )}

        {/* in_progress: 「つづきを進める」＋「完了する」＋「スキップする」 */}
        {status === 'in_progress' && (
          <div className="flex flex-col gap-2 w-full">
            {href && (
              <button
                onClick={() => router.push(href)}
                className="w-full h-10 bg-card border border-primary/40 text-primary text-sm font-semibold rounded-xl hover:bg-accent/30 transition flex items-center justify-center"
              >
                つづきを進める
              </button>
            )}
            {href && id === 'q5' && (
              <>
                {gitHubSaveStatus === 'idle' && (
                  <Button variant="outline" className="w-full" onClick={onGitHubSave}>
                    プロジェクトを保存する
                  </Button>
                )}
                {gitHubSaveStatus === 'loading' && (
                  <Button variant="outline" className="w-full" disabled>保存中...</Button>
                )}
                {gitHubSaveStatus === 'success' && (
                  <a href={gitHubRepoUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-primary underline text-center w-full">
                    保存完了！確認する
                  </a>
                )}
                {gitHubSaveStatus === 'error' && (
                  <p className="text-destructive text-sm text-center w-full">
                    保存に失敗しました。もう一度お試しください。
                  </p>
                )}
              </>
            )}
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-md h-10 text-sm font-semibold"
              disabled={isSubmitting}
              onClick={() => withSubmit(() => onComplete(id))}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  処理中...
                </span>
              ) : 'クエストを完了する'}
            </Button>
            <button
              onClick={() => withSubmit(async () => { if (onSkip) await onSkip(id); })}
              disabled={isSubmitting}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 transition disabled:opacity-50"
            >
              スキップする
            </button>
          </div>
        )}

        {/* completed: 完了済み表示 + 見直すリンク */}
        {status === 'completed' && (
          <div className="w-full flex items-center justify-between gap-2">
            <span className="flex-1 text-center text-xs bg-accent/30 text-accent-foreground px-2 py-2 rounded-md">
              完了済み ✓
            </span>
            {href && (
              <button
                onClick={() => router.push(`${href}?review=1`)}
                className="text-xs text-muted-foreground hover:text-primary transition underline shrink-0"
              >
                見直す
              </button>
            )}
          </div>
        )}

        {/* skipped: スキップ済みバッジ + 見直す + やり直しボタン */}
        {status === 'skipped' && (
          <div className="w-full flex items-center justify-between gap-2">
            <span className="flex-1 text-center text-xs bg-muted text-muted-foreground px-2 py-2 rounded-md">
              スキップ済み
            </span>
            {href && (
              <button
                onClick={() => router.push(`${href}?review=1`)}
                className="text-xs text-muted-foreground hover:text-primary transition underline shrink-0"
              >
                見直す
              </button>
            )}
            <button
              onClick={() => withSubmit(async () => { if (onReopen) await onReopen(id) })}
              disabled={isSubmitting}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary transition disabled:opacity-50 shrink-0"
            >
              <RotateCcw className="size-3.5" />
              やり直す
            </button>
          </div>
        )}

        {/* unlocked: まだロック解除済みだが未着手（クリック不可） */}
        {status === 'unlocked' && (
          <span className="w-full text-center text-xs bg-accent/20 text-muted-foreground px-2 py-2 rounded-md">
            前のクエストを完了すると開始できます
          </span>
        )}

        {/* locked */}
        {status === 'locked' && (
          <span className="w-full text-center text-xs bg-muted text-muted-foreground px-2 py-2 rounded-md">
            ロック中
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
