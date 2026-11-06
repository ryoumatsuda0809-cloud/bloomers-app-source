-- =============================================
-- profiles テーブルに project_name カラムを追加
-- =============================================
alter table public.profiles
  add column if not exists project_name text;

-- =============================================
-- INSERT RLS ポリシーを追加
-- handle_new_user トリガーは security definer で RLS をバイパスするが、
-- Server Action（authenticated ロール）からの INSERT にはポリシーが必要。
-- =============================================
create policy "profiles: owner can insert"
  on public.profiles for insert
  with check (auth.uid() = id);
