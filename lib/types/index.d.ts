import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
/**
 * TabNexus-DSH is intentionally client-only. DeepSeek Harness already owns the
 * Agent runtime; this plugin only contributes a local task-management surface.
 */
export declare const name = "tabnexus";
export declare const inject: string[];
export interface Config {
}
export declare const Config: z<Config>;
export declare function apply(_ctx: Context, _config: Config): void;
