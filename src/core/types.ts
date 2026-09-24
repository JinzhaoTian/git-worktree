/**
 * The Git payload contract, shared by every host and every view.
 *
 * One description of what a repository read answers, so the DSH bundle's HTTP
 * route, the Codex MCP tools, and both browser halves cannot drift apart. Field
 * names are wire names: the browser halves read them verbatim.
 */

/** One entry of `git worktree list --porcelain -z`. */
export interface Worktree {
  path: string;
  head: string;
  branch: string | null;
  bare: boolean;
  detached: boolean;
  locked: string | null;
  prunable: string | null;
}

/** Tracked and untracked change count for one worktree. */
export interface WorktreeStatus {
  dirty: boolean;
  entries: number;
}

/** One worktree's presentable state; a broken worktree reports `error` instead of failing the list. */
export interface WorktreeSummary extends Worktree {
  status: WorktreeStatus | null;
  subject: string | null;
  unborn: boolean;
  error: string | null;
}

/** The repository a payload was read from. */
export interface RepoIdentity {
  root: string;
  branch: string | null;
  head: string | null;
}

export interface WorktreesPayload {
  apiVersion: number;
  capabilities: string[];
  repo: RepoIdentity;
  worktrees: WorktreeSummary[];
}

/** What kind of ref a name is, which decides whether a row draws it. */
export type GitRefKind = 'branch' | 'tag' | 'remote' | 'stash' | 'worktree';

/** One ref as enumerated from the repository, before a row decides what to draw. */
export interface CommitRef {
  name: string;
  full: string;
  commit: string;
  kind: GitRefKind;
  current: boolean;
}

/** A remote-tracking ref that mirrors a local branch at the same commit. */
export interface RemoteMirror {
  name: string;
  fullName: string;
}

/** A ref chip as sent to a view. */
export interface GraphRef {
  name: string;
  kind: GitRefKind;
  current: boolean;
  /** Present only when the local branch is mirrored on a remote and remotes are shown. */
  linkedRemotes?: RemoteMirror[];
}

export interface GraphNode {
  id: string;
  parents: string[];
  author: string;
  authoredAt: string;
  subject: string;
  refs: GraphRef[];
  /** How many drawable refs sit on this commit, which the "+N" count describes. */
  refCount?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphPayload {
  repo: string;
  worktree: string;
  head: string;
  branch: string | null;
  unborn: boolean;
  scope: string;
  branches: string[];
  skip: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** One changed file, from `--numstat` or from the untracked list. */
export interface ChangedFile {
  path: string;
  add: number;
  del: number;
  binary: boolean;
  status: string;
  untracked?: boolean;
}

export interface FileSummary {
  changed: number;
  insertions: number;
  deletions: number;
}

export interface CommitIdentity {
  name: string;
  email: string;
}

export interface CommitDetailPayload {
  oid: string;
  parents: string[];
  author: CommitIdentity;
  committer: CommitIdentity;
  authoredAt: string;
  subject: string;
  body: string;
  files: ChangedFile[];
  summary: FileSummary;
}

export interface UncommittedPayload {
  path: string;
  branch: string;
  unborn: boolean;
  entries: number;
  files: ChangedFile[];
  summary: FileSummary & { generated: number };
}

export interface DiffPayload {
  path: string;
  stat: string;
  patch: string;
}

/** Which history operation a plan describes. */
export type OperationKind = 'rebase' | 'cherry-pick';

/**
 * A planned history operation, shown for confirmation before anything runs.
 *
 * The plan is one-use and expiring: the host stores it, the view renders it, and
 * applying it re-reads everything it was based on.
 */
export interface OperationPreview {
  planId: string;
  operation: OperationKind;
  worktreePath: string;
  branch: string;
  head: string;
  target: string;
  targetCommit: string;
  commits: string[];
  warnings: string[];
  expiresAt: string;
}

/** What applying a plan answers. */
export interface OperationResult {
  applied: true;
  operation: OperationKind;
  worktreePath: string;
  head: string;
}

/** What creating a worktree answers. */
export interface WorktreeCreated {
  created: true;
  path: string;
  branch: string;
  head: string;
}

/** The payload shape every host answers with. */
export const API_VERSION = 2;

/** What a browser half may rely on beyond the base payload. */
export const CAPABILITIES = ['commit-detail-v2', 'uncommitted-v1', 'operations-v1'];
