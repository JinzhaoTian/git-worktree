/**
 * The Git payload contract between the DSH host and its view.
 *
 * Field names are wire names: the browser half reads them verbatim.
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
  /**
   * The path a rename moved this file away from, when Git reported one.
   *
   * A patch asked for by the new path alone is a patch asked for a file that
   * did not exist before, so Git answers with the whole file as an addition.
   * Naming both paths keeps the pair together and the change as what it was.
   */
  from?: string | null;
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

/** What a changed file's patch says happened to it. */
export type FileDiffStatus = 'added' | 'deleted' | 'renamed' | 'modified';

/** Which side of the change one line of a hunk belongs to. */
export type FileDiffLineKind = 'context' | 'add' | 'del';

/** One line of a hunk, carrying the number it holds on each side. */
export interface FileDiffLine {
  kind: FileDiffLineKind;
  text: string;
  /** The line's number in the old file, or null for a line that was added. */
  old: number | null;
  /** The line's number in the new file, or null for a line that was removed. */
  new: number | null;
}

/** One `@@ … @@` block, with the raw heading Git printed for it. */
export interface FileDiffHunk {
  heading: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: FileDiffLine[];
}

/**
 * One changed file's patch, as lines rather than as text.
 *
 * A file Git has never tracked has no patch to read, so its whole content is
 * reported as a single added hunk. `note` carries what could not be shown —
 * a file that is gone, or one too large to read — and never replaces the
 * payload, so a view always has something to draw.
 */
export interface FileDiffPayload {
  path: string;
  /** The commit the patch belongs to, or null for the working tree's own change. */
  oid: string | null;
  status: FileDiffStatus;
  binary: boolean;
  add: number;
  del: number;
  hunks: FileDiffHunk[];
  /** True when the patch was cut short before its end. */
  truncated: boolean;
  note: string | null;
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
export const CAPABILITIES = ['commit-detail-v2', 'uncommitted-v1', 'operations-v1', 'file-diff-v1'];
