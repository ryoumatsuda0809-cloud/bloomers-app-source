import type { IdeaCard } from '@/app/actions/onboarding'
import type { SetupStep } from '@/app/actions/setup'

export type TrialSample = {
  id: string
  emoji: string
  ideaCard: IdeaCard
  setupSteps: SetupStep[]
}

const DEFAULT_SETUP_STEPS: SetupStep[] = [
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

export const TRIAL_SAMPLES: TrialSample[] = [
  {
    id: 'contact-app',
    emoji: '📮',
    ideaCard: {
      title: '連絡代行アプリ',
      description: '苦手な連絡を、テンプレと一緒に楽に送れるアプリ',
      questTitles: [
        '開発の土台を整えよう',
        '連絡フォームの画面を作ろう',
        '送信先とメッセージをDBに保存しよう',
        '自分のアカウントでログインして連絡しよう',
        'アプリをリリースして誰でも使えるようにしよう',
      ],
      questDescriptions: [
        '開発を始めるための土台を作ります。',
        '相手先と連絡内容を入力する、シンプルで使いやすい画面を作成します。',
        'あらかじめ登録した宛先と定型文をデータベースに安全に保存します。',
        '認証機能を組み込み、自分専用のアカウントで連絡を送信可能にします。',
        'ストアへ申請を行い、実際に誰でも利用できる状態に公開します。',
      ],
    },
    setupSteps: DEFAULT_SETUP_STEPS,
  },
  {
    id: 'cafeteria-map',
    emoji: '🍴',
    ideaCard: {
      title: '学食混雑マップ',
      description: '今どの食堂が空いているか、リアルタイムで分かるアプリ',
      questTitles: [
        '開発の土台を整えよう',
        '混雑状況を見る画面を作ろう',
        '混雑データをDBで管理しよう',
        '自分のアカウントで投稿できるようにしよう',
        'アプリをリリースして誰でも使えるようにしよう',
      ],
      questDescriptions: [
        '開発を始めるための土台を作ります。',
        '各食堂の混雑度をひと目で確認できる、シンプルな一覧画面を作成します。',
        'ユーザーの報告データを受け取り、データベースに保存・集計する仕組みを作ります。',
        'ログイン機能を追加し、信頼性の高い投稿者のみがデータを更新できるようにします。',
        'Vercelへデプロイし、学内の誰でもアクセスできる状態に公開します。',
      ],
    },
    setupSteps: DEFAULT_SETUP_STEPS,
  },
  {
    id: 'task-manager',
    emoji: '📝',
    ideaCard: {
      title: '課題管理アプリ',
      description: '授業ごとの課題と締め切りを、まとめて管理できるアプリ',
      questTitles: [
        '開発の土台を整えよう',
        '課題一覧の画面を作ろう',
        '課題をDBに保存しよう',
        '自分専用の課題リストを作ろう',
        'アプリをリリースして誰でも使えるようにしよう',
      ],
      questDescriptions: [
        '開発を始めるための土台を作ります。',
        '課題名・科目・締め切りを一覧で確認できる、見やすい画面を作成します。',
        '入力した課題データをデータベースに保存し、次回起動時も参照できるようにします。',
        'ログイン機能を実装し、自分だけの課題リストをどこからでも確認可能にします。',
        'Vercelへデプロイし、誰でもアクセスできる状態に公開します。',
      ],
    },
    setupSteps: DEFAULT_SETUP_STEPS,
  },
]
