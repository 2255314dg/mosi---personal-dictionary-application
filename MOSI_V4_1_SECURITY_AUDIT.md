# MOSI V4.1 安全审计

## V3/V4 原问题

- 客户端可以尝试修改 profiles.role。
- journals/comments/music/tags 曾存在过宽的写入策略。
- invitation_codes 曾允许匿名读取/更新。
- PIN 开关由个人中心控制。
- 本地备份曾可直接保存明文 JSON。
- public journals 与公开分享没有分层。
- 设备身份没有服务端授权模型。
- 文件上传限制主要依赖客户端。

## V4.1 修复

### A. 身份与设备

`device_registry` + `x-mosi-device-id` + SecureStore。

- 首台管理员设备：登录后自动引导授权。
- 后续设备：登记后必须由已授权管理员设备批准。
- RLS 通过 `is_device_allowed()` 检查设备。
- 未授权设备即使持有账号密码，也不能访问私人表。

### B. 数据库

- journals：仅已授权 authenticated 读取，admin 写入。
- comments：仅已授权 authenticated 读取/写入。
- journal_versions：仅已授权 authenticated 读取，admin 写入。
- profiles：仅当前用户/admin + 已授权设备。
- invitation_codes：表数据仅 admin。
- app_settings：普通用户只看到注册开关；安全策略通过 RPC。

### C. 审计

`audit_logs` 为追加式审计表。

数据库触发器记录：

- INSERT / UPDATE / DELETE
- journals
- journal_versions
- comments
- profiles
- invitation_codes
- app_settings
- music_tracks
- tag_catalog
- device_registry
- share_links

手动事件记录：

- LOGIN_SUCCESS
- 后续可扩展 LOGIN_FAILURE、SECURITY_LOCK、SHARE_CREATE、SHARE_REVOKE 等。

### D. 分享

私人表不再 public read。分享使用随机 Token + SECURITY DEFINER RPC：

`/share/:token -> get_mosi_shared_journal(token) -> 只返回指定文章快照`

分享页没有评论/版本/管理权限；深入探索必须进入墨思账号与设备授权体系。

### E. 本地数据

AES-GCM 加密草稿/备份，密钥保存在 SecureStore。退出登录时可以清除本地数据。

### F. 文件

V4.1 限制上传格式与大小；HEIC/HEIF 在编辑器侧统一转换为 JPEG。现有 Markdown 图片 URL 为兼容性保留 public read；V5 应迁移为 private object key + signed URL。
