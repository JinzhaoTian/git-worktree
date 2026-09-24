# Git Worktree Graph

Browse Git worktrees and their commit ancestry in either of two containers: a **Codex MCP App** (or loopback browser tab), and a **DSH right-sidebar tab**. Both mount the same panel, read the same payload contract, and share one Git core, so the two cannot drift apart.

Both containers offer the same controls: create a worktree, and right-click a commit to preview a rebase or cherry-pick onto it. Nothing changes history without a preview and an explicit Apply, and every plan expires after five minutes and can be attempted exactly once. The same operations are also MCP tools, so an agent can drive them without the panel. Every Git call is `child_process.execFile` with a fixed argument array; no shell command string is ever assembled from input.

## One view, one core, two containers

```
src/core/          the only place Git is run and parsed
src/ui/worktree.ts the shared panel (worktree list, graph, details)
        │
        ├── src/dsh/    the DSH bundle's halves  → dsh-plugin/index.js, client.js
        └── src/ui/     the Codex MCP app and loopback tab → dist/ui.js, ui-browser.js
```

| Container | How the view reads | Entry point |
| --- | --- | --- |
| Codex MCP App | MCP tools over the app bridge | `src/ui/index.tsx` |
| Codex loopback tab | this project's own token-guarded HTTP route | `src/ui/browser.tsx` |
| DSH right-sidebar tab | the bundle host's same-origin HTTP route | `src/dsh/client.ts` + `src/dsh/host.ts` |

The container is the only difference: the view asks for an action and a set of parameters, and `configureView` supplies the reader. Both readers answer the same payloads, so the panel is identical everywhere. Start with [`dsh-plugin/README.md`](dsh-plugin/README.md) for the DSH bundle.

| Path | Purpose |
| --- | --- |
| `plugin.json`, `mcp.json` | Portable plugin identity and local stdio MCP server |
| `.codex-plugin/plugin.json`, `.mcp.json` | Codex compatibility manifest and MCP configuration |
| `src/core/` | The shared Git core: `execFile` bindings, worktree parsing, refs, the paged graph, numstat/diff readers, and the payload contract |
| `src/ui/worktree.ts` | The shared panel: transport-injected, `h()`-based, one stylesheet |
| `src/ui/transport.ts` | The Codex reader: MCP tool calls mapped onto the view's actions |
| `src/ui/index.tsx`, `src/ui/browser.tsx` | MCP App and browser-tab entrypoints |
| `src/ui/styles.css` | The Codex container's page styles and host theme tokens |
| `src/server.ts` | MCP server and UI resource registration |
| `src/browser.ts` | Loopback HTTP host for a Codex right-side browser tab |
| `src/mcp/` | MCP-only policy and tools: payload readers, status, history operations |
| `src/dsh/host.ts`, `src/dsh/client.ts` | The DSH bundle's host and browser halves |
| `scripts/` | The build targets (`build.mjs`, `build-dsh.mjs`) and the bundle's checks (`verify-dsh.mjs`, `geometry-dsh.mjs`, `lib/cdp.mjs`) |
| `tsconfig.*.json` | Per-target type checking |
| `skills/git-graph/SKILL.md` | Agent workflow |
| `dsh-plugin/` | The DSH bundle directory: the manifest and patch it is installed by, plus its two built halves |

## Build and run

Requires Node 20+ and Git. Run `npm install`, then `npm run build`. That builds everything: the MCP server and both browser bundles into `dist/`, and the DSH bundle's two halves into `dsh-plugin/`. `npm run typecheck` checks all four targets and `npm test` runs the MCP suite.

`dist/` and the DSH bundle's two halves (`dsh-plugin/index.js`, `dsh-plugin/client.js`) are
build output and are not committed; `npm run build` produces both. Everything else under
`src/` and `scripts/` is the source of truth.

Two more checks cover the DSH bundle, and both are cross-platform: `npm run verify` parses the built halves, validates the manifest and patch, and exercises the panel's layout and rendering without a browser; `npm run geometry` renders the real toolbar chip and commit grid in headless Chrome or Edge and measures them. Geometry finds the browser itself (set `GIT_WORKTREE_BROWSER` to point at one) and retries with the renderer sandbox disabled on machines where Chrome's sandbox cannot start, which is otherwise indistinguishable from a hang.

The bundled MCP config launches `node ${PLUGIN_ROOT}/dist/server.js`. Invoke `git_worktree_list` with `repoPath` pointing to the repository to open the UI. For direct stdio use, set `GIT_WORKTREE_REPO` to a repository path before starting the server, or pass `repoPath` to each read tool.

The graph shows the selected worktree's history — every branch by default, or HEAD ancestry alone — up to 150 commits per page. Worktree selection in the UI changes the view; it does not run `git checkout` or switch Codex's task checkout.

## Open in the Codex right-side tab

Run `npm run build`, then `npm run browser -- --repo /absolute/path/to/repository`. The command prints a loopback URL such as `http://127.0.0.1:PORT/?session=...` and keeps serving while the process runs. Ask Codex to open that URL in the current task's right-side browser tab. The tab renders the same shared panel as the MCP App, over a local JSON API backed by the same Git core. The server binds only to `127.0.0.1`, fixes the repository at startup, and requires a random session token on API calls. Keep the server running while the tab is open.

This is a task tab beside file and review tabs. It does not install a permanent sidebar view or automatically follow Codex task changes.

MCP Apps attach UI to tool results. A host can show it in a side panel, but a permanently docked Codex right sidebar is not exposed by the documented plugin API. The server tools also work without UI.

## History operations

`git_rebase_preview` and `git_cherry_pick_preview` require a clean worktree and return a one-use `planId` expiring in five minutes. The matching apply tool requires `confirm: true`, rechecks the worktree branch, HEAD, and target ref, then runs Git with argument arrays. If Git reports conflicts, the operation remains in that worktree for manual resolution. Merge commits are rejected for cherry-pick because they require a mainline choice.

The panel and the tools drive the same code (`src/core/operations.ts`), so the checks cannot differ: an active checked-out branch, a clean tree, no operation already stopped in the worktree, a plan that expires and is attempted at most once, and an apply that re-reads the worktree, its branch, its HEAD and the target before running anything.

The panel's controls are capability-gated rather than container-gated: the view renders them when the transport it was given provides an `operations` surface. Both containers do today, so both get the same menu, preview dialog and create form; a container that provided only reads would get a read-only panel with no trace of them.

On the DSH side the writes travel over the same route as the reads, as `POST` with a JSON body. That route is same-origin and carries no token, so it refuses a write that names another origin and one that does not declare `application/json` — a cross-site request cannot send that content type without a preflight, and the route answers none.
