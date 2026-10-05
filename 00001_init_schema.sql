-- 1. Profiles 表（包含用户角色：admin, user）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  nickname TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon and auth read profiles" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- 2. Journals 表（日志表）
CREATE TABLE IF NOT EXISTS public.journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text', -- 'pure_text', 'with_image', 'dialogue'
  theme_tags TEXT[] DEFAULT '{}',
  mood_tag TEXT DEFAULT '平静',
  weather_tag TEXT DEFAULT '晴',
  location_tag TEXT DEFAULT '许昌',
  views_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取日志
CREATE POLICY "Allow anyone read journals" ON public.journals
  FOR SELECT TO anon, authenticated USING (true);

-- 允许管理员或创作者插入、更新、删除日志，或在初始阶段允许管理员操作
CREATE POLICY "Allow authenticated insert journals" ON public.journals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update journals" ON public.journals
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete journals" ON public.journals
  FOR DELETE TO authenticated USING (true);

-- 3. Comments 表（留言表，支持免注册访客留言）
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone read comments" ON public.comments
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow anyone insert comments" ON public.comments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated delete comments" ON public.comments
  FOR DELETE TO authenticated USING (true);

-- 4. Journal Versions 表（版本历史控制）
CREATE TABLE IF NOT EXISTS public.journal_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.journal_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone read journal_versions" ON public.journal_versions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow authenticated insert journal_versions" ON public.journal_versions
  FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Music Tracks 表（内置与用户上传音乐列表）
CREATE TABLE IF NOT EXISTS public.music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT DEFAULT '未知艺术家',
  url TEXT NOT NULL,
  duration INT DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone read music_tracks" ON public.music_tracks
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow authenticated insert music_tracks" ON public.music_tracks
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update music_tracks" ON public.music_tracks
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete music_tracks" ON public.music_tracks
  FOR DELETE TO authenticated USING (true);

-- 6. 创建 Storage 桶: journal-images 与 music
INSERT INTO storage.buckets (id, name, public) 
VALUES ('journal-images', 'journal-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('music', 'music', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 桶读写策略
CREATE POLICY "Public read journal-images" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'journal-images');

CREATE POLICY "Anyone upload journal-images" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'journal-images');

CREATE POLICY "Public read music" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'music');

CREATE POLICY "Anyone upload music" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'music');
