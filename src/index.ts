import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";

/**
 * TabNexus-DSH is intentionally client-only. DeepSeek Harness already owns the
 * Agent runtime; this plugin only contributes a local task-management surface.
 */
export const name = "tabnexus";
export const inject: string[] = [];

export interface Config {}
export const Config: z<Config> = z.object({});

export function apply(_ctx: Context, _config: Config): void {
  // No Host API, MCP tool, web route, or Agent bridge is registered here.
}
