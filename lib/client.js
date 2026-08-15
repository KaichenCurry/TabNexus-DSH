window.__ModuleLoader__.load({
	id: "dsh-plugin-tabnexus",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region lib/client/index.js
		const inject = [];
		const CSS = `
#tn-dsh-chip{position:fixed;z-index:40;display:flex;align-items:center;gap:6px;background:rgba(250,251,252,.94);
border:1px solid #E5E8ED;border-radius:8px;padding:4px 10px;font:11px/1.4 system-ui,-apple-system,sans-serif;color:#1B2430;
box-shadow:0 2px 8px rgba(27,36,48,.06);cursor:pointer;user-select:none;transition:top .2s,right .2s}
#tn-dsh-chip .tn-dot{width:8px;height:8px;border-radius:50%;background:#8A93A3;flex:none}
#tn-dsh-chip.ok .tn-dot{background:#3F9D6A}
#tn-dsh-chip.bad .tn-dot{background:#D6455E}
#tn-dsh-chip .tn-hint{margin-left:2px;color:#8A93A3;font-size:10px}
#tn-dsh-panel{position:fixed;z-index:41;width:420px;max-height:min(72vh,720px);display:flex;flex-direction:column;
background:#FAFBFC;border:1px solid #E5E8ED;border-radius:12px;box-shadow:0 12px 32px rgba(27,36,48,.14);
font:12px/1.5 system-ui,-apple-system,sans-serif;color:#1B2430;overflow:hidden}
#tn-dsh-panel .tn-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #E5E8ED}
#tn-dsh-panel .tn-head strong{font-size:13px}
#tn-dsh-panel .tn-head .tn-meta{color:#8A93A3;font-size:11px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#tn-dsh-panel .tn-btn{border:1px solid #E5E8ED;background:#fff;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;color:#1B2430;flex:none}
#tn-dsh-panel .tn-btn.primary{background:#304F93;border-color:#304F93;color:#fff}
#tn-dsh-panel .tn-btn:disabled{opacity:.45;cursor:not-allowed}
#tn-dsh-panel .tn-tabs{display:flex;border-bottom:1px solid #E5E8ED}
#tn-dsh-panel .tn-tab{flex:1;border:none;background:transparent;padding:8px;font-size:12px;cursor:pointer;color:#8A93A3}
#tn-dsh-panel .tn-tab.active{color:#304F93;font-weight:600;box-shadow:inset 0 -2px 0 #304F93}
#tn-dsh-panel .tn-body{flex:1;overflow-y:auto;padding:12px}
#tn-dsh-panel .tn-empty{padding:24px 12px;color:#8A93A3;text-align:center;font-size:12px}
#tn-dsh-panel .tn-goal{margin:0 0 6px;font-size:12px;color:#1B2430}
#tn-dsh-panel .tn-progress{display:flex;align-items:center;gap:8px;margin-bottom:12px}
#tn-dsh-panel .tn-track{flex:1;height:8px;background:#E5E8ED;border-radius:4px;overflow:hidden}
#tn-dsh-panel .tn-fill{height:100%;background:#3F9D6A}
#tn-dsh-panel .tn-progress .tn-num{font-size:11px;color:#8A93A3;white-space:nowrap}
#tn-dsh-panel .tn-section{margin-bottom:10px;border:1px solid #E5E8ED;border-radius:8px;overflow:hidden}
#tn-dsh-panel .tn-sec-head{display:flex;align-items:center;gap:6px;padding:6px 10px;background:#F2F4F6;font-weight:600;font-size:12px}
#tn-dsh-panel .tn-sec-head em{font-style:normal;color:#8A93A3;font-size:11px}
#tn-dsh-panel .tn-page{display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid #F2F4F6}
#tn-dsh-panel .tn-page.st-excluded{opacity:.55}
#tn-dsh-panel .tn-st{flex:none;border:none;background:transparent;cursor:pointer;font-size:12px;padding:2px;color:#8A93A3}
#tn-dsh-panel .tn-page.st-adopted .tn-st{color:#3F9D6A}
#tn-dsh-panel .tn-pg-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
#tn-dsh-panel .tn-pg-title:hover{color:#304F93}
#tn-dsh-panel .tn-pg-domain{flex:none;color:#B1B6C0;font-size:10px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#tn-dsh-panel .tn-move{border:1px solid #E5E8ED;border-radius:6px;font-size:11px;background:#fff;color:#8A93A3;max-width:96px;flex:none}
#tn-dsh-panel .tn-x{border:none;background:transparent;cursor:pointer;color:#B1B6C0;flex:none}
#tn-dsh-panel .tn-x:hover{color:#D6455E}
#tn-dsh-panel .tn-inbox-item{display:flex;align-items:center;gap:8px;padding:6px 10px;border-top:1px solid #F2F4F6;cursor:pointer}
#tn-dsh-panel .tn-inbox-item:hover{background:#F7F8FA}
#tn-dsh-panel .tn-actions{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #E5E8ED;flex:none}
#tn-dsh-panel .tn-actions.flat{border-top:none}
#tn-dsh-panel .tn-note{color:#8A93A3;font-size:11px;margin:8px 0 0}
#tn-dsh-panel .tn-toast{position:absolute;left:12px;right:12px;bottom:8px;background:#1B2430;color:#fff;border-radius:8px;padding:6px 12px;font-size:11px}
#tn-dsh-panel .tn-disco{padding:16px 12px;text-align:center}
#tn-dsh-panel .tn-disco p{margin:0 0 8px;color:#8A93A3;font-size:12px}
#tn-dsh-ws{position:fixed;inset:0;z-index:45;display:flex;flex-direction:column;background:#FAFBFC;
font:13px/1.6 system-ui,-apple-system,sans-serif;color:#1B2430}
#tn-dsh-ws .ws-head{display:flex;align-items:center;gap:10px;padding:12px 20px;border-bottom:1px solid #E5E8ED;background:#fff}
#tn-dsh-ws .ws-head strong{font-size:16px}
#tn-dsh-ws .ws-head .tn-meta{color:#8A93A3;font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#tn-dsh-ws .ws-body{flex:1;display:flex;gap:16px;padding:16px 20px;overflow:hidden}
#tn-dsh-ws .ws-main{flex:1;min-width:0;overflow-y:auto;display:flex;flex-direction:column;gap:12px}
#tn-dsh-ws .ws-side{width:340px;flex:none;overflow-y:auto;border-left:1px solid #E5E8ED;padding-left:16px;display:flex;flex-direction:column;gap:10px}
#tn-dsh-ws .ws-title{font-size:20px;font-weight:600;margin:0}
#tn-dsh-ws .ws-goal{margin:0;color:#1B2430}
#tn-dsh-ws .ws-side h4{margin:0;font-size:13px}
@media (max-width: 900px){#tn-dsh-ws .ws-body{flex-direction:column}#tn-dsh-ws .ws-side{width:auto;border-left:none;border-top:1px solid #E5E8ED;padding-left:0;padding-top:12px}}
`;
		const ANCHOR_LABEL_RE = /session\s*log|会话轨迹|会话日志|轨迹|日志/i;
		const STATUS_CYCLE = {
			unread: "read",
			read: "adopted",
			adopted: "unread",
			excluded: "unread"
		};
		const STATUS_GLYPH = {
			unread: "○",
			read: "◐",
			adopted: "⭐",
			excluded: "✕"
		};
		function findAnchor() {
			for (const element of document.querySelectorAll("button, [role=button]")) {
				if ((typeof element.className === "string" ? element.className : "").includes("sessionLog")) return element;
				const label = `${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("title") ?? ""} ${element.textContent ?? ""}`;
				if (ANCHOR_LABEL_RE.test(label)) return element;
			}
		}
		function domainOf(url) {
			if (!url) return "";
			try {
				return new URL(url).hostname.replace(/^www\./, "");
			} catch {
				return "";
			}
		}
		function escapeHtml(value) {
			return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		}
		function apply(ctx) {
			const style = document.createElement("style");
			style.textContent = CSS;
			document.head.appendChild(style);
			const chip = document.createElement("div");
			chip.id = "tn-dsh-chip";
			chip.innerHTML = `<span class="tn-dot"></span><span>TabNexus</span><span class="tn-hint">工作区▾</span>`;
			document.body.appendChild(chip);
			let disposed = false;
			let panel = null;
			let workspace = null;
			let activeTab = "task";
			let snapshot = null;
			let busy = false;
			let toastTimer = null;
			let inflight = false;
			const api = async (path, options) => {
				const response = await fetch(path, {
					cache: "no-store",
					...options
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.json();
			};
			const toast = (message) => {
				const host = workspace ?? panel;
				if (!host) return;
				host.querySelector(".tn-toast")?.remove();
				const node = document.createElement("div");
				node.className = "tn-toast";
				node.textContent = message;
				host.appendChild(node);
				if (toastTimer) clearTimeout(toastTimer);
				toastTimer = setTimeout(() => node.remove(), 3200);
			};
			const fetchSnapshot = async () => {
				if (disposed || inflight) return;
				inflight = true;
				try {
					const raw = await api("/plugins/tabnexus/workspace");
					const wsOk = Boolean(raw.workspace?.ok);
					snapshot = {
						revision: raw.workspace?.data?.revision,
						workspace: raw.workspace?.data?.workspace,
						workbench: raw.workbench?.data?.workbench,
						error: wsOk ? void 0 : raw.workspace?.error ?? "TabNexus 未连接"
					};
					chip.classList.toggle("ok", wsOk);
					chip.classList.toggle("bad", !wsOk);
					render();
				} catch (error) {
					snapshot = { error: error instanceof Error ? error.message : "面板数据不可达" };
					chip.classList.add("bad");
					render();
				} finally {
					inflight = false;
				}
			};
			const action = async (tool, input, mutate) => {
				if (busy || !panel) return;
				busy = true;
				try {
					const result = await api("/plugins/tabnexus/action", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							tool,
							input
						})
					});
					if (result.ok) {
						if (mutate) {
							toast("已保存 ✓");
							await fetchSnapshot();
						}
					} else if (/Workspace changed|Tab workbench changed/i.test(result.error ?? "")) {
						toast("任务已变化，已自动刷新——请重试");
						await fetchSnapshot();
					} else toast(result.error ?? "操作失败");
				} catch (error) {
					toast(error instanceof Error ? error.message : "操作失败");
				} finally {
					busy = false;
				}
			};
			const operationId = () => `dsh_panel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
			const selectedTabs = () => [...panel?.querySelectorAll("input[type=checkbox][data-tab]") ?? []].filter((input) => input.checked).map((input) => Number(input.dataset.tab));
			const render = () => {
				renderWorkspace();
				if (!panel) return;
				const head = panel.querySelector(".tn-head .tn-meta");
				const body = panel.querySelector(".tn-body");
				if (!head || !body) return;
				panel.querySelectorAll(".tn-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === activeTab));
				if (snapshot?.error) {
					head.textContent = snapshot.error;
					body.innerHTML = `<div class="tn-disco"><p>${escapeHtml(snapshot.error)}</p><p>点「刷新」重试；若持续失败请重启 DSH。</p></div>`;
					return;
				}
				const ws = snapshot?.workspace;
				if (!ws) {
					body.innerHTML = `<div class="tn-empty">加载中…</div>`;
					return;
				}
				const cards = ws.cards ?? {};
				const groups = ws.groups ?? {};
				const order = ws.groupOrder ?? [];
				const counted = Object.values(cards).filter((card) => card.status !== "excluded");
				const read = counted.filter((card) => card.status === "read" || card.status === "adopted").length;
				const adopted = counted.filter((card) => card.status === "adopted").length;
				head.textContent = ws.name ?? "";
				body.innerHTML = "";
				if (activeTab === "inbox") {
					const openTabs = (snapshot?.workbench?.openTabs ?? []).filter((tab) => !tab.savedCardId);
					const savedCount = (snapshot?.workbench?.openTabs ?? []).filter((tab) => tab.savedCardId).length;
					const goal = document.createElement("p");
					goal.className = "tn-goal";
					goal.textContent = `当前窗口 · 未保存 ${openTabs.length}${savedCount ? ` · 已保存 ${savedCount}` : ""}`;
					body.appendChild(goal);
					for (const tab of openTabs) {
						const row = document.createElement("label");
						row.className = "tn-inbox-item";
						row.innerHTML = `<input type="checkbox" data-tab="${tab.tabId}"><span class="tn-pg-title">${escapeHtml(tab.title)}</span><span class="tn-pg-domain">${escapeHtml(domainOf(tab.url))}</span>${tab.pinned ? "📌" : ""}`;
						body.appendChild(row);
					}
					if (openTabs.length === 0) body.appendChild(Object.assign(document.createElement("div"), {
						className: "tn-empty",
						textContent: "独立版：粘贴 URL 快速添加页面，或让 Agent 添加。"
					}));
					const actions = document.createElement("div");
					actions.className = "tn-actions flat";
					const collect = Object.assign(document.createElement("button"), {
						className: "tn-btn primary",
						textContent: "收进任务"
					});
					collect.addEventListener("click", () => {
						const tabIds = selectedTabs();
						if (tabIds.length === 0) return toast("先勾选页面");
						action("sync_browser_tabs", {
							action: "save_tabs",
							tabIds,
							expectedRevision: snapshot?.revision ?? "",
							operationId: operationId()
						}, true);
					});
					const saveClose = Object.assign(document.createElement("button"), {
						className: "tn-btn",
						textContent: "保存并关闭"
					});
					saveClose.addEventListener("click", () => {
						const tabIds = selectedTabs();
						if (tabIds.length === 0) return toast("先勾选页面");
						if (!window.confirm(`保存并关闭这 ${tabIds.length} 个标签？（固定标签不会关闭）`)) return;
						action("close_browser_tabs", {
							tabIds,
							saveBeforeClose: true,
							expectedRevision: snapshot?.revision ?? "",
							operationId: operationId(),
							confirm: true,
							confirmationText: "用户确认：保存并关闭所选标签"
						}, true);
					});
					actions.append(collect, saveClose);
					body.appendChild(actions);
					const quick = document.createElement("div");
					quick.className = "tn-actions flat";
					const qaInput = Object.assign(document.createElement("input"), {
						className: "tn-move",
						placeholder: "粘贴 URL 快速添加（可多行）"
					});
					qaInput.style.flex = "1";
					qaInput.style.maxWidth = "none";
					const qaButton = Object.assign(document.createElement("button"), {
						className: "tn-btn",
						textContent: "添加页面"
					});
					qaButton.addEventListener("click", () => {
						const urls = qaInput.value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 50);
						if (urls.length === 0) return toast("先粘贴一个或多个 URL");
						action("mcp__tabnexus__add_cards", {
							cards: urls.map((url) => ({
								title: url,
								url
							})),
							expectedRevision: snapshot?.revision ?? "",
							operationId: operationId()
						}, true);
					});
					quick.append(qaInput, qaButton);
					body.appendChild(quick);
					return;
				}
				if (ws.v2?.goal) {
					const goal = document.createElement("p");
					goal.className = "tn-goal";
					goal.textContent = `🎯 ${ws.v2.goal}`;
					body.appendChild(goal);
				}
				const progress = document.createElement("div");
				progress.className = "tn-progress";
				const track = document.createElement("div");
				track.className = "tn-track";
				const fill = document.createElement("div");
				fill.className = "tn-fill";
				fill.style.width = `${counted.length > 0 ? Math.round(read / counted.length * 100) : 0}%`;
				track.appendChild(fill);
				const num = document.createElement("span");
				num.className = "tn-num";
				num.textContent = `${read}/${counted.length} 已读 · ⭐${adopted}`;
				progress.append(track, num);
				body.appendChild(progress);
				const assigned = /* @__PURE__ */ new Set();
				for (const groupId of order) {
					const group = groups[groupId];
					if (!group) continue;
					group.cardIds.forEach((cardId) => assigned.add(cardId));
					body.appendChild(sectionNode(group.name, group.cardIds.map((cardId) => cards[cardId]).filter((card) => Boolean(card))));
				}
				const unassigned = Object.values(cards).filter((card) => !assigned.has(card.id));
				if (unassigned.length > 0) {
					const node = sectionNode("未归类", unassigned);
					node.style.borderStyle = "dashed";
					body.appendChild(node);
				}
				const addRow = document.createElement("div");
				addRow.className = "tn-actions flat";
				const addInput = Object.assign(document.createElement("input"), {
					className: "tn-move",
					placeholder: "新章节名…"
				});
				addInput.style.flex = "1";
				addInput.style.maxWidth = "none";
				const addButton = Object.assign(document.createElement("button"), {
					className: "tn-btn primary",
					textContent: "＋ 新建章节"
				});
				addButton.addEventListener("click", () => {
					const name = addInput.value.trim();
					if (!name) return toast("先输入章节名");
					action("edit_workspace", {
						expectedRevision: snapshot?.revision ?? "",
						operationId: operationId(),
						actions: [{
							type: "create_group",
							groupId: `panel_${Date.now().toString(36)}`,
							name,
							color: "#7A6EDC"
						}]
					}, true);
				});
				addRow.append(addInput, addButton);
				body.appendChild(addRow);
			};
			const sectionNode = (name, pages) => {
				const node = document.createElement("div");
				node.className = "tn-section";
				const head = document.createElement("div");
				head.className = "tn-sec-head";
				head.innerHTML = `<span>${escapeHtml(name)}</span><em>${pages.length}</em>`;
				node.appendChild(head);
				for (const page of pages) {
					const row = document.createElement("div");
					row.className = `tn-page st-${page.status ?? "unread"}`;
					const st = Object.assign(document.createElement("button"), {
						className: "tn-st",
						title: "切换状态：待读→已读→已采用",
						textContent: STATUS_GLYPH[page.status ?? "unread"] ?? "○"
					});
					st.addEventListener("click", () => {
						const next = STATUS_CYCLE[page.status ?? "unread"] ?? "read";
						action("edit_workspace", {
							expectedRevision: snapshot?.revision ?? "",
							operationId: operationId(),
							actions: [{
								type: "update_card",
								cardId: page.id,
								status: next
							}]
						}, true);
					});
					const title = document.createElement("span");
					title.className = "tn-pg-title";
					title.textContent = page.title;
					title.title = page.excludedReason ? `排除原因：${page.excludedReason}` : "打开原页";
					if (page.url) title.addEventListener("click", () => window.open(page.url, "_blank", "noopener"));
					const domain = document.createElement("span");
					domain.className = "tn-pg-domain";
					domain.textContent = domainOf(page.url);
					const move = document.createElement("select");
					move.className = "tn-move";
					const moveGroups = snapshot?.workspace?.groups ?? {};
					move.innerHTML = `<option value="__current">移动到…</option><option value="__null">未归类</option>${(snapshot?.workspace?.groupOrder ?? []).map((groupId) => moveGroups[groupId]).filter((group) => Boolean(group)).map((group) => `<option value="${group.id}">${escapeHtml(group.name)}</option>`).join("")}`;
					move.addEventListener("change", () => {
						if (move.value === "__current") return;
						action("edit_workspace", {
							expectedRevision: snapshot?.revision ?? "",
							operationId: operationId(),
							actions: [{
								type: "move_cards",
								cardIds: [page.id],
								targetGroupId: move.value === "__null" ? null : move.value
							}]
						}, true);
					});
					const del = Object.assign(document.createElement("button"), {
						className: "tn-x",
						textContent: "×",
						title: "删除页面"
					});
					del.addEventListener("click", () => {
						if (!window.confirm(`删除「${page.title}」？此操作不可撤销。`)) return;
						action("delete_workspace_items", {
							expectedRevision: snapshot?.revision ?? "",
							operationId: operationId(),
							cardIds: [page.id],
							confirm: true,
							confirmationText: "用户确认删除"
						}, true);
					});
					row.append(st, title, domain, move, del);
					node.appendChild(row);
				}
				return node;
			};
			const place = () => {
				const anchor = findAnchor();
				if (anchor && anchor.isConnected) {
					const rect = anchor.getBoundingClientRect();
					if (rect.width > 0 && rect.height > 0) {
						chip.style.top = `${Math.round(rect.bottom) + 8}px`;
						chip.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
					}
				} else {
					chip.style.top = "56px";
					chip.style.right = "14px";
				}
				if (panel) {
					const chipRect = chip.getBoundingClientRect();
					panel.style.top = `${Math.round(chipRect.bottom) + 6}px`;
					panel.style.right = `${Math.max(8, Math.round(window.innerWidth - chipRect.right))}px`;
				}
			};
			const closePanel = () => {
				panel?.remove();
				panel = null;
			};
			const closeWorkspace = () => {
				workspace?.remove();
				workspace = null;
			};
			const openWorkspace = () => {
				closeWorkspace();
				workspace = document.createElement("div");
				workspace.id = "tn-dsh-ws";
				workspace.innerHTML = `
      <div class="ws-head"><strong>TabNexus</strong><span class="tn-meta">…</span>
        <button class="tn-btn" data-refresh>刷新</button>
        <button class="tn-btn" data-close>✕ 关闭</button></div>
      <div class="ws-body">
        <div class="ws-main"><div class="tn-empty">加载中…</div></div>
        <div class="ws-side"><h4>收件口</h4><div class="tn-empty">加载中…</div></div>
      </div>`;
				document.body.appendChild(workspace);
				workspace.querySelector("[data-refresh]").addEventListener("click", () => void fetchSnapshot());
				workspace.querySelector("[data-close]").addEventListener("click", closeWorkspace);
				fetchSnapshot();
			};
			const renderWorkspace = () => {
				if (!workspace) return;
				const head = workspace.querySelector(".ws-head .tn-meta");
				const main = workspace.querySelector(".ws-main");
				const side = workspace.querySelector(".ws-side");
				if (!head || !main || !side) return;
				if (snapshot?.error) {
					head.textContent = snapshot.error;
					main.innerHTML = `<div class="tn-disco"><p>${escapeHtml(snapshot.error)}</p><p>点「刷新」重试；若持续失败请重启 DSH。</p></div>`;
					side.innerHTML = `<h4>收件口</h4><div class="tn-empty">暂不可用</div>`;
					return;
				}
				const ws = snapshot?.workspace;
				if (!ws) {
					main.innerHTML = `<div class="tn-empty">加载中…</div>`;
					return;
				}
				const cards = ws.cards ?? {};
				const groups = ws.groups ?? {};
				const order = ws.groupOrder ?? [];
				const counted = Object.values(cards).filter((card) => card.status !== "excluded");
				const read = counted.filter((card) => card.status === "read" || card.status === "adopted").length;
				const adopted = counted.filter((card) => card.status === "adopted").length;
				head.textContent = ws.name ?? "";
				main.innerHTML = "";
				const title = Object.assign(document.createElement("h1"), {
					className: "ws-title",
					textContent: ws.name ?? ""
				});
				main.appendChild(title);
				if (ws.v2?.goal) {
					const goal = Object.assign(document.createElement("p"), {
						className: "ws-goal",
						textContent: `🎯 ${ws.v2.goal}`
					});
					main.appendChild(goal);
				}
				const progress = document.createElement("div");
				progress.className = "tn-progress";
				const track = document.createElement("div");
				track.className = "tn-track";
				const fill = document.createElement("div");
				fill.className = "tn-fill";
				fill.style.width = `${counted.length > 0 ? Math.round(read / counted.length * 100) : 0}%`;
				track.appendChild(fill);
				const num = document.createElement("span");
				num.className = "tn-num";
				num.textContent = `${read}/${counted.length} 已读 · ⭐${adopted}`;
				progress.append(track, num);
				main.appendChild(progress);
				const assigned = /* @__PURE__ */ new Set();
				for (const groupId of order) {
					const group = groups[groupId];
					if (!group) continue;
					group.cardIds.forEach((cardId) => assigned.add(cardId));
					main.appendChild(wsSectionNode(group.name, group.cardIds.map((cardId) => cards[cardId]).filter((card) => Boolean(card))));
				}
				const unassigned = Object.values(cards).filter((card) => !assigned.has(card.id));
				if (unassigned.length > 0) {
					const node = wsSectionNode("未归类", unassigned);
					node.style.borderStyle = "dashed";
					main.appendChild(node);
				}
				const addRow = document.createElement("div");
				addRow.className = "tn-actions flat";
				const addInput = Object.assign(document.createElement("input"), {
					className: "tn-move",
					placeholder: "新章节名…"
				});
				addInput.style.flex = "1";
				addInput.style.maxWidth = "none";
				const addButton = Object.assign(document.createElement("button"), {
					className: "tn-btn primary",
					textContent: "＋ 新建章节"
				});
				addButton.addEventListener("click", () => {
					const name = addInput.value.trim();
					if (!name) return toast("先输入章节名");
					action("edit_workspace", {
						expectedRevision: snapshot?.revision ?? "",
						operationId: operationId(),
						actions: [{
							type: "create_group",
							groupId: `panel_${Date.now().toString(36)}`,
							name,
							color: "#7A6EDC"
						}]
					}, true);
				});
				addRow.append(addInput, addButton);
				main.appendChild(addRow);
				side.innerHTML = "<h4>收件口</h4>";
				const openTabs = (snapshot?.workbench?.openTabs ?? []).filter((tab) => !tab.savedCardId);
				const savedCount = (snapshot?.workbench?.openTabs ?? []).filter((tab) => tab.savedCardId).length;
				const goal = Object.assign(document.createElement("p"), {
					className: "tn-goal",
					textContent: `当前窗口 · 未保存 ${openTabs.length}${savedCount ? ` · 已保存 ${savedCount}` : ""}`
				});
				side.appendChild(goal);
				for (const tab of openTabs) {
					const row = document.createElement("label");
					row.className = "tn-inbox-item";
					row.innerHTML = `<input type="checkbox" data-tab="${tab.tabId}"><span class="tn-pg-title">${escapeHtml(tab.title)}</span><span class="tn-pg-domain">${escapeHtml(domainOf(tab.url))}</span>${tab.pinned ? "📌" : ""}`;
					side.appendChild(row);
				}
				if (openTabs.length === 0) side.appendChild(Object.assign(document.createElement("div"), {
					className: "tn-empty",
					textContent: "独立版：粘贴 URL 快速添加页面，或让 Agent 添加。"
				}));
				const quick = document.createElement("div");
				quick.className = "tn-actions flat";
				const qaInput = Object.assign(document.createElement("input"), {
					className: "tn-move",
					placeholder: "粘贴 URL（可多行）"
				});
				qaInput.style.flex = "1";
				qaInput.style.maxWidth = "none";
				const qaButton = Object.assign(document.createElement("button"), {
					className: "tn-btn",
					textContent: "添加页面"
				});
				qaButton.addEventListener("click", () => {
					const urls = qaInput.value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 50);
					if (urls.length === 0) return toast("先粘贴一个或多个 URL");
					action("mcp__tabnexus__add_cards", {
						cards: urls.map((url) => ({
							title: url,
							url
						})),
						expectedRevision: snapshot?.revision ?? "",
						operationId: operationId()
					}, true);
				});
				quick.append(qaInput, qaButton);
				side.appendChild(quick);
			};
			const wsSectionNode = (name, pages) => {
				const node = document.createElement("div");
				node.className = "tn-section";
				const head = document.createElement("div");
				head.className = "tn-sec-head";
				head.innerHTML = `<span>${escapeHtml(name)}</span><em>${pages.length}</em>`;
				node.appendChild(head);
				for (const page of pages) {
					const row = document.createElement("div");
					row.className = `tn-page st-${page.status ?? "unread"}`;
					const st = Object.assign(document.createElement("button"), {
						className: "tn-status-pill tn-st",
						title: "切换状态：待读→已读→已采用",
						textContent: STATUS_GLYPH[page.status ?? "unread"] ?? "○"
					});
					st.addEventListener("click", () => {
						const next = STATUS_CYCLE[page.status ?? "unread"] ?? "read";
						action("edit_workspace", {
							expectedRevision: snapshot?.revision ?? "",
							operationId: operationId(),
							actions: [{
								type: "update_card",
								cardId: page.id,
								status: next
							}]
						}, true);
					});
					const title = document.createElement("span");
					title.className = "tn-pg-title";
					title.textContent = page.title;
					title.title = page.excludedReason ? `排除原因：${page.excludedReason}` : "打开原页";
					if (page.url) title.addEventListener("click", () => window.open(page.url, "_blank", "noopener"));
					const domain = document.createElement("span");
					domain.className = "tn-pg-domain";
					domain.textContent = domainOf(page.url);
					const move = document.createElement("select");
					move.className = "tn-move";
					const moveGroups = snapshot?.workspace?.groups ?? {};
					move.innerHTML = `<option value="__current">移动到…</option><option value="__null">未归类</option>${(snapshot?.workspace?.groupOrder ?? []).map((groupId) => moveGroups[groupId]).filter((group) => Boolean(group)).map((group) => `<option value="${group.id}">${escapeHtml(group.name)}</option>`).join("")}`;
					move.addEventListener("change", () => {
						if (move.value === "__current") return;
						action("edit_workspace", {
							expectedRevision: snapshot?.revision ?? "",
							operationId: operationId(),
							actions: [{
								type: "move_cards",
								cardIds: [page.id],
								targetGroupId: move.value === "__null" ? null : move.value
							}]
						}, true);
					});
					const del = Object.assign(document.createElement("button"), {
						className: "tn-x",
						textContent: "×",
						title: "删除页面"
					});
					del.addEventListener("click", () => {
						if (!window.confirm(`删除「${page.title}」？此操作不可撤销。`)) return;
						action("delete_workspace_items", {
							expectedRevision: snapshot?.revision ?? "",
							operationId: operationId(),
							cardIds: [page.id],
							confirm: true,
							confirmationText: "用户确认删除"
						}, true);
					});
					row.append(st, title, domain, move, del);
					node.appendChild(row);
				}
				return node;
			};
			const openPanel = () => {
				if (panel) return;
				panel = document.createElement("div");
				panel.id = "tn-dsh-panel";
				panel.innerHTML = `
      <div class="tn-head"><strong>TabNexus 工作区</strong><span class="tn-meta">…</span>
        <button class="tn-btn" data-fullscreen title="打开全局工作区">⛶ 全屏</button>
        <button class="tn-btn" data-refresh>刷新</button>
        <button class="tn-btn" data-close>×</button></div>
      <div class="tn-tabs">
        <button class="tn-tab" data-tab="task">任务</button>
        <button class="tn-tab" data-tab="inbox">收件口</button></div>
      <div class="tn-body"><div class="tn-empty">加载中…</div></div>`;
				document.body.appendChild(panel);
				panel.querySelector("[data-refresh]").addEventListener("click", () => void fetchSnapshot());
				panel.querySelector("[data-close]").addEventListener("click", closePanel);
				panel.querySelector("[data-fullscreen]").addEventListener("click", openWorkspace);
				panel.querySelectorAll(".tn-tab").forEach((tab) => {
					tab.addEventListener("click", () => {
						activeTab = tab.dataset.tab === "inbox" ? "inbox" : "task";
						render();
					});
				});
				place();
				fetchSnapshot();
			};
			chip.addEventListener("click", (event) => {
				event.stopPropagation();
				if (panel) closePanel();
				else openPanel();
			});
			document.addEventListener("click", (event) => {
				if (panel && !panel.contains(event.target) && !chip.contains(event.target)) closePanel();
			});
			const onKey = (event) => {
				if (event.key === "Escape") {
					if (workspace) closeWorkspace();
					else closePanel();
				}
			};
			document.addEventListener("keydown", onKey);
			let anchorTimer = null;
			const observer = new MutationObserver(() => {
				if (anchorTimer) clearTimeout(anchorTimer);
				anchorTimer = setTimeout(place, 250);
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			window.addEventListener("resize", place);
			place();
			const panelTimer = setInterval(() => {
				if (panel) fetchSnapshot();
			}, 15e3);
			ctx.effect(() => () => {
				disposed = true;
				clearInterval(panelTimer);
				if (anchorTimer) clearTimeout(anchorTimer);
				if (toastTimer) clearTimeout(toastTimer);
				observer.disconnect();
				window.removeEventListener("resize", place);
				document.removeEventListener("keydown", onKey);
				closeWorkspace();
				closePanel();
				chip.remove();
				style.remove();
			}, "tabnexus: workspace panel");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map