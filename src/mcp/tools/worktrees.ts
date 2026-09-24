import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { failure, repoRoot, result } from "../git.js";
import { createWorktree as createInCore } from "../../core/operations.js";
import { worktreesPayload } from "../payloads.js";

/** Create a branch and a worktree for it. The Git work itself is shared core code. */
export async function createWorktree(repoPath: string | undefined, path: string, branch: string, startPoint = "HEAD") {
  return createInCore(await repoRoot(repoPath), path, branch, startPoint);
}

export function registerWorktreeTools(server: McpServer, graphUri: string): void {
  registerAppTool(server, "git_worktree_list", {
    title: "List Git worktrees and open graph",
    description: "List all worktrees in a repository and open the interactive commit graph UI. Pass repoPath when the server's working directory is not the target repository.",
    inputSchema: { repoPath: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: graphUri } }
  }, async ({ repoPath }) => {
    try { return result(await worktreesPayload(repoPath)); }
    catch (error) { return failure(error); }
  });

  server.registerTool("git_worktree_create", {
    title: "Create Git worktree",
    description: "Create a new branch and worktree from a commit or ref in the selected repository.",
    inputSchema: {
      repoPath: z.string().optional(),
      path: z.string().min(1),
      branch: z.string().min(1),
      startPoint: z.string().default("HEAD")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
  }, async ({ repoPath, path, branch, startPoint }) => {
    try { return result(await createWorktree(repoPath, path, branch, startPoint)); }
    catch (error) { return failure(error); }
  });
}
