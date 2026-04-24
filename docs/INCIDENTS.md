# 事件记录

## 2026-04-25 I1 直接提交事故
- 日期：2026-04-25
- 问题：coding_cat 将 I1 变更直接提交到 main 分支，绕过 PR + guardian_cat 审查流程
- 根因：分支保护未启用 + 未强制 PR 流程 + coding_cat 持有写权限
- 修复措施：
  - 采用 Path B 模式：coding_cat 不持有写权限，只输出 patch/diff
  - Hermes / BG 持有应用权
  - 所有变更通过 controlled branch + PR + guardian_cat 审查
