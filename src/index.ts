import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";

export const name = "tabnexus";
export const inject: string[] = ["webServer"];

export interface Config {
  bridgeHost?: string;
  bridgePort?: number;
}

export const Config: z<Config> = z.object({
  bridgeHost: z.string().default("127.0.0.1"),
  bridgePort: z.number().default(43120)
});

interface RouteHost {
  register(spec: {
    kind: "exact" | "prefix";
    path: string;
    handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
  }): () => void;
}

interface BrowserAction {
  action?: unknown;
  tabId?: unknown;
  revision?: unknown;
}

const MAX_BODY_BYTES = 16_384;

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function readJson(request: IncomingMessage): Promise<BrowserAction> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("请求内容过大"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as BrowserAction);
      } catch {
        reject(new Error("请求不是有效 JSON"));
      }
    });
    request.on("error", reject);
  });
}

async function brokerCall(baseUrl: string, tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${baseUrl}/ui/call`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tabnexus-dsh": "0.4"
      },
      body: JSON.stringify({
        agentId: "tabnexus-dsh-ui",
        agentName: "TabNexus DSH UI",
        agentVersion: "0.4.4",
        toolCount: 0,
        tool,
        args
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null) as { ok?: boolean; data?: unknown; error?: string } | null;
    if (!response.ok || !payload || payload.ok !== true) {
      throw new Error(payload?.error || `Chrome 桥返回 HTTP ${response.status}`);
    }
    return payload.data;
  } finally {
    clearTimeout(timer);
  }
}

async function relayExists(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 700);
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal, cache: "no-store" });
    return response.status === 200 || response.status === 503;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function startBundledRelay(baseUrl: string, port: number): Promise<ChildProcess | null> {
  if (await relayExists(baseUrl)) return null;
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const relayPath = resolve(packageRoot, "bridge", "tabnexus-relay.mjs");
  const child = spawn(process.execPath, [relayPath], {
    env: { ...process.env, TABNEXUS_BRIDGE_PORT: String(port) },
    stdio: "ignore"
  });
  child.unref();
  return child;
}

function safeBridgeBase(config: Config): string {
  const host = config.bridgeHost?.trim() || "127.0.0.1";
  const port = Number(config.bridgePort ?? 43120);
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error("Chrome 桥只允许使用本机地址");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("Chrome 桥端口无效");
  return `http://${host}:${port}`;
}

/**
 * The Host only proxies the existing local Chrome bridge to the DSH panel.
 * It does not register Agent tools, MCP servers, model APIs, or persistence.
 */
export function apply(ctx: Context, config: Config): void {
  const host = (ctx as Context & { webServer: RouteHost }).webServer;
  const bridgeBase = safeBridgeBase(config);
  const bridgePort = Number(config.bridgePort ?? 43120);
  let relayProcess: ChildProcess | null = null;
  let disposed = false;

  void startBundledRelay(bridgeBase, bridgePort).then((child) => {
    if (!child) return;
    if (disposed) child.kill();
    else relayProcess = child;
  });

  ctx.effect(() => () => {
    disposed = true;
    if (relayProcess && !relayProcess.killed) relayProcess.kill();
    relayProcess = null;
  }, "tabnexus: bundled Chrome relay");

  ctx.effect(() => host.register({
    kind: "exact",
    path: "/plugins/tabnexus/chrome-tabs",
    handler: async (request, response) => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        json(response, 405, { ok: false, code: "method_not_allowed", error: "仅支持 GET" });
        return;
      }
      try {
        const result = await brokerCall(bridgeBase, "read_tab_workbench");
        if (request.method === "HEAD") {
          response.writeHead(204, { "cache-control": "no-store" });
          response.end();
          return;
        }
        json(response, 200, { ok: true, data: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        json(response, 503, {
          ok: false,
          code: "chrome_unavailable",
          error: message.includes("fetch failed") || message.includes("aborted")
            ? "未连接 TabNexus Chrome 扩展。请先打开扩展并启用本地桥。"
            : message
        });
      }
    }
  }), "tabnexus: Chrome tab snapshot");

  ctx.effect(() => host.register({
    kind: "exact",
    path: "/plugins/tabnexus/chrome-action",
    handler: async (request, response) => {
      if (request.method !== "POST") {
        json(response, 405, { ok: false, code: "method_not_allowed", error: "仅支持 POST" });
        return;
      }
      try {
        const body = await readJson(request);
        if (body.action !== "focus" || !Number.isInteger(body.tabId) || typeof body.revision !== "string") {
          json(response, 400, { ok: false, code: "validation", error: "action、tabId 与 revision 无效" });
          return;
        }
        const result = await brokerCall(bridgeBase, "manage_tab_workbench", {
          expectedRevision: body.revision,
          operationId: `dsh-focus-${randomUUID()}`,
          actions: [{ type: "focus_tab", tabId: body.tabId }]
        });
        json(response, 200, { ok: true, data: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        json(response, message.includes("changed") ? 409 : 503, {
          ok: false,
          code: message.includes("changed") ? "conflict" : "chrome_unavailable",
          error: message
        });
      }
    }
  }), "tabnexus: Chrome tab actions");
}
