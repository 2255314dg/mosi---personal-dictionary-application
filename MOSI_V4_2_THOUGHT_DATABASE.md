# MOSI V4.2：结构化思想数据库

## 1. 目标

V4.2 不再把“思想”仅作为 Markdown 正文保存，而是在保留 `journals` 原始思想载体的同时，建立可复用、可关联、可检索的思想实体层，为 V5 Embedding + RAG 和 V5.1 个人思想知识图谱提供稳定数据结构。

核心实体：

- `concept`：概念，例如“自由”“异化”“可计算性”
- `person`：人物，例如马克思、黑格尔、爱因斯坦
- `theory`：理论 / 学派，例如历史唯物主义
- `claim`：观点 / 命题，例如“人的自由以社会关系为条件”
- `argument`：论证结构，包括论题、前提、结论、反论

关系层：

- `journal_entities`：文章 ↔ 思想实体
- `journal_relations`：实体 ↔ 实体，可带文章上下文

## 2. 数据模型

```text
journals
   │
   ├── journal_entities ──> concepts
   │                    ──> people
   │                    ──> theories
   │                    ──> claims
   │                    ──> arguments
   │
   └── journal_relations
            │
            ├── source entity
            └── target entity
```

`journal_relations` 使用多态引用，因此可以表达：

```text
人物 → 提出 → 理论
理论 → 解释 → 概念
观点 → 支持 → 观点
观点 → 反驳 → 观点
论证 → 支撑 → 观点
人物 → 影响 → 人物
```

数据库触发器会校验多态引用；删除实体时会自动清理相关文章链接和关系，避免产生悬空节点。

## 3. 权限

V4.2 沿用 V4.1 的服务端安全边界：

```text
登录
  ↓
管理员身份
  ↓
设备白名单
  ↓
PostgreSQL RLS
  ↓
思想数据库
```

思想数据库不是公开数据。未经授权的复制 APK / 源码不能仅凭本地客户端状态直接读取这些表。

## 4. 前端

新增 `/thought-database`：

- 概念 / 人物 / 理论 / 观点 / 论证五类切换
- 全文关键词检索
- 创建结构化实体
- 删除实体
- 文章上下文下关联实体
- 建立实体关系

文章详情页新增“思想实体”区域；从这里可以进入当前文章的实体管理页面。

## 5. 与 V5 的衔接

V4.2 已预留 `metadata`、`canonical_key`、`aliases` 等字段，避免未来重新拆库。

推荐后续演进：

```text
V4.2 结构化实体
        ↓
V4.3 自动实体抽取 / 去重
        ↓
V5 Embedding + RAG
        ↓
V5.1 个人思想知识图谱
        ↓
V6 Personal Thought Agent
```

V4.2 本身不直接调用大模型，不把模型输出当作事实写入数据库；后续 AI 抽取应保留 `source_journal_id / confidence / provenance`，使每个自动生成的实体和关系都能追溯到原始思想记录。
