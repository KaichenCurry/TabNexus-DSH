#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.TABNEXUS_BRIDGE_PORT || "43120", 10);
const VERSION = "0.4.4";
const MAX_MESSAGE_BYTES = 512 * 1024;
const MAX_BODY_BYTES = 32 * 1024;
const ALLOWED_TOOLS = new Set(["read_tab_workbench", "manage_tab_workbench"]);

let extensionSocket = null;
const pending = new Map();

function json(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
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
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("请求不是有效 JSON"));
      }
    });
    request.on("error", reject);
  });
}

function encodeFrame(value, opcode = 0x1) {
  const payload = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  if (payload.length > MAX_MESSAGE_BYTES) throw new Error("Chrome 同步消息过大");
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]);
  if (payload.length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

function send(socket, message) {
  if (!socket || socket.destroyed) throw new Error("TabNexus Chrome 扩展未连接");
  socket.write(encodeFrame(JSON.stringify(message)));
}

function rejectPending(message) {
  for (const [requestId, item] of pending) {
    clearTimeout(item.timer);
    item.reject(new Error(message));
    pending.delete(requestId);
  }
}

function handleExtensionMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.type === "keepalive") {
    if (extensionSocket) send(extensionSocket, { type: "keepalive_ack", at: Date.now() });
    return;
  }
  if (message.type !== "agent_tool_result" || typeof message.requestId !== "string") return;
  const item = pending.get(message.requestId);
  if (!item) return;
  pending.delete(message.requestId);
  clearTimeout(item.timer);
  if (message.ok === true) item.resolve(message.data);
  else item.reject(new Error(typeof message.error === "string" ? message.error : "Chrome 操作失败"));
}

function attachParser(socket) {
  let buffer = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const first = buffer[0];
      const second = buffer[1];
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        const wide = buffer.readBigUInt64BE(2);
        if (wide > BigInt(MAX_MESSAGE_BYTES)) return socket.destroy();
        length = Number(wide);
        offset = 10;
      }
      const maskBytes = masked ? 4 : 0;
      if (buffer.length < offset + maskBytes + length) return;
      const mask = masked ? buffer.subarray(offset, offset + 4) : null;
      offset += maskBytes;
      const payload = Buffer.from(buffer.subarray(offset, offset + length));
      buffer = buffer.subarray(offset + length);
      if (mask) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
      if (opcode === 0x8) {
        socket.end(encodeFrame(payload, 0x8));
        return;
      }
      if (opcode === 0x9) {
        socket.write(encodeFrame(payload, 0xA));
        continue;
      }
      if (opcode !== 0x1) continue;
      try { handleExtensionMessage(JSON.parse(payload.toString("utf8"))); } catch { /* Ignore malformed local messages. */ }
    }
  });
}

function callExtension(tool, args = {}) {
  if (!ALLOWED_TOOLS.has(tool)) return Promise.reject(new Error("该操作不属于 DSH 标签管理器"));
  return new Promise((resolve, reject) => {
    if (!extensionSocket || extensionSocket.destroyed) {
      reject(new Error("TabNexus Chrome 扩展未连接。打开一次扩展后会自动重连。"));
      return;
    }
    const requestId = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error("Chrome 响应超时"));
    }, 3_000);
    pending.set(requestId, { resolve, reject, timer });
    try {
      send(extensionSocket, {
        type: "agent_tool_request",
        requestId,
        agentId: "tabnexus-dsh",
        agentName: "TabNexus DSH",
        payload: { tool, ...(Object.keys(args).length ? { input: args } : {}) }
      });
    } catch (error) {
      clearTimeout(timer);
      pending.delete(requestId);
      reject(error);
    }
  });
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    json(response, extensionSocket ? 200 : 503, {
      ok: Boolean(extensionSocket),
      server: "tabnexus-dsh-relay",
      version: VERSION,
      mode: "ui-only",
      chromeConnected: Boolean(extensionSocket)
    });
    return;
  }
  if (request.method === "POST" && request.url === "/ui/call" && request.headers["x-tabnexus-dsh"] === "0.4") {
    try {
      const body = await readJson(request);
      if (typeof body.tool !== "string" || !ALLOWED_TOOLS.has(body.tool)) {
        json(response, 400, { ok: false, error: "DSH 仅允许读取与聚焦浏览器标签" });
        return;
      }
      json(response, 200, { ok: true, data: await callExtension(body.tool, body.args ?? {}) });
    } catch (error) {
      json(response, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.on("upgrade", (request, socket) => {
  const key = request.headers["sec-websocket-key"];
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : "";
  if (request.url !== "/tabnexus-dsh" || (origin && !origin.startsWith("chrome-extension://")) || typeof key !== "string") {
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    return;
  }
  const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Accept: ${accept}`, "\r\n"].join("\r\n"));
  extensionSocket?.destroy();
  extensionSocket = socket;
  socket.setNoDelay(true);
  attachParser(socket);
  socket.on("close", () => {
    if (extensionSocket !== socket) return;
    extensionSocket = null;
    rejectPending("TabNexus Chrome 扩展已断开");
  });
  socket.on("error", () => { if (extensionSocket === socket) extensionSocket = null; });
  send(socket, {
    type: "bridge_ready",
    transport: "agent_websocket",
    hostVersion: VERSION,
    agentName: "TabNexus DSH",
    agents: [{ id: "tabnexus-dsh", name: "TabNexus DSH", version: VERSION, toolCount: 0 }]
  });
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") process.exit(0);
  process.stderr.write(`[TabNexus DSH] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

server.listen(PORT, HOST);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
