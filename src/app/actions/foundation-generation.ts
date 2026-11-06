'use server'

// 分類特化の土台生成AI: appType + 検証ブリーフ + RAG知識から q2〜q5 の中身を生成する
// 原則: retrieved-only（知識にない土台は生成しない）・失敗時は既存ステップを温存してフォールバック
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { searchKnowledge } from '@/app/actions/knowledge'
import { buildFoundationQuery, APP_TYPE_LABELS } from '@/lib/app-taxonomy'
import type { SetupStep } from '@/app/actions/setup'
import type { IdeaCard } from '@/app/actions/onboarding'

const FoundationStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  link: z.string().nullable().optional(),
  linkLabel: z.string().nullable().optional(),
  completed: z.boolean().optional(), // LLMが省略しても弾かない（保存時にfalseを強制）
})

const FoundationQuestSchema = z.object({
  title: z.string(),
  description: z.string(),
  steps: z.array(FoundationStepSchema).min(2).max(6),
  source_chunks: z.array(z.string()),
  insufficient_data_fields: z.array(z.string()),
})

export type FoundationQuest = {
  title: string
  description: string
  steps: SetupStep[]
}

function buildFoundationPrompt(
  questNumber: 2 | 3 | 4 | 5,
  ideaCard: IdeaCard,
  knowledgeText: string
): string {
  const brief = ideaCard.validatedBrief
  const briefSection = brief
    ? `
【検証ブリーフ（q1で確定済み）】
- 誰のため: ${brief.who}（ペルソナ: ${brief.persona}）
- 何を解決: ${brief.what}
- 削れない核となる1機能: ${brief.essentialCore}
`.trim()
    : ''

  return `
あなたはBloomersのクエスト設計AIです。以下のアプリのための「クエスト${questNumber}」を設計してください。

【アプリ情報】
- タイトル: ${ideaCard.title}
- 概要: ${ideaCard.description}
- 分類: ${ideaCard.appType ? APP_TYPE_LABELS[ideaCard.appType] : '不明'}

${briefSection}

<bloomer_knowledge>
${knowledgeText}
</bloomer_knowledge>

【絶対ルール】
- クエストの構成・ステップは <bloomer_knowledge> 内の知識のみを根拠にすること
- 知識にない手順・ツール・APIを推測で足さないこと
- 使った知識のIDを source_chunks に必ず列挙すること
- 知識が不足していて設計できなかった観点があれば insufficient_data_fields に書くこと（なければ空配列）
- ステップは初心者向けに2〜5個。技術用語は最小限、このアプリ固有の言葉（何を記録するか等）に置き換えること

【出力ルール】
以下のJSON形式のみで返すこと。前置き・説明・マークダウン禁止:
{
  "title": "クエストのタイトル（15文字以内・このアプリに合わせる）",
  "description": "クエストの説明（25文字以内）",
  "steps": [
    {
      "id": "step-1",
      "title": "ステップのタイトル（15文字以内）",
      "description": "何をするか・なぜ必要かを2文で",
      "link": "参考URL（なければnull）",
      "linkLabel": "リンクラベル（なければnull）",
      "completed": false
    }
  ],
  "source_chunks": ["根拠にした知識のID"],
  "insufficient_data_fields": []
}
`.trim()
}

// 1クエスト分の土台を生成する。RAGヒット0件・生成失敗・スキーマ不一致は null（呼び出し側でフォールバック）
export async function generateFoundationQuest(
  questNumber: 2 | 3 | 4 | 5,
  ideaCard: IdeaCard
): Promise<FoundationQuest | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || !ideaCard.appType) return null

  // 1. 分類×クエストの土台知識をRAG検索
  const chunks = await searchKnowledge(buildFoundationQuery(ideaCard.appType, questNumber))
  if (chunks.length === 0) return null // ヒット0件はLLMを呼ばない（コスト保護）

  // 他分類の土台知識が混ざると設計が汚染されるため、appType一致チャンクを優先する
  const matched = chunks.filter((c) => c.trigger.includes(`（${ideaCard.appType}）`))
  const usableChunks = matched.length > 0 ? matched : chunks

  const knowledgeText = usableChunks
    .map((c) => `[ID: ${c.id}]\nトリガー: ${c.trigger}\n事実: ${c.fact}\n洞察: ${c.insight}\nクエストの種: ${c.quest_seed}`)
    .join('\n\n')

  // 2. retrieved-only で生成
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { temperature: 0.4 },
          contents: [{ parts: [{ text: buildFoundationPrompt(questNumber, ideaCard, knowledgeText) }] }],
        }),
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()

    // 3. Zod検証（構造の物理保証）
    const parsed = FoundationQuestSchema.safeParse(JSON.parse(clean))
    if (!parsed.success) return null

    return {
      title: parsed.data.title,
      description: parsed.data.description,
      steps: parsed.data.steps.map((s) => ({ ...s, completed: false })),
    }
  } catch {
    return null
  }
}

// アイデア変更フロー用の一括再生成（IDEA_AI_DESIGN.md 実装順D）。
// q1確定時には呼ばない（9API呼び出しの同期待ちはVercelタイムアウトとレート制限バーストを招くため、
// 通常経路は ensureQuestSteps の遅延生成に委ねる）。個別クエストの生成失敗は既存ステップ温存。
export async function regenerateFoundationQuests(
  projectId: string,
  ideaCard: IdeaCard
): Promise<{ regenerated: number[]; error?: string }> {
  if (!ideaCard.appType) return { regenerated: [], error: 'appType missing' }

  const questNumbers: (2 | 3 | 4 | 5)[] = [2, 3, 4, 5]
  const results = await Promise.all(
    questNumbers.map((n) => generateFoundationQuest(n, ideaCard))
  )

  const supabase = await createClient()
  const updates: Record<string, unknown> = {}
  const regenerated: number[] = []

  const questTitles = [...(ideaCard.questTitles ?? [])]
  const questDescriptions = [...(ideaCard.questDescriptions ?? [])]

  results.forEach((result, i) => {
    const questNumber = questNumbers[i]
    if (!result) return
    updates[`quest${questNumber}_steps`] = result.steps
    // questTitles/questDescriptions は index 0 = q1
    questTitles[questNumber - 1] = result.title
    questDescriptions[questNumber - 1] = result.description
    regenerated.push(questNumber)
  })

  if (regenerated.length === 0) return { regenerated: [], error: 'all generations failed' }

  updates.idea_card = { ...ideaCard, questTitles, questDescriptions }

  const { error } = await supabase
    .from('project_ideas')
    .update(updates)
    .eq('id', projectId)

  if (error) return { regenerated: [], error: error.message }

  // profiles.selected_idea（メンター用フォールバック）はアクティブプロジェクトの時だけ同期する
  // （非アクティブプロジェクトの再生成が選択中アイデアを上書きするのを防ぐ）
  const { data: proj } = await supabase
    .from('project_ideas')
    .select('is_active')
    .eq('id', projectId)
    .single()

  if (proj?.is_active) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ selected_idea: updates.idea_card })
        .eq('id', user.id)
    }
  }

  return { regenerated }
}
