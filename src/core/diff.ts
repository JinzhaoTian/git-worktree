/**
 * Working-tree and commit-level diffs.
 *
 * `--numstat` is parsed into numbers rather than shown as text, because both
 * views draw counts and file trees instead of a patch. The raw patch is only
 * read by the diff route, which no view depends on yet.
 */
import { resolve } from 'node:path';
import { git } from './git.js';
import { FIELD, RECORD } from './format.js';
import type { ChangedFile, CommitDetailPayload, DiffPayload, UncommittedPayload } from './types.js';

const NUMSTAT = /\t/;

/** Parse `git diff --numstat`; a binary file reports `-` for both counts. */
export function parseNumstat(raw: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const [addText = '', delText = '', path] = line.split(NUMSTAT);
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

/** The working tree's own changes as a stat plus a patch. */
export async function diffPayload(root: string, worktree?: string | null): Promise<DiffPayload> {
  const cwd = worktree ? resolve(root, worktree) : root;
  const [stat, patch] = await Promise.all([
    git(cwd, ['diff', 'HEAD', '--stat', '--no-color']),
    git(cwd, ['diff', 'HEAD', '--no-color', '--unified=1']),
  ]);
  return { path: cwd, stat, patch };
}

/**
 * One commit's metadata and changed-file stats.
 *
 * `git show --numstat` puts the message first, then one `add\tdel\tpath` row per
 * file, so the header is read up to the record separator and the rest is parsed
 * as a numstat body.
 */
export async function commitDetailPayload(root: string, oid: string): Promise<CommitDetailPayload> {
  if (!/^[0-9a-f]{7,64}$/i.test(oid)) throw new Error('Invalid commit id.');
  const raw = await git(root, [
    'show',
    '--no-color',
    '--numstat',
    `--format=%H${FIELD}%P${FIELD}%an${FIELD}%ae${FIELD}%cn${FIELD}%ce${FIELD}%aI${FIELD}%s${FIELD}%b${RECORD}`,
    oid,
  ]);
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

/**
 * The working tree's own changes, shown as the graph's first row.
 *
 * Tracked, staged, and untracked files are merged by path so one file appears
 * once; an untracked file is "generated" rather than a numstat row, because Git
 * reports no counts for a file it has never tracked.
 */
export async function uncommittedPayload(root: string, worktree?: string | null): Promise<UncommittedPayload> {
  const cwd = worktree ? resolve(root, worktree) : root;
  const porcelain = await git(cwd, ['status', '--porcelain', '--untracked-files=all', '--no-renames']);
  const entries = porcelain.split('\n').filter(Boolean);
  const untracked = entries.filter((line) => line.startsWith('??')).map((line) => line.slice(3));
  const trackedOnly = entries.filter((line) => !line.startsWith('??'));
  const unborn = trackedOnly.some((line) => line.startsWith('## No commits yet'));
  const diffArgs = unborn ? ['diff', '--numstat', '--no-color'] : ['diff', 'HEAD', '--numstat', '--no-color'];
  let tracked: ChangedFile[] = [];
  try {
    tracked = parseNumstat(await git(cwd, diffArgs));
  } catch {
    tracked = [];
  }
  const staged = parseNumstat(await git(cwd, ['diff', '--cached', '--numstat', '--no-color']).catch(() => ''));
  const byPath = new Map<string, ChangedFile>();
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
