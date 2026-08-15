# TabNexus for DSH

> **「一切皆插件 —— 那浏览器里那 50 个 Tab，也该是。」**
> 诚邀全球 Harness 开发者共建 DSH 插件生态。

**TabNexus for DSH** 是 DSH 独立可用的浏览器任务上下文插件：**零 Chrome 依赖，装完即用**。
把散落的页面收成任务文档（目标 / 章节 / 状态 / 进度 / 结论），Agent 通过 12 个 `mcp__tabnexus__*` 工具读写，界面内置**全局工作区**（与 Chrome 版同款 UI）。

| 能力 | 说明 |
|---|---|
| 任务文档 | 任务 / 自由章节 / 页面（待读·已读·已采用·已排除）/ 备注 / 目标 / 结论 / 进度条 |
| 全局工作区 UI | 右上角徽章 → 小面板 →「⛶ 全屏」：任务头+章节+页面操作 + 收件口快速添加 URL |
| Agent 工具 | 12 个本地工具：read/search/add_cards/write_report/propose_structure/edit_workspace/manage_workspaces/delete(确认)/export/preferences/activity + 版本校验 + 幂等收据 + 破坏性确认 |
| 零依赖 | 本地存储 `~/.dsh/storages/tabnexus/state.json`，不需要 Chrome 扩展、不需要账号、不需要网络 |

## 安装（30 秒）

```bash
# 下载并安装（需要 pnpm 在 PATH；DSH 提供 dsh plugin 命令）
curl -LO https://github.com/KaichenCurry/TabNexus-DSH/releases/download/v0.2.0/dsh-plugin-tabnexus-0.2.0.tgz
dsh plugin --profile web add ./dsh-plugin-tabnexus-0.2.0.tgz
# 重启 DSH（必须），浏览器页面 Cmd+Shift+R
```

完整图文教程：[docs/INSTALL.md](docs/INSTALL.md)

## 使用（装完即用）

1. **界面**：右上角（session log 按钮下方）TabNexus 徽章 → 点击打开面板 →「⛶ 全屏」进全局工作区；收件口**粘贴 URL 快速添加页面**；
2. **对话**：任何会话直接说——
   - 「帮我把这三篇加入我的任务：URL1、URL2、URL3」
   - 「读一下我的当前任务，告诉我做到哪了、还缺什么」
   - 「把任务按背景、证据、反例整理，先给我预览」（Agent 会先出方案，确认后应用）
   - 「总结这个任务，把结论写回」
3. **可选增强**：安装 [TabNexus Chrome 扩展](https://github.com/KaichenCurry/TabNexus) 可解锁浏览器采集类工具（当前窗口标签采集/保存并关闭）——**不装也完整可用**。

## 可选：Agent 预设 + 技能（推荐）

让 Agent 更懂 TabNexus 工作流（先读后写、尊重排除项、破坏性确认）：

```bash
mkdir -p ~/.dsh/.agent-presets/tabnexus-research ~/.agents/skills/tabnexus
cp preset/tabnexus-research/* ~/.dsh/.agent-presets/tabnexus-research/
cp skills/tabnexus/SKILL.md ~/.agents/skills/tabnexus/
```

新建会话时预设选「TabNexus Research」。

## 验证记录（2026-08-15，全部实测）

| # | 验证 | 结果 |
|---|---|---|
| 1 | 离线全链路 `node scripts/verify.mjs`（存储/工具/版本冲突/破坏性确认/幂等/导出/降级） | ✅ 19/19 |
| 2 | `dsh plugin add` 安装 + `--dump-config` 组合树 | ✅ |
| 3 | **零 Chrome headless 会话**：Agent 调用 read_workspace / add_cards / edit_workspace 读写本地任务 | ✅ |

## 生态

- GitHub Topic：[`dsh-plugin`](https://github.com/topics/dsh-plugin)
- 插件开发规范参考：[dsh-agent-teams 开发指南](https://github.com/NanmiCoder/dsh-agent-teams/blob/main/docs/developing-dsh-plugins.md)
- Chrome 扩展版（可选增强）：[KaichenCurry/TabNexus](https://github.com/KaichenCurry/TabNexus)

## License

[MIT](LICENSE)
