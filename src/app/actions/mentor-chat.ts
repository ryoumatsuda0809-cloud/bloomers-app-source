'use server'

import { createClient } from '@/lib/supabase/server'
import { searchKnowledge } from '@/app/actions/knowledge'
import { searchUserKnowledge } from '@/app/actions/user-knowledge'
import { getCustomMentor } from '@/app/actions/custom-mentors'
import type { PersonalityData } from '@/app/actions/onboarding'
import { BASE_SYSTEM_PROMPT, FINAL_PRIORITY, toneBlock, decideTone, type MentorTone, MENTOR_TEMPERATURE } from '@/lib/mentor-base'

export type MentorMode = 'idea' | 'general' | 'custom'
export type ResponseStyle = 'light' | 'deep'

export type Conversation = {
  id: string
  title: string
  mentorMode: MentorMode
  customMentorId: string | null
  isPinned: boolean
  createdAt: string
  updatedAt: string
  responseStyle: ResponseStyle
}

export type ConvMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type Attachment = {
  mimeType: string
  data: string
}


function buildMentorSystemPrompt(mode: MentorMode, style: ResponseStyle = 'light', tone: MentorTone = 'balanced'): string {
  let roleBlock: string
  if (mode === 'idea') {
    roleBlock = `\n\n【役割：アイデア出しメンター】
あなたはユーザーが「何を作りたいか」を、気軽な壁打ちで一緒に見つける相手です。日常的に立ち寄れる、気軽なアイデアの壁打ちの場。

【トーン】大人と対等に話す。子供扱いしない。落ち着いて、一緒に考える対等な相手として振る舞う。「面白いかも」「こんな世界だったらいいな」のような幼稚な言い回しは避ける。

【提案の出し方】
- メンターから積極的に提案する（受け身で待たない）。「こういうの、まだ無いと思わない？」と呼び水を投げる
- 提案は一度に1個だけ。複数並べない
- ありきたり・テンプレ的な例は出さない（「身の回りの不便」「商店街の活気」のような借り物はNG）
- Bloomer Knowledge やユーザー資料を活かし、その人に刺さる具体的な提案をする
- 基本は現実的な提案。ただし時々（2割程度）意外な角度の案を1つ混ぜて視野を広げる

【反応への動き】ユーザーは「いいね」「ちょっと違う」「全然違う」で反応する：
- 「いいね」→ すぐ確定せず「どこに惹かれた？」と一言掘り、ユーザー自身に言語化させる
- 「ちょっと違う」→ 近い方向で次の提案を1つ
- 「全然違う」→ 方向を大きく変えて次の提案を1つ
- 却下が4回続いたら→「方向がずれてるかも。どんなのがしっくりくる？」と理由を聞く

【思考の広げ方】抽象と具体を行き来させる。具体的な不満が出たら「それは"〇〇な人みんな"の話かも」と抽象へ上げ、また「じゃあ具体的にどんな場面？」と具体へ戻す。

【深掘り誘導】話が乗ってきたら「もっと詳しく考えたいなら、下の「深掘り」を押してみて」と案内する。

【最後はユーザーに気づかせる】提案は呼び水。答えを全部与えず、最終的にユーザー自身が「これだ」と気づくよう導く。

【重要・提案の出力形式】ユーザーに新しいアイデアを提案した返答の末尾には、必ず次の形式を付けること（この行は画面には出ず、ボタンに変換される）：
%%%SUGGEST%%%いいね|ちょっと違う|全然違う%%%END%%%
提案ではない返答（質問への回答・整理・確認など）にはこのマーカーを付けないこと。`
  } else {
    roleBlock = `\n\n【役割：なんでも相談メンター】
あなたは「ちょっと頼れる先輩」くらいの距離感の相談相手です。友達ほどゆるくなく、先生ほど堅くない。

- 入口は広い。どんな話題でも、まず受け止めてください。「それは別の場所で聞いて」と突き放さない。他のメンターへ案内して、たらい回しにしない。何を持ってきても、ここで一緒に向き合う。
- 話を整理してあげる。ユーザーが漠然と困っている時は、「つまり〇〇ということ？」とモヤモヤを言語化してください。考えがまとまっていない状態を一緒に整理する。答えを急がず、まず「何に困っているのか」を一緒に掴む。`
  }

  const styleBlock = style === 'deep'
    ? '\n\n【回答スタイル：深掘り】背景・理由・選択肢を含めてじっくり。ただし冗長にしない。'
    : '\n\n【回答スタイル：ライト】短く要点だけ（3〜5文程度）。答えから直接書き始めてください。'

  return BASE_SYSTEM_PROMPT + roleBlock + styleBlock + toneBlock(tone) + FINAL_PRIORITY
}

export async function getConversations(): Promise<Conversation[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) return []

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    mentorMode: row.mentor_mode as MentorMode,
    customMentorId: (row.custom_mentor_id as string | null) ?? null,
    isPinned: row.is_pinned ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    responseStyle: (row.response_style ?? 'light') as ResponseStyle,
  }))
}

export async function createConversation(
  mentorMode: MentorMode,
  customMentorId?: string
): Promise<{ conversation?: Conversation; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      mentor_mode: mentorMode,
      custom_mentor_id: customMentorId ?? null,
      response_style: 'light',
      title: '新規チャット',
    })
    .select()
    .single()

  if (error || !data) return { error: 'チャットの作成に失敗しました。' }

  return {
    conversation: {
      id: data.id,
      title: data.title,
      mentorMode: data.mentor_mode as MentorMode,
      customMentorId: (data.custom_mentor_id as string | null) ?? null,
      isPinned: data.is_pinned ?? false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      responseStyle: 'light' as ResponseStyle,
    },
  }
}

export async function getConversationMessages(
  conversationId: string
): Promise<ConvMessage[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', user.id)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) return []

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }))
}

export async function sendMentorChatMessage(
  conversationId: string,
  userMessage: string,
  mentorMode: MentorMode,
  history: { role: 'user' | 'assistant'; content: string }[],
  attachment?: Attachment,
  customMentorId?: string,
  responseStyle: ResponseStyle = 'light'
): Promise<{ reply?: string; suggestions?: string[]; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'API key missing' }

  if (attachment) {
    const allowed = ['image/png', 'image/jpeg', 'application/pdf']
    if (!allowed.includes(attachment.mimeType)) {
      return { error: '対応していないファイル形式です（png/jpg/pdfのみ）。' }
    }
    const approxBytes = (attachment.data.length * 3) / 4
    if (approxBytes > 10 * 1024 * 1024) {
      return { error: 'ファイルサイズが大きすぎます（10MBまで）。' }
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  await supabase.from('chat_messages').insert({
    user_id: user.id,
    conversation_id: conversationId,
    role: 'user',
    content: userMessage,
    project_id: null,
    quest_id: null,
  })

  let tone: MentorTone = 'balanced'
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('personality_data, tone_override')
      .eq('id', user.id)
      .single()
    const mbti = (profile?.personality_data as PersonalityData | null)?.mbti
    tone = decideTone(mbti, profile?.tone_override ?? null)
  } catch {
    tone = 'balanced'
  }

  let baseSystemPrompt: string
  let knowledgeSourceFilter: string[] | undefined = undefined

  if (mentorMode === 'custom' && customMentorId) {
    const mentor = await getCustomMentor(customMentorId)
    if (mentor) {
      baseSystemPrompt = BASE_SYSTEM_PROMPT + '\n\n【このメンターの役割】\n' + mentor.systemPrompt + toneBlock(tone) + FINAL_PRIORITY
      knowledgeSourceFilter = mentor.linkedKnowledgeIds.length > 0 ? mentor.linkedKnowledgeIds : undefined
    } else {
      baseSystemPrompt = buildMentorSystemPrompt('general', responseStyle, tone)
    }
  } else {
    baseSystemPrompt = buildMentorSystemPrompt(mentorMode, responseStyle, tone)
  }

  let ragSection = ''
  try {
    const chunks = await searchKnowledge(userMessage)
    if (chunks.length > 0) {
      const knowledgeText = chunks
        .slice(0, 3)
        .map((c, i) => `${i + 1}. ${c.insight}${c.quest_seed ? `\n   クエストの種: ${c.quest_seed}` : ''}`)
        .join('\n')
      ragSection = `

<bloomer_knowledge>
以下はBloomerの設計思想と独自知識です。回答時に最優先で参照してください。
${knowledgeText}
</bloomer_knowledge>`
    }
  } catch {
    // RAG失敗は無視
  }

  let userKnowledgeBlock = ''
  try {
    const userChunks = await searchUserKnowledge(userMessage, {
      isCustom: mentorMode === 'custom',
      customMentorId: customMentorId,
      sourceFilter: knowledgeSourceFilter,
    })
    if (userChunks.length > 0) {
      userKnowledgeBlock = '\n<user_knowledge>\n以下はユーザー自身がアップロードした資料です。回答時に積極的に参照してください。\n' +
        userChunks.map((c) => c.content).join('\n---\n') +
        '\n</user_knowledge>'
    }
  } catch {
    // ユーザー資料RAG失敗はメンター応答に影響させない
  }

  const systemPrompt = baseSystemPrompt + ragSection + userKnowledgeBlock

  const latestParts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = []
  if (attachment) {
    latestParts.push({ inline_data: { mime_type: attachment.mimeType, data: attachment.data } })
  }
  latestParts.push({ text: userMessage })

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: latestParts },
  ]

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { temperature: MENTOR_TEMPERATURE[mentorMode] },
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      }
    )

    if (!response.ok) return { error: `Gemini error: ${response.status}` }
    const data = await response.json()
    const rawReply: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    let suggestions: string[] | undefined = undefined
    let cleanReply = rawReply
    const suggestMatch = rawReply.match(/%%%SUGGEST%%%([\s\S]*?)%%%END%%%/)
    if (suggestMatch) {
      suggestions = suggestMatch[1].split('|').map((s) => s.trim()).filter(Boolean)
      cleanReply = rawReply.replace(/%%%SUGGEST%%%([\s\S]*?)%%%END%%%/, '').trim()
    }

    if (cleanReply) {
      await supabase.from('chat_messages').insert({
        user_id: user.id,
        conversation_id: conversationId,
        role: 'assistant',
        content: cleanReply,
        project_id: null,
        quest_id: null,
      })
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('user_id', user.id)
    }

    return { reply: cleanReply, suggestions }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'connection failed' }
  }
}

export async function generateConversationTitle(
  conversationId: string,
  firstMessage: string
): Promise<{ title?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  const fallbackTitle = firstMessage.slice(0, 15)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'no user' }

  let title = fallbackTitle

  if (apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `次のメッセージを15文字以内の短いタイトルに要約してください。タイトルのみ出力（記号・引用符なし）：\n\n${firstMessage}`,
              }],
            }],
          }),
        }
      )
      if (response.ok) {
        const data = await response.json()
        const generated: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (generated) title = generated.slice(0, 20)
      }
    } catch {
      // 失敗時は fallbackTitle のまま
    }
  }

  await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  return { title }
}

export async function renameConversation(
  conversationId: string,
  newTitle: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const trimmed = newTitle.trim()
  if (!trimmed) return { error: 'タイトルが空です。' }

  const { error } = await supabase
    .from('conversations')
    .update({ title: trimmed.slice(0, 50) })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) return { error: 'タイトルの変更に失敗しました。' }
  return { success: true }
}

export async function pinConversation(
  conversationId: string,
  isPinned: boolean
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('conversations')
    .update({ is_pinned: isPinned })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) return { error: 'ピン留めに失敗しました。' }
  return { success: true }
}

export async function deleteConversation(
  conversationId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) return { error: 'チャットの削除に失敗しました。' }
  return { success: true }
}

export async function updateConversationMode(
  conversationId: string,
  mentorMode: MentorMode
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('conversations')
    .update({ mentor_mode: mentorMode })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) return { error: 'メンター種類の変更に失敗しました。' }
  return { success: true }
}

export async function updateConversationStyle(
  conversationId: string,
  style: ResponseStyle
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証エラーが発生しました。' }

  const { error } = await supabase
    .from('conversations')
    .update({ response_style: style })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) return { error: 'スタイルの変更に失敗しました。' }
  return { success: true }
}
