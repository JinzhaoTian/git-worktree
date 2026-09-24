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
| `client.js` | Browser half: registers the tab type, its body and its chip title |
| `verify.mjs` | Pre-install checks: parses both halves, validates the manifest and patch, exercises the layout and rendering |
| `geometry.mjs` | Browser geometry check: renders the real toolbar chip and measures it at the widths a panel takes |

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
| `graph` | `repo?`, `worktree?`, `scope?`, `branch?`, `remote?`, `limit?`, `skip?` | Paged commit graph, parent edges, branch/tag/remote refs |
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

# 2. Toolbar geometry (needs Chrome or Edge; renders the chip and measures it)
node D:\repos\git-worktree\dsh-plugin\geometry.mjs
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

- **Tab strip** — the `+` control opens the guide page, whose `Git Worktree` card opens
  the same tab (or focuses it when already open). This is the only way in: the tab type
  used to also carry a `sidebar.footer.action` button beside Settings, which was removed so
  the sidebar foot stays clear. Only the tab registration was dropped; the tab itself, its
  title and its guide card are unchanged.
- **Panel** — the toolbar names the worktree being read by its path, shortened by rule
  when the path is long (`E:/w…/ThBIMWindowsUI`, `C:/U…Temp/dsh-gw-verify-31480`: the
  root's first four characters, as much of the parent folder as the width budget allows,
  and the folder itself). The parent folder is what distinguishes two similar checkouts, so
  it is cut rather than dropped, and the budget is what makes the shortening honest: a path
  the rule cannot shorten by at least five characters is shown whole, because eliding
  `E:/www.p6c/ThBIMWindowsUI` to save one character would spend a reader's attention on an
  ellipsis and buy nothing. An earlier rule kept the parent's *tail* instead, and answered
  exactly that case with the path it was asked to shorten. The whole path and the branch
  ride in the tooltip. The chip gives up width to the controls beside it and ellipsises what
  still does not fit, and it clips its own overflow as a second line of defence, so an
  arbitrarily long path can never push the chip's own contents out of the toolbar. The
  chip's dot is always drawn and its colour carries the state: amber while the
  worktree has uncommitted changes, green once it is clean, and the error colour when the
  Host could not read it — `status` is null for a bare or prunable worktree and when
  `git status` fails, which must not be shown as clean. That is the only worktree the
  panel ever reads: the one the Session's own working directory sits in. Remote-ref visibility and graph-column visibility are
  remembered per Session; refresh re-reads worktrees and status; commit and uncommitted
  rows expand into metadata plus a changed-file tree, indented to start under the
  `Description` column. Both the row that opened and the detail under it carry a surface of
  their own, mixed from the label token and one step apart — the row darker/lighter than its
  detail, so it stays the block's header. The mix is what makes the pair visible at all: the
  light theme's layer surface is the same white the panel already sits on, so
  `background: var(--dsw-alias-bg-layer-1)` marked neither, and a fixed grey would be wrong
  in the dark theme — mixing the label colour into the layer darkens on light and lightens
  on dark, whichever the host is using. Only the changed-file column of an expanded detail is
  capped — at 45% of the panel's own measured height, never more than 420px and never less
  than six rows — and it scrolls on its own: the metadata and commit message beside it keep
  their natural height, so a long message still reads in full while a change set of a hundred
  files cannot push the rest of the history off screen. The two halves are flex columns rather
  than grid columns because a grid row is sized from its item's content and ignores that
  item's max-height — capping inside a grid grew the row to the whole file list and left the
  capped column floating in empty space. The cap travels as a custom property on the row, so
  the rail drawn in that row still spans the block and the lane stays joined to the rows above
  and below.
- **Refs** — the worktree's own ref and the branch it holds describe one commit, so they
  render as one chip made of two cells: an inverted `worktree` label (solid label colour —
  black on light, white on dark — text knocked out) and, beside it, the branch drawn as a
  branch chip is, with the branch glyph on the lane colour. The frame belongs to the chip
  rather than to either cell, so the label colour rings the pair while the branch name sits
  on its own lane-tinted surface instead of on the label's fill. A worktree whose HEAD is
  detached holds no branch, and the chip keeps both its cells anyway — the graph's hollow
  ring and `HEAD` stand where the branch glyph and name would, so the icon says what the
  lane says and the chip still tells which worktree it is about. A row draws this chip and
  the local branches that sit on the commit, and nothing
  else: tags, stashes and remote mirrors are neither sent by the Host nor drawn, so a busy
  repository's rows stay readable next to the subject. The log still walks the history's
  entry points — branches, tags and remote-tracking refs — so the history keeps reaching the
  commits that only a tag or a remote mirror points at; the ref policy is about the row, not
  about the graph. This tool's own `refs/codex/*` refs and `refs/stash` are the one place the
  two touch: they are not entry points, because each of them is a tip, and a tip drawn in the
  middle of the list starts a lane with no line above it.
- **HEAD** — the hollow circle marks the newest change, wherever it is. While the worktree
  is dirty that is the `Uncommitted Changes` row's own ring, and the commit the worktree's
  HEAD sits on is connected up to it; once the worktree is clean the ring moves onto the
  HEAD commit itself. The commit under HEAD is bold in both cases. The Host answers the
  commit as `head` on the graph payload. The connector is drawn only while the first
  commit row really is HEAD — a line to any other commit would claim a relation the
  history does not have, and a line with no row to reach is the stray stub it once was.
- **Show Remote Branches** — scopes the history, and only the history: rows draw no remote
  refs either way. The walk's entry points are branches, tags, and — unless this is unchecked —
  remote-tracking refs. This tool's own `refs/codex/*` refs and `refs/stash` are never entry
  points: every one of them is a tip, and a tip drawn in the middle of the list starts a lane
  with no line above it, which reads as a branch out of nowhere. The Host treats a missing
  `remote` parameter as "include", so a browser half that predates this option keeps the full
  history.
- **After a restart** — the tab is restored before the Host knows the Session again, so the
  panel treats its first failure as a moment: it retries that read, and the Host waits for the
  Session to register before resolving anything. While a Session is named, neither side
  answers from the Host's own start directory.

The panel is read-only with respect to the repository: nothing in it checks out a branch,
changes the Session's working directory, or moves a worktree. It follows the Session
instead — the Host resolves the repository with `rev-parse --show-toplevel`, which answers
the current worktree even when the Session sits in a linked one.

## Current limits

- Read-only. Rebase, cherry-pick, merge and commit are deliberately not implemented yet;
  the guarded preview/apply flow in the root project is the design to port.
- The graph is a deterministic lane layout rendered as row-local SVG. Columns waiting for a
  commit that already arrived collapse before the next row is placed, so the branches still
  running slide left and an older commit is drawn as far left as its branch allows; a lane
  therefore bends wherever the branches around it come and go, and both ends of an edge are
  read back from `lanes` after the walk rather than remembered when it was queued. The walk
  is strictly newest → oldest, so appending a page cannot move a row that is already drawn.
  A lane change is a polyline: down the source column, a ramp across to the target column,
  then down that column to the parent. The ramp slopes rather than steps — it leaves the
  source column in one of the two slots the row below has clear of its own node (alternating,
  so a merge's two ramps do not land on the same line) and drops half a row per column
  crossed, so a lane moving left is low on the left and high on the right. Clipping a straight
  polyline by y is exact, so each row draws its own slice as one path — columns and ramp
  joined, `stroke-linejoin` rounding the junctions — and a slice ends on a row edge at
  precisely the point its neighbour begins on. An
  expanded row is taller than a row, so the band it occupies carries no row slice: a rail
  beside the detail draws every lane crossing that band, entering on the column the row above
  ended on, which is also the column the row below begins on — and, for an edge leaving the
  expanded row itself, drawing the same two columns and the same ramp, measured from the
  rail's top. Without it the lane stopped at
  the row above and started again below the detail, leaving the dots looking unrelated.
- The two halves are separate files. `verify.mjs` parses both, and
  `node --check dsh-plugin/index.js` parses the host half on its own, because the
  manifest declares `"type": "module"`. If the installer ever refuses the host half's
  static imports, the fix is to load `node:child_process` and friends through
  `await import(...)` inside `apply`, which makes `index.js` genuinely self-contained.

## Verified

Checked against a live Harness, not by inspection alone:

- both halves parse and the manifest and patch validate (`verify.mjs`);
- the toolbar chip is measured, not just styled: `geometry.mjs` renders the real
  stylesheet and the real chip markup in headless Chrome at four path shapes and five
  panel widths, and asserts that the status dot keeps its full size inside both the chip
  and the toolbar, that the chip never extends past the toolbar, and that a path too long
  for the chip loses its own tail rather than the dot;
- `install_bundle` links the package into the profile and applies it (`application: applied`);
- the client registers: `sidebar.right.pane.tab` and `sidebar.right.pane.tab.title` each
  list `@local/dsh-git-worktree` as an active occupant, and the tab opens from the tab
  strip's guide card; `sidebar.footer.action` no longer lists it, which `verify.mjs` guards;
- a real repository renders: worktree list, branch, uncommitted-change count, the commit
  lane list with ref chips, and an expanded `git show`;
- a row draws local branches and the worktree chip only: the host behavior block puts a
  branch, a remote mirror, a tag and a stash on one commit and asserts that the row carries
  the first two kinds and that `refCount` agrees with what was sent, while the panel render
  asserts the same filter and that an older Host's count earns no `+N` badge;
- an expanded row keeps the graph's column: `verify.mjs` renders the panel with a row open
  and asserts the rail beside the detail, the width it indents by, and the lane's two columns
  — its own column throughout for a straight lane, and for a lane change two runs on the two
  columns with the crossing drawn as an arc between them. It also asserts
  the cap: its share of the panel's height at three panel heights, its floor and its ceiling,
  and that hiding the graph column drops the rail without dropping the row. The geometry
  screenshot in a headless browser — `geometry.mjs` now does this on every run — from the
  plugin's own markup and stylesheet plus the Host's light-theme tokens, because this session
  has no control of the live page (a refresh of the tab is what shows the change there);
- the session workspace resolves on the Host, so the tab follows the current workspace
  instead of the directory the Host was started in — including the moment just after a
  restart: the host behavior block asserts that a Session which registers during the wait is
  read from its own workspace, that an unknown Session is named instead of being replaced by
  the configured fallback, and the render harness asserts that a first read which fails while
  the Host is starting is issued again instead of reported.

Not yet exercised: several worktrees at once, a detached HEAD, an unborn branch, the dark
theme, and a panel narrowed below its content width.

Four defects surfaced only because the plugin was actually run. Three came from first making
it work at all: the browser half sent the API action as a query parameter while the Host
reads a path segment, so every read 404'd; the repository was never resolved from the
session, so the Host fell back to its own start directory; and the effect that resolves the
repository both read and wrote `repo`, so its second pass blanked a graph that had already
arrived.

The fourth came from using the panel: the `Uncommitted Changes` row was drawn whenever a
repository resolved, so a clean worktree showed a dead row that expanded into an empty
detail; it now renders only while the worktree has changes. `verify.mjs` carries a regression
check for the blanked graph and now asserts both cleanliness states on real render output — a
dirty worktree keeps the row, a clean one has none.

The fifth came from restarting the Harness with the tab open. The browser half restores its
tab and reads before the Host knows the Session again, so `sessions.get(id)` was empty and the
Host fell through to `process.cwd()` — the panel announced `No Git repository found. Tried —
C:\Users\<user>`, the right message about a directory the tab never asked about. Both sides now
treat that window as a moment rather than an answer: the Host waits for the Session to register
(and names it if it never does, instead of substituting another repository), and the browser
half retries its first read with a growing pause. The retry needed `setTimeout` in the verify
sandbox, which is why that stub now provides it like the other page globals.

The sixth came from reading the toolbar rather than using it. The path chip is meant to
name the worktree in a shortened form, and the shortening rule kept the parent folder's
*tail*: on `E:/www.p6c/ThBIMWindowsUI` that elision saved a single character, so the rule —
which refuses a shortening that does not shorten — reported the path whole and the chip drew
`E:/www.p6c/ThBIMWindowsUI` in a toolbar meant to carry a name. The rule now keeps the
root and the folder, cuts the parent folder to whatever the width budget allows, and demands
a saving of at least five characters before it will shorten at all, which answers that case
with `E:/w…/ThBIMWindowsUI`. The chip also clips its own overflow now, as a second line of
defence beside the shrink it already had, so an over-long path cannot push the chip's own
contents out of the toolbar. Both are checked on measured geometry rather than on source
text: `verify.mjs` asserts the rule's answers and the chip's rules, and `geometry.mjs` puts
the same markup in a browser and asserts the dot stays whole and inside the chip at every
width.
