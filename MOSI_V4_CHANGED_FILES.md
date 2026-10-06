# V3 → V4 文件级变更清单

## 新增

- `supabase/migrations/00009_v4_security_hardening.sql` — RLS、RPC、Profile 防提权、Storage policy、索引、输入约束
- `supabase/migrations/README.md`
- `docs/MOSI_V4_ARCHITECTURE.md`
- `docs/MOSI_V4_SECURITY_AUDIT.md`
- `docs/MOSI_V4_UPGRADE_NOTES.md`
- `docs/MOSI_V4_ACCEPTANCE.md`
- `docs/diagrams/mosi_arch.{svg,png}`
- `docs/diagrams/mosi_er.{svg,png}`
- `docs/diagrams/mosi_flow.{svg,png}`
- `docs/MOSI_V4_overview_reference.png`

## 核心修改

- `src/services/api.ts`
  - 管理员判断改为数据库 role
  - 日志创建写入 `author_id`
  - 阅读量改用原子 RPC
  - 邀请码改用 RPC 校验/核销
  - Profile 安全答案改用 hash RPC
  - 文件上传增加管理员检查、扩展名和大小限制
  - 邀请码生成改用 CSPRNG（支持 `crypto.getRandomValues`）
  - 用户统计改为只统计当前用户自己的日志/评论
- `src/utils/security.ts`
  - PIN / biometric flag 改用 SecureStore
  - 删除本地 Supabase 密码存储逻辑
- `src/utils/backup.ts`
  - 本地备份改为 AES-GCM
  - AES key 放 SecureStore
  - 恢复流程增加错误保护
- `src/app/login.tsx`
  - 删除“用户名包含 admin 即管理员”的逻辑
  - 注册默认 role=user
  - 邀请码由安全 RPC 原子核销
  - 不再保存账号密码用于生物识别
- `src/app/profile.tsx`
  - 不再读取明文 security_answer
  - 开启生物识别前要求真实生物识别验证
- `src/components/PinKeypadModal.tsx`
  - 增加 5 次失败锁定/退出回调
- `src/app/_layout.tsx`
  - PIN 连续失败后退出 Supabase session
- `src/app/admin.tsx`
  - 页面入口增加服务端管理员检查
- `src/app/editor.tsx`
  - 编辑器入口增加服务端管理员检查
- `app.json`
  - 版本升级至 1.1.0 / Android 2 / iOS build 2
  - 增加 expo-secure-store 插件
- `package.json`
  - 增加 `expo-secure-store`
- `pnpm-workspace.yaml`
  - 增加 `expo-secure-store` catalog
- `README-en.md`
  - 更新为 V4 架构与安全说明

## 结构重构

原 V3 源码被扁平放置在仓库根目录；V4 恢复标准 Expo Router 结构：

```text
src/app
src/components
src/components/ui
src/context
src/services
src/client
src/utils
src/lib
src/legacy
```

这与 `app.json` 的 `router.root = src` 以及 `tsconfig` 的 `@/* -> src/*` 保持一致。
