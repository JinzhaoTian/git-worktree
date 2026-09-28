/**
 * The DSH bundle's host half.
 *
 * Owns every Git call and answers the browser half over one same-origin HTTP
 * route on the DSH Web GUI's own server. The Git work itself lives in
 * `src/core`; this file supplies the DSH policy: which Session a read belongs
 * to, and how a route maps to a payload.
 *
 * The route is registered through `ctx.webServer.register`, so it lives exactly
 * as long as this plugin and disappears with it.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { repoRoot } from './core/git.js';
import { graphPayload as readGraph } from './core/graph.js';
import {
  commitDetailPayload as readCommitDetail,
  diffPayload as readDiff,
  parseNumstat,
  uncommittedPayload as readUncommitted,
} from './core/diff.js';
import { worktreesPayload as readWorktrees } from './core/worktrees.js';
import { applyPlan, createWorktree, previewCherryPick, previewRebase } from './core/operations.js';
import type {
  CommitDetailPayload,
  DiffPayload,
  GraphPayload,
  UncommittedPayload,
  WorktreesPayload,
} from './core/types.js';

const ROUTE = '/dsh-git-worktree/api';

// A restart serves the panel's first read before the Host knows the Session again.
// Long enough to cover that window, short enough that a broken setup still reports.
const SESSION_WAIT_MS = 3000;
const SESSION_POLL_MS = 120;
const DEFAULT_COMMIT_LIMIT = 120;

/** A request's parameters: `URLSearchParams` in production, a plain stub in checks. */
export interface QueryLike {
  get(key: string): string | number | boolean | null | undefined;
}

/** The Session record this host reads a caller's workspace from. */
interface SessionsService {
  get(id: string): { header?: { cwd?: string } } | undefined;
}

/** The slice of the Host context this plugin uses. */
export interface HostContext {
  get(name: string): unknown;
  effect(effect: () => unknown, label?: string): unknown;
  webServer: {
    register(route: {
      kind: 'prefix';
      path: string;
      handler(request: IncomingMessage, response: ServerResponse): void | Promise<void>;
    }): () => void;
  };
}

/** This bundle row's config, as composed from `cordis.patch.yml`. */
export interface HostConfig {
  ctx: HostContext;
  defaultRepo?: string | null;
  commitLimit?: number;
  /** How long a first read waits for the calling Session to register. */
  sessionWaitMs?: number;
}

/** A config with every default resolved. */
interface Settings {
  ctx: HostContext;
  defaultRepo: string | null;
  commitLimit: number;
  sessionWaitMs: number;
}

function settingsOf(config: HostConfig): Settings {
  const limit = config.commitLimit;
  return {
    ctx: config.ctx,
    defaultRepo: typeof config.defaultRepo === 'string' && config.defaultRepo ? config.defaultRepo : null,
    commitLimit: typeof limit === 'number' && Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_COMMIT_LIMIT,
    sessionWaitMs: typeof config.sessionWaitMs === 'number' && Number.isFinite(config.sessionWaitMs) ? config.sessionWaitMs : SESSION_WAIT_MS,
  };
}

/** A moment, without a timer service for one wait. */
const wait = (ms: number): Promise<void> => new Promise((resolveWait) => setTimeout(resolveWait, ms));

/**
 * The calling Session's working directory, waiting for it to register.
 *
 * `sessions.get(id)` is the only place the Host can learn which workspace a tab
 * belongs to. Right after a restart it is briefly empty — the browser half restores
 * its tab and reads before the Session is back — and a Host that answers anyway
 * answers from its own start directory. That is exactly how the panel came to say
 * "No Git repository found. Tried — C:\Users\<user>": the right message about a
 * directory the tab never asked about. So the lookup waits, and when the wait runs
 * out the caller is told about the Session rather than handed an invented path.
 */
async function sessionCwd(ctx: HostContext, sessionId: string, waitMs: number): Promise<string | null> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const sessions = ctx.get('sessions') as SessionsService | undefined;
    const cwd = sessions ? sessions.get(sessionId)?.header?.cwd : undefined;
    if (cwd) return cwd;
    if (Date.now() >= deadline) return null;
    await wait(SESSION_POLL_MS);
  }
}

/**
 * Resolve the repository to serve, in the order a user expects.
 *
 * 1. an explicit `repo` (the panel's own selection),
 * 2. the calling Session's working directory — this is what makes the tab follow
 *    the current workspace instead of wherever the Host happened to start,
 * 3. the configured default, then the process directory.
 *
 * Steps 3 are for a caller that names no Session at all. A caller that does name one
 * gets that Session's workspace or an honest failure, because the fallbacks would
 * answer about a repository the tab has nothing to do with.
 */
async function resolveRepo(query: QueryLike, settings: Settings): Promise<string> {
  const sessionId = query.get('session');
  let sessionMissing = false;
  const candidates: unknown[] = [query.get('repo')];
  if (typeof sessionId === 'string' && sessionId) {
    const cwd = await sessionCwd(settings.ctx, sessionId, Math.max(settings.sessionWaitMs, 0));
    if (cwd) candidates.push(cwd);
    else sessionMissing = true;
  }
  if (!sessionMissing) candidates.push(settings.defaultRepo, process.cwd());
  const tried: string[] = [];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate) continue;
    try {
      return await repoRoot(candidate);
    } catch (error) {
      tried.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (sessionMissing) {
    throw new Error(
      `Session ${String(sessionId)} has not registered a working directory yet, and this panel only reads the workspace its Session sits in. Reopen the tab in a moment.`,
    );
  }
  throw new Error(`No Git repository found. Tried — ${tried.join(' | ')}`);
}

/** A parameter as an integer, whether the caller sent a string or a number. */
function numeric(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value !== 'string' || !value) return Number.NaN;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** A parameter as text, or null when absent. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

export async function worktreesPayload(query: QueryLike, config: HostConfig): Promise<WorktreesPayload> {
  return readWorktrees(await resolveRepo(query, settingsOf(config)));
}

export async function graphPayload(query: QueryLike, config: HostConfig): Promise<GraphPayload> {
  const settings = settingsOf(config);
  const root = await resolveRepo(query, settings);
  return readGraph(root, {
    worktree: text(query.get('worktree')),
    scope: text(query.get('scope')),
    branch: text(query.get('branch')),
    // Remote-tracking history is opt-out: `remote=0` walks only what exists
    // locally. Anything else — including an older browser half that never sends
    // the parameter — keeps every ref, so the two halves stay interchangeable.
    includeRemote: query.get('remote') !== '0',
    limit: numeric(query.get('limit')),
    skip: numeric(query.get('skip')) || 0,
    defaultLimit: settings.commitLimit,
  });
}

export async function diffPayload(query: QueryLike, config: HostConfig): Promise<DiffPayload> {
  const root = await resolveRepo(query, settingsOf(config));
  return readDiff(root, text(query.get('worktree')));
}

export async function commitDetailPayload(query: QueryLike, config: HostConfig): Promise<CommitDetailPayload> {
  const root = await resolveRepo(query, settingsOf(config));
  return readCommitDetail(root, text(query.get('oid')) || '');
}

export async function uncommittedPayload(query: QueryLike, config: HostConfig): Promise<UncommittedPayload> {
  const root = await resolveRepo(query, settingsOf(config));
  return readUncommitted(root, text(query.get('worktree')));
}

export { parseNumstat };

/** How much of a write request body is read before it is refused. */
const MAX_BODY_BYTES = 64 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

/**
 * Whether a write came from this page.
 *
 * The route is same-origin and carries no token, so the guard is the browser's
 * own: a cross-site page cannot send `Content-Type: application/json` without a
 * preflight, and this server answers no preflight. The `Origin` check is the
 * second half of that — a request that names another origin is refused outright,
 * and a non-browser client that names none is judged by the content type alone.
 */
function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (typeof origin !== 'string' || !origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

/** Read a write request's JSON object body, refusing anything oversized or not an object. */
async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body exceeds 64 KiB.');
    chunks.push(buffer);
  }
  if (size === 0) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object.');
  return parsed as Record<string, unknown>;
}

/** A request's parameters, with the body taking precedence over the query string. */
function mergedQuery(params: URLSearchParams, body: Record<string, unknown>): QueryLike {
  return {
    get(key) {
      if (Object.hasOwn(body, key)) {
        const value = body[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
      }
      return params.get(key);
    },
  };
}

/**
 * Register the Git surface on the Web GUI's own HTTP server.
 *
 * Reads are `GET` and answer the core payloads. Writes are `POST` with a JSON
 * body. A preview returns an expiring one-use plan, and an apply re-reads the
 * worktree before it touches anything.
 *
 * @param ctx - Host context carrying the webserver service.
 * @param config - this bundle row's config.
 */
export function apply(ctx: HostContext, config?: Omit<HostConfig, 'ctx'> | null): void {
  const settings = settingsOf({ ctx, ...(config ?? {}) });

  const handlers: Record<string, (query: QueryLike, config: HostConfig) => Promise<unknown>> = {
    worktrees: worktreesPayload,
    graph: graphPayload,
    diff: diffPayload,
    commit: commitDetailPayload,
    uncommitted: uncommittedPayload,
  };

  const writers: Record<string, (query: QueryLike, config: HostConfig) => Promise<unknown>> = {
    'worktree-create': async (query, hostConfig) => createWorktree(
      await resolveRepo(query, settingsOf(hostConfig)),
      text(query.get('path')) || '',
      text(query.get('branch')) || '',
      text(query.get('startPoint')) || 'HEAD',
    ),
    'rebase-preview': async (query, hostConfig) => previewRebase(
      await resolveRepo(query, settingsOf(hostConfig)),
      text(query.get('worktree')) || '',
      text(query.get('target')) || '',
    ),
    'rebase-apply': async (query) => applyPlan('rebase', text(query.get('planId')) || '', query.get('confirm') === true || query.get('confirm') === 'true'),
    'cherry-pick-preview': async (query, hostConfig) => previewCherryPick(
      await resolveRepo(query, settingsOf(hostConfig)),
      text(query.get('worktree')) || '',
      text(query.get('commit')) || '',
    ),
    'cherry-pick-apply': async (query) => applyPlan('cherry-pick', text(query.get('planId')) || '', query.get('confirm') === true || query.get('confirm') === 'true'),
  };

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    async handler(req, res) {
      const url = new URL(req.url || ROUTE, 'http://127.0.0.1');
      const action = url.pathname.slice(ROUTE.length).replace(/^\/+/, '');
      try {
        if (req.method === 'GET') {
          const run = handlers[action];
          if (!run) {
            sendJson(res, 404, { ok: false, error: `Unknown action: ${action || '(none)'}` });
            return;
          }
          const data = await run(url.searchParams, settings as HostConfig);
          sendJson(res, 200, { ok: true, data });
          return;
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Only GET and POST are served.' });
          return;
        }
        if (!sameOrigin(req)) {
          sendJson(res, 403, { ok: false, error: 'A write must come from this page.' });
          return;
        }
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
          sendJson(res, 415, { ok: false, error: 'A write must be sent as application/json.' });
          return;
        }
        const run = writers[action];
        if (!run) {
          sendJson(res, 404, { ok: false, error: `Unknown write: ${action || '(none)'}` });
          return;
        }
        const body = await readBody(req);
        const data = await run(mergedQuery(url.searchParams, body), settings as HostConfig);
        sendJson(res, 200, { ok: true, data });
      } catch (error) {
        // A Git failure is an answer, not a transport error: the tab renders it inline.
        sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  }), 'dsh-git-worktree: http route');
}

export const inject = ['webServer'];
