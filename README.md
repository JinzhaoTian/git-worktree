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
| `src/core/` | Git core: fixed-argument `execFile` bindings, worktree/ref/graph/patch readers, history operations |
| `src/ui/worktree.ts`, `src/ui/worktree.module.css` | React panel, responsive graph columns, diff view and theme-aware CSS Module |
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

- Open the tab from the tab strip's `+` guide, or its `Git Worktree Graph` card.
- The toolbar names the worktree the Session sits in; refresh re-reads worktrees
  and status. The dot is amber while dirty, green when clean, and the error
  colour when the Host could not read it.
- Rows draw the worktree chip and local branches only. Expanding the
  uncommitted row shows its branch, full path, change totals, and a changed-file
  tree using the Files pane's folder and file icons. Folder rows are keyboard
  accessible. Both detail types share a responsive metadata/files layout: when
  wide, the two halves are independent columns — a header over its own scroll
  area on each side — so a commit hash that wraps to a second line lengthens
  the metadata alone and the change summary stays the one line it is. The
  divider between the halves is a drag handle: drag it, or focus it and press
  `←`/`→`, to change how the width is shared, and double-click it to return to
  an even split. The share is kept as a proportion, so it survives the pane
  being resized, and it is remembered for the next commit that is opened. Too
  narrow for two columns, the halves stack into a single scroll area instead.
  `Show Remote Branches` scopes the graph walk.
- Clicking a file in either changed-file tree opens its patch in a tab of its
  own, so the graph keeps its place and the patch can be left and come back to.
  The type is one reused page rather than one per file: opening another file
  re-navigates that tab, which is retitled with the file it now shows.
- The patch can be read as one column or as the old and new file side by side —
  `Split view` in the header's options menu, with a hatched code column where a
  side has no line to show beside its pair. The two files are parted the same way
  the numbering is parted from the code: a couple of pixels of the ground rather
  than a drawn rule. Either way the code keeps the app's own
  syntax colours, so a change is read from its surroundings rather than from the
  text: a fill that spans the numbering and the code together, a rule down the
  outer edge of the numbering, and the number itself in the change's colour —
  green for a line only the new file has, red for one only the old file has. The
  two columns are filled a shade apart — the numbering darker than the code in a
  dark palette and lighter in a light one — so the numbering reads as a column
  over the change rather than as part of it. They are parted by a couple of
  pixels of the ground itself rather than by a drawn rule, which separates them
  without a line competing with the change's own edge.
  That rule is per line, so a run of them stacks into one bar spanning the whole
  block. The numbering stands on the same ground as everything else and stays
  put while a long line is scrolled beneath it — or the line wraps instead,
  `Wrap long lines`, on by default because this tab is a column of a sidebar. Where one file has no line at all, the hatching that says so is
  the code column's alone: the numbering beside it stays plain, because a number
  has nothing to say about a line that is not there.
  Unchanged stretches between hunks are counted rather than printed, which is
  what keeps a large change readable.
- That header is the panel toolbar's own 38px band with the same 28px icon
  buttons and the app's icon set: the file's icon, path and its `+`/`-` totals
  together on the left, what happened to the file and which commit it belongs
  to after them, then a `⋯` menu (split view,
  wrapping, copy path) and an arrow that opens the file in a document preview
  tab through the tab system's own resource address.
- A file Git cannot show as lines — binary, too large to read, or gone from disk
  — says so rather than opening an empty diff.
- The graph reserves the width its visible lanes need. Description takes the
  remaining space while Date and Author share changes in panel width. All
  visible text columns shrink to their minimums before Author, then Date, is
  hidden. A commit's hash remains in its row tooltip and details.
- Guarded writes create a worktree or rebase/cherry-pick after a preview and an
  Apply. A preview changes nothing; its plan expires after five minutes, can be
  attempted once, and is rechecked against the branch, HEAD and target.
- The panel never checks out a branch and never changes the Session's working
  directory.

## Route

The host half owns Git and registers `/git-worktree-graph/api` on the Web GUI's own
server, so the tab reads the same origin — no token, no CORS, no second port.

Reads are `GET /git-worktree-graph/api/<action>`: `worktrees`, `graph`, `diff`,
`commit`, `uncommitted`, `file-diff`. Writes are `POST` with a JSON body:
`worktree-create`, `rebase-preview`, `rebase-apply`, `cherry-pick-preview`,
`cherry-pick-apply`. A write is refused with 403 when it names another origin
and 415 when it does not declare `application/json`. Every Git bind is a fixed
argument array through `execFile`; a Git failure returns `{ "ok": false,
"error": "…" }` with HTTP 200, because the tab renders it inline.

`file-diff` names one changed file and answers its patch as hunks of numbered
lines: `path` is the file, `oid` the commit it is read inside, and `from` the
path a rename moved it away from — without both ends of a rename, Git reports
the file as wholly new. With no `oid`, the working tree's own change is read,
which no `git diff` can answer for a file Git does not track yet; that file is
read from disk and its content reported as one added hunk. Every path is
refused unless it is relative, unmagical, and free of `..`, so no request can
reach outside the checkout. The `file-diff-v1` capability says the route is
there, but the browser half does not gate on it: that list is read once when
the tab opens, so a Host that gained the route afterwards would leave every
file row dead behind a stale answer. Opening a row asks the Host directly, and
a Host without the route says so in the panel.

## Limits

- Merge and commit are not implemented; rebase and cherry-pick are.
- The graph is a deterministic lane layout drawn as row-local SVG, newest →
  oldest; appending a page never moves a row that is already drawn.
