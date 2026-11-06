'use server'

type GitHubResult = {
  success?: boolean
  repoUrl?: string
  error?: string
}

export async function createRepository(
  projectName: string
): Promise<GitHubResult> {
  const token = process.env.GITHUB_TOKEN

  if (!token) {
    return { error: 'GitHubへの接続情報が設定されていません。' }
  }

  const timestamp = Date.now()
  const repoName = `bloomer-${timestamp}`

  try {
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        name: repoName,
        private: true,
        auto_init: true,
        description: `${projectName} - Bloomerで作成したプロジェクト`,
      }),
    })

    if (response.status === 422) {
      return { error: 'このプロジェクト名のリポジトリは既に存在します。' }
    }

    if (!response.ok) {
      return { error: 'GitHubへの接続に失敗しました。もう一度お試しください。' }
    }

    const data = await response.json()
    return {
      success: true,
      repoUrl: data.html_url,
    }

  } catch {
    return { error: 'GitHubへの接続に失敗しました。もう一度お試しください。' }
  }
}
