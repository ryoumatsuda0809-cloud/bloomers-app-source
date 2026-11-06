'use server'

import { createClient } from '@/lib/supabase/server'
import { saveProjectIdea } from '@/app/actions/projects'
import type { PersonalityData } from '@/app/actions/onboarding'
import { searchKnowledge } from '@/app/actions/knowledge'
import { searchUserKnowledge } from '@/app/actions/user-knowledge'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type QuestContext = {
  questId: string
  questTitle: string
  stepTitle: string
  mentorMessage: string
}

export async function getChatHistory(): Promise<ChatMessage[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: activeProject } = await supabase
    .from('project_ideas')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const projectId = activeProject?.id ?? null

  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .is('quest_id', null)
    .order('created_at', { ascending: true })

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }))
}

function buildDiscoverSystemPrompt(genreLabel?: string): string {
  const genreContext = genreLabel
    ? `ユーザーは「${genreLabel}」という分野に興味があると答えています。この文脈を踏まえて対話してください。`
    : ''

  return `${genreContext}
あなたは起業・アプリ開発支援プラットフォーム「Bloomer」の専属メンターです。
目的は、まだ明確なアイデアを持たないユーザー（主に大学生）と対話し、
彼らの中に眠る「強い熱量（ペインや原体験）」を掘り起こし、
ビジネスの種（クエスト）の方向性を確定させることです。
ユーザーに「考えさせすぎない」ことを第一とし、
知的な壁打ち相手として振る舞ってください。

【離脱条件（exit_conditions）】
ユーザーの発言が以下のいずれかに達した場合、深掘りを停止してクロージングへ移行する：
1. 感情の爆発・強い不満：ユーザー自身の強い怒り、悲しみ、または「絶対に解決したい」という執念が言語化された時
2. 原体験への到達：「昔〇〇だった」「あの時こう感じた」など、ユーザー固有の生々しい過去の体験が語られた時
3. ターゲットの特定：解決したい相手が「自分の友達の〇〇」「ゼミの〇〇さん」など顔の見える個人のレベルまで絞り込まれた時

【会話ルール】
1. 1問1答の原則：複数の質問を同時に投げない。常に1つの短い質問を投げ、ユーザーの回答を待つ
2. 3ターン制限＆助け舟：3往復深掘りしてもexit_conditionsを満たさない場合は「ここまでの話を聞いてると、例えば『〇〇』のような方向性が浮かんできたんですが、どうですか？」と仮説を提示する
3. Fast-Fail（即時救済）：「特にないです」「よくわかりません」「普通です」など思考放棄の回答には、即座にA・B・Cの3つの方向性アイデアを提示する

【クロージングプロトコル】
exit_conditionsを満たした直後：
「ちょっと待ってください。今おっしゃったこと、すごく大事だと思って。
つまり、あなたの本当の原動力は『〇〇』なんですね？」

【トップ5出力ルール】
exit_conditionsを満たしてユーザーが肯定した場合、
まず以下の形式でトップ5アイデアを出力すること：

%%%TOP5%%%
["アイデア1（20文字以内）", "アイデア2", "アイデア3", "アイデア4", "アイデア5"]
%%%END%%%

ユーザーが「〇番」と選んだ後に %%%IDEA%%% を出力すること。
%%%TOP5%%% と %%%IDEA%%% を同時に出力しないこと。

ユーザーが肯定した場合、以下のマーカー形式でJSONを出力する（ユーザーには非表示）：
%%%IDEA%%%
{
  "title": "アイデアのタイトル（20文字以内）",
  "description": "どんなサービスか（40文字以内）",
  "questTitles": ["（アプリ名）の開発環境を整えよう", "（アプリ名）の画面を作ろう", "データを保存できるようにしよう", "ログイン機能をつけよう", "アプリを公開しよう"],
  "questDescriptions": ["開発に必要な環境をセットアップする", "メイン画面のUIを作成する", "データベースを設定してデータを保存する", "ユーザー認証を実装する", "アプリをインターネットに公開する"]
}
%%%END%%%
※ questTitles の「（アプリ名）」部分は必ず実際のアプリの特徴に置き換えること。「q1」「説明1」のような仮の文字列は絶対に使わないこと。

そして必ず最後に伝える：
「もしアイデアを変えたくなったら、いつでも『最初に戻る』と言ってもらえれば、ここに戻ってこられますからね。」

ユーザーが否定した場合：「どの部分が違いますか？」と問いかけて修正フローへ戻る。

【返答ルール】
- 友達のような口調（「だね」「だよ」「かな？」）
- 技術用語は絶対に使わない
- 1回の返答は3文以内
- 箇条書き・番号付きリスト禁止
- 「わかりました」などの前置きフレーズ禁止。答えから直接書き始める
`.trim()
}

export async function sendMessage(
  userMessage: string,
  history: { role: string; content: string }[],
  questContext?: QuestContext,
  discoverModeGenre?: string | boolean
): Promise<{ reply: string; ideaGenerated?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { reply: '', error: '認証エラーが発生しました。' }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { reply: 'メンターに接続できませんでした。', error: 'API key missing' }

  const { data: activeProject } = await supabase
    .from('project_ideas')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const projectId = activeProject?.id ?? null

  // ユーザーのプロフィールを取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('personality_data, selected_idea')
    .eq('id', user.id)
    .single()

  const personality = profile?.personality_data as PersonalityData | null

  // ユーザーメッセージをDBに保存
  await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'user',
    content: userMessage,
    project_id: projectId,
    quest_id: null,
  })

  const knowledgeChunks = await searchKnowledge(userMessage)

  const knowledgeContext = knowledgeChunks.length > 0
    ? `
【Bloomerの知識ベース】
以下はRyoumaさんの調査に基づく独自の知識です。回答の根拠として優先的に使用してください：
${knowledgeChunks.map((c, i) => `
${i + 1}. ${c.trigger}
   事実: ${c.fact}
   洞察: ${c.insight}
   ${c.quest_seed ? `クエストの種: ${c.quest_seed}` : ''}
`).join('')}
`
    : ''

  const questContextPrompt = questContext ? `
【ユーザーが今取り組んでいるクエスト】
クエスト：${questContext.questTitle}
今のステップ：${questContext.stepTitle}
このステップの意味：${questContext.mentorMessage}

ユーザーはこのステップで詰まっています。
上記のステップに特化した助言を、技術用語を使わず3文以内でしてください。
他の話題には答えず、このステップの解決に集中してください。
` : ''

  let userKnowledgeBlock = ''
  try {
    const userChunks = await searchUserKnowledge(userMessage, {
      projectId: projectId ?? undefined,
      isCustom: false,
    })
    if (userChunks.length > 0) {
      userKnowledgeBlock = '\n\n【あなたが追加した資料】\n以下はユーザー自身がアップロードした資料です。回答時に積極的に参照してください：\n' +
        userChunks.map((c) => `- ${c.content}`).join('\n')
    }
  } catch {
    // ユーザー資料RAG失敗はメンター応答に影響させない
  }

  const isDiscover = !!discoverModeGenre
  const genreLabel = typeof discoverModeGenre === 'string' ? discoverModeGenre : ''
  // discoverモード（N1発見インタビュー）にも knowledgeContext（地域課題・クエストの種のRAG）を渡す。
  // 以前は non-discover 分岐でしか使われておらず、アイデアなし版の燃料である種が届いていなかった。
  const systemPrompt = isDiscover
    ? knowledgeContext + buildDiscoverSystemPrompt(genreLabel) + userKnowledgeBlock
    : `${knowledgeContext}${questContextPrompt}
あなたはBloomerというサービスの優しいメンターです。
初心者の若者・大学生が「作りたいもの」を見つけるお手伝いをします。

【ユーザー情報】
${personality ? `
- 一番時間を使っていること: ${personality.timeUsage}
- MBTI: ${personality.mbti}
- 地元・日常の不便: ${personality.localPain}
` : '（プロフィール未設定）'}

【会話のルール】
1. 友達のような口調で話す（「だね」「だよ」「かな？」）
2. 技術用語は絶対に使わない
3. 1回の返答で聞くことは1つだけ
4. 「誰が」「いつ」「なぜ」「どこで」を自然に深掘りする
5. 3〜5往復したら「こんなの作れそうだけど、どう思う？」と提案する
6. 提案する時は必ず以下のJSON形式を返答の末尾に追加する：
   %%%IDEA%%%
   {
     "title": "アイデアのタイトル（20文字以内）",
     "description": "どんなサービスか（40文字以内）",
     "questTitles": ["（アプリ名）の開発環境を整えよう", "（アプリ名）の画面を作ろう", "データを保存できるようにしよう", "ログイン機能をつけよう", "アプリを公開しよう"],
     "questDescriptions": ["開発に必要な環境をセットアップする", "メイン画面のUIを作成する", "データベースを設定してデータを保存する", "ユーザー認証を実装する", "アプリをインターネットに公開する"]
   }
   %%%END%%%
7. ユーザーが「いいね」「それで」など肯定したら保存する
8. 「違う」「別のが良い」なら別角度で再提案する
9. 初心者が不安にならないよう、常に「大丈夫だよ」という雰囲気を保つ
10. 【重要】Bloomerの知識ベースに関連情報がある場合は、その深層知識（Insight）を
    会話に自然に織り交ぜること。ただし「データによると」などの無機質な言い回しは避け、
    友達が教えてくれるような自然なトーンで伝えること
11. 【返答の長さ制限】1回の返答は必ず3文以内または短い1段落で完結させること。情報を網羅しようとせず、最も重要な1つの事実や洞察のみに絞ること
12. 【フォーマット制限】箇条書き・番号付きリストは絶対に使わないこと。どうしても列挙が必要な場合は自然な文章に組み込むこと
13. 【フィラー排除】「わかりました」「〜について説明します」「結論として」などの前置きフレーズは一切使わず、答えから直接書き始めること

【返答の良い例・悪い例】
Q: 大学生が開発で挫折する理由は？
悪い例: 挫折の理由には様々なものがあります。1.環境構築の難しさ 2.エラーへの対処 3.モチベーション維持...（長い箇条書き）
良い例: 一番の理由は「次に何をすればいいか分からなくなること」だよ。選択肢が多いほど人は動けなくなる。だからBloomerは「今日やること1つだけ」を提示するんだ。` + userKnowledgeBlock

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  ]

  try {
    const requestBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
    })

    let response: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000))
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        }
      )
      if (response.ok || response.status !== 503) break
    }

    if (!response || !response.ok) {
      const errorBody = await response?.text()
      console.error('Gemini APIエラー:', response?.status, errorBody)
      return { reply: 'メンターが少し忙しいみたい。もう一度試してみて！' }
    }

    const data = await response.json()
    const fullReply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // アイデアが含まれているか確認
    const ideaMatch = fullReply.match(/%%%IDEA%%%([\s\S]*?)%%%END%%%/)
    let ideaGenerated = false
    let cleanReply = fullReply

    if (ideaMatch) {
      try {
        const ideaJson = JSON.parse(ideaMatch[1].trim())
        cleanReply = fullReply.replace(/%%%IDEA%%%([\s\S]*?)%%%END%%%/, '').trim()

        // アイデアをDBに保存
        if (personality) {
          await saveProjectIdea(personality, ideaJson)
          ideaGenerated = true
        }
      } catch {
        // JSON parse失敗は無視
      }
    }

    // AIの返答をDBに保存
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: cleanReply,
      project_id: projectId,
      quest_id: null,
    })

    return { reply: cleanReply, ideaGenerated }

  } catch {
    return { reply: 'メンターに接続できませんでした。もう一度試してみて！' }
  }
}

export async function clearChatHistory(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: activeProject } = await supabase
    .from('project_ideas')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!activeProject) return

  await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', user.id)
    .eq('project_id', activeProject.id)
}

export type MentorType = 'idea' | 'general' | 'custom' | 'quest'

export async function getMentorHistory(
  projectId: string,
  questId: string,
  mentorType?: MentorType
): Promise<ChatMessage[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .eq('quest_id', questId)

  if (mentorType !== undefined) {
    query = query.eq('mentor_type', mentorType)
  }

  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) return []

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }))
}

export async function saveMentorMessage(
  projectId: string,
  questId: string,
  role: 'user' | 'assistant',
  content: string,
  mentorType: MentorType = 'idea',
  customMentorId?: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'no user' }

  const { error } = await supabase.from('chat_messages').insert({
    user_id: user.id,
    project_id: projectId,
    quest_id: questId,
    role,
    content,
    mentor_type: mentorType,
    custom_mentor_id: customMentorId ?? null,
  })

  if (error) return { error: error.message }
  return {}
}
