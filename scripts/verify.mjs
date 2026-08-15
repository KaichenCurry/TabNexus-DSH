#!/usr/bin/env node
// dsh-plugin-tabnexus（独立版）离线验证：包结构 + 本地存储/工具全链路（临时目录自清理）
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
const ok = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });

const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
ok("exports host face", pkg.exports["."]?.default === "./lib/index.js");
ok("exports client face", typeof pkg.exports["./client"]?.default === "string" && pkg.exports["./client"].default.endsWith("client.js"));
ok("dsh.bundle.patch declared", typeof pkg.dsh?.bundle?.patch === "string");
ok("dsh.client platform=web", pkg.dsh?.client?.platform === "web");
ok("no mcp-client peer (standalone)", !pkg.peerDependencies?.["@deepseek-ai/dsh-mcp-client"]);

const patch = await readFile(resolve(root, "cordis.patch.yml"), "utf8");
ok("patch inserts tabnexus row", patch.includes("id: tabnexus") && patch.includes("name: dsh-plugin-tabnexus"));

const host = await import(resolve(root, "lib/index.js"));
ok("host exports name/apply/Config", host.name === "tabnexus" && typeof host.apply === "function" && typeof host.Config === "function");

// ── 存储 + 工具全链路 ──
const tmp = await mkdtemp(join(tmpdir(), "tabnexus-standalone-"));
try {
  const store = new host.Store(join(tmp, "state.json"));
  const { dispatch } = host.buildToolHandlers(store);

  const initial = await dispatch("mcp__tabnexus__read_workspace", { detail: "full" });
  ok("first boot seeds default task", initial.revision?.startsWith("wsr_") && initial.workspace?.name === "我的任务");

  const added = await dispatch("mcp__tabnexus__add_card", {
    title: "DeepSeek 官网", url: "https://www.deepseek.com/", note: "产品定位",
    expectedRevision: initial.revision, operationId: "verify:add"
  });
  ok("add_card persists", added.cardId && added.revision !== initial.revision);

  const edited = await dispatch("mcp__tabnexus__edit_workspace", {
    expectedRevision: added.revision, operationId: "verify:edit",
    actions: [
      { type: "create_group", groupId: "g_market", name: "市场", color: "#7A6EDC" },
      { type: "move_cards", cardIds: [added.cardId], targetGroupId: "g_market" },
      { type: "update_card", cardId: added.cardId, status: "adopted" }
    ]
  });
  ok("edit_workspace batch", edited.ok !== false && edited.createdGroupIds?.includes("g_market"));

  const read = await dispatch("mcp__tabnexus__read_workspace", { detail: "summary" });
  const moved = read.summary?.cards?.find((card) => card.id === added.cardId);
  ok("card moved + adopted", moved?.groupId === "g_market" && moved?.status === "adopted");

  const since = await dispatch("mcp__tabnexus__read_workspace", { detail: "summary", sinceRevision: read.revision });
  ok("conditional read unchanged", since.unchanged === true && since.summary === undefined);

  const exported = await dispatch("mcp__tabnexus__export_workspace", { format: "markdown" });
  ok("markdown export", exported.content?.includes("# 我的任务") && exported.content?.includes("DeepSeek 官网"));

  // 版本冲突保护
  let conflict = false;
  try {
    await dispatch("mcp__tabnexus__edit_workspace", { expectedRevision: "wsr_stale", operationId: "verify:stale", actions: [{ type: "rename_workspace", name: "x" }] });
  } catch (error) { conflict = /Workspace changed/.test(String(error)); }
  ok("stale revision rejected", conflict);

  // 破坏性需确认
  let guard = false;
  try {
    await dispatch("mcp__tabnexus__delete_workspace_items", { expectedRevision: read.revision, operationId: "verify:del", cardIds: [added.cardId] });
  } catch (error) { guard = /confirmation/i.test(String(error)); }
  ok("destructive guard", guard);

  const del = await dispatch("mcp__tabnexus__delete_workspace_items", {
    expectedRevision: read.revision, operationId: "verify:del2", cardIds: [added.cardId],
    confirm: true, confirmationText: "用户确认删除"
  });
  ok("delete with confirmation", del.deletedCardIds?.includes(added.cardId));

  const addCards = await dispatch("mcp__tabnexus__add_cards", {
    cards: [{ title: "A", url: "https://a.example.com" }, { title: "B", url: "https://b.example.com" }],
    expectedRevision: del.revision, operationId: "verify:batch"
  });
  ok("add_cards batch", addCards.addedCardIds?.length === 2);

  const browser = await dispatch("mcp__tabnexus__sync_browser_tabs", { action: "save_tabs", tabIds: [1], expectedRevision: addCards.revision, operationId: "verify:br" }).then(() => false).catch((error) => /可选增强|Chrome/i.test(String(error)));
  ok("browser tools degrade with guidance", browser);
} finally {
  await rm(tmp, { recursive: true, force: true });
}

const client = await readFile(resolve(root, "lib/client.js"), "utf8");
ok("client ships workspace panel", client.includes("tn-dsh-ws") && client.includes("快速添加"));

const failed = checks.filter((check) => !check.pass);
for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
