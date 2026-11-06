import type { Quest, QuestStatus } from '@/store/useQuestStore'
import type { IdeaCard } from '@/app/actions/onboarding'

type QuestConfigEntry = {
  columnName: string
  questNumber: number | null
  title: string
  estimatedMinutes: number
  difficulty: 1 | 2 | 3
  mentorMessage: string
  decisionQuestion: string | null
  hiddenPrompt: string
}

export const QUEST_CONFIG = {
  q1: {
    columnName: 'setup_steps',
    questNumber: null,
    title: 'アイデアをつくろう！',
    estimatedMinutes: 10,
    difficulty: 1,
    mentorMessage: "まだアイデアが固まっていなくて大丈夫。\n「誰のために」「何を」「どうやって」を\n一緒に見つけていこう。",
    decisionQuestion: null,
    hiddenPrompt: "アイデア検証インタビュー（ペルソナ・既存代替・切実さ・核）への回答を元に、実現可能なアプリの土台を固める",
  },
  q2: {
    columnName: 'quest2_steps',
    questNumber: 2,
    title: '最初の画面を作ろう',
    estimatedMinutes: 20,
    difficulty: 1,
    mentorMessage: "種を土に植える瞬間。\nまだ芽は出ていないけど、\nここからすべてが始まる。",
    decisionQuestion: "このプロジェクト、何を作るために始めましたか？\nひと言で教えてください。",
    hiddenPrompt: "Next.js App RouterでTailwind CSSとShadcn UIを使ってトップページを作成してください。ヒーローセクションとCTAボタンを含めてください",
  },
  q3: {
    columnName: 'quest3_steps',
    questNumber: 3,
    title: 'データを保存できるようにしよう',
    estimatedMinutes: 25,
    difficulty: 2,
    mentorMessage: "建物に水道を引く工事。\nこれがないと、データが残らない家になる。\n一番地味だけど、一番大事な作業。",
    decisionQuestion: null,
    hiddenPrompt: "Supabaseプロジェクトの作成からNext.jsとの接続設定、環境変数の設定までセキュアに行う手順を教えてください",
  },
  q4: {
    columnName: 'quest4_steps',
    questNumber: 4,
    title: '仕上げよう',
    estimatedMinutes: 30,
    difficulty: 2,
    mentorMessage: "ここまで来たら、あとは磨くだけ。\nエラーが出ても慌てない、スマホでも崩れない。\n「人に見せて恥ずかしくない」に仕上げよう。",
    decisionQuestion: "まだ何も無い、はじめての画面。\nそこに何て書いてあったら、\nユーザーは安心して使い始められる？",
    hiddenPrompt: "Next.js App RouterとTailwind CSSで、エラーハンドリング（try/catchとユーザー向けの優しい日本語エラー表示）、スマホ向けのレスポンシブ対応（レイアウト崩れの修正）、空状態の表示（データが無いときの案内メッセージ）を実装して、人に見せられる品質に仕上げてください",
  },
  q5: {
    columnName: 'quest5_steps',
    questNumber: 5,
    title: '世界に公開しよう',
    estimatedMinutes: 20,
    difficulty: 2,
    mentorMessage: "これは完成じゃなく、誕生。\nURLが生まれた瞬間、\nあなたはプロダクトオーナーになる。",
    decisionQuestion: "公開されたURLを、最初に誰に送りますか？",
    hiddenPrompt: "GitHubリポジトリをVercelに接続してデプロイする手順と、Vercelの無料枠のSpend Management設定を教えてください",
  },
} as const satisfies Record<string, QuestConfigEntry>

export const STATIC_QUEST_DEFINITIONS = [
  { id: 'q1', title: '開発環境の構築',       description: 'Next.jsとSupabaseの接続', order: 1, dependsOn: [] },
  { id: 'q2', title: 'UIコンポーネント作成', description: '最初のボタンを作る',       order: 2, dependsOn: ['q1'] },
  { id: 'q3', title: 'データベース連携',     description: 'データを保存する',         order: 3, dependsOn: ['q2'] },
  { id: 'q4', title: '仕上げる',             description: 'エラー・スマホ・空状態に対応', order: 4, dependsOn: ['q3'] },
  { id: 'q5', title: '本番公開',             description: 'Vercelへデプロイ',         order: 5, dependsOn: ['q4'] },
]

type DbQuestStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

/**
 * DBのquest_progressレコードとstatic定義を結合し、UIステータス付きのQuestを返す。
 * progressMapが空（新規ユーザー）の場合はorder最小の1件をactiveにし残りをlockedにする。
 * selectedIdeaが渡された場合、各クエストのtitle/descriptionをアイデア固有の内容で上書きする。
 */
export function mergeQuestsWithProgress(
  progressMap: Record<string, DbQuestStatus>,
  selectedIdea?: IdeaCard
): Quest[] {
  const definitions = selectedIdea
    ? STATIC_QUEST_DEFINITIONS.map((def, index) => ({
        ...def,
        title: selectedIdea?.questTitles?.[index] ?? def.title,
        description: selectedIdea?.questDescriptions?.[index] ?? def.description,
      }))
    : STATIC_QUEST_DEFINITIONS

  const completedIds = new Set(
    definitions
      .filter((q) => {
        const s = progressMap[q.id] ?? 'not_started'
        return s === 'completed' || s === 'skipped'
      })
      .map((q) => q.id)
  )

  let nextActiveAssigned = definitions.some(
    (q) => (progressMap[q.id] ?? 'not_started') === 'in_progress'
  )

  return [...definitions]
    .sort((a, b) => a.order - b.order)
    .map((def) => {
      const dbStatus = progressMap[def.id] ?? 'not_started'

      if (dbStatus === 'completed') {
        return { ...def, status: 'completed' as QuestStatus }
      }
      if (dbStatus === 'skipped') {
        return { ...def, status: 'skipped' as QuestStatus }
      }
      if (dbStatus === 'in_progress') {
        return { ...def, status: 'in_progress' as QuestStatus }
      }

      const isUnlocked = def.dependsOn.every((depId) => completedIds.has(depId))
      if (!isUnlocked) return { ...def, status: 'locked' as QuestStatus }

      if (!nextActiveAssigned) {
        nextActiveAssigned = true
        return { ...def, status: 'active' as QuestStatus }
      }
      return { ...def, status: 'unlocked' as QuestStatus }
    })
}
