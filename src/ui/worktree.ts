/**
 * Git Worktree — the shared view.
 *
 * Renders the worktree list, the multi-lane commit graph, the working tree's
 * own row and an expanded commit's details.
 *
 * `configureView` installs a platform transport. Every read arrives as the
 * payload contract in `src/core/types.ts`. Its styles consume DSH theme tokens.
 *
 * The DSH integration checks its render tree and geometry, so this file stays
 * `h(...)`-based.
 */
import * as React from 'react';
import clsx from 'clsx';
import {
  Button,
  FileTypeIcon,
  classifyFileType,
  languageForPath,
  useCodeHighlighter,
  writeClipboard,
  IconBranchOutlineRegular,
  IconChevronsUpDownOutlineRegular,
  IconCompareSplitOutlineRegular,
  IconCopyOutlineRegular,
  IconEllipsisOutlineRegular,
  IconFolderCloseRegular,
  IconFolderOpenRegular,
  IconNowrapFillRegular,
  IconRefreshOutlineRegular,
  IconRightUpOutlineRegular,
  IconWrapLinesOutlineRegular,
  Menu,
  Modal,
  PathLabel,
} from '@deepseek-ai/dsh-client-ui-primitives';
import type { HighlightSpan } from '@deepseek-ai/dsh-client-ui-primitives';
import styles from './worktree.module.css';

// The build replaces this marker with esbuild's scoped CSS Module output. The
// browser half appends it to the document head inside its own effect, so every
// tab this plugin registers is styled whichever of them is mounted — one tab's
// body owning the sheet meant a second tab rendered with no styles at all.
const CSS_MODULE_TEXT = '__DSH_GIT_WORKTREE_GRAPH_STYLESHEET__';
import type {
  ChangedFile,
  CommitDetailPayload,
  DiffPayload,
  FileDiffHunk,
  FileDiffLine,
  FileDiffPayload,
  GraphRef,
  OperationPreview,
  GraphNode,
  GraphPayload,
  UncommittedPayload,
  WorktreeSummary,
  WorktreesPayload,
} from '../core/types.js';

// `React.createElement`, kept permissive on purpose: the render tree below is a
// transcription of hand-written element calls, and the types this view earns its
// keep from are the payloads, the panel state and the transport — not
// each leaf element's attribute list.
const h = (type: any, props?: any, ...children: any[]): any => {
  // The render tree keeps its readable class names; CSS Modules scopes them
  // when they reach a DOM node or a primitive's className prop.
  const className = props?.className;
  const resolved = typeof className === 'string'
    ? { ...props, className: clsx(className.split(/\s+/).map((name) => styles[name] || name)) }
    : props;
  return React.createElement(type, resolved, ...children);
};

const WORKTREE_TAB_TITLE = 'Git Worktree Graph';
// The tab a changed file opens. It is a page of its own — one reused tab that
// follows whichever file was opened last — so it is named by kind, never by an
// address the panel would have to compose.
const FILE_DIFF_KIND = 'git-worktree-graph-file-diff';
const FILE_DIFF_TITLE = 'File diff';

const PAGE = 300;
// The built-in Files sidebar uses a 13px/1.5 line with 5px vertical padding:
// a 30px row. Graph geometry must use the same pitch as its CSS rows.
const ROW = 30;
const COL = 14;
const PAD = 10;
const MARGIN = 8;
// Where a lane change crosses, measured from the top of the row below its
// node. Two slots, one clear of that row's node above and one below, so two
// parents of one commit cannot draw their crossings over each other.
const CROSS_NEAR = 7;
const CROSS_FAR = ROW - 7;
// All visible text columns contract to these minimums before one is hidden.
// The graph itself can widen as branches gain lanes, so its width is deducted
// before deciding which text columns fit.
const COLUMN_GUTTER = 24;
const DESCRIPTION_MIN = 280;
const DATE_MIN = 116;
const AUTHOR_MIN = 112;
const DATE_MAX = 164;
const AUTHOR_MAX = 164;
// Measured on the space after the graph rail, where the detail actually lives.
const DETAIL_TWO_COLUMN_MIN = 620;
// An expanded detail is capped as a share of the panel's own height, because
// this panel is a full-height column, a split pane or a short float: without
// a cap a long file list pushes every other commit out of view.
const DETAIL_MAX_SHARE = 0.45;
const DETAIL_MAX_CEILING = 420;
const DETAIL_MAX_FLOOR = ROW * 6;
// The two-column detail is split by a drag grip. What the drag remembers is a
// share of the body rather than a pixel width, so the boundary keeps its
// proportion while the panel, the sidebar or the window is resized; the share
// is clamped so neither column can be dragged away entirely.
const DETAIL_SHARE_MIN = 0.2;
const DETAIL_SHARE_MAX = 0.8;
const DETAIL_SHARE_DEFAULT = 0.5;
// One preference per page, not one per commit: the metadata column is the same
// column on every row, so a boundary learned on one detail is the boundary the
// next one opens with. Only one detail is open at a time, and its own state
// mirrors this value so a drag re-renders just that detail.
let detailShare = DETAIL_SHARE_DEFAULT;
// The panel's first read can arrive before a host restores its session — so it is retried
// with a growing pause before the failure is believed.
const RESOLVE_ATTEMPTS = 4;
const RESOLVE_BACKOFF_MS = 300;

// Lane artwork. Literal colors are deliberate: these identify a branch, not
// a UI surface, and each one is legible on both theme backgrounds.
const LANE_COLORS = ['#2f8ae0', '#d0569b', '#38a169', '#d98a2b', '#8b72e0', '#0fa8ad', '#c05252', '#7a8b2f'];
// Presentational choices per Session: scope and remote-ref visibility.
const viewState = new Map();


/**
 * One API read.
 *
 * The configured transport answers reads using its platform's route or API.
 */
type ViewAction = 'worktrees' | 'graph' | 'diff' | 'commit' | 'uncommitted' | 'file-diff';

/** The parameters a read may carry; a view only ever sends what it was told to. */
export type ViewParams = Record<string, string | number | boolean | null | undefined>;

/** What creating a worktree answers. */
export interface ViewCreatedWorktree { created: boolean; path: string; branch: string; head: string }

/**
 * The writes the host may offer.
 *
 * Absent means the panel is read-only and hides its write controls.
 */
export interface ViewOperations {
  createWorktree(params: ViewParams): Promise<ViewCreatedWorktree>;
  rebasePreview(params: ViewParams): Promise<OperationPreview>;
  rebaseApply(params: ViewParams): Promise<unknown>;
  cherryPickPreview(params: ViewParams): Promise<OperationPreview>;
  cherryPickApply(params: ViewParams): Promise<unknown>;
}

/** The host's reads, keyed by the action the view asks for. */
export interface ViewTransport {
  worktrees(params: ViewParams, sessionId: string | null, signal?: AbortSignal): Promise<WorktreesPayload>;
  graph(params: ViewParams, sessionId: string | null, signal?: AbortSignal): Promise<GraphPayload>;
  diff(params: ViewParams, sessionId: string | null, signal?: AbortSignal): Promise<DiffPayload>;
  commit(params: ViewParams, sessionId: string | null, signal?: AbortSignal): Promise<CommitDetailPayload>;
  uncommitted(params: ViewParams, sessionId: string | null, signal?: AbortSignal): Promise<UncommittedPayload>;
  /** One changed file's patch, read when a file row is opened. */
  'file-diff'(params: ViewParams, sessionId: string | null, signal?: AbortSignal): Promise<FileDiffPayload>;
  /** Present when the host can change history. */
  operations?: ViewOperations;
}

let transport: ViewTransport | null = null;

/** Install the host's reads before mounting this view. */
function configureView(next: ViewTransport): void {
  transport = next;
}

async function api<A extends ViewAction>(
  action: A,
  params?: ViewParams,
  sessionId?: string | null,
  signal?: AbortSignal,
): Promise<Awaited<ReturnType<ViewTransport[A]>>> {
  if (!transport) throw new Error('Git Worktree: no transport is configured for this view.');
  const run = transport[action] as (p: ViewParams, s: string | null, sig?: AbortSignal) => Promise<Awaited<ReturnType<ViewTransport[A]>>>;
  return run(params || {}, sessionId ?? null, signal);
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

function shortOid(oid) {
  return String(oid || '').slice(0, 7);
}

function fileCount(count) {
  return `${count} file${count === 1 ? '' : 's'}`;
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
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function detailedTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZoneName: 'short',
  }).format(date);
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
/** One step of a lane change: the column it moves to and the row it moves at. */
interface LaneRouteStep { lane: number; y: number }

/** One commit's edge to a parent, with the column each end is drawn in. */
interface LaneEdge {
  from: number;
  parent: string;
  to: number;
  route: LaneRouteStep[];
  fromLane: number;
  toLane: number;
  crossing: number;
}

/** Every row's column, every edge, and how many lanes the page needs. */
interface LaneLayout { lanes: number[]; edges: LaneEdge[]; width: number }

function layoutLanes(nodes: GraphNode[]): LaneLayout {
  const waiting: (string | null)[] = [];
  const lanes: number[] = [];
  const edges: LaneEdge[] = [];
  const seats: Map<string, number>[] = [];
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
      // `to`, `route` and both lanes are filled in once the walk has placed
      // every row, because a parent's column is only final after that.
      edges.push({ from: index, parent, to: nodes.length, route: [], fromLane: -1, toLane: -1, crossing: 0 });
    }
    // Where every branch still running sits once this row is placed. An edge
    // reads this to follow its parent's column as the branches around it
    // collapse, instead of jumping the whole distance at once.
    const seat = new Map<string, number>();
    for (let slot = 0; slot < waiting.length; slot += 1) {
      if (waiting[slot]) seat.set(waiting[slot] as string, slot);
    }
    seats.push(seat);
  }
  const indexById = new Map<string, number>(nodes.map((node, index) => [node.id, index] as [string, number]));
  // Where the walk left every branch running once the last row was placed. An
  // edge whose parent is not on this page has no row to read a column from, so
  // it ends in the column that parent was still waiting in — which the seats
  // of the last row carry. Reading it from anywhere else leaves `toLane`
  // undefined, and one undefined lane turns the whole column width into NaN,
  // which the panel then hands to CSS as an invalid grid.
  const lastSeats = seats.length > 0 ? seats[seats.length - 1] : null;
  for (const edge of edges) {
    // A parent outside this page continues just below the last visible row.
    // Parents inside the page connect to their real row, which is essential
    // for merge lines that pass one or more intervening commits.
    edge.to = indexById.has(edge.parent) ? (indexById.get(edge.parent) as number) : nodes.length;
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
    edge.toLane = edge.to < lanes.length
      ? lanes[edge.to]
      : (lastSeats ? lastSeats.get(edge.parent) : undefined) ?? edge.fromLane ?? -1;
  }
  let width = 0;
  for (const lane of lanes) width = Math.max(width, lane + 1);
  for (const edge of edges) {
    // Every lane is an integer by here: one that came back undefined would
    // turn this maximum into NaN, and the graph column's width into an
    // invalid `grid-template-columns` the panel cannot lay out — which fails
    // as a silent stack of one-cell rows rather than as anything readable.
    if (!Number.isInteger(edge.fromLane) || !Number.isInteger(edge.toLane)) {
      throw new Error(`git-worktree-graph: lane layout left edge ${edge.from}→${edge.parent} without a column`);
    }
    width = Math.max(width, edge.fromLane + 1, edge.toLane + 1);
  }
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
function rowPath(points: { x: number; y: number }[], yTop: number, yBottom: number) {
  const kept: { x: number; y: number }[] = [];
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
  const children: React.ReactNode[] = [];
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
  const lines: React.ReactNode[] = [];
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

/** The icon props a local glyph may carry. */
interface GlyphProps { size?: number; flipVertical?: boolean; className?: string }

function GraphBranchGlyph(props: GlyphProps = {}) {
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

function BranchRefIcon(props: GlyphProps = {}) {
  return h(GraphBranchGlyph, { ...props, flipVertical: true });
}

/**
 * The diff tab's own mark: a box holding a plus over a minus.
 *
 * The icon set has no diff glyph — its nearest is a two-column compare, which
 * says nothing about what changed — and a tab chip is read at a glance, so this
 * draws the one shape that means "lines added and lines removed" on its own. It
 * follows the set's conventions: a 16-unit box, no fill, one unit of stroke in
 * `currentColor`, so it sits beside the set's icons without standing out.
 */
function DiffMarkGlyph(props: GlyphProps = {}) {
  const size = props.size || 16;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1, strokeLinecap: 'round', strokeLinejoin: 'round',
    className: props.className, 'aria-hidden': true,
  },
    h('rect', { x: 2.25, y: 2.25, width: 11.5, height: 11.5, rx: 2.5 }),
    h('path', { d: 'M8 5.1v2.8M6.6 6.5h2.8' }),
    h('path', { d: 'M6.6 10.2h2.8' }));
}

/** The remote-history toggle uses one cloud silhouette in both states. */
function RemoteCloudIcon({ hidden }: { hidden: boolean }) {
  return h('svg', {
    width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true,
  },
    // Fill the same vertical span as the built-in refresh glyph. The slash
    // stays inside that span, so toggling does not change the apparent size.
    h('g', { transform: 'translate(0 -1.4) scale(1 1.18)' },
      h('path', { d: 'M4.1 13h7.8a2.65 2.65 0 0 0 .32-5.28 4.35 4.35 0 0 0-8.4-1.28A3.35 3.35 0 0 0 4.1 13Z' }),
      hidden ? h('path', { d: 'M2.1 2.65L13.9 13.35', strokeWidth: 1.4 }) : null));
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
function HeadRingGlyph(props: GlyphProps = {}) {
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
  const className = clsx('dsh-gw-ref', `dsh-gw-ref-${ref.kind}`, ref.current && ref.kind === 'branch' && 'dsh-gw-ref-current');
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

/** One directory of the changed-file tree below a commit. */
interface FileTreeDir { name: string; dirs: Map<string, FileTreeDir>; files: { name: string; file: ChangedFile }[] }

/** Insert one changed file into a nested tree, directories first. */
function buildFileTree(files: ChangedFile[]): FileTreeDir {
  const root: FileTreeDir = { name: '', dirs: new Map(), files: [] };
  for (const file of files) {
    const parts = String(file.path || '').split('/').filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { name: parts[i], dirs: new Map(), files: [] });
      node = node.dirs.get(parts[i]) as FileTreeDir;
    }
    node.files.push({ name: parts[parts.length - 1] || file.path, file });
  }
  return root;
}

function FileTree(props) {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const { files, onOpen } = props;
  const root = React.useMemo(() => buildFileTree(files), [files]);
  const rows: React.ReactNode[] = [];
  const walk = (node, depth, prefix) => {
    const dirs = [...node.dirs.values()].sort((left, right) => left.name.localeCompare(right.name));
    for (const dir of dirs) {
      const path = prefix ? `${prefix}/${dir.name}` : dir.name;
      const isCollapsed = collapsed[path];
      const count = countFiles(dir);
      rows.push(h('button', {
        key: `d:${path}`,
        type: 'button', className: 'dsh-gw-frow dsh-gw-frow-folder',
        style: { '--dsh-gw-indent': `${depth * 18}px` },
        'aria-expanded': !isCollapsed,
        title: path,
        onClick: () => setCollapsed((current) => ({ ...current, [path]: !current[path] })),
      },
        h(isCollapsed ? IconFolderCloseRegular : IconFolderOpenRegular, { className: 'dsh-gw-folder-icon', size: 16 }),
        h('span', { className: 'dsh-gw-fname' }, dir.name),
        h('span', { className: 'dsh-gw-fstat' }, h('span', { className: 'dsh-gw-stat' }, `${count}`))));
      if (!isCollapsed) walk(dir, depth + 1, path);
    }
    const sorted = [...node.files].sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of sorted) {
      const file = entry.file;
      // A file is a control while a diff can be read for it, and a plain row
      // while it cannot — a Host that predates the route serves neither, and a
      // button that answers nothing is worse than no button at all.
      const body = [
        h(FileTypeIcon, { key: 'i', kind: classifyFileType(entry.name), size: 16, className: 'dsh-gw-file-icon' }),
        h('span', { key: 'n', className: 'dsh-gw-fname' }, entry.name),
        h('span', { key: 's', className: 'dsh-gw-fstat' },
          file.untracked
            ? h('span', { className: 'dsh-gw-stat' }, 'New')
            : [
                h('span', { key: 'a', className: 'dsh-gw-add' }, `+${file.add}`),
                h('span', { key: 'd', className: 'dsh-gw-del' }, `-${file.del}`),
              ]),
      ];
      const shared = {
        key: `f:${prefix}/${entry.name}`,
        className: clsx('dsh-gw-frow', onOpen && 'dsh-gw-frow-file', file.binary && 'dsh-gw-frow-binary'),
        style: { '--dsh-gw-indent': `${depth * 18}px` },
        title: onOpen ? `${file.path} — open this file's diff in its own tab` : file.path,
      };
      rows.push(onOpen
        ? h('button', { ...shared, type: 'button', onClick: () => onOpen(file) }, body)
        : h('div', shared, body));
    }
  };
  walk(root, 0, '');
  return h('div', { className: 'dsh-gw-ftree' }, rows);
}

function countFiles(node) {
  let total = node.files.length;
  for (const dir of node.dirs.values()) total += countFiles(dir);
  return total;
}

/** The clamp every write to the detail's share goes through. */
function clampShare(share) {
  return Math.min(DETAIL_SHARE_MAX, Math.max(DETAIL_SHARE_MIN, share));
}

/** A share as CSS reads it: three decimals, so the two tracks stay tidy. */
function roundShare(share) {
  return Math.round(share * 1000) / 1000;
}

/**
 * The grip between the detail's two columns.
 *
 * A drag reads the pointer's position inside the grid the grip sits in and
 * writes the left column's share of it, so nothing has to be measured ahead of
 * time and a panel resized mid-drag still lands where the pointer is. The grip
 * also takes the keyboard: a focused separator moves the boundary a step at a
 * time, and a double-click restores the even split.
 *
 * `narrow` never reaches this component — a stacked detail has no boundary to
 * move — so the grid it is placed in is always the two-column one.
 */
function DetailGrip(props) {
  const { share, onShare } = props;
  const [dragging, setDragging] = React.useState(false);
  // The pointer is captured on pointerdown and every move is measured against
  // the grid, so a fast drag that leaves the 8px strip still tracks, and a
  // pointer that was never captured (a hover, or a drag that already ended)
  // is ignored rather than treated as a drag.
  const draggingPointer = (event) => {
    const grip = event.currentTarget;
    return typeof grip.hasPointerCapture === 'function' && grip.hasPointerCapture(event.pointerId);
  };
  const shareAt = (event) => {
    const grip = event.currentTarget as HTMLElement;
    const grid = grip.parentElement;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const gripWidth = grip.offsetWidth || 8;
    const usable = rect.width - gripWidth;
    if (usable <= 0) return;
    // The boundary sits at the grip's centre, which is where the pointer is
    // held for the whole gesture: half the grip falls on either side of it.
    onShare(clampShare((event.clientX - rect.left - gripWidth / 2) / usable));
  };
  return h('div', {
    className: 'dsh-gw-detail-grip',
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-label': 'Resize the detail columns',
    'aria-valuenow': Math.round(share * 100),
    'aria-valuemin': Math.round(DETAIL_SHARE_MIN * 100),
    'aria-valuemax': Math.round(DETAIL_SHARE_MAX * 100),
    tabIndex: 0,
    'data-dragging': dragging ? '' : undefined,
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      // Keep the drag from selecting the metadata text around it, then take
      // the pointer so the gesture survives leaving the grip.
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      shareAt(event);
    },
    onPointerMove: (event) => { if (draggingPointer(event)) shareAt(event); },
    onPointerUp: (event) => {
      if (draggingPointer(event)) event.currentTarget.releasePointerCapture(event.pointerId);
      setDragging(false);
    },
    onPointerCancel: () => setDragging(false),
    onLostPointerCapture: () => setDragging(false),
    onDoubleClick: () => onShare(DETAIL_SHARE_DEFAULT),
    onKeyDown: (event) => {
      const step = event.shiftKey ? 0.05 : 0.02;
      const next = event.key === 'ArrowLeft' ? share - step
        : event.key === 'ArrowRight' ? share + step
          : null;
      if (next === null) return;
      event.preventDefault();
      onShare(clampShare(next));
    },
  });
}

/** Shared metadata/files layout for commits and uncommitted changes. */
function ExpandedDetail(props) {
  const { narrow, primary, metadata, summary, files, body, onOpenFile } = props;
  const [share, setShare] = React.useState(detailShare);
  // Two columns need both halves: a detail without a summary has nothing to
  // put on the right, and a narrow one stacks them, so neither gets a grip.
  const split = Boolean(summary) && !narrow;
  const updateShare = React.useCallback((next: number) => {
    detailShare = next;
    setShare(next);
  }, []);
  // Each half is its own column, so the widths are `flex` ratios rather than
  // a grid template: a share is a proportion, and the basis of zero keeps a
  // long path or a wide file name from claiming width its share did not.
  const flexFor = (value: number) => (split ? { flex: `${roundShare(value)} 1 0px` } : undefined);

  return h('div', {
    className: clsx('dsh-gw-detail', narrow && 'dsh-gw-detail-narrow', !summary && 'dsh-gw-detail-single'),
  },
    h('div', { className: 'dsh-gw-detail-side', style: flexFor(share) },
      h('div', { className: 'dsh-gw-detail-primary' }, primary),
      h('div', { className: 'dsh-gw-detail-metadata' }, metadata, body)),
    split ? h(DetailGrip, { share, onShare: updateShare }) : null,
    summary ? h('div', { className: 'dsh-gw-detail-side', style: flexFor(1 - share) },
      h('div', { className: 'dsh-gw-detail-summary' },
        h('div', { className: 'dsh-gw-stat' },
          `${fileCount(summary.changed)} changed`,
          summary.insertions > 0 ? h('span', { className: 'dsh-gw-add' }, ` (+${summary.insertions})`) : null,
          summary.deletions > 0 ? h('span', { className: 'dsh-gw-del' }, ` (-${summary.deletions})`) : null)),
      h('div', { className: 'dsh-gw-detail-files' },
        files?.length > 0
          ? h(FileTree, { files, onOpen: onOpenFile })
          : h('div', { className: 'dsh-gw-empty' }, 'No file changes'))) : null);
}

/** One commit read: pending, answered, or refused. `text` is the pre-structured Host's answer. */
interface CommitReadState {
  status: 'loading' | 'ready' | 'failed';
  data?: (CommitDetailPayload & { text?: string }) | null;
  error?: string | null;
}

/** The expanded panel under a commit row: metadata beside the changed files. */
function CommitDetail(props) {
  const { repo, oid, sessionId, narrow, onOpenFile } = props;
  const [state, setState] = React.useState<CommitReadState>({ status: 'loading' });
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
  const primary = h(React.Fragment, null,
    state.status === 'loading' ? h('div', { className: 'dsh-gw-msg' }, 'Loading…') : null,
    state.status === 'failed' ? h('div', { className: 'dsh-gw-error' }, state.error) : null,
    legacy ? h('pre', { className: 'dsh-gw-legacy' }, data.text) : null,
    data && !legacy ? h('div', { className: 'dsh-gw-kv' },
      h('span', { className: 'dsh-gw-k' }, 'Commit'), h('span', { className: 'dsh-gw-v dsh-gw-mono' }, data.oid)) : null);
  const metadata = data && !legacy ? h('div', { className: 'dsh-gw-kv' },
      h('span', { className: 'dsh-gw-k' }, 'Parents'), h('span', { className: 'dsh-gw-v dsh-gw-mono' },
        data.parents.length > 0 ? data.parents.map(shortOid).join(', ') : 'None'),
      h('span', { className: 'dsh-gw-k' }, 'Author'), h('span', { className: 'dsh-gw-v' },
        `${data.author.name} <${data.author.email}>`),
      h('span', { className: 'dsh-gw-k' }, 'Committer'), h('span', { className: 'dsh-gw-v' },
        `${data.committer.name} <${data.committer.email}>`),
      h('span', { className: 'dsh-gw-k' }, 'Date'), h('span', { className: 'dsh-gw-v' },
        `${detailedTime(data.authoredAt)} (${relativeTime(data.authoredAt)})`)) : null;

  return h(ExpandedDetail, {
    narrow,
    primary,
    metadata,
    onOpenFile: data && !legacy ? onOpenFile : undefined,
    body: data && data.body ? h('div', { className: 'dsh-gw-body' }, data.body) : null,
    summary: data && !legacy ? data.summary : null,
    files: data && !legacy ? data.files : null,
  });
}

/** One working-tree read: the structured answer, or the older Host's text diff. */
interface UncommittedReadState {
  status: 'loading' | 'ready' | 'failed' | 'legacy';
  /** Two answers are possible here — the structured payload, or an older Host's
   *  text diff — and which one arrived is what `status` records. The render
   *  branches on that, so the field itself stays open. */
  data?: any;
  error?: string | null;
}

/** The working tree as the graph's first row, shaped like a commit. */
function UncommittedDetail(props) {
  const { repo, worktree, sessionId, supportsStructured, narrow, onOpenFile } = props;
  const [state, setState] = React.useState<UncommittedReadState>({ status: 'loading' });
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
            setState({ status: 'failed', error: (fallbackError as { message?: string }).message });
            return;
          }
        }
        setState({ status: 'failed', error: error.message });
      });
    return () => { alive = false; controller.abort(); };
  }, [repo, worktree, sessionId, supportsStructured]);
  const data = state.data;
  const primary = h(React.Fragment, null,
    state.status === 'loading' ? h('div', { className: 'dsh-gw-msg' }, 'Loading…') : null,
    state.status === 'failed' ? h('div', { className: 'dsh-gw-error' }, state.error) : null,
    state.status === 'legacy' ? h('div', { className: 'dsh-gw-msg' }, 'The Host has not reloaded yet. Showing the text diff for now.') : null,
    state.status === 'legacy' && data
      ? h('pre', { className: 'dsh-gw-legacy' }, [data.stat, data.patch].filter(Boolean).join('\n\n'))
      : null,
    state.status === 'ready' && data ? h('div', { className: 'dsh-gw-kv' },
      h('span', { className: 'dsh-gw-k' }, 'Branch'),
      h('span', { className: 'dsh-gw-v' }, data.unborn ? 'No commits yet' : data.branch || 'Detached HEAD')) : null);
  const metadata = state.status === 'ready' && data ? h('div', { className: 'dsh-gw-kv' },
      h('span', { className: 'dsh-gw-k' }, 'Path'),
      h('span', { className: 'dsh-gw-v' }, data.path)) : null;
  return h(ExpandedDetail, {
    narrow,
    primary,
    metadata,
    onOpenFile: state.status === 'ready' && data ? onOpenFile : undefined,
    summary: state.status === 'ready' && data ? data.summary : null,
    files: state.status === 'ready' && data ? data.files : null,
  });
}

/** One file-diff read: pending, answered, or refused. */
interface FileDiffState {
  status: 'loading' | 'ready' | 'failed';
  data?: FileDiffPayload | null;
  error?: string | null;
}

/** How the patch is laid out: one column, or the old and new file side by side. */
type DiffMode = 'unified' | 'split';

/** One row of the side-by-side view: an old line, a new line, or a gap beside either. */
interface DiffRow {
  left: FileDiffLine | null;
  right: FileDiffLine | null;
}

/**
 * A run of side-by-side rows that can be laid out as one piece.
 *
 * Rows are paired one for one so a wrapped line keeps its partner on the same
 * baseline. A row with nothing on one side needs no pairing at all, so a run of
 * them is one part: the side that has lines becomes a column, and the side that
 * has none becomes a single hatched cell. Drawn per row the hatching restarts
 * its stripes at every boundary and the gaps between them read as seams.
 */
interface DiffPart {
  rows: DiffRow[];
  /** The side with no line, or null when both sides have one. */
  empty: 'left' | 'right' | null;
}

function diffSplitParts(rows: DiffRow[]): DiffPart[] {
  const parts: DiffPart[] = [];
  for (const row of rows) {
    const empty = row.left && row.right ? null : row.left ? 'right' : 'left';
    const last = parts[parts.length - 1];
    if (last && empty !== null && last.empty === empty) {
      last.rows.push(row);
      continue;
    }
    parts.push({ rows: [row], empty });
  }
  return parts;
}

/** What each kind of change is called, for the header's dim note. */
const DIFF_STATUS_LABEL = { added: 'Added', deleted: 'Deleted', renamed: 'Renamed', modified: '' };
/** What the header's menu offers, and which rows stand checked. */
const DIFF_MENU_ROWS = [
  { id: 'split', label: 'Split view' },
  { id: 'wrap', label: 'Wrap long lines' },
  { type: 'separator', id: 'divider' },
  { id: 'copy', label: 'Copy file path' },
];

/** A line's carriage return is a line ending, not content: CRLF would draw a stray mark. */
function diffLineText(line: FileDiffLine): string {
  return line.text.replace(/\r$/, '');
}

/**
 * The unchanged lines a hunk's heading jumps over.
 *
 * Git prints each hunk with its own surrounding context and drops everything
 * between them, so the count is the distance from the previous hunk's end —
 * the smallest of the two sides' distances when a hunk ends on an addition.
 */
function diffGapBefore(hunks: FileDiffHunk[], index: number): number {
  const hunk = hunks[index];
  if (index === 0) return Math.max(0, Math.min(hunk.oldStart, hunk.newStart) - 1);
  const previous = hunks[index - 1];
  const oldGap = hunk.oldStart - (previous.oldStart + previous.oldCount);
  const newGap = hunk.newStart - (previous.newStart + previous.newCount);
  return Math.max(0, Math.min(oldGap, newGap));
}

/**
 * One hunk as side-by-side rows.
 *
 * Git prints a change as all of its removals, then all of its additions, so a
 * run of removals pairs line-for-line with the run of additions after it and
 * the longer run leaves the other side empty. A context line belongs to both.
 */
function diffSplitRows(hunk: FileDiffHunk): DiffRow[] {
  const rows: DiffRow[] = [];
  const lines = hunk.lines;
  for (let index = 0; index < lines.length;) {
    if (lines[index].kind === 'context') {
      rows.push({ left: lines[index], right: lines[index] });
      index += 1;
      continue;
    }
    const removed: FileDiffLine[] = [];
    const added: FileDiffLine[] = [];
    while (index < lines.length && lines[index].kind === 'del') {
      removed.push(lines[index]);
      index += 1;
    }
    while (index < lines.length && lines[index].kind === 'add') {
      added.push(lines[index]);
      index += 1;
    }
    for (let at = 0; at < Math.max(removed.length, added.length); at += 1) {
      rows.push({ left: removed[at] || null, right: added[at] || null });
    }
  }
  return rows;
}

/**
 * One changed file's whole change, drawn as the patch Git printed for it.
 *
 * This is a tab of its own rather than something the graph gives up its body
 * to: a patch is read line by line and never fits a column, and a reader
 * coming back to it expects it to still be there. Everything it needs to
 * re-read the file arrives as this tab's navigation parameters, so it holds no
 * reference to the panel that opened it — that panel may since have been
 * pointed at another worktree, or closed.
 *
 * The patch is read when the file is opened, not with the list: the list
 * already said how much changed, and only this file's lines are worth reading.
 * It can be read two ways — one column, or the old and new file side by side —
 * because which one is legible depends on how wide the column is and on what
 * the change is. Lines keep their own numbering beside the code, unchanged
 * stretches between hunks are counted rather than printed, and the code itself
 * keeps the app's syntax colours rather than being painted over in red and
 * green: the tint and the rule at the edge say what changed.
 */
function FileDiffView(props) {
  const { repo, worktree, path, oid, from, sessionId, actions } = props;
  const [state, setState] = React.useState<FileDiffState>({ status: 'loading' });
  const [mode, setMode] = React.useState<DiffMode>('unified');
  // Long lines wrap by default: this tab is a column of a sidebar, where a line
  // that runs off the edge is read by scrolling rather than by reading.
  const [wrap, setWrap] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const menuAnchor = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setState({ status: 'loading' });
    api('file-diff', { repo, worktree, path, oid, from }, sessionId, controller.signal)
      .then((data) => { if (alive) setState({ status: 'ready', data }); })
      .catch((error) => {
        if (!alive || controller.signal.aborted) return;
        // A route this Host does not have is an answer about the Host, not
        // about the file, and it is the one failure the reader can act on.
        setState({
          status: 'failed',
          error: /HTTP 404/.test(error.message)
            ? 'This Harness build does not serve file patches yet. Update the plugin, restart the Host, and reload this page.'
            : error.message,
        });
      });
    return () => { alive = false; controller.abort(); };
  }, [repo, worktree, path, oid, from, sessionId]);

  // The app's own highlighter, on the grammar the filename selects. A language
  // it has no grammar for, or one still loading, answers nothing and the line
  // is drawn as plain text — never as an error, and re-highlighted when the
  // grammar arrives.
  const language = React.useMemo(() => languageForPath(path), [path]);
  const highlight = useCodeHighlighter(language);
  const runsFor = React.useMemo(() => {
    const cache = new Map<string, HighlightSpan[]>();
    return (text: string): HighlightSpan[] => {
      if (!text) return [];
      const held = cache.get(text);
      if (held !== undefined) return held;
      const highlighted = highlight(text);
      const first = (highlighted && highlighted[0]) || [];
      const runs = first.length > 0 ? first : [{ text, style: {} }];
      cache.set(text, runs);
      return runs;
    };
  }, [highlight]);
  const runs = (line: FileDiffLine | null) => (line
    ? runsFor(diffLineText(line)).map((run, at) => h('span', { key: at, style: run.style }, run.text))
    : null);
  /** One line of a side-by-side column: its number on its own side, then the code. */
  /**
   * The side of a run that has no line: an empty numbering column beside one
   * hatched code cell. The hatching is the code's alone — a number has nothing
   * to say about a line the file does not have — and one cell covers the whole
   * run so its stripes do not restart at every line.
   */
  const splitEmpty = () => h('div', { className: 'dsh-gw-dsempty' },
    h('div', { className: 'dsh-gw-dsnumcol' }),
    h('div', { className: 'dsh-gw-dshatch' }));
  const splitLine = (line: FileDiffLine, old: boolean, key: number) => h('div', {
    key, className: clsx('dsh-gw-dsline', `dsh-gw-dsline-${line.kind}`),
  },
    h('span', { className: 'dsh-gw-dnum' }, String(old ? line.old : line.new)),
    h('span', { className: clsx('dsh-gw-dtext', `dsh-gw-dtext-${line.kind}`) }, runs(line)));

  // The tab system's own way into a file: the document preview claims a
  // session-scoped resource address and opens the file in its own tab. A Host
  // whose preview refuses the address answers with its own message, which is
  // why this reports rather than swallows.
  const openTheFile = () => {
    if (!actions || typeof actions.openResource !== 'function' || !sessionId || !path) {
      setNotice('This tab cannot open the file in a preview tab.');
      return;
    }
    const address = `dsh-resource://file/session/${encodeURIComponent(sessionId)}/${path.split('/').map(encodeURIComponent).join('/')}`;
    try {
      actions.openResource(address);
    } catch (error) {
      setNotice(`Could not open the file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const onMenuSelect = (id: string) => {
    setMenuOpen(false);
    if (id === 'split') { setMode((value) => (value === 'split' ? 'unified' : 'split')); return; }
    if (id === 'wrap') { setWrap((value) => !value); return; }
    if (id === 'copy') {
      void writeClipboard(path).then((ok) => setNotice(ok ? 'Path copied' : 'Could not copy the path'));
    }
  };

  const data = state.status === 'ready' ? state.data : null;
  const hunks = data ? data.hunks : [];
  const body: React.ReactNode[] = [];
  if (state.status === 'loading') body.push(h('div', { className: 'dsh-gw-msg', key: 'loading' }, 'Reading the diff…'));
  if (state.status === 'failed') body.push(h('div', { className: 'dsh-gw-error', key: 'failed' }, state.error));
  // A note replaces the lines: it says what could not be shown and why.
  if (data && data.note) body.push(h('div', { className: 'dsh-gw-msg', key: 'note' }, data.note));
  if (data && !data.note && data.binary) {
    body.push(h('div', { className: 'dsh-gw-msg', key: 'binary' }, 'This file is binary, so its change is not shown as lines.'));
  }
  if (data && !data.note && !data.binary && hunks.length === 0) {
    body.push(h('div', { className: 'dsh-gw-msg', key: 'empty' }, 'This file has no textual change.'));
  }

  for (let index = 0; index < hunks.length; index += 1) {
    const hunk = hunks[index];
    const gap = diffGapBefore(hunks, index);
    if (gap > 0) {
      body.push(h('div', { className: 'dsh-gw-dgap', key: `gap${index}` },
        h(IconChevronsUpDownOutlineRegular, { size: 14, className: 'dsh-gw-dgapicon' }),
        h('span', null, `${gap} unmodified line${gap === 1 ? '' : 's'}`)));
    }
    if (mode === 'unified') {
      body.push(h('div', { className: 'dsh-gw-hunk', key: `hunk${index}` },
        hunk.lines.map((line, at) => h('div', {
          key: at,
          className: clsx('dsh-gw-dline', `dsh-gw-dline-${line.kind}`),
        },
          h('span', { className: 'dsh-gw-dnum' }, String(line.new === null ? line.old : line.new)),
          h('span', { className: clsx('dsh-gw-dtext', `dsh-gw-dtext-${line.kind}`) }, runs(line))))));
      continue;
    }
    body.push(h('div', { className: 'dsh-gw-hunk dsh-gw-dsblock', key: `hunk${index}` },
      diffSplitParts(diffSplitRows(hunk)).map((part, at) => h('div', { className: 'dsh-gw-dsrow', key: at },
        part.empty === 'left'
          ? splitEmpty()
          : h('div', { className: 'dsh-gw-dscol' },
            part.rows.map((row, line) => (row.left ? splitLine(row.left, true, line) : null))),
        part.empty === 'right'
          ? splitEmpty()
          : h('div', { className: 'dsh-gw-dscol' },
            part.rows.map((row, line) => (row.right ? splitLine(row.right, false, line) : null)))))));
  }
  if (data && data.truncated) {
    body.push(h('div', { className: 'dsh-gw-msg', key: 'cut' }, 'This patch was cut short. Read the file itself for the rest.'));
  }

  return h('div', {
    className: 'dsh-gw-diffpane',
    'data-wrap': wrap ? 'true' : 'false',
    'data-mode': mode,
  },
    h('div', { className: 'dsh-gw-diffhead' },
      h(FileTypeIcon, { kind: classifyFileType(path), size: 16, className: 'dsh-gw-difficon' }),
      h('div', { className: 'dsh-gw-difftitle' },
        h(PathLabel, { path, className: 'dsh-gw-diffpath' })),
      // The change's own totals sit against the name they belong to; the space
      // left over is what keeps the controls at the far edge.
      data && (data.add > 0 || data.del > 0) ? h('div', { className: 'dsh-gw-diffcounts' },
        data.add > 0 ? h('span', { className: 'dsh-gw-add', key: 'a' }, `+${data.add}`) : null,
        data.del > 0 ? h('span', { className: 'dsh-gw-del', key: 'd' }, `-${data.del}`) : null) : null,
      data && DIFF_STATUS_LABEL[data.status]
        ? h('span', { className: 'dsh-gw-diffstatus' }, DIFF_STATUS_LABEL[data.status])
        : null,
      // Which change this file is being read inside, so a patch opened from a
      // commit cannot be mistaken for one opened from the working tree.
      oid ? h('span', { className: 'dsh-gw-diffoid dsh-gw-mono', title: oid }, shortOid(oid)) : null,
      notice ? h('span', { className: 'dsh-gw-diffstatus', key: 'notice' }, notice) : null,
      h('div', { className: 'dsh-gw-diffspace' }),
      h('div', { className: 'dsh-gw-difftools' },
        h(Menu, {
          open: menuOpen,
          portal: true,
          align: 'end',
          compact: true,
          selection: 'check',
          // A checked row is a state, an unchecked one is not: the two views are
          // one option that is either on or off, as are wrapped lines.
          selectedIds: [...(mode === 'split' ? ['split'] : []), ...(wrap ? ['wrap'] : [])],
          anchor: h('button', {
            type: 'button', className: 'dsh-gw-iconbtn', ref: menuAnchor,
            title: 'View options', 'aria-label': 'View options',
            'aria-haspopup': 'menu', 'aria-expanded': menuOpen,
            onClick: () => { setNotice(null); setMenuOpen((open) => !open); },
          }, h(IconEllipsisOutlineRegular, { size: 15 })),
          items: [
            { id: 'split', label: 'Split view', icon: h(IconCompareSplitOutlineRegular, { size: 16 }) },
            { id: 'wrap', label: 'Wrap long lines', icon: h(IconWrapLinesOutlineRegular, { size: 16 }) },
            DIFF_MENU_ROWS[2],
            { id: 'copy', label: 'Copy file path', icon: h(IconCopyOutlineRegular, { size: 16 }) },
          ],
          onSelect: onMenuSelect,
          onClose: () => setMenuOpen(false),
          // The column clips at its own edges, so the list is drawn over the
          // page from the button's own rectangle rather than inside it.
          getAnchorRect: () => (menuAnchor.current ? menuAnchor.current.getBoundingClientRect() : null),
        }),
        h('button', {
          type: 'button', className: 'dsh-gw-iconbtn',
          title: 'Open this file in a preview tab', 'aria-label': 'Open this file in a preview tab',
          disabled: !(actions && typeof actions.openResource === 'function'),
          onClick: openTheFile,
        }, h(IconRightUpOutlineRegular, { size: 15 })))),
    // The lines scroll; the header above them does not, so the file's name and
    // its counts stay readable however far a line is scrolled sideways.
    h('div', { className: 'dsh-gw-difflines' },
      h('div', { className: 'dsh-gw-diffbody' }, body)));
}

/**
 * The diff tab's body: the patch its navigation parameters name.
 *
 * A tab is placed before it is rendered and re-navigated in place, so a
 * missing path is a wiring mistake rather than a state — the panel never opens
 * this type without one.
 */
function FileDiffTab(props) {
  const info = typeof props.useTabInfo === 'function' ? props.useTabInfo() : null;
  const tab = info ? info.tab : null;
  const params = (tab && tab.navigation && tab.navigation.params) || {};
  return h(FileDiffView, {
    repo: params.repo || null,
    worktree: params.worktree || null,
    path: String(params.path || ''),
    oid: params.oid || null,
    from: params.from || null,
    sessionId: props.sessionId || (tab && tab.sessionId) || null,
    // The tab system's own actions, so the view can open the file it is
    // showing in a preview tab without knowing how tabs are opened.
    actions: (tab && tab.actions) || null,
  });
}

/** The chip the strip draws for a diff tab: the file it is showing. */
function FileDiffTitle(props) {
  const info = typeof props.useTabInfo === 'function' ? props.useTabInfo() : null;
  const tab = info ? info.tab : null;
  const params = (tab && tab.navigation && tab.navigation.params) || {};
  const name = String(params.path || '').split('/').filter(Boolean).pop();
  return h(React.Fragment, null, h(DiffMarkGlyph, { size: 16 }), name || FILE_DIFF_TITLE);
}

/** What the error boundary wraps: the whole tab body. */
interface BoundaryProps { children?: React.ReactNode }
/** The failure the boundary caught, or null while it is standing by. */
interface BoundaryState { error: { message?: string } | null }

/** A visible failure inside the tab, so a broken repository never blanks the panel. */
class Boundary extends React.Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: { message?: string }): BoundaryState {
    return { error };
  }
  render() {
    if (this.state.error) {
      return h('div', { className: 'dsh-gw' },
        h('div', { className: 'dsh-gw-error' }, `Git Worktree panel failed to render: ${this.state.error.message}`));
    }
    return this.props.children;
  }
}

/** The whole panel state, held as one object in the component's first state hook. */
interface PanelState {
  status: 'loading' | 'ready' | 'failed';
  repo: string | null;
  resolved: boolean;
  worktrees: WorktreeSummary[];
  graph: GraphPayload | null;
  nodes: GraphNode[];
  capabilities: string[];
  error: string | null;
  sessionId: string | null;
  more: boolean;
  exhausted: boolean;
}

function WorktreeTab(props) {
  const info = typeof props.useTabInfo === 'function' ? props.useTabInfo() : null;
  const tab = info ? info.tab : null;
  // The framework hands a session-scoped tab body its own `sessionId`; the
  // record carries one only in some builds, and 'current' is a last resort the
  // Host answers honestly about rather than a stand-in for a real session.
  const sessionId = props.sessionId || (tab && tab.sessionId) || 'current';
  const navigate = tab && tab.navigation ? tab.navigation.params : null;

  const saved = viewState.get(sessionId) || {};
  const [state, setState] = React.useState<PanelState>({
    status: 'loading', repo: null, resolved: false, worktrees: [],
    graph: null, nodes: [], capabilities: [], error: null, sessionId: null, more: false,
    // A page that came back shorter than the one asked for is the end of the
    // history. The Host answers no "has more" field, so the requested page
    // size is the only thing separating "stopped here" from "that is all
    // there is" — without it a two-commit repository was offered a button
    // that could only ever fetch nothing.
    exhausted: false,
  });
  const [selected, setSelected] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<string>(saved.scope || 'all');
  const [showRemote, setShowRemote] = React.useState<boolean>(Boolean(saved.showRemote));
  // Keep this hook slot for the integration's render harness. The graph is
  // always visible now that its toggle has been removed.
  const [showGraph] = React.useState<boolean>(true);
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState<number>(0);
  const [width, setWidth] = React.useState<number>(900);
  const [height, setHeight] = React.useState<number>(720);
  // The write controls. They are appended after the nine read states on purpose:
  // The integration's verification script drives this component by injecting a scenario into
  // states 0 and 1 and overriding 4, 5 and 8, so the read states keep their
  // positions and only the panel's powers gain new ones.
  const [menu, setMenu] = React.useState<{ x: number; y: number; commit: string } | null>(null);
  const [preview, setPreview] = React.useState<OperationPreview | null>(null);

  // "Show Remote Branches" scopes the history itself, not only the labels:
  // unchecked, the Host walks local refs and drops remote-only commits.
  const remoteParam = showRemote ? '1' : '0';

  const repo = (navigate && navigate.repo)
    || (state.sessionId === sessionId ? state.repo : null)
    || null;

  // This panel is a user-resizable column, a split pane or a float, so every
  // column decision follows its own measured width — and how tall an expanded
  // detail may grow follows its measured height the same way.
  const rootRef = React.useRef<HTMLDivElement | null>(null);
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
    viewState.set(sessionId, { scope, showRemote });
  }, [sessionId, scope, showRemote]);

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

  // The controls appear only when the host supplied history operations.
  const operations = transport && transport.operations ? transport.operations : null;

  /** Ask for a plan and show it. Nothing runs until Apply. */
  const openPreview = async (operation: 'rebase' | 'cherry-pick', commit: string) => {
    if (!operations || !repo || !selected) return;
    setMenu(null);
    setState((previous) => ({ ...previous, error: null }));
    try {
      setPreview(operation === 'rebase'
        ? await operations.rebasePreview({ repo, worktree: selected, target: commit })
        : await operations.cherryPickPreview({ repo, worktree: selected, commit }));
    } catch (error) {
      setState((previous) => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
    }
  };

  /** Apply the plan the user confirmed, then re-read what it changed. */
  const applyPreview = async () => {
    if (!operations || !preview) return;
    const run = preview.operation === 'rebase' ? operations.rebaseApply : operations.cherryPickApply;
    try {
      await run({ planId: preview.planId, confirm: true });
      setPreview(null);
      setState((previous) => ({ ...previous, status: 'loading', resolved: false, error: null }));
      setReloadKey((key) => key + 1);
    } catch (error) {
      setPreview(null);
      setState((previous) => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
    }
  };

  const nodes = state.nodes || [];
  const layout = React.useMemo(() => layoutLanes(nodes), [nodes]);
  // A file row always opens a patch, in the tab that is built to read one. The
  // Host advertising `file-diff-v1` is what makes that certain, but the list is
  // read once when this tab resolves its repository — and a Host that gained
  // the route afterwards (a restarted or live-patched Harness) would leave
  // every row permanently dead behind a capability that had gone stale. So the
  // read answers for itself: the diff tab says what a Host without the route
  // is missing, and nothing here has to guess.
  const openFile = (file: ChangedFile, oid: string | null) => {
    const actions = tab && tab.actions;
    // Everything the diff tab needs to re-read the patch travels with it: the
    // tab is a page of its own, not a view of this one's state.
    const params = {
      repo: state.repo,
      worktree: selected,
      path: file.path,
      oid,
      from: file.from || null,
    };
    // A click that opens nothing is worse than one that fails: without these
    // the tab system is not reachable from here at all, which is a fact about
    // the build that the reader can act on.
    if (!actions || typeof actions.openTab !== 'function') {
      setState((previous) => ({
        ...previous,
        error: 'This tab cannot open another one. Reload the Harness window to pick up the current build of this plugin.',
      }));
      return;
    }
    try {
      actions.openTab(FILE_DIFF_KIND, { params });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: `Could not open the diff tab: ${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  };
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
  const detailNarrow = width - (showGraph ? graphWidth : 0) - 16 < DETAIL_TWO_COLUMN_MIN;
  // How tall one expanded detail may grow: a share of the panel, floored so a
  // short panel still shows its first rows and capped so a tall one does not
  // open a detail that fills the whole column.
  const detailMax = Math.max(
    DETAIL_MAX_FLOOR,
    Math.min(DETAIL_MAX_CEILING, Math.round(height * DETAIL_MAX_SHARE)),
  );

  const trackWidth = Math.max(0, width - COLUMN_GUTTER);
  const textWidth = trackWidth - graphWidth;
  const showDate = textWidth >= DESCRIPTION_MIN + DATE_MIN;
  const showAuthor = textWidth >= DESCRIPTION_MIN + DATE_MIN + AUTHOR_MIN;
  // Share space beyond the minimums between all visible columns. On the way
  // down, Date, Author and Description therefore shrink together; a column
  // disappears only after every visible column reaches its minimum width.
  const extra = Math.max(0, textWidth - DESCRIPTION_MIN - (showDate ? DATE_MIN : 0) - (showAuthor ? AUTHOR_MIN : 0));
  const dateWidth = showAuthor
    ? Math.min(DATE_MAX, DATE_MIN + Math.floor(extra * 0.12))
    : Math.min(DATE_MAX, DATE_MIN + Math.floor(extra * 0.15));
  const authorWidth = Math.min(AUTHOR_MAX, AUTHOR_MIN + Math.floor(extra * 0.12));
  const columns = [
    ...(showGraph ? [`${graphWidth}px`] : []),
    'minmax(0, 1fr)',
    ...(showDate ? [`${dateWidth}px`] : []),
    ...(showAuthor ? [`${authorWidth}px`] : []),
  ].join(' ');

  // Match the built-in Files tab: PathLabel keeps the complete path and fades
  // its leading edge when the pane is too narrow, leaving the filename visible.
  const toolbar = h('div', { className: 'dsh-gw-tbar' },
    current
      ? h(PathLabel, {
          path: current.path,
          className: 'dsh-gw-wt',
          key: 'wt-path',
        })
      : h('span', { className: 'dsh-gw-wt-placeholder', title: state.status === 'failed' ? 'Repository unavailable' : 'Loading worktrees' },
        state.status === 'failed' ? 'Repository unavailable' : 'Loading…'),
    h('div', { className: 'dsh-gw-icons' },
      h('button', {
        type: 'button', className: 'dsh-gw-iconbtn',
        title: showRemote ? 'Showing remote branches; click to show local only' : 'Showing local branches; click to include remotes',
        'aria-label': 'Show remote branches', 'aria-pressed': showRemote,
        onClick: () => setShowRemote((value) => !value),
      }, h(RemoteCloudIcon, { hidden: !showRemote })),
      h('button', {
        type: 'button', className: 'dsh-gw-iconbtn', title: 'Refresh',
        'aria-label': 'Refresh',
        onClick: () => {
          setState((previous) => ({ ...previous, status: 'loading', resolved: false, error: null }));
          setReloadKey((key) => key + 1);
          setOpenKey(null);
        },
      }, h(IconRefreshOutlineRegular))));

  const head: React.ReactNode[] = [];
  head.push(toolbar);

  if (state.error) head.push(h('div', { className: 'dsh-gw-error', key: 'error' }, state.error));
  if (state.status === 'loading') head.push(h('div', { className: 'dsh-gw-msg', key: 'loading' }, 'Loading repository…'));

  const grid: React.ReactNode[] = [];

  // The working tree rides the graph as its own row, above the newest commit.
  // A clean worktree has nothing to show, so the row is absent instead of
  // sitting there as a dead entry that expands into an empty detail.
  if (state.repo && state.status === 'ready' && changeCount > 0) {
    grid.push(h('div', {
      key: 'uncommitted',
      className: clsx('dsh-gw-row', openKey === 'uncommitted' && 'dsh-gw-row-open'),
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
        h('span', { className: 'dsh-gw-dot' })),
      showDate ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec' }, '') : null,
      showAuthor ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec' }, '') : null));
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
        narrow: detailNarrow,
        supportsStructured: state.capabilities.includes('uncommitted-v1'),
        // The working tree's own change: a patch with no commit behind it.
        onOpenFile: (file) => openFile(file, null),
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
    const visibleRefs = ((node.refs || []).map(normalizeRef).filter(Boolean) as GraphRef[])
      .filter((ref) => ref.kind === 'branch' || ref.kind === 'worktree')
      // The current-worktree chip leads the Description cell. Stable sort so
      // the rest keeps the Host's order even when an older Host appends the
      // worktree ref after the branches.
      .sort((left, right) => (right.kind === 'worktree' ? 0 : 1) - (left.kind === 'worktree' ? 0 : 1));
    // The worktree's own ref absorbs the branch it holds, so the two facts
    // about this commit read as one chip instead of two.
    const refs = mergeWorktreeBranch(visibleRefs, worktreeBranch);
    // The "+N" badge is the Host's count minus what was drawn, so it only means
    // anything while both halves agree on what a row draws. A Host that predates
    // this policy counts tags, stashes and mirrors too, and no badge is better
    // than one promising refs this browser half will not draw.
    const counted = (node.refs || []).every((ref) => ref.kind === 'branch' || ref.kind === 'worktree');
    const hiddenRefs = counted ? (node.refCount || 0) - visibleRefs.length : 0;
    grid.push(h('div', {
      key: node.id,
      className: clsx('dsh-gw-row', isHead && 'dsh-gw-row-head', openKey === node.id && 'dsh-gw-row-open'),
      style: { '--dsh-gw-cols': columns },
      role: 'button', tabIndex: 0, 'aria-expanded': openKey === node.id,
      onClick: () => onToggle(node.id),
      onContextMenu: operations ? (event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY, commit: node.id });
      } : undefined,
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
            ? h('span', { className: 'dsh-gw-ref', title: 'More local branches' }, `+${hiddenRefs}`)
            : null,
          h('span', { className: 'dsh-gw-subjtext' }, node.subject || '(no commit message)'))),
      showDate ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec', title: absoluteTime(node.authoredAt) },
        absoluteTime(node.authoredAt)) : null,
      showAuthor ? h('div', { className: 'dsh-gw-cell dsh-gw-cell-sec', title: node.author || '' }, node.author || '') : null));

    if (openKey === node.id) {
      grid.push(h(DetailRegion, {
        key: `${node.id}-detail`,
        max: detailMax,
        rail: showGraph ? h(GraphRail, { layout, index, colors, width: graphWidth }) : null,
      }, h(CommitDetail, {
        repo: state.repo,
        oid: node.id,
        sessionId,
        narrow: detailNarrow,
        onOpenFile: (file) => openFile(file, node.id),
      })));
    }
  }

  // The next page is offered only while one exists: a repository shorter
  // than a page used to carry a button that could only fetch nothing.
  if (state.status === 'ready' && nodes.length > 0 && state.graph && !state.exhausted) {
    grid.push(h('div', { className: 'dsh-gw-more', key: 'more' },
      h(Button, { type: 'button', variant: 'outline', size: 'sm', disabled: state.more, onClick: loadMore },
        state.more ? 'Loading…' : 'Load more')));
  }

  if (state.status === 'ready' && state.graph && state.graph.unborn) {
    grid.push(h('div', { className: 'dsh-gw-empty', key: 'unborn' }, 'This repository has no commits yet; only uncommitted changes.'));
  } else if (state.status === 'ready' && !state.repo) {
    grid.push(h('div', { className: 'dsh-gw-empty', key: 'norepo' }, 'No repository path is available.'));
  } else if (state.status === 'ready' && nodes.length === 0) {
    grid.push(h('div', {
      className: 'dsh-gw-empty',
      key: 'empty',
      title: JSON.stringify({ root: state.repo, selected, scope }),
    }, state.graph ? 'No commits in this range.' : 'The graph is still loading, or the last request failed.'));
  }

  return h('div', {
    className: 'dsh-gw', ref: rootRef,
    style: { '--dsh-gw-row-height': `${ROW}px` },
  },
    head,
    h('div', { className: 'dsh-gw-scroll' },
      h('div', { className: 'dsh-gw-grid' }, grid)),
    menu && operations ? h(Menu, {
      open: true,
      anchor: h('span', { 'aria-hidden': true }),
      portal: true,
      autoFocus: true,
      getAnchorRect: () => new DOMRect(menu.x, menu.y - 4, 0, 0),
      items: [
        { id: 'rebase', label: 'Rebase onto this commit' },
        { id: 'cherry-pick', label: 'Cherry-pick this commit' },
      ],
      onSelect: (id) => void openPreview(id as 'rebase' | 'cherry-pick', menu.commit),
      onClose: () => setMenu(null),
    }) : null,
    preview ? h(Modal, {
      open: true,
      title: preview.operation === 'rebase' ? 'Confirm rebase' : 'Confirm cherry-pick',
      closeLabel: 'Close',
      onClose: () => setPreview(null),
      backdropBlur: false,
      className: 'dsh-gw-modal',
      footer: h('div', { className: 'dsh-gw-actions' },
        h(Button, { type: 'button', variant: 'outline', size: 'sm', onClick: () => setPreview(null) }, 'Cancel'),
        h(Button, { type: 'button', variant: 'outline', size: 'sm', className: 'dsh-gw-danger', onClick: () => void applyPreview() },
          preview.operation === 'rebase' ? 'Rebase' : 'Cherry-pick')),
    },
      h('p', null, 'Worktree: ', h('code', null, preview.worktreePath)),
      h('p', null, 'Branch: ', h('strong', null, preview.branch), ' · HEAD ', h('code', null, preview.head.slice(0, 8))),
      h('p', null, 'Target commit: ', h('code', null, preview.targetCommit.slice(0, 8))),
      h('p', null, `Preview includes ${preview.commits.length} commit${preview.commits.length === 1 ? '' : 's'} · expires at ${new Date(preview.expiresAt).toLocaleTimeString('en-US')}`),
      h('details', null, h('summary', null, 'View commits'),
        h('ol', null, preview.commits.map((commit) => h('li', { key: commit }, h('code', { title: commit }, commit.slice(0, 12)))))),
      preview.warnings.map((warning) => h('p', { className: 'dsh-gw-warn', key: warning }, warning))) : null);
}

/**
 * The chip the strip draws for the graph tab.
 *
 * Its glyph is one size down from the rest: this artwork is drawn to the edges
 * of its 16-unit box, where a file-type icon of the same size leaves a margin,
 * so at 16 it reads a size larger than the chips beside it.
 */
function WorktreeTitle() {
  return h(React.Fragment, null, h(IconBranchOutlineRegular, { size: 14 }), WORKTREE_TAB_TITLE);
}

const GuideIcon = () => h('svg', {
  viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true,
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
},
  h('circle', { cx: 4, cy: 4, r: 2 }),
  h('circle', { cx: 4, cy: 12, r: 2 }),
  h('circle', { cx: 12, cy: 8, r: 2 }),
  h('path', { d: 'M4 6v4M6 4h3a3 3 0 0 1 3 3v1' }));

export { Boundary, CSS_MODULE_TEXT, FileDiffTab, FileDiffTitle, GuideIcon, WorktreeTab, WorktreeTitle, FILE_DIFF_KIND, FILE_DIFF_TITLE, WORKTREE_TAB_TITLE, configureView };
