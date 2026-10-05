CREATE TABLE IF NOT EXISTS public.tag_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('theme', 'mood', 'weather')),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, name)
);

-- 开启 RLS
ALTER TABLE public.tag_catalog ENABLE ROW LEVEL SECURITY;

-- 允许任何人读取标签定义
CREATE POLICY "Allow read tag_catalog for all" ON public.tag_catalog
  FOR SELECT USING (true);

-- 允许全部操作（管理端自定义）
CREATE POLICY "Allow all operations for tag_catalog" ON public.tag_catalog
  FOR ALL USING (true) WITH CHECK (true);

-- 初始化默认内置标签项
INSERT INTO public.tag_catalog (category, name, sort_order) VALUES
  ('theme', '自我认知', 1),
  ('theme', '关系与情感', 2),
  ('theme', '存在与意义', 3),
  ('theme', '生命哲学', 4),
  ('theme', '社会批判', 5),
  ('theme', '美与艺术', 6),
  ('mood', '平静', 1),
  ('mood', '困惑', 2),
  ('mood', '释然', 3),
  ('mood', '焦虑', 4),
  ('mood', '深沉', 5),
  ('mood', '愉悦', 6),
  ('weather', '晴', 1),
  ('weather', '阴', 2),
  ('weather', '雨', 3),
  ('weather', '雪', 4),
  ('weather', '风', 5)
ON CONFLICT (category, name) DO NOTHING;
