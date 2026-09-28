# Git Worktree integrations

Git worktree parsing, history operations, and a React view live at the repository root. Platform integrations live under `integrations/`; the current DSH integration mounts the view as a native right-sidebar tab in DeepSeek Harness.

## Structure

| Path | Purpose |
| --- | --- |
| `src/core/` | Platform-independent Git commands, worktree and graph readers, diff readers, history operations, and payload types |
| `src/ui/worktree.ts` | Reusable React panel and transport contract |
| `integrations/dsh-plugin/src/` | DSH host route and right-sidebar client registration |
| `integrations/dsh-plugin/scripts/` | DSH build and verification scripts |
| `integrations/dsh-plugin/` | Installable DSH bundle manifest, patch, and generated host/client files |

The host runs Git through `child_process.execFile` with fixed argument arrays. History changes require a clean, active worktree. A preview changes nothing; its plan expires after five minutes, can be attempted once, and is rechecked against the branch, HEAD, and target before applying.

## Build and verify

Requires Node 20+ and Git:

```sh
npm ci
npm run build:dsh
npm run check
```

`npm run build:dsh` refreshes the checked-in `integrations/dsh-plugin/index.js` and `integrations/dsh-plugin/client.js`. A fresh checkout already contains the runtime files needed to install the DSH bundle. `npm run check` type-checks the core, view, and DSH adapter, runs the DSH bundle verification, and measures the panel geometry in headless Chrome or Edge. Every command scoped to this integration carries the `:dsh` suffix; `typecheck:dsh` covers the shared view plus both plugin halves, and each step can be run alone with `build:dsh`, `typecheck:dsh`, `verify:dsh`, or `geometry:dsh`. Set `GIT_WORKTREE_BROWSER` if browser discovery needs an explicit executable.

See [integrations/dsh-plugin/README.md](integrations/dsh-plugin/README.md) for installation and use in DeepSeek Harness.
