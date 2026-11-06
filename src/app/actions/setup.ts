'use server'

import { createClient } from '@/lib/supabase/server'

export type StuckPoint = {
  symptom: string
  hint_l1: string
  hint_l2: string
}

export type SetupStep = {
  id: string
  title: string
  description: string
  link?: string | null
  linkLabel?: string | null
  completed: boolean
  type?: 'thinking' | 'task'
  question?: string
  placeholder?: string
  userAnswer?: string
  done_condition?: string
  stuck_points?: StuckPoint[]
  est_minutes?: number
}

type QuestContext = {
  who: string
  what: string
  how: string
}

export async function generateSetupSteps(
  ideaTitle: string,
  ideaDescription: string,
  context?: QuestContext
): Promise<SetupStep[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return getDefaultSetupSteps()

  const contextString = context
    ? `\n【プロジェクトの前提条件】\n- 誰のために: ${context.who}\n- 何を解決する: ${context.what}\n- どうやって: ${context.how}\nこの前提条件を必ず考慮してセットアップ手順を生成してください。`
    : ''

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `あなたはWebアプリ開発の専門家です。
以下のアプリを作るために必要な「開発環境の構築ステップ」を提案してください。

【アプリ情報】
- タイトル: ${ideaTitle}
- 概要: ${ideaDescription}${contextString}

【ルール】
- 初心者向けに4〜6ステップで構成すること
- 技術用語は使わず、わかりやすい言葉で書くこと
- そのアプリに特有のAPIやツールがあれば含めること
  例：地図アプリ→Google Maps API、音楽アプリ→Spotify API
- 必ず以下のJSON形式のみで返すこと（前置き・説明不要）

[
  {
    "id": "step-1",
    "title": "ステップのタイトル（15文字以内）",
    "description": "何をするか・なぜ必要かを2文で説明",
    "link": "公式サイトのURL（あれば）",
    "linkLabel": "リンクのラベル（例：公式サイトを開く）",
    "completed": false
  }
]`
            }]
          }]
        }),
      }
    )

    if (!response.ok) return getDefaultSetupSteps()

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return parsed

  } catch {
    return getDefaultSetupSteps()
  }
}

function getDefaultSetupSteps(): SetupStep[] {
  return [
    {
      id: 'step-1',
      title: 'Node.jsをインストール',
      description: 'アプリを動かすための土台です。公式サイトからLTS版をダウンロードしてください。',
      link: 'https://nodejs.org',
      linkLabel: '公式サイトを開く',
      completed: false,
    },
    {
      id: 'step-2',
      title: 'VS Codeをインストール',
      description: 'コードを書くためのエディタです。世界中の開発者が使っている定番ツールです。',
      link: 'https://code.visualstudio.com',
      linkLabel: '公式サイトを開く',
      completed: false,
    },
    {
      id: 'step-3',
      title: 'GitHubアカウントを作る',
      description: 'あなたのコードを保存する場所です。無料で使えます。',
      link: 'https://github.com',
      linkLabel: 'GitHubを開く',
      completed: false,
    },
    {
      id: 'step-4',
      title: 'Supabaseアカウントを作る',
      description: 'アプリのデータを保存するデータベースです。無料枠で十分使えます。',
      link: 'https://supabase.com',
      linkLabel: 'Supabaseを開く',
      completed: false,
    },
  ]
}

export async function generateQuestSteps(
  questNumber: 2 | 3 | 4 | 5,
  ideaTitle: string,
  ideaDescription: string,
  context?: QuestContext
): Promise<SetupStep[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return getDefaultQuestSteps(questNumber)

  const contextString = context
    ? `\n【プロジェクトの前提条件】\n- 誰のために: ${context.who}\n- 何を解決する: ${context.what}\n- どうやって: ${context.how}\nこの前提条件を必ず考慮してステップを生成してください。`
    : ''

  const questThemes = {
    2: '最初の画面を作る（UI構築）。AIが提案した3つのデザイン案から選ぶだけで画面が完成し、仮公開URLで友達に見せられるようにする。',
    3: 'データを保存できるようにする（データベース連携）。ユーザーの情報やアプリのデータを永続的に保存できるようにする。',
    4: '仕上げる（品質の磨き込み）。エラーが出ても壊れない・スマホでも画面が崩れない・データが空でも寂しくない状態にして、人に見せて恥ずかしくないアプリにする。',
    5: '世界に公開する（本番デプロイ）。完成したアプリをインターネットに公開して、誰でもアクセスできるようにする。',
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
              text: `あなたはWebアプリ開発の専門家です。
以下のアプリを作るための「クエスト${questNumber}」のステップを提案してください。

【アプリ情報】
- タイトル: ${ideaTitle}
- 概要: ${ideaDescription}${contextString}

【クエスト${questNumber}のテーマ】
${questThemes[questNumber]}

【ルール】
- 初心者向けに3〜5ステップで構成すること
- 技術用語は使わず、わかりやすい言葉で書くこと
- そのアプリに特有の内容を含めること
- done_condition は必ず「〜が画面に出たらOK」の形式で、ユーザーが自分の目で確認できる内容にすること
- stuck_points は各ステップに1〜2件。hint_l1 は方向だけのヒント、hint_l2 は具体的に何をするかのヒント（どちらも技術用語なし）
- est_minutes は15〜30の数値
- 必ず以下のJSON形式のみで返すこと（前置き・説明不要）

[
  {
    "id": "step-1",
    "title": "ステップのタイトル（15文字以内）",
    "description": "何をするか・なぜ必要かを2文で説明",
    "link": "参考URLがあれば。なければnull",
    "linkLabel": "リンクのラベル。なければnull",
    "completed": false,
    "done_condition": "〜が画面に出たらOK、の形式で完了条件を書く",
    "stuck_points": [
      { "symptom": "詰まりがちな症状", "hint_l1": "方向だけのヒント", "hint_l2": "具体的に何をするかのヒント" }
    ],
    "est_minutes": 20
  }
]`
            }]
          }]
        }),
      }
    )

    if (!response.ok) return getDefaultQuestSteps(questNumber)

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return parsed

  } catch {
    return getDefaultQuestSteps(questNumber)
  }
}

function getDefaultQuestSteps(questNumber: 2 | 3 | 4 | 5): SetupStep[] {
  const defaults: Record<2 | 3 | 4 | 5, SetupStep[]> = {
    2: [
      {
        id: 'step-1',
        title: 'デザインを決める',
        description: 'アプリの見た目を決めます。色やレイアウトを選んでください。',
        link: 'https://v0.dev',
        linkLabel: 'AIデザイナーを開く',
        completed: false,
        done_condition: '3つのデザイン案が画面に出たらOK',
        stuck_points: [
          {
            symptom: 'イメージと違う見た目が出た',
            hint_l1: '一旦それも見てみよう。近いものを選んでから直す方が早いよ',
            hint_l2: '「ここの色をもっと明るく」のように、直したい場所を一言で伝えてみて',
          },
        ],
        est_minutes: 20,
      },
      {
        id: 'step-2',
        title: '最初の画面を作る',
        description: 'トップページを作成します。ユーザーが最初に見る画面です。',
        link: null,
        linkLabel: null,
        completed: false,
        done_condition: 'トップページがプレビューに表示されたらOK',
        stuck_points: [
          {
            symptom: 'どこを直してと言えばいいか分からない',
            hint_l1: '画面のどの部分が気になるか、指差すつもりで教えて',
            hint_l2: '「上のボタンをもっと大きく」のように場所＋直したい内容で伝えてみて',
          },
        ],
        est_minutes: 25,
      },
      {
        id: 'step-3',
        title: '仮公開する',
        description: '友達に見せるためのプレビューURLを発行します。',
        link: 'https://vercel.com',
        linkLabel: 'Vercelを開く',
        completed: false,
        done_condition: 'プレビューURLが発行されて自分のスマホで開けたらOK',
        stuck_points: [
          {
            symptom: 'URLを開いても画面が出ない',
            hint_l1: '発行にちょっと時間がかかることがあるよ。少し待ってから開き直してみよう',
            hint_l2: 'もう一度リンクをコピーし直して、別のタブで開いてみて',
          },
        ],
        est_minutes: 15,
      },
    ],
    3: [
      {
        id: 'step-1',
        title: 'データベースを設計する',
        description: '何のデータを保存するか決めます。アプリの心臓部になります。',
        link: 'https://supabase.com',
        linkLabel: 'Supabaseを開く',
        completed: false,
        done_condition: '保存する項目のリストが画面に出たらOK',
        stuck_points: [
          {
            symptom: '何を保存すればいいか分からない',
            hint_l1: 'アプリで一番大事な「入力する情報」から考えてみよう',
            hint_l2: 'ユーザーが入力する項目を1つずつ箇条書きにしてみて',
          },
        ],
        est_minutes: 20,
      },
      {
        id: 'step-2',
        title: 'テーブルを作る',
        description: 'データを整理して保存するための箱を作ります。',
        link: null,
        linkLabel: null,
        completed: false,
        done_condition: '保存の箱（テーブル）が一覧に出たらOK',
        stuck_points: [
          {
            symptom: '保存されない',
            hint_l1: '箱そのものはできてるかも。保存の仕組みを一緒に見てみよう',
            hint_l2: '入力後に赤いエラーが出ていないか、画面を確認してみて',
          },
          {
            symptom: 'エラーの赤い文字が怖い',
            hint_l1: '大丈夫、エラーは壊れたサインじゃなくて「ヒント」だよ。一緒に読もう',
            hint_l2: 'エラー文をそのままメンターに貼り付けて聞いてみて',
          },
        ],
        est_minutes: 30,
      },
      {
        id: 'step-3',
        title: 'データを読み書きする',
        description: 'アプリからデータを保存・取得できるようにします。',
        link: null,
        linkLabel: null,
        completed: false,
        done_condition: '自分で入力した内容が一覧に表示されたらOK',
        stuck_points: [
          {
            symptom: '表示されない',
            hint_l1: '保存はできてるかも。表示側の更新を見てみよう',
            hint_l2: 'ページを再読み込みして、それでも出るか確認してみて',
          },
        ],
        est_minutes: 25,
      },
    ],
    // クエスト4「仕上げる（polish）」: エラーでも壊れない・スマホでも崩れない・空っぽでも寂しくない
    4: [
      {
        id: 'step-1',
        title: 'エラーでも壊れない',
        description: '変な操作をしてもアプリが落ちないようにします。エラー時は優しい日本語メッセージを表示します。',
        link: null,
        linkLabel: null,
        completed: false,
        done_condition: 'わざと空のまま送信しても、画面が壊れずに優しいメッセージが出たらOK',
        stuck_points: [
          {
            symptom: '何を直せばいいか分からない（完成が見えない不安）',
            hint_l1: '完成の形は決まってないから大丈夫。まずは「わざと変な操作」を1つ試してみよう',
            hint_l2: '何も入力せずに送信ボタンを押して、どうなるか見てみて',
          },
        ],
        est_minutes: 20,
      },
      {
        id: 'step-2',
        title: 'スマホでも崩れない',
        description: 'スマホの小さな画面で見ても、レイアウトが崩れないように整えます。',
        link: null,
        linkLabel: null,
        completed: false,
        done_condition: 'スマホの画面幅で見ても、文字やボタンがはみ出さずに表示されたらOK',
        stuck_points: [
          {
            symptom: '何を直せばいいか分からない（完成が見えない不安）',
            hint_l1: 'まずはスマホの画面幅で自分のアプリを開いて見てみよう。気になる場所が見つかるはず',
            hint_l2: 'ブラウザの画面を狭くして、はみ出している部分をメンターに伝えてみて',
          },
        ],
        est_minutes: 20,
      },
      {
        id: 'step-3',
        title: '空っぽでも寂しくない',
        description: 'データがまだ無いときの画面に、案内メッセージを表示して迷わないようにします。',
        link: null,
        linkLabel: null,
        completed: false,
        done_condition: 'データが1件も無い状態で開いても、案内メッセージが表示されたらOK',
        stuck_points: [
          {
            symptom: '何を直せばいいか分からない（完成が見えない不安）',
            hint_l1: 'データを全部消したつもりで画面を想像してみよう。何も無いと寂しいよね',
            hint_l2: '「まだデータがありません」のような一言メッセージを表示させてみて',
          },
        ],
        est_minutes: 20,
      },
    ],
    // ▼ ログイン関連の旧ステップ定義（削除せず温存）
    //    クエスト6「鍵をかける」（公開後追加クエスト）へ移動予定
    // 4: [
    //   {
    //     id: 'step-1',
    //     title: '認証を設定する',
    //     description: 'ユーザーがアカウントを作れるようにします。',
    //     link: 'https://supabase.com/docs/guides/auth',
    //     linkLabel: '認証ガイドを見る',
    //     completed: false,
    //   },
    //   {
    //     id: 'step-2',
    //     title: 'ログイン画面を作る',
    //     description: 'メールアドレスとパスワードでログインできる画面を作ります。',
    //     link: null,
    //     linkLabel: null,
    //     completed: false,
    //   },
    //   {
    //     id: 'step-3',
    //     title: 'ログアウトを実装する',
    //     description: 'ユーザーが安全にログアウトできるようにします。',
    //     link: null,
    //     linkLabel: null,
    //     completed: false,
    //   },
    // ],
    5: [
      {
        id: 'step-1',
        title: 'コードを保存する',
        description: 'GitHubにコードをアップロードして永久保存します。',
        link: 'https://github.com',
        linkLabel: 'GitHubを開く',
        completed: false,
        done_condition: 'GitHub上に自分のコードが表示されたらOK',
        stuck_points: [
          {
            symptom: '公開して大丈夫か不安',
            hint_l1: 'ここではまだ誰にも見られないよ。安心して進めて大丈夫',
            hint_l2: '不安な点を一言でいいのでメンターに教えて。一緒に確認しよう',
          },
        ],
        est_minutes: 15,
      },
      {
        id: 'step-2',
        title: '本番環境を設定する',
        description: '世界に公開するための設定をします。',
        link: 'https://vercel.com',
        linkLabel: 'Vercelを開く',
        completed: false,
        done_condition: '設定完了の画面が表示されたらOK',
        stuck_points: [
          {
            symptom: '公開して大丈夫か不安',
            hint_l1: 'ここまでの作業はいつでもやり直せるから安心して',
            hint_l2: '設定画面のスクリーンショットをメンターに見せながら聞いてみて',
          },
        ],
        est_minutes: 15,
      },
      {
        id: 'step-3',
        title: '世界に公開する',
        description: 'URLを発行してインターネットに公開します。',
        link: null,
        linkLabel: null,
        completed: false,
        done_condition: '公開URLを自分のスマホで開けたらOK',
        stuck_points: [
          {
            symptom: 'URLを人に見せる勇気が出ない',
            hint_l1: 'まずは自分だけで開いて確認しよう。誰かに見せるのはその後でいい',
            hint_l2: '発行されたURLをコピーして、自分のスマホのブラウザで開いてみて',
          },
        ],
        est_minutes: 15,
      },
    ],
  }
  return defaults[questNumber]
}

export async function updateQuestStepCompletion(
  projectId: string,
  questNumber: 2 | 3 | 4 | 5,
  stepId: string,
  completed: boolean
): Promise<void> {
  const supabase = await createClient()
  const columnName = `quest${questNumber}_steps`

  const { data } = await supabase
    .from('project_ideas')
    .select(columnName)
    .eq('id', projectId)
    .single()

  const steps = ((data as unknown as Record<string, unknown>)?.[columnName] ?? []) as SetupStep[]
  const updated = steps.map((s) =>
    s.id === stepId ? { ...s, completed } : s
  )

  await supabase
    .from('project_ideas')
    .update({ [columnName]: updated })
    .eq('id', projectId)
}

// 現在のアクティブステップ（未完了の先頭）を取得する内部ヘルパー。
// メンターのツール呼び出しは必ずこれと照合し、一致しない申告は無視する。
function findActiveStep(steps: SetupStep[]): SetupStep | undefined {
  return steps.find((s) => !s.completed)
}

// メンターの complete_step ツールの実体。LLMの申告を無検証でDBに書かないため、
// 呼び出し前に stepId が現在のアクティブステップと一致するかをサーバー側で検証する。
export async function completeStepIfActive(
  projectId: string,
  questNumber: 2 | 3 | 4 | 5,
  stepId: string
): Promise<{ success: boolean; reason?: string; nextStepTitle?: string | null }> {
  const supabase = await createClient()
  const columnName = `quest${questNumber}_steps`

  const { data } = await supabase
    .from('project_ideas')
    .select(columnName)
    .eq('id', projectId)
    .single()

  const steps = ((data as unknown as Record<string, unknown>)?.[columnName] ?? []) as SetupStep[]
  const activeStep = findActiveStep(steps)

  if (!activeStep) return { success: false, reason: 'no_active_step' }
  if (activeStep.id !== stepId) return { success: false, reason: 'not_active_step' }

  await updateQuestStepCompletion(projectId, questNumber, stepId, true)

  const updatedSteps = steps.map((s) => (s.id === stepId ? { ...s, completed: true } : s))
  const nextStep = findActiveStep(updatedSteps)
  return { success: true, nextStepTitle: nextStep?.title ?? null }
}

// メンターの report_stuck ツールの実体。詰まりは今のステップの話であるべきなので、
// complete_step と同じくアクティブステップとの一致を検証してから記録する。
export async function recordStuckSignal(
  projectId: string,
  questNumber: 2 | 3 | 4 | 5,
  stepId: string,
  symptom: string
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const columnName = `quest${questNumber}_steps`

  const { data } = await supabase
    .from('project_ideas')
    .select(columnName)
    .eq('id', projectId)
    .single()

  const steps = ((data as unknown as Record<string, unknown>)?.[columnName] ?? []) as SetupStep[]
  const activeStep = findActiveStep(steps)
  if (!activeStep || activeStep.id !== stepId) return { success: false }

  const { logGenerationEvent } = await import('@/app/actions/generation-log')
  await logGenerationEvent({
    projectId,
    eventType: 'stuck_report',
    questNumber,
    outcome: 'success',
    detail: symptom,
  })

  return { success: true }
}

export async function updateStepCompletion(
  projectId: string,
  stepId: string,
  completed: boolean
): Promise<void> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('project_ideas')
    .select('setup_steps')
    .eq('id', projectId)
    .single()

  const steps = (data?.setup_steps ?? []) as SetupStep[]
  const updated = steps.map((s) =>
    s.id === stepId ? { ...s, completed } : s
  )

  await supabase
    .from('project_ideas')
    .update({ setup_steps: updated })
    .eq('id', projectId)
}

export async function saveStepAnswer(
  projectId: string,
  questId: string,
  stepId: string,
  answer: string
): Promise<void> {
  const supabase = await createClient()

  const config = await import('@/lib/quest-utils').then(m => m.QUEST_CONFIG)
  const questConfig = config[questId as keyof typeof config]
  if (!questConfig) return

  const columnName = questConfig.columnName

  const { data } = await supabase
    .from('project_ideas')
    .select(columnName)
    .eq('id', projectId)
    .single()

  const steps = ((data as unknown as Record<string, unknown>)?.[columnName] ?? []) as SetupStep[]
  const updated = steps.map((s) =>
    s.id === stepId ? { ...s, userAnswer: answer } : s
  )

  await supabase
    .from('project_ideas')
    .update({ [columnName]: updated })
    .eq('id', projectId)
}

const QUEST_COLUMN: Record<2 | 3 | 4 | 5, string> = {
  2: 'quest2_steps',
  3: 'quest3_steps',
  4: 'quest4_steps',
  5: 'quest5_steps',
}

// ステップが空のクエストを開いた時に自動生成して返す（既存プロジェクトの救済 + 恒久対策）
export async function ensureQuestSteps(
  projectId: string,
  questNumber: 2 | 3 | 4 | 5
): Promise<SetupStep[]> {
  const supabase = await createClient()
  const columnName = QUEST_COLUMN[questNumber]

  const { data: project } = await supabase
    .from('project_ideas')
    .select(`${columnName}, title, description, idea_card`)
    .eq('id', projectId)
    .single()

  if (!project) return []

  const p = project as unknown as Record<string, unknown>

  const existing = p[columnName] as SetupStep[] | null
  if (existing && existing.length > 0) return existing

  let ideaCard = p.idea_card as import('@/app/actions/onboarding').IdeaCard | null

  // 自己修復: appType 未確定なら、その場で分類して保存する
  // （ダッシュボードの「完了にする」等、検証インタビューを通らずに q1 が完了した経路への対応）
  if (ideaCard && !ideaCard.appType) {
    const { classifyIdea } = await import('@/app/actions/idea-classification')
    const { logGenerationEvent } = await import('@/app/actions/generation-log')
    const { appType, error } = await classifyIdea(ideaCard, ideaCard.validatedBrief)
    void logGenerationEvent({
      projectId,
      eventType: 'classification',
      appType: error ? undefined : appType,
      outcome: error ? 'error' : 'success',
      detail: error ?? 'self-heal (ensureQuestSteps)',
    })
    if (!error) {
      ideaCard = { ...ideaCard, appType }
      await supabase
        .from('project_ideas')
        .update({ idea_card: ideaCard })
        .eq('id', projectId)
    }
  }

  // 分類確定済みなら分類特化の土台生成を優先（失敗時は従来の汎用生成にフォールバック）
  if (ideaCard?.appType) {
    const { generateFoundationQuest } = await import('@/app/actions/foundation-generation')
    const { logGenerationEvent } = await import('@/app/actions/generation-log')
    const foundation = await generateFoundationQuest(questNumber, ideaCard)
    void logGenerationEvent({
      projectId,
      eventType: 'foundation_generation',
      questNumber,
      appType: ideaCard.appType,
      outcome: foundation ? 'success' : 'fallback',
      detail: foundation ? undefined : 'RAGヒット0件または生成失敗→汎用生成へ',
    })
    if (foundation) {
      // ステップと一緒に、このクエストのタイトル・説明もダッシュボード表示用に更新する
      const questTitles = [...(ideaCard.questTitles ?? [])]
      const questDescriptions = [...(ideaCard.questDescriptions ?? [])]
      questTitles[questNumber - 1] = foundation.title
      questDescriptions[questNumber - 1] = foundation.description

      await supabase
        .from('project_ideas')
        .update({
          [columnName]: foundation.steps,
          idea_card: { ...ideaCard, questTitles, questDescriptions },
        })
        .eq('id', projectId)
      return foundation.steps
    }
  }

  const questContext = {
    who: ideaCard?.questDescriptions?.[0] ?? '（未設定）',
    what: p.description as string ?? '（未設定）',
    how: p.description as string ?? '（未設定）',
  }

  const steps = await generateQuestSteps(
    questNumber,
    p.title as string,
    p.description as string,
    questContext
  )

  await supabase
    .from('project_ideas')
    .update({ [columnName]: steps })
    .eq('id', projectId)

  return steps
}
