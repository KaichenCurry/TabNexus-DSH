import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
export const inject = ["slots"];
const STORAGE_KEY = "tabnexus:dsh:workspace:v3";
const VIEW_KEY = "tabnexus:dsh:view";
const DOCK_KEY = "tabnexus:dsh:dock-open";
const COLORS = ["#6483ee", "#44a680", "#9a76e8", "#ee8b5f", "#db6d92", "#4e9eb8"];
function uid(prefix) {
    const token = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${token}`;
}
function makeTask(name = "我的任务") {
    const timestamp = new Date().toISOString();
    return { id: uid("task"), name, goal: "", createdAt: timestamp, updatedAt: timestamp, categoryOrder: [], categories: {}, pages: {} };
}
function initialState() {
    const task = makeTask();
    return { schemaVersion: 3, activeTaskId: task.id, taskOrder: [task.id], tasks: { [task.id]: task } };
}
function loadState() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (parsed?.schemaVersion === 3 && parsed.activeTaskId && Array.isArray(parsed.taskOrder) && parsed.tasks?.[parsed.activeTaskId])
            return parsed;
    }
    catch { /* Invalid local data falls back to a safe empty workspace. */ }
    return initialState();
}
let currentState = loadState();
const stateListeners = new Set();
function getState() { return currentState; }
function subscribeState(listener) { stateListeners.add(listener); return () => stateListeners.delete(listener); }
function saveState(recipe) {
    const draft = JSON.parse(JSON.stringify(currentState));
    recipe(draft);
    const now = new Date().toISOString();
    const active = draft.tasks[draft.activeTaskId];
    if (active)
        active.updatedAt = now;
    currentState = draft;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    for (const listener of stateListeners)
        listener();
}
function useLocalState() { return useSyncExternalStore(subscribeState, getState, getState); }
function normalizeUrl(raw) {
    let value;
    try {
        value = new URL(raw.trim());
    }
    catch {
        throw new Error("请输入完整的 http(s) 网页地址");
    }
    if (value.protocol !== "http:" && value.protocol !== "https:")
        throw new Error("仅支持 http:// 或 https:// 网页");
    value.hash = "";
    if ((value.protocol === "http:" && value.port === "80") || (value.protocol === "https:" && value.port === "443"))
        value.port = "";
    for (const key of [...value.searchParams.keys()]) {
        const normalized = key.toLocaleLowerCase();
        if (normalized.startsWith("utm_") || ["fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid"].includes(normalized))
            value.searchParams.delete(key);
    }
    value.searchParams.sort();
    return value.toString();
}
function domainOf(url) { try {
    return new URL(url).hostname.replace(/^www\./, "");
}
catch {
    return url;
} }
const CSS = String.raw `
.tnx-root{--tnx-bg:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 83%,transparent);--tnx-solid:var(--dsw-alias-bg-layer-1,#fff);--tnx-soft:var(--dsw-alias-bg-layer-2,#f5f6f9);--tnx-text:var(--dsw-alias-label-primary,#182033);--tnx-muted:var(--dsw-alias-label-secondary,#778094);--tnx-line:var(--dsw-alias-border-l1,rgba(28,39,64,.12));--tnx-line2:var(--dsw-alias-border-l2,rgba(28,39,64,.075));--tnx-blue:var(--dsw-alias-brand-primary,#5878e8);--tnx-green:var(--dsw-alias-state-success-primary,#319a71);--tnx-red:var(--dsw-alias-state-error-primary,#d9586c);font:13px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",system-ui,sans-serif;color:var(--tnx-text);pointer-events:auto}
.tnx-root *{box-sizing:border-box}.tnx-root button,.tnx-root input,.tnx-root textarea,.tnx-root select{font:inherit;color:inherit}.tnx-root button{cursor:pointer}.tnx-chip{position:fixed;right:18px;top:86px;z-index:62;display:flex;align-items:center;gap:8px;height:42px;padding:0 13px;border:1px solid var(--tnx-line);border-radius:15px;background:var(--tnx-bg);box-shadow:0 10px 32px rgba(31,44,79,.12),inset 0 1px 0 rgba(255,255,255,.62);backdrop-filter:blur(22px) saturate(145%);transition:transform .18s ease,box-shadow .18s ease}.tnx-chip:hover{transform:translateY(-1px);box-shadow:0 14px 35px rgba(31,44,79,.16)}.tnx-chip:active{transform:scale(.98)}.tnx-chip-dot{width:9px;height:9px;border-radius:50%;background:var(--tnx-blue);box-shadow:0 0 0 4px color-mix(in srgb,var(--tnx-blue) 13%,transparent)}.tnx-chip-label{font-weight:650}.tnx-chip-task{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tnx-muted);font-size:12px}.tnx-chip-arrow{font-size:10px;color:var(--tnx-muted)}
.tnx-scrim{position:fixed;inset:0;z-index:63;background:transparent}.tnx-panel{position:fixed;z-index:64;right:12px;top:64px;bottom:12px;width:min(414px,calc(100vw - 24px));display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--tnx-line);border-radius:22px;background:var(--tnx-bg);box-shadow:0 24px 72px rgba(23,32,56,.22),inset 0 1px 0 rgba(255,255,255,.68);backdrop-filter:blur(30px) saturate(155%);animation:tnx-slide .2s cubic-bezier(.2,.8,.2,1)}.tnx-panel[data-mode=expanded]{z-index:66;inset:18px;width:auto;border-radius:24px;background:color-mix(in srgb,var(--dsw-alias-bg-base,#f7f8fb) 94%,transparent)}
.tnx-head{display:flex;align-items:center;gap:8px;padding:14px 14px 10px;flex:none}.tnx-brand{display:flex;align-items:center;gap:9px;min-width:0}.tnx-logo{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;color:#fff;background:linear-gradient(145deg,#7793fa,#516fe2);box-shadow:0 7px 18px rgba(80,110,229,.28)}.tnx-brand-title{font-weight:680;letter-spacing:-.02em}.tnx-brand-sub{font-size:9px;color:var(--tnx-muted);letter-spacing:.09em}.tnx-spacer{flex:1}.tnx-icon{display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--tnx-muted)}.tnx-icon:hover{color:var(--tnx-text);background:var(--tnx-soft);border-color:var(--tnx-line)}
.tnx-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:0 14px 10px}.tnx-select,.tnx-input,.tnx-textarea{width:100%;border:1px solid var(--tnx-line);outline:0;background:color-mix(in srgb,var(--tnx-solid) 82%,transparent);transition:border-color .16s,box-shadow .16s,background .16s}.tnx-select,.tnx-input{height:36px;padding:0 11px;border-radius:11px}.tnx-textarea{min-height:86px;padding:10px 11px;border-radius:12px;resize:vertical}.tnx-select:focus,.tnx-input:focus,.tnx-textarea:focus{border-color:color-mix(in srgb,var(--tnx-blue) 58%,var(--tnx-line));box-shadow:0 0 0 3px color-mix(in srgb,var(--tnx-blue) 13%,transparent);background:var(--tnx-solid)}.tnx-task-select{font-weight:600}.tnx-button{height:34px;padding:0 11px;border:1px solid var(--tnx-line);border-radius:10px;background:var(--tnx-solid);font-weight:560}.tnx-button:hover{border-color:color-mix(in srgb,var(--tnx-blue) 38%,var(--tnx-line));color:var(--tnx-blue)}.tnx-button:disabled{opacity:.46;cursor:not-allowed}.tnx-button-primary{border-color:transparent;background:linear-gradient(145deg,#7390f3,#5776e5);color:#fff!important;box-shadow:0 6px 15px rgba(83,113,225,.22)}.tnx-button-danger{color:var(--tnx-red)}
.tnx-switch{display:flex;gap:3px;margin:0 14px 11px;padding:3px;border:1px solid var(--tnx-line2);border-radius:11px;background:var(--tnx-soft)}.tnx-switch button{flex:1;height:29px;border:0;border-radius:8px;background:transparent;color:var(--tnx-muted);font-size:11px}.tnx-switch button[data-active=true]{background:var(--tnx-solid);color:var(--tnx-text);font-weight:630;box-shadow:0 2px 8px rgba(25,34,57,.08)}.tnx-body{flex:1;min-height:0;overflow-y:auto;padding:0 14px 30px;scrollbar-width:thin}.tnx-panel[data-mode=expanded] .tnx-body{width:min(980px,100%);margin:0 auto;padding:4px 26px 44px}
.tnx-context{margin-bottom:11px;padding:13px;border:1px solid var(--tnx-line2);border-radius:15px;background:color-mix(in srgb,var(--tnx-solid) 62%,transparent)}.tnx-context-row{display:flex;align-items:flex-start;gap:9px}.tnx-context-copy{flex:1;min-width:0}.tnx-goal{margin:0;font-weight:590;white-space:pre-wrap}.tnx-goal[data-empty=true]{color:var(--tnx-muted);font-weight:450}.tnx-summary{margin-top:4px;color:var(--tnx-muted);font-size:10px}.tnx-progress{font-size:18px;font-weight:700;letter-spacing:-.04em}.tnx-progress-label{text-align:right;color:var(--tnx-muted);font-size:9px}.tnx-track{height:5px;margin-top:9px;overflow:hidden;border-radius:99px;background:color-mix(in srgb,var(--tnx-muted) 12%,transparent)}.tnx-track>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--tnx-blue),#7f98f4);transition:width .22s ease}.tnx-context-actions{display:flex;gap:3px}.tnx-mini{height:26px;padding:0 7px;border:0;border-radius:8px;background:transparent;color:var(--tnx-muted);font-size:10px}.tnx-mini:hover{background:var(--tnx-soft);color:var(--tnx-text)}
.tnx-search{position:relative;margin-bottom:9px}.tnx-search .tnx-input{padding-left:32px;padding-right:55px}.tnx-search-icon{position:absolute;left:10px;top:10px;color:var(--tnx-muted)}.tnx-count{position:absolute;right:10px;top:9px;color:var(--tnx-muted);font-size:10px}.tnx-add{margin-bottom:12px;padding:8px;border:1px solid var(--tnx-line);border-radius:14px;background:color-mix(in srgb,var(--tnx-solid) 68%,transparent)}.tnx-add-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.tnx-add-more{display:grid;grid-template-columns:minmax(0,1fr) 128px;gap:7px;margin-top:7px}.tnx-add .tnx-input,.tnx-add .tnx-select{height:34px}
.tnx-section{margin-bottom:11px;overflow:hidden;border:1px solid var(--tnx-line);border-radius:16px;background:color-mix(in srgb,var(--tnx-solid) 64%,transparent);box-shadow:0 4px 14px rgba(28,39,64,.035)}.tnx-section-head{display:flex;align-items:center;gap:8px;min-height:42px;padding:8px 11px;border-bottom:1px solid var(--tnx-line2)}.tnx-section-dot{width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 4px color-mix(in srgb,currentColor 11%,transparent)}.tnx-section-name{font-weight:650}.tnx-section-count{color:var(--tnx-muted);font-size:10px}.tnx-page{padding:10px 11px;border-top:1px solid var(--tnx-line2);transition:background .15s}.tnx-section-head+.tnx-page{border-top:0}.tnx-page:hover{background:color-mix(in srgb,var(--tnx-blue) 3%,transparent)}.tnx-page-main{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:9px}.tnx-favicon{display:grid;place-items:center;width:30px;height:30px;border:1px solid var(--tnx-line2);border-radius:9px;background:var(--tnx-soft);color:var(--tnx-muted);font-size:11px;font-weight:700;text-transform:uppercase}.tnx-page-title{display:block;overflow:hidden;color:var(--tnx-text);font-weight:590;text-decoration:none;text-overflow:ellipsis;white-space:nowrap}.tnx-page-title:hover{color:var(--tnx-blue)}.tnx-domain{margin-top:2px;overflow:hidden;color:var(--tnx-muted);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.tnx-status{width:78px;height:28px;padding:0 6px;border:1px solid var(--tnx-line);border-radius:9px;background:var(--tnx-solid);font-size:10px}.tnx-page-foot{display:flex;align-items:center;gap:5px;margin-top:7px;padding-left:39px}.tnx-note{flex:1;min-width:0;overflow:hidden;color:var(--tnx-muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.tnx-more{position:relative}.tnx-more>summary{list-style:none}.tnx-more>summary::-webkit-details-marker{display:none}.tnx-menu{position:absolute;z-index:8;right:0;top:29px;width:178px;padding:5px;border:1px solid var(--tnx-line);border-radius:12px;background:var(--tnx-solid);box-shadow:0 14px 34px rgba(23,32,56,.18)}.tnx-menu button{display:flex;align-items:center;width:100%;height:31px;padding:0 8px;border:0;border-radius:8px;background:transparent;text-align:left;font-size:11px}.tnx-menu button:hover{background:var(--tnx-soft)}.tnx-menu .danger{color:var(--tnx-red)}.tnx-menu .tnx-select{height:31px;font-size:10px}
.tnx-empty{padding:28px 16px;text-align:center;color:var(--tnx-muted)}.tnx-empty-icon{display:grid;place-items:center;width:42px;height:42px;margin:0 auto 9px;border:1px solid var(--tnx-line);border-radius:14px;background:var(--tnx-soft);font-size:18px}.tnx-empty strong{display:block;margin-bottom:3px;color:var(--tnx-text)}.tnx-add-category{width:100%;height:40px;border:1px dashed var(--tnx-line);border-radius:13px;background:transparent;color:var(--tnx-muted)}.tnx-add-category:hover{border-color:color-mix(in srgb,var(--tnx-blue) 42%,var(--tnx-line));color:var(--tnx-blue)}
.tnx-flow{padding-top:2px}.tnx-flow-guide{display:grid;grid-template-columns:1fr 20px 1fr 20px 1fr;align-items:center;margin:5px 2px 12px}.tnx-flow-node{padding:12px 9px;border:1px solid var(--tnx-line);border-radius:15px;background:color-mix(in srgb,var(--tnx-solid) 70%,transparent);text-align:center}.tnx-flow-node[data-stage=doing]{border-color:color-mix(in srgb,var(--tnx-blue) 35%,var(--tnx-line));box-shadow:0 8px 20px color-mix(in srgb,var(--tnx-blue) 10%,transparent)}.tnx-flow-value{font-size:21px;font-weight:720;letter-spacing:-.05em}.tnx-flow-label{color:var(--tnx-muted);font-size:10px}.tnx-flow-arrow{text-align:center;color:var(--tnx-muted)}.tnx-flow-list{display:flex;flex-direction:column;gap:8px}.tnx-flow-card{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:9px;padding:11px;border:1px solid var(--tnx-line);border-radius:14px;background:color-mix(in srgb,var(--tnx-solid) 66%,transparent)}.tnx-flow-card-dot{width:8px;height:8px;border-radius:50%}.tnx-flow-card-title{overflow:hidden;font-weight:590;text-overflow:ellipsis;white-space:nowrap}.tnx-flow-card-meta{color:var(--tnx-muted);font-size:9px}.tnx-flow-card .tnx-status{width:82px}
.tnx-dialog-scrim{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:18px;background:rgba(18,24,38,.24);backdrop-filter:blur(4px)}.tnx-dialog{width:min(390px,100%);padding:16px;border:1px solid var(--tnx-line);border-radius:19px;background:var(--tnx-solid);box-shadow:0 24px 72px rgba(23,32,56,.28);animation:tnx-scale .17s ease}.tnx-dialog h3{margin:0 0 5px;font-size:15px}.tnx-dialog p{margin:0 0 13px;color:var(--tnx-muted);font-size:11px}.tnx-dialog-fields{display:flex;flex-direction:column;gap:8px}.tnx-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.tnx-toast{position:fixed;z-index:90;left:50%;bottom:24px;max-width:min(420px,calc(100vw - 30px));transform:translateX(-50%);padding:9px 13px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(23,29,44,.92);box-shadow:0 12px 28px rgba(0,0,0,.22);color:#fff;font-size:11px;backdrop-filter:blur(18px);animation:tnx-toast .2s ease}
@keyframes tnx-slide{from{opacity:0;transform:translateX(18px)}}@keyframes tnx-scale{from{opacity:0;transform:scale(.985)}}@keyframes tnx-toast{from{opacity:0;transform:translate(-50%,8px)}}
@media(max-width:640px){.tnx-chip{top:auto;right:12px;bottom:16px}.tnx-scrim{background:rgba(18,24,38,.14);backdrop-filter:blur(2px)}.tnx-panel,.tnx-panel[data-mode=expanded]{inset:8px;width:auto;border-radius:20px}.tnx-add-more{grid-template-columns:1fr}.tnx-chip-task{display:none}}
@media(prefers-reduced-motion:reduce){.tnx-root *{animation-duration:.001ms!important;transition-duration:.001ms!important}}
`;
function svg(path, size = 16) {
    return _jsx("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: _jsx("path", { d: path }) });
}
const Icons = {
    close: svg("M18 6 6 18M6 6l12 12"),
    expand: svg("M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"),
    search: svg("m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0"),
    more: svg("M5 12h.01M12 12h.01M19 12h.01"),
    external: svg("M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"),
    layers: svg("m12 2 9 5-9 5-9-5 9-5Zm9 10-9 5-9-5m18 5-9 5-9-5", 18)
};
function Dialog({ state, task, onClose, onSubmit }) {
    const page = "page" in state ? state.page : undefined;
    const category = "category" in state ? state.category : undefined;
    const [name, setName] = useState(state.kind === "meta" ? task.name : state.kind === "page" ? page?.title ?? "" : category?.name ?? "");
    const [value, setValue] = useState(state.kind === "meta" ? task.goal : state.kind === "page" ? page?.note ?? "" : "");
    const destructive = state.kind.startsWith("delete-");
    const title = state.kind === "task" ? "新建任务" : state.kind === "category" ? (category ? "编辑分类" : "新建分类") : state.kind === "page" ? "编辑网页" : state.kind === "meta" ? "任务设置" : "确认删除";
    const description = state.kind === "delete-page" ? `「${state.page.title}」会从当前任务中删除。` : state.kind === "delete-category" ? `删除「${state.category.name}」后，其中网页会移到未分类。` : state.kind === "delete-task" ? `「${task.name}」及其中的网页会被永久删除。` : "";
    const submit = () => onSubmit(destructive ? { confirm: "true" } : state.kind === "page" || state.kind === "meta" ? { name, value } : { name });
    return createPortal(_jsx("div", { className: "tnx-root tnx-dialog-scrim", onMouseDown: (event) => { if (event.target === event.currentTarget)
            onClose(); }, children: _jsxs("div", { className: "tnx-dialog", role: "dialog", "aria-modal": "true", "aria-label": title, children: [_jsx("h3", { children: title }), description && _jsx("p", { children: description }), _jsxs("div", { className: "tnx-dialog-fields", children: [!destructive && _jsx("input", { autoFocus: true, className: "tnx-input", value: name, onChange: (event) => setName(event.target.value), placeholder: state.kind === "task" ? "例如：AI 行业调研" : state.kind === "category" ? "例如：竞品资料" : "名称", onKeyDown: (event) => { if (event.key === "Enter" && state.kind !== "page" && state.kind !== "meta")
                                submit(); } }), (state.kind === "page" || state.kind === "meta") && _jsx("textarea", { className: "tnx-textarea", value: value, onChange: (event) => setValue(event.target.value), placeholder: state.kind === "meta" ? "这个任务要完成什么？" : "记录这页的重点或用途…" })] }), _jsxs("div", { className: "tnx-dialog-actions", children: [_jsx("button", { className: "tnx-button", onClick: onClose, children: "\u53D6\u6D88" }), _jsx("button", { className: `tnx-button ${destructive ? "tnx-button-danger" : "tnx-button-primary"}`, disabled: !destructive && !name.trim(), onClick: submit, children: destructive ? "确认删除" : "保存" })] })] }) }), document.body);
}
const STATUS_LABELS = { todo: "待处理", doing: "进行中", done: "已完成" };
function PageRow({ page, task, onEdit, onDelete }) {
    const update = (patch) => saveState((draft) => { Object.assign(draft.tasks[draft.activeTaskId].pages[page.id], patch); });
    return _jsxs("article", { className: "tnx-page", children: [_jsxs("div", { className: "tnx-page-main", children: [_jsx("div", { className: "tnx-favicon", children: domainOf(page.url).slice(0, 1) }), _jsxs("div", { children: [_jsx("a", { className: "tnx-page-title", href: page.url, target: "_blank", rel: "noreferrer", children: page.title }), _jsx("div", { className: "tnx-domain", children: domainOf(page.url) })] }), _jsx("select", { className: "tnx-status", "aria-label": "\u7F51\u9875\u72B6\u6001", value: page.status, onChange: (event) => update({ status: event.target.value }), children: Object.entries(STATUS_LABELS).map(([value, label]) => _jsx("option", { value: value, children: label }, value)) })] }), _jsxs("div", { className: "tnx-page-foot", children: [_jsx("span", { className: "tnx-note", children: page.note || "添加备注，保留这页的用途" }), _jsxs("details", { className: "tnx-more", children: [_jsx("summary", { className: "tnx-icon", "aria-label": "\u66F4\u591A\u64CD\u4F5C", children: Icons.more }), _jsxs("div", { className: "tnx-menu", children: [_jsxs("button", { onClick: () => window.open(page.url, "_blank", "noopener,noreferrer"), children: [Icons.external, "\u00A0\u00A0\u5728\u6D4F\u89C8\u5668\u6253\u5F00"] }), _jsx("button", { onClick: onEdit, children: "\u7F16\u8F91\u6807\u9898\u4E0E\u5907\u6CE8" }), _jsx("label", { children: _jsxs("select", { className: "tnx-select", "aria-label": "\u79FB\u52A8\u5206\u7C7B", value: page.categoryId ?? "", onChange: (event) => update({ categoryId: event.target.value || null }), children: [_jsx("option", { value: "", children: "\u79FB\u5230\u672A\u5206\u7C7B" }), task.categoryOrder.map((id) => task.categories[id]).filter(Boolean).map((item) => _jsxs("option", { value: item.id, children: ["\u79FB\u5230\uFF1A", item.name] }, item.id))] }) }), _jsx("button", { className: "danger", onClick: onDelete, children: "\u5220\u9664\u7F51\u9875" })] })] })] })] });
}
function FlowView({ task }) {
    const pages = Object.values(task.pages);
    const stages = ["todo", "doing", "done"];
    return _jsxs("div", { className: "tnx-flow", children: [_jsx("div", { className: "tnx-flow-guide", children: stages.map((stage, index) => _jsxs("span", { style: { display: "contents" }, children: [_jsxs("div", { className: "tnx-flow-node", "data-stage": stage, children: [_jsx("div", { className: "tnx-flow-value", children: pages.filter((page) => page.status === stage).length }), _jsx("div", { className: "tnx-flow-label", children: STATUS_LABELS[stage] })] }), index < stages.length - 1 && _jsx("div", { className: "tnx-flow-arrow", children: "\u2192" })] }, stage)) }), _jsxs("div", { className: "tnx-flow-list", children: [pages.map((page) => { const category = page.categoryId ? task.categories[page.categoryId] : undefined; return _jsxs("div", { className: "tnx-flow-card", children: [_jsx("span", { className: "tnx-flow-card-dot", style: { background: category?.color ?? "#9aa3b5" } }), _jsxs("div", { children: [_jsx("div", { className: "tnx-flow-card-title", children: page.title }), _jsxs("div", { className: "tnx-flow-card-meta", children: [category?.name ?? "未分类", " \u00B7 ", domainOf(page.url)] })] }), _jsx("select", { className: "tnx-status", "aria-label": "\u6D41\u7A0B\u72B6\u6001", value: page.status, onChange: (event) => saveState((draft) => { draft.tasks[draft.activeTaskId].pages[page.id].status = event.target.value; }), children: Object.entries(STATUS_LABELS).map(([value, label]) => _jsx("option", { value: value, children: label }, value)) })] }, page.id); }), !pages.length && _jsxs("div", { className: "tnx-empty", children: [_jsx("div", { className: "tnx-empty-icon", children: "\u2192" }), _jsx("strong", { children: "\u6D41\u7A0B\u8FD8\u6CA1\u6709\u7F51\u9875" }), _jsx("span", { children: "\u5207\u56DE\u5206\u7C7B\u89C6\u56FE\uFF0C\u5148\u6DFB\u52A0\u4E00\u6761\u8D44\u6599\u3002" })] })] })] });
}
function Workspace({ mode, onClose, onExpand }) {
    const state = useLocalState();
    const task = state.tasks[state.activeTaskId];
    const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) === "flow" ? "flow" : "categories");
    const [search, setSearch] = useState("");
    const [url, setUrl] = useState("");
    const [pageTitle, setPageTitle] = useState("");
    const [targetCategory, setTargetCategory] = useState("");
    const [dialog, setDialog] = useState(null);
    const [toast, setToast] = useState("");
    const searchRef = useRef(null);
    useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);
    useEffect(() => { if (!toast)
        return; const timer = window.setTimeout(() => setToast(""), 2400); return () => window.clearTimeout(timer); }, [toast]);
    useEffect(() => { const key = (event) => { if (event.key === "Escape" && dialog)
        setDialog(null); if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
    } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); }, [dialog]);
    const pages = useMemo(() => { const query = search.trim().toLocaleLowerCase(); return Object.values(task.pages).filter((page) => !query || `${page.title} ${page.url} ${page.note}`.toLocaleLowerCase().includes(query)); }, [search, task.pages]);
    const completed = Object.values(task.pages).filter((page) => page.status === "done").length;
    const percent = Object.keys(task.pages).length ? Math.round(completed / Object.keys(task.pages).length * 100) : 0;
    const addPage = () => {
        try {
            const normalized = normalizeUrl(url);
            if (Object.values(task.pages).some((page) => normalizeUrl(page.url) === normalized)) {
                setToast("这个网页已经在当前任务中");
                return;
            }
            const id = uid("page");
            saveState((draft) => { draft.tasks[draft.activeTaskId].pages[id] = { id, title: pageTitle.trim() || domainOf(normalized), url: normalized, note: "", status: "todo", categoryId: targetCategory || null, createdAt: new Date().toISOString() }; });
            setUrl("");
            setPageTitle("");
            setToast("网页已添加");
        }
        catch (reason) {
            setToast(reason instanceof Error ? reason.message : "无法添加网页");
        }
    };
    const submitDialog = (values) => {
        if (!dialog)
            return;
        if (dialog.kind === "task")
            saveState((draft) => { const next = makeTask(values.name.trim()); draft.tasks[next.id] = next; draft.taskOrder.push(next.id); draft.activeTaskId = next.id; });
        if (dialog.kind === "category")
            saveState((draft) => { const active = draft.tasks[draft.activeTaskId]; if (dialog.category)
                active.categories[dialog.category.id].name = values.name.trim();
            else {
                const id = uid("category");
                active.categories[id] = { id, name: values.name.trim(), color: COLORS[active.categoryOrder.length % COLORS.length] };
                active.categoryOrder.push(id);
            } });
        if (dialog.kind === "page")
            saveState((draft) => { Object.assign(draft.tasks[draft.activeTaskId].pages[dialog.page.id], { title: values.name.trim(), note: values.value }); });
        if (dialog.kind === "meta")
            saveState((draft) => { Object.assign(draft.tasks[draft.activeTaskId], { name: values.name.trim(), goal: values.value }); });
        if (dialog.kind === "delete-page")
            saveState((draft) => { delete draft.tasks[draft.activeTaskId].pages[dialog.page.id]; });
        if (dialog.kind === "delete-category")
            saveState((draft) => { const active = draft.tasks[draft.activeTaskId]; delete active.categories[dialog.category.id]; active.categoryOrder = active.categoryOrder.filter((id) => id !== dialog.category.id); for (const page of Object.values(active.pages))
                if (page.categoryId === dialog.category.id)
                    page.categoryId = null; });
        if (dialog.kind === "delete-task")
            saveState((draft) => { if (draft.taskOrder.length === 1)
                return; delete draft.tasks[draft.activeTaskId]; draft.taskOrder = draft.taskOrder.filter((id) => id !== draft.activeTaskId); draft.activeTaskId = draft.taskOrder[0]; });
        setDialog(null);
        setToast("已保存");
    };
    const renderSection = (category) => {
        const sectionPages = pages.filter((page) => category ? page.categoryId === category.id : !page.categoryId || !task.categories[page.categoryId]);
        if (search && !sectionPages.length)
            return null;
        return _jsxs("section", { className: "tnx-section", children: [_jsxs("header", { className: "tnx-section-head", children: [_jsx("span", { className: "tnx-section-dot", style: { color: category?.color ?? "#9aa3b5", background: category?.color ?? "#9aa3b5" } }), _jsx("span", { className: "tnx-section-name", children: category?.name ?? "未分类" }), _jsx("span", { className: "tnx-section-count", children: sectionPages.length }), _jsx("span", { className: "tnx-spacer" }), category && _jsxs("details", { className: "tnx-more", children: [_jsx("summary", { className: "tnx-icon", "aria-label": "\u5206\u7C7B\u64CD\u4F5C", children: Icons.more }), _jsxs("div", { className: "tnx-menu", children: [_jsx("button", { onClick: () => setDialog({ kind: "category", category }), children: "\u91CD\u547D\u540D\u5206\u7C7B" }), _jsx("button", { className: "danger", onClick: () => setDialog({ kind: "delete-category", category }), children: "\u5220\u9664\u5206\u7C7B" })] })] })] }), sectionPages.map((page) => _jsx(PageRow, { page: page, task: task, onEdit: () => setDialog({ kind: "page", page }), onDelete: () => setDialog({ kind: "delete-page", page }) }, page.id))] }, category?.id ?? "uncategorized");
    };
    return _jsxs("section", { className: "tnx-root tnx-panel", "data-mode": mode, "aria-label": "TabNexus \u5DE5\u4F5C\u533A", children: [_jsxs("header", { className: "tnx-head", children: [_jsxs("div", { className: "tnx-brand", children: [_jsx("div", { className: "tnx-logo", children: Icons.layers }), _jsxs("div", { children: [_jsx("div", { className: "tnx-brand-title", children: "TabNexus" }), _jsx("div", { className: "tnx-brand-sub", children: "LOCAL TASK SPACE" })] })] }), _jsx("div", { className: "tnx-spacer" }), mode === "dock" && _jsx("button", { className: "tnx-icon", title: "\u5C55\u5F00\u5DE5\u4F5C\u533A", onClick: onExpand, children: Icons.expand }), _jsx("button", { className: "tnx-icon", title: "\u5173\u95ED", onClick: onClose, children: Icons.close })] }), _jsxs("div", { className: "tnx-toolbar", children: [_jsx("select", { className: "tnx-select tnx-task-select", "aria-label": "\u5F53\u524D\u4EFB\u52A1", value: state.activeTaskId, onChange: (event) => saveState((draft) => { draft.activeTaskId = event.target.value; }), children: state.taskOrder.map((id) => state.tasks[id]).filter(Boolean).map((item) => _jsxs("option", { value: item.id, children: [item.name, " \u00B7 ", Object.keys(item.pages).length] }, item.id)) }), _jsx("button", { className: "tnx-button", onClick: () => setDialog({ kind: "task" }), children: "\uFF0B \u4EFB\u52A1" })] }), _jsxs("div", { className: "tnx-switch", children: [_jsx("button", { "data-active": view === "categories", onClick: () => setView("categories"), children: "\u5206\u7C7B" }), _jsx("button", { "data-active": view === "flow", onClick: () => setView("flow"), children: "\u6D41\u7A0B" })] }), _jsxs("main", { className: "tnx-body", children: [_jsxs("section", { className: "tnx-context", children: [_jsxs("div", { className: "tnx-context-row", children: [_jsxs("div", { className: "tnx-context-copy", children: [_jsx("p", { className: "tnx-goal", "data-empty": !task.goal, children: task.goal || "给这个任务写一个清晰目标" }), _jsxs("div", { className: "tnx-summary", children: [Object.keys(task.pages).length, " \u4E2A\u7F51\u9875 \u00B7 ", task.categoryOrder.length, " \u4E2A\u5206\u7C7B \u00B7 ", completed, " \u4E2A\u5DF2\u5B8C\u6210"] })] }), _jsxs("div", { className: "tnx-context-actions", children: [_jsx("button", { className: "tnx-mini", onClick: () => setDialog({ kind: "meta" }), children: "\u8BBE\u7F6E" }), state.taskOrder.length > 1 && _jsx("button", { className: "tnx-mini", onClick: () => setDialog({ kind: "delete-task" }), children: "\u5220\u9664" })] }), _jsxs("div", { children: [_jsxs("div", { className: "tnx-progress", children: [percent, "%"] }), _jsx("div", { className: "tnx-progress-label", children: "\u4EFB\u52A1\u8FDB\u5EA6" })] })] }), _jsx("div", { className: "tnx-track", children: _jsx("span", { style: { width: `${percent}%` } }) })] }), view === "categories" ? _jsxs(_Fragment, { children: [_jsxs("div", { className: "tnx-search", children: [_jsx("span", { className: "tnx-search-icon", children: Icons.search }), _jsx("input", { ref: searchRef, className: "tnx-input", value: search, onChange: (event) => setSearch(event.target.value), placeholder: "\u641C\u7D22\u6807\u9898\u3001\u57DF\u540D\u6216\u5907\u6CE8  \u2318K" }), _jsxs("span", { className: "tnx-count", children: [pages.length, " \u9875"] })] }), _jsxs("section", { className: "tnx-add", children: [_jsxs("div", { className: "tnx-add-row", children: [_jsx("input", { className: "tnx-input", value: url, onChange: (event) => setUrl(event.target.value), onKeyDown: (event) => { if (event.key === "Enter")
                                                    addPage(); }, placeholder: "\u7C98\u8D34 http(s) \u7F51\u9875\u5730\u5740" }), _jsx("button", { className: "tnx-button tnx-button-primary", disabled: !url.trim(), onClick: addPage, children: "\u6DFB\u52A0" })] }), _jsxs("div", { className: "tnx-add-more", children: [_jsx("input", { className: "tnx-input", value: pageTitle, onChange: (event) => setPageTitle(event.target.value), placeholder: "\u6807\u9898\uFF08\u53EF\u9009\uFF09" }), _jsxs("select", { className: "tnx-select", value: targetCategory, onChange: (event) => setTargetCategory(event.target.value), children: [_jsx("option", { value: "", children: "\u672A\u5206\u7C7B" }), task.categoryOrder.map((id) => task.categories[id]).filter(Boolean).map((item) => _jsx("option", { value: item.id, children: item.name }, item.id))] })] })] }), task.categoryOrder.map((id) => task.categories[id]).filter(Boolean).map((category) => renderSection(category)), renderSection(null), !pages.length && search && _jsxs("div", { className: "tnx-empty", children: [_jsx("div", { className: "tnx-empty-icon", children: "\u2315" }), _jsx("strong", { children: "\u6CA1\u6709\u5339\u914D\u7684\u7F51\u9875" }), _jsx("span", { children: "\u6362\u4E2A\u5173\u952E\u8BCD\u8BD5\u8BD5\u3002" })] }), " ", !search && _jsx("button", { className: "tnx-add-category", onClick: () => setDialog({ kind: "category" }), children: "\uFF0B \u65B0\u5EFA\u5206\u7C7B" })] }) : _jsx(FlowView, { task: task })] }), dialog && _jsx(Dialog, { state: dialog, task: task, onClose: () => setDialog(null), onSubmit: submitDialog }), " ", toast && createPortal(_jsx("div", { className: "tnx-root tnx-toast", role: "status", children: toast }), document.body)] });
}
function TabNexusOverlay(_props) {
    const state = useLocalState();
    const task = state.tasks[state.activeTaskId];
    const [open, setOpen] = useState(() => localStorage.getItem(DOCK_KEY) === "true");
    const [expanded, setExpanded] = useState(false);
    useEffect(() => { localStorage.setItem(DOCK_KEY, String(open)); }, [open]);
    useEffect(() => { const onStorage = (event) => { if (event.key === STORAGE_KEY) {
        currentState = loadState();
        for (const listener of stateListeners)
            listener();
    } }; window.addEventListener("storage", onStorage); return () => window.removeEventListener("storage", onStorage); }, []);
    useEffect(() => { const key = (event) => { if (event.key === "Escape") {
        if (expanded)
            setExpanded(false);
        else if (open)
            setOpen(false);
    } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); }, [expanded, open]);
    const expand = () => { setOpen(false); setExpanded(true); };
    return _jsxs("div", { className: "tnx-root", children: [_jsx("style", { children: CSS }), _jsxs("button", { className: "tnx-chip", onClick: () => setOpen((value) => !value), "aria-expanded": open, children: [_jsx("span", { className: "tnx-chip-dot" }), _jsx("span", { className: "tnx-chip-label", children: "TabNexus" }), _jsx("span", { className: "tnx-chip-task", children: task.name }), _jsx("span", { className: "tnx-chip-arrow", children: "\u25BE" })] }), open && _jsxs(_Fragment, { children: [createPortal(_jsx("div", { className: "tnx-root tnx-scrim", onClick: () => setOpen(false) }), document.body), createPortal(_jsx(Workspace, { mode: "dock", onClose: () => setOpen(false), onExpand: expand }), document.body)] }), expanded && createPortal(_jsxs(_Fragment, { children: [_jsx("div", { className: "tnx-root tnx-scrim" }), _jsx(Workspace, { mode: "expanded", onClose: () => setExpanded(false) })] }), document.body)] });
}
export function apply(ctx) {
    ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "tabnexus:entry", order: 40, label: "TabNexus" }, TabNexusOverlay));
}
