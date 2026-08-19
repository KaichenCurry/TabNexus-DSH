import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import type { PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";
import type {} from "@deepseek-ai/dsh-client-ui-layout/client";

export const inject: string[] = ["slots", "layout"];

interface BrowserTab {
  tabId: number;
  windowId: number;
  title: string;
  url: string;
  favicon?: string;
  pinned: boolean;
  active: boolean;
  lastAccessedAt?: string;
  savedCardId?: string;
}

interface ChromeSnapshot {
  revision: string;
  tabs: BrowserTab[];
  unsupported: number;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface OrganizerState {
  schemaVersion: 4;
  categoryOrder: string[];
  categories: Record<string, Category>;
  assignments: Record<string, string>;
}

interface Proposal {
  categories: string[];
  assignments: Record<number, string>;
  instruction: string;
}

const STORAGE_KEY = "tabnexus:dsh:tab-manager:v4";
const COLORS = ["#5b7cdd", "#4b9b78", "#9470d4", "#d98255", "#c96382", "#438ea8", "#a8893f"];

function uid(prefix: string): string {
  const token = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${token}`;
}

function emptyOrganizer(): OrganizerState {
  return { schemaVersion: 4, categoryOrder: [], categories: {}, assignments: {} };
}

function loadOrganizer(): OrganizerState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as OrganizerState | null;
    if (parsed?.schemaVersion === 4 && Array.isArray(parsed.categoryOrder) && parsed.categories && parsed.assignments) return parsed;
  } catch { /* A corrupt local preference should not block live Chrome tabs. */ }
  return emptyOrganizer();
}

let organizerState = loadOrganizer();
const organizerListeners = new Set<() => void>();
function useOrganizer(): OrganizerState {
  return useSyncExternalStore(
    (listener) => { organizerListeners.add(listener); return () => organizerListeners.delete(listener); },
    () => organizerState,
    () => organizerState
  );
}
function updateOrganizer(recipe: (next: OrganizerState) => void): void {
  const next = JSON.parse(JSON.stringify(organizerState)) as OrganizerState;
  recipe(next);
  organizerState = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  for (const listener of organizerListeners) listener();
}

// Panel visibility is intentionally runtime-only. Persisting it caused a stale
// "open" flag to hide the entry after a DSH client/plugin reload even though
// the native details slot had already been disposed.
let panelOpen = false;
const panelListeners = new Set<() => void>();
let nativePanelController: ((open: boolean) => void) | null = null;
function setPanelOpen(next: boolean): void {
  if (panelOpen === next) return;
  panelOpen = next;
  nativePanelController?.(next);
  for (const listener of panelListeners) listener();
}
function usePanelOpen(): boolean {
  return useSyncExternalStore(
    (listener) => { panelListeners.add(listener); return () => panelListeners.delete(listener); },
    () => panelOpen,
    () => panelOpen
  );
}

function normalizedUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLocaleLowerCase();
      if (lower.startsWith("utm_") || ["fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid"].includes(lower)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return raw;
  }
}

function explicitCategoryScore(tab: BrowserTab, category: string): number {
  const direct = scoreCategory(tab, category);
  const value = `${tab.title} ${tab.url}`.toLocaleLowerCase();
  const name = category.toLocaleLowerCase();
  let semantic = 0;
  if (/投递|申请|进度|记录|跟进/.test(name) && /投递|申请|my.?apply|application|进度|记录/.test(value)) semantic += 20;
  if (/岗位|职位|招聘|求职|公司/.test(name) && /招聘|求职|职位|岗位|校招|jd\b|career|campus|talent|zhaopin|recruit|position|job/.test(value)) semantic += 16;
  if (/文档|资料|表格|知识/.test(name) && /飞书|语雀|notion|docs?|wiki|文档|表格|sheet/.test(value)) semantic += 18;
  if (/本地|工具|开发/.test(name) && /localhost|127\.0\.0\.1|github|gitlab|开发|代码|api|deepseek|chatgpt|claude|gemini|google|搜索|search|harness/.test(value)) semantic += 18;
  if (/ai|智能|搜索/.test(name) && /deepseek|chatgpt|claude|gemini|搜索|search|\bai\b|harness/.test(value)) semantic += 14;
  return direct + semantic;
}

function domainOf(raw: string): string {
  try { return new URL(raw).hostname.replace(/^www\./, ""); } catch { return raw; }
}

function shortDomain(raw: string): string {
  const host = domainOf(raw);
  const known: Array<[RegExp, string]> = [
    [/feishu|larksuite|larkoffice/, "飞书"], [/deepseek/, "DeepSeek"], [/meituan/, "美团"],
    [/kuaishou|kwai/, "快手"], [/lenovo/, "联想"], [/google/, "Google"], [/github/, "GitHub"],
    [/yuque/, "语雀"], [/notion/, "Notion"], [/localhost|127\.0\.0\.1/, "本地工具"]
  ];
  return known.find(([pattern]) => pattern.test(host))?.[1] ?? host.split(".").slice(-2, -1)[0] ?? host;
}

function smartCategory(tab: BrowserTab, instruction: string): string {
  const value = `${tab.title} ${tab.url}`.toLocaleLowerCase();
  if (/按(网站|域名)|domain|站点/.test(instruction.toLocaleLowerCase())) return shortDomain(tab.url);
  if (/投递|申请|my.?apply|application|进度|记录表/.test(value)) return "投递与跟进";
  if (/招聘|求职|职位|岗位|校招|jd\b|career|campus|talent|zhaopin|recruit|position|job/.test(value)) return "求职岗位";
  if (/飞书|语雀|notion|docs?|wiki|文档|表格|sheet/.test(value)) return "文档资料";
  if (/github|gitlab|开发|代码|api|documentation/.test(value)) return "开发资料";
  if (/deepseek|chatgpt|claude|gemini|搜索|search|\bai\b|harness/.test(value)) return "AI 与搜索";
  if (/localhost|127\.0\.0\.1/.test(value)) return "本地工具";
  return "其他标签";
}

function explicitCategories(instruction: string): string[] {
  const match = instruction.match(/(?:分类为|分成|类别(?:是|为)?|按照)\s*[:：]?\s*(.+)$/);
  if (!match) return [];
  const values = match[1].split(/[、,，/|；;]/).map((item) => item.trim().replace(/[。.!！]+$/, "")).filter(Boolean);
  return values.length >= 2 && values.length <= 10 && values.every((item) => item.length <= 18) ? [...new Set(values)] : [];
}

function scoreCategory(tab: BrowserTab, category: string): number {
  const haystack = `${tab.title} ${domainOf(tab.url)}`.toLocaleLowerCase();
  const tokens = category.toLocaleLowerCase().split(/[\s与和、/&_-]+/).filter((token) => token.length > 1);
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? token.length : 0), 0);
}

function createProposal(tabs: BrowserTab[], instruction: string): Proposal {
  const explicit = explicitCategories(instruction);
  const assignments: Record<number, string> = {};
  for (const tab of tabs) {
    if (explicit.length) {
      const ranked = explicit.map((category) => ({ category, score: explicitCategoryScore(tab, category) })).sort((a, b) => b.score - a.score);
      assignments[tab.tabId] = ranked[0]?.category ?? explicit[0];
    } else {
      assignments[tab.tabId] = smartCategory(tab, instruction);
    }
  }
  return { categories: explicit.length ? explicit : [...new Set(Object.values(assignments))], assignments, instruction };
}

async function fetchChromeTabs(signal?: AbortSignal): Promise<ChromeSnapshot> {
  const response = await fetch("/plugins/tabnexus/chrome-tabs", { cache: "no-store", signal });
  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    error?: string;
    data?: { revision?: string; workbench?: { openTabs?: BrowserTab[]; counts?: { unsupported?: number } } };
  } | null;
  if (!response.ok || !payload?.ok || !payload.data?.workbench || typeof payload.data.revision !== "string") {
    throw new Error(payload?.error || "无法读取 Chrome 标签");
  }
  return {
    revision: payload.data.revision,
    tabs: Array.isArray(payload.data.workbench.openTabs) ? payload.data.workbench.openTabs : [],
    unsupported: payload.data.workbench.counts?.unsupported ?? 0
  };
}

async function focusChromeTab(tabId: number, revision: string): Promise<void> {
  const response = await fetch("/plugins/tabnexus/chrome-action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "focus", tabId, revision })
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "无法切换 Chrome 标签");
}

function svg(paths: ReactNode, size = 18): ReactNode {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>;
}

const Icons = {
  tabs: svg(<><rect x="4" y="4" width="13" height="16" rx="2"/><path d="M8 4V2.8A1.8 1.8 0 0 1 9.8 1h8.4A1.8 1.8 0 0 1 20 2.8v13.4A1.8 1.8 0 0 1 18.2 18H17"/></>),
  close: svg(<path d="m7 7 10 10M17 7 7 17"/>),
  refresh: svg(<><path d="M20 11a8.1 8.1 0 1 0 .1 3"/><path d="M20 4v7h-7"/></>),
  search: svg(<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>, 16),
  sparkle: svg(<><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m18 14 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z"/></>),
  plus: svg(<path d="M12 5v14M5 12h14"/>),
  external: svg(<><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></>, 15),
  more: svg(<><circle cx="6" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1" fill="currentColor" stroke="none"/></>, 16),
  check: svg(<path d="m5 12 4 4L19 6"/>, 16)
};

const CSS = String.raw`
.tnx-root{--tnx-bg:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base,#fff));--tnx-base:var(--dsw-alias-bg-base,#fff);--tnx-hover:var(--dsw-alias-interactive-bg-hover,rgba(31,41,55,.055));--tnx-active:var(--dsw-alias-interactive-bg-selected,rgba(77,111,214,.10));--tnx-text:var(--dsw-alias-label-primary,#171b24);--tnx-muted:var(--dsw-alias-label-tertiary,#7b818d);--tnx-secondary:var(--dsw-alias-label-secondary,#5f6672);--tnx-line:var(--dsw-alias-border-l2,rgba(24,30,42,.10));--tnx-blue:var(--dsw-alias-state-business-primary,#5c78d7);font:13px/1.45 Inter,-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",system-ui,sans-serif;color:var(--tnx-text);pointer-events:auto}
.tnx-root *{box-sizing:border-box}.tnx-root button,.tnx-root input,.tnx-root textarea,.tnx-root select{font:inherit;color:inherit}.tnx-root button{cursor:pointer}.tnx-entry{position:fixed;z-index:70;top:10px;right:12px;width:30px;height:30px;display:grid;place-items:center;padding:0;border:0;border-radius:7px;background:transparent;color:var(--tnx-secondary);transition:background .16s ease,color .16s ease,transform .12s ease,opacity .12s ease}.tnx-entry:hover{background:var(--tnx-hover);color:var(--tnx-text)}.tnx-entry[data-open=true]{opacity:0;pointer-events:none}.tnx-entry:active{transform:scale(.94)}.tnx-entry:focus-visible,.tnx-icon:focus-visible,.tnx-button:focus-visible,.tnx-tab-row:focus-visible{outline:2px solid var(--tnx-blue);outline-offset:2px}
.tnx-panel{width:100%;height:100%;display:flex;flex-direction:column;background:var(--tnx-bg);animation:tnx-in .18s cubic-bezier(.2,.8,.2,1);overflow:hidden}.tnx-panel-head{height:52px;flex:none;display:flex;align-items:center;gap:9px;padding:0 8px 0 14px;border-bottom:1px solid var(--tnx-line)}.tnx-title-wrap{min-width:0;flex:1}.tnx-title{font-size:14px;font-weight:600;letter-spacing:-.01em}.tnx-subtitle{font-size:11px;color:var(--tnx-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tnx-icon{width:30px;height:30px;display:grid;place-items:center;flex:none;padding:0;border:0;border-radius:7px;background:transparent;color:var(--tnx-secondary)}.tnx-icon:hover{background:var(--tnx-hover);color:var(--tnx-text)}
.tnx-command{flex:none;padding:8px 8px 9px;border-bottom:1px solid var(--tnx-line)}.tnx-command-row{height:30px;display:flex;align-items:center;justify-content:space-between;gap:6px}.tnx-button{height:30px;border:1px solid var(--tnx-line);border-radius:7px;background:var(--tnx-base);padding:0 10px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-weight:500;white-space:nowrap}.tnx-button:hover{background:var(--tnx-hover)}.tnx-button:disabled{opacity:.45;cursor:default}.tnx-button-primary{border-color:transparent;background:var(--tnx-blue);color:#fff}.tnx-button-primary:hover{background:color-mix(in srgb,var(--tnx-blue) 88%,#000)}.tnx-button-quiet{border-color:transparent;background:transparent;color:var(--tnx-secondary);padding:0 8px}.tnx-button-quiet:hover{background:var(--tnx-hover);color:var(--tnx-text)}.tnx-view{display:flex;align-items:center;gap:2px}.tnx-view button{height:28px;padding:0 9px;border:0;border-radius:6px;background:transparent;color:var(--tnx-muted);font-size:12px}.tnx-view button:hover{background:var(--tnx-hover);color:var(--tnx-secondary)}.tnx-view button[data-active=true]{background:var(--tnx-hover);color:var(--tnx-text);font-weight:500}
.tnx-search{height:34px;flex:none;display:flex;align-items:center;gap:7px;margin-top:6px;padding:0 9px;border:0;border-radius:7px;background:var(--tnx-hover);color:var(--tnx-muted)}.tnx-search:focus-within{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tnx-blue) 45%,var(--tnx-line))}.tnx-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;font-size:12px}.tnx-search-count{font-size:10px;font-variant-numeric:tabular-nums}.tnx-body{flex:1;min-height:0;overflow-y:auto;padding:4px 6px 14px;scrollbar-width:thin}.tnx-loading,.tnx-empty{min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--tnx-muted);padding:24px 18px}.tnx-empty strong{margin:8px 0 3px;color:var(--tnx-text);font-size:13px}.tnx-empty span{font-size:11px;line-height:1.55}.tnx-spinner{width:18px;height:18px;border:2px solid var(--tnx-line);border-top-color:var(--tnx-blue);border-radius:50%;animation:tnx-spin .8s linear infinite}
.tnx-tab-row{width:100%;min-height:54px;display:grid;grid-template-columns:22px minmax(0,1fr) 26px;gap:8px;padding:7px 6px 7px 8px;border:0;border-radius:7px;background:transparent;text-align:left;position:relative}.tnx-tab-row:hover{background:var(--tnx-hover)}.tnx-tab-row[data-active=true]{background:var(--tnx-active)}.tnx-favicon{width:18px;height:18px;margin-top:1px;border-radius:4px;object-fit:contain;background:var(--tnx-base)}.tnx-favicon-fallback{width:18px;height:18px;margin-top:1px;border-radius:4px;display:grid;place-items:center;background:var(--tnx-hover);color:var(--tnx-muted);font-size:9px;font-weight:600}.tnx-tab-copy{min-width:0}.tnx-tab-title{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:500;line-height:17px}.tnx-tab-meta{display:flex;align-items:center;gap:5px;min-width:0;color:var(--tnx-muted);font-size:10px;line-height:16px}.tnx-tab-domain{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tnx-pin{flex:none}.tnx-category-label{max-width:150px;height:19px;display:inline-flex;align-items:center;gap:5px;margin-top:2px;padding:0 7px 0 5px;border:1px solid color-mix(in srgb,var(--tnx-category-color,var(--tnx-muted)) 28%,transparent);border-radius:999px;background:color-mix(in srgb,var(--tnx-category-color,var(--tnx-muted)) 10%,transparent);color:var(--tnx-secondary);font-size:10px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tnx-category-label:hover{border-color:color-mix(in srgb,var(--tnx-category-color,var(--tnx-blue)) 50%,transparent);background:color-mix(in srgb,var(--tnx-category-color,var(--tnx-blue)) 16%,transparent);color:var(--tnx-text)}.tnx-category-dot{width:6px;height:6px;flex:none;border-radius:50%;background:var(--tnx-category-color,var(--tnx-muted))}.tnx-assignment{height:26px;width:100%;margin-top:3px;border:1px solid var(--tnx-line);border-radius:6px;background:var(--tnx-base);padding:0 6px;color:var(--tnx-secondary);font-size:10px}.tnx-row-open{width:26px;height:26px;display:grid;place-items:center;align-self:center;padding:0;border:0;border-radius:6px;background:transparent;color:var(--tnx-muted);opacity:0}.tnx-tab-row:hover .tnx-row-open,.tnx-row-open:focus-visible,.tnx-tab-row[data-active=true] .tnx-row-open{opacity:1}.tnx-row-open:hover{background:color-mix(in srgb,var(--tnx-hover) 80%,var(--tnx-base));color:var(--tnx-text)}.tnx-live-dot{position:absolute;top:10px;left:3px;width:3px;height:30px;border-radius:2px;background:var(--tnx-blue)}
.tnx-section{margin:4px 0 10px}.tnx-section-head{height:30px;display:flex;align-items:center;gap:7px;padding:0 8px;color:var(--tnx-secondary);font-size:11px;font-weight:600}.tnx-section-dot{width:7px;height:7px;border-radius:50%}.tnx-section-count{margin-left:auto;color:var(--tnx-muted);font-variant-numeric:tabular-nums;font-weight:400}.tnx-add-category{width:100%;height:34px;border:1px dashed var(--tnx-line);border-radius:8px;background:transparent;color:var(--tnx-muted)}.tnx-add-category:hover{background:var(--tnx-hover);color:var(--tnx-text)}.tnx-new-category{display:flex;gap:6px;padding:5px}.tnx-input,.tnx-textarea{width:100%;border:1px solid var(--tnx-line);border-radius:8px;background:var(--tnx-base);outline:0}.tnx-input{height:32px;padding:0 9px}.tnx-textarea{min-height:68px;resize:vertical;padding:8px 9px;line-height:1.5}.tnx-input:focus,.tnx-textarea:focus,.tnx-assignment:focus{border-color:color-mix(in srgb,var(--tnx-blue) 60%,var(--tnx-line));box-shadow:0 0 0 2px color-mix(in srgb,var(--tnx-blue) 10%,transparent)}
.tnx-organizer{flex:none;padding:10px;border-bottom:1px solid var(--tnx-line);background:var(--tnx-bg)}.tnx-organizer-title{display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:3px}.tnx-organizer-help{margin:0 0 8px;color:var(--tnx-muted);font-size:10px}.tnx-organizer-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:7px}.tnx-preview-head{padding:10px 10px 6px}.tnx-preview-head strong{display:block}.tnx-preview-head span{color:var(--tnx-muted);font-size:10px}.tnx-preview-categories{display:flex;flex-wrap:wrap;gap:4px;padding:0 10px 8px}.tnx-preview-chip{padding:2px 7px;border-radius:5px;background:var(--tnx-hover);color:var(--tnx-secondary);font-size:10px}.tnx-preview-actions{display:flex;justify-content:flex-end;gap:6px;padding:8px 10px;border-top:1px solid var(--tnx-line);background:var(--tnx-bg)}
.tnx-toast{position:fixed;z-index:90;right:294px;top:16px;max-width:320px;padding:8px 11px;border-radius:8px;background:rgba(24,29,39,.92);box-shadow:0 8px 24px rgba(0,0,0,.16);color:white;font-size:11px;animation:tnx-toast .16s ease}.tnx-header-bridge{display:none}
@keyframes tnx-in{from{transform:translateX(18px);opacity:.55}}@keyframes tnx-spin{to{transform:rotate(360deg)}}@keyframes tnx-toast{from{opacity:0;transform:translateY(-5px)}}
@media(max-width:720px){.tnx-entry{right:10px}.tnx-toast{right:12px;top:auto;bottom:12px}}
@media(prefers-reduced-motion:reduce){.tnx-root *{animation-duration:.001ms!important;transition-duration:.001ms!important}}
`;

function Favicon({ tab }: { tab: BrowserTab }) {
  const [failed, setFailed] = useState(false);
  if (!tab.favicon || failed) return <span className="tnx-favicon-fallback">{shortDomain(tab.url).slice(0, 1).toLocaleUpperCase()}</span>;
  return <img className="tnx-favicon" src={tab.favicon} alt="" onError={() => setFailed(true)}/>;
}

function TabRow({ tab, revision, organizer, proposal, onProposalChange, onError }: {
  tab: BrowserTab;
  revision: string;
  organizer: OrganizerState;
  proposal?: Proposal;
  onProposalChange?: (tabId: number, category: string) => void;
  onError: (message: string) => void;
}) {
  const [editingCategory, setEditingCategory] = useState(false);
  const assignedId = organizer.assignments[normalizedUrl(tab.url)] ?? "";
  const assignedName = organizer.categories[assignedId]?.name ?? "未分类";
  const proposed = proposal?.assignments[tab.tabId];
  const proposedIndex = proposal ? Math.max(0, proposal.categories.indexOf(proposed ?? "")) : 0;
  const categoryColor = proposal ? COLORS[proposedIndex % COLORS.length] : (organizer.categories[assignedId]?.color ?? "var(--tnx-muted)");
  const focus = async (): Promise<void> => {
    try { await focusChromeTab(tab.tabId, revision); } catch (error) { onError(error instanceof Error ? error.message : String(error)); }
  };
  const changeCategory = (value: string): void => {
    if (proposal) onProposalChange?.(tab.tabId, value);
    else updateOrganizer((next) => { const key = normalizedUrl(tab.url); if (value) next.assignments[key] = value; else delete next.assignments[key]; });
    setEditingCategory(false);
  };
  return <div className="tnx-tab-row" data-active={tab.active} onDoubleClick={() => void focus()}>
    <Favicon tab={tab}/><div className="tnx-tab-copy"><button type="button" className="tnx-tab-title" title="切换到此 Chrome 标签" onClick={() => void focus()} style={{ border: 0, padding: 0, background: "transparent", width: "100%", textAlign: "left" }}>{tab.title || domainOf(tab.url)}</button>
      <div className="tnx-tab-meta"><span className="tnx-tab-domain">{domainOf(tab.url)}</span>{tab.pinned && <span className="tnx-pin">已固定</span>}</div>
      {editingCategory ? <select autoFocus className="tnx-assignment" aria-label={proposal ? "建议分类" : "标签分类"} value={proposal ? proposed : assignedId} onChange={(event) => changeCategory(event.target.value)} onBlur={() => setEditingCategory(false)} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setEditingCategory(false); } }}>{proposal ? proposal.categories.map((name) => <option key={name} value={name}>{name}</option>) : <><option value="">未分类</option>{organizer.categoryOrder.flatMap((id) => organizer.categories[id] ? [<option key={id} value={id}>{organizer.categories[id].name}</option>] : [])}</>}</select>
        : <button type="button" className="tnx-category-label" style={{ "--tnx-category-color": categoryColor } as CSSProperties} title="修改分类" onClick={() => setEditingCategory(true)}><span className="tnx-category-dot"/>{proposal ? proposed : assignedName}</button>}
    </div><button type="button" className="tnx-row-open" title="在 Chrome 中打开" aria-label={`打开 ${tab.title}`} onClick={() => void focus()}>{Icons.external}</button>{tab.active && <span className="tnx-live-dot" title="当前标签"/>}
  </div>;
}

function TabPanel() {
  const organizer = useOrganizer();
  const [snapshot, setSnapshot] = useState<ChromeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"flat" | "grouped">("flat");
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const refreshingRef = useRef(false);
  const snapshotRef = useRef<ChromeSnapshot | null>(null);

  const refresh = useCallback(async (quiet = false): Promise<void> => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    if (!quiet) setLoading(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 1_800);
    try {
      const next = await fetchChromeTabs(controller.signal);
      snapshotRef.current = next;
      setSnapshot(next);
      setError("");
    }
    catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      else if (!snapshotRef.current) setError("连接 Chrome 超时，正在自动重试");
    } finally {
      window.clearTimeout(timer);
      if (requestRef.current === controller) requestRef.current = null;
      refreshingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(true); }, 900);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); requestRef.current?.abort(); };
  }, [refresh]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2_600); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") { if (proposal) setProposal(null); else if (organizerOpen) setOrganizerOpen(false); else setPanelOpen(false); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [organizerOpen, proposal]);

  const tabs = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    return (snapshot?.tabs ?? []).filter((tab) => !value || `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(value));
  }, [query, snapshot?.tabs]);

  const beginOrganize = (): void => {
    const allTabs = snapshot?.tabs ?? [];
    if (!allTabs.length) { setToast("当前窗口没有可整理的网页标签"); return; }
    const next = createProposal(allTabs, instruction.trim());
    setProposal(next);
    setOrganizerOpen(false);
    setToast("已生成可编辑预览；确认后才会应用分类");
  };

  const applyProposal = (): void => {
    if (!proposal || !snapshot) return;
    updateOrganizer((next) => {
      const idByName = new Map(Object.values(next.categories).map((category) => [category.name, category.id]));
      for (const name of proposal.categories) {
        if (idByName.has(name)) continue;
        const id = uid("category");
        next.categories[id] = { id, name, color: COLORS[next.categoryOrder.length % COLORS.length] };
        next.categoryOrder.push(id);
        idByName.set(name, id);
      }
      for (const tab of snapshot.tabs) {
        const categoryId = idByName.get(proposal.assignments[tab.tabId]);
        if (categoryId) next.assignments[normalizedUrl(tab.url)] = categoryId;
      }
    });
    setProposal(null);
    setView("grouped");
    setToast("分类已应用到当前标签");
  };

  const addCategory = (): void => {
    const name = categoryName.trim();
    if (!name) return;
    if (Object.values(organizer.categories).some((category) => category.name === name)) { setToast("这个分类已经存在"); return; }
    updateOrganizer((next) => { const id = uid("category"); next.categories[id] = { id, name, color: COLORS[next.categoryOrder.length % COLORS.length] }; next.categoryOrder.push(id); });
    setCategoryName("");
    setAddingCategory(false);
  };

  const renderTabs = (items: BrowserTab[], currentProposal?: Proposal): ReactNode => items.map((tab) => <TabRow key={tab.tabId} tab={tab} revision={snapshot?.revision ?? ""} organizer={organizer} proposal={currentProposal} onProposalChange={(tabId, category) => setProposal((current) => current ? { ...current, assignments: { ...current.assignments, [tabId]: category } } : null)} onError={(message) => { setToast(message); if (message.includes("changed")) void refresh(true); }}/>);

  return <aside className="tnx-root tnx-panel" aria-label="TabNexus Chrome 标签管理器">
    <header className="tnx-panel-head"><span style={{ color: "var(--tnx-secondary)", display: "grid" }}>{Icons.tabs}</span><div className="tnx-title-wrap"><div className="tnx-title">TabNexus</div><div className="tnx-subtitle">{error ? "Chrome 未连接" : `${snapshot?.tabs.length ?? 0} 个当前标签${snapshot?.unsupported ? ` · ${snapshot.unsupported} 个不支持` : ""}`}</div></div><button className="tnx-icon" title="同步 Chrome 标签" onClick={() => void refresh()}>{Icons.refresh}</button><button className="tnx-icon" title="关闭" onClick={() => setPanelOpen(false)}>{Icons.close}</button></header>
    {!proposal && <div className="tnx-command"><div className="tnx-command-row"><div className="tnx-view" aria-label="显示方式"><button data-active={view === "flat"} onClick={() => setView("flat")}>全部标签</button><button data-active={view === "grouped"} onClick={() => setView("grouped")}>按分类</button></div><button className="tnx-button tnx-button-quiet" onClick={() => setOrganizerOpen((value) => !value)} aria-expanded={organizerOpen}>{Icons.sparkle} 整理</button></div><label className="tnx-search">{Icons.search}<input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标签"/><span className="tnx-search-count">{tabs.length}</span></label></div>}
    {organizerOpen && !proposal && <section className="tnx-organizer"><div className="tnx-organizer-title">{Icons.sparkle}<span>一键整理标签</span></div><p className="tnx-organizer-help">根据标题、域名和 URL 生成可编辑预览，不调用模型，也不会直接覆盖。</p><textarea autoFocus className="tnx-textarea" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：按公司和求职阶段分类；或分类为：岗位、投递记录、文档、工具"/><div className="tnx-organizer-actions"><button className="tnx-button" onClick={() => setOrganizerOpen(false)}>取消</button><button className="tnx-button tnx-button-primary" onClick={beginOrganize}>开始整理</button></div></section>}
    {proposal ? <><div className="tnx-preview-head"><strong>整理预览</strong><span>{snapshot?.tabs.length ?? 0} 个标签 · 确认后才应用</span></div><div className="tnx-preview-categories">{proposal.categories.map((category) => <span className="tnx-preview-chip" key={category}>{category}</span>)}</div><main className="tnx-body">{renderTabs((snapshot?.tabs ?? []).filter((tab) => !query || `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), proposal)}</main><div className="tnx-preview-actions"><button className="tnx-button" onClick={() => setProposal(null)}>取消</button><button className="tnx-button tnx-button-primary" onClick={applyProposal}>{Icons.check} 应用分类</button></div></>
      : <main className="tnx-body">{loading && !snapshot ? <div className="tnx-loading"><span className="tnx-spinner"/></div> : error ? <div className="tnx-empty"><span style={{ color: "var(--tnx-secondary)" }}>{Icons.tabs}</span><strong>还没有同步到 Chrome</strong><span>{error}<br/>确认 TabNexus Chrome 扩展已安装，打开一次扩展后会自动连接。</span><button className="tnx-button" style={{ marginTop: 12 }} onClick={() => void refresh()}>重新连接</button></div> : !tabs.length ? <div className="tnx-empty"><span style={{ color: "var(--tnx-secondary)" }}>{Icons.search}</span><strong>{query ? "没有匹配的标签" : "当前窗口没有网页标签"}</strong><span>{query ? "换一个标题或域名关键词。" : "打开 Chrome 网页后会自动出现在这里。"}</span></div> : view === "flat" ? renderTabs(tabs) : <>{organizer.categoryOrder.map((id) => { const category = organizer.categories[id]; if (!category) return null; const items = tabs.filter((tab) => organizer.assignments[normalizedUrl(tab.url)] === id); if (!items.length) return null; return <section className="tnx-section" key={id}><header className="tnx-section-head"><span className="tnx-section-dot" style={{ background: category.color }}/><span>{category.name}</span><span className="tnx-section-count">{items.length}</span></header>{renderTabs(items)}</section>; })}<section className="tnx-section"><header className="tnx-section-head"><span className="tnx-section-dot" style={{ background: "var(--tnx-muted)" }}/><span>未分类</span><span className="tnx-section-count">{tabs.filter((tab) => !organizer.categories[organizer.assignments[normalizedUrl(tab.url)]]).length}</span></header>{renderTabs(tabs.filter((tab) => !organizer.categories[organizer.assignments[normalizedUrl(tab.url)]]))}</section>{addingCategory ? <div className="tnx-new-category"><input autoFocus className="tnx-input" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCategory(); if (event.key === "Escape") { event.stopPropagation(); setAddingCategory(false); } }} placeholder="分类名称"/><button className="tnx-button" onClick={addCategory}>添加</button></div> : <button className="tnx-add-category" onClick={() => setAddingCategory(true)}>{Icons.plus} 新建分类</button>}</>}</main>}
    {toast && <div className="tnx-toast" role="status">{toast}</div>}
  </aside>;
}

type OverlayProps = PropsRuntime<"shell.overlay">;
function TabNexusOverlay(_props: OverlayProps) {
  const open = usePanelOpen();
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === STORAGE_KEY) { organizerState = loadOrganizer(); for (const listener of organizerListeners) listener(); }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return <div className="tnx-root"><style>{CSS}</style><button className="tnx-entry" data-open={open} aria-pressed={open} title={open ? "关闭 TabNexus 标签管理器" : "打开 TabNexus 标签管理器"} aria-label={open ? "关闭 TabNexus 标签管理器" : "打开 TabNexus 标签管理器"} onClick={() => setPanelOpen(!open)}>{Icons.tabs}</button></div>;
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "tabnexus:overlay", order: 40, label: "TabNexus" }, TabNexusOverlay));
  ctx.slots.inject("details", () => {
    let disposePanel: (() => void) | null = null;
    const control = (open: boolean): void => {
      if (open && !disposePanel) {
        disposePanel = ctx.slots.register({ name: "details", priority: -100 }, TabPanel);
        ctx.layout.openDetails();
      } else if (!open && disposePanel) {
        disposePanel();
        disposePanel = null;
        ctx.layout.closeDetails();
      }
    };
    nativePanelController = control;
    if (panelOpen) queueMicrotask(() => control(true));
    return () => {
      if (nativePanelController === control) nativePanelController = null;
      disposePanel?.();
      disposePanel = null;
    };
  });
}
