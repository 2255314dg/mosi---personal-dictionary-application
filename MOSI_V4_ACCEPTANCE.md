# MOSI V4 验收清单

## A. 工程结构

- [ ] `npx expo start` 正常启动
- [ ] Expo Router 识别 `src/app`
- [ ] Android / iOS / Web 均能进入首页
- [ ] `@/*` 路径全部可解析
- [ ] `expo-secure-store` 已安装并生成 lockfile

## B. 身份与权限

- [ ] 普通用户不能修改自己的 role
- [ ] 普通用户不能创建/修改/删除 journal
- [ ] 普通用户不能管理 music/tag/invitation/settings
- [ ] 普通用户只能读取自己的 profile
- [ ] 匿名用户不能读取 invitation_codes
- [ ] 并发核销邀请码不会超过 max_uses

## C. 文件安全

- [ ] 非管理员上传图片失败
- [ ] 非管理员上传音乐失败
- [ ] 超过 10MB 图片失败
- [ ] 超过 50MB 音频失败
- [ ] 不允许的 MIME/扩展名失败

## D. 本地安全

- [ ] PIN 不出现在 AsyncStorage
- [ ] Supabase 密码不出现在本地存储
- [ ] 生物识别只用于本机解锁
- [ ] 本地备份不是明文 JSON
- [ ] 删除本地数据同时删除 AES key
- [ ] PIN 连续 5 次失败退出 session

## E. 数据完整性

- [ ] 新建 journal 自动写入 author_id
- [ ] 编辑 journal 自动创建 journal_version
- [ ] 删除 journal 的权限由 RLS 决定
- [ ] 阅读量使用 RPC 原子递增
- [ ] 用户统计只统计当前用户自己的数据

## F. 产品功能

- [ ] 首页时间线
- [ ] 多维标签筛选
- [ ] 搜索与归档
- [ ] Markdown / 图文 / 对话
- [ ] 版本历史
- [ ] 评论
- [ ] 音乐伴读
- [ ] 个人中心
- [ ] 管理后台
- [ ] 备份 / 恢复
- [ ] 邀请码
