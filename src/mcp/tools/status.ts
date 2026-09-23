import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitStatus } from "../../shared/types.js";
import { failure, git, result, selectedWorktree } from "../git.js";

export async function getStatus(repoPath: string | undefined, worktreePath: string): Promise<GitStatus> {
  const worktree = await selectedWorktree(repoPath, worktreePath);
  const porcelain = await git(worktree.path, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const records = porcelain.split("\0").filter(Boolean);
  let entries = 0;
  for (let i = 0; i < records.length; i++) {
    entries++;
    if (/^[RC]/.test(records[i]) || /^[RC]/.test(records[i].slice(1, 2))) i++;
  }
  return { path: worktree.path, dirty: entries > 0, entries, branch: worktree.branch, head: worktree.head };
}

export function registerStatusTool(server: McpServer): void {
  server.registerTool("git_status", {
    title: "Get worktree status",
    description: "Return whether the selected worktree has staged, unstaged, or untracked changes.",
    inputSchema: { repoPath: z.string().optional(), worktreePath: z.string().min(1) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ repoPath, worktreePath }) => {
    try { return result(await getStatus(repoPath, worktreePath)); }
    catch (error) { return failure(error); }
  });
}
