'use server'

// アイデア深堀りAI S2〜S5（docs/IDEA_AI_DESIGN.md）
// フル版: Tavily検索（research-engine.ts）で市場・口コミの実Web根拠を取り、出典URL付きで分析する。
// 検索が使えない時は縮退版（LLM一般知識＋insufficient_data明示）に自動フォールバック。
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { APP_TYPE_LABELS } from '@/lib/app-taxonomy'
import { logGenerationEvent } from '@/app/actions/generation-log'
import { searchWeb, type WebSearchResult } from '@/app/actions/research-engine'
import type { IdeaCard, IdeaDeepDive, ValidatedBrief } from '@/app/actions/onboarding'

const DeepDiveSchema = z.object({
  marketScan: z.object({
    existing: z.array(z.object({ name: z.string(), what: z.string() })).max(4),
    missing: z.string(),
  }),
  whyExist: z.string(),
  whyMissing: z.string(),
  reviewInsights: z.object({
    good: z.array(z.object({ point: z.string(), why: z.string() })).max(3),
    bad: z.array(z.object({ point: z.string(), why: z.string() })).max(3),
  }),
  differentiation: z.object({ spark: z.string(), reason: z.string() }),
  proposal: z.string(),
  insufficient_data_fields: z.array(z.string()),
  sources: z.array(z.string()).max(8).optional(),
})

function buildDeepDivePrompt(ideaCard: IdeaCard, webResults: WebSearchResult[]): string {
  const brief = ideaCard.validatedBrief
  const briefSection = brief
    ? `ペルソナ: ${brief.persona}
削れない核: ${brief.essentialCore}
誰のため: ${brief.who} / 何を解決: ${brief.what}`
    : '（検証ブリーフなし。タイトルと概要から分析すること）'

  const hasWeb = webResults.length > 0
  const webSection = hasWeb
    ? `
<web_research>
以下は実際のWeb検索結果（市場・口コミ調査）:
${webResults.map((r, i) => `[W${i + 1}] ${r.title}
URL: ${r.url}
内容: ${r.content}`).join('\n\n')}
</web_research>
`
    : ''

  const groundingRule = hasWeb
    ? `- marketScan と reviewInsights は <web_research> 内の情報を最優先の根拠にすること。根拠に使った情報源のURLを sources に列挙する
- Web結果に根拠がない主張をする場合は、その項目名を insufficient_data_fields に列挙すること`
    : `- あなたはWeb検索ができない。市場・口コミ情報はあなたの学習知識によるもので、最新ではない可能性がある。断定せず、確認が必要な項目は insufficient_data_fields に列挙すること`

  return `
あなたはBloomersの「アイデア深堀りAI」。ユーザーのアイデアを以下の5段階で分析し、最後に提案を返す。

【分析対象のアイデア】
タイトル: ${ideaCard.title}
概要: ${ideaCard.description}
分類: ${ideaCard.appType ? APP_TYPE_LABELS[ideaCard.appType] : '未分類'}
${briefSection}
${webSection}
【分析の手順（内部思考。この順で考えること）】
S2. 市場スキャン: この分類・この用途で世の中に既にあるアプリを挙げる。逆に「無いもの」も1つ見つける
S3. 存在理由: なぜそれらは存在するのか（需要）。なぜ「無いもの」は無いのか（需要不足/技術難度/収益性）
S4. 口コミ採掘: 既存アプリの利用者が典型的に不満を言う点と評価する点を、理由付きで挙げる
S5. 差別化: S4の不満 × このユーザーのペルソナから「光る一点」を1つだけ決める

【重要な制約】
${groundingRule}
- 存在しないアプリ名をでっち上げない。確信がないアプリ名は出さない
- 光る一点は1つだけ。機能を足す方向ではなく、絞る・尖らせる方向を優先
- 光る一点は、初心者がNext.js+SupabaseのWebアプリの最初の版で作れる範囲にすること（ネイティブのプッシュ通知・複雑な外部API連携・決済は不可。画面の見せ方と仕組みの工夫で解決する形に）
- proposal はユーザー（非エンジニアの大学生）に直接見せる文。3〜4文、専門用語なし、わくわくする語り口で

【出力】以下のJSONのみ（前置き・マークダウン禁止）:
{
  "marketScan": {
    "existing": [{"name": "実在するアプリ・サービス名", "what": "何をするものか(20字以内)"}],
    "missing": "この領域でまだ無いもの(40字以内)"
  },
  "whyExist": "既存アプリが存在する理由(50字以内)",
  "whyMissing": "無いものが無い理由(50字以内)",
  "reviewInsights": {
    "good": [{"point": "評価される点(20字以内)", "why": "なぜ(30字以内)"}],
    "bad": [{"point": "不満点(20字以内)", "why": "なぜ(30字以内)"}]
  },
  "differentiation": {"spark": "光る一点(30字以内)", "reason": "なぜそれが刺さるか(50字以内)"},
  "proposal": "ユーザーに見せる提案文(3〜4文)",
  "insufficient_data_fields": ["根拠が不足している項目"],
  "sources": ["根拠に使った情報源のURL（Web調査結果がない場合は空配列）"]
}
`.trim()
}

// 深堀り分析を実行して idea_card.deepDive に保存する。既存の分析があればキャッシュを返す（force で再実行）。
// briefOverride: q1検証中はブリーフが未保存のため、確定前の値を直接渡せる
export async function generateIdeaDeepDive(
  projectId: string,
  options?: { force?: boolean; briefOverride?: ValidatedBrief }
): Promise<{ deepDive?: IdeaDeepDive; cached?: boolean; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API key missing' }

  const supabase = await createClient()
  const { data: project, error: fetchErr } = await supabase
    .from('project_ideas')
    .select('idea_card')
    .eq('id', projectId)
    .single()

  if (fetchErr || !project) return { error: fetchErr?.message ?? 'project not found' }

  const baseCard = project.idea_card as IdeaCard
  const ideaCard: IdeaCard = options?.briefOverride
    ? { ...baseCard, validatedBrief: options.briefOverride }
    : baseCard

  // コストガード: 分析済みなら再実行しない（アイデア変更時は force=true で呼ぶ）
  if (ideaCard.deepDive && !options?.force) {
    return { deepDive: ideaCard.deepDive, cached: true }
  }

  // S2市場スキャン + S4口コミ採掘のWeb検索（Tavily・1深堀りで2検索まで）。
  // 失敗・キー未設定時は空配列 → プロンプトが縮退版に自動フォールバック
  const topic = ideaCard.validatedBrief?.what ?? ideaCard.description
  const categoryLabel = ideaCard.appType ? APP_TYPE_LABELS[ideaCard.appType] : ''
  const [marketResults, reviewResults] = await Promise.all([
    searchWeb(`${topic} ${categoryLabel} アプリ サービス 類似`, 3),
    searchWeb(`${topic} アプリ 口コミ 不満 レビュー`, 3),
  ])
  const webResults = [...marketResults, ...reviewResults]

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { temperature: 0.6 },
          contents: [{ parts: [{ text: buildDeepDivePrompt(ideaCard, webResults) }] }],
        }),
      }
    )

    if (!response.ok) return { error: `Gemini error: ${response.status}` }

    const data = await response.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()

    const parsed = DeepDiveSchema.safeParse(JSON.parse(clean))
    if (!parsed.success) {
      await logGenerationEvent({
        projectId, eventType: 'deep_dive', appType: ideaCard.appType,
        outcome: 'error', detail: 'schema mismatch',
      })
      return { error: 'deep-dive schema mismatch' }
    }

    const deepDive: IdeaDeepDive = { ...parsed.data, generatedAt: new Date().toISOString() }

    const { error: updateErr } = await supabase
      .from('project_ideas')
      .update({ idea_card: { ...ideaCard, deepDive } })
      .eq('id', projectId)

    if (updateErr) return { error: updateErr.message }

    await logGenerationEvent({
      projectId, eventType: 'deep_dive', appType: ideaCard.appType, outcome: 'success',
    })
    return { deepDive }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'deep-dive failed'
    await logGenerationEvent({
      projectId, eventType: 'deep_dive', appType: ideaCard.appType,
      outcome: 'error', detail: message,
    })
    return { error: message }
  }
}
