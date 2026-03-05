CREATE TABLE IF NOT EXISTS public.saved_angles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  angle_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.saved_angles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own angles" ON public.saved_angles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own angles" ON public.saved_angles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own angles" ON public.saved_angles
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_saved_angles_user ON public.saved_angles(user_id);
CREATE INDEX idx_saved_angles_product ON public.saved_angles(user_id, product_name);
