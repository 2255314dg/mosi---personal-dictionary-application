-- 确保三篇预置日志的主题、情绪、天候、地点标签与创建日期完全精准符合用户要求
UPDATE public.journals
SET 
  theme_tags = ARRAY['自我认知'],
  mood_tag = '困惑、挫折感',
  weather_tag = '未知',
  location_tag = '许昌',
  content_type = 'dialogue',
  created_at = '2025-12-20 10:00:00+00'
WHERE title = '人是什么？';

UPDATE public.journals
SET 
  theme_tags = ARRAY['关系与情感'],
  mood_tag = '温暖、焦虑',
  weather_tag = '未知',
  location_tag = '许昌',
  content_type = 'dialogue',
  created_at = '2025-12-21 10:00:00+00'
WHERE title = '爱是什么？';

UPDATE public.journals
SET 
  theme_tags = ARRAY['存在与意义'],
  mood_tag = '震撼、困惑',
  weather_tag = '未知',
  location_tag = '许昌',
  content_type = 'dialogue',
  created_at = '2025-12-22 10:00:00+00'
WHERE title = '不确定性中的选择';

-- 预置各篇经典的精彩思辨读者回响评论
INSERT INTO public.comments (journal_id, nickname, content, created_at)
SELECT id, '林间行者', '“存在先于本质”，在面对成长与社会评价体系时，我们往往太容易把自己格式化了。读罢深有同感。', '2025-12-20 14:30:00+00'
FROM public.journals WHERE title = '人是什么？'
ON CONFLICT DO NOTHING;

INSERT INTO public.comments (journal_id, nickname, content, created_at)
SELECT id, '明月清泉', '母子之间以爱为名的束缚太普遍了。“爱是对他者自由的成全”，这两棵树的隐喻非常治愈。', '2025-12-21 16:20:00+00'
FROM public.journals WHERE title = '爱是什么？'
ON CONFLICT DO NOTHING;

INSERT INTO public.comments (journal_id, nickname, content, created_at)
SELECT id, '不息之客', '“正是因为宇宙的沉默，人类的选择才获得了耀眼的光芒。”在低谷时重温西西弗的坚毅，让人充满力量。', '2025-12-22 21:10:00+00'
FROM public.journals WHERE title = '不确定性中的选择'
ON CONFLICT DO NOTHING;
