'use server'

import { createClient } from '@/lib/supabase/server'
import { generateSetupSteps, generateQuestSteps } from '@/app/actions/setup'

export type PersonalityData = {
  timeUsage: string
  mbti: string
  localPain: string
}

export type ValidatedBrief = {
  persona: string
  alternatives: string
  urgency: string
  essentialCore: string
  who: string
  what: string
  how: string
}

export type ValidationPhase = 'persona' | 'market' | 'urgency' | 'core' | 'summary' | 'revise' | 'done'

export type ValidationAnswers = {
  persona?: string
  market?: string
  urgency?: string
  core?: string
}

export type ValidationProgress = {
  phase: ValidationPhase
  answers: ValidationAnswers
}

// アプリ分類タクソノミー（docs/APP_TAXONOMY.md を正とする）
export type AppType = 'record' | 'matching' | 'reservation' | 'media' | 'tool' | 'ai'

// アイデア深堀りAIの成果物（docs/IDEA_AI_DESIGN.md S2〜S5 縮退版）
export type IdeaDeepDive = {
  marketScan: {
    existing: { name: string; what: string }[]
    missing: string
  }
  whyExist: string
  whyMissing: string
  reviewInsights: {
    good: { point: string; why: string }[]
    bad: { point: string; why: string }[]
  }
  differentiation: { spark: string; reason: string }
  proposal: string
  insufficient_data_fields: string[]
  sources?: string[] // Web調査の出典URL（フル版のみ）
  generatedAt: string
}

export type IdeaCard = {
  title: string
  description: string
  questTitles: string[]
  questDescriptions: string[]
  validatedBrief?: ValidatedBrief
  validationProgress?: ValidationProgress
  appType?: AppType
  deepDive?: IdeaDeepDive
}

export async function generateIdeasWithAI(
  personality: PersonalityData
): Promise<IdeaCard[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return getFallbackIdeas()

  const seed = Date.now()

  // N2 種の検索: 本人の興味・不便をクエリに、bloomers-brainの知識（地域課題・クエストの種）を引く。
  // 種があれば一般論でないアイデアの根拠になる（アイデアなし版パイプラインの燃料。IDEA_AI_DESIGN.md 8章）
  let seedsSection = ''
  try {
    const { searchKnowledge } = await import('@/app/actions/knowledge')
    const chunks = await searchKnowledge(`${personality.localPain} ${personality.timeUsage} 地域課題 クエストの種`)
    if (chunks.length > 0) {
      const seedsText = chunks
        .slice(0, 3)
        .map((c, i) => `${i + 1}. ${c.insight}${c.quest_seed ? `（種: ${c.quest_seed}）` : ''}`)
        .join('\n')
      seedsSection = `\n\n【Bloomerが持つ地域課題・アイデアの種（あれば最優先で使う）】\n${seedsText}\n※上の種とユーザー情報が噛み合う場合、3つのうち最低1つはこの種を具体化したアイデアにすること。噛み合わなければ無視してよい。`
    }
  } catch {
    // 種検索の失敗は無視（従来どおり生成）
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `あなたはスタートアップのメンターです。
以下のユーザー情報を元に、そのユーザーだけに最適な
Webアプリのアイデアを3つ提案してください。

【ユーザー情報】
- 一番時間を使っていること: ${personality.timeUsage}
- MBTI: ${personality.mbti}
- 地元・日常の不便: ${personality.localPain}
- シード値（毎回違うアイデアのため）: ${seed}${seedsSection}

【ルール】
- 同じMBTI of ユーザーでも必ず違うアイデアを返すこと
- アイデアはユーザーの趣味・性格・地域に深く根ざすこと
- 技術用語は使わず、初心者でもワクワクする言葉で書くこと
- 必ず以下のJSON形式のみで返すこと（前置き・説明不要）

[
  {
    "title": "アイデアのタイトル（20文字以内）",
    "description": "どんなサービスか（40文字以内）",
    "questTitles": [
      "q1のタイトル",
      "q2のタイトル",
      "q3のタイトル",
      "q4のタイトル",
      "q5のタイトル"
    ],
    "questDescriptions": [
      "q1の説明",
      "q2の説明",
      "q3の説明",
      "q4の説明",
      "q5の説明"
    ]
  },
  { ... },
  { ... }
]`
            }]
          }]
        }),
      }
    )

    if (!response.ok) return getFallbackIdeas()

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return parsed

  } catch {
    return getFallbackIdeas()
  }
}

function getFallbackIdeas(): IdeaCard[] {
  return [
    {
      title: '予約・管理アプリ',
      description: '時間や場所の予約をスマートに管理するサービス',
      questTitles: [
        '予約アプリの開発環境を作る',
        '予約画面のUIを作る',
        '予約データをDBに保存する',
        '予約アプリにログインを追加する',
        '予約アプリを世界に公開する',
      ],
      questDescriptions: [
        '予約アプリの土台となる環境を整える',
        'ユーザーが予約できる画面を作る',
        '予約情報をデータベースに保存する',
        'ユーザーがログインできるようにする',
        'Vercelで予約アプリを公開する',
      ],
    },
    {
      title: '情報共有アプリ',
      description: '地域の情報をみんなで共有できるサービス',
      questTitles: [
        '情報共有アプリの開発環境を作る',
        '投稿画面のUIを作る',
        '投稿データをDBに保存する',
        '情報共有アプリにログインを追加する',
        '情報共有アプリを世界に公開する',
      ],
      questDescriptions: [
        '情報共有アプリの土台となる環境を整える',
        'ユーザーが情報を投稿できる画面を作る',
        '投稿情報をデータベースに保存する',
        'ユーザーがログインできるようにする',
        'Vercelで情報共有アプリを公開する',
      ],
    },
    {
      title: 'コミュニティアプリ',
      description: '共通の興味を持つ人が集まれるサービス',
      questTitles: [
        'コミュニティアプリの開発環境を作る',
        '掲示板画面のUIを作る',
        '投稿データをDBに保存する',
        'コミュニティアプリにログインを追加する',
        'コミュニティアプリを世界に公開する',
      ],
      questDescriptions: [
        'コミュニティアプリの土台となる環境を整える',
        'ユーザーが投稿できる掲示板画面を作る',
        '投稿情報をデータベースに保存する',
        'ユーザーがログインできるようにする',
        'Vercelでコミュニティアプリを公開する',
      ],
    },
  ]
}

export async function saveOnboardingData(
  personality: PersonalityData,
  selectedIdea: IdeaCard,
  allIdeas: IdeaCard[]
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('profiles')
    .update({
      personality_data: personality,
      selected_idea: selectedIdea,
      generated_ideas: allIdeas,
      onboarding_completed: true,
      onboarding_answers: {
        answer1: personality.timeUsage,
        answer2: personality.localPain,
      },
    })
    .eq('id', user.id)

  if (error) return { error: 'データの保存に失敗しました。' }

  // 既存プロジェクトをすべて非アクティブ化（タイトル依存を排除）
  await supabase
    .from('project_ideas')
    .update({ is_active: false })
    .eq('user_id', user.id)

  // project_ideasにも保存
  await supabase
    .from('project_ideas')
    .insert({
      user_id: user.id,
      title: selectedIdea.title,
      description: selectedIdea.description,
      personality_data: personality,
      idea_card: selectedIdea,
      is_active: true,
    })

  // 生成したプロジェクトのIDを取得
  const { data: newProject } = await supabase
    .from('project_ideas')
    .select('id')
    .eq('user_id', user.id)
    .eq('title', selectedIdea.title)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const questContext = {
    who: selectedIdea.questDescriptions?.[0] ?? '（未設定）',
    what: personality.localPain ?? '（未設定）',
    how: selectedIdea.description ?? '（未設定）',
  }

  if (newProject) {
    const steps = await generateSetupSteps(
      selectedIdea.title,
      selectedIdea.description,
      questContext
    )
    await supabase
      .from('project_ideas')
      .update({ setup_steps: steps })
      .eq('id', newProject.id)
  }

  // q2〜q5のステップも生成して保存
  const [q2Steps, q3Steps, q4Steps, q5Steps] = await Promise.all([
    generateQuestSteps(2, selectedIdea.title, selectedIdea.description, questContext),
    generateQuestSteps(3, selectedIdea.title, selectedIdea.description, questContext),
    generateQuestSteps(4, selectedIdea.title, selectedIdea.description, questContext),
    generateQuestSteps(5, selectedIdea.title, selectedIdea.description, questContext),
  ])

  if (newProject) {
    await supabase
      .from('project_ideas')
      .update({
        quest2_steps: q2Steps,
        quest3_steps: q3Steps,
        quest4_steps: q4Steps,
        quest5_steps: q5Steps,
      })
      .eq('id', newProject.id)
  }

  return { success: true }
}

export async function getOnboardingStatus(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  return data?.onboarding_completed ?? false
}

export async function getSelectedIdea(): Promise<IdeaCard | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('selected_idea')
    .eq('id', user.id)
    .single()

  return data?.selected_idea ?? null
}

export async function resetOnboarding(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: false,
      personality_data: null,
      selected_idea: null,
      generated_ideas: null,
    })
    .eq('id', user.id)

  if (error) return { error: 'リセットに失敗しました。' }
  return { success: true }
}

export async function skipOnboarding(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: true,
    })
    .eq('id', user.id)

  if (error) return { error: 'スキップに失敗しました。' }
  return { success: true }
}

// アイデア文字列から実名クエスト付きIdeaCardをGeminiで生成する。
// 失敗時は questTitles/questDescriptions を空配列にして
// mergeQuestsWithProgress が STATIC定義の実名にフォールバックするようにする。
export async function generateIdeaCardFromText(
  ideaText: string
): Promise<IdeaCard> {
  const apiKey = process.env.GEMINI_API_KEY

  const fallback: IdeaCard = {
    title: ideaText.slice(0, 20),
    description: ideaText.slice(0, 40),
    questTitles: [],
    questDescriptions: [],
  }

  if (!apiKey) return fallback

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `以下のアプリのアイデアから、初心者向けの開発ロードマップ情報をJSON生成してください。

アイデア：${ideaText}

ルール：
- title: アプリ名（20文字以内）
- description: どんなアプリか（40文字以内）
- questTitles: 5つのクエスト名。必ずこの技術的順序にする：
  1番目=開発環境の構築、2番目=画面/UI作成、3番目=データ保存(DB)、4番目=ログイン機能、5番目=公開
  各クエスト名にこのアプリの特徴を必ず反映させること
  （例「レシピアプリ」なら「レシピアプリの開発環境を整えよう」「レシピを表示する画面を作ろう」）
- questDescriptions: 各クエストで何を達成するかの説明（各40文字以内）

JSON形式のみで出力（前置き・コードブロック記号なし）：
{
  "title": "...",
  "description": "...",
  "questTitles": ["...", "...", "...", "...", "..."],
  "questDescriptions": ["...", "...", "...", "...", "..."]
}`
            }]
          }],
        }),
      }
    )

    if (!response.ok) return fallback
    const data = await response.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed: unknown = JSON.parse(clean)

    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'title' in parsed &&
      'questTitles' in parsed &&
      'questDescriptions' in parsed &&
      typeof (parsed as Record<string, unknown>).title === 'string' &&
      Array.isArray((parsed as Record<string, unknown>).questTitles) &&
      ((parsed as Record<string, unknown>).questTitles as unknown[]).length === 5 &&
      Array.isArray((parsed as Record<string, unknown>).questDescriptions) &&
      ((parsed as Record<string, unknown>).questDescriptions as unknown[]).length === 5
    ) {
      const p = parsed as Record<string, unknown>
      return {
        title: (p.title as string).slice(0, 20),
        description: typeof p.description === 'string' ? (p.description as string).slice(0, 40) : ideaText.slice(0, 40),
        questTitles: p.questTitles as string[],
        questDescriptions: p.questDescriptions as string[],
      }
    }
    return fallback
  } catch {
    return fallback
  }
}

export async function updateToneOverride(
  tone: 'gentle' | 'balanced' | 'strict' | null
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }
  const { error } = await supabase
    .from('profiles')
    .update({ tone_override: tone })
    .eq('id', user.id)
  if (error) return { error: 'トーン設定の保存に失敗しました。' }
  return { success: true }
}

export async function saveTrialProject(
  ideaCard: IdeaCard
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  try {
    // 既存プロジェクトをすべて非アクティブ化
    await supabase
      .from('project_ideas')
      .update({ is_active: false })
      .eq('user_id', user.id)

    const { error: insertError } = await supabase
      .from('project_ideas')
      .insert({
        user_id: user.id,
        title: ideaCard.title,
        description: ideaCard.description,
        idea_card: ideaCard,
        is_active: true,
      })
    if (insertError) return { error: 'プロジェクトの作成に失敗しました。' }

    await supabase
      .from('profiles')
      .update({ onboarding_completed: true, selected_idea: ideaCard })
      .eq('id', user.id)

    // 生成したプロジェクトのIDを取得
    const { data: newProject } = await supabase
      .from('project_ideas')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', ideaCard.title)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!newProject) return { success: true }

    const questContext = {
      who: ideaCard.questDescriptions?.[0] ?? '（未設定）',
      what: ideaCard.description ?? '（未設定）',
      how: ideaCard.description ?? '（未設定）',
    }

    // q1（setup）〜q5のステップをフル生成して保存
    const [setupSteps, q2Steps, q3Steps, q4Steps, q5Steps] = await Promise.all([
      generateSetupSteps(ideaCard.title, ideaCard.description, questContext),
      generateQuestSteps(2, ideaCard.title, ideaCard.description, questContext),
      generateQuestSteps(3, ideaCard.title, ideaCard.description, questContext),
      generateQuestSteps(4, ideaCard.title, ideaCard.description, questContext),
      generateQuestSteps(5, ideaCard.title, ideaCard.description, questContext),
    ])

    await supabase
      .from('project_ideas')
      .update({
        setup_steps: setupSteps,
        quest2_steps: q2Steps,
        quest3_steps: q3Steps,
        quest4_steps: q4Steps,
        quest5_steps: q5Steps,
      })
      .eq('id', newProject.id)

    return { success: true }
  } catch {
    return { error: 'プロジェクトの作成に失敗しました。' }
  }
}
