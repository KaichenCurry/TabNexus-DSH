import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
export const inject = ["slots", "layout"];
const STORAGE_KEY = "tabnexus:dsh:tab-manager:v4";
const COLORS = ["#5b7cdd", "#4b9b78", "#9470d4", "#d98255", "#c96382", "#438ea8", "#a8893f"];
function uid(prefix) {
    const token = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${token}`;
}
function emptyOrganizer() {
    return { schemaVersion: 4, categoryOrder: [], categories: {}, assignments: {} };
}
function loadOrganizer() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (parsed?.schemaVersion === 4 && Array.isArray(parsed.categoryOrder) && parsed.categories && parsed.assignments)
            return parsed;
    }
    catch { /* A corrupt local preference should not block live Chrome tabs. */ }
    return emptyOrganizer();
}
let organizerState = loadOrganizer();
const organizerListeners = new Set();
function useOrganizer() {
    return useSyncExternalStore((listener) => { organizerListeners.add(listener); return () => organizerListeners.delete(listener); }, () => organizerState, () => organizerState);
}
function updateOrganizer(recipe) {
    const next = JSON.parse(JSON.stringify(organizerState));
    recipe(next);
    organizerState = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    for (const listener of organizerListeners)
        listener();
}
// Panel visibility is intentionally runtime-only. Persisting it caused a stale
// "open" flag to hide the entry after a DSH client/plugin reload even though
// the native details slot had already been disposed.
let panelOpen = false;
const panelListeners = new Set();
let nativePanelController = null;
function setPanelOpen(next) {
    if (panelOpen === next)
        return;
    panelOpen = next;
    nativePanelController?.(next);
    for (const listener of panelListeners)
        listener();
}
function usePanelOpen() {
    return useSyncExternalStore((listener) => { panelListeners.add(listener); return () => panelListeners.delete(listener); }, () => panelOpen, () => panelOpen);
}
let inputBridge = null;
function normalizedUrl(raw) {
    try {
        const url = new URL(raw);
        for (const key of [...url.searchParams.keys()]) {
            const lower = key.toLocaleLowerCase();
            if (lower.startsWith("utm_") || ["fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid"].includes(lower))
                url.searchParams.delete(key);
        }
        url.searchParams.sort();
        return url.toString();
    }
    catch {
        return raw;
    }
}
function explicitCategoryScore(tab, category) {
    const direct = scoreCategory(tab, category);
    const value = `${tab.title} ${tab.url}`.toLocaleLowerCase();
    const name = category.toLocaleLowerCase();
    let semantic = 0;
    if (/投递|申请|进度|记录|跟进/.test(name) && /投递|申请|my.?apply|application|进度|记录/.test(value))
        semantic += 20;
    if (/岗位|职位|招聘|求职|公司/.test(name) && /招聘|求职|职位|岗位|校招|jd\b|career|campus|talent|zhaopin|recruit|position|job/.test(value))
        semantic += 16;
    if (/文档|资料|表格|知识/.test(name) && /飞书|语雀|notion|docs?|wiki|文档|表格|sheet/.test(value))
        semantic += 18;
    if (/本地|工具|开发/.test(name) && /localhost|127\.0\.0\.1|github|gitlab|开发|代码|api/.test(value))
        semantic += 18;
    if (/ai|智能|搜索/.test(name) && /deepseek|chatgpt|claude|gemini|搜索|search|\bai\b|harness/.test(value))
        semantic += 14;
    return direct + semantic;
}
function domainOf(raw) {
    try {
        return new URL(raw).hostname.replace(/^www\./, "");
    }
    catch {
        return raw;
    }
}
function shortDomain(raw) {
    const host = domainOf(raw);
    const known = [
        [/feishu|larksuite|larkoffice/, "飞书"], [/deepseek/, "DeepSeek"], [/meituan/, "美团"],
        [/kuaishou|kwai/, "快手"], [/lenovo/, "联想"], [/google/, "Google"], [/github/, "GitHub"],
        [/yuque/, "语雀"], [/notion/, "Notion"], [/localhost|127\.0\.0\.1/, "本地工具"]
    ];
    return known.find(([pattern]) => pattern.test(host))?.[1] ?? host.split(".").slice(-2, -1)[0] ?? host;
}
function smartCategory(tab, instruction) {
    const value = `${tab.title} ${tab.url}`.toLocaleLowerCase();
    if (/按(网站|域名)|domain|站点/.test(instruction.toLocaleLowerCase()))
        return shortDomain(tab.url);
    if (/投递|申请|my.?apply|application|进度|记录表/.test(value))
        return "投递与跟进";
    if (/招聘|求职|职位|岗位|校招|jd\b|career|campus|talent|zhaopin|recruit|position|job/.test(value))
        return "求职岗位";
    if (/飞书|语雀|notion|docs?|wiki|文档|表格|sheet/.test(value))
        return "文档资料";
    if (/github|gitlab|开发|代码|api|documentation/.test(value))
        return "开发资料";
    if (/deepseek|chatgpt|claude|gemini|搜索|search|\bai\b|harness/.test(value))
        return "AI 与搜索";
    if (/localhost|127\.0\.0\.1/.test(value))
        return "本地工具";
    return "其他标签";
}
function explicitCategories(instruction) {
    const match = instruction.match(/(?:分类为|分成|类别(?:是|为)?|按照)\s*[:：]?\s*(.+)$/);
    if (!match)
        return [];
    const values = match[1].split(/[、,，/|；;]/).map((item) => item.trim().replace(/[。.!！]+$/, "")).filter(Boolean);
    return values.length >= 2 && values.length <= 10 && values.every((item) => item.length <= 18) ? [...new Set(values)] : [];
}
function scoreCategory(tab, category) {
    const haystack = `${tab.title} ${domainOf(tab.url)}`.toLocaleLowerCase();
    const tokens = category.toLocaleLowerCase().split(/[\s与和、/&_-]+/).filter((token) => token.length > 1);
    return tokens.reduce((score, token) => score + (haystack.includes(token) ? token.length : 0), 0);
}
function createProposal(tabs, instruction) {
    const explicit = explicitCategories(instruction);
    const assignments = {};
    for (const tab of tabs) {
        if (explicit.length) {
            const ranked = explicit.map((category) => ({ category, score: explicitCategoryScore(tab, category) })).sort((a, b) => b.score - a.score);
            assignments[tab.tabId] = ranked[0]?.category ?? explicit[0];
        }
        else {
            assignments[tab.tabId] = smartCategory(tab, instruction);
        }
    }
    return { categories: explicit.length ? explicit : [...new Set(Object.values(assignments))], assignments, instruction };
}
async function fetchChromeTabs() {
    const response = await fetch("/plugins/tabnexus/chrome-tabs", { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !payload.data?.workbench || typeof payload.data.revision !== "string") {
        throw new Error(payload?.error || "无法读取 Chrome 标签");
    }
    return {
        revision: payload.data.revision,
        tabs: Array.isArray(payload.data.workbench.openTabs) ? payload.data.workbench.openTabs : [],
        unsupported: payload.data.workbench.counts?.unsupported ?? 0
    };
}
async function focusChromeTab(tabId, revision) {
    const response = await fetch("/plugins/tabnexus/chrome-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "focus", tabId, revision })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok)
        throw new Error(payload?.error || "无法切换 Chrome 标签");
}
function svg(paths, size = 18) {
    return _jsx("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: paths });
}
const Icons = {
    tabs: svg(_jsxs(_Fragment, { children: [_jsx("rect", { x: "4", y: "4", width: "13", height: "16", rx: "2" }), _jsx("path", { d: "M8 4V2.8A1.8 1.8 0 0 1 9.8 1h8.4A1.8 1.8 0 0 1 20 2.8v13.4A1.8 1.8 0 0 1 18.2 18H17" })] })),
    close: svg(_jsx("path", { d: "m7 7 10 10M17 7 7 17" })),
    refresh: svg(_jsxs(_Fragment, { children: [_jsx("path", { d: "M20 11a8.1 8.1 0 1 0 .1 3" }), _jsx("path", { d: "M20 4v7h-7" })] })),
    search: svg(_jsxs(_Fragment, { children: [_jsx("circle", { cx: "11", cy: "11", r: "7" }), _jsx("path", { d: "m20 20-4-4" })] }), 16),
    sparkle: svg(_jsxs(_Fragment, { children: [_jsx("path", { d: "m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" }), _jsx("path", { d: "m18 14 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z" })] })),
    plus: svg(_jsx("path", { d: "M12 5v14M5 12h14" })),
    external: svg(_jsxs(_Fragment, { children: [_jsx("path", { d: "M14 5h5v5M19 5l-8 8" }), _jsx("path", { d: "M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" })] }), 15),
    more: svg(_jsxs(_Fragment, { children: [_jsx("circle", { cx: "6", cy: "12", r: "1", fill: "currentColor", stroke: "none" }), _jsx("circle", { cx: "12", cy: "12", r: "1", fill: "currentColor", stroke: "none" }), _jsx("circle", { cx: "18", cy: "12", r: "1", fill: "currentColor", stroke: "none" })] }), 16),
    check: svg(_jsx("path", { d: "m5 12 4 4L19 6" }), 16)
};
const CSS = String.raw `
.tnx-root{--tnx-bg:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base,#fff));--tnx-base:var(--dsw-alias-bg-base,#fff);--tnx-hover:var(--dsw-alias-interactive-bg-hover,rgba(31,41,55,.055));--tnx-active:var(--dsw-alias-interactive-bg-selected,rgba(77,111,214,.10));--tnx-text:var(--dsw-alias-label-primary,#171b24);--tnx-muted:var(--dsw-alias-label-tertiary,#7b818d);--tnx-secondary:var(--dsw-alias-label-secondary,#5f6672);--tnx-line:var(--dsw-alias-border-l2,rgba(24,30,42,.10));--tnx-blue:var(--dsw-alias-state-business-primary,#5c78d7);font:13px/1.45 Inter,-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",system-ui,sans-serif;color:var(--tnx-text);pointer-events:auto}
.tnx-root *{box-sizing:border-box}.tnx-root button,.tnx-root input,.tnx-root textarea,.tnx-root select{font:inherit;color:inherit}.tnx-root button{cursor:pointer}.tnx-entry{position:fixed;z-index:70;top:10px;right:12px;width:30px;height:30px;display:grid;place-items:center;padding:0;border:0;border-radius:7px;background:transparent;color:var(--tnx-secondary);transition:background .16s ease,color .16s ease,transform .12s ease,opacity .12s ease}.tnx-entry:hover{background:var(--tnx-hover);color:var(--tnx-text)}.tnx-entry[data-open=true]{opacity:0;pointer-events:none}.tnx-entry:active{transform:scale(.94)}.tnx-entry:focus-visible,.tnx-icon:focus-visible,.tnx-button:focus-visible,.tnx-tab-row:focus-visible{outline:2px solid var(--tnx-blue);outline-offset:2px}
.tnx-panel{width:100%;height:100%;display:flex;flex-direction:column;background:var(--tnx-bg);animation:tnx-in .18s cubic-bezier(.2,.8,.2,1);overflow:hidden}.tnx-panel-head{height:52px;flex:none;display:flex;align-items:center;gap:9px;padding:0 8px 0 14px;border-bottom:1px solid var(--tnx-line)}.tnx-title-wrap{min-width:0;flex:1}.tnx-title{font-size:14px;font-weight:600;letter-spacing:-.01em}.tnx-subtitle{font-size:11px;color:var(--tnx-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tnx-icon{width:30px;height:30px;display:grid;place-items:center;flex:none;padding:0;border:0;border-radius:7px;background:transparent;color:var(--tnx-secondary)}.tnx-icon:hover{background:var(--tnx-hover);color:var(--tnx-text)}
.tnx-command{flex:none;padding:8px 8px 9px;border-bottom:1px solid var(--tnx-line)}.tnx-command-row{height:30px;display:flex;align-items:center;justify-content:space-between;gap:6px}.tnx-button{height:30px;border:1px solid var(--tnx-line);border-radius:7px;background:var(--tnx-base);padding:0 10px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-weight:500;white-space:nowrap}.tnx-button:hover{background:var(--tnx-hover)}.tnx-button:disabled{opacity:.45;cursor:default}.tnx-button-primary{border-color:transparent;background:var(--tnx-blue);color:#fff}.tnx-button-primary:hover{background:color-mix(in srgb,var(--tnx-blue) 88%,#000)}.tnx-button-quiet{border-color:transparent;background:transparent;color:var(--tnx-secondary);padding:0 8px}.tnx-button-quiet:hover{background:var(--tnx-hover);color:var(--tnx-text)}.tnx-view{display:flex;align-items:center;gap:2px}.tnx-view button{height:28px;padding:0 9px;border:0;border-radius:6px;background:transparent;color:var(--tnx-muted);font-size:12px}.tnx-view button:hover{background:var(--tnx-hover);color:var(--tnx-secondary)}.tnx-view button[data-active=true]{background:var(--tnx-hover);color:var(--tnx-text);font-weight:500}
.tnx-search{height:34px;flex:none;display:flex;align-items:center;gap:7px;margin-top:6px;padding:0 9px;border:0;border-radius:7px;background:var(--tnx-hover);color:var(--tnx-muted)}.tnx-search:focus-within{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tnx-blue) 45%,var(--tnx-line))}.tnx-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;font-size:12px}.tnx-search-count{font-size:10px;font-variant-numeric:tabular-nums}.tnx-body{flex:1;min-height:0;overflow-y:auto;padding:4px 6px 14px;scrollbar-width:thin}.tnx-loading,.tnx-empty{min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--tnx-muted);padding:24px 18px}.tnx-empty strong{margin:8px 0 3px;color:var(--tnx-text);font-size:13px}.tnx-empty span{font-size:11px;line-height:1.55}.tnx-spinner{width:18px;height:18px;border:2px solid var(--tnx-line);border-top-color:var(--tnx-blue);border-radius:50%;animation:tnx-spin .8s linear infinite}
.tnx-tab-row{width:100%;min-height:50px;display:grid;grid-template-columns:22px minmax(0,1fr) 26px;gap:8px;padding:7px 6px 7px 8px;border:0;border-radius:7px;background:transparent;text-align:left;position:relative}.tnx-tab-row:hover{background:var(--tnx-hover)}.tnx-tab-row[data-active=true]{background:var(--tnx-active)}.tnx-favicon{width:18px;height:18px;margin-top:1px;border-radius:4px;object-fit:contain;background:var(--tnx-base)}.tnx-favicon-fallback{width:18px;height:18px;margin-top:1px;border-radius:4px;display:grid;place-items:center;background:var(--tnx-hover);color:var(--tnx-muted);font-size:9px;font-weight:600}.tnx-tab-copy{min-width:0}.tnx-tab-title{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:500;line-height:17px}.tnx-tab-meta{display:flex;align-items:center;gap:5px;min-width:0;color:var(--tnx-muted);font-size:10px;line-height:16px}.tnx-tab-domain{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tnx-pin{flex:none}.tnx-category-label{max-width:130px;height:18px;display:inline-flex;align-items:center;padding:0;border:0;background:transparent;color:var(--tnx-muted);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tnx-category-label:hover{color:var(--tnx-text);text-decoration:underline;text-underline-offset:2px}.tnx-assignment{height:26px;width:100%;margin-top:3px;border:1px solid var(--tnx-line);border-radius:6px;background:var(--tnx-base);padding:0 6px;color:var(--tnx-secondary);font-size:10px}.tnx-row-open{width:26px;height:26px;display:grid;place-items:center;align-self:center;padding:0;border:0;border-radius:6px;background:transparent;color:var(--tnx-muted);opacity:0}.tnx-tab-row:hover .tnx-row-open,.tnx-row-open:focus-visible,.tnx-tab-row[data-active=true] .tnx-row-open{opacity:1}.tnx-row-open:hover{background:color-mix(in srgb,var(--tnx-hover) 80%,var(--tnx-base));color:var(--tnx-text)}.tnx-live-dot{position:absolute;top:10px;left:3px;width:3px;height:28px;border-radius:2px;background:var(--tnx-blue)}
.tnx-section{margin:4px 0 10px}.tnx-section-head{height:30px;display:flex;align-items:center;gap:7px;padding:0 8px;color:var(--tnx-secondary);font-size:11px;font-weight:600}.tnx-section-dot{width:7px;height:7px;border-radius:50%}.tnx-section-count{margin-left:auto;color:var(--tnx-muted);font-variant-numeric:tabular-nums;font-weight:400}.tnx-add-category{width:100%;height:34px;border:1px dashed var(--tnx-line);border-radius:8px;background:transparent;color:var(--tnx-muted)}.tnx-add-category:hover{background:var(--tnx-hover);color:var(--tnx-text)}.tnx-new-category{display:flex;gap:6px;padding:5px}.tnx-input,.tnx-textarea{width:100%;border:1px solid var(--tnx-line);border-radius:8px;background:var(--tnx-base);outline:0}.tnx-input{height:32px;padding:0 9px}.tnx-textarea{min-height:68px;resize:vertical;padding:8px 9px;line-height:1.5}.tnx-input:focus,.tnx-textarea:focus,.tnx-assignment:focus{border-color:color-mix(in srgb,var(--tnx-blue) 60%,var(--tnx-line));box-shadow:0 0 0 2px color-mix(in srgb,var(--tnx-blue) 10%,transparent)}
.tnx-organizer{flex:none;padding:10px;border-bottom:1px solid var(--tnx-line);background:var(--tnx-bg)}.tnx-organizer-title{display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:3px}.tnx-organizer-help{margin:0 0 8px;color:var(--tnx-muted);font-size:10px}.tnx-organizer-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:7px}.tnx-preview-head{padding:10px 10px 6px}.tnx-preview-head strong{display:block}.tnx-preview-head span{color:var(--tnx-muted);font-size:10px}.tnx-preview-categories{display:flex;flex-wrap:wrap;gap:4px;padding:0 10px 8px}.tnx-preview-chip{padding:2px 7px;border-radius:5px;background:var(--tnx-hover);color:var(--tnx-secondary);font-size:10px}.tnx-preview-actions{display:flex;justify-content:flex-end;gap:6px;padding:8px 10px;border-top:1px solid var(--tnx-line);background:var(--tnx-bg)}
.tnx-toast{position:fixed;z-index:90;right:294px;top:16px;max-width:320px;padding:8px 11px;border-radius:8px;background:rgba(24,29,39,.92);box-shadow:0 8px 24px rgba(0,0,0,.16);color:white;font-size:11px;animation:tnx-toast .16s ease}.tnx-header-bridge{display:none}
@keyframes tnx-in{from{transform:translateX(18px);opacity:.55}}@keyframes tnx-spin{to{transform:rotate(360deg)}}@keyframes tnx-toast{from{opacity:0;transform:translateY(-5px)}}
@media(max-width:720px){.tnx-entry{right:10px}.tnx-toast{right:12px;top:auto;bottom:12px}}
@media(prefers-reduced-motion:reduce){.tnx-root *{animation-duration:.001ms!important;transition-duration:.001ms!important}}
`;
function Favicon({ tab }) {
    const [failed, setFailed] = useState(false);
    if (!tab.favicon || failed)
        return _jsx("span", { className: "tnx-favicon-fallback", children: shortDomain(tab.url).slice(0, 1).toLocaleUpperCase() });
    return _jsx("img", { className: "tnx-favicon", src: tab.favicon, alt: "", onError: () => setFailed(true) });
}
function TabRow({ tab, revision, organizer, proposal, onProposalChange, onError }) {
    const [editingCategory, setEditingCategory] = useState(false);
    const assignedId = organizer.assignments[normalizedUrl(tab.url)] ?? "";
    const assignedName = organizer.categories[assignedId]?.name ?? "未分类";
    const proposed = proposal?.assignments[tab.tabId];
    const focus = async () => {
        try {
            await focusChromeTab(tab.tabId, revision);
        }
        catch (error) {
            onError(error instanceof Error ? error.message : String(error));
        }
    };
    const changeCategory = (value) => {
        if (proposal)
            onProposalChange?.(tab.tabId, value);
        else
            updateOrganizer((next) => { const key = normalizedUrl(tab.url); if (value)
                next.assignments[key] = value;
            else
                delete next.assignments[key]; });
        setEditingCategory(false);
    };
    return _jsxs("div", { className: "tnx-tab-row", "data-active": tab.active, onDoubleClick: () => void focus(), children: [_jsx(Favicon, { tab: tab }), _jsxs("div", { className: "tnx-tab-copy", children: [_jsx("button", { type: "button", className: "tnx-tab-title", title: "\u5207\u6362\u5230\u6B64 Chrome \u6807\u7B7E", onClick: () => void focus(), style: { border: 0, padding: 0, background: "transparent", width: "100%", textAlign: "left" }, children: tab.title || domainOf(tab.url) }), _jsxs("div", { className: "tnx-tab-meta", children: [_jsx("span", { className: "tnx-tab-domain", children: domainOf(tab.url) }), tab.pinned && _jsx("span", { className: "tnx-pin", children: "\u5DF2\u56FA\u5B9A" })] }), editingCategory ? _jsx("select", { autoFocus: true, className: "tnx-assignment", "aria-label": proposal ? "建议分类" : "标签分类", value: proposal ? proposed : assignedId, onChange: (event) => changeCategory(event.target.value), onBlur: () => setEditingCategory(false), onKeyDown: (event) => { if (event.key === "Escape") {
                            event.stopPropagation();
                            setEditingCategory(false);
                        } }, children: proposal ? proposal.categories.map((name) => _jsx("option", { value: name, children: name }, name)) : _jsxs(_Fragment, { children: [_jsx("option", { value: "", children: "\u672A\u5206\u7C7B" }), organizer.categoryOrder.flatMap((id) => organizer.categories[id] ? [_jsx("option", { value: id, children: organizer.categories[id].name }, id)] : [])] }) })
                        : _jsx("button", { type: "button", className: "tnx-category-label", title: "\u4FEE\u6539\u5206\u7C7B", onClick: () => setEditingCategory(true), children: proposal ? proposed : assignedName })] }), _jsx("button", { type: "button", className: "tnx-row-open", title: "\u5728 Chrome \u4E2D\u6253\u5F00", "aria-label": `打开 ${tab.title}`, onClick: () => void focus(), children: Icons.external }), tab.active && _jsx("span", { className: "tnx-live-dot", title: "\u5F53\u524D\u6807\u7B7E" })] });
}
function sendOrganizerPrompt(tabs, instruction) {
    if (!inputBridge)
        return "no_session";
    if (inputBridge.draft.trim())
        return "draft_busy";
    const list = tabs.slice(0, 50).map((tab, index) => `${index + 1}. ${tab.title} — ${domainOf(tab.url)} — ${tab.url}`).join("\n");
    const prompt = `请帮我整理当前 Chrome 标签。分类要求：${instruction || "按任务上下文与用途清晰分组"}。\n\n标签列表：\n${list}\n\n请优先使用 DSH 已有的浏览能力查看可访问页面的实际内容，再给出简洁分类；无法读取的页面再依据标题、域名和 URL 判断，并明确标注。先列分类，再说明每个标签应放到哪里。TabNexus 已在右侧生成可编辑预览，我会确认后应用。`;
    inputBridge.actions.setDraft(prompt);
    window.setTimeout(() => inputBridge?.actions.submit(), 80);
    return "sent";
}
function TabPanel() {
    const organizer = useOrganizer();
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");
    const [query, setQuery] = useState("");
    const [view, setView] = useState("flat");
    const [organizerOpen, setOrganizerOpen] = useState(false);
    const [instruction, setInstruction] = useState("");
    const [proposal, setProposal] = useState(null);
    const [addingCategory, setAddingCategory] = useState(false);
    const [categoryName, setCategoryName] = useState("");
    const searchRef = useRef(null);
    const refresh = useCallback(async (quiet = false) => {
        if (!quiet)
            setLoading(true);
        try {
            setSnapshot(await fetchChromeTabs());
            setError("");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(true), 3_000); return () => window.clearInterval(timer); }, [refresh]);
    useEffect(() => { if (!toast)
        return; const timer = window.setTimeout(() => setToast(""), 2_600); return () => window.clearTimeout(timer); }, [toast]);
    useEffect(() => {
        const onKey = (event) => {
            if (event.key === "Escape") {
                if (proposal)
                    setProposal(null);
                else if (organizerOpen)
                    setOrganizerOpen(false);
                else
                    setPanelOpen(false);
            }
            if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
                event.preventDefault();
                searchRef.current?.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [organizerOpen, proposal]);
    const tabs = useMemo(() => {
        const value = query.trim().toLocaleLowerCase();
        return (snapshot?.tabs ?? []).filter((tab) => !value || `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(value));
    }, [query, snapshot?.tabs]);
    const beginOrganize = () => {
        const allTabs = snapshot?.tabs ?? [];
        if (!allTabs.length) {
            setToast("当前窗口没有可整理的网页标签");
            return;
        }
        const next = createProposal(allTabs, instruction.trim());
        setProposal(next);
        setOrganizerOpen(false);
        const status = sendOrganizerPrompt(allTabs, instruction.trim());
        setToast(status === "sent" ? "DSH 正在当前对话复核；右侧可先编辑预览" : status === "draft_busy" ? "输入框已有内容，已保留草稿并生成本地预览" : "已生成整理预览；进入 DSH 对话可启用语义复核");
    };
    const applyProposal = () => {
        if (!proposal || !snapshot)
            return;
        updateOrganizer((next) => {
            const idByName = new Map(Object.values(next.categories).map((category) => [category.name, category.id]));
            for (const name of proposal.categories) {
                if (idByName.has(name))
                    continue;
                const id = uid("category");
                next.categories[id] = { id, name, color: COLORS[next.categoryOrder.length % COLORS.length] };
                next.categoryOrder.push(id);
                idByName.set(name, id);
            }
            for (const tab of snapshot.tabs) {
                const categoryId = idByName.get(proposal.assignments[tab.tabId]);
                if (categoryId)
                    next.assignments[normalizedUrl(tab.url)] = categoryId;
            }
        });
        setProposal(null);
        setView("grouped");
        setToast("分类已应用到当前标签");
    };
    const addCategory = () => {
        const name = categoryName.trim();
        if (!name)
            return;
        if (Object.values(organizer.categories).some((category) => category.name === name)) {
            setToast("这个分类已经存在");
            return;
        }
        updateOrganizer((next) => { const id = uid("category"); next.categories[id] = { id, name, color: COLORS[next.categoryOrder.length % COLORS.length] }; next.categoryOrder.push(id); });
        setCategoryName("");
        setAddingCategory(false);
    };
    const renderTabs = (items, currentProposal) => items.map((tab) => _jsx(TabRow, { tab: tab, revision: snapshot?.revision ?? "", organizer: organizer, proposal: currentProposal, onProposalChange: (tabId, category) => setProposal((current) => current ? { ...current, assignments: { ...current.assignments, [tabId]: category } } : null), onError: (message) => { setToast(message); if (message.includes("changed"))
            void refresh(true); } }, tab.tabId));
    return _jsxs("aside", { className: "tnx-root tnx-panel", "aria-label": "TabNexus Chrome \u6807\u7B7E\u7BA1\u7406\u5668", children: [_jsxs("header", { className: "tnx-panel-head", children: [_jsx("span", { style: { color: "var(--tnx-secondary)", display: "grid" }, children: Icons.tabs }), _jsxs("div", { className: "tnx-title-wrap", children: [_jsx("div", { className: "tnx-title", children: "TabNexus" }), _jsx("div", { className: "tnx-subtitle", children: error ? "Chrome 未连接" : `${snapshot?.tabs.length ?? 0} 个当前标签${snapshot?.unsupported ? ` · ${snapshot.unsupported} 个不支持` : ""}` })] }), _jsx("button", { className: "tnx-icon", title: "\u540C\u6B65 Chrome \u6807\u7B7E", onClick: () => void refresh(), children: Icons.refresh }), _jsx("button", { className: "tnx-icon", title: "\u5173\u95ED", onClick: () => setPanelOpen(false), children: Icons.close })] }), !proposal && _jsxs("div", { className: "tnx-command", children: [_jsxs("div", { className: "tnx-command-row", children: [_jsxs("div", { className: "tnx-view", "aria-label": "\u663E\u793A\u65B9\u5F0F", children: [_jsx("button", { "data-active": view === "flat", onClick: () => setView("flat"), children: "\u5168\u90E8\u6807\u7B7E" }), _jsx("button", { "data-active": view === "grouped", onClick: () => setView("grouped"), children: "\u6309\u5206\u7C7B" })] }), _jsxs("button", { className: "tnx-button tnx-button-quiet", onClick: () => setOrganizerOpen((value) => !value), "aria-expanded": organizerOpen, children: [Icons.sparkle, " \u6574\u7406"] })] }), _jsxs("label", { className: "tnx-search", children: [Icons.search, _jsx("input", { ref: searchRef, value: query, onChange: (event) => setQuery(event.target.value), placeholder: "\u641C\u7D22\u6807\u7B7E" }), _jsx("span", { className: "tnx-search-count", children: tabs.length })] })] }), organizerOpen && !proposal && _jsxs("section", { className: "tnx-organizer", children: [_jsxs("div", { className: "tnx-organizer-title", children: [Icons.sparkle, _jsx("span", { children: "\u8BA9 DSH \u5E2E\u4F60\u68B3\u7406" })] }), _jsx("p", { className: "tnx-organizer-help", children: "\u8F93\u5165\u4F60\u60F3\u8981\u7684\u5206\u7C7B\u65B9\u5F0F\uFF1B\u540C\u65F6\u751F\u6210\u53EF\u7F16\u8F91\u9884\u89C8\uFF0C\u4E0D\u4F1A\u76F4\u63A5\u8986\u76D6\u3002" }), _jsx("textarea", { autoFocus: true, className: "tnx-textarea", value: instruction, onChange: (event) => setInstruction(event.target.value), placeholder: "\u4F8B\u5982\uFF1A\u6309\u516C\u53F8\u548C\u6C42\u804C\u9636\u6BB5\u5206\u7C7B\uFF1B\u6216\u5206\u7C7B\u4E3A\uFF1A\u5C97\u4F4D\u3001\u6295\u9012\u8BB0\u5F55\u3001\u6587\u6863\u3001\u5DE5\u5177" }), _jsxs("div", { className: "tnx-organizer-actions", children: [_jsx("button", { className: "tnx-button", onClick: () => setOrganizerOpen(false), children: "\u53D6\u6D88" }), _jsx("button", { className: "tnx-button tnx-button-primary", onClick: beginOrganize, children: "\u5F00\u59CB\u6574\u7406" })] })] }), proposal ? _jsxs(_Fragment, { children: [_jsxs("div", { className: "tnx-preview-head", children: [_jsx("strong", { children: "\u6574\u7406\u9884\u89C8" }), _jsxs("span", { children: [snapshot?.tabs.length ?? 0, " \u4E2A\u6807\u7B7E \u00B7 \u786E\u8BA4\u540E\u624D\u5E94\u7528"] })] }), _jsx("div", { className: "tnx-preview-categories", children: proposal.categories.map((category) => _jsx("span", { className: "tnx-preview-chip", children: category }, category)) }), _jsx("main", { className: "tnx-body", children: renderTabs((snapshot?.tabs ?? []).filter((tab) => !query || `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), proposal) }), _jsxs("div", { className: "tnx-preview-actions", children: [_jsx("button", { className: "tnx-button", onClick: () => setProposal(null), children: "\u53D6\u6D88" }), _jsxs("button", { className: "tnx-button tnx-button-primary", onClick: applyProposal, children: [Icons.check, " \u5E94\u7528\u5206\u7C7B"] })] })] })
                : _jsx("main", { className: "tnx-body", children: loading && !snapshot ? _jsx("div", { className: "tnx-loading", children: _jsx("span", { className: "tnx-spinner" }) }) : error ? _jsxs("div", { className: "tnx-empty", children: [_jsx("span", { style: { color: "var(--tnx-secondary)" }, children: Icons.tabs }), _jsx("strong", { children: "\u8FD8\u6CA1\u6709\u540C\u6B65\u5230 Chrome" }), _jsxs("span", { children: [error, _jsx("br", {}), "\u786E\u8BA4 TabNexus Chrome \u6269\u5C55\u5DF2\u5B89\u88C5\uFF0C\u6253\u5F00\u4E00\u6B21\u6269\u5C55\u540E\u4F1A\u81EA\u52A8\u8FDE\u63A5\u3002"] }), _jsx("button", { className: "tnx-button", style: { marginTop: 12 }, onClick: () => void refresh(), children: "\u91CD\u65B0\u8FDE\u63A5" })] }) : !tabs.length ? _jsxs("div", { className: "tnx-empty", children: [_jsx("span", { style: { color: "var(--tnx-secondary)" }, children: Icons.search }), _jsx("strong", { children: query ? "没有匹配的标签" : "当前窗口没有网页标签" }), _jsx("span", { children: query ? "换一个标题或域名关键词。" : "打开 Chrome 网页后会自动出现在这里。" })] }) : view === "flat" ? renderTabs(tabs) : _jsxs(_Fragment, { children: [organizer.categoryOrder.map((id) => { const category = organizer.categories[id]; if (!category)
                                return null; const items = tabs.filter((tab) => organizer.assignments[normalizedUrl(tab.url)] === id); if (!items.length)
                                return null; return _jsxs("section", { className: "tnx-section", children: [_jsxs("header", { className: "tnx-section-head", children: [_jsx("span", { className: "tnx-section-dot", style: { background: category.color } }), _jsx("span", { children: category.name }), _jsx("span", { className: "tnx-section-count", children: items.length })] }), renderTabs(items)] }, id); }), _jsxs("section", { className: "tnx-section", children: [_jsxs("header", { className: "tnx-section-head", children: [_jsx("span", { className: "tnx-section-dot", style: { background: "var(--tnx-muted)" } }), _jsx("span", { children: "\u672A\u5206\u7C7B" }), _jsx("span", { className: "tnx-section-count", children: tabs.filter((tab) => !organizer.categories[organizer.assignments[normalizedUrl(tab.url)]]).length })] }), renderTabs(tabs.filter((tab) => !organizer.categories[organizer.assignments[normalizedUrl(tab.url)]]))] }), addingCategory ? _jsxs("div", { className: "tnx-new-category", children: [_jsx("input", { autoFocus: true, className: "tnx-input", value: categoryName, onChange: (event) => setCategoryName(event.target.value), onKeyDown: (event) => { if (event.key === "Enter")
                                            addCategory(); if (event.key === "Escape") {
                                            event.stopPropagation();
                                            setAddingCategory(false);
                                        } }, placeholder: "\u5206\u7C7B\u540D\u79F0" }), _jsx("button", { className: "tnx-button", onClick: addCategory, children: "\u6DFB\u52A0" })] }) : _jsxs("button", { className: "tnx-add-category", onClick: () => setAddingCategory(true), children: [Icons.plus, " \u65B0\u5EFA\u5206\u7C7B"] })] }) }), toast && _jsx("div", { className: "tnx-toast", role: "status", children: toast })] });
}
function SessionInputBridge(props) {
    const draft = props.useInput((state) => state.draft);
    useEffect(() => {
        const next = { sessionId: String(props.sessionId), draft, actions: props.inputActions };
        inputBridge = next;
        return () => { if (inputBridge === next)
            inputBridge = null; };
    }, [draft, props.inputActions, props.sessionId]);
    return _jsx("span", { className: "tnx-header-bridge", "aria-hidden": "true" });
}
function TabNexusOverlay(_props) {
    const open = usePanelOpen();
    useEffect(() => {
        const onStorage = (event) => {
            if (event.key === STORAGE_KEY) {
                organizerState = loadOrganizer();
                for (const listener of organizerListeners)
                    listener();
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);
    return _jsxs("div", { className: "tnx-root", children: [_jsx("style", { children: CSS }), _jsx("button", { className: "tnx-entry", "data-open": open, "aria-pressed": open, title: open ? "关闭 TabNexus 标签管理器" : "打开 TabNexus 标签管理器", "aria-label": open ? "关闭 TabNexus 标签管理器" : "打开 TabNexus 标签管理器", onClick: () => setPanelOpen(!open), children: Icons.tabs })] });
}
export function apply(ctx) {
    ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "tabnexus:overlay", order: 40, label: "TabNexus" }, TabNexusOverlay));
    ctx.slots.inject("conversation.input.left", () => ctx.slots.register({ name: "conversation.input.left", id: "tabnexus:input-bridge", order: 999, label: "TabNexus input bridge" }, SessionInputBridge));
    ctx.slots.inject("details", () => {
        let disposePanel = null;
        const control = (open) => {
            if (open && !disposePanel) {
                disposePanel = ctx.slots.register({ name: "details", priority: -100 }, TabPanel);
                ctx.layout.openDetails();
            }
            else if (!open && disposePanel) {
                disposePanel();
                disposePanel = null;
                ctx.layout.closeDetails();
            }
        };
        nativePanelController = control;
        if (panelOpen)
            queueMicrotask(() => control(true));
        return () => {
            if (nativePanelController === control)
                nativePanelController = null;
            disposePanel?.();
            disposePanel = null;
        };
    });
}
