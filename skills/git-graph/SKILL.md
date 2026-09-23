---
name: git-graph
description: Inspect local Git worktrees and commit history with a graph, and preview rebase or cherry-pick when the user asks to change history.
---

# Git Worktree Graph

Use `git_worktree_list` with `repoPath` set to the repository or a worktree path. Its result opens the graph UI in hosts that support MCP Apps. Use `git_log_graph` for a specific worktree's HEAD ancestry, and `git_status` for its dirty state. If the server starts outside the repository, pass `repoPath` explicitly or set `GIT_WORKTREE_REPO` for the server.

When the user asks to open the graph in a Codex desktop right-side tab, build this plugin, start `npm run browser -- --repo <absolute repository path>`, and open the printed loopback URL as a browser tab in the calling task's right panel with `open_in_codex` when that app tool is available. Keep the process running while the tab is in use. The tab's selected worktree is view state; changing it does not switch the Codex task's checkout.

For rebase or cherry-pick, call the corresponding `*_preview` tool first. Show the target, branch, affected commits, warnings, and expiry to the user. Call `*_apply` only after the user confirms that concrete preview, using its `planId` and `confirm: true`. A plan expires after five minutes and can be applied once. If the worktree, branch, HEAD, or target ref changes, request a new preview.

If Git stops for a conflict, explain the worktree path and Git's `--continue` or `--abort` commands. Do not claim the operation completed until the apply tool reports success.
