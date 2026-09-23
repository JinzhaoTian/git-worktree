import { resolve, isAbsolute } from "node:path";
import { mkdir, realpath } from "node:fs/promises";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { commitOid, failure, git, listWorktrees, repoRoot, result } from "../git.js";

export async function createWorktree(repoPath: string | undefined, path: string, branch: string, startPoint = "HEAD") {
  const root = await repoRoot(repoPath);
  if (branch.startsWith("-")) throw new Error("Branch cannot start with '-'.");
  await git(root, ["check-ref-format", "--branch", branch]);
  const oid = await commitOid(root, startPoint);
  const target = isAbsolute(path) ? resolve(path) : resolve(root, path);
  await mkdir(resolve(target, ".."), { recursive: true });
  await git(root, ["worktree", "add", "-b", branch, target, oid], 120_000);
  return { created: true, path: await realpath(target), branch, head: oid };
}

export function registerWorktreeTools(server: McpServer, graphUri: string): void {
  registerAppTool(server, "git_worktree_list", {
    title: "List Git worktrees and open graph",
    description: "List all worktrees in a repository and open the interactive commit graph UI. Pass repoPath when the server's working directory is not the target repository.",
    inputSchema: { repoPath: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: graphUri } }
  }, async ({ repoPath }) => {
    try { return result(await listWorktrees(repoPath)); }
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
