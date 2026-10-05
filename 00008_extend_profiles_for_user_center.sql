ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS real_name text,
ADD COLUMN IF NOT EXISTS gender text DEFAULT 'secret',
ADD COLUMN IF NOT EXISTS bio text DEFAULT '',
ADD COLUMN IF NOT EXISTS security_question text,
ADD COLUMN IF NOT EXISTS security_answer text;