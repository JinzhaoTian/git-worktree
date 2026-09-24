/**
 * The MCP front end's remaining own types.
 *
 * `Worktree` is the shared core's definition rather than a second copy, because
 * the two hosts must read a worktree the same way; the graph, the operation
 * preview and the uncommitted read are all shared payloads too. What is left
 * here is the one shape only the Codex app has: its single-worktree status read.
 */
export type { Worktree } from "../core/types.js";

export interface GitStatus {
  path: string;
  dirty: boolean;
  entries: number;
  branch: string | null;
  head: string;
}
