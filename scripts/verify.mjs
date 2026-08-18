#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = [];
const ok = (name, pass) => checks.push({ name, pass: Boolean(pass) });
const missing = async (path) => { try { await access(resolve(root, path)); return false; } catch { return true; } };

const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const host = await readFile(resolve(root, "lib/index.js"), "utf8");
const client = await readFile(resolve(root, "lib/client.js"), "utf8");
const readme = await readFile(resolve(root, "README.md"), "utf8");
const architecture = await readFile(resolve(root, "docs/ARCHITECTURE.md"), "utf8");

ok("release version is 0.3.0", pkg.version === "0.3.0");
ok("host and client exports exist", pkg.exports["."]?.default === "./lib/index.js" && pkg.exports["./client"]?.default === "./lib/client.js");
ok("package has no Agent tools dependency", !pkg.peerDependencies?.["@deepseek-ai/dsh-tools"] && !pkg.devDependencies?.["@deepseek-ai/dsh-tools"]);
ok("package has no MCP dependency", !JSON.stringify(pkg).includes("dsh-mcp-client"));
ok("package has no optional sidebar dependency", !JSON.stringify(pkg).includes("better-sidebar"));
ok("Skill and preset are not shipped", !pkg.files.includes("skills") && !pkg.files.includes("preset"));

ok("Host is intentionally client-only", host.includes("client-only") && /inject\s*=\s*\[\]/.test(host));
ok("Host registers no tools", !host.includes("defineTool") && !host.includes("ctx.tools") && !host.includes("mcp__tabnexus__"));
ok("Host registers no web routes", !host.includes("webServer") && !host.includes("registerPublicRoutes") && !host.includes("/plugins/tabnexus"));
ok("stale core output is absent", await missing("lib/core.js") && await missing("lib/types/core.d.ts"));
ok("stale route output is absent", await missing("lib/routes.js") && await missing("lib/types/routes.d.ts"));

ok("Client uses official shell.overlay slot", client.includes("shell.overlay") && client.includes("tabnexus:entry"));
ok("Client stores state locally", client.includes("tabnexus:dsh:workspace:v3") && client.includes("localStorage"));
ok("Client makes no network request", !client.includes("fetch(") && !client.includes("EventSource") && !client.includes("WebSocket"));
ok("Client has no Agent bridge", !client.includes("mcp__tabnexus__") && !client.includes("sessionBindings"));
ok("Client has no DOM position guessing", !client.includes("MutationObserver") && !client.includes("querySelector"));
ok("Client supports tasks", client.includes("新建任务") && client.includes("任务设置") && client.includes("当前任务"));
ok("Client supports categories", client.includes("新建分类") && client.includes("移动分类") && client.includes("删除分类"));
ok("Client supports three simple statuses", ["待处理", "进行中", "已完成"].every((label) => client.includes(label)));
ok("Client supports category and flow views", client.includes("分类") && client.includes("流程") && client.includes("tnx-flow-guide"));
ok("Client supports page notes and deletion", client.includes("编辑标题与备注") && client.includes("删除网页"));
ok("Client validates HTTP(S) pages", client.includes('value.protocol !== "http:"') && client.includes('value.protocol !== "https:"'));
ok("Client strips tracking params", client.includes('startsWith("utm_")') && client.includes("fbclid") && client.includes("searchParams.sort"));
ok("Client avoids normalized duplicates", client.includes("这个网页已经在当前任务中"));
ok("Client includes glass and responsive styling", client.includes("backdrop-filter") && client.includes("@media(max-width:640px)"));
ok("Client respects reduced motion", client.includes("prefers-reduced-motion"));
ok("Client has Dock and expanded workspace", client.includes('mode: "dock"') && client.includes('mode: "expanded"'));

ok("README explicitly rejects duplicate Agent layer", readme.includes("不注册 Agent 工具") && readme.includes("不提供 MCP") && readme.includes("不开放 Host API"));
ok("Architecture documents local-only state", architecture.includes("localStorage") && architecture.includes("没有网络请求、SSE 或 Host API"));
ok("README keeps simple product chain", readme.includes("任务管理 → 分类整理 → 网页状态 → 简单流程"));

const failed = checks.filter((check) => !check.pass);
for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.name}`);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
