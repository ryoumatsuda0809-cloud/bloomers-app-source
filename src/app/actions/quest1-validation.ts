'use server'

import { createClient } from '@/lib/supabase/server'
import { searchKnowledge } from '@/app/actions/knowledge'
import { saveMentorMessage } from '@/app/actions/chat'
import { updateQuestStatus } from '@/app/actions/quest'
import { classifyIdea } from '@/app/actions/idea-classification'
import { logGenerationEvent } from '@/app/actions/generation-log'
import type {
  IdeaCard,
  ValidatedBrief,
  ValidationPhase,
  ValidationAnswers,
  ValidationProgress,
} from '@/app/actions/onboarding'

export type ValidationTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type ValidationState = {
  phase: ValidationPhase
  answers: ValidationAnswers
  history: ValidationTurn[]
  isPhaseDone: boolean
  finalBrief?: ValidatedBrief
}

const PHASE_PURPOSE: Record<string, string> = {
  persona: '抽象的な「みんな」でなく、顔の見える実在の1人に絞らせる',
  market: '既存の代替手段を直視させ「なぜ自分が作るか」を答えさせる',
  urgency: '課題の痛みと緊急度を言語化させる',
  core: '全部作ろうとせず最小の核となる1機能に絞らせる',
}

const PHASE_QUESTIONS: Record<string, string> = {
  persona: 'アイデアから想定できる「最初の1人」の具体案をこちらから1〜3つ提案し、選択肢として提示する。実在の誰かが浮かんでいそうなら聞いてもよい',
  market: 'その人が今この悩みをどうしのいでいそうか、こちらから見立てを提案して確認する。既存の代替手段の候補も自分から挙げる',
  urgency: 'このアプリが無い場合に一番困る場面をこちらから想像して提示し、その切実さが合っているか選ばせる',
  core: 'アイデアと今までの回答から「削れない核」の候補を2〜3個こちらから提案し、選択肢として選ばせる',
}

const PHASE_RAG_QUERY: Record<string, string> = {
  persona: 'ターゲットユーザー ペルソナ 具体的な1人',
  market: '市場調査 競合 既存代替 差別化',
  urgency: '課題の緊急度 ペインポイント 必要性',
  core: 'MVP 最小限の核 優先機能',
}

const PHASE_ORDER: ValidationPhase[] = ['persona', 'market', 'urgency', 'core', 'summary']

function buildSystemPrompt(state: ValidationState, ideaCard: IdeaCard): string {
  const accumulated = `
【現在までの回答】
ペルソナ（誰）：${state.answers.persona ?? '（未回答）'}
既存代替（なぜ作る）：${state.answers.market ?? '（未回答）'}
切実さ（なぜ今）：${state.answers.urgency ?? '（未回答）'}
核（削れない1機能）：${state.answers.core ?? '（未回答）'}
`.trim()

  const phaseInfo =
    state.phase in PHASE_QUESTIONS
      ? `
【現在のフェーズ】${state.phase}
【このフェーズの目的】${PHASE_PURPOSE[state.phase]}
【このフェーズの進め方】${PHASE_QUESTIONS[state.phase]}
`.trim()
      : ''

  return `
あなたはBloomersの「アイデア検証メンター」。ユーザーが選んだアイデアを一緒に固め、「本当に作る価値があるか」を見極める。おだてず・否定せず・現実を直視させる"ちょっと先輩"の距離感。

【今のアイデア】
タイトル：${ideaCard.title}
概要：${ideaCard.description}

${accumulated}

${phaseInfo}

【最重要の姿勢】
ここはまだアイデアの段階。ユーザーに白紙で質問攻めにしない。**まずあなたが具体案を提案し**、ユーザーは「乗る・直す・選ぶ」だけでいい状態にする。ユーザーが「わからない」「提案して」と言ったら、アイデアと文脈から具体案を出す。

【話し方】
- 専門用語を使わない。1返答3文以内
- 本人にしか決められない分岐だけ質問する。その時は選択肢を2〜4個提示し、返答の末尾に %%%OPTIONS%%%["選択肢1","選択肢2","選択肢3"] を1行で付ける（ユーザーには見えない）。各選択肢は具体的に20文字以内
- 具体的な答えには「いいね」と認めて次へ。曖昧・きれいごと・「みんな」「便利」など中身が無い時は、あなたから具体例を選択肢で出して選ばせる
- 説教しない。相手の言葉で「つまり〇〇？」と返す
- 絵文字禁止。選択肢マーカー以外の箇条書き禁止

【マーカー（ユーザー非表示・返答末尾）】
- このフェーズの問いに具体的で前進できる答えが出たら %%%PHASE_DONE%%% を付ける
- まだ曖昧・一般論・要確認なら付けない（＝もう一度、今度は選択肢付きで提案する）
`.trim()
}

function buildBriefPrompt(answers: ValidationAnswers, ideaCard: IdeaCard): string {
  return `
以下のユーザー回答を元に、アイデアの検証ブリーフをJSONで生成してください。

【アイデア】
タイトル：${ideaCard.title}
概要：${ideaCard.description}

【ユーザーの回答】
ペルソナ：${answers.persona}
既存代替：${answers.market}
切実さ：${answers.urgency}
削れない核：${answers.core}

【出力ルール】
以下のJSON形式のみで返すこと。前置き・説明・マークダウン禁止：

{
  "persona": "顔の見える具体的な1人（30文字以内）",
  "alternatives": "既存の代替手段と差別化ポイント（40文字以内）",
  "urgency": "なぜ今・なぜ切実か（30文字以内）",
  "essentialCore": "削れない核となる1機能（25文字以内）",
  "who": "誰のためのアプリか（20文字以内）",
  "what": "何を解決するか（20文字以内）",
  "how": "どうやって実現するか（20文字以内）"
}
`.trim()
}

// AIの返答末尾から %%%OPTIONS%%%["a","b"] を取り出す（不正なJSONは無視して選択肢なし扱い）
function extractOptions(raw: string): { text: string; options?: string[] } {
  const match = raw.match(/%%%OPTIONS%%%\s*(\[[\s\S]*?\])\s*$/)
  if (!match) return { text: raw }
  const text = raw.slice(0, match.index).trim()
  try {
    const parsed = JSON.parse(match[1]) as unknown
    if (Array.isArray(parsed) && parsed.every((o) => typeof o === 'string') && parsed.length > 0) {
      return { text, options: parsed.slice(0, 4) }
    }
  } catch {
    // パース失敗は選択肢なしとして本文だけ返す
  }
  return { text }
}

export async function processValidationTurn(
  userMessage: string,
  state: ValidationState,
  projectId: string,
  ideaCard: IdeaCard
): Promise<{ reply: string; nextState: ValidationState; options?: string[]; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { reply: '', nextState: state, error: 'API key missing' }
  }

  let ragSection = ''
  if (state.phase in PHASE_RAG_QUERY) {
    try {
      const chunks = await searchKnowledge(PHASE_RAG_QUERY[state.phase])
      if (chunks.length > 0) {
        const text = chunks
          .slice(0, 2)
          .map((c, i) => `${i + 1}. ${c.insight}`)
          .join('\n')
        ragSection = `\n\n<bloomer_knowledge>\n${text}\n</bloomer_knowledge>`
      }
    } catch {
      // RAG失敗は無視
    }
  }

  const systemPrompt = buildSystemPrompt(state, ideaCard) + ragSection

  const contents = [
    ...state.history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ]

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { temperature: 0.7 },
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      }
    )

    if (!response.ok) {
      return { reply: '', nextState: state, error: `Gemini error: ${response.status}` }
    }

    const data = await response.json()
    const rawReply: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const isPhaseDone = rawReply.includes('%%%PHASE_DONE%%%')
    const { text: cleanReply, options } = extractOptions(
      rawReply.replace(/%%%PHASE_DONE%%%/g, '').trim()
    )

    // 会話を保存（失敗しても続行）
    saveMentorMessage(projectId, 'q1', 'user', userMessage, 'quest').catch(() => {})
    saveMentorMessage(projectId, 'q1', 'assistant', cleanReply, 'quest').catch(() => {})

    const updatedAnswers: ValidationAnswers = { ...state.answers }
    if (isPhaseDone && state.phase in PHASE_QUESTIONS) {
      updatedAnswers[state.phase as keyof ValidationAnswers] = userMessage
    }

    const currentIdx = PHASE_ORDER.indexOf(state.phase)
    let nextPhase: ValidationPhase = state.phase
    if (isPhaseDone && currentIdx >= 0 && currentIdx < PHASE_ORDER.length - 1) {
      nextPhase = PHASE_ORDER[currentIdx + 1]
    }

    const nextState: ValidationState = {
      ...state,
      phase: nextPhase,
      answers: updatedAnswers,
      isPhaseDone,
      history: [
        ...state.history,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: cleanReply },
      ],
    }

    // 途中進捗をDBに保存（失敗しても続行）
    saveValidationProgress(projectId, { phase: nextPhase, answers: updatedAnswers }).catch(() => {})

    return { reply: cleanReply, nextState, options }
  } catch (err) {
    return {
      reply: '',
      nextState: state,
      error: err instanceof Error ? err.message : '対話エンジンに接続できませんでした',
    }
  }
}

export async function generateValidatedBrief(
  answers: ValidationAnswers,
  ideaCard: IdeaCard
): Promise<{ brief?: ValidatedBrief; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API key missing' }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildBriefPrompt(answers, ideaCard) }] }],
        }),
      }
    )

    if (!response.ok) return { error: `Gemini error: ${response.status}` }

    const data = await response.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const brief = JSON.parse(clean) as ValidatedBrief
    return { brief }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'ブリーフ生成失敗' }
  }
}

export async function finalizeValidation(
  brief: ValidatedBrief,
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'no user' }

  // 既存 idea_card を read-modify-write
  const { data: project, error: fetchErr } = await supabase
    .from('project_ideas')
    .select('idea_card')
    .eq('id', projectId)
    .single()

  if (fetchErr || !project) return { error: fetchErr?.message ?? 'project not found' }

  // アプリ分類を判定。エラー時は appType を保存しない（誤分類の土台が生成されるのを防ぐ）
  const { appType, error: classifyError } = await classifyIdea(project.idea_card as IdeaCard, brief)
  void logGenerationEvent({
    projectId,
    eventType: 'classification',
    appType: classifyError ? undefined : appType,
    outcome: classifyError ? 'error' : 'success',
    detail: classifyError,
  })

  const updatedCard: IdeaCard = {
    ...(project.idea_card as IdeaCard),
    validatedBrief: brief,
    validationProgress: undefined, // 途中保存を削除
    ...(classifyError ? {} : { appType }),
  }

  // idea_card 更新と q2〜q5 クリアは1回の書き込みで原子的に行う
  // （分類確定時のみクリア → 次に各クエストを開いた時、遅延経路が分類特化の土台を生成する）
  const { error: updateErr } = await supabase
    .from('project_ideas')
    .update({
      idea_card: updatedCard,
      ...(classifyError
        ? {}
        : { quest2_steps: [], quest3_steps: [], quest4_steps: [], quest5_steps: [] }),
    })
    .eq('id', projectId)

  if (updateErr) return { error: updateErr.message }

  // profiles.selected_idea にも同期
  await supabase
    .from('profiles')
    .update({ selected_idea: updatedCard })
    .eq('id', user.id)

  // q1 を completed に
  const { error: questErr } = await updateQuestStatus('q1', 'completed', projectId)
  if (questErr) return { error: questErr }

  // ツール・診断系はDB・認証が不要なため q4 を最初からスキップ扱いにする（APP_TAXONOMY.md 準拠）
  if (updatedCard.appType === 'tool') {
    await updateQuestStatus('q4', 'skipped', projectId) // 失敗してもq1完了は成立させる
  }

  return { success: true }
}

async function saveValidationProgress(
  projectId: string,
  progress: ValidationProgress
): Promise<void> {
  const supabase = await createClient()
  const { data: project } = await supabase
    .from('project_ideas')
    .select('idea_card')
    .eq('id', projectId)
    .single()

  if (!project) return

  const updatedCard: IdeaCard = {
    ...(project.idea_card as IdeaCard),
    validationProgress: progress,
  }

  await supabase
    .from('project_ideas')
    .update({ idea_card: updatedCard })
    .eq('id', projectId)
}

export async function loadValidationState(
  projectId: string
): Promise<{ ideaCard?: IdeaCard; progress?: ValidationProgress; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'no user' }

  const { data: project, error } = await supabase
    .from('project_ideas')
    .select('idea_card')
    .eq('id', projectId)
    .single()

  if (error || !project) return { error: error?.message ?? 'not found' }

  const ideaCard = project.idea_card as IdeaCard
  return {
    ideaCard,
    progress: ideaCard?.validationProgress,
  }
}
