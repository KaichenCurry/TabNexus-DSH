# Compatibility

| DSH | 形态 | 状态 |
|---|---|---|
| `0.1.0-rc.6` Web | 顶栏图标 / 原生自适应右侧栏 / Chrome 同步 | 主要支持目标 |
| `0.1.0-rc.6` 桌面外壳 | 同一 Web Client | 主要支持目标 |
| 后续 rc 预览版 | 官方 `shell.overlay` Slot | 每次发布重新验证 |

## 兼容原则

- Client 只依赖 DSH 官方 `shell.overlay`、`conversation.input.left` 与 React 运行时。
- Host 只注入 `webServer` 作为同源 Chrome 桥代理，不注入 `tools` 或 Agent 服务。
- 无 better-sidebar、MCP Client、数据库和云服务前置依赖。
- Chrome 端使用 TabNexus 扩展的 DSH 专用本地 relay（默认 `127.0.0.1:43120`）。
- Chrome 扩展需为 `1.0.5` 或更高版本；DSH 专用通道不受旧“Agent 桥”开关影响。
- 支持浅色/深色主题、键盘操作、窄屏布局与 `prefers-reduced-motion`。

## 发布检查

1. `npm run typecheck`
2. `npm test`
3. `npm pack --dry-run`
4. 安装到全新 DSH profile。
5. 验证 Chrome 当前标签、平铺列表、聚焦标签、一键整理预览和分类持久化。
6. 验证 1440px、1024px、窄屏及桌面外壳。
