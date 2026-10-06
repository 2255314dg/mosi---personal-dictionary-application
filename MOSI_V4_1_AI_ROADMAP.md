# MOSI → Personal Thought Agent 路线图

```text
V4 个人思想档案
  ↓
V4.1 安全、备份、分享与稳定性基础
  ↓
V4.2 结构化思想数据库：概念 / 人物 / 理论 / 观点 / 论证关系
  ↓
V5 Embedding + RAG
  ↓
V5.1 个人思想知识图谱
  ↓
V6 AI 思想伴侣 / Personal Thought Agent
```

## V4.1

先保证时间、主题、心境、地点、版本、评论、分享、审计、设备、备份这些事实数据稳定。

## V4.2

增加：

- concepts
- people
- theories
- claims
- arguments
- journal_entities
- journal_relations

## V5

每篇思想日志分块后建立 embedding；检索采用：

`关键词 BM25/FTS + 向量相似度 + 时间衰减 + 主题过滤`

## V5.1

形成：

`人 → 经历 → 思考 → 概念 → 观点 → 论证 → 反例 → 修正 → 新观点`

## V6

Personal Thought Agent 不替用户思考，而是：

1. 记得用户过去说过什么。
2. 给出与当前问题最相关的历史思想。
3. 对比不同年份的观点变化。
4. 主动指出矛盾、盲点和概念漂移。
5. 保留“用户原观点”和“AI 推断”两条独立证据链。
6. 每次 AI 结论均能追溯到原始日志。
