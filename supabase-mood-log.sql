-- Mood Log table for Style Mood Ring feature
-- Tracks user mood selections for analytics and personalization

CREATE TABLE IF NOT EXISTS mood_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mood text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_mood_log_user_id ON mood_log(user_id);

-- Enable Row Level Security
ALTER TABLE mood_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own mood logs
CREATE POLICY "Users can view own mood logs"
  ON mood_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mood logs"
  ON mood_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mood logs"
  ON mood_log FOR DELETE
  USING (auth.uid() = user_id);
