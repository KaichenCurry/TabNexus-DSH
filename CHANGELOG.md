# Changelog

## 0.4.4

- Restored reliable one-click use by running the shared DSH Web/Desktop service through a recoverable macOS LaunchAgent.
- Removed DSH composer injection so local organization no longer triggers missing Agent tools or depends on model quota.
- Reduced visible sync latency from three seconds to a guarded 0.9-second refresh without overlapping requests.
- Replaced plain category text with clear, editable colored tags that match the DSH visual hierarchy.

## 0.4.3

- Added a macOS double-click installer that installs, restarts, checks, and opens DSH in one pass.
- Bundled and auto-started a UI-only local Chrome relay, so no separate bridge command is required.
- Restyled the native details panel to match DSH spacing, hierarchy, controls, and list density.
- Replaced the large blue organize button with a quiet DSH toolbar action.
- Replaced always-visible per-row selects with on-demand category editing.

## 0.4.2

- Preserved SPA hash routes so distinct open tabs no longer overwrite each other's category.
- Made explicit category lists authoritative instead of silently inventing extra categories.

## 0.4.1

- Fixed the desktop/Web panel getting stuck in an invisible persisted-open state after a client reload.
- Kept the native top-right TabNexus button visible as a reliable open/close toggle.
- Verified the deployed Chrome extension directory instead of assuming the source checkout was the active extension.

## 0.4.0

- Rebuilt the product around the current Chrome window instead of a separate task database.
- Replaced the floating pill and glass card with a small top-right icon and DSH's native adaptive details column.
- Added live Chrome tab sync, search, tab focus, favicon/title/domain/pinned/active states.
- Added free-form one-click organization, editable proposals, DSH composer review, and manual categories.
- Removed the flow view and expanded workspace.
- Added a loopback-only Host proxy without Agent tools, MCP configuration, model APIs, or API keys.

## 0.3.0

- Reframed TabNexus-DSH as a small client-only task manager.
- Added task goals, categories, webpage notes, and Todo / In progress / Done states.
- Added category and simple three-stage flow views.
- Added the official `shell.overlay` capsule, glass Dock, expanded workspace, and responsive layout.
- Added local-only persistence and normalized HTTP(S) URL deduplication.
- Removed Agent tools, MCP integration, Host APIs, SSE, session bindings, Skills, and presets.
