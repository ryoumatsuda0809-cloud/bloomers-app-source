// アプリ分類タクソノミーの表示名・RAG検索テーマ定義（docs/APP_TAXONOMY.md を正とする）
import type { AppType } from '@/app/actions/onboarding'

export const APP_TYPE_LABELS: Record<AppType, string> = {
  record: '記録・管理系',
  matching: 'マッチング・掲示板系',
  reservation: '予約・注文系',
  media: '情報発信・地図系',
  tool: 'ツール・診断系',
  ai: 'AI活用系',
}

// メンターが会話で常時参照する、分類ごとの「核」と「最大の落とし穴」（APP_TAXONOMY.md の要約）
export const APP_TYPE_FOCUS: Record<AppType, string> = {
  record: '核は「一覧＋入力フォームの1画面」。落とし穴は項目を増やしすぎて毎日つけるのが億劫になること',
  matching: '核は「見るのは自由・動くにはログイン」の2層設計。落とし穴は連絡手段（チャット等）の作り込み',
  reservation: '核は「埋まったら押せない」枠管理と二重予約防止（DBの制約が本物の壁）。落とし穴は決済導入とカレンダーUI自作',
  media: '核は「公開面と管理面の分離」。閲覧者にログインは不要。落とし穴は箱だけ公開（掲載0件）と地図APIへの寄り道',
  tool: '核は「入力→結果」の1画面と結果の質。DBもログインも原則不要。落とし穴は不要なログインを付けること',
  ai: '核は「APIキーをサーバー側に隠し、利用回数上限で守る」こと。落とし穴はクライアントへのキー露出とコスト無制限公開',
}

// 各クエストの土台知識をRAGで引くための検索テーマ（knowledgeのトリガー文言に対応）
export const QUEST_RAG_THEMES: Record<2 | 3 | 4 | 5, string> = {
  2: '最初の画面 q2 土台',
  3: 'テーブル設計 データ q3 土台',
  4: '認証 ログイン q4 土台',
  5: '公開 デプロイ 落とし穴 q5 土台',
}

export function buildFoundationQuery(appType: AppType, questNumber: 2 | 3 | 4 | 5): string {
  return `${APP_TYPE_LABELS[appType]}（${appType}）アプリの ${QUEST_RAG_THEMES[questNumber]}`
}
