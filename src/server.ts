import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { registerWorktreeTools } from "./mcp/tools/worktrees.js";
import { registerStatusTool } from "./mcp/tools/status.js";
import { registerLogTool } from "./mcp/tools/log.js";
import { registerOperationTools } from "./mcp/tools/operations.js";

export const GRAPH_UI_URI = "ui://git-worktree/graph-v1.html";

export function createServer(): McpServer {
  const server = new McpServer({ name: "git-worktree", version: "0.1.0" }, {
    instructions: "Use git_worktree_list to open the graph. Rebase and cherry-pick require preview, then a user-confirmed apply with the returned planId within five minutes."
  });

  registerWorktreeTools(server, GRAPH_UI_URI);
  registerStatusTool(server);
  registerLogTool(server);
  registerOperationTools(server);

  registerAppResource(server, "git-worktree-graph", GRAPH_UI_URI,
    { mimeType: RESOURCE_MIME_TYPE }, async () => {
      const dist = dirname(fileURLToPath(import.meta.url));
      const [script, style] = await Promise.all([
        readFile(join(dist, "ui.js"), "utf8"),
        readFile(join(dist, "ui.css"), "utf8")
      ]);
      return {
        contents: [{
          uri: GRAPH_UI_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${style}</style></head><body><div id="root"></div><script>${script}</script></body></html>`,
          _meta: { ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: [] } } }
        }]
      };
    });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createServer();
  server.connect(new StdioServerTransport()).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
