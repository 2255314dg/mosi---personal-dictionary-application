-- 1. 添加 type 与 emoji 字段
ALTER TABLE tag_catalog ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE tag_catalog ADD COLUMN IF NOT EXISTS emoji text DEFAULT '';

-- 2. 同步已有的 category 到 type，如果 type 为空
UPDATE tag_catalog SET type = category WHERE type IS NULL;

-- 3. 如果默认没有 emoji，给已有数据赋予贴切的 emoji
UPDATE tag_catalog SET emoji = '💭' WHERE name = '自我认知' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '⏳' WHERE name = '时间感知' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '🌌' WHERE name = '存在主义' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '🌱' WHERE name = '生命哲学' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '⚡' WHERE name = '社会批判' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '🎨' WHERE name = '美与艺术' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '🌊' WHERE name = '平静' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '🌀' WHERE name = '困惑' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '🕊️' WHERE name = '释然' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '🌧️' WHERE name = '焦虑' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '🕯️' WHERE name = '深沉' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '✨' WHERE name = '愉悦' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '☀️' WHERE name = '晴' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '⛅' WHERE name = '阴' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '🌧️' WHERE name = '雨' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '❄️' WHERE name = '雪' AND (emoji IS NULL OR emoji = '');
UPDATE tag_catalog SET emoji = '💨' WHERE name = '风' AND (emoji IS NULL OR emoji = '');

-- 4. 确保以后 category 和 type 保持一致，更新 category
UPDATE tag_catalog SET category = type WHERE category IS NULL;