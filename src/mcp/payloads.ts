/**
 * The MCP host's payload readers.
 *
 * Each one resolves the repository the caller named and then answers with the
 * shared contract from `src/core/types.ts` — the same payloads the DSH host's
 * HTTP route answers with, so one view can be mounted in either container.
 */
import { commitDetailPayload as readCommitDetail, diffPayload as readDiff, uncommittedPayload as readUncommitted } from "../core/diff.js";
import { graphPayload as readGraph, type GraphQuery } from "../core/graph.js";
import { worktreesPayload as readWorktrees } from "../core/worktrees.js";
import { repoRoot } from "./git.js";
import type { CommitDetailPayload, DiffPayload, GraphPayload, UncommittedPayload, WorktreesPayload } from "../core/types.js";

/** Worktrees, their branches, dirty state and HEAD subjects. */
export async function worktreesPayload(repoPath?: string): Promise<WorktreesPayload> {
  return readWorktrees(await repoRoot(repoPath));
}

/** What one graph read asks for, addressed the way an MCP tool call is. */
export interface GraphParams {
  repoPath?: string;
  worktreePath?: string;
  scope?: string | null;
  branch?: string | null;
  includeRemote?: boolean;
  limit?: number | null;
  skip?: number | null;
}

/** One page of the commit graph. */
export async function graphPayload(params: GraphParams): Promise<GraphPayload> {
  const query: GraphQuery = {
    worktree: params.worktreePath ?? null,
    scope: params.scope ?? null,
    branch: params.branch ?? null,
    includeRemote: params.includeRemote !== false,
    limit: params.limit ?? Number.NaN,
    skip: params.skip ?? 0,
    defaultLimit: 150,
  };
  return readGraph(await repoRoot(params.repoPath), query);
}

/** One commit's metadata and changed-file stats. */
export async function commitDetailPayload(repoPath: string | undefined, oid: string): Promise<CommitDetailPayload> {
  return readCommitDetail(await repoRoot(repoPath), oid);
}

/** The working tree's own changes, structured rather than as a patch. */
export async function uncommittedPayload(repoPath: string | undefined, worktreePath?: string): Promise<UncommittedPayload> {
  return readUncommitted(await repoRoot(repoPath), worktreePath ?? null);
}

/** The working tree's changes as a stat plus a patch. */
export async function diffPayload(repoPath: string | undefined, worktreePath?: string): Promise<DiffPayload> {
  return readDiff(await repoRoot(repoPath), worktreePath ?? null);
}
