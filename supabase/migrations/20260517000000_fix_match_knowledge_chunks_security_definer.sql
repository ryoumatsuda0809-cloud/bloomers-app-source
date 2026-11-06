-- match_knowledge_chunks に SECURITY DEFINER を追加する。
-- anon ロールから呼んでも RLS をバイパスして knowledge_chunks を読めるようにする。
create or replace function match_knowledge_chunks(
  query_embedding vector(768),
  match_count int default 3,
  match_threshold double precision default 0.0
)
returns table (
  id uuid,
  trigger text,
  fact text,
  insight text,
  quest_seed text,
  similarity double precision
)
language sql stable
security definer
set search_path = public
as $$
  select id, trigger, fact, insight, quest_seed,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
