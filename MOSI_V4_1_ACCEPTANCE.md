# MOSI V4.1 验收清单

## P0 安全

- [ ] 普通用户修改 `profiles.role` 必须失败。
- [ ] 未授权设备查询 journals 必须得到空结果/权限拒绝。
- [ ] 未授权设备不能读取 comments、versions、tags、music。
- [ ] invitation_codes 表不能被 anon 读取。
- [ ] 未授权管理员设备不能批准另一台设备。
- [ ] Share Token 可以公开阅读指定文章，但不能通过 token 查询其它文章。
- [ ] 删除文章后 versions/comments/share_links 联动删除。
- [ ] audit_logs 对普通用户不可读、不可改、不可删。

## P0 编辑器

- [ ] 新建文章初始正文为空。
- [ ] 表格插入后所有单元格为空。
- [ ] 代码块使用语言列表，不要求手输类型。
- [ ] `>` 引用支持自定义发言者与正文。
- [ ] 插入分隔线后键盘/输入焦点不被主动关闭。
- [ ] 撤销/重做连续操作正确。
- [ ] 编辑中插图不会覆盖现有 content state。
- [ ] HEIC/HEIF 选择后转换成 JPEG 并上传。
- [ ] 至少 30 秒自动保存一次；默认 30 秒。
- [ ] 自动保存不新增 journal_versions。

## P0 数学

以下公式必须显示完整：

```latex
\[
V=\frac{\text{获得资源}}{\text{维持成本}}
\]

\(V\)

\[
\downarrow C
\]

\[
\mathcal{Z}^{-1}\!\left\{\frac{z}{z-a}\right\}=a^k
\]

\[
\lim_{t\rightarrow T}B(t)
\]
```

以及：集合、希腊字母、上下标、根式、括号、求和、积分、极限、乘积、矩阵、行列式、逻辑符号、向量、间距、对齐等常用 KaTeX 数学语法。

## P1 分享

- [ ] 微信/QQ/系统分享都得到 `/share/:token`。
- [ ] 未安装墨思的浏览器可以阅读。
- [ ] 评论/深入探索按钮引导安装/登录墨思。
- [ ] 分享链接过期后不可阅读。
- [ ] 管理员可以撤销分享链接。

## P1 朗读

- [ ] 中文内容优先使用 zh-CN。
- [ ] 优先 Enhanced voice。
- [ ] 句号/问号/感叹号有不同的 rate/pitch。
- [ ] 可停止朗读。

## P1 构建

```bash
pnpm install
pnpm exec expo install --fix
pnpm exec tsc --noEmit
pnpm expo start
pnpm expo export --platform web
```

注意：当前开发环境无法访问 npm registry，因此本次 ZIP 没有重新生成依赖锁文件；首次在联网环境安装依赖时应让 Expo/pnpm 更新 lockfile。


## V4.2 验收补充

- [ ] 执行 `00011_v4_2_thought_database.sql` 后，7 张 V4.2 表创建成功。
- [ ] 概念、人物、理论、观点、论证可以创建、搜索、删除。
- [ ] 文章可以关联思想实体，并指定核心 / 提及 / 支撑 / 反方 / 来源 / 问题角色。
- [ ] 实体之间可以建立跨类型关系。
- [ ] 删除实体后不会留下 `journal_entities` / `journal_relations` 悬空记录。
- [ ] 未授权设备不能通过客户端直接读取 V4.2 表。
- [ ] 本地加密备份包含 V4.2 数据，恢复流程能够恢复这些实体和关系。
- [ ] 现有 V4.1 文章、版本、分享、审计、设备授权、自动保存、朗读、LaTeX 等功能继续可用。

当前环境没有安装项目依赖且无法访问 npm registry，因此本次只能完成静态语法级检查；真实 Supabase migration、Expo Web/Android/iOS 构建和真机验证必须在联网开发环境执行。
