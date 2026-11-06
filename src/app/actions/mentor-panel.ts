'use server'

import { createClient } from '@/lib/supabase/server'
import { searchKnowledge } from '@/app/actions/knowledge'
import { searchUserKnowledge } from '@/app/actions/user-knowledge'
import { BASE_SYSTEM_PROMPT, FINAL_PRIORITY, MENTOR_TEMPERATURE, toneBlock } from '@/lib/mentor-base'
import { getCustomMentor } from '@/app/actions/custom-mentors'
import { APP_TYPE_LABELS, APP_TYPE_FOCUS } from '@/lib/app-taxonomy'
import type { AppType } from '@/app/actions/onboarding'
import type { StuckPoint } from '@/app/actions/setup'
import { completeStepIfActive, recordStuckSignal } from '@/app/actions/setup'

export type MentorContext = {
  who: string
  what: string
  how: string
  questTitle: string
  stepTitle: string
  skillLevel?: number
  appType?: AppType
  stepId?: string
  doneCondition?: string
  stuckPoints?: StuckPoint[]
}

export type MentorToolContext = {
  projectId: string
  questNumber: 2 | 3 | 4 | 5
}

export async function getMentorContext(
  projectId: string,
  questTitle: string,
  stepTitle: string
): Promise<MentorContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { who: '（未設定）', what: '（未設定）', how: '（未設定）', questTitle, stepTitle }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_answers, selected_idea, skill_level')
    .eq('id', user.id)
    .single()

  const { data: project } = await supabase
    .from('project_ideas')
    .select('idea_card')
    .eq('id', projectId)
    .single()

  const ideaCard = project?.idea_card ?? profile?.selected_idea
  const answers = profile?.onboarding_answers as Record<string, string> | null
  const profileData = profile as Record<string, unknown> | null

  const validatedBrief = ideaCard?.validatedBrief

  return {
    who: validatedBrief?.who ?? ideaCard?.questDescriptions?.[0] ?? answers?.background ?? '（未設定）',
    what: validatedBrief?.what ?? answers?.problem ?? ideaCard?.description ?? '（未設定）',
    how: validatedBrief?.how ?? answers?.ideal ?? ideaCard?.title ?? '（未設定）',
    questTitle,
    stepTitle,
    skillLevel: typeof profileData?.skill_level === 'number' ? profileData.skill_level : 0.5,
    appType: ideaCard?.appType as AppType | undefined,
  }
}

export async function generateMentorSystemPrompt(
  questTitle: string,
  context: MentorContext
): Promise<{ prompt?: string; error?: string }> {
  const skillLevel = context.skillLevel ?? 0.5

  const hintDepthBlock = skillLevel <= 0.4
    ? `\n\n【ヒントの手厚さ：Fade-in（丁寧モード）】
このユーザーはまだ習熟度が低いため、ヒントをより丁寧に出してください。
- 方向づけの段階で、具体的な手がかりを1つ多く添える
- 「どこから確認すればいいか」を最初から示す
- メタ認知の問いはやさしい表現で（「どこを直したと思う？」など）`
    : skillLevel >= 0.7
    ? `\n\n【ヒントの手厚さ：Fade-out（自立モード）】
このユーザーは習熟度が高いため、ヒントを最小限にしてください。
- 方向づけだけ示し、特定・解の型は自分で辿り着かせる
- 「どう思う？」「まず何を試す？」のように引き出すことを優先
- 自力解決できたら積極的に %%%SOLVED%%% を付与`
    : ''

  const appTypeBlock = context.appType
    ? `\n- アプリの分類：${APP_TYPE_LABELS[context.appType]}（${APP_TYPE_FOCUS[context.appType]}）
  この分類の定石と落とし穴を踏まえ、寄り道しそうになったら核へ引き戻してください。`
    : ''

  const doneConditionBlock = context.doneCondition
    ? `\n- このステップの完了条件：${context.doneCondition}`
    : ''

  const stuckPointsBlock = context.stuckPoints && context.stuckPoints.length > 0
    ? '\n- 予想される詰まり:\n' + context.stuckPoints
        .map((sp) => `  - 症状「${sp.symptom}」→ 方向ヒント「${sp.hint_l1}」／具体ヒント「${sp.hint_l2}」`)
        .join('\n')
    : ''

  // stepId がある = ツール（complete_step/report_stuck）が使えるクエスト（q2〜q5）
  const toolBlock = context.stepId
    ? `\n\n【ツール呼び出しのルール】
- 現在のステップID（complete_step/report_stuckで使う値）：${context.stepId}
- ユーザーが完了を報告してきたら（「できた」「終わった」等）、まずこのステップの完了条件を自分の言葉で聞き返してください。ユーザーから確認が取れたら、その時に初めて complete_step ツールを呼んでください。確認が取れる前にツールを呼んではいけません
- complete_step の結果が success:false の場合は、完了したと言わずに状況を確認し直してください
- ユーザーが「エラーが出た」「動かない」と言ったら、まず report_stuck ツールを呼んで詰まりを記録し、その後 hint_l1 → （まだ詰まっていれば）hint_l2 の順でヒントを出してください

【入力分類（このステップの文脈で判断する）】
- 「これ分からない」（概念の詰まり）→ 思考プロセスの実演：「私ならこう考える→①…②…③…」と番号付きで見せ、最後に「どこまでピンときた?」と聞く
- 「エラーが出た」「動かない」（技術の詰まり）→ report_stuck を呼んでから hint_l1 → hint_l2 の順で出す。修正指示文をそのまま渡すのは hint_l2 でも解決しない場合の最終手段
- 「できたよ」（完了報告）→ 上記のツール呼び出しルールに従う
- ステップと無関係な質問（脱線）→ 一言だけ答えて、すぐ現在のステップに引き戻す`
    : ''

  const questRole = `\n\n【役割：クエスト常駐メンター】
あなたはユーザーが今取り組んでいるクエストの伴走者です。詰まりを解決し、前に進める手助けをします。

現在の状況：
- クエスト：${context.questTitle}
- ステップ：${context.stepTitle}${appTypeBlock}${doneConditionBlock}${stuckPointsBlock}
- ユーザーが作っているもの：
  誰のために：${context.who}
  何を解決する：${context.what}
  どうやって：${context.how}

この文脈を踏まえ「あなたのアプリでは、このステップはこういう意味がある」という形で、ユーザー固有の文脈に沿ってサポートしてください。一般的なAIでは出てこない、この人のプロジェクトに即した助けを。
詰まった時は、選択肢を1つずつ提示して原因を絞り込んでください。技術用語を避け、親しみやすい口調で。

【詰まった時のヒントの出し方】
- まず1つの質問で切り分ける:「概念（なぜそうするのか）が分からない? それとも書き方（どう書くか）が分からない?」→ 足りない側にだけ焦点を当てる
- ヒントは段階的に: ①何を確認すべきか（方向づけ）→ ②どこが問題か（特定）→ ③考え方の例（解の型）の順で、必要な段階まで
- 完成コードそのもの（答え丸ごと）は絶対に出さない
- ヒントを出す時は「なぜそう直すと思う?」のようなメタ認知を促す問いを1つ添える` +
    hintDepthBlock +
    toolBlock +
    `\n\n【内部マーカー（ユーザーには見せない・返答の最後に付与）】
- 完成コードや答えそのものを提示した場合は %%%GAVE_ANSWER%%% を出力する
- ユーザーが自分の力で問題を解決できたことが分かった場合は %%%SOLVED%%% を出力する`

  const prompt = BASE_SYSTEM_PROMPT + questRole + FINAL_PRIORITY
  return { prompt }
}

type GeminiPart = {
  text?: string
  functionCall?: { name: string; args: Record<string, unknown> }
}
type GeminiContent = { role: string; parts: GeminiPart[] }
type GeminiGenerateContentResponse = {
  candidates?: { content: GeminiContent }[]
}

const MENTOR_TOOL_DECLARATIONS = [
  {
    name: 'complete_step',
    description: 'ユーザーの完了条件の確認が取れた時だけ呼び出し、現在のステップを完了にする',
    parameters: {
      type: 'object',
      properties: {
        step_id: { type: 'string', description: '完了させるステップのID' },
      },
      required: ['step_id'],
    },
  },
  {
    name: 'report_stuck',
    description: 'ユーザーがエラーや「動かない」など技術的な詰まりを報告した時に呼び出す',
    parameters: {
      type: 'object',
      properties: {
        step_id: { type: 'string', description: '詰まっているステップのID' },
        symptom: { type: 'string', description: 'ユーザーが報告した詰まりの症状（そのままの言葉で）' },
      },
      required: ['step_id', 'symptom'],
    },
  },
]

export async function sendMentorMessage(
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string,
  temperature: number = MENTOR_TEMPERATURE.quest,
  toolContext?: MentorToolContext
): Promise<{ reply?: string; error?: string; completedStepId?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API key missing' }

  // RAG: ユーザーメッセージで知識検索（失敗してもフォールバック）
  let ragSection = ''
  try {
    const chunks = await searchKnowledge(userMessage)
    if (chunks.length > 0) {
      const knowledgeText = chunks
        .slice(0, 3)
        .map((c, i) => `${i + 1}. ${c.insight}${c.quest_seed ? `\n   クエストの種: ${c.quest_seed}` : ''}`)
        .join('\n')
      ragSection = `\n\n<bloomer_knowledge>\n以下はBloomerの設計思想と独自知識です。\n回答する際は、この知識を最優先で参照してください。\nChatGPTや一般的なAIでは絶対に出てこない、Bloomer固有の視点で回答してください。\n\n${knowledgeText}\n</bloomer_knowledge>`
    }
  } catch (err) {
    console.error('[MentorPanel] RAG検索失敗:', err)
  }

  let userKnowledgeBlock = ''
  try {
    const userChunks = await searchUserKnowledge(userMessage, {
      isCustom: false,
    })
    if (userChunks.length > 0) {
      userKnowledgeBlock = '\n<user_knowledge>\n以下はユーザー自身がアップロードした資料です。回答時に積極的に参照してください。\n' +
        userChunks.map((c) => c.content).join('\n---\n') +
        '\n</user_knowledge>'
    }
  } catch {
    // ユーザー資料RAG失敗はメンター応答に影響させない
  }

  const finalSystemPrompt = systemPrompt + ragSection + userKnowledgeBlock

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ]

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`
  const tools = toolContext ? [{ functionDeclarations: MENTOR_TOOL_DECLARATIONS }] : undefined

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: { temperature },
        system_instruction: { parts: [{ text: finalSystemPrompt }] },
        contents,
        ...(tools ? { tools } : {}),
      }),
    })

    if (!response.ok) return { error: `Gemini error: ${response.status}` }
    const data = (await response.json()) as GeminiGenerateContentResponse
    const modelContent = data.candidates?.[0]?.content
    const parts = modelContent?.parts ?? []
    const functionCallPart = parts.find((p) => p.functionCall)

    if (!functionCallPart || !toolContext || !modelContent) {
      const reply = parts.find((p) => p.text)?.text ?? ''
      return { reply }
    }

    // ツール呼び出し：サーバー側で検証・実行してから、結果をモデルに返して最終応答を生成する
    const { name, args } = functionCallPart.functionCall!
    let toolResult: Record<string, unknown>
    let completedStepId: string | undefined

    if (name === 'complete_step') {
      const stepId = String(args?.step_id ?? '')
      const result = await completeStepIfActive(toolContext.projectId, toolContext.questNumber, stepId)
      toolResult = result
      if (result.success) completedStepId = stepId
    } else if (name === 'report_stuck') {
      const stepId = String(args?.step_id ?? '')
      const symptom = String(args?.symptom ?? '')
      toolResult = await recordStuckSignal(toolContext.projectId, toolContext.questNumber, stepId, symptom)
    } else {
      toolResult = { success: false, reason: 'unknown_tool' }
    }

    const followupContents = [
      ...contents,
      modelContent,
      { role: 'user', parts: [{ functionResponse: { name, response: toolResult } }] },
    ]

    const followupResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: { temperature },
        system_instruction: { parts: [{ text: finalSystemPrompt }] },
        contents: followupContents,
        tools,
      }),
    })

    if (!followupResponse.ok) return { error: `Gemini error: ${followupResponse.status}` }
    const followupData = (await followupResponse.json()) as GeminiGenerateContentResponse
    const finalReply = followupData.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? ''
    return { reply: finalReply, completedStepId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'connection failed' }
  }
}

export async function generateStuckOptions(
  stepTitle: string,
  questTitle: string
): Promise<{ options?: string[]; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API key missing' }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `ユーザーが「${questTitle}」の「${stepTitle}」ステップで詰まっています。
初心者が詰まりやすい原因を4個、選択肢として提示してください。
各選択肢は技術用語なしで1行（20文字以内）。
最後に「その他（自由に話す）」を必ず入れてください。
JSON形式のみで返すこと（前置き不要）：
["選択肢1", "選択肢2", "選択肢3", "選択肢4", "その他（自由に話す）"]`
            }]
          }],
        }),
      }
    )

    if (!response.ok) return { error: `Gemini error: ${response.status}` }
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const options = JSON.parse(clean) as string[]
    return { options }
  } catch {
    return {
      options: ['エラーが出た', '何をすべきか分からない', 'コードが動かない', 'その他（自由に話す）']
    }
  }
}

export async function generateIdeaMentorSystemPrompt(
  questTitle: string
): Promise<{ prompt?: string; error?: string }> {
  const ideaRole = `\n\n【役割：アイデア壁打ちメンター】
あなたはダッシュボードで、ユーザーのアイデアを一緒に育てる相手です。「${questTitle}」というプロジェクトに取り組み始めたユーザーのアイデアを深掘りします。
「誰のために」「何を解決するか」「どうやって実現するか」を一緒に考え、ユーザーにわくわくを感じさせてください。提案は1つずつ、テンプレ的でない具体的なものを。親しみやすい口調で。`

  const prompt = BASE_SYSTEM_PROMPT + ideaRole + FINAL_PRIORITY
  return { prompt }
}

export async function generateGeneralMentorSystemPrompt(): Promise<{ prompt?: string; error?: string }> {
  const generalRole = `\n\n【役割：なんでも相談メンター】
あなたは「ちょっと頼れる先輩」くらいの距離感の相談相手です。友達ほどゆるくなく、先生ほど堅くない。

- 入口は広い。どんな話題でも、まず受け止めてください。「それは別の場所で聞いて」と突き放さない。他のメンターへ案内して、たらい回しにしない。何を持ってきても、ここで一緒に向き合う。
- 話を整理してあげる。ユーザーが漠然と困っている時は、「つまり〇〇ということ？」とモヤモヤを言語化してください。考えがまとまっていない状態を一緒に整理する。答えを急がず、まず「何に困っているのか」を一緒に掴む。

【内部マーカー（ユーザーには見せない・返答の最後に付与）】
- 完成コードや答えそのものを提示した場合は %%%GAVE_ANSWER%%% を出力する
- ユーザーが自分の力で問題を解決できたことが分かった場合は %%%SOLVED%%% を出力する`
  const styleBlock = '\n\n【回答スタイル：ライト】短く要点だけ（3〜5文程度）。答えから直接書き始めてください。'
  const prompt = BASE_SYSTEM_PROMPT + generalRole + styleBlock + toneBlock('balanced') + FINAL_PRIORITY
  return { prompt }
}

export async function generateCustomMentorSystemPrompt(
  customMentorId: string
): Promise<{ prompt?: string; error?: string }> {
  const mentor = await getCustomMentor(customMentorId)
  if (!mentor) return { error: 'カスタムメンターが見つかりません' }
  const markerBlock = `\n\n【内部マーカー（ユーザーには見せない・返答の最後に付与）】
- 完成コードや答えそのものを提示した場合は %%%GAVE_ANSWER%%% を出力する
- ユーザーが自分の力で問題を解決できたことが分かった場合は %%%SOLVED%%% を出力する`
  return { prompt: mentor.systemPrompt + markerBlock }
}
