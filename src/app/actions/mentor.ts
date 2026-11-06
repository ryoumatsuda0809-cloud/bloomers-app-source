'use server'

import { cache } from 'react'

export const getMentorMessage = cache(
  async (questTitle: string): Promise<{ message?: string; error?: string }> => {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return { error: 'メンターに接続できませんでした。' }
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `あなたはBloomerというサービスのメンターです。
大学生の初心者ユーザーが「${questTitle}」という
ステップに取り組んでいます。
「なぜこのステップが必要なのか」を、
技術用語を一切使わず、日常的な比喩を使って
3文以内で優しく説明してください。
説明のみを出力し、前置きは不要です。`
              }]
            }]
          }),
        }
      )

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('Gemini APIエラー:', response.status, errorBody)
        return { error: 'メンターに接続できませんでした。' }
      }

      const data = await response.json()
      const message = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (!message) {
        return { error: 'メンターは今お休み中です。' }
      }

      return { message }

    } catch {
      return { error: 'メンターに接続できませんでした。' }
    }
  }
)
