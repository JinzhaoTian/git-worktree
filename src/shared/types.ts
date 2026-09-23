export interface Worktree {
  path: string;
  head: string;
  branch: string | null;
  bare: boolean;
  detached: boolean;
  locked: string | null;
  prunable: string | null;
}

export interface GitStatus {
  path: string;
  dirty: boolean;
  entries: number;
  branch: string | null;
  head: string;
}

export interface CommitNode {
  id: string;
  parents: string[];
  subject: string;
  author: string;
  authoredAt: string;
  refs: string[];
}

export interface CommitGraph {
  worktreePath: string;
  head: string;
  branch: string | null;
  nodes: CommitNode[];
  edges: { source: string; target: string }[];
  refs: { name: string; commit: string; kind: "branch" | "tag" | "worktree" }[];
}

export interface OperationPreview {
  planId: string;
  operation: "rebase" | "cherry-pick";
  worktreePath: string;
  branch: string;
  head: string;
  target: string;
  targetCommit: string;
  commits: string[];
  warnings: string[];
  expiresAt: string;
}
