'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Pencil, Trash2, Bot, Check, X } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  getCustomMentors,
  createCustomMentor,
  updateCustomMentor,
  deleteCustomMentor,
  type CustomMentor,
} from '@/app/actions/custom-mentors'
import { listUserKnowledge, type UserKnowledgeItem } from '@/app/actions/user-knowledge'

type FormState = {
  name: string
  systemPrompt: string
  linkedKnowledgeIds: string[]
}

const EMPTY_FORM: FormState = { name: '', systemPrompt: '', linkedKnowledgeIds: [] }

export default function CustomMentorPage() {
  const router = useRouter()
  const [mentors, setMentors] = useState<CustomMentor[]>([])
  const [knowledgeItems, setKnowledgeItems] = useState<UserKnowledgeItem[]>([])
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<CustomMentor | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    getCustomMentors().then(setMentors).catch(() => {})
    listUserKnowledge().then(setKnowledgeItems).catch(() => {})
  }, [])

  const openNew = () => {
    setForm(EMPTY_FORM)
    setFormError(null)
    setEditingId('new')
  }

  const openEdit = (mentor: CustomMentor) => {
    setForm({
      name: mentor.name,
      systemPrompt: mentor.systemPrompt,
      linkedKnowledgeIds: mentor.linkedKnowledgeIds,
    })
    setFormError(null)
    setEditingId(mentor.id)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  const toggleKnowledge = (source: string) => {
    setForm((prev) => ({
      ...prev,
      linkedKnowledgeIds: prev.linkedKnowledgeIds.includes(source)
        ? prev.linkedKnowledgeIds.filter((s) => s !== source)
        : [...prev.linkedKnowledgeIds, source],
    }))
  }

  const handleSave = async () => {
    setFormError(null)
    if (!form.name.trim()) { setFormError('メンター名を入力してください。'); return }
    if (!form.systemPrompt.trim()) { setFormError('プロンプトを入力してください。'); return }

    setIsSaving(true)
    if (editingId === 'new') {
      const { mentor, error } = await createCustomMentor(form.name, form.systemPrompt, form.linkedKnowledgeIds)
      if (error || !mentor) { setFormError(error ?? '作成に失敗しました。'); setIsSaving(false); return }
      setMentors((prev) => [mentor, ...prev])
    } else if (editingId) {
      const { error } = await updateCustomMentor(editingId, form.name, form.systemPrompt, form.linkedKnowledgeIds)
      if (error) { setFormError(error); setIsSaving(false); return }
      setMentors((prev) => prev.map((m) =>
        m.id === editingId
          ? { ...m, name: form.name, systemPrompt: form.systemPrompt, linkedKnowledgeIds: form.linkedKnowledgeIds }
          : m
      ))
    }
    setIsSaving(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    const { error } = await deleteCustomMentor(target.id)
    if (!error) setMentors((prev) => prev.filter((m) => m.id !== target.id))
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => router.push('/mentor')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="size-4" />
          メンターに戻る
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-foreground">カスタムメンター</h1>
          {editingId === null && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition"
            >
              <Plus className="size-4" />
              新規作成
            </button>
          )}
        </div>

        {/* 作成・編集フォーム */}
        {editingId !== null && (
          <div className="bg-card border border-border rounded-2xl p-4 mb-6 space-y-4">
            <p className="text-sm font-semibold text-foreground">
              {editingId === 'new' ? '新しいメンターを作る' : 'メンターを編集'}
            </p>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">メンター名</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="例：マーケ専門メンター"
                className="w-full border border-border rounded-xl px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">プロンプト（メンターの役割・口調・制約）</label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))}
                placeholder="例：あなたはマーケティングの専門家です。ユーザーのプロダクトの強みを引き出し、ターゲット顧客を一緒に考えてください。"
                rows={5}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm text-foreground bg-background resize-none focus:outline-none focus:border-primary"
              />
            </div>

            {knowledgeItems.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">参照する資料（チェックなし＝全件参照）</label>
                <div className="space-y-1">
                  {knowledgeItems.map((item) => (
                    <label key={item.source} className="flex items-center gap-2 cursor-pointer group">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                          form.linkedKnowledgeIds.includes(item.source)
                            ? 'bg-primary border-primary'
                            : 'border-border group-hover:border-primary'
                        }`}
                        onClick={() => toggleKnowledge(item.source)}
                      >
                        {form.linkedKnowledgeIds.includes(item.source) && (
                          <Check className="size-3 text-primary-foreground" />
                        )}
                      </div>
                      <span className="text-sm text-foreground truncate">{item.source}</span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">{item.chunkCount}チャンク</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {formError && <p className="text-xs text-destructive">{formError}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted transition"
              >
                <X className="size-3.5" />
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
              >
                <Check className="size-3.5" />
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}

        {/* メンター一覧 */}
        {mentors.length === 0 && editingId === null ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bot className="size-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">カスタムメンターがまだありません。</p>
            <p className="text-xs mt-1">「新規作成」からオリジナルのメンターを作りましょう。</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mentors.map((mentor) => (
              <div key={mentor.id} className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
                <Bot className="size-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{mentor.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mentor.systemPrompt}</p>
                  {mentor.linkedKnowledgeIds.length > 0 && (
                    <p className="text-xs text-primary mt-1">
                      資料: {mentor.linkedKnowledgeIds.join('、')}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(mentor)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition"
                    aria-label="編集"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(mentor)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                    aria-label="削除"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 削除確認ダイアログ */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>このメンターを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除します。このメンターで作成したチャット履歴は残りますが、メンター設定は復元できません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
