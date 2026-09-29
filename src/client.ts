/**
 * The DSH bundle's browser half.
 *
 * Registers two right-sidebar tab types — the worktree graph
 * (`kind: 'git-worktree-graph'`) and the file diff it opens
 * (`kind: 'git-worktree-graph-file-diff'`) — each with its body and chip title,
 * and installs the transport both read through: one same-origin route on the
 * Web GUI's own server, registered by this bundle's host half. Nothing here
 * runs a command or touches disk.
 *
 * The views themselves live in `src/ui/worktree.ts`; this file registers them
 * as DSH tabs.
 */
import * as React from 'react';
import {
  Boundary,
  FileDiffTab,
  FileDiffTitle,
  GuideIcon,
  WorktreeTab,
  WorktreeTitle,
  FILE_DIFF_KIND,
  FILE_DIFF_TITLE,
  CSS_MODULE_TEXT,
  WORKTREE_TAB_TITLE,
  configureView,
} from './ui/worktree.js';
import type { ViewParams, ViewTransport } from './ui/worktree.js';

const API = '/git-worktree-graph/api';
const KIND = 'git-worktree-graph';
const NS = '@JinzhaoTian/git-worktree-graph';
// The diff tab's own registration id: the type's identity in the tab system,
// and the key its body and its chip register under.
const DIFF_ID = `${NS}/file-diff`;

/**
 * One API read over the route the host half registered.
 *
 * The action is a path segment, matching the host half's route parsing, and the
 * calling Session travels with every read so the host answers about this
 * workspace rather than wherever the Host happens to sit. A Git failure arrives
 * as `ok: false`, never as a rejected fetch.
 */
async function read(action: string, params: Record<string, unknown> = {}, sessionId?: string | null, signal?: AbortSignal): Promise<any> {
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
 * One write, over the same route.
 *
 * The body carries the parameters as JSON and the route answers the same
 * `{ ok, data }` envelope a read does; the host refuses a write that does not
 * come from this page and does not declare a JSON content type.
 */
async function write(action: string, params: ViewParams): Promise<any> {
  const response = await fetch(`${API}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(params || {}),
  });
  if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || payload.ok !== true) throw new Error((payload && payload.error) || 'Request failed.');
  return payload.data;
}

const transport: ViewTransport = {
  worktrees: (params, sessionId, signal) => read('worktrees', params, sessionId, signal),
  graph: (params, sessionId, signal) => read('graph', params, sessionId, signal),
  diff: (params, sessionId, signal) => read('diff', params, sessionId, signal),
  commit: (params, sessionId, signal) => read('commit', params, sessionId, signal),
  uncommitted: (params, sessionId, signal) => read('uncommitted', params, sessionId, signal),
  'file-diff': (params, sessionId, signal) => read('file-diff', params, sessionId, signal),
  operations: {
    createWorktree: (params) => write('worktree-create', params),
    rebasePreview: (params) => write('rebase-preview', params),
    rebaseApply: (params) => write('rebase-apply', params),
    cherryPickPreview: (params) => write('cherry-pick-preview', params),
    cherryPickApply: (params) => write('cherry-pick-apply', params),
  },
};

/** The slice of the Host context this browser half uses. */
interface ClientContext {
  effect(effect: () => unknown, label?: string): unknown;
  sidebarRightTabs: { register(tab: Record<string, unknown>): unknown };
  slots: {
    inject(name: string, register: () => unknown): unknown;
    register(descriptor: Record<string, unknown>, renderer: (props: Record<string, unknown>) => unknown): unknown;
  };
}

function apply(ctx: ClientContext): void {
  configureView(transport);
  // The plugin's stylesheet belongs to the plugin, not to one of its tabs: it
  // is appended once and removed when the bundle unloads, so a tab that is
  // mounted on its own — the diff, opened while the graph's body is not — is
  // styled exactly as the one that opened it.
  ctx.effect(() => {
    const sheet = document.createElement('style');
    sheet.setAttribute('data-dsh-plugin', NS);
    sheet.textContent = CSS_MODULE_TEXT;
    (document.head || document.documentElement).appendChild(sheet);
    return () => sheet.remove();
  }, 'git-worktree-graph: stylesheet');
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: NS,
    kind: KIND,
    multiple: false,
    priority: 'builtin',
    title: () => WORKTREE_TAB_TITLE,
    guide: [{
      id: 'open',
      order: 60,
      title: () => WORKTREE_TAB_TITLE,
      description: () => 'Browse worktrees, branches, and commit history for this workspace',
      icon: GuideIcon,
    }],
  }), 'git-worktree-graph: tab type');

  // The diff tab: opened from a file row, one reused tab that follows whichever
  // file was opened last, and no guide entry — the column's default page is
  // decided by how many guide entries are registered, and this type is not one.
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: DIFF_ID,
    kind: FILE_DIFF_KIND,
    multiple: false,
    priority: 'builtin',
    title: () => FILE_DIFF_TITLE,
  }), 'git-worktree-graph: diff tab type');

  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: NS,
  }, (props) => React.createElement(Boundary, null, React.createElement(WorktreeTab, { ...props }))));

  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: NS,
  }, WorktreeTitle));

  // The diff tab's own body and chip, registered under its own type id: a kind
  // carries one body per implementation, and this one is a page, not the graph.
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: DIFF_ID,
  }, (props) => React.createElement(Boundary, null, React.createElement(FileDiffTab, { ...props }))));

  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: DIFF_ID,
  }, FileDiffTitle));
}

export default {
  inject: ['slots', 'sidebarRightTabs'],
  apply,
};
