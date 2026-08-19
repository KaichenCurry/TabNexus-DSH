import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
export declare const name = "tabnexus";
export declare const inject: string[];
export interface Config {
    bridgeHost?: string;
    bridgePort?: number;
}
export declare const Config: z<Config>;
/**
 * The Host only proxies the existing local Chrome bridge to the DSH panel.
 * It does not register Agent tools, MCP servers, model APIs, or persistence.
 */
export declare function apply(ctx: Context, config: Config): void;
