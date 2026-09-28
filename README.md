# Git Worktree

A native DSH plugin. It puts a Git worktree browser in a right-sidebar tab of the
Harness Web UI: the current workspace's worktrees, branches, a paged commit
graph, commit and uncommitted details, and guarded worktree/rebase/cherry-pick
actions. The tab follows the calling Session's workspace.

## Layout

| Path | Role |
| --- | --- |
| `src/index.ts` | Host half — the same-origin HTTP route and its Git payloads |
| `src/client.ts` | Browser half — the right-sidebar tab registration and transport |
| `src/core/` | Git core: fixed-argument `execFile` bindings, worktree/ref/graph/diff readers, history operations |
| `src/ui/worktree.ts` | React panel and its `--gw-*` theme variables |
| `lib/index.js`, `lib/client.js` | Built host and browser halves; committed |
| `scripts/build.mjs` | esbuild bundling of both halves |
| `cordis.patch.yml` | The one Loader row this plugin inserts |

`lib/` is build output. Edit `src/`, then rebuild and commit both.

## Build

Requires Node 20+ and Git:

```sh
npm install
npm run check   # typecheck, then build
```

`npm run build` writes `lib/index.js` and `lib/client.js`. The manifest declares
no runtime dependencies, so an install fetches and builds nothing.

After rebuilding the **host** half, restart Harness. A plugin reload re-imports
`lib/index.js` from cache, so `apply()` does not re-run and the HTTP route keeps
its old value; only a new process registers the new one. The browser half is
re-read on page load, so a reload is enough there.

## Install

Install this directory as a bundle through the `plugin_manager` tool
(`action: install_bundle`, `target: <this repository>`). Then add it to the
profile's enable list — `dsh.profile.bundles` in `<profile>/package.json` — or it
will not load after a restart:

```json
"bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "@JinzhaoTian/git-worktree-graph"]
```

With `patchReload: "live"` the running Host picks the change up. Confirm with
`plugin_manager list_plugins`: an `include:git-worktree-graph` row for
`@JinzhaoTian/git-worktree-graph` with `fiberPhase: "active"`.

## Use

- Open the tab from the tab strip's `+` guide, or its `Git Worktree` card.
- The toolbar names the worktree the Session sits in; refresh re-reads worktrees
  and status. The dot is amber while dirty, green when clean, and the error
  colour when the Host could not read it.
- Rows draw the worktree chip and local branches only. Expanding a commit or the
  uncommitted row shows metadata plus a changed-file tree; the file list is
  capped and scrolls on its own. `Show Remote Branches` scopes the graph walk.
- Guarded writes create a worktree or rebase/cherry-pick after a preview and an
  Apply. A preview changes nothing; its plan expires after five minutes, can be
  attempted once, and is rechecked against the branch, HEAD and target.
- The panel never checks out a branch and never changes the Session's working
  directory.

## Route

The host half owns Git and registers `/git-worktree-graph/api` on the Web GUI's own
server, so the tab reads the same origin — no token, no CORS, no second port.

Reads are `GET /git-worktree-graph/api/<action>`: `worktrees`, `graph`, `diff`,
`commit`, `uncommitted`. Writes are `POST` with a JSON body: `worktree-create`,
`rebase-preview`, `rebase-apply`, `cherry-pick-preview`, `cherry-pick-apply`. A
write is refused with 403 when it names another origin and 415 when it does not
declare `application/json`. Every Git bind is a fixed argument array through
`execFile`; a Git failure returns `{ "ok": false, "error": "…" }` with HTTP 200,
because the tab renders it inline.

## Limits

- Merge and commit are not implemented; rebase and cherry-pick are.
- The graph is a deterministic lane layout drawn as row-local SVG, newest →
  oldest; appending a page never moves a row that is already drawn.
