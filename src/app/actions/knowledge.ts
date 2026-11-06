'use server'

import { createClient } from '@/lib/supabase/server'

export type KnowledgeChunk = {
  id: string
  trigger: string
  fact: string
  insight: string
  quest_seed: string
  similarity: number
}

export async function searchKnowledge(query: string): Promise<KnowledgeChunk[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []

  try {
    // 1. クエリをベクトル化
    const embedResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-2',
          content: { parts: [{ text: query }] },
          outputDimensionality: 768,
        }),
      }
    )

    const embedText = await embedResponse.text()
    if (!embedResponse.ok) return []

    const embedData = JSON.parse(embedText)
    const embedding = embedData.embedding?.values as number[] | undefined
    if (!embedding) return []

    // 2. Supabase に直接SQLで問い合わせ
    const supabase = await createClient()
    const vectorString = `[${embedding.join(',')}]`

    const { data, error } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: vectorString,
      match_count: 3,
      match_threshold: 0.6,
    })

    if (error) return []

    return (data ?? []) as KnowledgeChunk[]

  } catch (err) {
    console.error('searchKnowledgeエラー:', err)
    return []
  }
}
