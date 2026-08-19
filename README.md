# TabNexus for DSH

> 在 DeepSeek Harness 里，直接接管当前 Chrome 标签。

[English](README.en.md) · [安装](docs/INSTALL.md) · [兼容性](docs/COMPATIBILITY.md) · [架构](docs/ARCHITECTURE.md)

TabNexus-DSH v0.4 不再是一套与浏览器分离的任务面板。它把 Chrome 当前窗口作为唯一标签来源，并以符合 DeepSeek Harness 的原生右侧栏呈现：

**打开即同步 → 平铺当前标签 → 一键整理 → 可编辑预览 → 确认分类**

![TabNexus-DSH v0.4 原生右侧标签栏](docs/tabnexus-dsh-v0.4.png)

## v0.4.4

- DSH 右上角只显示一个轻量 Tab 图标，不再使用悬浮状态胶囊。
- 点击后占用 DSH 原生右侧详情列，与默认左侧栏接近；中间会话会自然收缩，无背景遮罩和内容覆盖。
- 标题栏、搜索、视图切换、列表行和按钮全部改用 DSH 原生层级；移除大面积蓝色按钮和每行常驻下拉框。
- 面板打开后立即同步 Chrome 当前窗口，并在打开期间自动刷新。
- 默认平铺所有标签，显示 favicon、标题、域名、固定状态与当前标签。
- 双击或点击标题可切回对应的 Chrome 标签。
- “一键整理”接受任意分类要求，例如“按公司和求职阶段分类”。
- 分类文字以清晰彩色标签显示；点击标签即可修改分类。
- 整理完全在插件内生成可编辑预览，不向 DSH 对话注入提示词，也不会触发不存在的 Agent 工具。
- 面板打开时约每 0.9 秒轻量增量刷新，并阻止重复请求，Chrome 标签变化接近即时出现。
- 支持手动新建分类、移动标签、搜索，以及“全部 / 分类”两种简洁视图。
- 已移除任务流程图和三段式流程视图。

## 不需要另一套 Agent

DeepSeek Harness 本身就是 Agent，因此插件：

- 不注册 `mcp__tabnexus__*` Agent 工具；
- 不接入第三方模型 API；
- 不需要 API Key；
- 不保存或复制一份 Chrome 标签数据库。

Host 只提供同源 UI 代理，并自动启动包内的本机 Chrome relay；这个 relay 只允许“读取标签”和“聚焦标签”，不向 DSH 注册 Agent 工具。分类偏好保存在 DSH Web Client 的 `localStorage`；真实标签始终以 Chrome 当前窗口为准。

## 一键安装

下载 Release 中的 `TabNexus-DSH-v0.4.4-macOS.zip`，解压后双击：

```text
安装 TabNexus.command
```

安装器会自动完成插件安装、创建可恢复的 DSH 登录常驻服务、路由自检，并同时打开 Web 端与已安装的桌面外壳；如果本机是解压加载的 Chrome 扩展，也会触发一次无循环的后台刷新并自动重连。Web 与桌面端使用同一个 `127.0.0.1:3080` 服务，所以入口、功能和分类数据一致；关闭安装窗口后服务也不会消失。

也可以使用命令行安装：

```bash
curl -LO https://github.com/KaichenCurry/TabNexus-DSH/releases/download/v0.4.4/dsh-plugin-tabnexus-0.4.4.tgz
dsh plugin --profile web add ./dsh-plugin-tabnexus-0.4.4.tgz
```

Chrome 端仍需安装 TabNexus 扩展 `1.0.6+`。无需 API Key、无需 MCP 配置，也不需要另外启动桥接命令；DSH 专用同步不受旧“Agent 桥”开关影响。

## 使用

1. 在 Chrome 打开要处理的页面。
2. 点击 DSH 右上角的 TabNexus 图标。
3. 在“全部”视图确认当前标签已同步。
4. 点击“一键整理”，输入任意分类方式并生成预览。
5. 调整个别标签后点击“应用分类”。

## 安全边界

- v0.4 只读取和聚焦当前标签，不提供批量关闭或静默删除。
- DSH 只拿到标题、URL、域名和浏览器状态，不会因此读取网页正文。
- Chrome 桥仅允许连接 `127.0.0.1` / `localhost`。
- 整理结果不会静默覆盖已有分类。

## 开发

```bash
npm install --legacy-peer-deps
npm run typecheck
npm test
npm run pack:check
```

## License

[MIT](LICENSE)
