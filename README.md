# Git Worktree Graph for Codex

Local MCP plugin for browsing Git worktrees and their commit ancestry. The graph UI is a React MCP App rendered through the host's JSON-RPC `postMessage` bridge. Right-click a commit to preview rebase or cherry-pick, then confirm an expiring one-use plan.

## Files

| Path | Purpose |
| --- | --- |
| `plugin.json`, `mcp.json` | Portable plugin identity and local stdio MCP server |
| `.codex-plugin/plugin.json`, `.mcp.json` | Codex compatibility manifest and MCP configuration |
| `src/server.ts` | MCP server and UI resource registration |
| `src/browser.ts` | Loopback HTTP host for a Codex right-side browser tab |
| `src/mcp/git.ts` | `execFile("git", args)` wrapper, repository checks, parsers |
| `src/mcp/tools/worktrees.ts` | List and create worktrees |
| `src/mcp/tools/status.ts` | Dirty status |
| `src/mcp/tools/log.ts` | Commit DAG, edges, and refs |
| `src/mcp/tools/operations.ts` | Preview/apply rebase and cherry-pick |
| `src/shared/types.ts` | Shared data contracts |
| `src/ui/GraphApp.tsx`, `src/ui/styles.css` | Shared React/D3 graph and action dialogs |
| `src/ui/index.tsx`, `src/ui/browser.tsx` | MCP App and browser-tab entrypoints |
| `scripts/build.mjs`, `tsconfig.*.json` | Build configuration |
| `skills/git-graph/SKILL.md` | Agent workflow |

## Build and run

Requires Node 20+ and Git. Run `npm install`, then `npm run build`. The bundled MCP config launches `node ${PLUGIN_ROOT}/dist/server.js`. Invoke `git_worktree_list` with `repoPath` pointing to the repository to open the UI. For direct stdio use, set `GIT_WORKTREE_REPO` to a repository path before starting the server, or pass `repoPath` to each read tool.

The graph shows the selected worktree's HEAD ancestry (up to 150 commits in the UI), so switching worktrees changes the displayed history. The repository's branches and tags are returned as refs. Worktree selection in the UI changes the view; it does not run `git checkout` or switch Codex's task checkout.

## Open in the Codex right-side tab

Run `npm run build`, then `npm run browser -- --repo /absolute/path/to/repository`. The command prints a loopback URL such as `http://127.0.0.1:PORT/?session=...` and keeps serving while the process runs. Ask Codex to open that URL in the current task's right-side browser tab. The tab uses the same React graph as the MCP App and a local JSON API backed by the same Git functions. The server binds only to `127.0.0.1`, fixes the repository at startup, and requires a random session token on API calls. Keep the server running while the tab is open.

This is a task tab beside file and review tabs. It does not install a permanent sidebar view or automatically follow Codex task changes.

MCP Apps attach UI to tool results. A host can show it in a side panel, but a permanently docked Codex right sidebar is not exposed by the documented plugin API. The server tools also work without UI.

## History operations

`git_rebase_preview` and `git_cherry_pick_preview` require a clean worktree and return a one-use `planId` expiring in five minutes. The matching apply tool requires `confirm: true`, rechecks the worktree branch, HEAD, and target ref, then runs Git with argument arrays. If Git reports conflicts, the operation remains in that worktree for manual resolution. Merge commits are rejected for cherry-pick because they require a mainline choice.

All Git calls use `child_process.execFile` with fixed argument arrays. No shell command strings are used.
