# Architecture

## 结构

```text
Task
├── goal
├── Category
│   └── Webpage (title, URL, note, status)
└── Uncategorized webpages
```

状态只有三种：`todo`、`doing`、`done`。流程视图是同一份数据的轻量呈现，不建立额外工作流模型。

## Host

`src/index.ts` 只保留 DSH 插件声明。它不注入 Agent 工具、不注册 HTTP 路由、不启动 MCP，也不读写服务端文件。

## Client

`src/client/index.tsx` 通过官方 `shell.overlay` Slot 注册入口，并包含：

- 右上角状态胶囊；
- 约 414px 的玻璃 Dock；
- 大任务使用的展开工作区；
- 分类视图和三段式流程视图；
- `localStorage` 数据仓库与同源窗口更新。

所有操作在 Client 内完成。持久化键为 `tabnexus:dsh:workspace:v3`，没有网络请求、SSE 或 Host API。
