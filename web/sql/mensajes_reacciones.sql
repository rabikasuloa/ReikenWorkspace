CREATE TABLE IF NOT EXISTS mensajes_reacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensaje_id UUID NOT NULL REFERENCES mensajes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT,
  sticker_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mensaje_id, user_id, emoji)
);

ALTER TABLE mensajes_reacciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own reactions"
  ON mensajes_reacciones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions"
  ON mensajes_reacciones FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read reactions"
  ON mensajes_reacciones FOR SELECT
  USING (true);
