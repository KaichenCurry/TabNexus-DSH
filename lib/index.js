import z from "@deepseek-ai/schemastery";
/**
 * TabNexus-DSH is intentionally client-only. DeepSeek Harness already owns the
 * Agent runtime; this plugin only contributes a local task-management surface.
 */
export const name = "tabnexus";
export const inject = [];
export const Config = z.object({});
export function apply(_ctx, _config) {
    // No Host API, MCP tool, web route, or Agent bridge is registered here.
}
