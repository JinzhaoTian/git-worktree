/**
 * The commit graph: which commits exist, how they are wired, and which refs a
 * row may draw.
 *
 * One walk answers both halves: the DSH panel pages it with `limit`/`skip`, and
 * the MCP tools read the same shape, so a lane drawn in one view means the same
 * thing in the other.
 */
import { git } from './git.js';
import { FIELD, RECORD } from './format.js';
import { findWorktree, parseWorktrees } from './worktrees.js';
import type { CommitRef, GraphEdge, GraphNode, GraphPayload, GraphRef, RemoteMirror } from './types.js';

/** One commit row as `git log` reports it, before refs are attached. */
type ParsedNode = Omit<GraphNode, 'refs'> & { refs: GraphRef[] };

/** Parse the `%H<FIELD>%P<FIELD>%an<FIELD>%aI<FIELD>%s<RECORD>` log format. */
export function parseGraph(raw: string): { nodes: ParsedNode[]; edges: GraphEdge[] } {
  const nodes: ParsedNode[] = raw
    .split(RECORD)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [id, parents, author, authoredAt, subject] = record.split(FIELD);
      return {
        id: id ?? '',
        parents: parents ? parents.split(' ') : [],
        author: author ?? '',
        authoredAt: authoredAt ?? '',
        subject: subject ?? '',
        refs: [],
      };
    });
  const present = new Set(nodes.map((node) => node.id));
  const edges = nodes.flatMap((node) =>
    node.parents.filter((parent) => present.has(parent)).map((parent) => ({ source: node.id, target: parent })),
  );
  return { nodes, edges };
}

/** Every ref Git knows in `cwd`, including the ones a row never draws. */
export async function refsFor(cwd: string): Promise<CommitRef[]> {
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
      const [refname = '', object, peeled, headMark] = line.split('\t');
      const kind: CommitRef['kind'] = refname.startsWith('refs/tags/')
        ? 'tag'
        : refname.startsWith('refs/remotes/')
          ? 'remote'
          : refname.startsWith('refs/stash')
            ? 'stash'
            : 'branch';
      return {
        name: refname.replace(/^refs\/(heads|remotes|tags)\//, '').replace(/^refs\/stash$/, 'stash'),
        full: refname,
        commit: peeled || object || '',
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
export function mirrorsOf(matched: CommitRef[], local: CommitRef): RemoteMirror[] {
  if (local.kind !== 'branch') return [];
  const mirrors: RemoteMirror[] = [];
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

/** What one graph read asks for. */
export interface GraphQuery {
  /** The worktree to read; absent means the repository root's own worktree. */
  worktree?: string | null;
  /** `head` walks only HEAD's ancestry; anything else walks every history ref. */
  scope?: string | null;
  /** A branch filter, which replaces the ref set rather than joining it. */
  branch?: string | null;
  /** Remote-tracking history is included unless this is false. */
  includeRemote?: boolean;
  limit?: number | null;
  skip?: number | null;
  /** Page size when the caller names none. */
  defaultLimit: number;
}

/** Read one page of the graph for one worktree. */
export async function graphPayload(root: string, query: GraphQuery): Promise<GraphPayload> {
  const target = query.worktree ?? null;
  const list = parseWorktrees(await git(root, ['worktree', 'list', '--porcelain', '-z']));
  const selected = await findWorktree(list, root, target);
  if (!selected) throw new Error('The path is not an active worktree in the selected repository.');

  const scope = query.scope || 'all';
  const branch = query.branch ?? null;
  const includeRemote = query.includeRemote !== false;
  const requested = query.limit ?? Number.NaN;
  const skip = Math.max(query.skip ?? 0, 0);
  const limit = Math.min(Math.max(Number.isFinite(requested) ? (requested as number) : query.defaultLimit, 1), 2000);
  const unborn = /^0+$/.test(selected.head);

  // `--all` reaches every ref, not just HEAD: without it a view cannot draw the
  // branches that make a graph worth looking at.
  // A selected branch is a filter, not an addition to `--all`. Passing both
  // makes Git walk their union and the selector appears to do nothing.
  // Branches, tags and (unless remotes are hidden) remote-tracking refs are the
  // history's entry points. The tool's own snapshot and turn-diff refs and the
  // stash are not: every one of them is a tip, and a tip drawn mid-list starts a
  // lane with no line above it, which reads as a branch out of nowhere.
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
  const byCommit = new Map<string, CommitRef[]>();
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
