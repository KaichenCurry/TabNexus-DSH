# 安装、升级与卸载

## 安装

需要 DeepSeek Harness `0.1.0-rc.6` 或兼容预览版。

推荐下载 `TabNexus-DSH-v0.4.3-macOS.zip`，解压后双击“安装 TabNexus.command”。它会安装插件、重启 DSH、检查路由并打开页面。

命令行方式：

```bash
curl -LO https://github.com/KaichenCurry/TabNexus-DSH/releases/download/v0.4.3/dsh-plugin-tabnexus-0.4.3.tgz
dsh plugin --profile web add ./dsh-plugin-tabnexus-0.4.3.tgz
```

同时安装 TabNexus Chrome 扩展。插件自带本地 relay，无需单独启动服务、无需 MCP 配置或 API Key。重启 DSH Web 服务并刷新页面；右上角出现 Tab 图标即安装成功。

## 从源码安装

```bash
git clone https://github.com/KaichenCurry/TabNexus-DSH.git
cd TabNexus-DSH
npm install --legacy-peer-deps
npm test
npm pack
dsh plugin --profile web add ./dsh-plugin-tabnexus-0.4.3.tgz
```

## 升级

同版本本地 tgz 反复安装时，pnpm 可能复用缓存。开发阶段可先移除再添加：

```bash
dsh plugin --profile web remove dsh-plugin-tabnexus
dsh plugin --profile web add ./dsh-plugin-tabnexus-0.4.3.tgz
```

## 数据位置

真实标签来自 Chrome 当前窗口，不在 DSH 中复制。分类偏好使用 Web Client 的 `localStorage`，键名为 `tabnexus:dsh:tab-manager:v4`。Web 和桌面外壳连接同一 DSH 地址时使用同一套 Client；不同浏览器 profile 的分类偏好彼此隔离。

卸载插件不会主动执行删除操作。若要清空数据，可在浏览器开发者工具中删除上述键；执行前请自行备份其 JSON 值。

## 常见问题

| 现象 | 处理 |
|---|---|
| 没有右上角入口 | 确认插件安装到 `web` profile，重启服务后强制刷新 |
| 显示“Chrome 未连接” | 打开一次 Chrome 扩展并点刷新；确认 DSH 专用的 `127.0.0.1:43120` 未被防火墙拦截 |
| 标签数量与预期不同 | TabNexus 读取 Chrome 最后聚焦的窗口；切到目标窗口后点刷新 |
| 一键整理没有提交给 DSH | 先进入一个 DSH 对话，并确保输入框中没有未发送草稿 |
| Agent 看不到 TabNexus 工具 | 这是预期行为；插件不注册额外 Agent/MCP 工具 |
