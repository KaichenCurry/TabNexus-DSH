/*
 * TabNexus for DSH（独立版）host 面。
 *
 * 零 Chrome 依赖：自带本地任务存储（$DSH_HOME/storages/tabnexus/state.json），
 * 直接注册 12 个 mcp__tabnexus__* 工具 + 面板数据路由；浏览器采集类工具（5 个）
 * 返回可选增强提示。装完即用。
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
export const name = "tabnexus";
export const inject = ["tools"];
export const Config = z.object({
    stateDir: z.string().default("")
});
const GROUP_COLORS = ["#E8833A", "#7A6EDC", "#3379D6", "#3F9D6A", "#D6455E", "#20A39E"];
const DEFAULT_PREFERENCES = { locale: "zh", closeAfterCollect: false, workspaceView: "board", groupingPolicy: "suggestion" };
// ── 稳定序列化（键序无关，同扩展契约）──
function stableStringify(value) {
    if (Array.isArray(value))
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    if (value && typeof value === "object") {
        const entries = Object.entries(value)
            .filter(([, entryValue]) => entryValue !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
}
function hashOf(payload) {
    let hash = 0x811c9dc5;
    for (const character of payload) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 0x01000193);
    }
    return `${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function taskRevision(task) {
    return `wsr_${hashOf(stableStringify({ id: task.id, name: task.name, groupOrder: task.groupOrder, groups: task.groups, cards: task.cards, edges: task.edges }))}`;
}
function stateRevision(state) {
    const names = Object.fromEntries(Object.values(state.tasks).map((task) => [task.id, { name: task.name, updatedAt: task.updatedAt }]));
    return `ssr_${hashOf(stableStringify({ activeTaskId: state.activeTaskId, taskOrder: state.taskOrder, tasks: names }))}`;
}
function prefsRevision(prefs) {
    return `pr_${hashOf(stableStringify(prefs))}`;
}
// ── 存储（进程内互斥 + 原子写）──
export class Store {
    file;
    state = null;
    lock = Promise.resolve();
    constructor(file) {
        this.file = file;
    }
    async load() {
        if (this.state)
            return this.state;
        try {
            const raw = await readFile(this.file, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed.schemaVersion === 1 && parsed.tasks && parsed.activeTaskId) {
                this.state = { ...parsed, preferences: { ...DEFAULT_PREFERENCES, ...(parsed.preferences ?? {}) }, activities: parsed.activities ?? [], receipts: parsed.receipts ?? {} };
                return this.state;
            }
        }
        catch { /* 首启或无文件 → 种子 */ }
        const now = new Date().toISOString();
        const taskId = `task_${randomUUID()}`;
        this.state = {
            schemaVersion: 1,
            activeTaskId: taskId,
            taskOrder: [taskId],
            tasks: { [taskId]: { id: taskId, name: "我的任务", createdAt: now, updatedAt: now, groupOrder: [], groups: {}, cards: {}, edges: [], v2: { goal: "", nextStep: "", conclusion: "" } } },
            preferences: { ...DEFAULT_PREFERENCES },
            activities: [],
            receipts: {}
        };
        await this.persist();
        return this.state;
    }
    async persist() {
        if (!this.state)
            return;
        const tmp = `${this.file}.tmp`;
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(tmp, JSON.stringify(this.state, null, 2), "utf8");
        await rename(tmp, this.file);
    }
    withLock(fn) {
        const previous = this.lock;
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        this.lock = previous.then(() => gate);
        const run = previous.then(async () => {
            try {
                return await fn();
            }
            finally {
                release();
            }
        });
        return run;
    }
    async snapshot() { return this.withLock(async () => this.load()); }
    async mutate(fn) {
        return this.withLock(async () => {
            const state = await this.load();
            const result = await fn(state);
            await this.persist();
            return result;
        });
    }
}
// ── 工具实现（与扩展契约同名的独立执行器）──
function assertRevision(expected, actual) {
    if (typeof expected !== "string" || !expected || expected !== actual) {
        throw new Error("Workspace changed since the Agent read it; read the latest context and retry");
    }
}
function assertOperationId(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,120}$/.test(value))
        throw new Error("operationId must use 1-120 safe characters");
    return value;
}
function requiredText(value, field, max) {
    if (typeof value !== "string" || !value.trim())
        throw new Error(`${field} is required`);
    return value.trim().slice(0, max);
}
function assertConfirmation(confirm, text) {
    if (confirm !== true || typeof text !== "string" || text.length < 2) {
        throw new Error("Destructive actions require explicit confirmation (confirm: true + confirmationText)");
    }
}
const BROWSER_TOOL_HINT = "浏览器采集类能力是可选增强：独立版 TabNexus 无需 Chrome 扩展，请改用 add_card/add_cards 添加页面（面板收件口也可粘贴 URL 快速添加）。";
export function buildToolHandlers(store) {
    const active = async () => {
        const state = await store.snapshot();
        const task = state.tasks[state.activeTaskId];
        if (!task)
            throw new Error("Workspace not found");
        return task;
    };
    const withReceipt = async (taskId, operationId, run) => {
        if (!operationId)
            return run();
        const key = `${taskId}:${operationId}`;
        const state = await store.snapshot();
        const existing = state.receipts[key];
        if (existing)
            return existing.result;
        const result = await run();
        await store.mutate((state) => { state.receipts[key] = { completedAt: new Date().toISOString(), result }; });
        return result;
    };
    const logActivity = async (tool, summary, run) => {
        const id = `act_${randomUUID()}`;
        await store.mutate((state) => { state.activities.unshift({ id, tool, status: "running", createdAt: new Date().toISOString(), summary }); });
        try {
            const result = await run();
            await store.mutate((state) => { const entry = state.activities.find((item) => item.id === id); if (entry) {
                entry.status = "success";
                entry.completedAt = new Date().toISOString();
            } });
            return result;
        }
        catch (error) {
            await store.mutate((state) => { const entry = state.activities.find((item) => item.id === id); if (entry) {
                entry.status = "error";
                entry.error = error instanceof Error ? error.message : String(error);
                entry.completedAt = new Date().toISOString();
            } });
            throw error;
        }
    };
    const handlers = {};
    handlers["mcp__tabnexus__read_workspace"] = async (input) => {
        const task = await active();
        const revision = taskRevision(task);
        const detail = input.detail === "full" ? "full" : "summary";
        const cardIds = Array.isArray(input.cardIds) ? input.cardIds.slice(0, 50) : [];
        const since = typeof input.sinceRevision === "string" ? input.sinceRevision : undefined;
        const unchanged = Boolean(since && since === revision);
        const base = { tool: "mcp__tabnexus__read_workspace", revision, unchanged, detail };
        if (unchanged)
            return base;
        if (detail === "full") {
            const cards = cardIds.length > 0 ? Object.fromEntries(cardIds.map((id) => [id, task.cards[id]]).filter(([, card]) => card)) : task.cards;
            return { ...base, workspace: { ...task, cards } };
        }
        const ordered = [...task.groupOrder.flatMap((groupId) => task.groups[groupId]?.cardIds ?? []), ...Object.keys(task.cards).filter((id) => !task.groupOrder.flatMap((groupId) => task.groups[groupId]?.cardIds ?? []).includes(id))];
        return {
            ...base,
            summary: {
                id: task.id, name: task.name, createdAt: task.createdAt, updatedAt: task.updatedAt, revision,
                groups: task.groupOrder.flatMap((groupId) => task.groups[groupId] ? [{ ...task.groups[groupId] }] : []),
                cards: ordered.flatMap((cardId) => task.cards[cardId] ? [{ id: task.cards[cardId].id, type: task.cards[cardId].type, title: task.cards[cardId].title, url: task.cards[cardId].url, status: task.cards[cardId].status, groupId: task.cards[cardId].groupId, source: task.cards[cardId].source, savedAt: task.cards[cardId].savedAt, excludedReason: task.cards[cardId].excludedReason, noteLength: task.cards[cardId].note.length }] : []),
                edges: task.edges.map((edge) => ({ ...edge })),
                v2: task.v2 ? { ...task.v2 } : undefined
            },
            stateRevision: undefined
        };
    };
    handlers["mcp__tabnexus__search_cards"] = async (input) => {
        const state = await store.snapshot();
        const query = typeof input.query === "string" ? input.query.trim().toLowerCase() : "";
        const statuses = Array.isArray(input.statuses) ? input.statuses : [];
        const limit = typeof input.limit === "number" ? Math.min(200, Math.max(1, Math.floor(input.limit))) : 50;
        const matches = [];
        for (const task of Object.values(state.tasks)) {
            for (const card of Object.values(task.cards)) {
                if (query && !(`${card.title} ${card.note} ${card.url ?? ""}`.toLowerCase().includes(query)))
                    continue;
                if (statuses.length > 0 && !statuses.includes(card.status))
                    continue;
                matches.push({ workspaceId: task.id, workspaceName: task.name, groupId: card.groupId, card: { ...card, note: typeof input.includeNotes === "boolean" && input.includeNotes ? card.note : undefined, noteLength: card.note.length } });
                if (matches.length >= limit)
                    break;
            }
            if (matches.length >= limit)
                break;
        }
        return { tool: "mcp__tabnexus__search_cards", revision: taskRevision((await active())), total: matches.length, matches };
    };
    handlers["mcp__tabnexus__add_card"] = async (input) => {
        const task = await active();
        const operationId = typeof input.operationId === "string" && input.operationId ? assertOperationId(input.operationId) : undefined;
        assertRevision(input.expectedRevision, taskRevision(task));
        return withReceipt(task.id, operationId, () => store.mutate(async (state) => {
            const current = state.tasks[state.activeTaskId];
            const title = requiredText(input.title, "title", 240);
            const url = typeof input.url === "string" && input.url.trim() ? input.url.trim().slice(0, 2000) : undefined;
            const duplicate = url ? Object.values(current.cards).find((card) => card.url === url) : undefined;
            if (duplicate)
                return { tool: "mcp__tabnexus__add_card", revision: taskRevision(current), duplicateCardId: duplicate.id, operationId };
            const id = `card_${randomUUID()}`;
            current.cards[id] = { id, type: "web", title, url, note: typeof input.note === "string" ? input.note.slice(0, 20_000) : "", status: "unread", groupId: typeof input.groupId === "string" && current.groups[input.groupId] ? input.groupId : null, source: "agent", savedAt: new Date().toISOString() };
            current.updatedAt = new Date().toISOString();
            return { tool: "mcp__tabnexus__add_card", revision: taskRevision(current), cardId: id, operationId };
        }));
    };
    handlers["mcp__tabnexus__add_cards"] = async (input) => {
        const task = await active();
        const operationId = assertOperationId(input.operationId);
        assertRevision(input.expectedRevision, taskRevision(task));
        const cards = Array.isArray(input.cards) ? input.cards : [];
        if (cards.length < 1 || cards.length > 100)
            throw new Error("cards must contain 1-100 items");
        return withReceipt(task.id, operationId, () => store.mutate(async (state) => {
            const current = state.tasks[state.activeTaskId];
            const added = [];
            const duplicates = [];
            for (const item of cards) {
                const title = requiredText(item.title, "title", 240);
                const url = typeof item.url === "string" && item.url.trim() ? item.url.trim().slice(0, 2000) : undefined;
                const duplicate = url ? Object.values(current.cards).find((card) => card.url === url) : undefined;
                if (duplicate) {
                    duplicates.push(duplicate.id);
                    continue;
                }
                const id = `card_${randomUUID()}`;
                current.cards[id] = {
                    id, type: typeof item.type === "string" ? item.type : "web", title, url,
                    note: typeof item.note === "string" ? item.note.slice(0, 20_000) : "",
                    status: ["unread", "read", "adopted", "excluded"].includes(String(item.status)) ? item.status : "unread",
                    groupId: typeof item.groupId === "string" && current.groups[item.groupId] ? item.groupId : null,
                    source: "agent", savedAt: new Date().toISOString()
                };
                added.push(id);
            }
            current.updatedAt = new Date().toISOString();
            return { tool: "mcp__tabnexus__add_cards", revision: taskRevision(current), addedCardIds: added, duplicateCardIds: duplicates, operationId };
        }));
    };
    handlers["mcp__tabnexus__write_report"] = async (input) => {
        const task = await active();
        return store.mutate(async (state) => {
            const current = state.tasks[state.activeTaskId];
            const id = `card_${randomUUID()}`;
            current.cards[id] = { id, type: "report", title: requiredText(input.title, "title", 240), url: typeof input.url === "string" ? input.url : undefined, note: requiredText(input.content, "content", 50_000), status: "unread", groupId: typeof input.groupId === "string" && current.groups[input.groupId] ? input.groupId : null, source: "agent", savedAt: new Date().toISOString() };
            current.updatedAt = new Date().toISOString();
            return { tool: "mcp__tabnexus__write_report", revision: taskRevision(current), cardId: id };
        });
    };
    handlers["mcp__tabnexus__propose_structure"] = async (input) => {
        const task = await active();
        const edges = Array.isArray(input.edges) ? input.edges.filter((edge) => task.cards[edge.fromCardId] && task.cards[edge.toCardId] && edge.fromCardId !== edge.toCardId) : [];
        const proposal = { source: "agent", edges, summary: typeof input.summary === "string" ? input.summary : undefined };
        return { tool: "mcp__tabnexus__propose_structure", revision: taskRevision(task), proposal };
    };
    handlers["mcp__tabnexus__edit_workspace"] = async (input) => {
        const task = await active();
        const operationId = assertOperationId(input.operationId);
        assertRevision(input.expectedRevision, taskRevision(task));
        const actions = Array.isArray(input.actions) ? input.actions : [];
        if (actions.length < 1 || actions.length > 100)
            throw new Error("actions must contain 1-100 items");
        return withReceipt(task.id, operationId, () => store.mutate(async (state) => {
            const current = state.tasks[state.activeTaskId];
            const changes = [];
            const createdGroupIds = [];
            for (const action of actions) {
                switch (action.type) {
                    case "rename_workspace":
                        current.name = requiredText(action.name, "name", 120);
                        changes.push("rename_workspace");
                        break;
                    case "create_group": {
                        const id = typeof action.groupId === "string" && action.groupId ? action.groupId : `group_${randomUUID()}`;
                        current.groups[id] = { id, name: requiredText(action.name, "name", 120), color: typeof action.color === "string" && /^#[0-9a-fA-F]{6}$/.test(action.color) ? action.color : GROUP_COLORS[Object.keys(current.groups).length % GROUP_COLORS.length], cardIds: [] };
                        current.groupOrder.push(id);
                        createdGroupIds.push(id);
                        changes.push(`create_group:${id}`);
                        break;
                    }
                    case "rename_group": {
                        const group = current.groups[String(action.groupId)];
                        if (!group)
                            throw new Error("Unknown group id");
                        group.name = requiredText(action.name, "name", 120);
                        if (typeof action.color === "string" && /^#[0-9a-fA-F]{6}$/.test(action.color))
                            group.color = action.color;
                        changes.push("rename_group");
                        break;
                    }
                    case "move_cards": {
                        const cardIds = Array.isArray(action.cardIds) ? action.cardIds : [];
                        const target = action.targetGroupId === null ? null : String(action.targetGroupId);
                        if (target !== null && !current.groups[target])
                            throw new Error("Unknown group id");
                        for (const cardId of cardIds) {
                            const card = current.cards[cardId];
                            if (!card)
                                throw new Error(`Unknown card id: ${cardId}`);
                            if (card.groupId)
                                current.groups[card.groupId]?.cardIds.splice(current.groups[card.groupId].cardIds.indexOf(cardId), 1);
                            card.groupId = target;
                            if (target)
                                current.groups[target].cardIds.push(cardId);
                        }
                        changes.push(`move_cards:${cardIds.length}`);
                        break;
                    }
                    case "update_card": {
                        const card = current.cards[String(action.cardId)];
                        if (!card)
                            throw new Error("Unknown card id");
                        if (typeof action.title === "string")
                            card.title = requiredText(action.title, "title", 240);
                        if (action.url !== undefined)
                            card.url = action.url === null || action.url === "" ? undefined : String(action.url).slice(0, 2000);
                        if (typeof action.note === "string")
                            card.note = action.note.slice(0, 20_000);
                        if (typeof action.status === "string" && ["unread", "read", "adopted", "excluded"].includes(action.status))
                            card.status = action.status;
                        if (action.excludedReason !== undefined) {
                            if (action.excludedReason === null || action.excludedReason === "") {
                                card.excludedReason = undefined;
                                if (card.status === "excluded")
                                    card.status = "unread";
                            }
                            else {
                                card.excludedReason = String(action.excludedReason).slice(0, 2000);
                                card.status = "excluded";
                            }
                        }
                        changes.push("update_card");
                        break;
                    }
                    case "reorder_groups": {
                        const groupIds = Array.isArray(action.groupIds) ? action.groupIds : [];
                        const known = new Set(current.groupOrder);
                        current.groupOrder = [...groupIds.filter((id) => known.has(id)), ...current.groupOrder.filter((id) => !groupIds.includes(id))];
                        changes.push("reorder_groups");
                        break;
                    }
                    case "upsert_edges": {
                        const edges = Array.isArray(action.edges) ? action.edges : [];
                        for (const edge of edges) {
                            if (!current.cards[edge.fromCardId] || !current.cards[edge.toCardId])
                                throw new Error("Unknown card id in edge");
                            const existing = current.edges.findIndex((item) => item.fromCardId === edge.fromCardId && item.toCardId === edge.toCardId);
                            if (existing >= 0)
                                current.edges[existing] = edge;
                            else
                                current.edges.push(edge);
                        }
                        changes.push(`upsert_edges:${edges.length}`);
                        break;
                    }
                    case "remove_edges": {
                        const edges = Array.isArray(action.edges) ? action.edges : [];
                        current.edges = current.edges.filter((edge) => !edges.some((target) => target.fromCardId === edge.fromCardId && target.toCardId === edge.toCardId));
                        changes.push(`remove_edges:${edges.length}`);
                        break;
                    }
                    default: throw new Error(`Unsupported action: ${String(action.type)}`);
                }
            }
            current.updatedAt = new Date().toISOString();
            return { tool: "mcp__tabnexus__edit_workspace", revision: taskRevision(current), changed: changes.length > 0, changes, createdGroupIds, operationId };
        }));
    };
    handlers["mcp__tabnexus__manage_workspaces"] = async (input) => {
        const operationId = assertOperationId(input.operationId);
        return store.mutate(async (state) => {
            const expectedState = typeof input.expectedStateRevision === "string" ? input.expectedStateRevision : undefined;
            if (expectedState && expectedState !== stateRevision(state))
                throw new Error("Workspace list changed since it was read; read it again and retry");
            const actions = Array.isArray(input.actions) ? input.actions : [];
            const created = [];
            for (const action of actions) {
                switch (action.type) {
                    case "create_workspace": {
                        const id = typeof action.workspaceId === "string" && action.workspaceId ? action.workspaceId : `task_${randomUUID()}`;
                        const now = new Date().toISOString();
                        state.tasks[id] = { id, name: requiredText(action.name, "name", 120), createdAt: now, updatedAt: now, groupOrder: [], groups: {}, cards: {}, edges: [], v2: { goal: "", nextStep: "", conclusion: "" } };
                        state.taskOrder.push(id);
                        created.push(id);
                        if (action.makeActive !== false)
                            state.activeTaskId = id;
                        break;
                    }
                    case "set_active_workspace": {
                        const id = String(action.workspaceId);
                        if (!state.tasks[id])
                            throw new Error("Workspace not found");
                        state.activeTaskId = id;
                        break;
                    }
                    case "rename_workspace": {
                        const task = state.tasks[String(action.workspaceId)];
                        if (!task)
                            throw new Error("Workspace not found");
                        task.name = requiredText(action.name, "name", 120);
                        task.updatedAt = new Date().toISOString();
                        break;
                    }
                    case "reorder_workspaces": {
                        const ids = Array.isArray(action.workspaceIds) ? action.workspaceIds : [];
                        const known = new Set(state.taskOrder);
                        state.taskOrder = [...ids.filter((id) => known.has(id)), ...state.taskOrder.filter((id) => !ids.includes(id))];
                        break;
                    }
                    case "duplicate_workspace": {
                        const source = state.tasks[String(action.workspaceId)];
                        if (!source)
                            throw new Error("Workspace not found");
                        const id = `task_${randomUUID()}`;
                        const copy = JSON.parse(JSON.stringify(source));
                        copy.id = id;
                        copy.name = action.name ? requiredText(action.name, "name", 120) : `${source.name} 副本`;
                        copy.createdAt = new Date().toISOString();
                        copy.updatedAt = copy.createdAt;
                        state.tasks[id] = copy;
                        state.taskOrder.push(id);
                        created.push(id);
                        if (action.makeActive !== false)
                            state.activeTaskId = id;
                        break;
                    }
                    default: throw new Error(`Unsupported action: ${String(action.type)}`);
                }
            }
            return {
                tool: "mcp__tabnexus__manage_workspaces",
                revision: taskRevision(state.tasks[state.activeTaskId]),
                stateRevision: stateRevision(state),
                activeTaskId: state.activeTaskId,
                createdWorkspaceIds: created,
                workspaceIndex: state.taskOrder.map((id) => { const task = state.tasks[id]; return { id, name: task.name, updatedAt: task.updatedAt, revision: taskRevision(task), groupCount: task.groupOrder.length, cardCount: Object.keys(task.cards).length, edgeCount: task.edges.length }; }),
                operationId
            };
        });
    };
    handlers["mcp__tabnexus__delete_workspace_items"] = async (input) => {
        const task = await active();
        assertConfirmation(input.confirm, input.confirmationText);
        const operationId = assertOperationId(input.operationId);
        assertRevision(input.expectedRevision, taskRevision(task));
        return withReceipt(task.id, operationId, () => store.mutate(async (state) => {
            const current = state.tasks[state.activeTaskId];
            const deletedCardIds = [];
            const deletedGroupIds = [];
            let deletedWorkspaceId;
            const cardIds = Array.isArray(input.cardIds) ? input.cardIds : [];
            const groupIds = Array.isArray(input.groupIds) ? input.groupIds : [];
            for (const groupId of groupIds) {
                const group = current.groups[groupId];
                if (!group)
                    continue;
                for (const cardId of group.cardIds) {
                    delete current.cards[cardId];
                    deletedCardIds.push(cardId);
                }
                delete current.groups[groupId];
                current.groupOrder = current.groupOrder.filter((id) => id !== groupId);
                deletedGroupIds.push(groupId);
            }
            for (const cardId of cardIds) {
                if (!current.cards[cardId])
                    continue;
                const groupId = current.cards[cardId].groupId;
                if (groupId)
                    current.groups[groupId]?.cardIds.splice(current.groups[groupId].cardIds.indexOf(cardId), 1);
                delete current.cards[cardId];
                deletedCardIds.push(cardId);
            }
            current.updatedAt = new Date().toISOString();
            if (input.deleteWorkspace === true) {
                const stateRevisionBefore = stateRevision(state);
                delete state.tasks[current.id];
                state.taskOrder = state.taskOrder.filter((id) => id !== current.id);
                deletedWorkspaceId = current.id;
                if (state.activeTaskId === current.id) {
                    state.activeTaskId = state.taskOrder[0] ?? "";
                    if (!state.activeTaskId) {
                        const id = `task_${randomUUID()}`;
                        const now = new Date().toISOString();
                        state.tasks[id] = { id, name: "我的任务", createdAt: now, updatedAt: now, groupOrder: [], groups: {}, cards: {}, edges: [], v2: { goal: "", nextStep: "", conclusion: "" } };
                        state.taskOrder = [id];
                        state.activeTaskId = id;
                    }
                }
                return {
                    tool: "mcp__tabnexus__delete_workspace_items",
                    revision: state.tasks[state.activeTaskId] ? taskRevision(state.tasks[state.activeTaskId]) : taskRevision(current),
                    stateRevision: stateRevision(state),
                    activeTaskId: state.activeTaskId,
                    deletedWorkspaceId, deletedGroupIds, deletedCardIds,
                    operationId
                };
            }
            return { tool: "mcp__tabnexus__delete_workspace_items", revision: taskRevision(current), deletedGroupIds, deletedCardIds, operationId };
        }));
    };
    handlers["mcp__tabnexus__export_workspace"] = async (input) => {
        const task = await active();
        const format = input.format === "json" ? "json" : "markdown";
        const safeName = task.name.replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 60) || "task";
        let content;
        if (format === "json")
            content = JSON.stringify(task, null, 2);
        else {
            const lines = [`# ${task.name}`, "", task.v2?.goal ? `目标: ${task.v2.goal}` : "", task.v2?.nextStep ? `下一步: ${task.v2.nextStep}` : "", task.v2?.conclusion ? `当前结论: ${task.v2.conclusion}` : "", ""];
            for (const groupId of task.groupOrder) {
                const group = task.groups[groupId];
                if (!group)
                    continue;
                lines.push(`## ${group.name}`);
                for (const cardId of group.cardIds) {
                    const card = task.cards[cardId];
                    if (!card)
                        continue;
                    lines.push(`- [${card.status === "adopted" ? "⭐" : card.status === "read" ? "◐" : card.status === "excluded" ? "✕" : "○"}] ${card.title}${card.url ? ` (${card.url})` : ""}${card.note ? ` — ${card.note}` : ""}${card.excludedReason ? ` [排除: ${card.excludedReason}]` : ""}`);
                }
                lines.push("");
            }
            content = lines.filter((line) => line !== "" || lines[lines.indexOf(line) + 1] !== "").join("\n").trim();
        }
        return { tool: "mcp__tabnexus__export_workspace", revision: taskRevision(task), format, filename: `${safeName}.${format === "json" ? "json" : "md"}`, content };
    };
    handlers["mcp__tabnexus__manage_preferences"] = async (input) => {
        if (input.action === "read") {
            const state = await store.snapshot();
            return { tool: "mcp__tabnexus__manage_preferences", revision: prefsRevision(state.preferences), changed: false, preferences: { ...state.preferences } };
        }
        const operationId = assertOperationId(String(input.operationId ?? ""));
        return store.mutate(async (state) => {
            const patch = (input.preferences ?? {});
            if (patch.locale !== undefined)
                state.preferences.locale = patch.locale === "en" ? "en" : "zh";
            if (patch.closeAfterCollect !== undefined)
                state.preferences.closeAfterCollect = Boolean(patch.closeAfterCollect);
            if (patch.workspaceView !== undefined)
                state.preferences.workspaceView = patch.workspaceView === "flow" ? "flow" : "board";
            if (patch.groupingPolicy !== undefined && ["automatic", "suggestion", "domain"].includes(patch.groupingPolicy))
                state.preferences.groupingPolicy = patch.groupingPolicy;
            return { tool: "mcp__tabnexus__manage_preferences", revision: prefsRevision(state.preferences), changed: true, preferences: { ...state.preferences }, operationId };
        });
    };
    handlers["mcp__tabnexus__manage_agent_activity"] = async (input) => {
        if (input.action === "read") {
            const state = await store.snapshot();
            return { tool: "mcp__tabnexus__manage_agent_activity", action: "read", revision: String(state.activities.length), activities: state.activities.slice(0, 50), cleared: 0 };
        }
        assertConfirmation(input.confirm, input.confirmationText);
        return store.mutate(async (state) => {
            const cleared = state.activities.length;
            state.activities = [];
            return { tool: "mcp__tabnexus__manage_agent_activity", action: "clear", revision: "0", activities: [], cleared };
        });
    };
    const browserTools = ["mcp__tabnexus__read_tab_workbench", "mcp__tabnexus__manage_tab_workbench", "mcp__tabnexus__sync_browser_tabs", "mcp__tabnexus__close_browser_tabs", "mcp__tabnexus__dismiss_recent_tabs"];
    for (const tool of browserTools) {
        handlers[tool] = async () => { throw new Error(BROWSER_TOOL_HINT); };
    }
    const dispatch = async (tool, input) => {
        const handler = handlers[tool];
        if (!handler)
            throw new Error(`Unknown tool: ${tool}`);
        return logActivity(tool, `${tool} 操作`, () => handler(input));
    };
    return { dispatch, handlers, active, store };
}
function readRequestBody(request) {
    return new Promise((resolve) => {
        const incoming = request;
        let raw = "";
        incoming.on("data", (chunk) => { raw += String(chunk); });
        incoming.on("end", () => { try {
            resolve(raw ? JSON.parse(raw) : {});
        }
        catch {
            resolve({});
        } });
    });
}
export function apply(ctx, config) {
    const stateFile = config.stateDir?.trim() || join(process.env.DSH_HOME || join(homedir(), ".dsh"), "storages", "tabnexus", "state.json");
    const store = new Store(stateFile);
    const { dispatch } = buildToolHandlers(store);
    // 12 个本地工具（与 Chrome 扩展契约同名）
    const toolSpecs = [
        { name: "mcp__tabnexus__read_workspace", description: "读取当前 TabNexus 任务档案（独立本地存储）。detail=summary 返回轻量摘要，detail=full 返回完整任务；sinceRevision 命中时不返回内容。返回 revision 供后续写入校验。", parameters: { detail: { type: "string", description: "summary | full" }, cardIds: { type: "array", items: { type: "string" }, description: "只取这些页面" }, sinceRevision: { type: "string", description: "与当前 revision 相同则跳过内容" } } },
        { name: "mcp__tabnexus__search_cards", description: "跨任务搜索页面（标题/备注/URL 模糊匹配，可按状态过滤）。", parameters: { query: { type: "string", description: "关键词" }, statuses: { type: "array", items: { type: "string" }, description: "unread/read/adopted/excluded" }, includeNotes: { type: "boolean", description: "返回完整备注" }, limit: { type: "integer", description: "最多条数（≤200）" } } },
        { name: "mcp__tabnexus__add_card", description: "添加一个页面到当前任务（独立版推荐路径：Agent 收集 URL 无需 Chrome 扩展）。", parameters: { title: { type: "string", required: true, description: "页面标题（≤240）" }, url: { type: "string", description: "页面 URL" }, note: { type: "string", description: "备注（≤20000）" }, groupId: { type: "string", description: "章节 id" }, expectedRevision: { type: "string", description: "read_workspace 返回的 revision" }, operationId: { type: "string", description: "幂等键" } } },
        { name: "mcp__tabnexus__add_cards", description: "批量添加页面（1-100 条）。必须携带 expectedRevision 与 operationId。", parameters: { cards: { type: "array", required: true, items: { type: "json" }, description: "[{title,url?,note?,type?,groupId?,status?}]" }, expectedRevision: { type: "string", required: true, description: "当前 revision" }, operationId: { type: "string", required: true, description: "幂等键" } } },
        { name: "mcp__tabnexus__write_report", description: "把报告/结论作为 report 页面写回当前任务（结论区内容）。", parameters: { title: { type: "string", required: true, description: "报告标题" }, content: { type: "string", required: true, description: "报告正文（≤50000）" }, url: { type: "string", description: "来源 URL" }, groupId: { type: "string", description: "章节 id" } } },
        { name: "mcp__tabnexus__propose_structure", description: "建议页面之间的关系（先建议，用户确认后由 edit_workspace upsert_edges 应用）。", parameters: { edges: { type: "array", required: true, items: { type: "json" }, description: "[{fromCardId,toCardId,label?}]" }, summary: { type: "string", description: "建议说明" } } },
        { name: "mcp__tabnexus__edit_workspace", description: "原子批量编辑当前任务：建/改章节、移动页面、更新状态/备注/标题/排除原因、重排章节、关系边。必须 expectedRevision + operationId。结构改动请先向用户展示预览并取得确认。", parameters: { expectedRevision: { type: "string", required: true, description: "当前 revision" }, operationId: { type: "string", required: true, description: "幂等键" }, actions: { type: "array", required: true, items: { type: "json" }, description: "[{type:'create_group'|'rename_group'|'move_cards'|'update_card'|'reorder_groups'|'upsert_edges'|'remove_edges'|'rename_workspace',...}]" } } },
        { name: "mcp__tabnexus__manage_workspaces", description: "管理任务列表：创建/切换/改名/重排/复制任务。", parameters: { expectedStateRevision: { type: "string", description: "状态 revision" }, operationId: { type: "string", required: true, description: "幂等键" }, actions: { type: "array", required: true, items: { type: "json" }, description: "[{type:'create_workspace'|'set_active_workspace'|'rename_workspace'|'reorder_workspaces'|'duplicate_workspace',...}]" } } },
        { name: "mcp__tabnexus__delete_workspace_items", description: "删除页面/章节/任务。破坏性：必须 confirm:true + confirmationText（用户明确同意的原文）。", parameters: { expectedRevision: { type: "string", required: true, description: "当前 revision" }, operationId: { type: "string", required: true, description: "幂等键" }, cardIds: { type: "array", items: { type: "string" }, description: "要删除的页面" }, groupIds: { type: "array", items: { type: "string" }, description: "要删除的章节" }, deleteWorkspace: { type: "boolean", description: "删除整个任务" }, confirm: { type: "boolean", required: true, description: "必须为 true" }, confirmationText: { type: "string", required: true, description: "用户明确确认的原文" } } },
        { name: "mcp__tabnexus__export_workspace", description: "导出当前任务为 Markdown / JSON（含目标、页面、状态、排除原因）。", parameters: { format: { type: "string", description: "markdown | json" } } },
        { name: "mcp__tabnexus__manage_preferences", description: "读取或更新安全偏好（语言、关闭策略等）。", parameters: { action: { type: "string", required: true, description: "read | update" }, operationId: { type: "string", description: "幂等键" }, preferences: { type: "json", description: "{locale?,closeAfterCollect?,workspaceView?,groupingPolicy?}" } } },
        { name: "mcp__tabnexus__manage_agent_activity", description: "读取或清空 Agent 操作记录（清空需确认）。", parameters: { action: { type: "string", required: true, description: "read | clear" }, confirm: { type: "boolean", description: "clear 时必须为 true" }, confirmationText: { type: "string", description: "用户明确确认的原文" } } }
    ];
    for (const spec of toolSpecs) {
        ctx.tools.register(defineTool({
            name: spec.name,
            description: spec.description,
            parameters: spec.parameters,
            output: { schema: { type: "object", additionalProperties: true }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
            async execute(args) {
                return (await dispatch(spec.name, args));
            }
        }));
    }
    // 浏览器采集类工具：注册但返回可选增强提示（独立版零依赖）
    const browserSpecs = [
        { name: "mcp__tabnexus__read_tab_workbench", description: BROWSER_TOOL_HINT },
        { name: "mcp__tabnexus__manage_tab_workbench", description: BROWSER_TOOL_HINT },
        { name: "mcp__tabnexus__sync_browser_tabs", description: BROWSER_TOOL_HINT },
        { name: "mcp__tabnexus__close_browser_tabs", description: BROWSER_TOOL_HINT },
        { name: "mcp__tabnexus__dismiss_recent_tabs", description: BROWSER_TOOL_HINT }
    ];
    for (const spec of browserSpecs) {
        ctx.tools.register(defineTool({
            name: spec.name,
            description: spec.description,
            parameters: {},
            output: { schema: { type: "object", additionalProperties: true }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
            async execute() { throw new Error(BROWSER_TOOL_HINT); }
        }));
    }
    // 面板数据路由
    const host = (() => { try {
        return (ctx.get("webServer") ?? ctx.get("httpServer"));
    }
    catch {
        return undefined;
    } })();
    if (host) {
        ctx.effect(() => host.register({
            kind: "exact",
            path: "/plugins/tabnexus/status",
            handler: async (_request, response) => {
                const state = await store.snapshot();
                const task = state.tasks[state.activeTaskId];
                response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
                response.end(JSON.stringify({ plugin: "tabnexus", version: "0.2.0", standalone: true, ok: true, cardCount: Object.keys(task?.cards ?? {}).length, toolCount: 12, slogan: "一切皆插件 —— 那浏览器里那 50 个 Tab，也该是。" }));
            }
        }), "tabnexus: status route");
        ctx.effect(() => host.register({
            kind: "exact",
            path: "/plugins/tabnexus/workspace",
            handler: async (_request, response) => {
                try {
                    const read = await dispatch("mcp__tabnexus__read_workspace", { detail: "full" });
                    const state = await store.snapshot();
                    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
                    response.end(JSON.stringify({
                        workspace: { ok: true, data: read },
                        workbench: { ok: true, data: { workbench: { openTabs: [], standalone: true, note: "独立版：无浏览器采集；用收件口「快速添加」粘贴 URL，或让 Agent add_card。" } } },
                        state: { activeTaskId: state.activeTaskId, taskOrder: state.taskOrder, taskNames: Object.fromEntries(state.taskOrder.map((id) => [id, state.tasks[id]?.name])) }
                    }));
                }
                catch (error) {
                    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
                    response.end(JSON.stringify({ workspace: { ok: false, error: error instanceof Error ? error.message : "读取失败" }, workbench: { ok: true, data: { workbench: { openTabs: [], standalone: true } } } }));
                }
            }
        }), "tabnexus: workspace route");
        ctx.effect(() => host.register({
            kind: "exact",
            path: "/plugins/tabnexus/action",
            handler: async (request, response) => {
                const body = (await readRequestBody(request));
                try {
                    if (!body.tool || !body.input)
                        throw new Error("tool and input required");
                    const tool = body.tool.startsWith("mcp__tabnexus__") ? body.tool : `mcp__tabnexus__${body.tool}`;
                    const result = await dispatch(tool, body.input);
                    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
                    response.end(JSON.stringify({ ok: true, data: result }));
                }
                catch (error) {
                    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
                    response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "操作失败" }));
                }
            }
        }), "tabnexus: action route");
    }
}
