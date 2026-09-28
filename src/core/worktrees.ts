/**
 * Worktree listing and selection.
 *
 * `git worktree list --porcelain -z` is the only source of worktree truth; the
 * parser here gives the DSH panel one consistent account of every worktree.
 */
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { git } from './git.js';
import { API_VERSION, CAPABILITIES } from './types.js';
import type { Worktree, WorktreeStatus, WorktreeSummary, WorktreesPayload } from './types.js';

/** Parse NUL-separated `git worktree list --porcelain -z` output. */
export function parseWorktrees(raw: string): Worktree[] {
  return raw
    .split('\0\0')
    .filter(Boolean)
    .map((block) => {
      const item: Worktree = {
        path: '',
        head: '',
        branch: null,
        bare: false,
        detached: false,
        locked: null,
        prunable: null,
      };
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

/** `git status --porcelain` line count, which is what "dirty" means here. */
export function parseStatus(raw: string): WorktreeStatus {
  const entries = raw.split('\n').filter(Boolean);
  return { dirty: entries.length > 0, entries: entries.length };
}

/** Every worktree of `root`, unread. */
export async function listWorktrees(root: string): Promise<Worktree[]> {
  return parseWorktrees(await git(root, ['worktree', 'list', '--porcelain', '-z']));
}

/** One worktree's presentable state. A broken worktree reports its error instead of failing the whole list. */
export async function worktreeSummary(worktree: Worktree): Promise<WorktreeSummary> {
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
export function samePath(left: string, right: string): boolean {
  const norm = (value: string): string => resolve(value).replace(/[\\/]+$/, '').toLowerCase();
  return norm(left) === norm(right);
}

/**
 * The worktree a graph request names.
 *
 * A target may arrive absolute or relative to the repository root, and it may
 * spell the same directory differently — a symlinked temp root, a trailing
 * separator, different case — because one caller echoes back a path this host
 * sent while another names a path a user typed. Literal forms are tried first,
 * then the canonical one, so the answer never depends on which spelling won.
 */
export async function findWorktree(list: Worktree[], root: string, target?: string | null): Promise<Worktree | undefined> {
  if (!target) return list.find((worktree) => samePath(worktree.path, root));
  const candidates = [resolve(root, target), target];
  try {
    candidates.push(await realpath(resolve(root, target)));
  } catch {
    // The path is not on disk; the literal comparisons still stand, and the
    // caller gets the same "not an active worktree" answer either way.
  }
  for (const candidate of candidates) {
    const found = list.find((worktree) => samePath(worktree.path, candidate));
    if (found) return found;
  }
  return undefined;
}

/**
 * The worktree a *history operation* may act on: an active, checked-out,
 * non-bare, non-prunable worktree, compared after realpath so a symlinked path
 * still names the same checkout. A caller that names a path that is not one of
 * them gets an honest refusal instead of a Git error later.
 */
export async function selectActiveWorktree(root: string, target: string): Promise<Worktree> {
  const list = await listWorktrees(root);
  const wanted = await realpath(resolve(root, target));
  for (const worktree of list) {
    if (!worktree.bare && !worktree.prunable && (await realpath(worktree.path)) === wanted) return worktree;
  }
  throw new Error('The path is not an active worktree in the selected repository.');
}

/** The worktrees payload every view starts from. */
export async function worktreesPayload(root: string): Promise<WorktreesPayload> {
  const list = await listWorktrees(root);
  const summaries = await Promise.all(list.map((worktree) => worktreeSummary(worktree)));
  const current = summaries.find((item) => samePath(item.path, root));
  return {
    apiVersion: API_VERSION,
    capabilities: [...CAPABILITIES],
    repo: { root, branch: current?.branch ?? null, head: current?.head ?? null },
    worktrees: summaries,
  };
}
