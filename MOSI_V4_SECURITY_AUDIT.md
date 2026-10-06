# MOSI V3 → V4 代码级安全体检

## 严重度定义

- **Critical**：可直接导致权限提升、凭据泄露或核心数据被任意篡改。
- **High**：可导致大范围数据破坏、敏感数据暴露或任意文件上传。
- **Medium**：业务完整性、滥用或隐私风险明显，但需要额外条件。
- **Low**：工程质量或防御性问题。

## 已修复

### C-01：Profile role 可被普通用户自改（Critical）
V3 的 `profiles` 更新策略只检查 `auth.uid() = id`，因此客户端可以尝试把自己的 `role` 写成 `admin`。V4 使用数据库 trigger 阻止非管理员修改 `role`，并由 `public.is_admin()` 统一判断管理员身份。

### C-02：邀请码可被公开读取和更新（Critical）
V3 存在公开 SELECT / UPDATE policy。攻击者可以枚举邀请码并竞争修改 `uses_count`。V4 改成 security-definer RPC，并通过条件 UPDATE 实现原子核销。

### C-03：管理员判断依赖邮箱字符串（High）
V3 多处存在 `email.includes('admin')`。V4 取消该机制，UI 只使用数据库 profile role，真正权限由 RLS 决定。

### H-01：日志任意写/改/删（High）
V3 authenticated 用户可对 journals 全量 INSERT/UPDATE/DELETE。V4 限制为管理员。

### H-02：音乐/标签任意写（High）
V3 music_tracks、tag_catalog 写策略过宽。V4 限制为管理员。

### H-03：Storage 任意上传（High）
V3 journal-images 和 music bucket 允许 anon/authenticated 上传。V4 限制管理员，并增加 MIME/大小限制。

### H-04：Profile 公共 SELECT 暴露敏感字段（High）
V3 允许 anon/authenticated 读取 profiles 全表。V4 限制 owner/admin。

### H-05：security_answer 明文存储（High）
V4 迁移到 `security_answer_hash`，原明文字段删除。

### H-06：生物识别保存 Supabase password（High）
V3 将账号密码写入 AsyncStorage。V4 生物识别只作为本机解锁门槛，密码不再落盘。

### H-07：本地备份明文（High）
V4 改为 AES-GCM 加密备份，密钥放 SecureStore。

### M-01：阅读量存在读改写竞态（Medium）
V4 使用数据库 RPC 原子递增。

### M-02：PIN 无限尝试（Medium）
V4 连续 5 次错误后退出当前 Supabase session。

## 尚未完成的安全增强

1. **CSRF / rate limit**：Supabase RPC 仍应配合 Edge Function 或 WAF 层的请求频率控制。
2. **评论反滥用**：当前仍允许匿名评论；建议增加 IP/设备级 rate limit（应放在 Edge Function，不应依赖客户端）。
3. **安全问题恢复流程**：当前只保存安全问题及 hash，没有实现可靠的“忘记密码”闭环。不要在客户端自行实现密码重置绕过。
4. **审计日志**：建议新增 `audit_logs`，记录管理员删除评论、修改标签、邀请码操作、备份恢复等。
5. **内容导出**：管理员导出前应再次执行权限检查，并对导出包进行密码保护/加密。
6. **图片 URL**：当前公开图片仍然是 public bucket 语义；如果日志未来支持私人内容，应改为 private bucket + signed URL。

## V4 安全原则

> UI 是便利层，RLS/RPC 是安全边界，Storage policy 是文件安全边界，SecureStore 是本地秘密存储边界。
