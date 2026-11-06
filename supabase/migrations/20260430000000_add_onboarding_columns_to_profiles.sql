-- profilesテーブルにオンボーディング用カラムを追加
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_answers JSONB,
ADD COLUMN IF NOT EXISTS selected_idea JSONB,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
