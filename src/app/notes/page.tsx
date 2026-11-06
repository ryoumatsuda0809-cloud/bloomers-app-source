'use client'

import { useState, useEffect, useRef } from 'react'
import { getProjectIdeas, saveQuestNote } from '@/app/actions/projects'
import type { ProjectIdea } from '@/app/actions/projects'
import { addUserKnowledge, listUserKnowledge, deleteUserKnowledge, updateUserKnowledgeScope } from '@/app/actions/user-knowledge'
import type { UserKnowledgeItem, KnowledgeScope } from '@/app/actions/user-knowledge'
import { getCustomMentors } from '@/app/actions/custom-mentors'
import type { CustomMentor } from '@/app/actions/custom-mentors'
import AppShell from '@/components/layout/AppShell'
import { QUEST_CONFIG } from '@/lib/quest-utils'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight, NotebookPen, Paperclip, Trash2, Plus, Pencil, X } from 'lucide-react'

const QUEST_ORDER = ['q1', 'q2', 'q3', 'q4', 'q5'] as const

function getOrderedNotes(notes: Record<string, string>): { questId: string; title: string; note: string }[] {
  return QUEST_ORDER
    .filter((qid) => notes?.[qid]?.trim())
    .map((qid) => ({
      questId: qid,
      title: QUEST_CONFIG[qid]?.title ?? qid,
      note: notes[qid],
    }))
}

const noteKey = (projectId: string, questId: string) => `${projectId}:${questId}`

const SCOPE_LABEL: Record<KnowledgeScope, string> = {
  global: '全体',
  project: 'プロジェクト',
  mentor: 'メンター',
}

type PendingFile = { mimeType: string; base64: string; name: string }

type ScopeFormState = {
  scope: KnowledgeScope
  mentorId: string
}

function ScopeSelector({
  value,
  onChange,
  activeProject,
  customMentors,
}: {
  value: ScopeFormState
  onChange: (v: ScopeFormState) => void
  activeProject: ProjectIdea | null
  customMentors: CustomMentor[]
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* このプロジェクトだけ */}
      <label className="block border border-border rounded-xl p-3 cursor-pointer hover:border-primary transition-colors">
        <div className="flex items-center gap-2">
          <input
            type="radio"
            checked={value.scope === 'project'}
            onChange={() => onChange({ ...value, scope: 'project' })}
            className="accent-primary"
          />
          <span className="text-sm font-medium text-foreground">このプロジェクトだけ</span>
          {activeProject && (
            <span className="text-xs text-muted-foreground truncate">（{activeProject.title}）</span>
          )}
        </div>
        <div className="mt-1 ml-6 space-y-0.5">
          <p className="text-xs text-foreground">◎ そのアプリの相談に集中できて、回答が正確</p>
          <p className="text-xs text-muted-foreground">△ 他のプロジェクトでは使われません</p>
          <p className="text-xs text-muted-foreground">例：このアプリの要件・仕様書</p>
        </div>
      </label>

      {/* このメンターだけ */}
      <label className="block border border-border rounded-xl p-3 cursor-pointer hover:border-primary transition-colors">
        <div className="flex items-center gap-2">
          <input
            type="radio"
            checked={value.scope === 'mentor'}
            onChange={() => onChange({ ...value, scope: 'mentor' })}
            className="accent-primary"
          />
          <span className="text-sm font-medium text-foreground">このメンターだけ</span>
        </div>
        <div className="mt-1 ml-6 space-y-0.5">
          <p className="text-xs text-foreground">◎ 専門メンターの精度が一番上がる</p>
          <p className="text-xs text-muted-foreground">△ そのメンター以外では使われません</p>
          <p className="text-xs text-muted-foreground">例：マーケの資料 →「マーケ先生」専用</p>
        </div>
        {value.scope === 'mentor' && (
          <div className="mt-2 ml-6">
            {customMentors.length === 0 ? (
              <p className="text-xs text-muted-foreground">カスタムメンターがいません。先に作成してください。</p>
            ) : (
              <select
                value={value.mentorId}
                onChange={(e) => onChange({ ...value, mentorId: e.target.value })}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground"
              >
                <option value="">メンターを選択...</option>
                {customMentors.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </label>

      {/* 全体で使う */}
      <label className="block border border-border rounded-xl p-3 cursor-pointer hover:border-primary transition-colors">
        <div className="flex items-center gap-2">
          <input
            type="radio"
            checked={value.scope === 'global'}
            onChange={() => onChange({ ...value, scope: 'global' })}
            className="accent-primary"
          />
          <span className="text-sm font-medium text-foreground">全体で使う</span>
        </div>
        <div className="mt-1 ml-6 space-y-0.5">
          <p className="text-xs text-foreground">◎ どのメンターでも見てくれて便利</p>
          <p className="text-xs text-muted-foreground">△ 関係ない相談のときも出てくることがあります</p>
          <p className="text-xs text-muted-foreground">例：自分の開発メモ、よく使う技術</p>
        </div>
      </label>
    </div>
  )
}

export default function NotesPage() {
  const [projects, setProjects] = useState<ProjectIdea[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [noteValues, setNoteValues] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({})
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const [knowledgeItems, setKnowledgeItems] = useState<UserKnowledgeItem[]>([])
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // スコープ選択UI用state
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [scopeForm, setScopeForm] = useState<ScopeFormState>({ scope: 'project', mentorId: '' })
  const [customMentors, setCustomMentors] = useState<CustomMentor[]>([])

  // 後変更UI用state
  const [changingScopeFor, setChangingScopeFor] = useState<string | null>(null)
  const [changeScopeForm, setChangeScopeForm] = useState<ScopeFormState>({ scope: 'project', mentorId: '' })
  const [changeScopeStatus, setChangeScopeStatus] = useState<'idle' | 'saving'>('idle')

  useEffect(() => {
    getProjectIdeas()
      .then((data) => {
        setProjects(data)
        const initial: Record<string, string> = {}
        data.forEach((p) => {
          Object.entries(p.questNotes ?? {}).forEach(([qid, text]) => {
            initial[noteKey(p.id, qid)] = text
          })
        })
        setNoteValues(initial)
      })
      .catch(() => setProjects([]))
      .finally(() => setIsLoading(false))

    listUserKnowledge().then(setKnowledgeItems).catch(() => {})
    getCustomMentors().then(setCustomMentors).catch(() => {})
  }, [])

  const activeProject = projects.find((p) => p.isActive) ?? null

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleNoteChange = (projectId: string, questId: string, value: string) => {
    const key = noteKey(projectId, questId)
    setNoteValues((prev) => ({ ...prev, [key]: value }))
    setSaveStatus((prev) => ({ ...prev, [key]: 'saving' }))

    if (timersRef.current[key]) clearTimeout(timersRef.current[key])
    timersRef.current[key] = setTimeout(async () => {
      const { error } = await saveQuestNote(projectId, questId, value)
      setSaveStatus((prev) => ({ ...prev, [key]: error ? 'idle' : 'saved' }))
      if (!error) {
        setTimeout(() => {
          setSaveStatus((prev) => ({ ...prev, [key]: 'idle' }))
        }, 2000)
      }
    }, 800)
  }

  // ファイル選択 → pendingFileにセットしてスコープ選択UIを表示
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 7 * 1024 * 1024) {
      setUploadStatus('error')
      setUploadMessage('ファイルサイズが7MBを超えています。')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const allowed = ['image/png', 'image/jpeg', 'application/pdf', 'text/plain', 'text/markdown']
    let mimeType = file.type
    if (file.name.endsWith('.md')) mimeType = 'text/markdown'
    if (file.name.endsWith('.txt')) mimeType = 'text/plain'
    if (!allowed.includes(mimeType)) {
      setUploadStatus('error')
      setUploadMessage('対応形式は png / jpg / pdf / txt / md です。')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] ?? '')
        }
        reader.onerror = () => reject(new Error('読み込み失敗'))
        reader.readAsDataURL(file)
      })

      setPendingFile({ mimeType, base64, name: file.name })
      setScopeForm({ scope: 'project', mentorId: '' })
      setUploadStatus('idle')
      setUploadMessage('')
    } catch {
      setUploadStatus('error')
      setUploadMessage('ファイルの読み込みに失敗しました。')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConfirmUpload = async () => {
    if (!pendingFile) return

    let scopeTargetId: string | null = null
    if (scopeForm.scope === 'project') {
      if (!activeProject) {
        setUploadStatus('error')
        setUploadMessage('進行中のプロジェクトがありません。「全体で使う」を選んでください。')
        return
      }
      scopeTargetId = activeProject.id
    }
    if (scopeForm.scope === 'mentor') {
      if (!scopeForm.mentorId) {
        setUploadStatus('error')
        setUploadMessage('メンターを選んでください。')
        return
      }
      scopeTargetId = scopeForm.mentorId
    }

    setUploadStatus('uploading')
    setUploadMessage('資料を読み込んでいます...')

    try {
      const result = await addUserKnowledge(
        pendingFile.mimeType,
        pendingFile.base64,
        pendingFile.name,
        scopeForm.scope,
        scopeTargetId
      )
      if (result.error) {
        setUploadStatus('error')
        setUploadMessage(result.error)
      } else {
        setUploadStatus('done')
        setUploadMessage(`資料を追加しました（${result.chunkCount}件のチャンク）`)
        const items = await listUserKnowledge()
        setKnowledgeItems(items)
        setPendingFile(null)
        setTimeout(() => { setUploadStatus('idle'); setUploadMessage('') }, 3000)
      }
    } catch {
      setUploadStatus('error')
      setUploadMessage('資料の追加に失敗しました。')
    }
  }

  const handleDeleteKnowledge = async (source: string) => {
    const result = await deleteUserKnowledge(source)
    if (!result.error) {
      setKnowledgeItems((prev) => prev.filter((k) => k.source !== source))
    }
  }

  const handleStartScopeChange = (item: UserKnowledgeItem) => {
    setChangingScopeFor(item.source)
    setChangeScopeForm({
      scope: item.scope,
      mentorId: item.scope === 'mentor' ? (item.scopeTargetId ?? '') : '',
    })
    setChangeScopeStatus('idle')
  }

  const handleConfirmScopeChange = async () => {
    if (!changingScopeFor) return

    let scopeTargetId: string | null = null
    if (changeScopeForm.scope === 'project') {
      if (!activeProject) {
        setChangeScopeStatus('idle')
        return
      }
      scopeTargetId = activeProject.id
    }
    if (changeScopeForm.scope === 'mentor') {
      if (!changeScopeForm.mentorId) return
      scopeTargetId = changeScopeForm.mentorId
    }

    setChangeScopeStatus('saving')
    const result = await updateUserKnowledgeScope(changingScopeFor, changeScopeForm.scope, scopeTargetId)
    if (!result.error) {
      const items = await listUserKnowledge()
      setKnowledgeItems(items)
      setChangingScopeFor(null)
    }
    setChangeScopeStatus('idle')
  }

  const activeProjects = projects.filter((p) => p.status === 'active')
  const pastProjects = projects.filter((p) => p.status === 'paused' || p.status === 'completed')
  const hasAnyNote = projects.some((p) => getOrderedNotes(p.questNotes).length > 0)

  if (isLoading) {
    return (
      <AppShell showRoadmap={false}>
        <div className="px-4 py-8">
          <div className="max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell showRoadmap={false}>
      <div className="px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">

          <div className="flex items-center gap-2">
            <NotebookPen className="size-6 text-foreground" />
            <h1 className="text-2xl font-bold text-foreground">メモ</h1>
          </div>

          {/* 資料管理セクション */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="size-4 text-foreground" />
                <h2 className="text-sm font-semibold text-foreground">メンターに参照させる資料</h2>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus === 'uploading' || pendingFile !== null}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                資料を追加
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,application/pdf,text/plain,text/markdown,.md,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* スコープ選択UI（pendingFileがある時に表示） */}
            {pendingFile && (
              <div className="border border-border rounded-xl p-4 space-y-3 bg-background">
                <div>
                  <p className="text-sm font-semibold text-foreground">この資料をどこで使いますか？</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{pendingFile.name}</p>
                </div>
                <ScopeSelector
                  value={scopeForm}
                  onChange={setScopeForm}
                  activeProject={activeProject}
                  customMentors={customMentors}
                />
                {uploadMessage && (
                  <p className={`text-xs ${uploadStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {uploadMessage}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmUpload}
                    disabled={uploadStatus === 'uploading'}
                    className="flex-1 text-sm py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
                  >
                    {uploadStatus === 'uploading' ? '追加中...' : 'この設定で追加'}
                  </button>
                  <button
                    onClick={() => { setPendingFile(null); setUploadStatus('idle'); setUploadMessage('') }}
                    className="px-4 text-sm py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {uploadMessage && !pendingFile && (
              <p className={`text-xs ${uploadStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {uploadMessage}
              </p>
            )}

            {knowledgeItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                まだ資料がありません。PDF・画像・テキストを追加すると、メンターが回答時に参照します。
              </p>
            ) : (
              <div className="space-y-1.5">
                {knowledgeItems.map((item) => (
                  <div key={item.source}>
                    <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{item.source}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString('ja-JP')}・{item.chunkCount}件
                          </p>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {SCOPE_LABEL[item.scope]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => handleStartScopeChange(item)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
                          aria-label="スコープ変更"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteKnowledge(item.source)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                          aria-label="削除"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* スコープ後変更UI */}
                    {changingScopeFor === item.source && (
                      <div className="border border-border rounded-xl p-4 space-y-3 bg-background mt-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">スコープを変更</p>
                          <button
                            onClick={() => setChangingScopeFor(null)}
                            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        <ScopeSelector
                          value={changeScopeForm}
                          onChange={setChangeScopeForm}
                          activeProject={activeProject}
                          customMentors={customMentors}
                        />
                        <button
                          onClick={handleConfirmScopeChange}
                          disabled={changeScopeStatus === 'saving'}
                          className="w-full text-sm py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
                        >
                          {changeScopeStatus === 'saving' ? '変更中...' : '変更を保存'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 空状態 */}
          {!hasAnyNote && (
            <div className="bg-card rounded-2xl border border-border p-8 text-center">
              <p className="text-sm text-muted-foreground leading-relaxed">
                まだメモがありません。<br />
                クエストを進めながら、気づいたことを書き残していきましょう。
              </p>
            </div>
          )}

          {/* 進行中（メイン大表示） */}
          {activeProjects.map((project) => {
            const notes = getOrderedNotes(project.questNotes)
            if (notes.length === 0) return null
            return (
              <div key={project.id} className="bg-card rounded-2xl border border-border p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">進行中</span>
                  <h2 className="text-lg font-bold text-foreground">{project.title}</h2>
                </div>
                <div className="space-y-3">
                  {notes.map((n) => {
                    const key = noteKey(project.id, n.questId)
                    const status = saveStatus[key] ?? 'idle'
                    return (
                      <div key={n.questId} className="border-l-2 border-primary/30 pl-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-foreground">{n.title}</p>
                          <span className="text-xs text-muted-foreground">
                            {status === 'saving' && '保存中...'}
                            {status === 'saved' && '保存しました'}
                          </span>
                        </div>
                        <textarea
                          value={noteValues[key] ?? n.note}
                          onChange={(e) => handleNoteChange(project.id, n.questId, e.target.value)}
                          rows={3}
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-y focus:outline-none focus:border-primary bg-background"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* 過去のプロジェクト（折りたたみ） */}
          {pastProjects.some((p) => getOrderedNotes(p.questNotes).length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground px-1">過去のプロジェクト</p>
              {pastProjects.map((project) => {
                const notes = getOrderedNotes(project.questNotes)
                if (notes.length === 0) return null
                const expanded = expandedIds.has(project.id)
                return (
                  <div key={project.id} className="bg-card rounded-xl border border-border overflow-hidden">
                    <button
                      onClick={() => toggleExpand(project.id)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted transition"
                    >
                      <ChevronRight className={`size-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                      <span className="text-sm font-medium text-foreground flex-1">{project.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {project.status === 'completed' ? '完了' : '途中'}
                      </span>
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
                        {notes.map((n) => {
                          const key = noteKey(project.id, n.questId)
                          const status = saveStatus[key] ?? 'idle'
                          return (
                            <div key={n.questId} className="border-l-2 border-border pl-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium text-foreground">{n.title}</p>
                                <span className="text-xs text-muted-foreground">
                                  {status === 'saving' && '保存中...'}
                                  {status === 'saved' && '保存しました'}
                                </span>
                              </div>
                              <textarea
                                value={noteValues[key] ?? n.note}
                                onChange={(e) => handleNoteChange(project.id, n.questId, e.target.value)}
                                rows={3}
                                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-y focus:outline-none focus:border-primary bg-background"
                              />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </AppShell>
  )
}
