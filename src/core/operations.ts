/**
 * History-changing operations: creating a worktree, and rebasing or
 * cherry-picking onto a commit.
 *
 * The DSH panel's controls use this code for every history change:
 *
 * - nothing is planned until the worktree is provably ready for it (an active
 *   branch, clean tree, no operation already in progress);
 * - a plan expires after five minutes and can be attempted exactly once, even if
 *   the attempt fails, so a stale preview can never be replayed;
 * - the apply re-reads the worktree, its branch, its HEAD and the target, and
 *   refuses if any of them moved since the preview.
 *
 * A plan is held in memory: a host restart invalidates every plan, and a plan
 * is only meaningful within one preview/apply exchange in the panel.
 */
import { isAbsolute, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, realpath } from 'node:fs/promises';
import { commitOid, git, pathExists } from './git.js';
import { selectActiveWorktree } from './worktrees.js';
import type { OperationKind, OperationPreview, Worktree } from './types.js';

/** How long a preview stays applicable. */
export const PLAN_TTL_MS = 5 * 60_000;

/** A history operation rewrites commits and can wait on a lock. */
const WRITE_TIMEOUT_MS = 120_000;

/** The markers Git leaves while an operation is stopped, all fatal to a new one. */
const IN_PROGRESS_MARKERS = ['rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'MERGE_HEAD', 'REVERT_HEAD'];

/** One stored plan: the public preview plus what applying it needs to recheck. */
interface StoredPlan extends OperationPreview {
  root: string;
  worktreePath: string;
  issuedAt: number;
  base?: string;
}

const plans = new Map<string, StoredPlan>();

/** True when the checkout has staged, unstaged or untracked changes. */
async function isDirty(cwd: string): Promise<boolean> {
  const porcelain = await git(cwd, ['status', '--porcelain']);
  return porcelain.split('\n').some((line) => line.length > 0);
}

/**
 * The worktree an operation may act on, or a refusal naming what is wrong.
 *
 * Every refusal happens here, before a plan exists: a clean, checked-out,
 * non-bare worktree with no rebase, cherry-pick, merge or revert already stopped
 * in it.
 */
export async function requireReady(root: string, worktreePath: string): Promise<Worktree> {
  const selected = await selectActiveWorktree(root, worktreePath);
  if (selected.bare || !selected.branch) throw new Error('A checked-out branch is required for this operation.');
  if (selected.locked || selected.prunable) throw new Error('This worktree is not available for history operations.');
  if (await isDirty(selected.path)) throw new Error('The worktree must be clean before a history operation.');
  for (const marker of IN_PROGRESS_MARKERS) {
    const markerPath = (await git(selected.path, ['rev-parse', '--git-path', marker])).trim();
    if (await pathExists(resolve(selected.path, markerPath))) {
      throw new Error(`Git operation in progress (${marker}). Resolve it first.`);
    }
  }
  return selected;
}

/** Store a preview under a fresh id, dropping every expired plan on the way. */
function storePlan(plan: Omit<StoredPlan, 'planId' | 'issuedAt' | 'expiresAt'>): OperationPreview {
  const now = Date.now();
  for (const [id, old] of plans) if (now - old.issuedAt >= PLAN_TTL_MS) plans.delete(id);
  const saved: StoredPlan = {
    ...plan,
    planId: randomUUID(),
    issuedAt: now,
    expiresAt: new Date(now + PLAN_TTL_MS).toISOString(),
  };
  plans.set(saved.planId, saved);
  const { root: _root, issuedAt: _issuedAt, base: _base, ...publicPlan } = saved;
  return publicPlan;
}

/** Create a branch and a worktree for it at `startPoint`. */
export async function createWorktree(root: string, path: string, branch: string, startPoint = 'HEAD') {
  if (branch.startsWith('-')) throw new Error("Branch cannot start with '-'.");
  await git(root, ['check-ref-format', '--branch', branch]);
  const oid = await commitOid(root, startPoint);
  const target = isAbsolute(path) ? resolve(path) : resolve(root, path);
  await mkdir(resolve(target, '..'), { recursive: true });
  await git(root, ['worktree', 'add', '-b', branch, target, oid], WRITE_TIMEOUT_MS);
  return { created: true, path: await realpath(target), branch, head: oid };
}

/** Plan a rebase of the worktree's branch onto `target`. */
export async function previewRebase(root: string, worktreePath: string, target: string): Promise<OperationPreview> {
  const worktree = await requireReady(root, worktreePath);
  const targetCommit = await commitOid(worktree.path, target);
  const base = (await git(worktree.path, ['merge-base', worktree.head, targetCommit])).trim();
  const commits = (await git(worktree.path, ['rev-list', '--reverse', `${targetCommit}..${worktree.head}`]))
    .trim().split('\n').filter(Boolean);
  const merges = (await git(worktree.path, ['rev-list', '--merges', `${base}..${worktree.head}`])).trim();
  const warnings = ['Rebase rewrites commit IDs. Conflicts may require manual resolution.'];
  if (merges) warnings.push('This branch contains merge commits; default rebase may flatten them.');
  if (!commits.length) warnings.push('No commits need replaying.');
  return storePlan({
    operation: 'rebase', root, worktreePath: worktree.path, branch: worktree.branch as string,
    head: worktree.head, target, targetCommit, base, commits, warnings,
  });
}

/** Plan a cherry-pick of one non-merge commit into the worktree's branch. */
export async function previewCherryPick(root: string, worktreePath: string, commit: string): Promise<OperationPreview> {
  const worktree = await requireReady(root, worktreePath);
  const targetCommit = await commitOid(worktree.path, commit);
  const parents = (await git(worktree.path, ['rev-list', '--parents', '-n', '1', targetCommit]))
    .trim().split(' ').slice(1);
  if (parents.length > 1) throw new Error('Cherry-picking a merge commit requires a mainline; select a non-merge commit.');
  return storePlan({
    operation: 'cherry-pick', root, worktreePath: worktree.path, branch: worktree.branch as string,
    head: worktree.head, target: commit, targetCommit, commits: [targetCommit],
    warnings: ['Cherry-pick creates a new commit. Conflicts may require manual resolution.'],
  });
}

/** Apply a previewed plan, once, after re-reading everything it was based on. */
export async function applyPlan(operation: OperationKind, planId: string, confirm: boolean) {
  if (!confirm) throw new Error('Set confirm=true after reviewing the preview.');
  const plan = plans.get(planId);
  if (!plan || plan.operation !== operation) throw new Error('Plan not found. Request a new preview.');
  // A plan can only be attempted once, including failures.
  plans.delete(planId);
  if (Date.now() - plan.issuedAt >= PLAN_TTL_MS) throw new Error('Plan expired. Request a new preview.');
  const worktree = await requireReady(plan.root, plan.worktreePath);
  if (worktree.head !== plan.head || worktree.branch !== plan.branch) {
    throw new Error('The worktree changed since preview. Request a new preview.');
  }
  if (await commitOid(worktree.path, plan.target) !== plan.targetCommit) {
    throw new Error('The target ref changed since preview. Request a new preview.');
  }
  const args = operation === 'rebase' ? ['rebase', plan.targetCommit] : ['cherry-pick', plan.targetCommit];
  try {
    await git(worktree.path, args, WRITE_TIMEOUT_MS);
    return { applied: true, operation, worktreePath: worktree.path, head: await commitOid(worktree.path, 'HEAD') };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const resume = operation === 'rebase' ? 'rebase' : 'cherry-pick';
    throw new Error(`${detail}\nGit may have stopped for conflicts in ${worktree.path}. Resolve them there with git ${resume} --continue or --abort.`);
  }
}
