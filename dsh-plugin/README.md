# Git Worktree as a DSH plugin

A persistent DSH bundle that puts the Git worktree browser in a **native right-sidebar
tab** of the Harness Web UI, instead of a separate loopback browser tab.

This is the replacement for the Codex route in the repository root: Codex exposes no
docked right-sidebar API, so that version had to open its own HTTP server and ask the
user to open a URL. DSH exposes a real tab-type system, so the same view renders as a
React component inside the application, follows the host theme, and survives page
reloads with the Session.

## What exists

| File | Role |
| --- | --- |
| `package.json` | Bundle manifest: `dsh.bundle.patch` plus the `dsh.client` browser half |
| `cordis.patch.yml` | The one Loader row this bundle inserts |
| `index.js` | Host half: every Git call, exposed on one same-origin HTTP route |
| `client.js` | Browser half: registers the tab type, its body, its chip title, and a sidebar-foot action |
| `verify.mjs` | Pre-install checks: parses both halves, validates the manifest and patch |

## Why a Host half exists

The browser half cannot run a command, so the host half owns Git. It registers
`/dsh-git-worktree/api` through `ctx.webServer.register` on the Web GUI's **own**
server, which means:

- the tab reads the same origin it was served from, so no token, no CORS, and no second
  port;
- the route appears when the plugin loads and disappears when it unloads;
- every Git bind is a fixed argument array through `execFile` — no shell string is ever
  assembled from input.

Routes (all `GET`, all relative to `/dsh-git-worktree/api`):

| `action` | Parameters | Answers |
| --- | --- | --- |
| `worktrees` | `repo?` | Repository root, its branch, and every worktree with dirty status and HEAD subject |
| `graph` | `repo?`, `worktree?`, `scope?`, `branch?`, `limit?`, `skip?` | Paged commit graph, parent edges, branch/tag/remote refs |
| `diff` | `repo?`, `worktree?` | `git diff HEAD --stat` plus the patch |
| `commit` | `repo?`, `oid` | Structured commit metadata and changed-file stats |
| `uncommitted` | `repo?`, `worktree?` | Structured tracked, staged and untracked file stats |

A Git failure is returned as `{ "ok": false, "error": "…" }` with HTTP 200, because a
broken worktree is an answer the tab renders, not a transport error.

## Install

The shell in this session cannot run commands, so the build and install steps are yours:

```powershell
# 1. Pre-install checks (parses both halves, validates the manifest and patch)
node D:\repos\git-worktree\dsh-plugin\verify.mjs
```

Then install the directory as a bundle through the `plugin_manager` tool with
`action: install_bundle` and `target: D:\repos\git-worktree\dsh-plugin`. The manifest
declares no npm dependencies and no install scripts, so nothing needs to be fetched or
built, and there should be no `pendingBuilds` to approve.

### The bundle must also be selected by the profile

`install_bundle` links the package into the profile's `node_modules` and activates it, but
the profile keeps its own enable list — `dsh.profile.bundles` in
`<profile>/package.json`. A package that is only linked is **not loaded after a restart**,
which looks exactly like "the plugin silently disappeared". Add it:

```json
{
  "name": "dsh-profile-web",
  "private": true,
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@local/dsh-git-worktree"
      ],
      "patchReload": "live"
    }
  }
}
```

With `patchReload: "live"` the running Host picks the change up, so no restart is needed:
confirm with `plugin_manager list_plugins`, which should show a
`include:git-worktree` row for `@local/dsh-git-worktree` with `fiberPhase: "active"`.

`pnpm` must be on `PATH` for the install step — the profile is a pnpm package. Installing it
is the whole prerequisite: `npm i -g pnpm`.

## Use

- **Sidebar foot** — a `Git` button beside Settings opens the tab.
- **Tab strip** — the `+` control opens the guide page, whose `Git Worktree` card opens
  the same tab (or focuses it when already open).
- **Panel** — worktree chips switch the viewed worktree; remote-ref visibility and
  graph-column visibility are remembered per Session; refresh re-reads worktrees and
  status; commit and uncommitted rows expand into metadata plus a changed-file tree.

Selecting a worktree in the panel changes what is displayed; it never checks out a
branch and never changes the Session's working directory.

## Current limits

- Read-only. Rebase, cherry-pick, merge and commit are deliberately not implemented yet;
  the guarded preview/apply flow in the root project is the design to port.
- The graph is a deterministic lane layout rendered as row-local SVG. It supports branch
  and merge curves and keeps existing lanes stable when another page is appended.
- The two halves are separate files. `verify.mjs` parses both, and
  `node --check dsh-plugin/index.js` parses the host half on its own, because the
  manifest declares `"type": "module"`. If the installer ever refuses the host half's
  static imports, the fix is to load `node:child_process` and friends through
  `await import(...)` inside `apply`, which makes `index.js` genuinely self-contained.

## Verified

Checked against a live Harness, not by inspection alone:

- both halves parse and the manifest and patch validate (`verify.mjs`);
- `install_bundle` links the package into the profile and applies it (`application: applied`);
- the client registers: `sidebar.right.pane.tab` and `sidebar.footer.action` each list
  `@local/dsh-git-worktree` as an active occupant, and the tab opens from the sidebar foot;
- a real repository renders: worktree list, branch, uncommitted-change count, the commit
  lane list with ref chips, and an expanded `git show`;
- the session workspace resolves on the Host, so the tab follows the current workspace
  instead of the directory the Host was started in.

Not yet exercised: several worktrees at once, a detached HEAD, an unborn branch, the dark
theme, and a panel narrowed below its content width.

Four defects surfaced only because the plugin was actually run: the browser half sent the
API action as a query parameter while the Host reads a path segment, so every read 404'd;
the repository was never resolved from the session, so the Host fell back to its own start
directory; and the effect that resolves the repository both read and wrote `repo`, so its
second pass blanked a graph that had already arrived. `verify.mjs` now carries a regression
check for that last one.
