'use server'

import { saveOnboardingData } from '@/app/actions/onboarding'
import type { PersonalityData, IdeaCard } from '@/app/actions/onboarding'

export type InterviewPhase = 'background' | 'action' | 'problem' | 'ideal' | 'summary' | 'revise' | 'done'

export type InterviewAnswers = {
  background?: string
  action?: string
  problem?: string
  ideal?: string
}

export type InterviewTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type InterviewState = {
  phase: InterviewPhase
  answers: InterviewAnswers
  history: InterviewTurn[]
  isPhaseDone: boolean
  finalSummary?: {
    title: string
    description: string
    background: string
    problem: string
    ideal: string
  }
}

const PHASE_PURPOSE: Record<string, string> = {
  background: 'ユーザーがなぜこのアプリを作りたいのかを言語化させる',
  action: 'ユーザーの過去の試行錯誤を引き出し、課題の輪郭を明確にする',
  problem: '本当の問題が何かを言語化させ、アプリで何を解決すべきかを見えやすくする',
  ideal: 'アプリで実現したい未来を具体的にイメージさせ、実装可能な形に落とし込む',
}

const PHASE_QUESTIONS: Record<string, string> = {
  background: 'どのような背景で、そのアプリを作ろうと思ったんですか？',
  action: '今までに、それを解決するためにどんなことをしてみましたか？',
  problem: 'その時に、一番の課題や壁は何だったんですか？',
  ideal: '完成したアプリで、理想の状態はどんな感じですか？',
}

function buildSystemPrompt(state: InterviewState): string {
  const accumulated = `
【現在までのユーザーの回答】
背景：${state.answers.background ?? '（未回答）'}
具体行動：${state.answers.action ?? '（未回答）'}
課題：${state.answers.problem ?? '（未回答）'}
理想：${state.answers.ideal ?? '（未回答）'}
`.trim()

  const phaseInfo =
    state.phase in PHASE_QUESTIONS
      ? `
【現在のフェーズ】${state.phase}
【このフェーズの目的】${PHASE_PURPOSE[state.phase]}
【初期質問】${PHASE_QUESTIONS[state.phase]}
`.trim()
      : ''

  return `
あなたはBloomerの企画メンター。ユーザーのアプリアイデアを「実現可能な形」に整理する対話を行う。

【絶対遵守ポリシー】
1. 同じ質問を繰り返さない。過去の回答を踏まえた次の質問を組み立てる
2. 「どう思いますか？」のような無内容な質問は禁止。すべての質問に明確な目的を持つ
3. ユーザーに「自分の本当に作りたいものが見えた」という気づきを生む
4. 曖昧な回答には次の順で対応：
   - 確認：「○○ですか、それとも△△ですか？」（二択で絞る）
   - 具体化：「具体例を1つ挙げてもらえますか？」
   - 再提示：「つまり、○○ということですね？」
5. 目的は「曖昧さを潰す」ことではなく「アイデアを実現可能な形に整理する」こと
6. 友達のような自然な口調。技術用語は使わない

【返答ルール】
- 1ターンに1つの質問のみ
- 返答は3文以内。前置きフレーズ禁止
- 箇条書き・番号付きリスト禁止
- 絵文字禁止

【現フェーズが明確に答えられたと判断した場合】
回答の最後に必ず以下のマーカーを付ける（ユーザーには見えない）：
%%%PHASE_DONE%%%
判断基準：そのフェーズの回答が、次のフェーズへ進むのに十分具体的か。
曖昧・短すぎる・確認が必要な場合はマーカーを付けず、深掘り質問をする。

${accumulated}

${phaseInfo}
`.trim()
}

function buildSummaryPrompt(answers: InterviewAnswers): string {
  return `
あなたはBloomerの企画メンター。
以下のユーザー回答を元に、アプリ企画を整理する。

【ユーザーの回答】
背景：${answers.background}
具体行動：${answers.action}
課題：${answers.problem}
理想：${answers.ideal}

【出力ルール】
以下のJSON形式のみで返すこと。前置き・説明・マークダウン禁止：

{
  "title": "アプリの名前案（20文字以内）",
  "description": "△△を解決して、◇◇を実現するアプリ（40文字以内）",
  "background": "ユーザーの背景を1文で要約",
  "problem": "解決すべき本当の課題を1文で",
  "ideal": "実現したい理想を1文で"
}
`.trim()
}

async function callGemini(
  systemPrompt: string,
  history: InterviewTurn[],
  userMessage: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY missing')

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ]

  let response: Response | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000))
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      }
    )
    if (response.ok || response.status !== 503) break
  }

  if (!response || !response.ok) {
    throw new Error(`Gemini API error: ${response?.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function processInterviewTurn(
  userMessage: string,
  state: InterviewState
): Promise<{ reply: string; nextState: InterviewState; error?: string }> {
  try {
    const systemPrompt = buildSystemPrompt(state)
    const rawReply = await callGemini(systemPrompt, state.history, userMessage)

    const isPhaseDone = rawReply.includes('%%%PHASE_DONE%%%')
    const cleanReply = rawReply.replace(/%%%PHASE_DONE%%%/g, '').trim()

    const updatedAnswers = { ...state.answers }
    if (isPhaseDone && state.phase in PHASE_QUESTIONS) {
      updatedAnswers[state.phase as keyof InterviewAnswers] = userMessage
    }

    const order: InterviewPhase[] = ['background', 'action', 'problem', 'ideal', 'summary']
    let nextPhase: InterviewPhase = state.phase
    if (isPhaseDone) {
      const currentIdx = order.indexOf(state.phase)
      if (currentIdx >= 0 && currentIdx < order.length - 1) {
        nextPhase = order[currentIdx + 1]
      }
    }

    const nextState: InterviewState = {
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

    return { reply: cleanReply, nextState }
  } catch (err) {
    return {
      reply: '',
      nextState: state,
      error: err instanceof Error ? err.message : '対話エンジンに接続できませんでした',
    }
  }
}

export async function generateSummary(answers: InterviewAnswers): Promise<{
  summary?: InterviewState['finalSummary']
  error?: string
}> {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return { error: 'GEMINI_API_KEY missing' }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildSummaryPrompt(answers) }] }],
        }),
      }
    )

    if (!response.ok) return { error: `Gemini API error: ${response.status}` }

    const data = await response.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean) as InterviewState['finalSummary']

    return { summary: parsed }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'サマリー生成失敗' }
  }
}

export async function finalizeInterview(
  summary: NonNullable<InterviewState['finalSummary']>,
  answers: InterviewAnswers
): Promise<{ success?: boolean; error?: string }> {
  const personality: PersonalityData = {
    timeUsage: '（idea-interview経由）',
    mbti: '（未指定）',
    localPain: summary.problem,
  }

  const ideaCard: IdeaCard = {
    title: summary.title,
    description: summary.description,
    questTitles: [
      '開発環境を整える',
      '最初の画面を作る',
      'データを保存できるようにする',
      'ログインできるようにする',
      '世界に公開する',
    ],
    questDescriptions: [
      `${summary.title}の開発環境を整える`,
      `${summary.title}のトップ画面を作る`,
      `${summary.title}のデータを保存する`,
      `${summary.title}にログイン機能を追加する`,
      `${summary.title}をインターネットに公開する`,
    ],
  }

  // saveOnboardingData に委譲してクエストステップ生成も含め一括処理
  return saveOnboardingData(personality, ideaCard, [ideaCard])
}
