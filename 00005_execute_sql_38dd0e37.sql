-- MOSI bootstrap admin (V4.1 secure form)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- IMPORTANT: this migration no longer contains a hardcoded administrator password.
-- The bootstrap account is created with a cryptographically random temporary password
-- hash and MUST be reset from Supabase Auth/Admin before first use.
DO $$
DECLARE
  v_user_id uuid;
  v_random_password text := encode(gen_random_bytes(32), 'base64');
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@mosi.local';
  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated',
      'admin@mosi.local',crypt(v_random_password, gen_salt('bf')),now(),
      '{"provider":"email","providers":["email"]}','{"username":"admin"}',now(),now()
    ) RETURNING id INTO v_user_id;
  END IF;

  INSERT INTO public.profiles (id,username,nickname,role)
  VALUES (v_user_id,'admin','墨思创作者','admin')
  ON CONFLICT (id) DO UPDATE
  SET role='admin',username='admin',nickname='墨思创作者';

  RAISE NOTICE 'MOSI admin bootstrap created/verified. Reset admin@mosi.local password through Supabase Auth before first login.';
END $$;
