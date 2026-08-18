#!/usr/bin/env node
import { createServer } from "node:http";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { apply } from "../lib/index.js";

const root = resolve(import.meta.dirname, "..");
const checks = [];
const ok = (name, pass) => checks.push({ name, pass: Boolean(pass) });
const missing = async (path) => { try { await access(resolve(root, path)); return false; } catch { return true; } };

const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const host = await readFile(resolve(root, "lib/index.js"), "utf8");
const client = await readFile(resolve(root, "lib/client.js"), "utf8");
const clientSource = await readFile(resolve(root, "src/client/index.tsx"), "utf8");
const readme = await readFile(resolve(root, "README.md"), "utf8");
const architecture = await readFile(resolve(root, "docs/ARCHITECTURE.md"), "utf8");

ok("release version is 0.4.2", pkg.version === "0.4.2");
ok("host and client exports exist", pkg.exports["."]?.default === "./lib/index.js" && pkg.exports["./client"]?.default === "./lib/client.js");
ok("package has no Agent tools dependency", !pkg.peerDependencies?.["@deepseek-ai/dsh-tools"] && !pkg.devDependencies?.["@deepseek-ai/dsh-tools"]);
ok("package has no MCP client dependency", !JSON.stringify(pkg).includes("dsh-mcp-client"));
ok("stale standalone storage output is absent", await missing("lib/core.js") && await missing("lib/routes.js"));

ok("Host uses only webServer", /inject\s*=\s*\[\"webServer\"\]/.test(host));
ok("Host does not register DSH Agent tools", !host.includes("defineTool") && !host.includes("ctx.tools"));
ok("Host exposes Chrome snapshot route", host.includes("/plugins/tabnexus/chrome-tabs") && host.includes("read_tab_workbench"));
ok("Host exposes only safe focus action", host.includes("/plugins/tabnexus/chrome-action") && host.includes("focus_tab") && !host.includes("close_browser_tabs"));
ok("Host limits bridge to loopback", host.includes("Chrome 桥只允许使用本机地址"));

ok("Client uses official overlay slot", client.includes("shell.overlay") && client.includes("tabnexus:overlay"));
ok("Client uses DSH composer input bridge", client.includes("conversation.input.left") && client.includes("inputActions"));
ok("Client mounts the native DSH details column", client.includes('name: "details"') && client.includes("priority: -100") && client.includes("openDetails") && client.includes("closeDetails"));
ok("Client renders icon entry instead of pill", client.includes("tnx-entry") && !client.includes("tnx-chip"));
ok("Client keeps a recoverable panel toggle", client.includes("aria-pressed") && !client.includes("tabnexus:dsh:panel-open"));
ok("Client panel is owned by native layout", client.includes("width:100%") && !client.includes("position:fixed;z-index:72"));
ok("Client syncs live Chrome tabs", client.includes("/plugins/tabnexus/chrome-tabs") && clientSource.includes("3_000"));
ok("Client starts with a flat tab view", clientSource.includes('useState<\"flat\" | \"grouped\">(\"flat\")') && client.includes("全部"));
ok("Client supports one-click organization", client.includes("一键整理") && client.includes("让 DSH 帮你梳理") && client.includes("整理预览"));
ok("Client supports freeform classification", client.includes("按公司和求职阶段分类") && client.includes("classification") === false);
ok("Client preserves SPA hash routes", !clientSource.includes('url.hash = ""'));
ok("Explicit category lists stay authoritative", clientSource.includes("explicitCategoryScore") && clientSource.includes("explicit.length ? explicit"));
ok("Client supports manual categories", client.includes("新建分类") && client.includes("未分类") && client.includes("tnx-assignment"));
ok("Client focuses existing Chrome tabs", client.includes("/plugins/tabnexus/chrome-action") && client.includes("focusChromeTab"));
ok("Client has no flow view", !client.includes("流程") && !client.includes("tnx-flow"));
ok("Client preserves reduced motion", client.includes("prefers-reduced-motion"));
ok("Client avoids DOM guessing", !client.includes("MutationObserver") && !client.includes("querySelector"));

const calls = [];
const broker = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw || "{}");
  calls.push(body);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, data: body.tool === "read_tab_workbench" ? {
    tool: "read_tab_workbench",
    revision: "railr_test",
    unchanged: false,
    workbench: { openTabs: [{ tabId: 7, windowId: 1, title: "Test", url: "https://example.com", pinned: false, active: true }], counts: { unsupported: 0 } }
  } : { tool: "manage_tab_workbench", revision: "railr_next" } }));
});
await new Promise((resolveListen) => broker.listen(0, "127.0.0.1", resolveListen));
const brokerPort = broker.address().port;
const routes = new Map();
const disposers = [];
const mockCtx = {
  webServer: { register: (route) => { routes.set(route.path, route.handler); return () => routes.delete(route.path); } },
  effect: (effect) => { const dispose = effect(); if (typeof dispose === "function") disposers.push(dispose); }
};
apply(mockCtx, { bridgeHost: "127.0.0.1", bridgePort: brokerPort });
const proxy = createServer((request, response) => routes.get(new URL(request.url, "http://local").pathname)?.(request, response));
await new Promise((resolveListen) => proxy.listen(0, "127.0.0.1", resolveListen));
const proxyPort = proxy.address().port;

const snapshotResponse = await fetch(`http://127.0.0.1:${proxyPort}/plugins/tabnexus/chrome-tabs`);
const snapshot = await snapshotResponse.json();
ok("Chrome route proxies a real workbench snapshot", snapshotResponse.status === 200 && snapshot.ok === true && snapshot.data.workbench.openTabs[0].tabId === 7);

const focusResponse = await fetch(`http://127.0.0.1:${proxyPort}/plugins/tabnexus/chrome-action`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ action: "focus", tabId: 7, revision: "railr_test" })
});
const focus = await focusResponse.json();
ok("focus route forwards revision-safe action", focusResponse.status === 200 && focus.ok === true && calls.at(-1)?.tool === "manage_tab_workbench" && calls.at(-1)?.args?.actions?.[0]?.type === "focus_tab");

const invalidResponse = await fetch(`http://127.0.0.1:${proxyPort}/plugins/tabnexus/chrome-action`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ action: "close", tabId: 7, revision: "railr_test" })
});
ok("unsafe actions fail closed", invalidResponse.status === 400);

for (const dispose of disposers) dispose();
await new Promise((resolveClose) => proxy.close(resolveClose));
await new Promise((resolveClose) => broker.close(resolveClose));

ok("README names Chrome-first behavior", readme.includes("当前 Chrome 标签") && readme.includes("一键整理") && readme.includes("不需要 API Key"));
ok("Architecture documents one source of truth", architecture.includes("Chrome 当前窗口") && architecture.includes("不复制 Chrome 标签"));

const failed = checks.filter((check) => !check.pass);
for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.name}`);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
