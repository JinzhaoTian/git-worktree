import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { listWorktrees, repoRoot } from "./mcp/git.js";
import { createWorktree } from "./mcp/tools/worktrees.js";
import { getStatus } from "./mcp/tools/status.js";
import { getGraph } from "./mcp/tools/log.js";
import { previewRebase, previewCherryPick, applyPlan } from "./mcp/tools/operations.js";

const HOST = "127.0.0.1";
const MAX_BODY = 64 * 1024;
const requestSchema = z.object({
  name: z.enum([
    "git_worktree_list", "git_worktree_create", "git_status", "git_log_graph",
    "git_rebase_preview", "git_rebase_apply", "git_cherry_pick_preview", "git_cherry_pick_apply"
  ]),
  arguments: z.record(z.string(), z.unknown()).default({})
});

function sameToken(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error("Request body exceeds 64 KiB.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function send(response: ServerResponse, status: number, contentType: string, body: string | Buffer): void {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  });
  response.end(body);
}

async function dispatch(repoPath: string, name: string, raw: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "git_worktree_list":
      return listWorktrees(repoPath);
    case "git_worktree_create": {
      const args = z.object({ path: z.string().min(1), branch: z.string().min(1), startPoint: z.string().default("HEAD") }).parse(raw);
      return createWorktree(repoPath, args.path, args.branch, args.startPoint);
    }
    case "git_status": {
      const args = z.object({ worktreePath: z.string().min(1) }).parse(raw);
      return getStatus(repoPath, args.worktreePath);
    }
    case "git_log_graph": {
      const args = z.object({ worktreePath: z.string().min(1), limit: z.number().int().min(1).max(500).default(150) }).parse(raw);
      return getGraph(repoPath, args.worktreePath, args.limit);
    }
    case "git_rebase_preview": {
      const args = z.object({ worktreePath: z.string().min(1), target: z.string().min(1) }).parse(raw);
      return previewRebase(repoPath, args.worktreePath, args.target);
    }
    case "git_cherry_pick_preview": {
      const args = z.object({ worktreePath: z.string().min(1), commit: z.string().min(1) }).parse(raw);
      return previewCherryPick(repoPath, args.worktreePath, args.commit);
    }
    case "git_rebase_apply":
    case "git_cherry_pick_apply": {
      const args = z.object({ planId: z.string().uuid(), confirm: z.literal(true) }).parse(raw);
      return applyPlan(name === "git_rebase_apply" ? "rebase" : "cherry-pick", args.planId, args.confirm);
    }
    default:
      throw new Error("Unknown Git tool.");
  }
}

export async function startBrowserServer(options: { repoPath: string; port?: number }) {
  const root = await repoRoot(options.repoPath);
  const dist = dirname(fileURLToPath(import.meta.url));
  const [script, style] = await Promise.all([
    readFile(join(dist, "ui-browser.js")),
    readFile(join(dist, "ui-browser.css"))
  ]);
  const html = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Git Worktree Graph</title><link rel=\"stylesheet\" href=\"/ui-browser.css\"></head><body><div id=\"root\"></div><script defer src=\"/ui-browser.js\"></script></body></html>";
  const token = randomBytes(32).toString("base64url");
  let port = 0;
  const server = createHttpServer(async (request, response) => {
    const origin = `http://${HOST}:${port}`;
    if (request.headers.host !== `${HOST}:${port}`) {
      send(response, 403, "text/plain; charset=utf-8", "Invalid host.");
      return;
    }
    const path = new URL(request.url || "/", origin);
    try {
      if (request.method === "GET" && path.pathname === "/" && sameToken(path.searchParams.get("session") || undefined, token)) {
        send(response, 200, "text/html; charset=utf-8", html);
        return;
      }
      if (request.method === "GET" && path.pathname === "/" && !path.searchParams.has("session")) {
        // Reloads use the token saved in this tab's sessionStorage.
        send(response, 200, "text/html; charset=utf-8", html);
        return;
      }
      if (request.method === "GET" && path.pathname === "/ui-browser.js") {
        send(response, 200, "text/javascript; charset=utf-8", script);
        return;
      }
      if (request.method === "GET" && path.pathname === "/ui-browser.css") {
        send(response, 200, "text/css; charset=utf-8", style);
        return;
      }
      if (request.method === "POST" && path.pathname === "/api/tool") {
        if (!sameToken(request.headers["x-session-token"] as string | undefined, token) || (request.headers.origin && request.headers.origin !== origin)) {
          send(response, 403, "application/json; charset=utf-8", JSON.stringify({ error: "Invalid browser session." }));
          return;
        }
        const payload = requestSchema.parse(await readJson(request));
        const data = await dispatch(root, payload.name, payload.arguments);
        send(response, 200, "application/json; charset=utf-8", JSON.stringify({ data }));
        return;
      }
      send(response, 404, "text/plain; charset=utf-8", "Not found.");
    } catch (error) {
      send(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, HOST, () => { server.off("error", reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not determine browser port.");
  port = address.port;
  return {
    url: `http://${HOST}:${port}/?session=${token}`,
    port,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const repoIndex = process.argv.indexOf("--repo");
  const portIndex = process.argv.indexOf("--port");
  const repoPath = repoIndex >= 0 ? process.argv[repoIndex + 1] : process.cwd();
  const requestedPort = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 0;
  if (!repoPath || !Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    console.error("Usage: node dist/browser.js [--repo PATH] [--port 0-65535]");
    process.exitCode = 1;
  } else {
    startBrowserServer({ repoPath, port: requestedPort }).then(({ url }) => {
      console.log(url);
    }).catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}
