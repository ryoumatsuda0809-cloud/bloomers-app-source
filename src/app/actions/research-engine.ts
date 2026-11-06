'use server'

// リサーチエンジン（IDEA_AI_DESIGN.md 実装順A）: Tavily検索のラッパー。
// 深堀りAIのS2市場スキャン・S4口コミ採掘に実Webの根拠（出典URL付き）を供給する。
// 無料枠は月1,000クレジット。呼び出し側で回数を絞ること（深堀り1回=検索2回の設計）。

export type WebSearchResult = {
  title: string
  url: string
  content: string
}

export async function searchWeb(
  query: string,
  maxResults: number = 4
): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return []

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: 'basic',
      }),
    })

    if (!response.ok) return []

    const data = await response.json()
    const results = Array.isArray(data.results) ? data.results : []

    return results
      .filter(
        (r: Record<string, unknown>) =>
          typeof r.title === 'string' && typeof r.url === 'string' && typeof r.content === 'string'
      )
      .map((r: Record<string, unknown>) => ({
        title: (r.title as string).slice(0, 120),
        url: r.url as string,
        content: (r.content as string).slice(0, 400),
      }))
  } catch {
    // 検索失敗は空配列（呼び出し側が縮退版へフォールバック）
    return []
  }
}
