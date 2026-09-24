/**
 * Git Worktree — browser half.
 *
 * Registers one right-sidebar tab type (`kind: 'git-worktree'`) plus its body and
 * chip title. Every Git call belongs to the host half and is read over the
 * same-origin route it registered; nothing here runs a command or touches disk.
 *
 * The view follows the shape of a desktop Git client: a toolbar, a column header,
 * an "Uncommitted Changes" row that behaves like a commit, a multi-lane DAG whose
 * lanes persist across "load more" pages, and an expanded commit that splits into
 * its own metadata beside a file tree, indented past its lane, which a rail
 * carries through so the graph never breaks around it. Layout is driven by the
 * panel's measured width, because this panel is a resizable column, a split pane
 * or a float.
 *
 * Styling uses host theme tokens (`--dsw-alias-*`); only lane and diff-count
 * artwork use literal colors, which the host's token policy allows for artwork.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-git-worktree',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const API = '/dsh-git-worktree/api';
    const KIND = 'git-worktree';
    const NS = '@local/dsh-git-worktree';

    const PAGE = 300;
    const ROW = 26;
    const COL = 14;
    const PAD = 10;
    const MARGIN = 8;
    // Where a lane change crosses, measured from the top of the row below its
    // node. Two slots, one clear of that row's node above and one below, so two
    // parents of one commit cannot draw their crossings over each other.
    const CROSS_NEAR = 7;
    const CROSS_FAR = ROW - 7;
    // Width breakpoints, measured on the panel itself.
    const W_DATE = 560;
    const W_AUTHOR = 700;
    const W_COMMIT = 820;
    const W_DETAIL_SPLIT = 680;
    // An expanded detail is capped as a share of the panel's own height, because
    // this panel is a full-height column, a split pane or a short float: without
    // a cap a long file list pushes every other commit out of view.
    const DETAIL_MAX_SHARE = 0.45;
    const DETAIL_MAX_CEILING = 420;
    const DETAIL_MAX_FLOOR = ROW * 6;
    // The panel's first read can arrive before the Host knows this Session — a
    // restart restores the tab before it restores the Session — so it is retried
    // with a growing pause before the failure is believed.
    const RESOLVE_ATTEMPTS = 4;
    const RESOLVE_BACKOFF_MS = 300;

    // Lane artwork. Literal colors are deliberate: these identify a branch, not
    // a UI surface, and each one is legible on both theme backgrounds.
    const LANE_COLORS = ['#2f8ae0', '#d0569b', '#38a169', '#d98a2b', '#8b72e0', '#0fa8ad', '#c05252', '#7a8b2f'];
    const DIFF_ADD = '#3fa34d';
    const DIFF_DEL = '#d05a4e';

    // Presentational choices per Session: scope, remote-ref visibility, graph column.
    const viewState = new Map();

    const CSS = `
.dsh-gw { display: flex; flex-direction: column; height: 100%; min-height: 0; font-size: 12px; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); }
.dsh-gw * { box-sizing: border-box; }
.dsh-gw-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 24px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; cursor: pointer; }
.dsh-gw-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.dsh-gw-btn:disabled { opacity: .5; cursor: default; }
.dsh-gw-tbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; row-gap: 4px; min-height: 36px; padding: 5px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-specific-sidebar-fill); }
.dsh-gw-spacer { flex: 1 1 auto; min-width: 4px; }
.dsh-gw-check { display: inline-flex; align-items: center; gap: 5px; color: var(--dsw-alias-label-primary); cursor: pointer; white-space: nowrap; }
.dsh-gw-icons { display: inline-flex; align-items: center; gap: 2px; }
.dsh-gw-iconbtn { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 0; border-radius: 6px; background: none; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dsh-gw-iconbtn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
/* The worktree chip rides in the toolbar, so it has to give up width to the
   controls beside it and ellipsise the path rather than push them around. Both
   the chip and the text inside it need a zero minimum for that to happen, and
   the chip clips its own overflow as a second line of defence: the path is the
   one thing here that can be arbitrarily long, so a chip that could not shrink
   would push its own status dot and the folder name out of the toolbar instead
   of cutting the text. The dot stays outside that cut — it is drawn before the
   text and never shrinks — so the state keeps its colour whatever the path is. */
.dsh-gw-wt { display: inline-flex; align-items: center; gap: 4px; flex: 0 1 auto; min-width: 0; max-width: 100%; overflow: hidden; height: 20px; padding: 0 7px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font: inherit; }
.dsh-gw-wt .dsh-gw-subjtext { min-width: 0; overflow: hidden; }
.dsh-gw-wt-current { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
.dsh-gw-dot { flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary); }
.dsh-gw-dot-clean { background: var(--dsw-alias-state-success-primary); }
.dsh-gw-dot-unknown { background: var(--dsw-alias-state-error-primary); }
.dsh-gw-msg { padding: 5px 10px; color: var(--dsw-alias-label-secondary); border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-gw-error { margin: 8px 10px; padding: 6px 8px; border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 6px; color: var(--dsw-alias-state-error-primary); white-space: pre-wrap; word-break: break-word; }
.dsh-gw-empty { padding: 16px 10px; color: var(--dsw-alias-label-secondary); text-align: center; }

.dsh-gw-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
.dsh-gw-grid { display: flex; flex-direction: column; min-width: 100%; }
.dsh-gw-hrow { position: sticky; top: 0; z-index: 2; display: grid; grid-template-columns: var(--dsh-gw-cols); align-items: center; height: 26px; background: var(--dsw-alias-bg-layer-1); border-bottom: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); font-weight: 600; }
.dsh-gw-hcell { padding: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The lane is drawn as one ROW-tall slice per row, so a row's pitch has to be
   exactly ROW and every slice has to begin at its row's top. A bottom border
   and an inline SVG's baseline gap each add height the drawing knows nothing
   about, and that is what left the lane visibly broken between rows. The
   separator is an inset shadow so it costs no layout. */
.dsh-gw-row { display: grid; grid-template-columns: var(--dsh-gw-cols); align-items: center; height: 26px; overflow: hidden; border-left: 2px solid transparent; box-shadow: inset 0 -1px 0 var(--dsw-specific-sidebar-fill); cursor: pointer; outline: none; }
/* The layer token is the same white the panel already sits on in the light
   theme, so an open row was marked by its left stripe alone and hovering one
   showed nothing at all. Mixing the label colour into the layer tints darker on
   the light theme and lighter on the dark one — the two directions "selected"
   reads as — and stays on theme tokens instead of a fixed grey. */
.dsh-gw-row:hover:not(.dsh-gw-row-open) { background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, var(--dsw-alias-bg-layer-1)); }
.dsh-gw-row:focus-visible { box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary), inset 0 -1px 0 var(--dsw-specific-sidebar-fill); }
.dsh-gw-row-open { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, var(--dsw-alias-bg-layer-1)); border-left-color: var(--dsw-alias-brand-primary); }
.dsh-gw-cell { display: flex; align-items: center; min-width: 0; padding: 0 8px; }
.dsh-gw-cell-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--dsw-alias-label-secondary); }
.dsh-gw-cell-sec { color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsh-gw-gcell { display: flex; align-self: stretch; overflow: hidden; }
.dsh-gw-gcell svg { display: block; flex: 0 0 auto; }
.dsh-gw-subj { display: flex; align-items: center; gap: 6px; min-width: 0; width: 100%; }
.dsh-gw-subjtext { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-gw-ref { flex: 0 0 auto; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 5px; border-radius: 4px; font-size: 11px; line-height: 16px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
/* A branch chip is the lane's own: tile, border, tint and now the name all come
   from the lane colour, so one branch reads as one colour rather than as green
   chrome around black text. */
.dsh-gw-ref-branch, .dsh-gw-ref-remote { display: inline-flex; align-items: center; gap: 4px; padding: 0 5px 0 0; border-color: color-mix(in srgb, var(--dsh-gw-ref-color) 42%, var(--dsw-alias-border-l2)); background: color-mix(in srgb, var(--dsh-gw-ref-color) 8%, var(--dsw-alias-bg-layer-2)); color: var(--dsh-gw-ref-color); }
.dsh-gw-ref-remote { border-style: dashed; }
.dsh-gw-ref-icon { display: inline-flex; align-items: center; justify-content: center; align-self: stretch; width: 18px; min-width: 18px; min-height: 16px; border-radius: 3px 0 0 3px; background: var(--dsh-gw-ref-color); color: white; }
.dsh-gw-ref-icon svg { display: block; }
.dsh-gw-ref-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.dsh-gw-ref-remote-name { color: var(--dsw-alias-label-secondary); font-style: italic; }
.dsh-gw-ref-current { border-color: color-mix(in srgb, var(--dsh-gw-ref-color) 68%, var(--dsw-alias-border-l2)); font-weight: 600; }
.dsh-gw-ref-tag { color: var(--dsw-alias-state-success-primary); }
.dsh-gw-ref-stash { color: var(--dsw-alias-state-warn-primary); }
/* The worktree chip is one chip built from two cells: the inverted label (solid
   label color — black in light mode, white in dark — with the text knocked out),
   then the branch it holds drawn as a branch chip is. The frame belongs to the
   chip, not to either cell, so the label colour rings the whole pair while the
   branch name sits on its own lane-tinted surface rather than on the label's
   black. No gap between the cells, and the frame clips them to its own corners. */
.dsh-gw-ref-worktree { display: inline-flex; align-items: stretch; gap: 0; padding: 0; border: 1px solid var(--dsw-alias-label-primary); border-radius: 5px; overflow: hidden; background: none; font-size: 11px; }
.dsh-gw-ref-worktree-label { display: inline-flex; align-items: center; padding: 0 7px; background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-base); font-size: 12px; font-weight: 600; line-height: 18px; }
.dsh-gw-ref-worktree-held { display: inline-flex; align-items: center; gap: 4px; padding: 0 7px 0 0; background: color-mix(in srgb, var(--dsh-gw-ref-color) 8%, var(--dsw-alias-bg-layer-2)); color: var(--dsw-alias-label-primary); line-height: 18px; }
.dsh-gw-ref-worktree-icon { display: inline-flex; align-items: center; justify-content: center; align-self: stretch; width: 18px; min-width: 18px; background: var(--dsh-gw-ref-color); color: white; }
.dsh-gw-ref-worktree-icon svg { display: block; }
.dsh-gw-ref-worktree-name { display: inline-flex; align-items: center; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-gw-ref-worktree-remote { color: var(--dsw-alias-label-secondary); font-style: italic; }

.dsh-gw-uncommitted { font-weight: 600; }
.dsh-gw-row-head { font-weight: 600; }
.dsh-gw-row-head .dsh-gw-ref { font-weight: 400; }
/* An expanded row keeps the graph's own column. The detail is many rows tall,
   so no row slice can draw it: a rail beside it carries every lane across the
   band, and the detail's text starts under the Description column instead of
   under the lane. The 2px border matches a row's own box, so the rail lines up
   with the graph slices above and below it. The detail also carries a tint of
   the same recipe as the row that opened it, one step weaker: in the light theme
   the base and the layer surface are both white, so an expanded detail used to
   be the same white as every closed row around it. */
.dsh-gw-detailrow { display: flex; align-items: stretch; border-left: 2px solid transparent; border-bottom: 1px solid var(--dsw-alias-border-l1); background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, var(--dsw-alias-bg-layer-1)); }
.dsh-gw-rail { position: relative; flex: 0 0 auto; align-self: stretch; overflow: hidden; }
.dsh-gw-rail-line { position: absolute; top: 0; bottom: 0; border-radius: 1px; }
.dsh-gw-rail-turn { position: absolute; display: block; overflow: visible; }
.dsh-gw-detailbody { flex: 1 1 auto; min-width: 0; }
/* The two halves of a detail are flex columns rather than grid columns, because a
   grid row is sized from its item's content and ignores that item's max-height:
   capping the changed-file column there grew the row to the file list's full
   height and left the capped column floating in empty space. A flex line's cross
   size does respect the item's cap, so the row ends where the shorter of the two
   halves ends — the message keeps its height, the file list stops at its cap. */
.dsh-gw-detail { display: flex; align-items: stretch; }
.dsh-gw-detail-narrow { flex-direction: column; }
.dsh-gw-detail-left { flex: 1 1 0; padding: 8px 10px; min-width: 0; border-right: 1px solid var(--dsw-alias-border-l1); }
.dsh-gw-detail-narrow .dsh-gw-detail-left { border-right: 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-gw-detail-narrow .dsh-gw-detail-left, .dsh-gw-detail-narrow .dsh-gw-detail-right { flex: 0 0 auto; }
.dsh-gw-kv { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 2px 8px; }
.dsh-gw-k { color: var(--dsw-alias-label-secondary); }
.dsh-gw-v { min-width: 0; overflow-wrap: anywhere; }
.dsh-gw-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.dsh-gw-body { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--dsw-alias-border-l1); white-space: pre-wrap; color: var(--dsw-alias-label-secondary); }
.dsh-gw-legacy { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--dsw-alias-label-secondary); }
/* Only the changed-file column is capped, and it scrolls on its own: the metadata
   and the commit message beside it keep their natural height, so a long message
   grows the block while a long file list scrolls inside its own box. The cap is
   inherited from the row, which also carries the rail, so the lane the expanded
   row sits on is drawn down the whole block however tall the left column gets. */
.dsh-gw-detail-right { flex: 1 1 0; padding: 8px 10px; min-width: 0; max-height: var(--dsh-gw-detail-max); overflow: auto; }
.dsh-gw-stat { color: var(--dsw-alias-label-secondary); margin-bottom: 6px; }
.dsh-gw-add { color: ${DIFF_ADD}; }
.dsh-gw-del { color: ${DIFF_DEL}; }
.dsh-gw-ftree { display: flex; flex-direction: column; }
.dsh-gw-frow { display: flex; align-items: center; gap: 6px; height: 19px; min-width: 0; }
.dsh-gw-fname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-gw-fstat { display: inline-flex; gap: 4px; margin-left: auto; padding-left: 8px; flex: 0 0 auto; }
`;

    /** One API read. A Git failure arrives as `ok: false`, never as a rejected fetch. */
    async function api(action, params, sessionId, signal) {
      // The action is a path segment, matching the host half's route parsing.
      const url = new URL(`${API}/${action}`, window.location.origin);
      if (sessionId) url.searchParams.set('session', sessionId);
      for (const [key, value] of Object.entries(params || {})) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
      }
      const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload || payload.ok !== true) throw new Error((payload && payload.error) || 'Request failed.');
      return payload.data;
    }

    /**
     * Compare two worktree paths for identity.
     *
     * The Host answers `repo.root` from `realpath` while `worktrees[].path` comes
     * from `git worktree list`, and on Windows those disagree about separators —
     * `E:\workspace\X` against `E:/workspace/X`. Exact equality therefore never
     * matches, which silently left the panel reading whichever worktree happened
     * to be listed first.
     */
    function samePath(left, right) {
      const norm = (value) => String(value || '').replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase();
      const a = norm(left);
      return a !== '' && a === norm(right);
    }

    // The shortest a path may be shortened by and still be worth showing short.
    // Eliding a path to save one or two characters is not a shortening: it trades
    // characters a reader can see for an ellipsis they must decode, which is how
    // `E:/www.p6c/ThBIMWindowsUI` was drawn almost whole inside a chip.
    const PATH_MIN_SAVING = 5;

    /**
     * Shorten a worktree path for the toolbar.
     *
     * The part of a path that identifies it is the folder it ends in, and the
     * part that distinguishes two similar checkouts is the parent folder it sits
     * in. So the folder and the root's first four characters are always kept, and
     * the parent folder is cut to whatever the width budget still allows — as
     * little as one character, when that is all the budget there is. A path the
     * rule cannot shorten by `PATH_MIN_SAVING` characters is left whole rather
     * than traded for a barely-shorter string, and the chip ellipsises whatever
     * still overflows its own width.
     */
    function compactPath(path) {
      const text = String(path || '');
      const cut = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
      if (cut <= 0) return text;
      const sep = text[cut];
      const name = text.slice(cut + 1);
      const parent = text.slice(0, cut);
      const parentCut = Math.max(parent.lastIndexOf('/'), parent.lastIndexOf('\\'));
      const segment = parentCut < 0 ? parent : parent.slice(parentCut + 1);
      const head = text.slice(0, 4);
      const attempt = (middle) => `${head}…${middle}${sep}${name}`;
      // What is left for the parent name once the root, the ellipsis, the
      // separator, the folder and the saving have taken their share.
      const budget = text.length - PATH_MIN_SAVING - attempt('').length;
      let compact = attempt('');
      if (budget >= 1 && segment) compact = attempt(segment.slice(0, Math.min(segment.length, budget)));
      return compact.length <= text.length - PATH_MIN_SAVING ? compact : text;
    }

    function shortOid(oid) {
      return String(oid || '').slice(0, 7);
    }

    /** Compact "24 Sep 2026 00:22" — the reference's Date column. */
    function absoluteTime(iso) {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = date.toLocaleString('en-US', { month: 'short' });
      const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      return `${day} ${month} ${date.getFullYear()} ${hhmm}`;
    }

    function relativeTime(iso) {
      const then = Date.parse(iso);
      if (!Number.isFinite(then)) return '';
      const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
      if (seconds < 60) return '刚刚';
      const minutes = Math.round(seconds / 60);
      if (minutes < 60) return `${minutes} 分钟前`;
      const hours = Math.round(minutes / 60);
      if (hours < 24) return `${hours} 小时前`;
      const days = Math.round(hours / 24);
      if (days < 30) return `${days} 天前`;
      const months = Math.round(days / 30);
      if (months < 12) return `${months} 个月前`;
      return `${Math.round(months / 12)} 年前`;
    }

    /**
     * Lay commits out into lanes by walking newest → oldest.
     *
     * A commit takes the lane its first child already reserved, and a merge
     * reserves one lane per parent. Lanes waiting for a commit that already
     * arrived collapse before the next row is placed, so the branches still
     * running slide left: an older commit sits as far left as its branch allows.
     * A lane therefore bends wherever the branches around it come and go — which
     * is the price of a compact graph, and the reason an edge's columns are read
     * back from `lanes` after the walk rather than remembered when it was queued.
     *
     * The walk is still strictly newest → oldest, so appending a page cannot move
     * a row that is already drawn.
     */
    function layoutLanes(nodes) {
      const waiting = [];
      const lanes = [];
      const edges = [];
      const seats = [];
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        for (let slot = waiting.length - 1; slot >= 0; slot -= 1) {
          if (waiting[slot] === null) waiting.splice(slot, 1);
        }
        let lane = waiting.indexOf(node.id);
        if (lane < 0) lane = waiting.length;
        lanes.push(lane);
        // The first parent inherits this column, so a linear history stays straight.
        waiting[lane] = null;
        for (const parent of node.parents || []) {
          if (!parent) continue;
          let parentLane = waiting.indexOf(parent);
          if (parentLane < 0) {
            parentLane = waiting.indexOf(null);
            if (parentLane < 0) parentLane = waiting.length;
            waiting[parentLane] = parent;
          }
          edges.push({ from: index, parent });
        }
        // Where every branch still running sits once this row is placed. An edge
        // reads this to follow its parent's column as the branches around it
        // collapse, instead of jumping the whole distance at once.
        const seat = new Map();
        for (let slot = 0; slot < waiting.length; slot += 1) {
          if (waiting[slot]) seat.set(waiting[slot], slot);
        }
        seats.push(seat);
      }
      const indexById = new Map(nodes.map((node, index) => [node.id, index]));
      for (const edge of edges) {
        // A parent outside this page continues just below the last visible row.
        // Parents inside the page connect to their real row, which is essential
        // for merge lines that pass one or more intervening commits.
        edge.to = indexById.has(edge.parent) ? indexById.get(edge.parent) : nodes.length;
        // The columns this edge passes through: one entry per column its parent
        // moves to while the edge runs, so every ramp spans a single column and
        // never enters a column another branch is still running in.
        edge.route = [];
        for (let row = edge.from + 1; row < edge.to && row < lanes.length; row += 1) {
          const seat = seats[row - 1] && seats[row - 1].get(edge.parent);
          if (seat === undefined) continue;
          const last = edge.route[edge.route.length - 1];
          if (last && last.lane === seat) continue;
          edge.route.push({ lane: seat, y: row * ROW + CROSS_NEAR });
        }
        // The column a lane runs in can change while the walk continues, so both
        // ends of an edge are read from where its rows were finally drawn. The
        // page's last row keeps the column the walk left the parent waiting in.
        edge.fromLane = lanes[edge.from];
        edge.toLane = edge.to < lanes.length ? lanes[edge.to] : edge.toLane;
      }
      let width = 0;
      for (const lane of lanes) width = Math.max(width, lane + 1);
      for (const edge of edges) width = Math.max(width, edge.fromLane + 1, edge.toLane + 1);
      // Every lane change leaves its node and crosses in the row below it, taking
      // the two slots that row has clear of its own node in turn. A merge's two
      // crossings then sit on different lines instead of one drawn over the other.
      const departures = new Map();
      for (const edge of edges) {
        const order = departures.get(edge.from) || 0;
        departures.set(edge.from, order + 1);
        edge.crossing = (edge.from + 1) * ROW + (order % 2 === 0 ? CROSS_NEAR : CROSS_FAR);
      }
      return { lanes, edges, width: Math.max(width, 1) };
    }

    /** The thickest stroke any edge out of this row uses: one per parent link. */
    function strokeWidthFor(layout, index, lane) {
      let width = 1.6;
      for (const edge of layout.edges) {
        if (edge.from === index && edge.fromLane === lane) width = Math.max(width, 2.6);
      }
      return width;
    }

    function laneX(lane) {
      return PAD + lane * COL + COL / 2;
    }

    /** Absolute y of one row, used only by the geometry helpers. */
    function laneY(index) {
      return index * ROW + ROW / 2;
    }

    /**
     * One lane change, as the polyline it is drawn from: down the source column,
     * a ramp per column the parent moves through, then down the parent's column.
     *
     * Each ramp is exactly one column wide, taken from `edge.route`, so a lane
     * change never reaches across a column another branch is still running in —
     * which is what keeps the lanes from crossing each other. The first ramp
     * leaves the source column in one of the slots the row below has clear of its
     * own node, and every later one descends, so a lane moving left is low on the
     * left and high on the right.
     */
    function edgeRuns(edge, x1, y1, x2, y2) {
      const points = [{ x: x1, y: y1 }, { x: x1, y: edge.crossing }];
      for (const step of edge.route || []) points.push({ x: laneX(step.lane), y: step.y });
      points.push({ x: x2, y: y2 });
      return points;
    }

    /** The part of one segment that lies between two horizontal lines. */
    function clipSegment(a, b, yTop, yBottom) {
      const dy = b.y - a.y;
      if (dy === 0) return a.y >= yTop && a.y <= yBottom ? [a, b] : null;
      const enter = (yTop - a.y) / dy;
      const leave = (yBottom - a.y) / dy;
      const from = Math.max(0, Math.min(enter, leave));
      const to = Math.min(1, Math.max(enter, leave));
      if (to <= from) return null;
      const at = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + dy * t });
      return [at(from), at(to)];
    }

    /**
     * One row's slice of an edge, as a path in that row's own coordinates.
     *
     * Clipping a straight polyline by y is exact, so a slice ends on the row edge
     * at precisely the point its neighbour begins on and the lane stays one
     * stroke. The ramps and both columns are one path, so their junctions are
     * joined and rounded rather than drawn as separate, butted pieces.
     */
    function rowPath(points, yTop, yBottom) {
      const kept = [];
      for (let index = 0; index < points.length - 1; index += 1) {
        const piece = clipSegment(points[index], points[index + 1], yTop, yBottom);
        if (!piece) continue;
        if (kept.length === 0) kept.push(piece[0]);
        kept.push(piece[1]);
      }
      if (kept.length < 2) return null;
      return kept
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y - yTop}`)
        .join(' ');
    }

    /** One row's slice of the graph, drawn in that row's own coordinates. */
    function GraphCell(props) {
      const { layout, index, colors, head, above } = props;
      const children = [];
      const yTop = index * ROW;
      const yBottom = yTop + ROW;
      const to = PAD + layout.width * COL + MARGIN;

      for (const edge of layout.edges) {
        if (edge.from > index || edge.to < index) continue;
        const x1 = laneX(edge.fromLane);
        const x2 = laneX(edge.toLane);
        const y1 = laneY(edge.from);
        const y2 = laneY(edge.to);
        const stroke = colors.get(edge.fromLane);
        const width = strokeWidthFor(layout, edge.from, edge.fromLane);
        const points = x1 === x2
          ? [{ x: x1, y: y1 }, { x: x1, y: y2 }]
          : edgeRuns(edge, x1, y1, x2, y2);
        const d = rowPath(points, yTop, yBottom);
        if (!d) continue;
        children.push(h('path', {
          key: `e${edge.from}:${edge.parent}:${index}`,
          d,
          fill: 'none', stroke, strokeWidth: width,
          strokeLinecap: 'round', strokeLinejoin: 'round',
        }));
      }

      const lane = layout.lanes[index];
      if (lane !== undefined) {
        // A dirty worktree puts the hollow marker on its own row, so this row
        // carries only the half of the connector that reaches up to it.
        if (above) {
          children.push(h('line', {
            key: 'working-tree-link',
            x1: laneX(lane), y1: 0, x2: laneX(lane), y2: ROW / 2,
            stroke: 'var(--dsw-alias-label-secondary)', strokeWidth: 1.6,
          }));
        }
        // The hollow circle always marks the newest change: the working tree
        // while it is dirty, otherwise this HEAD commit. An empty `fill` reveals
        // the row background through the node.
        children.push(h('circle', {
          key: 'node', cx: laneX(lane), cy: ROW / 2, r: head ? 4.5 : 4,
          fill: head ? 'var(--dsw-alias-bg-base)' : colors.get(lane),
          stroke: head ? colors.get(lane) : 'var(--dsw-alias-bg-base)',
          strokeWidth: head ? 2 : 1.6,
        }));
      }

      return h('div', { className: 'dsh-gw-gcell', style: { height: ROW } },
        h('svg', { width: to, height: ROW, viewBox: `0 0 ${to} ${ROW}`, 'aria-hidden': true }, children));
    }

    /**
     * One expanded row's slice of the graph, drawn beside the detail rather than
     * inside it.
     *
     * A detail is many rows tall, so the band between the two rows it sits
     * between holds no row slice at all: the row above ends its lane at the
     * band's top, the row below starts again at its bottom, and the two dots
     * read as unrelated. Every lane crossing that band is drawn here where it
     * enters — the x the row above ends on, which is also the x the row below
     * begins on — so a lane stays one stroke from the newest change down to the
     * oldest commit on screen.
     */
    function GraphRail(props) {
      const { layout, index, colors, worktree, width } = props;
      const lines = [];
      // The working tree's own connector crosses a band above the first commit
      // row, in the muted colour its two row-local halves already use.
      if (worktree) {
        lines.push(h('span', {
          key: 'working-tree-link',
          className: 'dsh-gw-rail-line',
          style: { left: `${laneX(0) - 0.8}px`, width: '1.6px', background: 'var(--dsw-alias-label-secondary)' },
        }));
      }
      const bandTop = (index + 1) * ROW;
      for (const edge of layout.edges) {
        if (edge.from > index || edge.to < index + 1) continue;
        const stroke = strokeWidthFor(layout, edge.from, edge.fromLane);
        const colour = colors.get(edge.fromLane);
        const key = `rail:${edge.from}:${edge.parent}`;
        const x1 = laneX(edge.fromLane);
        const x2 = laneX(edge.toLane);
        const y1 = laneY(edge.from);
        const line = (suffix, style) => lines.push(h('span', {
          key: `${key}${suffix}`,
          className: 'dsh-gw-rail-line',
          style: { background: colour, ...style },
        }));
        if (x1 === x2 || edge.crossing <= bandTop) {
          // The lane is already on its target column for this whole band.
          line('', { left: `${x2 - stroke / 2}px`, width: `${stroke}px` });
          continue;
        }
        // The edge leaves the row above the band, so its ramp falls inside the
        // band: the same columns and the same drop, measured from the rail's top,
        // drawn from the same polyline the row slices clip.
        const across = edge.crossing - bandTop;
        const ramp = edgeRuns(edge, x1, y1, x2, laneY(edge.to));
        const rise = ramp[2].y - ramp[1].y;
        line(':down', { left: `${x1 - stroke / 2}px`, width: `${stroke}px`, top: '0px', height: `${across}px`, bottom: 'auto' });
        if (rise > 0) {
          lines.push(h('svg', {
            key: `${key}:ramp`,
            className: 'dsh-gw-rail-turn',
            style: { left: '0px', top: `${across}px`, width: `${width}px`, height: `${rise}px` },
            viewBox: `0 0 ${width} ${rise}`,
            'aria-hidden': true,
          }, h('line', {
            x1, y1: 0, x2, y2: rise,
            stroke: colour, strokeWidth: stroke, strokeLinecap: 'round',
          })));
        }
        line(':onward', { left: `${x2 - stroke / 2}px`, width: `${stroke}px`, top: `${across + rise}px`, bottom: '0px' });
      }
      return h('div', { className: 'dsh-gw-rail', style: { width }, 'aria-hidden': true }, lines);
    }

    /**
     * The panel under one expanded row: the graph's rail beside the detail.
     *
     * The row is drawn even with the graph column hidden: it carries the detail's
     * tint, its separator, and the cap on how tall the detail may grow. Only the
     * rail is absent then, so the detail keeps the full width.
     */
    function DetailRegion(props) {
      const { rail, max, children } = props;
      return h('div', {
        className: 'dsh-gw-detailrow',
        style: { '--dsh-gw-detail-max': `${max}px` },
      },
        rail || null,
        h('div', { className: 'dsh-gw-detailbody' }, children));
    }

    /**
     * Accept a ref as either the current `{name, kind, current}` object or the
     * bare name string an older Host half returns. The two halves update
     * independently — a bundle swap can leave one behind the other — so a reader
     * normalizes instead of trusting the wire shape.
     */
    function normalizeRef(ref) {
      if (typeof ref === 'string') return { name: ref, kind: 'branch', current: false };
      if (ref && typeof ref === 'object') {
        return {
          name: String(ref.name ?? ''),
          kind: String(ref.kind ?? 'branch'),
          current: Boolean(ref.current),
          // The worktree chip's second cell is the branch it absorbed, which is
          // decided before this point — normalizing must not drop it, or the chip
          // falls back to the detached form.
          holdsBranch: typeof ref.holdsBranch === 'string' && ref.holdsBranch ? ref.holdsBranch : null,
          linkedRemotes: Array.isArray(ref.linkedRemotes)
            ? ref.linkedRemotes.map((remote) => ({
                name: String(remote.name ?? ''),
                fullName: String(remote.fullName ?? remote.name ?? ''),
              })).filter((remote) => remote.name)
            : [],
        };
      }
      return null;
    }

    function GraphBranchGlyph(props = {}) {
      const size = props.size || 14;
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        h('g', { transform: props.flipVertical ? 'translate(0 16) scale(1 -1)' : undefined },
          h('circle', { cx: 4, cy: 4, r: 2 }),
          h('circle', { cx: 4, cy: 12, r: 2 }),
          h('circle', { cx: 12, cy: 8, r: 2 }),
          h('path', { d: 'M4 6v4M6 4h3a3 3 0 0 1 3 3v1' })));
    }

    function BranchRefIcon(props = {}) {
      return h(GraphBranchGlyph, { ...props, flipVertical: true });
    }

    function GraphToggleIcon() {
      return h(GraphBranchGlyph, { size: 14 });
    }

    /**
     * The worktree's own ref and the branch it holds describe one commit, so they
     * render as one chip. The branch — with whatever remote mirrors were already
     * merged into it — moves into the worktree ref, which is what `holdsBranch`
     * and `linkedRemotes` describe. Detached, there is no branch to name and the
     * chip stays as it is, to be drawn as the position it is.
     */
    function mergeWorktreeBranch(refs, branch) {
      const worktree = refs.find((ref) => ref.kind === 'worktree');
      if (!worktree || !branch) return refs;
      const held = refs.find((ref) => ref.kind === 'branch' && ref.name === branch);
      if (!held) return refs;
      worktree.holdsBranch = held.name;
      worktree.linkedRemotes = held.linkedRemotes || [];
      worktree.current = held.current;
      return refs.filter((ref) => ref !== held);
    }

    /**
     * A detached HEAD's marker: the same hollow ring the graph draws on the node
     * for the worktree's HEAD. The chip's icon then says exactly what the lane
     * says — this position is the newest change and no branch names it.
     */
    function HeadRingGlyph(props = {}) {
      const size = props.size || 14;
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true,
      },
        h('circle', { cx: 8, cy: 8, r: 4.5 }));
    }

    function RefChip(props) {
      // `ref` is reserved by React and is not forwarded to function-component
      // props. Keep the wire object under an ordinary prop name.
      const ref = normalizeRef(props.gitRef);
      if (!ref || !ref.name) return null;
      const linkedRemotes = Array.isArray(ref.linkedRemotes) ? ref.linkedRemotes : [];
      const laneStyle = { '--dsh-gw-ref-color': props.laneColor };
      if (ref.kind === 'worktree') {
        // One chip in two cells whatever the worktree holds: its own label in the
        // inverted fill, then the position it sits on in that commit's lane
        // colour — the branch it holds, or HEAD when nothing is checked out, so
        // the chip always says which worktree it is about.
        const held = ref.holdsBranch;
        return h('span', {
          className: 'dsh-gw-ref dsh-gw-ref-worktree',
          title: [
            held ? `worktree: ${held}` : 'worktree: HEAD (no branch checked out)',
            ...linkedRemotes.map((remote) => `remote: ${remote.fullName}`),
          ].join('\n'),
          style: laneStyle,
        },
          h('span', { className: 'dsh-gw-ref-worktree-label' }, 'worktree'),
          h('span', { className: 'dsh-gw-ref-worktree-held' },
            h('span', { className: 'dsh-gw-ref-worktree-icon' },
              held ? h(BranchRefIcon, { size: 14 }) : h(HeadRingGlyph, { size: 14 })),
            h('span', { className: 'dsh-gw-ref-worktree-name' }, held || 'HEAD'),
            linkedRemotes.map((remote) => h('span', {
              key: remote.fullName,
              className: 'dsh-gw-ref-worktree-remote',
            }, remote.name))));
      }
      const className = `dsh-gw-ref dsh-gw-ref-${ref.kind}${ref.current && ref.kind === 'branch' ? ' dsh-gw-ref-current' : ''}`;
      const branchLike = ref.kind === 'branch' || ref.kind === 'remote';
      return h('span', {
        className,
        title: [`${ref.kind}: ${ref.name}`, ...linkedRemotes.map((remote) => `remote: ${remote.fullName}`)].join('\n'),
        style: branchLike ? laneStyle : undefined,
      }, branchLike
        ? h(React.Fragment, null,
          h('span', { className: 'dsh-gw-ref-icon' }, h(BranchRefIcon, { size: 14 })),
          h('span', { className: 'dsh-gw-ref-name' }, ref.name),
          linkedRemotes.map((remote) => h('span', {
            key: remote.fullName,
            className: 'dsh-gw-ref-remote-name',
          }, remote.name)))
        : ref.kind === 'tag' ? `⌂ ${ref.name}` : ref.name);
    }

    /** Insert one changed file into a nested tree, directories first. */
    function buildFileTree(files) {
      const root = { name: '', dirs: new Map(), files: [] };
      for (const file of files) {
        const parts = String(file.path || '').split('/').filter(Boolean);
        let node = root;
        for (let i = 0; i < parts.length - 1; i += 1) {
          if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { name: parts[i], dirs: new Map(), files: [] });
          node = node.dirs.get(parts[i]);
        }
        node.files.push({ name: parts[parts.length - 1] || file.path, file });
      }
      return root;
    }

    function FileTree(props) {
      const [collapsed, setCollapsed] = React.useState({});
      const { files } = props;
      const root = React.useMemo(() => buildFileTree(files), [files]);
      const rows = [];
      const walk = (node, depth, prefix, key) => {
        const dirs = [...node.dirs.values()].sort((left, right) => left.name.localeCompare(right.name));
        for (const dir of dirs) {
          const path = prefix ? `${prefix}/${dir.name}` : dir.name;
          const isCollapsed = collapsed[path];
          const count = countFiles(dir);
          rows.push(h('div', {
            key: `d:${path}`,
            className: 'dsh-gw-frow',
            style: { paddingLeft: `${depth * 13}px` },
            onClick: (event) => {
              event.stopPropagation();
              setCollapsed((current) => ({ ...current, [path]: !current[path] }));
            },
          },
            h('span', null, isCollapsed ? '▸' : '▾'),
            h('span', { className: 'dsh-gw-fname' }, dir.name),
            h('span', { className: 'dsh-gw-fstat' }, h('span', { className: 'dsh-gw-stat' }, `${count}`))));
          if (!isCollapsed) walk(dir, depth + 1, path, key);
        }
        const sorted = [...node.files].sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of sorted) {
          const file = entry.file;
          rows.push(h('div', {
            key: `f:${prefix}/${entry.name}`,
            className: 'dsh-gw-frow',
            style: { paddingLeft: `${depth * 13}px` },
            title: file.path,
          },
            h('span', null, '·'),
            h('span', { className: 'dsh-gw-fname' }, entry.name),
            h('span', { className: 'dsh-gw-fstat' },
              file.untracked
                ? h('span', { className: 'dsh-gw-stat' }, '新')
                : [
                    h('span', { key: 'a', className: 'dsh-gw-add' }, `+${file.add}`),
                    h('span', { key: 'd', className: 'dsh-gw-del' }, `-${file.del}`),
                  ])));
        }
      };
      walk(root, 0, '', '');
      return h('div', { className: 'dsh-gw-ftree' }, rows);
    }

    function countFiles(node) {
      let total = node.files.length;
      for (const dir of node.dirs.values()) total += countFiles(dir);
      return total;
    }

    /** The expanded panel under a commit row: metadata beside the changed files. */
    function CommitDetail(props) {
      const { repo, oid, sessionId, narrow } = props;
      const [state, setState] = React.useState({ status: 'loading' });
      React.useEffect(() => {
        const controller = new AbortController();
        let alive = true;
        setState({ status: 'loading' });
        api('commit', { repo, oid }, sessionId, controller.signal)
          .then((data) => { if (alive) setState({ status: 'ready', data }); })
          .catch((error) => {
            if (!alive || controller.signal.aborted) return;
            setState({ status: 'failed', error: error.message });
          });
        return () => { alive = false; controller.abort(); };
      }, [repo, oid, sessionId]);

      const data = state.data;
      const legacy = data && typeof data.text === 'string' && !Array.isArray(data.parents);
      const left = h('div', { className: 'dsh-gw-detail-left' },
        state.status === 'loading' ? h('div', { className: 'dsh-gw-msg' }, '读取中…') : null,
        state.status === 'failed' ? h('div', { className: 'dsh-gw-error' }, state.error) : null,
        legacy ? h('pre', { className: 'dsh-gw-legacy' }, data.text) : null,
        data && !legacy ? h('div', { className: 'dsh-gw-kv' },
          h('span', { className: 'dsh-gw-k' }, 'Commit'), h('span', { className: 'dsh-gw-v dsh-gw-mono' }, data.oid),
          h('span', { className: 'dsh-gw-k' }, 'Parents'), h('span', { className: 'dsh-gw-v dsh-gw-mono' },
            data.parents.length > 0 ? data.parents.map(shortOid).join(', ') : 'None'),
          h('span', { className: 'dsh-gw-k' }, 'Author'), h('span', { className: 'dsh-gw-v' },
            `${data.author.name} <${data.author.email}>`),
          h('span', { className: 'dsh-gw-k' }, 'Committer'), h('span', { className: 'dsh-gw-v' },
            `${data.committer.name} <${data.committer.email}>`),
          h('span', { className: 'dsh-gw-k' }, 'Date'), h('span', { className: 'dsh-gw-v' },
            `${new Date(data.authoredAt).toString()} (${relativeTime(data.authoredAt)})`)) : null,
        data && data.body ? h('div', { className: 'dsh-gw-body' }, data.body) : null);

      const right = h('div', { className: 'dsh-gw-detail-right' },
        data && !legacy ? h('div', { className: 'dsh-gw-stat' },
          `${data.summary.changed} 个文件变更`,
          data.summary.insertions > 0 ? h('span', { className: 'dsh-gw-add' }, ` (+${data.summary.insertions})`) : null,
          data.summary.deletions > 0 ? h('span', { className: 'dsh-gw-del' }, ` (-${data.summary.deletions})`) : null) : null,
        data && !legacy && data.files.length > 0 ? h(FileTree, { files: data.files }) : null);

      return h('div', { className: `dsh-gw-detail${narrow || legacy ? ' dsh-gw-detail-narrow' : ''}` }, left, legacy ? null : right);
    }

    /** The working tree as the graph's first row, shaped like a commit. */
    function UncommittedDetail(props) {
      const { repo, worktree, sessionId, narrow, supportsStructured } = props;
      const [state, setState] = React.useState({ status: 'loading' });
      React.useEffect(() => {
        const controller = new AbortController();
        let alive = true;
        // Capability negotiation happens on the worktrees response. An older
        // Host never receives a request for a route it does not have, keeping
        // the browser console free of an expected-but-noisy 404.
        const read = supportsStructured
          ? api('uncommitted', { repo, worktree }, sessionId, controller.signal)
          : api('diff', { repo, worktree }, sessionId, controller.signal);
        read
          .then((data) => { if (alive) setState({ status: supportsStructured ? 'ready' : 'legacy', data }); })
          .catch(async (error) => {
            if (!alive || controller.signal.aborted) return;
            // A linked bundle can refresh its browser half while the running
            // Host still serves the previous route set. Fall back to the old
            // text diff until the Host is restarted.
            if (supportsStructured && /HTTP 404/.test(error.message)) {
              try {
                const data = await api('diff', { repo, worktree }, sessionId, controller.signal);
                if (alive) setState({ status: 'legacy', data });
                return;
              } catch (fallbackError) {
                if (!alive || controller.signal.aborted) return;
                setState({ status: 'failed', error: fallbackError.message });
                return;
              }
            }
            setState({ status: 'failed', error: error.message });
          });
        return () => { alive = false; controller.abort(); };
      }, [repo, worktree, sessionId, supportsStructured]);
      const data = state.data;
      return h('div', { className: `dsh-gw-detail${narrow ? ' dsh-gw-detail-narrow' : ''}` },
        h('div', { className: 'dsh-gw-detail-left' },
          state.status === 'loading' ? h('div', { className: 'dsh-gw-msg' }, '读取中…') : null,
          state.status === 'failed' ? h('div', { className: 'dsh-gw-error' }, state.error) : null,
          state.status === 'legacy' ? h('div', { className: 'dsh-gw-msg' }, '当前 Host 尚未重载，暂时显示文本差异。') : null,
          state.status === 'ready' && data ? h('div', { className: 'dsh-gw-kv' },
            h('span', { className: 'dsh-gw-k' }, 'Branch'), h('span', { className: 'dsh-gw-v dsh-gw-mono' },
              data.unborn ? '(尚无提交)' : data.branch),
            h('span', { className: 'dsh-gw-k' }, 'Path'), h('span', { className: 'dsh-gw-v' }, data.path),
            h('span', { className: 'dsh-gw-k' }, 'Changes'), h('span', { className: 'dsh-gw-v' },
              `${data.summary.changed} 个文件`,
              data.summary.insertions > 0 ? h('span', { className: 'dsh-gw-add' }, ` (+${data.summary.insertions})`) : null,
              data.summary.deletions > 0 ? h('span', { className: 'dsh-gw-del' }, ` (-${data.summary.deletions})`) : null)) : null),
        h('div', { className: 'dsh-gw-detail-right' },
          h('div', { className: 'dsh-gw-stat' }, '工作区内未被提交的改动'),
          state.status === 'legacy' && data
            ? h('pre', { className: 'dsh-gw-legacy' }, [data.stat, data.patch].filter(Boolean).join('\n\n'))
            : null,
          state.status === 'ready' && data && data.files.length > 0 ? h(FileTree, { files: data.files }) : null));
    }

    /** A visible failure inside the tab, so a broken repository never blanks the panel. */
    class Boundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) {
        return { error };
      }
      render() {
        if (this.state.error) {
          return h('div', { className: 'dsh-gw' },
            h('div', { className: 'dsh-gw-error' }, `Git Worktree 面板渲染失败：${this.state.error.message}`));
        }
        return this.props.children;
      }
    }

    function WorktreeTab(props) {
      const info = typeof props.tabInfo === 'function' ? props.tabInfo() : null;
      const tab = info ? info.tab : null;
      const sessionId = tab ? tab.sessionId : (props.sessionId || 'current');
      const navigate = tab && tab.navigation ? tab.navigation.params : null;

      const saved = viewState.get(sessionId) || {};
      const [state, setState] = React.useState({
        status: 'loading', repo: null, resolved: false, worktrees: [],
        graph: null, nodes: [], capabilities: [], error: null, sessionId: null, more: false,
        // A page that came back shorter than the one asked for is the end of the
        // history. The Host answers no "has more" field, so the requested page
        // size is the only thing separating "stopped here" from "that is all
        // there is" — without it a two-commit repository was offered a button
        // that could only ever fetch nothing.
        exhausted: false,
      });
      const [selected, setSelected] = React.useState(null);
      const [scope, setScope] = React.useState(saved.scope || 'all');
      const [showRemote, setShowRemote] = React.useState(Boolean(saved.showRemote));
      const [showGraph, setShowGraph] = React.useState(saved.showGraph !== false);
      const [openKey, setOpenKey] = React.useState(null);
      const [reloadKey, setReloadKey] = React.useState(0);
      const [width, setWidth] = React.useState(900);
      const [height, setHeight] = React.useState(720);

      // "Show Remote Branches" scopes the history itself, not only the labels:
      // unchecked, the Host walks local refs and drops remote-only commits.
      const remoteParam = showRemote ? '1' : '0';

      const repo = (navigate && navigate.repo)
        || (state.sessionId === sessionId ? state.repo : null)
        || null;

      // This panel is a user-resizable column, a split pane or a float, so every
      // column decision follows its own measured width — and how tall an expanded
      // detail may grow follows its measured height the same way.
      const rootRef = React.useRef(null);
      React.useEffect(() => {
        const node = rootRef.current;
        if (!node) return undefined;
        const measure = () => {
          setWidth(node.clientWidth || 900);
          setHeight(node.clientHeight || 720);
        };
        if (typeof ResizeObserver !== 'function') {
          measure();
          return undefined;
        }
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        measure();
        return () => observer.disconnect();
      }, []);

      React.useEffect(() => {
        viewState.set(sessionId, { scope, showRemote, showGraph });
      }, [sessionId, scope, showRemote, showGraph]);

      // Resolve the repository at most once per session. `repo` is both an input
      // and an output of this effect, so without the `resolved` guard a second
      // pass would land after the graph read and blank it.
      React.useEffect(() => {
        if (state.resolved && state.sessionId === sessionId) return undefined;
        const controller = new AbortController();
        let alive = true;
        // The first read after a Host restart can arrive before the Host knows this
        // Session, which has no working directory to answer with. That is a moment,
        // not an answer: the panel used to sit on "No Git repository found" until
        // the tab was reloaded by hand.
        const resolve = async () => {
          for (let attempt = 0; ; attempt += 1) {
            try {
              return await api('worktrees', { repo }, sessionId, controller.signal);
            } catch (error) {
              if (!alive || controller.signal.aborted || attempt >= RESOLVE_ATTEMPTS) throw error;
              await new Promise((resolveWait) => setTimeout(resolveWait, RESOLVE_BACKOFF_MS * (attempt + 1)));
            }
          }
        };
        resolve()
          .then((data) => {
            if (!alive) return;
            // The panel reads one worktree and never offers another: the one the
            // Session's own working directory sits in. `rev-parse --show-toplevel`
            // answers exactly that, so `repo.root` is the current worktree even
            // when it is a linked one.
            const current = data.worktrees.find((item) => samePath(item.path, data.repo.root))
              || data.worktrees[0]
              || null;
            if (current) setSelected(current.path);
            setState((previous) => ({
              ...previous,
              status: 'ready',
              repo: data.repo.root,
              resolved: true,
              worktrees: data.worktrees,
              capabilities: Array.isArray(data.capabilities) ? data.capabilities : [],
              error: null,
              sessionId,
            }));
          })
          .catch((error) => {
            if (!alive || controller.signal.aborted) return;
            setState((previous) => ({ ...previous, status: 'failed', error: error.message }));
          });
        return () => { alive = false; controller.abort(); };
      }, [reloadKey, sessionId, state.resolved]);

      // The first page of the graph. A refresh replaces it only once the new
      // answer arrives, so a failed re-read keeps the last good graph.
      React.useEffect(() => {
        if (!repo || !selected) return undefined;
        const controller = new AbortController();
        let alive = true;
        api('graph', { repo, worktree: selected, scope, remote: remoteParam, limit: PAGE }, sessionId, controller.signal)
          .then((data) => {
            if (!alive) return;
            setState((previous) => ({
              ...previous,
              graph: data,
              nodes: data.nodes,
              exhausted: data.nodes.length < PAGE,
              error: null,
            }));
          })
          .catch((error) => {
            if (!alive || controller.signal.aborted) return;
            setState((previous) => ({ ...previous, error: error.message }));
          });
        return () => { alive = false; controller.abort(); };
      }, [repo, selected, scope, remoteParam, reloadKey]);

      const loadMore = React.useCallback(() => {
        if (!repo || !selected || state.more || state.exhausted) return;
        setState((previous) => ({ ...previous, more: true }));
        api('graph', { repo, worktree: selected, scope, remote: remoteParam, limit: PAGE, skip: state.nodes.length }, sessionId)
          .then((data) => {
            setState((previous) => ({
              ...previous,
              more: false,
              exhausted: data.nodes.length < PAGE,
              // Lane numbers continue across pages, so appending keeps every
              // earlier row exactly where it was drawn.
              nodes: previous.nodes.concat(data.nodes),
            }));
          })
          .catch((error) => {
            setState((previous) => ({ ...previous, more: false, error: error.message }));
          });
      }, [repo, selected, scope, remoteParam, sessionId, state.more, state.exhausted, state.nodes.length]);

      const onToggle = React.useCallback((key) => {
        setOpenKey((current) => (current === key ? null : key));
      }, []);

      const nodes = state.nodes || [];
      const layout = React.useMemo(() => layoutLanes(nodes), [nodes]);
      const current = state.worktrees.find((item) => samePath(item.path, selected)) || null;
      const changeCount = current && current.status ? current.status.entries : 0;
      const dirty = changeCount > 0;
      // The commit the displayed worktree's HEAD sits on: the Host answers it as
      // `head`, so the row can be marked without walking refs on the client.
      const headOid = state.graph ? state.graph.head : null;
      // The branch this worktree holds, or null when its HEAD is detached. The
      // Host answers it on the graph, so the chip needs no second lookup.
      const worktreeBranch = state.graph ? state.graph.branch : null;
      // The working tree's row sits directly above the first commit row, so the
      // two halves of the connector only line up while that first row is HEAD.
      // A line to any other commit would claim a relation the history lacks.
      const worktreeLink = dirty && Boolean(headOid) && nodes.length > 0 && nodes[0].id === headOid;

      // Only lanes this page actually draws get a column, so the text columns do
      // not sit behind lanes reserved for commits that were never fetched.
      const colors = new Map();
      for (const lane of layout.lanes) {
        if (colors.has(lane)) continue;
        colors.set(lane, LANE_COLORS[lane % LANE_COLORS.length]);
      }
      // Keep the Graph header readable for a one-lane repository; additional
      // lanes expand the column naturally.
      const graphWidth = Math.max(64, PAD + layout.width * COL + MARGIN);
      // How tall one expanded detail may grow: a share of the panel, floored so a
      // short panel still shows its first rows and capped so a tall one does not
      // open a detail that fills the whole column.
      const detailMax = Math.max(
        DETAIL_MAX_FLOOR,
        Math.min(DETAIL_MAX_CEILING, Math.round(height * DETAIL_MAX_SHARE)),
      );

      const showDate = width > W_DATE;
      const showAuthor = width > W_AUTHOR;
      const showCommit = width > W_COMMIT;
      const columns = [
        ...(showGraph ? [`${graphWidth}px`] : []),
        'minmax(0, 1fr)',
        ...(showDate ? ['132px'] : []),
        ...(showAuthor ? ['130px'] : []),
        ...(showCommit ? ['82px'] : []),
      ].join(' ');

      // Which worktree this panel is reading. It is a statement of context, not a
      // control: the panel always follows the Session's own working directory, so
      // there is nothing to choose. The path names the worktree, because two of
      // them can sit on the same branch line and the path is the one thing only
      // one of them owns; the branch rides along in the tooltip. The chip carries
      // no "Worktree:" caption of its own: it is the toolbar's only statement of
      // context, so the caption spent width on a word nothing needed to
      // disambiguate it from.
      const toolbar = h('div', { className: 'dsh-gw-tbar' },
        current
          ? h('span', {
              className: 'dsh-gw-wt dsh-gw-wt-current',
              key: 'wt-path',
              title: `${current.path} — ${current.branch || '(detached)'}${current.error ? ` — ${current.error}` : ''}`,
            },
              // The dot's colour is the worktree's state: amber while it has
              // uncommitted changes, green once it is clean, and error when the
              // Host could not read it at all. `status` is null for a bare or
              // prunable worktree and when `git status` fails, and dressing that
              // as "clean" would be a claim the panel cannot make.
              h('span', {
                className: `dsh-gw-dot${!current.status ? ' dsh-gw-dot-unknown' : current.status.dirty ? '' : ' dsh-gw-dot-clean'}`,
              }),
              h('span', { className: 'dsh-gw-subjtext' }, compactPath(current.path)))
          : null,
        h('label', { className: 'dsh-gw-check', title: '显示远程分支引用，并包含仅存在于远程的提交' },
          h('input', {
            type: 'checkbox', checked: showRemote,
            onChange: (event) => setShowRemote(event.target.checked),
          }), 'Show Remote Branches'),
        h('span', { className: 'dsh-gw-spacer' }),
        h('div', { className: 'dsh-gw-icons' },
          h('button', {
            type: 'button', className: 'dsh-gw-iconbtn', title: showGraph ? '隐藏提交图列' : '显示提交图列',
            onClick: () => setShowGraph((value) => !value),
          }, h(GraphToggleIcon)),
          h('button', {
            type: 'button', className: 'dsh-gw-iconbtn', title: '重新读取',
            disabled: state.status === 'loading',
            onClick: () => {
              setState((previous) => ({ ...previous, status: 'loading', resolved: false, error: null }));
              setReloadKey((key) => key + 1);
              setOpenKey(null);
            },
          }, h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
            h('path', { d: 'M13 8a5 5 0 1 1-1.6-3.7M13 2v3h-3' })))));

      const head = [];
      head.push(toolbar);

      if (state.error) head.push(h('div', { className: 'dsh-gw-error', key: 'error' }, state.error));
      if (state.status === 'loading') head.push(h('div', { className: 'dsh-gw-msg', key: 'loading' }, '读取仓库中…'));

      const grid = [];
      grid.push(h('div', { className: 'dsh-gw-hrow', key: 'hrow', style: { '--dsh-gw-cols': columns } },
        showGraph ? h('div', { className: 'dsh-gw-hcell' }, 'Graph') : null,
        h('div', { className: 'dsh-gw-hcell' }, 'Description'),
        showDate ? h('div', { className: 'dsh-gw-hcell' }, 'Date') : null,
        showAuthor ? h('div', { className: 'dsh-gw-hcell' }, 'Author') : null,
        showCommit ? h('div', { className: 'dsh-gw-hcell' }, 'Commit') : null));

      // The working tree rides the graph as its own row, above the newest commit.
      // A clean worktree has nothing to show, so the row is absent instead of
      // sitting there as a dead entry that expands into an empty detail.
      if (state.repo && state.status === 'ready' && changeCount > 0) {
        grid.push(h('div', {
          key: 'uncommitted',
          className: `dsh-gw-row dsh-gw-rowmid${openKey === 'uncommitted' ? ' dsh-gw-row-open' : ''}`,
          style: { '--dsh-gw-cols': columns },
          role: 'button', tabIndex: 0, 'aria-expanded': openKey === 'uncommitted',
          onClick: () => onToggle('uncommitted'),
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle('uncommitted'); }
          },
        },
          showGraph ? h('div', { className: 'dsh-gw-gcell' }, h('svg', {
            width: graphWidth, height: ROW, 'aria-hidden': true,
          },
            worktreeLink
              ? h('line', { x1: laneX(0), y1: ROW / 2, x2: laneX(0), y2: ROW, stroke: 'var(--dsw-alias-label-secondary)', strokeWidth: 1.6 })
              : null,
            h('circle', { cx: laneX(0), cy: ROW / 2, r: 4.5, fill: 'var(--dsw-alias-bg-base)', stroke: 'var(--dsw-alias-label-secondary)', strokeWidth: 2 }))) : null,
          h('div', { className: 'dsh-gw-cell' },
            h('span', { className: 'dsh-gw-subjtext dsh-gw-uncommitted' },
              `Uncommitted Changes (${changeCount})`),
            h('span', { className: 'dsh-gw-dot', style: { marginLeft: '6px' } })),
          showDate ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec' }, '') : null,
          showAuthor ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec' }, '') : null,
          showCommit ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec' }, '') : null));
        if (openKey === 'uncommitted') {
          grid.push(h(DetailRegion, {
            key: 'uncommitted-detail',
            max: detailMax,
            // The working tree's row is not a lane of its own, so its band
            // carries the connector instead: `index: -1` matches no edge.
            rail: showGraph
              ? h(GraphRail, { layout, index: -1, colors, worktree: worktreeLink, width: graphWidth })
              : null,
          }, h(UncommittedDetail, {
            repo: state.repo, worktree: selected, sessionId,
            narrow: width < W_DETAIL_SPLIT,
            supportsStructured: state.capabilities.includes('uncommitted-v1'),
          })));
        }
      }

      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        const laneColor = colors.get(layout.lanes[index]) || LANE_COLORS[0];
        const isHead = Boolean(headOid) && node.id === headOid;
        // A row is read for the local branches on the commit and for whether the
        // worktree is there; tags, stashes and remote mirrors are not drawn. The
        // Host sends nothing else, and the filter is repeated here because a bundle
        // swap can leave the browser half ahead of its Host.
        const visibleRefs = (node.refs || []).map(normalizeRef).filter(Boolean)
          .filter((ref) => ref.kind === 'branch' || ref.kind === 'worktree')
          // The current-worktree chip leads the Description cell. Stable sort so
          // the rest keeps the Host's order even when an older Host appends the
          // worktree ref after the branches.
          .sort((left, right) => (right.kind === 'worktree') - (left.kind === 'worktree'));
        // The worktree's own ref absorbs the branch it holds, so the two facts
        // about this commit read as one chip instead of two.
        const refs = mergeWorktreeBranch(visibleRefs, worktreeBranch);
        // The "+N" badge is the Host's count minus what was drawn, so it only means
        // anything while both halves agree on what a row draws. A Host that predates
        // this policy counts tags, stashes and mirrors too, and no badge is better
        // than one promising refs this browser half will not draw.
        const counted = (node.refs || []).every((ref) => ref.kind === 'branch' || ref.kind === 'worktree');
        const hiddenRefs = counted ? node.refCount - visibleRefs.length : 0;
        grid.push(h('div', {
          key: node.id,
          className: `dsh-gw-row dsh-gw-rowmid${isHead ? ' dsh-gw-row-head' : ''}${openKey === node.id ? ' dsh-gw-row-open' : ''}`,
          style: { '--dsh-gw-cols': columns },
          role: 'button', tabIndex: 0, 'aria-expanded': openKey === node.id,
          onClick: () => onToggle(node.id),
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle(node.id); }
          },
          title: `${shortOid(node.id)} ${node.subject}`,
        },
          showGraph ? h(GraphCell, {
            layout, index, colors,
            head: isHead && !dirty,
            above: worktreeLink && index === 0,
          }) : null,
          h('div', { className: 'dsh-gw-cell' },
            h('div', { className: 'dsh-gw-subj' },
              refs.map((ref) => h(RefChip, {
                key: `${ref.kind}:${ref.name}`, gitRef: ref, laneColor,
              })),
              hiddenRefs > 0
                ? h('span', { className: 'dsh-gw-ref', title: '还有更多本地分支' }, `+${hiddenRefs}`)
                : null,
              h('span', { className: 'dsh-gw-subjtext' }, node.subject || '(无提交说明)'))),
          showDate ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec', title: absoluteTime(node.authoredAt) },
            absoluteTime(node.authoredAt)) : null,
          showAuthor ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec' }, node.author || '') : null,
          showCommit ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-mono' }, shortOid(node.id)) : null));

        if (openKey === node.id) {
          grid.push(h(DetailRegion, {
            key: `${node.id}-detail`,
            max: detailMax,
            rail: showGraph ? h(GraphRail, { layout, index, colors, width: graphWidth }) : null,
          }, h(CommitDetail, {
            repo: state.repo,
            oid: node.id,
            sessionId,
            narrow: width < W_DETAIL_SPLIT,
          })));
        }
      }

      // The next page is offered only while one exists: a repository shorter
      // than a page used to carry a button that could only fetch nothing.
      if (state.status === 'ready' && nodes.length > 0 && state.graph && !state.exhausted) {
        grid.push(h('div', { className: 'dsh-gw-more', key: 'more', style: { padding: '8px', textAlign: 'center' } },
          h('button', { type: 'button', className: 'dsh-gw-btn', disabled: state.more, onClick: loadMore },
            state.more ? '读取中…' : '加载更多')));
      }

      if (state.status === 'ready' && state.graph && state.graph.unborn) {
        grid.push(h('div', { className: 'dsh-gw-empty', key: 'unborn' }, '该仓库尚无提交，只有未提交的改动。'));
      } else if (state.status === 'ready' && !state.repo) {
        grid.push(h('div', { className: 'dsh-gw-empty', key: 'norepo' }, '没有可用的仓库路径。'));
      } else if (state.status === 'ready' && nodes.length === 0) {
        grid.push(h('div', {
          className: 'dsh-gw-empty',
          key: 'empty',
          title: JSON.stringify({ root: state.repo, selected, scope }),
        }, state.graph ? '该范围内没有可显示的提交。' : '提交图仍在读取，或最后一次读取失败。'));
      }

      return h('div', { className: 'dsh-gw', ref: rootRef },
        h('style', null, CSS),
        head,
        h('div', { className: 'dsh-gw-scroll' },
          h('div', { className: 'dsh-gw-grid' }, grid)));
    }

    function WorktreeTitle(props) {
      const info = typeof props.tabInfo === 'function' ? props.tabInfo() : null;
      const branch = info && info.tab && info.tab.navigation ? info.tab.navigation.params.branch : null;
      return h('span', { className: 'dsh-gw-subjtext' }, branch ? `Git · ${branch}` : 'Git Worktree');
    }

    const GuideIcon = () => h('svg', {
      viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true,
      fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
    },
      h('circle', { cx: 4, cy: 4, r: 2 }),
      h('circle', { cx: 4, cy: 12, r: 2 }),
      h('circle', { cx: 12, cy: 8, r: 2 }),
      h('path', { d: 'M4 6v4M6 4h3a3 3 0 0 1 3 3v1' }));

    return {
      inject: ['slots', 'sidebarRightTabs'],
      apply(ctx) {
        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: NS,
          kind: KIND,
          multiple: false,
          priority: 'builtin',
          title: () => 'Git Worktree',
          guide: [{
            id: 'open',
            order: 60,
            title: () => 'Git Worktree',
            description: () => '浏览当前工作区的 worktree、分支与提交图',
            icon: GuideIcon,
          }],
        }), 'dsh-git-worktree: tab type');

        ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: NS,
        }, (props) => h(Boundary, null, h(WorktreeTab, { ...props }))));

        ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab.title',
          key: NS,
        }, WorktreeTitle));
      },
    };
  },
});
