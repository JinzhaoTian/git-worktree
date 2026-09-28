# Git Worktree for DSH

A native right-sidebar tab for DeepSeek Harness that shows the current Session's Git worktree, commit graph, refs, and changed files. The tab can create a worktree and preview a rebase or cherry-pick before applying it.

## Structure

| Path | Purpose |
| --- | --- |
| `src/core/` | Git commands, worktree and graph readers, diff readers, history operations, and payload types |
| `src/ui/worktree.ts` | React panel and its styles |
| `src/dsh/host.ts` | Session-to-repository resolution and the DSH same-origin HTTP route |
| `src/dsh/client.ts` | Right-sidebar tab registration and browser transport |
| `dsh-plugin/` | Installable DSH bundle manifest, patch, and generated host/client files |
| `scripts/` | Bundle build and verification scripts |

The host runs Git through `child_process.execFile` with fixed argument arrays. History changes require a clean, active worktree. A preview changes nothing; its plan expires after five minutes, can be attempted once, and is rechecked against the branch, HEAD, and target before applying.

## Build and verify

Requires Node 20+ and Git:

```sh
npm ci
npm run build
npm run check
```

`npm run build` writes `dsh-plugin/index.js` and `dsh-plugin/client.js`. These files are generated and ignored by Git. `npm run check` type-checks the DSH host and view, runs the DSH bundle verification, and measures the panel geometry in headless Chrome or Edge. Set `GIT_WORKTREE_BROWSER` if browser discovery needs an explicit executable.

See [dsh-plugin/README.md](dsh-plugin/README.md) for installation and use in DeepSeek Harness.
