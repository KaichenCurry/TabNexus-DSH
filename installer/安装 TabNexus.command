#!/bin/zsh

set -euo pipefail

INSTALLER_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_PATH="$INSTALLER_DIR/dsh-plugin-tabnexus-0.4.3.tgz"
LOG_DIR="$HOME/.dsh/logs"
LOG_PATH="$LOG_DIR/tabnexus-web.log"

clear 2>/dev/null || true
print "TabNexus for DeepSeek Harness"
print "正在安装，请不要关闭这个窗口…"
print ""

if [[ -x /opt/homebrew/bin/dsh ]]; then
  DSH_BIN=/opt/homebrew/bin/dsh
elif [[ -x /usr/local/bin/dsh ]]; then
  DSH_BIN=/usr/local/bin/dsh
elif command -v dsh >/dev/null 2>&1; then
  DSH_BIN="$(command -v dsh)"
else
  print "安装失败：没有找到 DeepSeek Harness 的 dsh 命令。"
  print "请先安装 DSH，再重新双击本文件。"
  read -k 1 "?按任意键关闭…"
  exit 1
fi

if [[ ! -f "$PACKAGE_PATH" ]]; then
  print "安装失败：安装包不完整，缺少 dsh-plugin-tabnexus-0.4.3.tgz。"
  read -k 1 "?按任意键关闭…"
  exit 1
fi

print "1/4  安装 TabNexus 插件"
"$DSH_BIN" plugin --profile web add "$PACKAGE_PATH"

print "2/4  重新启动 DSH Web 服务"
BLOCKED_PORT=0
for PID_VALUE in ${(f)"$(lsof -tiTCP:3080 -sTCP:LISTEN 2>/dev/null || true)"}; do
  [[ -z "$PID_VALUE" ]] && continue
  PROCESS_COMMAND="$(ps -p "$PID_VALUE" -o command= 2>/dev/null || true)"
  if [[ "$PROCESS_COMMAND" == *"/dsh web"* || "$PROCESS_COMMAND" == *"dsh-host-webserver"* || "$PROCESS_COMMAND" == *"@deepseek-ai/dsh"* ]]; then
    kill -TERM "$PID_VALUE" 2>/dev/null || true
  else
    print "端口 3080 正被其他程序占用：$PROCESS_COMMAND"
    BLOCKED_PORT=1
  fi
done

if [[ "$BLOCKED_PORT" -eq 1 ]]; then
  print "安装已完成，但无法自动启动 DSH。请先关闭占用 3080 端口的程序。"
  read -k 1 "?按任意键关闭…"
  exit 1
fi

mkdir -p "$LOG_DIR"
sleep 1
nohup "$DSH_BIN" web >"$LOG_PATH" 2>&1 </dev/null &!

print "3/4  检查 Web 与桌面端共用服务"
READY=0
for ATTEMPT in {1..40}; do
  STATUS_CODE="$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/plugins/tabnexus/chrome-tabs 2>/dev/null || true)"
  if [[ "$STATUS_CODE" == "200" || "$STATUS_CODE" == "503" ]]; then
    READY=1
    break
  fi
  sleep 0.5
done

if [[ "$READY" -ne 1 ]]; then
  print "插件已安装，但 DSH 没有在预期时间内启动。"
  print "日志位置：$LOG_PATH"
  read -k 1 "?按任意键关闭…"
  exit 1
fi

print "4/4  打开 DeepSeek Harness"
open "http://127.0.0.1:3080/"
open -a "Google Chrome" "chrome-extension://acdbaefohllahmpmkgjjgdcilijjbbpo/workspace.html" 2>/dev/null || true
if [[ -d "/Applications/DeepSeek Harness.app" ]]; then
  open -a "DeepSeek Harness" || true
fi

CHROME_CODE="$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/plugins/tabnexus/chrome-tabs 2>/dev/null || true)"
print ""
if [[ "$CHROME_CODE" == "200" ]]; then
  print "✓ 安装完成，Chrome 标签已连接。"
else
  print "✓ 插件安装完成。"
  print "  如果右侧暂时没有标签，请在 Chrome 中打开一次 TabNexus 扩展，然后点刷新。"
fi
print ""
print "以后直接打开 DSH，点击右上角的 TabNexus 图标即可使用。"
print "日志位置：$LOG_PATH"
read -k 1 "?按任意键关闭…"
