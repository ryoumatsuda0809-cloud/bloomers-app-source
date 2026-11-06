'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Sprout, Pin, PinOff, Folder, Pencil, Trash2, MoreVertical } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getProjectIdeas, setActiveProject, deleteProjectIdea, pinProjectIdea, pauseProject, renameProjectIdea } from '@/app/actions/projects'
import type { ProjectIdea } from '@/app/actions/projects'
import { Skeleton } from '@/components/ui/skeleton'
import AppShell from '@/components/layout/AppShell'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectIdea[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showNewIdeaDialog, setShowNewIdeaDialog] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)

  const activeProject = projects.find((p) => p.isActive)

  useEffect(() => {
    getProjectIdeas().then((data) => {
      setProjects(data)
      setIsLoading(false)
    })
  }, [])

  const handleDelete = async () => {
    if (!deleteTargetId) return
    const id = deleteTargetId
    setDeleteTargetId(null)
    await deleteProjectIdea(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  const handleOpenProject = async (id: string) => {
    await setActiveProject(id)
    router.push('/')
  }

  const startRename = (p: ProjectIdea) => {
    setRenameValue(p.title)
    setRenamingId(p.id)
    setOpenMenuId(null)
    setRenameError(null)
  }

  const handleRename = async (id: string) => {
    const newTitle = renameValue.trim()
    const original = projects.find((p) => p.id === id)?.title ?? ''
    if (!newTitle || newTitle === original) { setRenamingId(null); return }
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, title: newTitle } : p))
    setRenamingId(null)
    const res = await renameProjectIdea(id, newTitle)
    if (res.error) {
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, title: original } : p))
      setRenameError(res.error)
    }
  }

  const handleTogglePin = async (p: ProjectIdea) => {
    const next = !p.isPinned
    setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, isPinned: next } : x))
    setOpenMenuId(null)
    const res = await pinProjectIdea(p.id, next)
    if (res?.error) {
      setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, isPinned: !next } : x))
    }
  }

  const pinnedProjects = projects.filter((p) => p.isPinned)
  const otherProjects = projects.filter((p) => !p.isPinned)

  if (isLoading) {
    return (
      <AppShell showRoadmap={false}>
        <div className="px-4 py-8">
          <div className="max-w-lg mx-auto space-y-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-48" />
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell showRoadmap={false}>
      <div className="px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition text-sm"
          >
            <ArrowLeft className="size-4" /> ダッシュボードに戻る
          </button>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-foreground">マイプロジェクト</h1>
          <button
            onClick={() => {
              if (activeProject) {
                setShowNewIdeaDialog(true)
              } else {
                router.push('/onboarding')
              }
            }}
            className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-full hover:bg-primary/90 transition"
          >
            ＋ 新しいアイデア
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-3">
            <p className="text-3xl"><Sprout className="size-10 text-muted-foreground" /></p>
            <p className="text-foreground font-medium">まだプロジェクトがありません</p>
            <p className="text-muted-foreground text-sm">
              メンターと話してアイデアを見つけよう
            </p>
            <button
              onClick={() => router.push('/onboarding')}
              className="mt-2 text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              アイデアを見つける <ArrowRight className="size-4" />
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-5 space-y-1">
            {renameError && (
              <p className="text-xs text-destructive px-1 pb-1">{renameError}</p>
            )}
            {pinnedProjects.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground px-1 pt-1 pb-1">ピン留め</p>
                {pinnedProjects.map((p) => (
                  <div
                    key={p.id}
                    onContextMenu={(e) => { e.preventDefault(); setOpenMenuId(openMenuId === p.id ? null : p.id) }}
                    className="group relative flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 cursor-pointer transition"
                  >
                    {renamingId === p.id ? (
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(p.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={() => handleRename(p.id)}
                        autoFocus
                        className="flex-1 text-sm bg-background border border-primary rounded px-2 py-1 text-foreground focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => handleOpenProject(p.id)}>
                          <Folder className="size-4 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground truncate flex-1">{p.title}</span>
                          {p.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground shrink-0">アクティブ</span>
                          )}
                          {p.status === 'paused' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">途中</span>
                          )}
                          {p.status === 'completed' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/40 text-accent-foreground shrink-0">完了</span>
                          )}
                          <Pin className="size-3 text-muted-foreground shrink-0" />
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition shrink-0"
                          aria-label="メニュー"
                        >
                          <MoreVertical className="size-4 text-muted-foreground" />
                        </button>
                      </>
                    )}
                    {openMenuId === p.id && renamingId !== p.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null) }} />
                        <div className="absolute right-2 top-full mt-1 z-50 w-44 bg-card border border-border rounded-lg shadow-lg py-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); startRename(p) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted text-left"
                          >
                            <Pencil className="size-3.5" /> 名前を変更
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleTogglePin(p) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted text-left"
                          >
                            <PinOff className="size-3.5" /> ピンを外す
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setDeleteTargetId(p.id) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-muted text-left"
                          >
                            <Trash2 className="size-3.5" /> 削除
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
            {otherProjects.length > 0 && (
              <>
                {pinnedProjects.length > 0 && (
                  <p className="text-xs font-semibold text-muted-foreground px-1 pt-2 pb-1">その他</p>
                )}
                {otherProjects.map((p) => (
                  <div
                    key={p.id}
                    onContextMenu={(e) => { e.preventDefault(); setOpenMenuId(openMenuId === p.id ? null : p.id) }}
                    className="group relative flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 cursor-pointer transition"
                  >
                    {renamingId === p.id ? (
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(p.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={() => handleRename(p.id)}
                        autoFocus
                        className="flex-1 text-sm bg-background border border-primary rounded px-2 py-1 text-foreground focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => handleOpenProject(p.id)}>
                          <Folder className="size-4 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground truncate flex-1">{p.title}</span>
                          {p.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground shrink-0">アクティブ</span>
                          )}
                          {p.status === 'paused' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">途中</span>
                          )}
                          {p.status === 'completed' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/40 text-accent-foreground shrink-0">完了</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition shrink-0"
                          aria-label="メニュー"
                        >
                          <MoreVertical className="size-4 text-muted-foreground" />
                        </button>
                      </>
                    )}
                    {openMenuId === p.id && renamingId !== p.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null) }} />
                        <div className="absolute right-2 top-full mt-1 z-50 w-44 bg-card border border-border rounded-lg shadow-lg py-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); startRename(p) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted text-left"
                          >
                            <Pencil className="size-3.5" /> 名前を変更
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleTogglePin(p) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted text-left"
                          >
                            <Pin className="size-3.5" /> ピン留め
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setDeleteTargetId(p.id) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-muted text-left"
                          >
                            <Trash2 className="size-3.5" /> 削除
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

      </div>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => { if (!open) setDeleteTargetId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>このプロジェクト案を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{projects.find((p) => p.id === deleteTargetId)?.title}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2">
            <AlertDialogAction
              onClick={handleDelete}
              className="w-full bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              削除する
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">キャンセル</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showNewIdeaDialog} onOpenChange={setShowNewIdeaDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              現在進行中のプロジェクトはどうしますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              「{activeProject?.title}」が進行中です。
              新しいアイデアを始める前に、現在の進捗を保存するか選んでください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2">
            <AlertDialogAction
              onClick={async () => {
                if (activeProject) {
                  await pauseProject(activeProject.id)
                }
                router.refresh()
                router.push('/onboarding')
              }}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              途中として保存して新しく始める
            </AlertDialogAction>
            <AlertDialogAction
              onClick={async () => {
                if (activeProject) {
                  await deleteProjectIdea(activeProject.id)
                }
                router.refresh()
                router.push('/onboarding')
              }}
              className="w-full bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              削除して新しく始める
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">
              キャンセル
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </AppShell>
  )
}
