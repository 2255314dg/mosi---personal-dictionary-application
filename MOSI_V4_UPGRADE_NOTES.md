# MOSI V4 升级记录

## 已实施

- [x] 恢复标准 Expo Router `src/app` 目录。
- [x] 恢复 `components / context / services / client / utils / lib` 模块结构。
- [x] 修复 `@/services/api`、`@/client/supabase` 等路径与源码目录不一致问题。
- [x] PostgreSQL RLS 全面收紧。
- [x] 防止普通用户修改 `profiles.role`。
- [x] 移除公开邀请码表读写。
- [x] 邀请码原子核销 RPC。
- [x] 日志阅读量原子递增 RPC。
- [x] Profile 隐私收紧。
- [x] 安全答案从明文迁移为 hash。
- [x] Storage 上传管理员化并加入大小/MIME 限制。
- [x] PIN 改用 SecureStore。
- [x] 生物识别不再保存 Supabase 密码。
- [x] PIN 连续 5 次失败退出 session。
- [x] 本地备份改为 AES-GCM 加密。
- [x] 个人统计改为只统计当前用户自己的日志/评论。
- [x] App version 提升到 1.1.0 / Android versionCode 2 / iOS build 2。

## 发布前必须完成

```bash
npx expo install expo-secure-store
npm install
npx expo start
```

然后在 Supabase SQL Editor 中依次执行旧版本迁移，再执行：

```text
supabase/migrations/00009_v4_security_hardening.sql
```

最后进行：

- Android 真机登录/注册测试
- iOS 真机生物识别测试
- Web 浏览器测试
- 普通用户 RLS 越权测试
- 管理员 CRUD 测试
- 邀请码并发注册测试
- 备份/恢复测试
- 图片/音乐大小与 MIME 测试
- PIN 5 次失败退出测试

## 注意

仓库原始 `pnpm-lock.yaml` 没有新增 `expo-secure-store` 的锁定记录；当前运行环境没有 pnpm，因此本次源码升级没有伪造 lockfile。应由实际开发环境运行 `pnpm install` / `npm install` 后重新生成与所选包管理器一致的 lockfile。
