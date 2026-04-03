-- Outfit Preferences table for Outfit Duels feature
-- Tracks user duel choices to improve AI suggestions over time

CREATE TABLE IF NOT EXISTS outfit_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chosen_item_ids text[] DEFAULT '{}',
  rejected_item_ids text[] DEFAULT '{}',
  chosen_colors text[] DEFAULT '{}',
  rejected_colors text[] DEFAULT '{}',
  chosen_categories text[] DEFAULT '{}',
  rejected_categories text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outfit_preferences_user_id ON outfit_preferences(user_id);

ALTER TABLE outfit_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON outfit_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON outfit_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON outfit_preferences FOR DELETE
  USING (auth.uid() = user_id);
