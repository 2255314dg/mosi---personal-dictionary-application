DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@mosi.local';
  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@mosi.local',
      crypt('J7#kQ9zLp2', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"username":"admin"}',
      now(),
      now()
    ) RETURNING id INTO v_user_id;
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('J7#kQ9zLp2', gen_salt('bf'))
    WHERE id = v_user_id;
  END IF;

  -- 确保 profiles 中 role 为 admin
  INSERT INTO public.profiles (id, username, nickname, role)
  VALUES (v_user_id, 'admin', '墨思创作者', 'admin')
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin', username = 'admin', nickname = '墨思创作者';
END $$;