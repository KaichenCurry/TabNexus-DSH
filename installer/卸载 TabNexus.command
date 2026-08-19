#!/bin/zsh

set -euo pipefail

clear 2>/dev/null || true
print "TabNexus for DeepSeek Harness"
print ""

if [[ -x /opt/homebrew/bin/dsh ]]; then
  DSH_BIN=/opt/homebrew/bin/dsh
elif [[ -x /usr/local/bin/dsh ]]; then
  DSH_BIN=/usr/local/bin/dsh
elif command -v dsh >/dev/null 2>&1; then
  DSH_BIN="$(command -v dsh)"
else
  print "没有找到 dsh 命令。"
  read -k 1 "?按任意键关闭…"
  exit 1
fi

print "正在从 web profile 卸载 TabNexus…"
"$DSH_BIN" plugin --profile web remove dsh-plugin-tabnexus || true
LAUNCH_AGENT_PATH="$HOME/Library/LaunchAgents/com.tabnexus.dsh-web.plist"
launchctl bootout "gui/$(id -u)/com.tabnexus.dsh-web" 2>/dev/null || true
if [[ -f "$LAUNCH_AGENT_PATH" ]]; then
  rm -f "$LAUNCH_AGENT_PATH"
fi
print ""
print "✓ 已卸载。重新启动 DSH 后生效。"
print "Chrome 插件与浏览器中的标签数据没有被删除。"
read -k 1 "?按任意键关闭…"
