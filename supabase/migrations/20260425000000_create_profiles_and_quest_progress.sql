-- =============================================
-- profiles: ユーザープロフィール管理テーブル
-- =============================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url  text,
  bio         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 更新時刻を自動更新するトリガー
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 新規ユーザー登録時にprofilesレコードを自動生成
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS有効化
alter table public.profiles enable row level security;

-- 全ユーザーが他のプロフィールを閲覧可能（ランキング等のため）
create policy "profiles: anyone can read"
  on public.profiles for select
  using (true);

-- 自分のプロフィールのみ更新可能
create policy "profiles: owner can update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =============================================
-- quest_progress: クエスト進捗状態管理テーブル
-- =============================================
create type public.quest_status as enum ('not_started', 'in_progress', 'completed');

create table if not exists public.quest_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  quest_id     text not null,
  status       public.quest_status not null default 'not_started',
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- 同一ユーザーが同一クエストを重複登録しないよう制約
  unique (user_id, quest_id)
);

create trigger quest_progress_set_updated_at
  before update on public.quest_progress
  for each row execute function public.set_updated_at();

-- RLS有効化
alter table public.quest_progress enable row level security;

-- 自分の進捗のみ閲覧可能
create policy "quest_progress: owner can read"
  on public.quest_progress for select
  using (auth.uid() = user_id);

-- 自分の進捗のみ作成可能（user_idを自分のIDに強制）
create policy "quest_progress: owner can insert"
  on public.quest_progress for insert
  with check (auth.uid() = user_id);

-- 自分の進捗のみ更新可能
create policy "quest_progress: owner can update"
  on public.quest_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- インデックス
create index quest_progress_user_id_idx on public.quest_progress(user_id);
create index quest_progress_status_idx  on public.quest_progress(user_id, status);
