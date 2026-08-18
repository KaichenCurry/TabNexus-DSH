# 安装、升级与卸载

## 安装

需要 DeepSeek Harness `0.1.0-rc.6` 或兼容预览版。

```bash
curl -LO https://github.com/KaichenCurry/TabNexus-DSH/releases/download/v0.3.0/dsh-plugin-tabnexus-0.3.0.tgz
dsh plugin --profile web add ./dsh-plugin-tabnexus-0.3.0.tgz
```

重启 DSH Web 服务并刷新页面。右上角出现 `TabNexus` 胶囊即安装成功。插件不需要 MCP、API Key、Skill、预设或 Chrome 扩展。

## 从源码安装

```bash
git clone https://github.com/KaichenCurry/TabNexus-DSH.git
cd TabNexus-DSH
npm install --legacy-peer-deps
npm test
npm pack
dsh plugin --profile web add ./dsh-plugin-tabnexus-0.3.0.tgz
```

## 升级

同版本本地 tgz 反复安装时，pnpm 可能复用缓存。开发阶段可先移除再添加：

```bash
dsh plugin --profile web remove dsh-plugin-tabnexus
dsh plugin --profile web add ./dsh-plugin-tabnexus-0.3.0.tgz
```

## 数据位置

数据使用 Web Client 的 `localStorage`，键名为 `tabnexus:dsh:workspace:v3`。Web 和桌面外壳连接同一 DSH 地址时使用同一套 Client；不同浏览器 profile 的数据彼此隔离。

卸载插件不会主动执行删除操作。若要清空数据，可在浏览器开发者工具中删除上述键；执行前请自行备份其 JSON 值。

## 常见问题

| 现象 | 处理 |
|---|---|
| 没有右上角入口 | 确认插件安装到 `web` profile，重启服务后强制刷新 |
| 添加网址失败 | 仅支持完整的 `http://` 或 `https://` 地址 |
| Web 与另一浏览器数据不同 | 本地存储按浏览器 profile 隔离，这是预期行为 |
| Agent 看不到 TabNexus | 这是纯 UI 插件，设计上不向 Agent 注册工具 |
