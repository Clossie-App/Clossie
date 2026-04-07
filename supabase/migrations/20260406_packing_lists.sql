-- Packing lists table
CREATE TABLE IF NOT EXISTS packing_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  destination TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Packing list items (references clothing_items)
CREATE TABLE IF NOT EXISTS packing_list_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  packing_list_id UUID NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
  clothing_item_id UUID NOT NULL REFERENCES clothing_items(id) ON DELETE CASCADE,
  packed BOOLEAN DEFAULT false,
  UNIQUE(packing_list_id, clothing_item_id)
);

-- RLS policies
ALTER TABLE packing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own packing lists" ON packing_lists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own packing list items" ON packing_list_items
  FOR ALL USING (
    packing_list_id IN (SELECT id FROM packing_lists WHERE user_id = auth.uid())
  )
  WITH CHECK (
    packing_list_id IN (SELECT id FROM packing_lists WHERE user_id = auth.uid())
  );
