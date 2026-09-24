/**
 * The MCP host's Git adapter.
 *
 * Every Git command runs through `src/core`, the same code the DSH bundle's host
 * half uses, so the two front ends cannot disagree about what a repository says.
 * What stays here is MCP policy: where an unaddressed repository path comes from
 * (the tool argument, then `GIT_WORKTREE_REPO`, then the process directory) and
 * the MCP result envelope.
 */
import { resolve } from "node:path";
import {
  assertRefName,
  commitOid,
  git,
  repoRoot as coreRepoRoot,
} from "../core/git.js";
import { parseWorktrees, selectActiveWorktree } from "../core/worktrees.js";
import type { Worktree } from "../shared/types.js";

export { assertRefName, commitOid, git, parseWorktrees };

/** The repository path to read, before it is resolved. */
export function repoInput(repoPath?: string): string {
  return resolve(repoPath || process.env.GIT_WORKTREE_REPO || process.cwd());
}

/** The Git root containing the requested path. */
export async function repoRoot(repoPath?: string): Promise<string> {
  return coreRepoRoot(repoInput(repoPath));
}

export async function listWorktrees(repoPath?: string): Promise<{ root: string; worktrees: Worktree[] }> {
  const root = await repoRoot(repoPath);
  return { root, worktrees: parseWorktrees(await git(root, ["worktree", "list", "--porcelain", "-z"])) };
}

/**
 * The named worktree, refusing a path this repository does not hold.
 *
 * Unlike a graph read, a history operation may only act on an active,
 * checked-out worktree, so this uses the strict selection and rejects bare or
 * prunable entries before any command is built.
 */
export async function selectedWorktree(repoPath: string | undefined, worktreePath: string): Promise<Worktree> {
  return selectActiveWorktree(await repoRoot(repoPath), worktreePath);
}

/** The MCP result envelope for a successful tool call. */
export function result<T>(value: T) {
  return { structuredContent: value as Record<string, unknown>, content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

/** The MCP result envelope for a failed tool call, which the model reads as text. */
export function failure(error: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] };
}
