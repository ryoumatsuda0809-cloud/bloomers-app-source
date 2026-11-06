# bloomers-app (source)

初心者向けの SaaS 開発学習プラットフォーム「Bloomers」のアプリのソースコードです。
クエスト形式で、作りたいものを決めてから動くところまで進める学習体験を目指して作りました。

**現在は更新していません(アーカイブ)。** 動く製品としてではなく、実装の記録として公開しています。

## 技術

Next.js(App Router) / React / TypeScript / Tailwind CSS / shadcn/ui / Zustand / Supabase(Auth・Postgres)

## 含まれないもの

仕様書・設計ドキュメント、AI への指示書、知識データの投入スクリプト、環境変数、Supabase のプロジェクト設定は含めていません。
そのため、このままでは起動できません。`supabase/migrations/` は、データベースの構成を読むための参考として残しています。

## 使う環境変数(値は含まれません)

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `GEMINI_API_KEY` / `TAVILY_API_KEY` / `GITHUB_TOKEN`

## ライセンス

特に定めていません。閲覧は自由ですが、無断での再利用・再配布はできません。
