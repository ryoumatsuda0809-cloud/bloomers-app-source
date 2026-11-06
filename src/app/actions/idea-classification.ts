'use server'

// 検証済みアイデアをアプリ分類（docs/APP_TAXONOMY.md）に判定する分類AI
import { z } from 'zod'
import type { IdeaCard, ValidatedBrief, AppType } from '@/app/actions/onboarding'

const APP_TYPE_VALUES = ['record', 'matching', 'reservation', 'media', 'tool', 'ai'] as const

const ClassificationSchema = z.object({
  appType: z.enum(APP_TYPE_VALUES),
  reason: z.string(),
})

const FALLBACK_APP_TYPE: AppType = 'record'

function buildClassificationPrompt(ideaCard: IdeaCard, brief?: ValidatedBrief): string {
  const briefSection = brief
    ? `
【検証ブリーフ】
誰のため: ${brief.who}（ペルソナ: ${brief.persona}）
何を解決: ${brief.what}
どう実現: ${brief.how}
削れない核となる1機能: ${brief.essentialCore}
`.trim()
    : '（検証ブリーフなし。タイトルと概要から判定すること）'

  return `
以下のアプリのアイデアを、6つの分類のうち最も近い1つに判定してください。

【分類の定義】
- record: 記録・管理系。「毎日◯◯をつける」アプリ（家計簿・出欠・勉強記録・在庫メモ）
- matching: マッチング・掲示板系。「出す人と見る人」がいるアプリ（譲ります掲示板・スキルマッチ）
- reservation: 予約・注文系。「枠を取り合う」アプリ（店の予約・テイクアウト注文・備品貸出）
- media: 情報発信・地図系。「管理者が載せて、みんなが見る」アプリ（イベントマップ・お店紹介）
- tool: ツール・診断系。DBほぼ不要の「入力→結果」アプリ（診断・計算機・シミュレーター）
- ai: AI活用系。LLM APIを呼ぶアプリ（相談bot・文章添削・献立提案）

【判定ルール】
- 「削れない核となる1機能」があればそれを最優先で見る
- リアルタイムチャット・SNS系のアイデアは matching に倒す
- 複数に跨る場合は、最初の版で作るべき最小の核がどれかで決める

【アイデア】
タイトル: ${ideaCard.title}
概要: ${ideaCard.description}

${briefSection}

【出力ルール】
以下のJSON形式のみで返すこと。前置き・説明・マークダウン禁止:
{"appType": "分類名", "reason": "判定理由（30文字以内）"}
`.trim()
}

export async function classifyIdea(
  ideaCard: IdeaCard,
  brief?: ValidatedBrief // 未指定ならタイトル・概要のみで判定（q1をインタビュー以外の経路で完了した場合の自己修復用）
): Promise<{ appType: AppType; reason?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { appType: FALLBACK_APP_TYPE, error: 'API key missing' }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { temperature: 0 },
          contents: [{ parts: [{ text: buildClassificationPrompt(ideaCard, brief) }] }],
        }),
      }
    )

    if (!response.ok) {
      return { appType: FALLBACK_APP_TYPE, error: `Gemini error: ${response.status}` }
    }

    const data = await response.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()

    const parsed = ClassificationSchema.safeParse(JSON.parse(clean))
    if (!parsed.success) {
      return { appType: FALLBACK_APP_TYPE, error: 'classification schema mismatch' }
    }

    return { appType: parsed.data.appType, reason: parsed.data.reason }
  } catch (err) {
    return {
      appType: FALLBACK_APP_TYPE,
      error: err instanceof Error ? err.message : 'classification failed',
    }
  }
}
