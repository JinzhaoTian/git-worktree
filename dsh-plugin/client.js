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
 * its own metadata beside a file tree. Layout is driven by the panel's measured
 * width, because this panel is a resizable column, a split pane or a float.
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
    // Width breakpoints, measured on the panel itself.
    const W_DATE = 560;
    const W_AUTHOR = 700;
    const W_COMMIT = 820;
    const W_DETAIL_SPLIT = 680;

    // Lane artwork. Literal colors are deliberate: these identify a branch, not
    // a UI surface, and each one is legible on both theme backgrounds.
    const LANE_COLORS = ['#2f8ae0', '#d0569b', '#38a169', '#d98a2b', '#8b72e0', '#0fa8ad', '#c05252', '#7a8b2f'];
    const DIFF_ADD = '#3fa34d';
    const DIFF_DEL = '#d05a4e';

    // Selected worktree per Session, so returning to the tab restores the view.
    const selection = new Map();
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
.dsh-gw-crumbs { display: flex; flex-wrap: wrap; gap: 4px; padding: 5px 8px 0; }
.dsh-gw-wt { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; height: 20px; padding: 0 7px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font: inherit; cursor: pointer; }
.dsh-gw-wt-root { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.dsh-gw-wt-active { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
.dsh-gw-dot { flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary); }
.dsh-gw-msg { padding: 5px 10px; color: var(--dsw-alias-label-secondary); border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-gw-error { margin: 8px 10px; padding: 6px 8px; border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 6px; color: var(--dsw-alias-state-error-primary); white-space: pre-wrap; word-break: break-word; }
.dsh-gw-empty { padding: 16px 10px; color: var(--dsw-alias-label-secondary); text-align: center; }

.dsh-gw-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
.dsh-gw-grid { display: flex; flex-direction: column; min-width: 100%; }
.dsh-gw-hrow { position: sticky; top: 0; z-index: 2; display: grid; grid-template-columns: var(--dsh-gw-cols); align-items: center; height: 26px; background: var(--dsw-alias-bg-layer-1); border-bottom: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); font-weight: 600; }
.dsh-gw-hcell { padding: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-gw-row { display: grid; grid-template-columns: var(--dsh-gw-cols); align-items: center; min-height: 26px; border-bottom: 1px solid var(--dsw-specific-sidebar-fill); border-left: 2px solid transparent; cursor: pointer; outline: none; }
.dsh-gw-row:hover { background: var(--dsw-alias-bg-layer-1); }
.dsh-gw-row:focus-visible { box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary); }
.dsh-gw-row-open { background: var(--dsw-alias-bg-layer-1); border-left-color: var(--dsw-alias-brand-primary); }
.dsh-gw-cell { display: flex; align-items: center; min-width: 0; padding: 0 8px; }
.dsh-gw-cell-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--dsw-alias-label-secondary); }
.dsh-gw-cell-sec { color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsh-gw-gcell { overflow: hidden; }
.dsh-gw-subj { display: flex; align-items: center; gap: 6px; min-width: 0; width: 100%; }
.dsh-gw-subjtext { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-gw-ref { flex: 0 0 auto; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 5px; border-radius: 4px; font-size: 11px; line-height: 16px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
.dsh-gw-ref-branch, .dsh-gw-ref-remote { display: inline-flex; align-items: center; gap: 4px; padding: 0 5px 0 0; border-color: color-mix(in srgb, var(--dsh-gw-ref-color) 42%, var(--dsw-alias-border-l2)); background: color-mix(in srgb, var(--dsh-gw-ref-color) 8%, var(--dsw-alias-bg-layer-2)); color: var(--dsw-alias-label-primary); }
.dsh-gw-ref-remote { border-style: dashed; color: var(--dsw-alias-label-secondary); }
.dsh-gw-ref-icon { display: inline-flex; align-items: center; justify-content: center; align-self: stretch; width: 18px; min-width: 18px; min-height: 16px; border-radius: 3px 0 0 3px; background: var(--dsh-gw-ref-color); color: white; }
.dsh-gw-ref-icon svg { display: block; }
.dsh-gw-ref-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.dsh-gw-ref-remote-name { color: var(--dsw-alias-label-secondary); font-style: italic; }
.dsh-gw-ref-current { border-color: color-mix(in srgb, var(--dsh-gw-ref-color) 68%, var(--dsw-alias-border-l2)); font-weight: 600; }
.dsh-gw-ref-tag { color: var(--dsw-alias-state-success-primary); }
.dsh-gw-ref-stash, .dsh-gw-ref-worktree { color: var(--dsw-alias-state-warn-primary); }

.dsh-gw-uncommitted { font-weight: 600; }
.dsh-gw-detail { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); }
.dsh-gw-detail-narrow { grid-template-columns: minmax(0, 1fr); }
.dsh-gw-detail-left { padding: 8px 10px; min-width: 0; border-right: 1px solid var(--dsw-alias-border-l1); }
.dsh-gw-detail-narrow .dsh-gw-detail-left { border-right: 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-gw-kv { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 2px 8px; }
.dsh-gw-k { color: var(--dsw-alias-label-secondary); }
.dsh-gw-v { min-width: 0; overflow-wrap: anywhere; }
.dsh-gw-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.dsh-gw-body { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--dsw-alias-border-l1); white-space: pre-wrap; color: var(--dsw-alias-label-secondary); }
.dsh-gw-legacy { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--dsw-alias-label-secondary); }
.dsh-gw-detail-right { padding: 8px 10px; min-width: 0; overflow: auto; }
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

    function basename(path) {
      const trimmed = String(path || '').replace(/[\\/]+$/, '');
      const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
      return cut < 0 ? trimmed : trimmed.slice(cut + 1);
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
     * A commit takes the lane its first child already reserved; a merge reserves
     * one lane per parent. Lanes are never renumbered, so appending a page keeps
     * every earlier row on the same lane and the drawing stays continuous.
     */
    function layoutLanes(nodes) {
      const waiting = [];
      const lanes = [];
      const edges = [];
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        let lane = waiting.indexOf(node.id);
        if (lane < 0) {
          lane = waiting.indexOf(null);
          if (lane < 0) lane = waiting.length;
        }
        lanes.push(lane);
        waiting[lane] = null;
        for (const parent of node.parents || []) {
          if (!parent) continue;
          let parentLane = waiting.indexOf(parent);
          if (parentLane < 0) {
            parentLane = waiting.indexOf(null);
            if (parentLane < 0) parentLane = waiting.length;
            waiting[parentLane] = parent;
          }
          edges.push({ from: index, fromLane: lane, parent, toLane: parentLane });
        }
      }
      const indexById = new Map(nodes.map((node, index) => [node.id, index]));
      for (const edge of edges) {
        // A parent outside this page continues just below the last visible row.
        // Parents inside the page connect to their real row, which is essential
        // for merge lines that pass one or more intervening commits.
        edge.to = indexById.has(edge.parent) ? indexById.get(edge.parent) : nodes.length;
      }
      let width = 0;
      for (const lane of lanes) width = Math.max(width, lane + 1);
      for (const edge of edges) width = Math.max(width, edge.fromLane + 1, edge.toLane + 1);
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

    /** The real root of a cubic's y(t) = target inside (0, 1), found by bisection. */
    function cubicYAt(p0, p1, p2, p3, target) {
      const at = (t) => {
        const u = 1 - t;
        return (u * u * u * p0) + (3 * u * u * t * p1) + (3 * u * t * t * p2) + (t * t * t * p3);
      };
      // y(0) = p0 and y(1) = p3; the handles keep y monotonic between them, so
      // bisection converges whichever direction the curve runs.
      const rising = p3 >= p0;
      let low = 0;
      let high = 1;
      for (let step = 0; step < 40; step += 1) {
        const mid = (low + high) / 2;
        if ((at(mid) < target) === rising) low = mid;
        else high = mid;
      }
      return (low + high) / 2;
    }

    /**
     * Trim a monotonic curve to `yTop .. yBottom`, in absolute coordinates.
     *
     * Trimming with the same endpoints the curve was built from leaves the
     * bezier's shape untouched, so the pieces each row draws line up instead of
     * visibly kinking every 26 pixels.
     */
    function clipCurve(x1, y1, x2, y2, yTop, yBottom) {
      const rising = y2 >= y1;
      const span = Math.abs(y2 - y1) || 1;
      const dip = span * 0.55;
      const c1 = y1 + (rising ? dip : -dip);
      const c2 = y2 - (rising ? dip : -dip);
      let startT = 0;
      let endT = 1;
      if (y1 < yTop) {
        startT = cubicYAt(y1, c1, c2, y2, yTop);
      }
      if (y2 > yBottom) {
        endT = cubicYAt(y1, c1, c2, y2, yBottom);
      }
      const xAt = (t) => {
        const u = 1 - t;
        return (u * u * u * x1) + (3 * u * u * t * x1) + (3 * u * t * t * x2) + (t * t * t * x2);
      };
      const yAt = (t) => {
        const u = 1 - t;
        return (u * u * u * y1) + (3 * u * u * t * c1) + (3 * u * t * t * c2) + (t * t * t * y2);
      };
      const xDerivative = (t) => {
        const u = 1 - t;
        return 6 * u * t * (x2 - x1);
      };
      const yDerivative = (t) => {
        const u = 1 - t;
        return (3 * u * u * (c1 - y1)) + (6 * u * t * (c2 - c1)) + (3 * t * t * (y2 - c2));
      };
      const spanT = endT - startT;
      const startX = xAt(startT);
      const startY = yAt(startT);
      const endX = xAt(endT);
      const endY = yAt(endT);
      const control1X = startX + (spanT * xDerivative(startT)) / 3;
      const control1Y = startY + (spanT * yDerivative(startT)) / 3;
      const control2X = endX - (spanT * xDerivative(endT)) / 3;
      const control2Y = endY - (spanT * yDerivative(endT)) / 3;
      return {
        d: `M ${startX} ${startY - yTop} C ${control1X} ${control1Y - yTop} ${control2X} ${control2Y - yTop} ${endX} ${endY - yTop}`,
      };
    }

    /** One row's slice of the graph, drawn in that row's own coordinates. */
    function GraphCell(props) {
      const { layout, index, colors } = props;
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
        const width = strokeWidthFor(layout, edge.from, edge.fromLane);
        if (x1 === x2) {
          const start = Math.max(y1, yTop) - yTop;
          const end = Math.min(y2, yBottom) - yTop;
          children.push(h('line', {
            key: `e${edge.from}:${edge.parent}:${index}`,
            x1, y1: start, x2, y2: end,
            stroke: colors.get(edge.fromLane), strokeWidth: width, strokeLinecap: 'round',
          }));
        } else {
          const { d } = clipCurve(x1, y1, x2, y2, yTop, yBottom);
          children.push(h('path', {
            key: `e${edge.from}:${edge.parent}:${index}`,
            d,
            fill: 'none', stroke: colors.get(edge.fromLane), strokeWidth: width, strokeLinecap: 'round',
          }));
        }
      }

      const lane = layout.lanes[index];
      if (lane !== undefined) {
        if (index === 0) {
          children.push(h('line', {
            key: 'working-tree-link',
            x1: laneX(lane), y1: 0, x2: laneX(lane), y2: ROW / 2,
            stroke: 'var(--dsw-alias-label-secondary)', strokeWidth: 1.6,
          }));
        }
        children.push(h('circle', {
          key: 'node', cx: laneX(lane), cy: ROW / 2, r: 4,
          fill: colors.get(lane), stroke: 'var(--dsw-alias-bg-base)', strokeWidth: 1.6,
        }));
      }

      return h('div', { className: 'dsh-gw-gcell', style: { height: ROW } },
        h('svg', { width: to, height: ROW, viewBox: `0 0 ${to} ${ROW}`, 'aria-hidden': true }, children));
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

    /** Merge `main` and `origin/main` when both point at this commit. */
    function mergeMatchingRemoteRefs(refs) {
      const merged = refs.map((ref) => ({ ...ref }));
      const localByName = new Map(
        merged.filter((ref) => ref.kind === 'branch').map((ref) => [ref.name, ref]),
      );
      const absorbed = new Set();
      for (const ref of merged) {
        if (ref.kind !== 'remote') continue;
        const slash = ref.name.indexOf('/');
        if (slash <= 0 || slash === ref.name.length - 1) continue;
        const remote = ref.name.slice(0, slash);
        const branch = ref.name.slice(slash + 1);
        const local = localByName.get(branch);
        if (!local) continue;
        local.linkedRemotes = [
          ...(local.linkedRemotes || []),
          { name: remote, fullName: ref.name },
        ];
        absorbed.add(ref);
      }
      return merged.filter((ref) => !absorbed.has(ref));
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

    function RefChip(props) {
      // `ref` is reserved by React and is not forwarded to function-component
      // props. Keep the wire object under an ordinary prop name.
      const ref = normalizeRef(props.gitRef);
      if (!ref || !ref.name) return null;
      const linkedRemotes = Array.isArray(ref.linkedRemotes) ? ref.linkedRemotes : [];
      const className = `dsh-gw-ref dsh-gw-ref-${ref.kind}${ref.current && ref.kind === 'branch' ? ' dsh-gw-ref-current' : ''}`;
      const branchLike = ref.kind === 'branch' || ref.kind === 'remote';
      return h('span', {
        className,
        title: [`${ref.kind}: ${ref.name}`, ...linkedRemotes.map((remote) => `remote: ${remote.fullName}`)].join('\n'),
        style: branchLike ? { '--dsh-gw-ref-color': props.laneColor } : undefined,
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
      });
      const [selected, setSelected] = React.useState(() => (selection.get(sessionId) || {}).path || null);
      const [scope, setScope] = React.useState(saved.scope || 'all');
      const [showRemote, setShowRemote] = React.useState(Boolean(saved.showRemote));
      const [showGraph, setShowGraph] = React.useState(saved.showGraph !== false);
      const [openKey, setOpenKey] = React.useState(null);
      const [reloadKey, setReloadKey] = React.useState(0);
      const [width, setWidth] = React.useState(900);

      const repo = (navigate && navigate.repo)
        || (state.sessionId === sessionId ? state.repo : null)
        || null;

      // This panel is a user-resizable column, a split pane or a float, so every
      // column decision follows its own measured width.
      const rootRef = React.useRef(null);
      React.useEffect(() => {
        const node = rootRef.current;
        if (!node) return undefined;
        if (typeof ResizeObserver !== 'function') {
          setWidth(node.clientWidth || 900);
          return undefined;
        }
        const observer = new ResizeObserver((entries) => {
          const rect = entries[0] && entries[0].contentRect;
          if (rect) setWidth(rect.width);
        });
        observer.observe(node);
        setWidth(node.clientWidth || 900);
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
        api('worktrees', { repo }, sessionId, controller.signal)
          .then((data) => {
            if (!alive) return;
            const rootWorktree = data.worktrees.find((item) => item.path === data.repo.root);
            const remembered = selection.get(sessionId) || {};
            const savedWorktree = data.worktrees.find((item) => item.path === remembered.path);
            const nextPath = savedWorktree
              ? savedWorktree.path
              : rootWorktree ? rootWorktree.path : (data.worktrees[0] || {}).path || null;
            if (nextPath) {
              selection.set(sessionId, { path: nextPath });
              setSelected(nextPath);
            }
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
        api('graph', { repo, worktree: selected, scope, limit: PAGE }, sessionId, controller.signal)
          .then((data) => {
            if (!alive) return;
            setState((previous) => ({
              ...previous,
              graph: data,
              nodes: data.nodes,
              error: null,
            }));
          })
          .catch((error) => {
            if (!alive || controller.signal.aborted) return;
            setState((previous) => ({ ...previous, error: error.message }));
          });
        return () => { alive = false; controller.abort(); };
      }, [repo, selected, scope, reloadKey]);

      const loadMore = React.useCallback(() => {
        if (!repo || !selected || state.more) return;
        setState((previous) => ({ ...previous, more: true }));
        api('graph', { repo, worktree: selected, scope, limit: PAGE, skip: state.nodes.length }, sessionId)
          .then((data) => {
            setState((previous) => ({
              ...previous,
              more: false,
              // Lane numbers continue across pages, so appending keeps every
              // earlier row exactly where it was drawn.
              nodes: previous.nodes.concat(data.nodes),
            }));
          })
          .catch((error) => {
            setState((previous) => ({ ...previous, more: false, error: error.message }));
          });
      }, [repo, selected, scope, sessionId, state.more, state.nodes.length]);

      const onToggle = React.useCallback((key) => {
        setOpenKey((current) => (current === key ? null : key));
      }, []);

      const onSelectWorktree = React.useCallback((path) => {
        selection.set(sessionId, { path });
        setSelected(path);
        setOpenKey(null);
      }, [sessionId]);

      const nodes = state.nodes || [];
      const layout = React.useMemo(() => layoutLanes(nodes), [nodes]);
      const current = state.worktrees.find((item) => item.path === selected) || null;
      const changeCount = current && current.status ? current.status.entries : 0;

      // Only lanes this page actually draws get a column, so the text columns do
      // not sit behind lanes reserved for commits that were never fetched.
      const colors = new Map();
      for (const lane of layout.lanes) {
        if (colors.has(lane)) continue;
        colors.set(lane, LANE_COLORS[lane % LANE_COLORS.length]);
      }
      // Keep the Graph header readable for a one-lane repository; additional
      // lanes expand the column naturally.
      const graphWidth = Math.max(64, layout.width * COL + MARGIN);

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

      const toolbar = h('div', { className: 'dsh-gw-tbar' },
        h('label', { className: 'dsh-gw-check', title: '在提交行上显示远程分支引用' },
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
      if (state.worktrees.length > 1) {
        head.push(h('div', { className: 'dsh-gw-crumbs', key: 'wts' },
          state.worktrees.map((item) => h('button', {
            key: item.path,
            type: 'button',
            className: `dsh-gw-wt${item.path === selected ? ' dsh-gw-wt-active' : ''}${item.path === state.repo ? ' dsh-gw-wt-root' : ''}`,
            title: `${item.branch || '(detached)'} — ${item.path}${item.error ? ` — ${item.error}` : ''}`,
            onClick: () => onSelectWorktree(item.path),
          },
            item.status && item.status.dirty ? h('span', { className: 'dsh-gw-dot' }) : null,
            h('span', { className: 'dsh-gw-subjtext' }, item.branch || basename(item.path))))));
      }

      const grid = [];
      grid.push(h('div', { className: 'dsh-gw-hrow', key: 'hrow', style: { '--dsh-gw-cols': columns } },
        showGraph ? h('div', { className: 'dsh-gw-hcell' }, 'Graph') : null,
        h('div', { className: 'dsh-gw-hcell' }, 'Description'),
        showDate ? h('div', { className: 'dsh-gw-hcell' }, 'Date') : null,
        showAuthor ? h('div', { className: 'dsh-gw-hcell' }, 'Author') : null,
        showCommit ? h('div', { className: 'dsh-gw-hcell' }, 'Commit') : null));

      // The working tree rides the graph as its own row, above the newest commit.
      if (state.repo && state.status === 'ready') {
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
            h('line', { x1: laneX(0), y1: ROW / 2, x2: laneX(0), y2: ROW, stroke: 'var(--dsw-alias-label-secondary)', strokeWidth: 1.6 }),
            h('circle', { cx: laneX(0), cy: ROW / 2, r: 4, fill: 'var(--dsw-alias-bg-base)', stroke: 'var(--dsw-alias-label-secondary)', strokeWidth: 1.6 }))) : null,
          h('div', { className: 'dsh-gw-cell' },
            h('span', { className: 'dsh-gw-subjtext dsh-gw-uncommitted' },
              changeCount > 0 ? `Uncommitted Changes (${changeCount})` : 'Uncommitted Changes'),
            changeCount > 0 ? h('span', { className: 'dsh-gw-dot', style: { marginLeft: '6px' } }) : null),
          showDate ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec' }, '') : null,
          showAuthor ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec' }, '') : null,
          showCommit ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec' }, '') : null));
        if (openKey === 'uncommitted') {
          grid.push(h(UncommittedDetail, {
            key: 'uncommitted-detail', repo: state.repo, worktree: selected, sessionId,
            narrow: width < W_DETAIL_SPLIT,
            supportsStructured: state.capabilities.includes('uncommitted-v1'),
          }));
        }
      }

      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        const laneColor = colors.get(layout.lanes[index]) || LANE_COLORS[0];
        const visibleRefs = (node.refs || []).map(normalizeRef).filter(Boolean)
          .filter((ref) => showRemote || ref.kind !== 'remote');
        const refs = mergeMatchingRemoteRefs(visibleRefs);
        grid.push(h('div', {
          key: node.id,
          className: `dsh-gw-row dsh-gw-rowmid${openKey === node.id ? ' dsh-gw-row-open' : ''}`,
          style: { '--dsh-gw-cols': columns },
          role: 'button', tabIndex: 0, 'aria-expanded': openKey === node.id,
          onClick: () => onToggle(node.id),
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle(node.id); }
          },
          title: `${shortOid(node.id)} ${node.subject}`,
        },
          showGraph ? h(GraphCell, { layout, index, colors }) : null,
          h('div', { className: 'dsh-gw-cell' },
            h('div', { className: 'dsh-gw-subj' },
              refs.map((ref) => h(RefChip, {
                key: `${ref.kind}:${ref.name}`, gitRef: ref, laneColor,
              })),
              node.refCount > visibleRefs.length
                ? h('span', { className: 'dsh-gw-ref', title: '还有更多引用' }, `+${node.refCount - visibleRefs.length}`)
                : null,
              h('span', { className: 'dsh-gw-subjtext' }, node.subject || '(无提交说明)'))),
          showDate ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec', title: absoluteTime(node.authoredAt) },
            absoluteTime(node.authoredAt)) : null,
          showAuthor ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec' }, node.author || '') : null,
          showCommit ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-mono' }, shortOid(node.id)) : null));

        if (openKey === node.id) {
          grid.push(h(CommitDetail, {
            key: `${node.id}-detail`,
            repo: state.repo,
            oid: node.id,
            sessionId,
            narrow: width < W_DETAIL_SPLIT,
          }));
        }
      }

      if (state.status === 'ready' && nodes.length > 0 && state.graph) {
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

    /** Carries the navigation face down to the footer action, which renders elsewhere in the tree. */
    const ActionContext = React.createContext(null);

    /** Sidebar-foot action: the panel's own way in, beside Settings. */
    function FooterAction() {
      const sidebarRight = React.useContext(ActionContext);
      return h('button', {
        type: 'button', className: 'dsh-gw-btn',
        onClick: () => { if (sidebarRight) sidebarRight.openTab(KIND); },
      }, 'Git');
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
        const sidebarRight = ctx.get('sidebarRight');

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

        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'git-worktree',
          order: 40,
          label: 'Git Worktree',
        }, () => h(ActionContext.Provider, { value: sidebarRight }, h(FooterAction))));
      },
    };
  },
});
