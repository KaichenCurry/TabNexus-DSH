# Compatibility

| DSH | 形态 | 状态 |
|---|---|---|
| `0.1.0-rc.6` Web | 右侧 Dock / 展开工作区 | 主要支持目标 |
| `0.1.0-rc.6` 桌面外壳 | 同一 Web Client | 主要支持目标 |
| 后续 rc 预览版 | 官方 `shell.overlay` Slot | 每次发布重新验证 |

## 兼容原则

- Client 只依赖 DSH 官方 Slot 与 React 运行时。
- Host 插件为空壳，不注入 `tools`、`webServer` 或 Agent 服务。
- 无 better-sidebar、MCP Client、数据库和云服务前置依赖。
- 支持浅色/深色主题、键盘操作、窄屏布局与 `prefers-reduced-motion`。

## 发布检查

1. `npm run typecheck`
2. `npm test`
3. `npm pack --dry-run`
4. 安装到全新 DSH profile。
5. 验证任务、分类、网页、状态、流程视图与刷新持久化。
6. 验证 1440px、1024px、窄屏及桌面外壳。
