# Architecture

## One source of truth

```text
Chrome 当前窗口
    │ bundled UI-only relay (127.0.0.1:43120)
    ▼
DSH Host UI proxy
    │ same-origin /plugins/tabnexus/chrome-*
    ▼
TabNexus 右侧栏
```

TabNexus-DSH 不复制 Chrome 标签，也不维护第二份网页数据库。面板每次打开立即读取 Chrome 当前窗口，并在可见期间用防重入的 0.9 秒轻量刷新保持同步。标题、URL、favicon、固定状态和当前状态都来自 Chrome。

## Host

`src/index.ts` 注入 DSH 的 `webServer`，仅注册两个 UI 内部路由：

- `GET /plugins/tabnexus/chrome-tabs`：读取当前 Tab workbench；
- `POST /plugins/tabnexus/chrome-action`：只允许 `focus`，把已有 Chrome 标签切到前台。

Host 不注册 Agent 工具，不启动 MCP Server，不调用模型，不保存状态。Host 会在没有既存桥时自动启动包内的 UI-only relay；它只接受 loopback Chrome 扩展连接，且只放行读取 workbench 和聚焦标签。写操作采用最新 revision；关闭、删除等破坏性动作没有公开入口。

## Client

`src/client/index.tsx` 使用 DSH 官方 Slot 与布局能力：

- `shell.overlay`：只渲染全局右上角图标；
- `details`：打开时动态占用 DSH 原生右侧详情列，关闭后立即释放并恢复 DSH 自带详情面板。中间会话列由官方三栏布局自动收缩，不会被侧栏遮住。

界面默认是当前标签的平铺列表。分类只是一层本地视图偏好：

```text
localStorage tabnexus:dsh:tab-manager:v4
├── categories
└── assignments: normalized URL → category id
```

一键整理根据标题、域名和 URL 在插件内生成可编辑预览，用户确认后才写入分类偏好。插件不会注入 DSH 对话、调用 Agent 工具、声称读过网页正文或静默改变 Chrome 标签。

## Desktop and Web

DSH 桌面端是 Web Client 的应用外壳，两端加载同一个 Client bundle。所有 Chrome 读取都发生在 Host 侧，因此不依赖页面跨域请求或浏览器扩展 API 暴露给 DSH 页面。
