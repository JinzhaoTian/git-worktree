window.__ModuleLoader__.load({
  id: "@JinzhaoTian/git-worktree-graph",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  default: () => client_default
});
module.exports = __toCommonJS(client_exports);
var React2 = __toESM(require("react"), 1);

// src/ui/worktree.ts
var React = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var h = React.createElement;
var WORKTREE_TAB_TITLE = "Git Worktree Graph";
var PAGE = 300;
var ROW = 26;
var COL = 14;
var PAD = 10;
var MARGIN = 8;
var CROSS_NEAR = 7;
var CROSS_FAR = ROW - 7;
var W_DATE = 560;
var W_AUTHOR = 700;
var W_COMMIT = 820;
var W_DETAIL_SPLIT = 680;
var DETAIL_MAX_SHARE = 0.45;
var DETAIL_MAX_CEILING = 420;
var DETAIL_MAX_FLOOR = ROW * 6;
var RESOLVE_ATTEMPTS = 4;
var RESOLVE_BACKOFF_MS = 300;
var LANE_COLORS = ["#2f8ae0", "#d0569b", "#38a169", "#d98a2b", "#8b72e0", "#0fa8ad", "#c05252", "#7a8b2f"];
var DIFF_ADD = "#3fa34d";
var DIFF_DEL = "#d05a4e";
var viewState = /* @__PURE__ */ new Map();
var CSS = `
.dsh-gw { display: flex; flex-direction: column; height: 100%; min-height: 0; font-size: 12px; color: var(--gw-label-primary); background: var(--gw-bg-base); }
.dsh-gw * { box-sizing: border-box; }
.dsh-gw-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 24px; padding: 0 8px; border: 1px solid var(--gw-border-l2); border-radius: 6px; background: var(--gw-bg-layer-1); color: var(--gw-label-primary); font: inherit; cursor: pointer; }
.dsh-gw-btn:hover:not(:disabled) { background: var(--gw-bg-layer-2); }
.dsh-gw-btn:disabled { opacity: .5; cursor: default; }
.dsh-gw-tbar { display: flex; align-items: center; gap: 4px; flex: 0 0 38px; width: 100%; min-width: 0; height: 38px; padding: 0 6px 0 16px; border-bottom: .5px solid var(--dsw-alias-border-l3, var(--gw-border-l1)); background: var(--gw-sidebar-fill); white-space: nowrap; }
.dsh-gw-icons { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 2px; }
.dsh-gw-iconbtn { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 6px; border: 0; border-radius: var(--dsw-radius-sm, 6px); background: none; color: var(--gw-label-secondary); cursor: pointer; line-height: 1; }
.dsh-gw-iconbtn svg { width: 15px; height: 15px; }
.dsh-gw-iconbtn:hover, .dsh-gw-iconbtn[aria-pressed=true] { background: var(--dsw-alias-interactive-bg-hover, var(--gw-bg-layer-2)); color: var(--gw-label-primary); }
.dsh-gw-iconbtn:focus-visible { outline: 2px solid var(--gw-brand-primary); outline-offset: 1px; }
.dsh-gw-wt { margin-right: 12px; }
.dsh-gw-wt-placeholder { flex: 1 1 auto; min-width: 0; overflow: hidden; color: var(--gw-label-secondary); }
.dsh-gw-dot { flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%; background: var(--gw-state-warn); }
.dsh-gw-msg { padding: 5px 10px; color: var(--gw-label-secondary); border-bottom: 1px solid var(--gw-border-l1); }
.dsh-gw-error { margin: 8px 10px; padding: 6px 8px; border: 1px solid var(--gw-state-error); border-radius: 6px; color: var(--gw-state-error); white-space: pre-wrap; word-break: break-word; }
.dsh-gw-empty { padding: 16px 10px; color: var(--gw-label-secondary); text-align: center; }

.dsh-gw-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
.dsh-gw-grid { display: flex; flex-direction: column; min-width: 100%; }
/* The lane is drawn as one ROW-tall slice per row, so a row's pitch has to be
   exactly ROW and every slice has to begin at its row's top. A bottom border
   and an inline SVG's baseline gap each add height the drawing knows nothing
   about, and that is what left the lane visibly broken between rows. The
   separator is an inset shadow so it costs no layout. */
.dsh-gw-row { display: grid; grid-template-columns: var(--dsh-gw-cols); align-items: center; height: 26px; overflow: hidden; border-left: 2px solid transparent; box-shadow: inset 0 -1px 0 var(--gw-sidebar-fill); cursor: pointer; outline: none; }
/* The layer token is the same white the panel already sits on in the light
   theme, so an open row was marked by its left stripe alone and hovering one
   showed nothing at all. Mixing the label colour into the layer tints darker on
   the light theme and lighter on the dark one \u2014 the two directions "selected"
   reads as \u2014 and stays on theme tokens instead of a fixed grey. */
.dsh-gw-row:hover:not(.dsh-gw-row-open) { background: color-mix(in srgb, var(--gw-label-primary) 3%, var(--gw-bg-layer-1)); }
.dsh-gw-row:focus-visible { box-shadow: inset 0 0 0 1px var(--gw-brand-primary), inset 0 -1px 0 var(--gw-sidebar-fill); }
.dsh-gw-row-open { background: color-mix(in srgb, var(--gw-label-primary) 6%, var(--gw-bg-layer-1)); border-left-color: var(--gw-brand-primary); }
.dsh-gw-cell { display: flex; align-items: center; min-width: 0; padding: 0 8px; }
.dsh-gw-cell-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--gw-label-secondary); }
.dsh-gw-cell-sec { color: var(--gw-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsh-gw-gcell { display: flex; align-self: stretch; overflow: hidden; }
.dsh-gw-gcell svg { display: block; flex: 0 0 auto; }
.dsh-gw-subj { display: flex; align-items: center; gap: 6px; min-width: 0; width: 100%; }
.dsh-gw-subjtext { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-gw-ref { flex: 0 0 auto; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 5px; border-radius: 4px; font-size: 11px; line-height: 16px; border: 1px solid var(--gw-border-l2); background: var(--gw-bg-layer-2); color: var(--gw-label-secondary); }
/* A branch chip is the lane's own: tile, border, tint and now the name all come
   from the lane colour, so one branch reads as one colour rather than as green
   chrome around black text. */
.dsh-gw-ref-branch, .dsh-gw-ref-remote { display: inline-flex; align-items: center; gap: 4px; padding: 0 5px 0 0; border-color: color-mix(in srgb, var(--dsh-gw-ref-color) 42%, var(--gw-border-l2)); background: color-mix(in srgb, var(--dsh-gw-ref-color) 8%, var(--gw-bg-layer-2)); color: var(--dsh-gw-ref-color); }
.dsh-gw-ref-remote { border-style: dashed; }
.dsh-gw-ref-icon { display: inline-flex; align-items: center; justify-content: center; align-self: stretch; width: 18px; min-width: 18px; min-height: 16px; border-radius: 3px 0 0 3px; background: var(--dsh-gw-ref-color); color: white; }
.dsh-gw-ref-icon svg { display: block; }
.dsh-gw-ref-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.dsh-gw-ref-remote-name { color: var(--gw-label-secondary); font-style: italic; }
.dsh-gw-ref-current { border-color: color-mix(in srgb, var(--dsh-gw-ref-color) 68%, var(--gw-border-l2)); font-weight: 600; }
.dsh-gw-ref-tag { color: var(--gw-state-success); }
.dsh-gw-ref-stash { color: var(--gw-state-warn); }
/* The worktree chip is one chip built from two cells: the inverted label (solid
   label color \u2014 black in light mode, white in dark \u2014 with the text knocked out),
   then the branch it holds drawn as a branch chip is. The frame belongs to the
   chip, not to either cell, so the label colour rings the whole pair while the
   branch name sits on its own lane-tinted surface rather than on the label's
   black. No gap between the cells, and the frame clips them to its own corners. */
.dsh-gw-ref-worktree { display: inline-flex; align-items: stretch; gap: 0; padding: 0; border: 1px solid var(--gw-label-primary); border-radius: 5px; overflow: hidden; background: none; font-size: 11px; }
.dsh-gw-ref-worktree-label { display: inline-flex; align-items: center; padding: 0 7px; background: var(--gw-label-primary); color: var(--gw-bg-base); font-size: 12px; font-weight: 600; line-height: 18px; }
.dsh-gw-ref-worktree-held { display: inline-flex; align-items: center; gap: 4px; padding: 0 7px 0 0; background: color-mix(in srgb, var(--dsh-gw-ref-color) 8%, var(--gw-bg-layer-2)); color: var(--gw-label-primary); line-height: 18px; }
.dsh-gw-ref-worktree-icon { display: inline-flex; align-items: center; justify-content: center; align-self: stretch; width: 18px; min-width: 18px; background: var(--dsh-gw-ref-color); color: white; }
.dsh-gw-ref-worktree-icon svg { display: block; }
.dsh-gw-ref-worktree-name { display: inline-flex; align-items: center; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-gw-ref-worktree-remote { color: var(--gw-label-secondary); font-style: italic; }

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
.dsh-gw-detailrow { display: flex; align-items: stretch; border-left: 2px solid transparent; border-bottom: 1px solid var(--gw-border-l1); background: color-mix(in srgb, var(--gw-label-primary) 4%, var(--gw-bg-layer-1)); }
.dsh-gw-rail { position: relative; flex: 0 0 auto; align-self: stretch; overflow: hidden; }
.dsh-gw-rail-line { position: absolute; top: 0; bottom: 0; border-radius: 1px; }
.dsh-gw-rail-turn { position: absolute; display: block; overflow: visible; }
.dsh-gw-detailbody { flex: 1 1 auto; min-width: 0; }
/* The two halves of a detail are flex columns rather than grid columns, because a
   grid row is sized from its item's content and ignores that item's max-height:
   capping the changed-file column there grew the row to the file list's full
   height and left the capped column floating in empty space. A flex line's cross
   size does respect the item's cap, so the row ends where the shorter of the two
   halves ends \u2014 the message keeps its height, the file list stops at its cap. */
.dsh-gw-detail { display: flex; align-items: stretch; }
.dsh-gw-detail-narrow { flex-direction: column; }
.dsh-gw-detail-left { flex: 1 1 0; padding: 8px 10px; min-width: 0; border-right: 1px solid var(--gw-border-l1); }
.dsh-gw-detail-narrow .dsh-gw-detail-left { border-right: 0; border-bottom: 1px solid var(--gw-border-l1); }
.dsh-gw-detail-narrow .dsh-gw-detail-left, .dsh-gw-detail-narrow .dsh-gw-detail-right { flex: 0 0 auto; }
.dsh-gw-kv { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 2px 8px; }
.dsh-gw-k { color: var(--gw-label-secondary); }
.dsh-gw-v { min-width: 0; overflow-wrap: anywhere; }
.dsh-gw-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.dsh-gw-body { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--gw-border-l1); white-space: pre-wrap; color: var(--gw-label-secondary); }
.dsh-gw-legacy { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--gw-label-secondary); }
/* Only the changed-file column is capped, and it scrolls on its own: the metadata
   and the commit message beside it keep their natural height, so a long message
   grows the block while a long file list scrolls inside its own box. The cap is
   inherited from the row, which also carries the rail, so the lane the expanded
   row sits on is drawn down the whole block however tall the left column gets. */
.dsh-gw-detail-right { flex: 1 1 0; padding: 8px 10px; min-width: 0; max-height: var(--dsh-gw-detail-max); overflow: auto; }
.dsh-gw-stat { color: var(--gw-label-secondary); margin-bottom: 6px; }
.dsh-gw-add { color: ${DIFF_ADD}; }
.dsh-gw-del { color: ${DIFF_DEL}; }
.dsh-gw-ftree { display: flex; flex-direction: column; }
.dsh-gw-frow { display: flex; align-items: center; gap: 6px; height: 19px; min-width: 0; }
.dsh-gw-fname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-gw-fstat { display: inline-flex; gap: 4px; margin-left: auto; padding-left: 8px; flex: 0 0 auto; }
.dsh-gw-menu { position: fixed; z-index: 20; display: flex; flex-direction: column; min-width: 168px; padding: 4px; border: 1px solid var(--gw-border-l2); border-radius: 6px; background: var(--gw-bg-layer-2); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28); }
.dsh-gw-menu button { border: 0; background: none; color: var(--gw-label-primary); text-align: left; padding: 6px 8px; border-radius: 4px; font: inherit; cursor: pointer; }
.dsh-gw-menu button:hover { background: var(--gw-bg-layer-1); }
.dsh-gw-backdrop { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, 0.45); }
.dsh-gw-modal { width: min(420px, 100%); max-height: 80%; overflow: auto; padding: 14px; border: 1px solid var(--gw-border-l2); border-radius: 8px; background: var(--gw-bg-base); color: var(--gw-label-primary); }
.dsh-gw-modal h2 { margin: 0 0 8px; font-size: 13px; }
.dsh-gw-modal p { margin: 4px 0; font-size: 11px; color: var(--gw-label-secondary); overflow-wrap: anywhere; }
.dsh-gw-modal ol { max-height: 140px; overflow: auto; margin: 6px 0; padding-left: 20px; font-size: 11px; }
.dsh-gw-warn { color: var(--gw-state-warn); }
.dsh-gw-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; }
.dsh-gw-danger { border-color: var(--gw-state-error); color: var(--gw-state-error); }
`;
var transport = null;
function configureView(next) {
  transport = next;
}
async function api(action, params, sessionId, signal) {
  if (!transport) throw new Error("Git Worktree: no transport is configured for this view.");
  const run = transport[action];
  return run(params || {}, sessionId ?? null, signal);
}
function samePath(left, right) {
  const norm = (value) => String(value || "").replace(/[\\/]+/g, "/").replace(/\/+$/, "").toLowerCase();
  const a = norm(left);
  return a !== "" && a === norm(right);
}
function shortOid(oid) {
  return String(oid || "").slice(0, 7);
}
function absoluteTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  const hhmm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${day} ${month} ${date.getFullYear()} ${hhmm}`;
}
function relativeTime(iso) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1e3));
  if (seconds < 60) return "\u521A\u521A";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} \u5206\u949F\u524D`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} \u5C0F\u65F6\u524D`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} \u5929\u524D`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} \u4E2A\u6708\u524D`;
  return `${Math.round(months / 12)} \u5E74\u524D`;
}
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
    waiting[lane] = null;
    for (const parent of node.parents || []) {
      if (!parent) continue;
      let parentLane = waiting.indexOf(parent);
      if (parentLane < 0) {
        parentLane = waiting.indexOf(null);
        if (parentLane < 0) parentLane = waiting.length;
        waiting[parentLane] = parent;
      }
      edges.push({ from: index, parent, to: nodes.length, route: [], fromLane: -1, toLane: -1, crossing: 0 });
    }
    const seat = /* @__PURE__ */ new Map();
    for (let slot = 0; slot < waiting.length; slot += 1) {
      if (waiting[slot]) seat.set(waiting[slot], slot);
    }
    seats.push(seat);
  }
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const lastSeats = seats.length > 0 ? seats[seats.length - 1] : null;
  for (const edge of edges) {
    edge.to = indexById.has(edge.parent) ? indexById.get(edge.parent) : nodes.length;
    edge.route = [];
    for (let row = edge.from + 1; row < edge.to && row < lanes.length; row += 1) {
      const seat = seats[row - 1] && seats[row - 1].get(edge.parent);
      if (seat === void 0) continue;
      const last = edge.route[edge.route.length - 1];
      if (last && last.lane === seat) continue;
      edge.route.push({ lane: seat, y: row * ROW + CROSS_NEAR });
    }
    edge.fromLane = lanes[edge.from];
    edge.toLane = edge.to < lanes.length ? lanes[edge.to] : (lastSeats ? lastSeats.get(edge.parent) : void 0) ?? edge.fromLane ?? -1;
  }
  let width = 0;
  for (const lane of lanes) width = Math.max(width, lane + 1);
  for (const edge of edges) {
    if (!Number.isInteger(edge.fromLane) || !Number.isInteger(edge.toLane)) {
      throw new Error(`git-worktree-graph: lane layout left edge ${edge.from}\u2192${edge.parent} without a column`);
    }
    width = Math.max(width, edge.fromLane + 1, edge.toLane + 1);
  }
  const departures = /* @__PURE__ */ new Map();
  for (const edge of edges) {
    const order = departures.get(edge.from) || 0;
    departures.set(edge.from, order + 1);
    edge.crossing = (edge.from + 1) * ROW + (order % 2 === 0 ? CROSS_NEAR : CROSS_FAR);
  }
  return { lanes, edges, width: Math.max(width, 1) };
}
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
function laneY(index) {
  return index * ROW + ROW / 2;
}
function edgeRuns(edge, x1, y1, x2, y2) {
  const points = [{ x: x1, y: y1 }, { x: x1, y: edge.crossing }];
  for (const step of edge.route || []) points.push({ x: laneX(step.lane), y: step.y });
  points.push({ x: x2, y: y2 });
  return points;
}
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
function rowPath(points, yTop, yBottom) {
  const kept = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const piece = clipSegment(points[index], points[index + 1], yTop, yBottom);
    if (!piece) continue;
    if (kept.length === 0) kept.push(piece[0]);
    kept.push(piece[1]);
  }
  if (kept.length < 2) return null;
  return kept.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y - yTop}`).join(" ");
}
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
    const points = x1 === x2 ? [{ x: x1, y: y1 }, { x: x1, y: y2 }] : edgeRuns(edge, x1, y1, x2, y2);
    const d = rowPath(points, yTop, yBottom);
    if (!d) continue;
    children.push(h("path", {
      key: `e${edge.from}:${edge.parent}:${index}`,
      d,
      fill: "none",
      stroke,
      strokeWidth: width,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }));
  }
  const lane = layout.lanes[index];
  if (lane !== void 0) {
    if (above) {
      children.push(h("line", {
        key: "working-tree-link",
        x1: laneX(lane),
        y1: 0,
        x2: laneX(lane),
        y2: ROW / 2,
        stroke: "var(--gw-label-secondary)",
        strokeWidth: 1.6
      }));
    }
    children.push(h("circle", {
      key: "node",
      cx: laneX(lane),
      cy: ROW / 2,
      r: head ? 4.5 : 4,
      fill: head ? "var(--gw-bg-base)" : colors.get(lane),
      stroke: head ? colors.get(lane) : "var(--gw-bg-base)",
      strokeWidth: head ? 2 : 1.6
    }));
  }
  return h(
    "div",
    { className: "dsh-gw-gcell", style: { height: ROW } },
    h("svg", { width: to, height: ROW, viewBox: `0 0 ${to} ${ROW}`, "aria-hidden": true }, children)
  );
}
function GraphRail(props) {
  const { layout, index, colors, worktree, width } = props;
  const lines = [];
  if (worktree) {
    lines.push(h("span", {
      key: "working-tree-link",
      className: "dsh-gw-rail-line",
      style: { left: `${laneX(0) - 0.8}px`, width: "1.6px", background: "var(--gw-label-secondary)" }
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
    const line = (suffix, style) => lines.push(h("span", {
      key: `${key}${suffix}`,
      className: "dsh-gw-rail-line",
      style: { background: colour, ...style }
    }));
    if (x1 === x2 || edge.crossing <= bandTop) {
      line("", { left: `${x2 - stroke / 2}px`, width: `${stroke}px` });
      continue;
    }
    const across = edge.crossing - bandTop;
    const ramp = edgeRuns(edge, x1, y1, x2, laneY(edge.to));
    const rise = ramp[2].y - ramp[1].y;
    line(":down", { left: `${x1 - stroke / 2}px`, width: `${stroke}px`, top: "0px", height: `${across}px`, bottom: "auto" });
    if (rise > 0) {
      lines.push(h("svg", {
        key: `${key}:ramp`,
        className: "dsh-gw-rail-turn",
        style: { left: "0px", top: `${across}px`, width: `${width}px`, height: `${rise}px` },
        viewBox: `0 0 ${width} ${rise}`,
        "aria-hidden": true
      }, h("line", {
        x1,
        y1: 0,
        x2,
        y2: rise,
        stroke: colour,
        strokeWidth: stroke,
        strokeLinecap: "round"
      })));
    }
    line(":onward", { left: `${x2 - stroke / 2}px`, width: `${stroke}px`, top: `${across + rise}px`, bottom: "0px" });
  }
  return h("div", { className: "dsh-gw-rail", style: { width }, "aria-hidden": true }, lines);
}
function DetailRegion(props) {
  const { rail, max, children } = props;
  return h(
    "div",
    {
      className: "dsh-gw-detailrow",
      style: { "--dsh-gw-detail-max": `${max}px` }
    },
    rail || null,
    h("div", { className: "dsh-gw-detailbody" }, children)
  );
}
function normalizeRef(ref) {
  if (typeof ref === "string") return { name: ref, kind: "branch", current: false };
  if (ref && typeof ref === "object") {
    return {
      name: String(ref.name ?? ""),
      kind: String(ref.kind ?? "branch"),
      current: Boolean(ref.current),
      // The worktree chip's second cell is the branch it absorbed, which is
      // decided before this point — normalizing must not drop it, or the chip
      // falls back to the detached form.
      holdsBranch: typeof ref.holdsBranch === "string" && ref.holdsBranch ? ref.holdsBranch : null,
      linkedRemotes: Array.isArray(ref.linkedRemotes) ? ref.linkedRemotes.map((remote) => ({
        name: String(remote.name ?? ""),
        fullName: String(remote.fullName ?? remote.name ?? "")
      })).filter((remote) => remote.name) : []
    };
  }
  return null;
}
function GraphBranchGlyph(props = {}) {
  const size = props.size || 14;
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true
    },
    h(
      "g",
      { transform: props.flipVertical ? "translate(0 16) scale(1 -1)" : void 0 },
      h("circle", { cx: 4, cy: 4, r: 2 }),
      h("circle", { cx: 4, cy: 12, r: 2 }),
      h("circle", { cx: 12, cy: 8, r: 2 }),
      h("path", { d: "M4 6v4M6 4h3a3 3 0 0 1 3 3v1" })
    )
  );
}
function BranchRefIcon(props = {}) {
  return h(GraphBranchGlyph, { ...props, flipVertical: true });
}
function RemoteCloudIcon({ hidden }) {
  return h(
    "svg",
    {
      width: 16,
      height: 16,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true
    },
    // Fill the same vertical span as the built-in refresh glyph. The slash
    // stays inside that span, so toggling does not change the apparent size.
    h(
      "g",
      { transform: "translate(0 -1.4) scale(1 1.18)" },
      h("path", { d: "M4.1 13h7.8a2.65 2.65 0 0 0 .32-5.28 4.35 4.35 0 0 0-8.4-1.28A3.35 3.35 0 0 0 4.1 13Z" }),
      hidden ? h("path", { d: "M2.1 2.65L13.9 13.35", strokeWidth: 1.4 }) : null
    )
  );
}
function mergeWorktreeBranch(refs, branch) {
  const worktree = refs.find((ref) => ref.kind === "worktree");
  if (!worktree || !branch) return refs;
  const held = refs.find((ref) => ref.kind === "branch" && ref.name === branch);
  if (!held) return refs;
  worktree.holdsBranch = held.name;
  worktree.linkedRemotes = held.linkedRemotes || [];
  worktree.current = held.current;
  return refs.filter((ref) => ref !== held);
}
function HeadRingGlyph(props = {}) {
  const size = props.size || 14;
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      "aria-hidden": true
    },
    h("circle", { cx: 8, cy: 8, r: 4.5 })
  );
}
function RefChip(props) {
  const ref = normalizeRef(props.gitRef);
  if (!ref || !ref.name) return null;
  const linkedRemotes = Array.isArray(ref.linkedRemotes) ? ref.linkedRemotes : [];
  const laneStyle = { "--dsh-gw-ref-color": props.laneColor };
  if (ref.kind === "worktree") {
    const held = ref.holdsBranch;
    return h(
      "span",
      {
        className: "dsh-gw-ref dsh-gw-ref-worktree",
        title: [
          held ? `worktree: ${held}` : "worktree: HEAD (no branch checked out)",
          ...linkedRemotes.map((remote) => `remote: ${remote.fullName}`)
        ].join("\n"),
        style: laneStyle
      },
      h("span", { className: "dsh-gw-ref-worktree-label" }, "worktree"),
      h(
        "span",
        { className: "dsh-gw-ref-worktree-held" },
        h(
          "span",
          { className: "dsh-gw-ref-worktree-icon" },
          held ? h(BranchRefIcon, { size: 14 }) : h(HeadRingGlyph, { size: 14 })
        ),
        h("span", { className: "dsh-gw-ref-worktree-name" }, held || "HEAD"),
        linkedRemotes.map((remote) => h("span", {
          key: remote.fullName,
          className: "dsh-gw-ref-worktree-remote"
        }, remote.name))
      )
    );
  }
  const className = `dsh-gw-ref dsh-gw-ref-${ref.kind}${ref.current && ref.kind === "branch" ? " dsh-gw-ref-current" : ""}`;
  const branchLike = ref.kind === "branch" || ref.kind === "remote";
  return h("span", {
    className,
    title: [`${ref.kind}: ${ref.name}`, ...linkedRemotes.map((remote) => `remote: ${remote.fullName}`)].join("\n"),
    style: branchLike ? laneStyle : void 0
  }, branchLike ? h(
    React.Fragment,
    null,
    h("span", { className: "dsh-gw-ref-icon" }, h(BranchRefIcon, { size: 14 })),
    h("span", { className: "dsh-gw-ref-name" }, ref.name),
    linkedRemotes.map((remote) => h("span", {
      key: remote.fullName,
      className: "dsh-gw-ref-remote-name"
    }, remote.name))
  ) : ref.kind === "tag" ? `\u2302 ${ref.name}` : ref.name);
}
function buildFileTree(files) {
  const root = { name: "", dirs: /* @__PURE__ */ new Map(), files: [] };
  for (const file of files) {
    const parts = String(file.path || "").split("/").filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { name: parts[i], dirs: /* @__PURE__ */ new Map(), files: [] });
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
      rows.push(h(
        "div",
        {
          key: `d:${path}`,
          className: "dsh-gw-frow",
          style: { paddingLeft: `${depth * 13}px` },
          onClick: (event) => {
            event.stopPropagation();
            setCollapsed((current) => ({ ...current, [path]: !current[path] }));
          }
        },
        h("span", null, isCollapsed ? "\u25B8" : "\u25BE"),
        h("span", { className: "dsh-gw-fname" }, dir.name),
        h("span", { className: "dsh-gw-fstat" }, h("span", { className: "dsh-gw-stat" }, `${count}`))
      ));
      if (!isCollapsed) walk(dir, depth + 1, path, key);
    }
    const sorted = [...node.files].sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of sorted) {
      const file = entry.file;
      rows.push(h(
        "div",
        {
          key: `f:${prefix}/${entry.name}`,
          className: "dsh-gw-frow",
          style: { paddingLeft: `${depth * 13}px` },
          title: file.path
        },
        h("span", null, "\xB7"),
        h("span", { className: "dsh-gw-fname" }, entry.name),
        h(
          "span",
          { className: "dsh-gw-fstat" },
          file.untracked ? h("span", { className: "dsh-gw-stat" }, "\u65B0") : [
            h("span", { key: "a", className: "dsh-gw-add" }, `+${file.add}`),
            h("span", { key: "d", className: "dsh-gw-del" }, `-${file.del}`)
          ]
        )
      ));
    }
  };
  walk(root, 0, "", "");
  return h("div", { className: "dsh-gw-ftree" }, rows);
}
function countFiles(node) {
  let total = node.files.length;
  for (const dir of node.dirs.values()) total += countFiles(dir);
  return total;
}
function CommitDetail(props) {
  const { repo, oid, sessionId, narrow } = props;
  const [state, setState] = React.useState({ status: "loading" });
  React.useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setState({ status: "loading" });
    api("commit", { repo, oid }, sessionId, controller.signal).then((data2) => {
      if (alive) setState({ status: "ready", data: data2 });
    }).catch((error) => {
      if (!alive || controller.signal.aborted) return;
      setState({ status: "failed", error: error.message });
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [repo, oid, sessionId]);
  const data = state.data;
  const legacy = data && typeof data.text === "string" && !Array.isArray(data.parents);
  const left = h(
    "div",
    { className: "dsh-gw-detail-left" },
    state.status === "loading" ? h("div", { className: "dsh-gw-msg" }, "\u8BFB\u53D6\u4E2D\u2026") : null,
    state.status === "failed" ? h("div", { className: "dsh-gw-error" }, state.error) : null,
    legacy ? h("pre", { className: "dsh-gw-legacy" }, data.text) : null,
    data && !legacy ? h(
      "div",
      { className: "dsh-gw-kv" },
      h("span", { className: "dsh-gw-k" }, "Commit"),
      h("span", { className: "dsh-gw-v dsh-gw-mono" }, data.oid),
      h("span", { className: "dsh-gw-k" }, "Parents"),
      h(
        "span",
        { className: "dsh-gw-v dsh-gw-mono" },
        data.parents.length > 0 ? data.parents.map(shortOid).join(", ") : "None"
      ),
      h("span", { className: "dsh-gw-k" }, "Author"),
      h(
        "span",
        { className: "dsh-gw-v" },
        `${data.author.name} <${data.author.email}>`
      ),
      h("span", { className: "dsh-gw-k" }, "Committer"),
      h(
        "span",
        { className: "dsh-gw-v" },
        `${data.committer.name} <${data.committer.email}>`
      ),
      h("span", { className: "dsh-gw-k" }, "Date"),
      h(
        "span",
        { className: "dsh-gw-v" },
        `${new Date(data.authoredAt).toString()} (${relativeTime(data.authoredAt)})`
      )
    ) : null,
    data && data.body ? h("div", { className: "dsh-gw-body" }, data.body) : null
  );
  const right = h(
    "div",
    { className: "dsh-gw-detail-right" },
    data && !legacy ? h(
      "div",
      { className: "dsh-gw-stat" },
      `${data.summary.changed} \u4E2A\u6587\u4EF6\u53D8\u66F4`,
      data.summary.insertions > 0 ? h("span", { className: "dsh-gw-add" }, ` (+${data.summary.insertions})`) : null,
      data.summary.deletions > 0 ? h("span", { className: "dsh-gw-del" }, ` (-${data.summary.deletions})`) : null
    ) : null,
    data && !legacy && data.files.length > 0 ? h(FileTree, { files: data.files }) : null
  );
  return h("div", { className: `dsh-gw-detail${narrow || legacy ? " dsh-gw-detail-narrow" : ""}` }, left, legacy ? null : right);
}
function UncommittedDetail(props) {
  const { repo, worktree, sessionId, narrow, supportsStructured } = props;
  const [state, setState] = React.useState({ status: "loading" });
  React.useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    const read2 = supportsStructured ? api("uncommitted", { repo, worktree }, sessionId, controller.signal) : api("diff", { repo, worktree }, sessionId, controller.signal);
    read2.then((data2) => {
      if (alive) setState({ status: supportsStructured ? "ready" : "legacy", data: data2 });
    }).catch(async (error) => {
      if (!alive || controller.signal.aborted) return;
      if (supportsStructured && /HTTP 404/.test(error.message)) {
        try {
          const data2 = await api("diff", { repo, worktree }, sessionId, controller.signal);
          if (alive) setState({ status: "legacy", data: data2 });
          return;
        } catch (fallbackError) {
          if (!alive || controller.signal.aborted) return;
          setState({ status: "failed", error: fallbackError.message });
          return;
        }
      }
      setState({ status: "failed", error: error.message });
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [repo, worktree, sessionId, supportsStructured]);
  const data = state.data;
  return h(
    "div",
    { className: `dsh-gw-detail${narrow ? " dsh-gw-detail-narrow" : ""}` },
    h(
      "div",
      { className: "dsh-gw-detail-left" },
      state.status === "loading" ? h("div", { className: "dsh-gw-msg" }, "\u8BFB\u53D6\u4E2D\u2026") : null,
      state.status === "failed" ? h("div", { className: "dsh-gw-error" }, state.error) : null,
      state.status === "legacy" ? h("div", { className: "dsh-gw-msg" }, "\u5F53\u524D Host \u5C1A\u672A\u91CD\u8F7D\uFF0C\u6682\u65F6\u663E\u793A\u6587\u672C\u5DEE\u5F02\u3002") : null,
      state.status === "ready" && data ? h(
        "div",
        { className: "dsh-gw-kv" },
        h("span", { className: "dsh-gw-k" }, "Branch"),
        h(
          "span",
          { className: "dsh-gw-v dsh-gw-mono" },
          data.unborn ? "(\u5C1A\u65E0\u63D0\u4EA4)" : data.branch
        ),
        h("span", { className: "dsh-gw-k" }, "Path"),
        h("span", { className: "dsh-gw-v" }, data.path),
        h("span", { className: "dsh-gw-k" }, "Changes"),
        h(
          "span",
          { className: "dsh-gw-v" },
          `${data.summary.changed} \u4E2A\u6587\u4EF6`,
          data.summary.insertions > 0 ? h("span", { className: "dsh-gw-add" }, ` (+${data.summary.insertions})`) : null,
          data.summary.deletions > 0 ? h("span", { className: "dsh-gw-del" }, ` (-${data.summary.deletions})`) : null
        )
      ) : null
    ),
    h(
      "div",
      { className: "dsh-gw-detail-right" },
      h("div", { className: "dsh-gw-stat" }, "\u5DE5\u4F5C\u533A\u5185\u672A\u88AB\u63D0\u4EA4\u7684\u6539\u52A8"),
      state.status === "legacy" && data ? h("pre", { className: "dsh-gw-legacy" }, [data.stat, data.patch].filter(Boolean).join("\n\n")) : null,
      state.status === "ready" && data && data.files.length > 0 ? h(FileTree, { files: data.files }) : null
    )
  );
}
var Boundary = class extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return h(
        "div",
        { className: "dsh-gw" },
        h("div", { className: "dsh-gw-error" }, `Git Worktree \u9762\u677F\u6E32\u67D3\u5931\u8D25\uFF1A${this.state.error.message}`)
      );
    }
    return this.props.children;
  }
};
function WorktreeTab(props) {
  const info = typeof props.tabInfo === "function" ? props.tabInfo() : null;
  const tab = info ? info.tab : null;
  const sessionId = tab ? tab.sessionId : props.sessionId || "current";
  const navigate = tab && tab.navigation ? tab.navigation.params : null;
  const saved = viewState.get(sessionId) || {};
  const [state, setState] = React.useState({
    status: "loading",
    repo: null,
    resolved: false,
    worktrees: [],
    graph: null,
    nodes: [],
    capabilities: [],
    error: null,
    sessionId: null,
    more: false,
    // A page that came back shorter than the one asked for is the end of the
    // history. The Host answers no "has more" field, so the requested page
    // size is the only thing separating "stopped here" from "that is all
    // there is" — without it a two-commit repository was offered a button
    // that could only ever fetch nothing.
    exhausted: false
  });
  const [selected, setSelected] = React.useState(null);
  const [scope, setScope] = React.useState(saved.scope || "all");
  const [showRemote, setShowRemote] = React.useState(Boolean(saved.showRemote));
  const [showGraph] = React.useState(true);
  const [openKey, setOpenKey] = React.useState(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [width, setWidth] = React.useState(900);
  const [height, setHeight] = React.useState(720);
  const [menu, setMenu] = React.useState(null);
  const [preview, setPreview] = React.useState(null);
  const remoteParam = showRemote ? "1" : "0";
  const repo = navigate && navigate.repo || (state.sessionId === sessionId ? state.repo : null) || null;
  const rootRef = React.useRef(null);
  React.useEffect(() => {
    const node = rootRef.current;
    if (!node) return void 0;
    const measure = () => {
      setWidth(node.clientWidth || 900);
      setHeight(node.clientHeight || 720);
    };
    if (typeof ResizeObserver !== "function") {
      measure();
      return void 0;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);
  React.useEffect(() => {
    viewState.set(sessionId, { scope, showRemote });
  }, [sessionId, scope, showRemote]);
  React.useEffect(() => {
    if (state.resolved && state.sessionId === sessionId) return void 0;
    const controller = new AbortController();
    let alive = true;
    const resolve = async () => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await api("worktrees", { repo }, sessionId, controller.signal);
        } catch (error) {
          if (!alive || controller.signal.aborted || attempt >= RESOLVE_ATTEMPTS) throw error;
          await new Promise((resolveWait) => setTimeout(resolveWait, RESOLVE_BACKOFF_MS * (attempt + 1)));
        }
      }
    };
    resolve().then((data) => {
      if (!alive) return;
      const current2 = data.worktrees.find((item) => samePath(item.path, data.repo.root)) || data.worktrees[0] || null;
      if (current2) setSelected(current2.path);
      setState((previous) => ({
        ...previous,
        status: "ready",
        repo: data.repo.root,
        resolved: true,
        worktrees: data.worktrees,
        capabilities: Array.isArray(data.capabilities) ? data.capabilities : [],
        error: null,
        sessionId
      }));
    }).catch((error) => {
      if (!alive || controller.signal.aborted) return;
      setState((previous) => ({ ...previous, status: "failed", error: error.message }));
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [reloadKey, sessionId, state.resolved]);
  React.useEffect(() => {
    if (!repo || !selected) return void 0;
    const controller = new AbortController();
    let alive = true;
    api("graph", { repo, worktree: selected, scope, remote: remoteParam, limit: PAGE }, sessionId, controller.signal).then((data) => {
      if (!alive) return;
      setState((previous) => ({
        ...previous,
        graph: data,
        nodes: data.nodes,
        exhausted: data.nodes.length < PAGE,
        error: null
      }));
    }).catch((error) => {
      if (!alive || controller.signal.aborted) return;
      setState((previous) => ({ ...previous, error: error.message }));
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [repo, selected, scope, remoteParam, reloadKey]);
  const loadMore = React.useCallback(() => {
    if (!repo || !selected || state.more || state.exhausted) return;
    setState((previous) => ({ ...previous, more: true }));
    api("graph", { repo, worktree: selected, scope, remote: remoteParam, limit: PAGE, skip: state.nodes.length }, sessionId).then((data) => {
      setState((previous) => ({
        ...previous,
        more: false,
        exhausted: data.nodes.length < PAGE,
        // Lane numbers continue across pages, so appending keeps every
        // earlier row exactly where it was drawn.
        nodes: previous.nodes.concat(data.nodes)
      }));
    }).catch((error) => {
      setState((previous) => ({ ...previous, more: false, error: error.message }));
    });
  }, [repo, selected, scope, remoteParam, sessionId, state.more, state.exhausted, state.nodes.length]);
  const onToggle = React.useCallback((key) => {
    setOpenKey((current2) => current2 === key ? null : key);
  }, []);
  const operations = transport && transport.operations ? transport.operations : null;
  const openPreview = async (operation, commit) => {
    if (!operations || !repo || !selected) return;
    setMenu(null);
    setState((previous) => ({ ...previous, error: null }));
    try {
      setPreview(operation === "rebase" ? await operations.rebasePreview({ repo, worktree: selected, target: commit }) : await operations.cherryPickPreview({ repo, worktree: selected, commit }));
    } catch (error) {
      setState((previous) => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
    }
  };
  const applyPreview = async () => {
    if (!operations || !preview) return;
    const run = preview.operation === "rebase" ? operations.rebaseApply : operations.cherryPickApply;
    try {
      await run({ planId: preview.planId, confirm: true });
      setPreview(null);
      setState((previous) => ({ ...previous, status: "loading", resolved: false, error: null }));
      setReloadKey((key) => key + 1);
    } catch (error) {
      setPreview(null);
      setState((previous) => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
    }
  };
  const nodes = state.nodes || [];
  const layout = React.useMemo(() => layoutLanes(nodes), [nodes]);
  const current = state.worktrees.find((item) => samePath(item.path, selected)) || null;
  const changeCount = current && current.status ? current.status.entries : 0;
  const dirty = changeCount > 0;
  const headOid = state.graph ? state.graph.head : null;
  const worktreeBranch = state.graph ? state.graph.branch : null;
  const worktreeLink = dirty && Boolean(headOid) && nodes.length > 0 && nodes[0].id === headOid;
  const colors = /* @__PURE__ */ new Map();
  for (const lane of layout.lanes) {
    if (colors.has(lane)) continue;
    colors.set(lane, LANE_COLORS[lane % LANE_COLORS.length]);
  }
  const graphWidth = Math.max(64, PAD + layout.width * COL + MARGIN);
  const detailMax = Math.max(
    DETAIL_MAX_FLOOR,
    Math.min(DETAIL_MAX_CEILING, Math.round(height * DETAIL_MAX_SHARE))
  );
  const showDate = width > W_DATE;
  const showAuthor = width > W_AUTHOR;
  const showCommit = width > W_COMMIT;
  const columns = [
    ...showGraph ? [`${graphWidth}px`] : [],
    "minmax(0, 1fr)",
    ...showDate ? ["132px"] : [],
    ...showAuthor ? ["130px"] : [],
    ...showCommit ? ["82px"] : []
  ].join(" ");
  const toolbar = h(
    "div",
    { className: "dsh-gw-tbar" },
    current ? h(import_dsh_client_ui_primitives.PathLabel, {
      path: current.path,
      className: "dsh-gw-wt",
      key: "wt-path"
    }) : h(
      "span",
      { className: "dsh-gw-wt-placeholder", title: state.status === "failed" ? "\u4ED3\u5E93\u4E0D\u53EF\u7528" : "\u6B63\u5728\u8BFB\u53D6\u5DE5\u4F5C\u6811" },
      state.status === "failed" ? "\u4ED3\u5E93\u4E0D\u53EF\u7528" : "\u8BFB\u53D6\u4E2D\u2026"
    ),
    h(
      "div",
      { className: "dsh-gw-icons" },
      h("button", {
        type: "button",
        className: "dsh-gw-iconbtn",
        title: showRemote ? "\u5305\u542B\u8FDC\u7AEF\u5206\u652F\uFF1B\u70B9\u51FB\u4EC5\u663E\u793A\u672C\u5730\u5206\u652F" : "\u4EC5\u663E\u793A\u672C\u5730\u5206\u652F\uFF1B\u70B9\u51FB\u5305\u542B\u8FDC\u7AEF\u5206\u652F",
        "aria-label": "\u5305\u542B\u8FDC\u7AEF\u5206\u652F",
        "aria-pressed": showRemote,
        onClick: () => setShowRemote((value) => !value)
      }, h(RemoteCloudIcon, { hidden: !showRemote })),
      h("button", {
        type: "button",
        className: "dsh-gw-iconbtn",
        title: "\u91CD\u65B0\u8BFB\u53D6",
        "aria-label": "\u91CD\u65B0\u8BFB\u53D6",
        onClick: () => {
          setState((previous) => ({ ...previous, status: "loading", resolved: false, error: null }));
          setReloadKey((key) => key + 1);
          setOpenKey(null);
        }
      }, h(import_dsh_client_ui_primitives.IconRefreshOutlineRegular))
    )
  );
  const head = [];
  head.push(toolbar);
  if (state.error) head.push(h("div", { className: "dsh-gw-error", key: "error" }, state.error));
  if (state.status === "loading") head.push(h("div", { className: "dsh-gw-msg", key: "loading" }, "\u8BFB\u53D6\u4ED3\u5E93\u4E2D\u2026"));
  const grid = [];
  if (state.repo && state.status === "ready" && changeCount > 0) {
    grid.push(h(
      "div",
      {
        key: "uncommitted",
        className: `dsh-gw-row dsh-gw-rowmid${openKey === "uncommitted" ? " dsh-gw-row-open" : ""}`,
        style: { "--dsh-gw-cols": columns },
        role: "button",
        tabIndex: 0,
        "aria-expanded": openKey === "uncommitted",
        onClick: () => onToggle("uncommitted"),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle("uncommitted");
          }
        }
      },
      showGraph ? h("div", { className: "dsh-gw-gcell" }, h(
        "svg",
        {
          width: graphWidth,
          height: ROW,
          "aria-hidden": true
        },
        worktreeLink ? h("line", { x1: laneX(0), y1: ROW / 2, x2: laneX(0), y2: ROW, stroke: "var(--gw-label-secondary)", strokeWidth: 1.6 }) : null,
        h("circle", { cx: laneX(0), cy: ROW / 2, r: 4.5, fill: "var(--gw-bg-base)", stroke: "var(--gw-label-secondary)", strokeWidth: 2 })
      )) : null,
      h(
        "div",
        { className: "dsh-gw-cell" },
        h(
          "span",
          { className: "dsh-gw-subjtext dsh-gw-uncommitted" },
          `Uncommitted Changes (${changeCount})`
        ),
        h("span", { className: "dsh-gw-dot", style: { marginLeft: "6px" } })
      ),
      showDate ? h("div", { className: "dsh-gw-cell dsh-gw-cell-sec" }, "") : null,
      showAuthor ? h("div", { className: "dsh-gw-cell dsh-gw-cell-sec" }, "") : null,
      showCommit ? h("div", { className: "dsh-gw-cell dsh-gw-cell-sec" }, "") : null
    ));
    if (openKey === "uncommitted") {
      grid.push(h(DetailRegion, {
        key: "uncommitted-detail",
        max: detailMax,
        // The working tree's row is not a lane of its own, so its band
        // carries the connector instead: `index: -1` matches no edge.
        rail: showGraph ? h(GraphRail, { layout, index: -1, colors, worktree: worktreeLink, width: graphWidth }) : null
      }, h(UncommittedDetail, {
        repo: state.repo,
        worktree: selected,
        sessionId,
        narrow: width < W_DETAIL_SPLIT,
        supportsStructured: state.capabilities.includes("uncommitted-v1")
      })));
    }
  }
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const laneColor = colors.get(layout.lanes[index]) || LANE_COLORS[0];
    const isHead = Boolean(headOid) && node.id === headOid;
    const visibleRefs = (node.refs || []).map(normalizeRef).filter(Boolean).filter((ref) => ref.kind === "branch" || ref.kind === "worktree").sort((left, right) => (right.kind === "worktree" ? 0 : 1) - (left.kind === "worktree" ? 0 : 1));
    const refs = mergeWorktreeBranch(visibleRefs, worktreeBranch);
    const counted = (node.refs || []).every((ref) => ref.kind === "branch" || ref.kind === "worktree");
    const hiddenRefs = counted ? (node.refCount || 0) - visibleRefs.length : 0;
    grid.push(h(
      "div",
      {
        key: node.id,
        className: `dsh-gw-row dsh-gw-rowmid${isHead ? " dsh-gw-row-head" : ""}${openKey === node.id ? " dsh-gw-row-open" : ""}`,
        style: { "--dsh-gw-cols": columns },
        role: "button",
        tabIndex: 0,
        "aria-expanded": openKey === node.id,
        onClick: () => onToggle(node.id),
        onContextMenu: operations ? (event) => {
          event.preventDefault();
          setMenu({ x: Math.min(event.clientX, Math.max(180, width - 180)), y: event.clientY, commit: node.id });
        } : void 0,
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle(node.id);
          }
        },
        title: `${shortOid(node.id)} ${node.subject}`
      },
      showGraph ? h(GraphCell, {
        layout,
        index,
        colors,
        head: isHead && !dirty,
        above: worktreeLink && index === 0
      }) : null,
      h(
        "div",
        { className: "dsh-gw-cell" },
        h(
          "div",
          { className: "dsh-gw-subj" },
          refs.map((ref) => h(RefChip, {
            key: `${ref.kind}:${ref.name}`,
            gitRef: ref,
            laneColor
          })),
          hiddenRefs > 0 ? h("span", { className: "dsh-gw-ref", title: "\u8FD8\u6709\u66F4\u591A\u672C\u5730\u5206\u652F" }, `+${hiddenRefs}`) : null,
          h("span", { className: "dsh-gw-subjtext" }, node.subject || "(\u65E0\u63D0\u4EA4\u8BF4\u660E)")
        )
      ),
      showDate ? h(
        "div",
        { className: "dsh-gw-cell dsh-gw-cell-sec", title: absoluteTime(node.authoredAt) },
        absoluteTime(node.authoredAt)
      ) : null,
      showAuthor ? h("div", { className: "dsh-gw-cell dsh-gw-cell-sec" }, node.author || "") : null,
      showCommit ? h("div", { className: "dsh-gw-cell dsh-gw-cell-mono" }, shortOid(node.id)) : null
    ));
    if (openKey === node.id) {
      grid.push(h(DetailRegion, {
        key: `${node.id}-detail`,
        max: detailMax,
        rail: showGraph ? h(GraphRail, { layout, index, colors, width: graphWidth }) : null
      }, h(CommitDetail, {
        repo: state.repo,
        oid: node.id,
        sessionId,
        narrow: width < W_DETAIL_SPLIT
      })));
    }
  }
  if (state.status === "ready" && nodes.length > 0 && state.graph && !state.exhausted) {
    grid.push(h(
      "div",
      { className: "dsh-gw-more", key: "more", style: { padding: "8px", textAlign: "center" } },
      h(
        "button",
        { type: "button", className: "dsh-gw-btn", disabled: state.more, onClick: loadMore },
        state.more ? "\u8BFB\u53D6\u4E2D\u2026" : "\u52A0\u8F7D\u66F4\u591A"
      )
    ));
  }
  if (state.status === "ready" && state.graph && state.graph.unborn) {
    grid.push(h("div", { className: "dsh-gw-empty", key: "unborn" }, "\u8BE5\u4ED3\u5E93\u5C1A\u65E0\u63D0\u4EA4\uFF0C\u53EA\u6709\u672A\u63D0\u4EA4\u7684\u6539\u52A8\u3002"));
  } else if (state.status === "ready" && !state.repo) {
    grid.push(h("div", { className: "dsh-gw-empty", key: "norepo" }, "\u6CA1\u6709\u53EF\u7528\u7684\u4ED3\u5E93\u8DEF\u5F84\u3002"));
  } else if (state.status === "ready" && nodes.length === 0) {
    grid.push(h("div", {
      className: "dsh-gw-empty",
      key: "empty",
      title: JSON.stringify({ root: state.repo, selected, scope })
    }, state.graph ? "\u8BE5\u8303\u56F4\u5185\u6CA1\u6709\u53EF\u663E\u793A\u7684\u63D0\u4EA4\u3002" : "\u63D0\u4EA4\u56FE\u4ECD\u5728\u8BFB\u53D6\uFF0C\u6216\u6700\u540E\u4E00\u6B21\u8BFB\u53D6\u5931\u8D25\u3002"));
  }
  return h(
    "div",
    { className: "dsh-gw", ref: rootRef, onClick: menu ? () => setMenu(null) : void 0 },
    h("style", null, CSS),
    head,
    h(
      "div",
      { className: "dsh-gw-scroll" },
      h("div", { className: "dsh-gw-grid" }, grid)
    ),
    menu && operations ? h(
      "div",
      {
        className: "dsh-gw-menu",
        key: "menu",
        style: { left: `${menu.x}px`, top: `${menu.y}px` },
        onClick: (event) => event.stopPropagation()
      },
      h("button", { type: "button", onClick: () => void openPreview("rebase", menu.commit) }, "Rebase onto commit"),
      h("button", { type: "button", onClick: () => void openPreview("cherry-pick", menu.commit) }, "Cherry-pick commit")
    ) : null,
    preview ? h(
      "div",
      { className: "dsh-gw-backdrop", key: "preview" },
      h(
        "div",
        { className: "dsh-gw-modal", role: "dialog", "aria-modal": true, "aria-label": "Confirm Git operation" },
        h("h2", null, `Confirm ${preview.operation}`),
        h("p", null, "Worktree ", h("code", null, preview.worktreePath)),
        h("p", null, "Branch ", h("strong", null, preview.branch), " at ", h("code", null, preview.head.slice(0, 8))),
        h("p", null, "Target ", h("code", null, preview.targetCommit.slice(0, 8))),
        h("p", null, `${preview.commits.length} commit${preview.commits.length === 1 ? "" : "s"} in preview \xB7 expires ${new Date(preview.expiresAt).toLocaleTimeString()}`),
        h(
          "details",
          null,
          h("summary", null, "Commits in plan"),
          h("ol", null, preview.commits.map((commit) => h("li", { key: commit }, h("code", { title: commit }, commit.slice(0, 12)))))
        ),
        preview.warnings.map((warning) => h("p", { className: "dsh-gw-warn", key: warning }, warning)),
        h(
          "div",
          { className: "dsh-gw-actions" },
          h("button", { type: "button", className: "dsh-gw-btn", onClick: () => setPreview(null) }, "Cancel"),
          h("button", { type: "button", className: "dsh-gw-btn dsh-gw-danger", onClick: () => void applyPreview() }, `Apply ${preview.operation}`)
        )
      )
    ) : null
  );
}
function WorktreeTitle() {
  return h(React.Fragment, null, h(import_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 16 }), WORKTREE_TAB_TITLE);
}
var GuideIcon = () => h(
  "svg",
  {
    viewBox: "0 0 16 16",
    width: 16,
    height: 16,
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round"
  },
  h("circle", { cx: 4, cy: 4, r: 2 }),
  h("circle", { cx: 4, cy: 12, r: 2 }),
  h("circle", { cx: 12, cy: 8, r: 2 }),
  h("path", { d: "M4 6v4M6 4h3a3 3 0 0 1 3 3v1" })
);

// src/client.ts
var DSH_THEME_CSS = `
.dsh-gw {
  --gw-label-primary: var(--dsw-alias-label-primary);
  --gw-label-secondary: var(--dsw-alias-label-secondary);
  --gw-bg-base: var(--dsw-alias-bg-base);
  --gw-bg-layer-1: var(--dsw-alias-bg-layer-1);
  --gw-bg-layer-2: var(--dsw-alias-bg-layer-2);
  --gw-border-l1: var(--dsw-alias-border-l1);
  --gw-border-l2: var(--dsw-alias-border-l2);
  --gw-brand-primary: var(--dsw-alias-brand-primary);
  --gw-state-warn: var(--dsw-alias-state-warn-primary);
  --gw-state-success: var(--dsw-alias-state-success-primary);
  --gw-state-error: var(--dsw-alias-state-error-primary);
  --gw-sidebar-fill: var(--dsw-specific-sidebar-fill);
}`;
var API = "/git-worktree-graph/api";
var KIND = "git-worktree-graph";
var NS = "@JinzhaoTian/git-worktree-graph";
async function read(action, params = {}, sessionId, signal) {
  const url = new URL(`${API}/${action}`, window.location.origin);
  if (sessionId) url.searchParams.set("session", sessionId);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== void 0 && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || payload.ok !== true) throw new Error(payload && payload.error || "Request failed.");
  return payload.data;
}
async function write(action, params) {
  const response = await fetch(`${API}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(params || {})
  });
  if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || payload.ok !== true) throw new Error(payload && payload.error || "Request failed.");
  return payload.data;
}
var transport2 = {
  worktrees: (params, sessionId, signal) => read("worktrees", params, sessionId, signal),
  graph: (params, sessionId, signal) => read("graph", params, sessionId, signal),
  diff: (params, sessionId, signal) => read("diff", params, sessionId, signal),
  commit: (params, sessionId, signal) => read("commit", params, sessionId, signal),
  uncommitted: (params, sessionId, signal) => read("uncommitted", params, sessionId, signal),
  operations: {
    createWorktree: (params) => write("worktree-create", params),
    rebasePreview: (params) => write("rebase-preview", params),
    rebaseApply: (params) => write("rebase-apply", params),
    cherryPickPreview: (params) => write("cherry-pick-preview", params),
    cherryPickApply: (params) => write("cherry-pick-apply", params)
  }
};
function apply(ctx) {
  configureView(transport2);
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: NS,
    kind: KIND,
    multiple: false,
    priority: "builtin",
    title: () => WORKTREE_TAB_TITLE,
    guide: [{
      id: "open",
      order: 60,
      title: () => WORKTREE_TAB_TITLE,
      description: () => "\u6D4F\u89C8\u5F53\u524D\u5DE5\u4F5C\u533A\u7684 worktree\u3001\u5206\u652F\u4E0E\u63D0\u4EA4\u56FE",
      icon: GuideIcon
    }]
  }), "git-worktree-graph: tab type");
  ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: NS
  }, (props) => React2.createElement(
    React2.Fragment,
    null,
    React2.createElement("style", null, DSH_THEME_CSS),
    React2.createElement(Boundary, null, React2.createElement(WorktreeTab, { ...props }))
  )));
  ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
    name: "sidebar.right.pane.tab.title",
    key: NS
  }, WorktreeTitle));
}
var client_default = {
  inject: ["slots", "sidebarRightTabs"],
  apply
};
    return module.exports.default ?? module.exports;
  },
});
