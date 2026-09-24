/**
 * The history-operation tools.
 *
 * The plans, the readiness checks and the apply-time rechecks all live in
 * `src/core/operations.ts`, which the DSH bundle's own controls drive as well;
 * this file is only the MCP surface over them — the tool names, schemas and
 * descriptions a Codex session calls.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OperationPreview } from "../../core/types.js";
import {
  applyPlan as applyStoredPlan,
  previewCherryPick as planCherryPick,
  previewRebase as planRebase,
} from "../../core/operations.js";
import { failure, repoRoot, result } from "../git.js";

/** Plan a rebase of the named worktree onto `target`. */
export async function previewRebase(repoPath: string | undefined, worktreePath: string, target: string): Promise<OperationPreview> {
  return planRebase(await repoRoot(repoPath), worktreePath, target);
}

/** Plan a cherry-pick of one non-merge commit into the named worktree. */
export async function previewCherryPick(repoPath: string | undefined, worktreePath: string, commit: string): Promise<OperationPreview> {
  return planCherryPick(await repoRoot(repoPath), worktreePath, commit);
}

export { applyStoredPlan as applyPlan };

export function registerOperationTools(server: McpServer): void {
  server.registerTool("git_rebase_preview", {
    title: "Preview rebase",
    description: "Preview rebasing the selected clean worktree branch onto target. Returns an expiring planId; does not change Git state.",
    inputSchema: { repoPath: z.string().optional(), worktreePath: z.string().min(1), target: z.string().min(1) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ repoPath, worktreePath, target }) => {
    try { return result(await previewRebase(repoPath, worktreePath, target)); }
    catch (error) { return failure(error); }
  });

  server.registerTool("git_rebase_apply", {
    title: "Apply previewed rebase",
    description: "Apply a rebase only with a valid unexpired planId from git_rebase_preview and explicit confirm=true.",
    inputSchema: { planId: z.string().uuid(), confirm: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
  }, async ({ planId, confirm }) => {
    try { return result(await applyStoredPlan("rebase", planId, confirm)); }
    catch (error) { return failure(error); }
  });

  server.registerTool("git_cherry_pick_preview", {
    title: "Preview cherry-pick",
    description: "Preview cherry-picking one non-merge commit into a clean worktree. Returns an expiring planId; does not change Git state.",
    inputSchema: { repoPath: z.string().optional(), worktreePath: z.string().min(1), commit: z.string().min(1) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ repoPath, worktreePath, commit }) => {
    try { return result(await previewCherryPick(repoPath, worktreePath, commit)); }
    catch (error) { return failure(error); }
  });

  server.registerTool("git_cherry_pick_apply", {
    title: "Apply previewed cherry-pick",
    description: "Apply a cherry-pick only with a valid unexpired planId from git_cherry_pick_preview and explicit confirm=true.",
    inputSchema: { planId: z.string().uuid(), confirm: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
  }, async ({ planId, confirm }) => {
    try { return result(await applyStoredPlan("cherry-pick", planId, confirm)); }
    catch (error) { return failure(error); }
  });
}
