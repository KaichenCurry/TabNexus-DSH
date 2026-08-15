# TabNexus for DSH · 安装教程（独立版，零 Chrome 依赖）

## 前置

- 已安装 DSH（DeepSeek Harness，`dsh` 命令可用）；
- pnpm 在 PATH（`dsh plugin` 内部使用）；
- **不需要** Chrome 扩展、不需要账号。

## 步骤一：安装插件

```bash
curl -LO https://github.com/KaichenCurry/TabNexus-DSH/releases/download/v0.2.0/dsh-plugin-tabnexus-0.2.0.tgz
dsh plugin --profile web add ./dsh-plugin-tabnexus-0.2.0.tgz
```

源码安装（开发者）：

```bash
git clone https://github.com/KaichenCurry/TabNexus-DSH.git
cd TabNexus-DSH
npm install --ignore-scripts && npm run build
dsh plugin --profile web add "$(pwd)"
```

## 步骤二：重启 DSH（必须）

退出 `dsh web` 后重新启动；浏览器页面 **Cmd+Shift+R** 强刷。

> 设置 → 插件里应能看到 `tabnexus`（`dsh-plugin-tabnexus`）。看不到 = 没重启。

## 步骤三：开始使用

1. **全局工作区**：右上角（session log 按钮正下方）「TabNexus 工作区▾」徽章 → 点击开小面板 →「**⛶ 全屏**」打开完整工作区：
   - 左侧：任务名 / 🎯目标 / 进度条 / 章节与页面（○◐⭐ 切换状态、点标题打开、移动到章节、删除确认、新建章节）；
   - 右侧收件口：**粘贴一个或多个 URL →「添加页面」**（独立版的主收集方式）。
2. **对话使用**（Agent 工具自动可用）：
   - 「把这三篇加入我的任务：https://…、https://…」
   - 「读一下我的当前任务，告诉我做到哪了、还缺什么」
   - 「把任务按背景、证据、反例整理，先给我预览」
   - 「总结这个任务，把结论写回」
3. 数据存在本机：`~/.dsh/storages/tabnexus/state.json`。

## 可选增强

1. **Agent 预设 + 技能**（让 Agent 遵循 TabNexus 工作流红线）：
   ```bash
   mkdir -p ~/.dsh/.agent-presets/tabnexus-research ~/.agents/skills/tabnexus
   cp preset/tabnexus-research/* ~/.dsh/.agent-presets/tabnexus-research/
   cp skills/tabnexus/SKILL.md ~/.agents/skills/tabnexus/
   ```
2. **Chrome 扩展**（解锁浏览器采集：当前窗口标签采集、保存并关闭）：
   安装 https://github.com/KaichenCurry/TabNexus 的扩展并启用「本机 Agent 连接」——插件自动探测到桥接后会启用对应工具；**不装不影响独立版全部功能**。

## 常见问题

| 问题 | 解法 |
|---|---|
| 设置里看不到插件 | `dsh plugin add` 后没重启 DSH |
| 工具报"浏览器采集类能力是可选增强" | 正常——独立版用 add_card / 面板粘贴 URL；要浏览器采集才需 Chrome 扩展 |
| 面板空白 | 点「刷新」；确认 DSH 已重启 |
| 想导出 | 面板「任务」页签 / Agent：`export_workspace` |
