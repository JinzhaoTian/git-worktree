/**
 * The Codex container's reads.
 *
 * The shared view asks for an action and a set of parameters; this file turns
 * that into the MCP tool call the Codex app can make, translating only the names
 * the two sides spell differently (`repo` → `repoPath`, `worktree` →
 * `worktreePath`, the `remote=0|1` flag → `includeRemote`). The payloads that
 * come back are the same ones the DSH route answers with, so the view cannot
 * tell the two containers apart.
 */
import type { ViewParams, ViewTransport } from "./worktree.js";

/** How a mounted MCP app calls one of its own tools. */
export type ToolCall = <T>(name: string, args: Record<string, unknown>) => Promise<T>;

/** Translate the view's read parameters into an MCP tool's arguments. */
function toolArguments(params: ViewParams | undefined): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'repo') args.repoPath = value;
    else if (key === 'worktree') args.worktreePath = value;
    else if (key === 'remote') args.includeRemote = value !== '0';
    else args[key] = value;
  }
  return args;
}

/**
 * The view's transport over one `call` function.
 *
 * A cancelled read cannot cancel the MCP round trip, so the signal is dropped:
 * the view's own `alive` flag is what keeps a late answer out of its state.
 */
export function mcpTransport(call: ToolCall): ViewTransport {
  return {
    worktrees: (params) => call('git_worktree_list', toolArguments(params)),
    graph: (params) => call('git_log_graph', toolArguments(params)),
    commit: (params) => call('git_commit_detail', toolArguments(params)),
    uncommitted: (params) => call('git_uncommitted', toolArguments(params)),
    diff: (params) => call('git_diff', toolArguments(params)),
    // Codex can change history, so its panel gets the write controls. Every one
    // of these goes through the same preview-then-apply plans the tools use.
    operations: {
      createWorktree: (params) => call('git_worktree_create', toolArguments(params)),
      rebasePreview: (params) => call('git_rebase_preview', toolArguments(params)),
      rebaseApply: (params) => call('git_rebase_apply', toolArguments(params)),
      cherryPickPreview: (params) => call('git_cherry_pick_preview', toolArguments(params)),
      cherryPickApply: (params) => call('git_cherry_pick_apply', toolArguments(params)),
    },
  };
}
