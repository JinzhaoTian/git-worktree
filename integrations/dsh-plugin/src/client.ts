/**
 * The DSH bundle's browser half.
 *
 * Registers one right-sidebar tab type (`kind: 'git-worktree'`) plus its body and
 * chip title, and installs the transport the view reads through: one
 * same-origin route on the Web GUI's own server, registered by this bundle's host
 * half. Nothing here runs a command or touches disk.
 *
 * The view itself lives in `src/ui/worktree.ts`; this file registers it as a
 * DSH tab.
 */
import * as React from 'react';
import { Boundary, GuideIcon, WorktreeTab, WorktreeTitle, configureView } from '../../../src/ui/worktree.js';
import type { ViewParams, ViewTransport } from '../../../src/ui/worktree.js';

// Map the shared panel's theme variables to the DSH host. The panel owns no
// DSH token names, so another platform can provide its own mapping.
const DSH_THEME_CSS = `
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

const API = '/dsh-git-worktree/api';
const KIND = 'git-worktree';
const NS = '@local/dsh-git-worktree';

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
  }, (props) => React.createElement(React.Fragment, null,
    React.createElement('style', null, DSH_THEME_CSS),
    React.createElement(Boundary, null, React.createElement(WorktreeTab, { ...props })))));

  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: NS,
  }, WorktreeTitle));
}

export default {
  inject: ['slots', 'sidebarRightTabs'],
  apply,
};
