'use server'

import { createClient } from '@/lib/supabase/server'

const EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent'
const GEN_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent'

export type KnowledgeScope = 'global' | 'project' | 'mentor'

export type UserKnowledgeItem = {
  source: string
  createdAt: string
  chunkCount: number
  scope: KnowledgeScope
  scopeTargetId: string | null
}

export type UserKnowledgeResult = {
  id: string
  content: string
  source: string | null
  scope: KnowledgeScope
  scopeTargetId: string | null
  similarity: number
}

export type SearchScopeOptions = {
  sourceFilter?: string[]
  projectId?: string
  customMentorId?: string
  isCustom?: boolean
}

async function embed(text: string): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(`${EMBED_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-2',
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { embedding?: { values?: unknown } }
    const values = data?.embedding?.values
    return Array.isArray(values) ? (values as number[]) : null
  } catch {
    return null
  }
}

async function extractText(mimeType: string, base64: string): Promise<string | null> {
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    try {
      return Buffer.from(base64, 'base64').toString('utf-8')
    } catch {
      return null
    }
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(`${GEN_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'この資料の本文・内容をできるだけ正確にテキストとして抽出してください。説明や前置きは不要で、本文のみを出力してください。' },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === 'string' ? text : null
  } catch {
    return null
  }
}

function chunkText(text: string, size = 800, overlap = 100): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const chunks: string[] = []
  let start = 0
  while (start < clean.length) {
    chunks.push(clean.slice(start, start + size))
    start += size - overlap
  }
  return chunks
}

export async function addUserKnowledge(
  mimeType: string,
  base64: string,
  source: string,
  scope: KnowledgeScope = 'global',
  scopeTargetId: string | null = null
): Promise<{ success?: boolean; error?: string; chunkCount?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const approxBytes = (base64.length * 3) / 4
  if (approxBytes > 7 * 1024 * 1024) {
    return { error: 'ファイルサイズが7MBを超えています。' }
  }

  const text = await extractText(mimeType, base64)
  if (!text || !text.trim()) {
    return { error: '資料からテキストを抽出できませんでした。' }
  }

  const chunks = chunkText(text)
  if (chunks.length === 0) {
    return { error: '資料の内容が空でした。' }
  }

  const rows: { user_id: string; content: string; embedding: string; source: string; scope: KnowledgeScope; scope_target_id: string | null }[] = []
  for (const chunk of chunks) {
    const vec = await embed(chunk)
    if (!vec) continue
    rows.push({
      user_id: user.id,
      content: chunk,
      embedding: `[${vec.join(',')}]`,
      source,
      scope,
      scope_target_id: scopeTargetId,
    })
  }

  if (rows.length === 0) {
    return { error: 'ベクトル化に失敗しました。時間をおいて再度お試しください。' }
  }

  const { error } = await supabase.from('user_knowledge_chunks').insert(rows)
  if (error) return { error: '資料の保存に失敗しました。' }

  return { success: true, chunkCount: rows.length }
}

export async function searchUserKnowledge(
  query: string,
  options?: SearchScopeOptions
): Promise<UserKnowledgeResult[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const vec = await embed(query)
    if (!vec) return []

    const { data, error } = await supabase.rpc('match_user_knowledge_chunks', {
      query_embedding: `[${vec.join(',')}]`,
      p_user_id: user.id,
      match_count: 10,
      match_threshold: 0.0,
    })
    if (error || !data) return []

    type RawRow = { id: string; content: string; source: string | null; scope: string | null; scope_target_id: string | null; similarity: number }
    const rawData = data as RawRow[]

    // アクティブプロジェクトIDを決定（渡されていなければ内部取得）
    let activeProjectId = options?.projectId
    if (!activeProjectId) {
      const { data: proj } = await supabase
        .from('project_ideas')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()
      activeProjectId = proj?.id ?? undefined
    }

    // スコープフィルタ（JS側）
    const toResult = (r: RawRow): UserKnowledgeResult => ({
      id: r.id,
      content: r.content,
      source: r.source,
      scope: (r.scope ?? 'global') as KnowledgeScope,
      scopeTargetId: r.scope_target_id ?? null,
      similarity: r.similarity,
    })

    let results: UserKnowledgeResult[] = rawData
      .map(toResult)
      .filter((r) => {
        if (r.scope === 'global') return true
        if (r.scope === 'project') {
          return activeProjectId != null && r.scopeTargetId === activeProjectId
        }
        if (r.scope === 'mentor') {
          return options?.isCustom === true
            && options?.customMentorId != null
            && r.scopeTargetId === options.customMentorId
        }
        return false
      })

    // sourceFilter（linked_knowledge_ids）に含まれる資料はスコープ絞り込みを超えて参照対象に追加
    if (options?.sourceFilter && options.sourceFilter.length > 0) {
      const includedIds = new Set(results.map((x) => x.id))
      const bySource = rawData
        .filter((r) => r.source && options.sourceFilter!.includes(r.source) && !includedIds.has(r.id))
        .map(toResult)
      results = [...results, ...bySource]
    }

    results.sort((a, b) => b.similarity - a.similarity)
    return results.slice(0, 3)
  } catch {
    return []
  }
}

export async function listUserKnowledge(): Promise<UserKnowledgeItem[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('user_knowledge_chunks')
    .select('source, created_at, scope, scope_target_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  const map = new Map<string, UserKnowledgeItem>()
  for (const row of data as { source: string | null; created_at: string; scope: string | null; scope_target_id: string | null }[]) {
    const key = row.source ?? '(無題)'
    const existing = map.get(key)
    if (existing) {
      existing.chunkCount += 1
    } else {
      map.set(key, {
        source: key,
        createdAt: row.created_at,
        chunkCount: 1,
        scope: (row.scope ?? 'global') as KnowledgeScope,
        scopeTargetId: row.scope_target_id ?? null,
      })
    }
  }
  return Array.from(map.values())
}

export async function deleteUserKnowledge(source: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('user_knowledge_chunks')
    .delete()
    .eq('user_id', user.id)
    .eq('source', source)

  if (error) return { error: '資料の削除に失敗しました。' }
  return { success: true }
}

export async function updateUserKnowledgeScope(
  source: string,
  scope: KnowledgeScope,
  scopeTargetId: string | null
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('user_knowledge_chunks')
    .update({ scope, scope_target_id: scopeTargetId })
    .eq('user_id', user.id)
    .eq('source', source)

  if (error) return { error: 'スコープの変更に失敗しました。' }
  return { success: true }
}
