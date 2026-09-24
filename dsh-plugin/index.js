/**
 * Git Worktree — Host half.
 *
 * Owns every Git call and answers the browser half over one same-origin HTTP
 * route on the DSH Web GUI's own server. Bindings are fixed argument arrays
 * passed to `git` through `execFile`; no shell string is ever built from input.
 *
 * The route is registered through `ctx.webServer.register`, so it lives exactly
 * as long as this plugin and disappears with it.
 */
import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const READ_TIMEOUT = 20_000;
const MAX_OUTPUT = 16 * 1024 * 1024;
const ROUTE = '/dsh-git-worktree/api';
const FIELD = '\x1f';
const RECORD = '\x1e';

/** Strip inherited Git environment so a nested hook or alias cannot change behavior. */
function cleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  env.GIT_TERMINAL_PROMPT = '0';
  env.LC_ALL = 'C';
  return env;
}

async function git(cwd, args, timeout = READ_TIMEOUT) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout,
      maxBuffer: MAX_OUTPUT,
      encoding: 'utf8',
      windowsHide: true,
      env: cleanEnv(),
    });
    return stdout;
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr || '') : '';
    throw new Error((stderr || (error instanceof Error ? error.message : String(error))).trim());
  }
}

/** A moment, without a timer service for one wait. */
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

// A restart serves the panel's first read before the Host knows the Session again.
// Long enough to cover that window, short enough that a broken setup still reports.
const SESSION_WAIT_MS = 3000;
const SESSION_POLL_MS = 120;

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
async function sessionCwd(ctx, sessionId, waitMs) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const sessions = ctx.get('sessions');
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
async function resolveRepo(query, config) {
  const candidates = [query.get('repo')];
  const sessionId = query.get('session');
  let sessionMissing = false;
  if (sessionId) {
    const configured = Number.isFinite(config.sessionWaitMs) ? Math.max(config.sessionWaitMs, 0) : SESSION_WAIT_MS;
    const cwd = await sessionCwd(config.ctx, sessionId, configured);
    if (cwd) candidates.push(cwd);
    else sessionMissing = true;
  }
  if (!sessionMissing) candidates.push(config.defaultRepo, process.cwd());
  const tried = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const input = await realpath(resolve(candidate));
      const root = (await git(input, ['rev-parse', '--show-toplevel'])).trim();
      if (!root) throw new Error('no work tree');
      return realpath(root);
    } catch (error) {
      tried.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (sessionMissing) {
    throw new Error(
      `Session ${sessionId} has not registered a working directory yet, and this panel only reads the workspace its Session sits in. Reopen the tab in a moment.`,
    );
  }
  throw new Error(`No Git repository found. Tried — ${tried.join(' | ')}`);
}

function parseWorktrees(raw) {
  return raw
    .split('\0\0')
    .filter(Boolean)
    .map((block) => {
      const item = { path: '', head: '', branch: null, bare: false, detached: false, locked: null, prunable: null };
      for (const field of block.split('\0').filter(Boolean)) {
        const separator = field.indexOf(' ');
        const key = separator < 0 ? field : field.slice(0, separator);
        const value = separator < 0 ? '' : field.slice(separator + 1);
        switch (key) {
          case 'worktree': item.path = value; break;
          case 'HEAD': item.head = value; break;
          case 'branch': item.branch = value.replace(/^refs\/heads\//, ''); break;
          case 'bare': item.bare = true; break;
          case 'detached': item.detached = true; break;
          case 'locked': item.locked = value || 'locked'; break;
          case 'prunable': item.prunable = value || 'prunable'; break;
          default: break;
        }
      }
      return item;
    })
    .filter((item) => item.path);
}

function parseStatus(raw) {
  const entries = raw.split('\n').filter(Boolean);
  return { dirty: entries.length > 0, entries: entries.length };
}

function parseGraph(raw) {
  const nodes = raw
    .split(RECORD)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [id, parents, author, authoredAt, subject] = record.split(FIELD);
      return { id, parents: parents ? parents.split(' ') : [], author, authoredAt, subject, refs: [] };
    });
  const present = new Set(nodes.map((node) => node.id));
  const edges = nodes.flatMap((node) =>
    node.parents.filter((parent) => present.has(parent)).map((parent) => ({ source: node.id, target: parent })),
  );
  return { nodes, edges };
}

async function refsFor(cwd) {
  const raw = await git(cwd, [
    'for-each-ref',
    '--format=%(refname)%09%(objectname)%09%(*objectname)%09%(HEAD)',
    'refs/heads',
    'refs/remotes',
    'refs/tags',
    'refs/stash',
  ]);
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [refname, object, peeled, headMark] = line.split('\t');
      const kind = refname.startsWith('refs/tags/')
        ? 'tag'
        : refname.startsWith('refs/remotes/')
          ? 'remote'
          : refname.startsWith('refs/stash')
            ? 'stash'
            : 'branch';
      return {
        name: refname.replace(/^refs\/(heads|remotes|tags)\//, '').replace(/^refs\/stash$/, 'stash'),
        full: refname,
        commit: peeled || object,
        kind,
        current: headMark === '*',
      };
    });
}

/**
 * The remote-tracking refs that mirror one local ref at the same commit.
 *
 * `main` and `origin/main` are one position under two names, so a mirror is not
 * a row of its own: it is a property of the local branch and rides inside that
 * branch's chip. `refs/remotes/<remote>/HEAD` is Git's own alias for the
 * remote's default branch rather than a name a branch can mirror, so it stays
 * out — otherwise every row holding `main` would grow a second chip for it.
 */
function mirrorsOf(matched, local) {
  if (local.kind !== 'branch') return [];
  const mirrors = [];
  for (const ref of matched) {
    if (ref.kind !== 'remote') continue;
    const slash = ref.name.indexOf('/');
    if (slash <= 0) continue;
    const branch = ref.name.slice(slash + 1);
    if (branch !== local.name) continue;
    mirrors.push({ name: ref.name.slice(0, slash), fullName: ref.name });
  }
  return mirrors;
}

/** One worktree's presentable state. A broken worktree reports its error instead of failing the whole list. */
async function worktreeSummary(worktree) {
  if (worktree.bare || worktree.prunable) {
    return { ...worktree, status: null, subject: null, unborn: false, error: worktree.bare ? 'bare' : 'prunable' };
  }
  const unborn = /^0+$/.test(worktree.head);
  try {
    const [statusRaw, subjectRaw] = await Promise.all([
      git(worktree.path, ['status', '--porcelain', '--untracked-files=normal']),
      unborn ? Promise.resolve('') : git(worktree.path, ['log', '-1', '--format=%s']),
    ]);
    return { ...worktree, status: parseStatus(statusRaw), subject: subjectRaw.trim() || null, unborn, error: null };
  } catch (error) {
    return {
      ...worktree,
      status: null,
      subject: null,
      unborn,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Compare two worktree paths, tolerating separator and case differences. */
function samePath(left, right) {
  const norm = (value) => resolve(value).replace(/[\\/]+$/, '').toLowerCase();
  return norm(left) === norm(right);
}

export async function worktreesPayload(query, config) {
  const root = await resolveRepo(query, config);
  const list = parseWorktrees(await git(root, ['worktree', 'list', '--porcelain', '-z']));
  const summaries = await Promise.all(list.map((worktree) => worktreeSummary(worktree)));
  const current = summaries.find((item) => samePath(item.path, root));
  return {
    apiVersion: 2,
    capabilities: ['commit-detail-v2', 'uncommitted-v1'],
    repo: { root, branch: current?.branch ?? null, head: current?.head ?? null },
    worktrees: summaries,
  };
}

export async function graphPayload(query, config) {
  const root = await resolveRepo(query, config);
  const target = query.get('worktree');
  const list = parseWorktrees(await git(root, ['worktree', 'list', '--porcelain', '-z']));
  const selected = target
    ? list.find((worktree) => samePath(worktree.path, resolve(root, target)) || samePath(worktree.path, target))
    : list.find((worktree) => samePath(worktree.path, root));
  if (!selected) throw new Error('The path is not an active worktree in the selected repository.');

  const scope = query.get('scope') || 'all';
  const branch = query.get('branch');
  // Remote-tracking history is opt-out: `remote=0` walks only what exists
  // locally. Anything else — including an older browser half that never sends
  // the parameter — keeps every ref, so the two halves stay interchangeable.
  const includeRemote = query.get('remote') !== '0';
  const requested = Number.parseInt(query.get('limit') || '', 10);
  const skip = Math.max(Number.parseInt(query.get('skip') || '', 10) || 0, 0);
  const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : config.commitLimit, 1), 2000);
  const unborn = /^0+$/.test(selected.head);

  // `--all` reaches every ref, not just HEAD: without it the panel cannot draw
  // the branches that make a graph worth looking at.
  // A selected branch is a filter, not an addition to `--all`. Passing both
  // makes Git walk their union and the selector appears to do nothing.
  // Branches, tags and (unless `remote=0`) remote-tracking refs are the history's
  // entry points. The tool's own snapshot and turn-diff refs and the stash are
  // not: every one of them is a tip, and a tip drawn mid-list starts a lane with
  // no line above it, which reads as a branch out of nowhere.
  // `--exclude` attaches to the `--all` that follows it, and its `*` also spans
  // `refs/remotes/origin/feature/x`.
  const notHistory = ['--exclude=refs/codex/*', '--exclude=refs/stash'];
  const everything = includeRemote
    ? [...notHistory, '--all']
    : ['--exclude=refs/remotes/*', ...notHistory, '--all'];
  const range = branch ? [branch] : scope === 'head' ? ['HEAD'] : everything;
  const raw = unborn && scope === 'head'
    ? ''
    : await git(selected.path, [
        'log',
        '--topo-order',
        '--date-order',
        `--max-count=${limit}`,
        `--skip=${skip}`,
        `--format=%H${FIELD}%P${FIELD}%an${FIELD}%aI${FIELD}%s${RECORD}`,
        ...range,
      ]);
  const graph = parseGraph(raw);
  const refs = await refsFor(selected.path);
  refs.push({ name: 'current worktree', full: '', commit: selected.head, kind: 'worktree', current: false });
  const byCommit = new Map();
  for (const ref of refs) {
    if (!ref.commit) continue;
    byCommit.set(ref.commit, [...(byCommit.get(ref.commit) || []), ref]);
  }
  for (const node of graph.nodes) {
    const matched = byCommit.get(node.id) || [];
    // A row is read for two things only: the local branches that sit on the commit
    // and whether the worktree is there. Tags, stashes and remote mirrors are
    // neither sent nor drawn, so the cap and the "+N" count describe exactly the
    // set the browser renders. The log still walks every ref, so the history keeps
    // reaching commits that only a tag or a remote mirror points at.
    const drawable = [
      ...matched.filter((ref) => ref.kind === 'worktree'),
      ...matched.filter((ref) => ref.kind === 'branch'),
    ];
    node.refs = drawable.slice(0, 6).map((ref) => {
      // "Show Remote Branches" decides whether a local branch names the remote
      // mirrors it shares its commit with. A remote-tracking ref is never sent
      // as a cell of its own, so the cap and the "+N" count keep describing the
      // local branches a row draws.
      const mirrors = includeRemote ? mirrorsOf(matched, ref) : [];
      return {
        name: ref.name,
        kind: ref.kind,
        current: ref.current,
        ...(mirrors.length > 0 ? { linkedRemotes: mirrors } : {}),
      };
    });
    node.refCount = drawable.length;
  }
  return {
    repo: root,
    worktree: selected.path,
    head: selected.head,
    branch: selected.branch,
    unborn,
    scope,
    branches: [...new Set(refs.filter((ref) => ref.kind === 'branch').map((ref) => ref.name))].sort(),
    skip,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

export async function diffPayload(query, config) {
  const root = await resolveRepo(query, config);
  const target = query.get('worktree');
  const cwd = target ? resolve(root, target) : root;
  const [stat, patch] = await Promise.all([
    git(cwd, ['diff', 'HEAD', '--stat', '--no-color']),
    git(cwd, ['diff', 'HEAD', '--no-color', '--unified=1']),
  ]);
  return { path: cwd, stat, patch };
}

const NUMSTAT = /\t/;

/** Parse `git diff --numstat`; a binary file reports `-` for both counts. */
export function parseNumstat(raw) {
  const files = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const [addText, delText, path] = line.split(NUMSTAT);
    if (path === undefined) continue;
    files.push({
      path,
      add: /^\d+$/.test(addText) ? Number(addText) : 0,
      del: /^\d+$/.test(delText) ? Number(delText) : 0,
      binary: addText === '-' || delText === '-',
      status: 'M',
    });
  }
  return files;
}

/** `git show --numstat` puts the message first, then one `add\tdel\tpath` row per file. */
export async function commitDetailPayload(query, config) {
  const root = await resolveRepo(query, config);
  const oid = query.get('oid') || '';
  if (!/^[0-9a-f]{7,64}$/i.test(oid)) throw new Error('Invalid commit id.');
  const raw = await git(root, ['show', '--no-color', '--numstat', `--format=%H${FIELD}%P${FIELD}%an${FIELD}%ae${FIELD}%cn${FIELD}%ce${FIELD}%aI${FIELD}%s${FIELD}%b${RECORD}`, oid]);
  const separator = raw.indexOf(RECORD);
  const header = (separator < 0 ? raw : raw.slice(0, separator)).split(FIELD);
  const body = separator < 0 ? '' : raw.slice(separator + RECORD.length);
  // `--numstat` prints no "N files changed" trailer — that belongs to `--stat` —
  // so the totals are summed here instead of parsed out of text.
  const files = parseNumstat(body);
  return {
    oid,
    parents: header[1] ? header[1].split(' ').filter(Boolean) : [],
    author: { name: header[2] || '', email: header[3] || '' },
    committer: { name: header[4] || '', email: header[5] || '' },
    authoredAt: header[6] || '',
    subject: header[7] || '',
    body: (header[8] || '').trim(),
    files,
    summary: {
      changed: files.length,
      insertions: files.reduce((sum, file) => sum + file.add, 0),
      deletions: files.reduce((sum, file) => sum + file.del, 0),
    },
  };
}

/** The working tree's own changes, shown as the graph's first row. */
export async function uncommittedPayload(query, config) {
  const root = await resolveRepo(query, config);
  const target = query.get('worktree');
  const cwd = target ? resolve(root, target) : root;
  const porcelain = await git(cwd, ['status', '--porcelain', '--untracked-files=all', '--no-renames']);
  const entries = porcelain.split('\n').filter(Boolean);
  const untracked = entries.filter((line) => line.startsWith('??')).map((line) => line.slice(3));
  const trackedOnly = entries.filter((line) => !line.startsWith('??'));
  const unborn = trackedOnly.some((line) => line.startsWith('## No commits yet'));
  const diffArgs = unborn ? ['diff', '--numstat', '--no-color'] : ['diff', 'HEAD', '--numstat', '--no-color'];
  let tracked = [];
  try {
    tracked = parseNumstat(await git(cwd, diffArgs));
  } catch {
    tracked = [];
  }
  const staged = parseNumstat(await git(cwd, ['diff', '--cached', '--numstat', '--no-color']).catch(() => ''));
  const byPath = new Map();
  for (const file of tracked) byPath.set(file.path, file);
  for (const file of staged) if (!byPath.has(file.path)) byPath.set(file.path, file);
  for (const path of untracked) {
    byPath.set(path, { path, add: 0, del: 0, binary: false, status: 'A', untracked: true });
  }
  const files = [...byPath.values()];
  const generated = files.filter((file) => file.untracked).length;
  return {
    path: cwd,
    branch: (await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim(),
    unborn,
    entries: entries.length,
    files,
    summary: {
      changed: files.length,
      insertions: files.reduce((sum, file) => sum + file.add, 0),
      deletions: files.reduce((sum, file) => sum + file.del, 0),
      generated,
    },
  };
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

/**
 * Register the read-only Git surface on the Web GUI's own HTTP server.
 * @param ctx - Host context carrying the webserver service.
 * @param config - this bundle row's config.
 */
export function apply(ctx, config) {
  const settings = {
    ctx,
    defaultRepo: typeof config?.defaultRepo === 'string' && config.defaultRepo ? config.defaultRepo : null,
    commitLimit: Number.isInteger(config?.commitLimit) && config.commitLimit > 0 ? config.commitLimit : 120,
  };

  const handlers = {
    worktrees: worktreesPayload,
    graph: graphPayload,
    diff: diffPayload,
    commit: commitDetailPayload,
    uncommitted: uncommittedPayload,
  };

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    async handler(req, res) {
      if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'Only GET is served.' });
        return;
      }
      const url = new URL(req.url || ROUTE, 'http://127.0.0.1');
      const action = url.pathname.slice(ROUTE.length).replace(/^\/+/, '');
      const run = handlers[action];
      if (!run) {
        sendJson(res, 404, { ok: false, error: `Unknown action: ${action || '(none)'}` });
        return;
      }
      try {
        const data = await run(url.searchParams, settings);
        sendJson(res, 200, { ok: true, data });
      } catch (error) {
        // A Git failure is an answer, not a transport error: the tab renders it inline.
        sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
  }), 'dsh-git-worktree: http route');
}

export const inject = ['webServer'];
