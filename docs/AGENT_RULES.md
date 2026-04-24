# TokenSave 开发规范

## 分支策略
- main 分支受保护，禁止直接提交
- 所有变更通过 feature branch + PR 流程
- coding_cat 不持有 main 写权限（Path B 模式）

## PR 流程
1. Hermes 定义 issue
2. BG 批准 issue
3. coding_cat 实现（feature branch）
4. coding_cat 打开 PR targeting main
5. guardian_cat 安全审查
6. coding_cat 修复 review comments
7. guardian_cat PASS
8. BG 批准合并

## 安全红线
- 禁止提交 token/key/secret
- 禁止 backend/telemetry/analytics
- 禁止直接推送 main
- 禁止引入外部网络调用（fetch/XMLHttpRequest/sendBeacon）
