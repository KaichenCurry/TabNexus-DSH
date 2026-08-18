# Changelog

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
