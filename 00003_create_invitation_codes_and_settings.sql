-- 1. 创建 app_settings 表
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 初始化邀请码注册开关（默认开启）
INSERT INTO public.app_settings (key, value, description)
VALUES ('require_invitation_code', 'true'::jsonb, '用户注册是否需要邀请码')
ON CONFLICT (key) DO NOTHING;

-- 2. 创建 invitation_codes 表
CREATE TABLE IF NOT EXISTS public.invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    max_uses INT NOT NULL DEFAULT 1,
    uses_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS 权限配置
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- app_settings 所有人可读，管理员可写
DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings" ON public.app_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
CREATE POLICY "Admins can update app_settings" ON public.app_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- invitation_codes 所有人可校验读，管理员可增删改查
DROP POLICY IF EXISTS "Public can verify invitation_codes" ON public.invitation_codes;
CREATE POLICY "Public can verify invitation_codes" ON public.invitation_codes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update used invitation_codes" ON public.invitation_codes;
CREATE POLICY "Public can update used invitation_codes" ON public.invitation_codes
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage invitation_codes" ON public.invitation_codes;
CREATE POLICY "Admins can manage invitation_codes" ON public.invitation_codes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 插入一条初始管理员备用邀请码
INSERT INTO public.invitation_codes (code, max_uses, is_active)
VALUES ('MOSI2026', 100, true)
ON CONFLICT (code) DO NOTHING;
