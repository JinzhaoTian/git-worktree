/**
 * Working-tree and commit-level diffs.
 *
 * `--numstat` is parsed into numbers rather than shown as text, because both
 * views draw counts and file trees instead of a patch. `fileDiffPayload` is the
 * one place a patch is read: it answers one file's change as hunks of numbered
 * lines, so the view can draw a diff without parsing Git's text itself.
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { git } from './git.js';
import { FIELD, RECORD } from './format.js';
import type {
  ChangedFile,
  CommitDetailPayload,
  DiffPayload,
  FileDiffHunk,
  FileDiffLine,
  FileDiffPayload,
  FileDiffStatus,
  UncommittedPayload,
} from './types.js';

const NUMSTAT = /\t/;

/** Every field a `@@` heading carries, and the heading's own trailing text. */
const HUNK_HEADING = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

/** How much of one file is read before the view is told the rest was left out. */
const MAX_PATCH_BYTES = 512 * 1024;
/** How large an untracked file may be and still be shown as one added hunk. */
const MAX_UNTRACKED_BYTES = 1024 * 1024;
/** How much of a file is sniffed for a NUL byte, which is what makes it binary. */
const BINARY_SNIFF_BYTES = 8000;

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

/** One numstat entry's counts, with `-` read as the binary marker it is. */
function counts(addText: string, delText: string): { add: number; del: number; binary: boolean } {
  return {
    add: /^\d+$/.test(addText) ? Number(addText) : 0,
    del: /^\d+$/.test(delText) ? Number(delText) : 0,
    binary: addText === '-' || delText === '-',
  };
}

/**
 * Parse `git diff --numstat -z`.
 *
 * NUL-terminated output is the only form that survives a rename: the plain
 * form spells one as `old => new`, which is not a path any later Git call can
 * be given, and which a file legitimately named `a => b` would make ambiguous.
 * Here a rename is an entry whose path field is empty with the two real paths
 * in the fields that follow, so the entry keeps the *new* path — the one the
 * change produced, and the one a patch can be asked for.
 */
export function parseNumstatZ(raw: string): ChangedFile[] {
  const parts = raw.split('\0');
  const files: ChangedFile[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    // The record Git puts after a `--format` header ends in a newline of its own.
    const part = parts[index].replace(/^[\r\n]+/, '');
    const columns = part.split(NUMSTAT);
    if (columns.length < 2) continue;
    const [addText = '', delText = '', path = ''] = columns;
    if (!/^\d+$|^-$/.test(addText) || !/^\d+$|^-$/.test(delText)) continue;
    let resolved = path;
    let from: string | null = null;
    if (!resolved) {
      // A rename: this entry's path is empty and the next two fields are its
      // old and new path. Both are consumed either way.
      from = parts[index + 1] || null;
      resolved = parts[index + 2] || '';
      index += 2;
    }
    if (!resolved) continue;
    const { add, del, binary } = counts(addText, delText);
    files.push({ path: resolved, add, del, binary, status: 'M', from });
  }
  return files;
}

/**
 * Reject anything that is not one plain path inside the worktree.
 *
 * The path reaches Git's argv after `--`, so it cannot become an option; what
 * this stops is a caller reaching outside the checkout — an absolute path, a
 * drive letter, or a `..` segment — and a leading `:` magic pathspec, which
 * would widen the request to paths the caller never named.
 */
export function assertFilePath(path: string): void {
  if (!path || path.startsWith('-') || path.startsWith(':') || path.includes('\0')) {
    throw new Error('Invalid file path.');
  }
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
    throw new Error('A file path must be relative to the worktree.');
  }
  if (path.split(/[\\/]+/).includes('..')) {
    throw new Error('A file path must stay inside the worktree.');
  }
}

/**
 * Read one patch as hunks.
 *
 * Only what Git prints between a `@@` heading and the next one is a line of
 * the change; everything before the first heading — `new file mode`, `rename
 * from`, the `index` and `---`/`+++` lines — describes the file as a whole and
 * is read for the status instead. A hunk's own numbers walk the two files, so
 * the view never has to count lines to know where it is.
 */
export function parseUnifiedDiff(raw: string): { hunks: FileDiffHunk[]; binary: boolean; status: FileDiffStatus } {
  const hunks: FileDiffHunk[] = [];
  let binary = false;
  let status: FileDiffStatus = 'modified';
  let hunk: FileDiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;
  for (const line of raw.split('\n')) {
    const heading = HUNK_HEADING.exec(line);
    if (heading) {
      oldLine = Number(heading[1]);
      newLine = Number(heading[3]);
      hunk = {
        heading: line,
        oldStart: oldLine,
        oldCount: heading[2] === undefined ? 1 : Number(heading[2]),
        newStart: newLine,
        newCount: heading[4] === undefined ? 1 : Number(heading[4]),
        lines: [],
      };
      hunks.push(hunk);
      continue;
    }
    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      binary = true;
      hunk = null;
      continue;
    }
    if (line.startsWith('new file mode')) { status = 'added'; continue; }
    if (line.startsWith('deleted file mode')) { status = 'deleted'; continue; }
    if (line.startsWith('rename from ') || line.startsWith('rename to ')) { status = 'renamed'; continue; }
    if (!hunk) continue;
    // `\ No newline at end of file` annotates the line above it, and the empty
    // string a trailing newline leaves behind is not a line of either file.
    if (line.startsWith('\\')) continue;
    if (line.startsWith('+')) {
      hunk.lines.push({ kind: 'add', text: line.slice(1), old: null, new: newLine });
      newLine += 1;
      continue;
    }
    if (line.startsWith('-')) {
      hunk.lines.push({ kind: 'del', text: line.slice(1), old: oldLine, new: null });
      oldLine += 1;
      continue;
    }
    if (line.startsWith(' ')) {
      hunk.lines.push({ kind: 'context', text: line.slice(1), old: oldLine, new: newLine });
      oldLine += 1;
      newLine += 1;
    }
  }
  return { hunks, binary, status };
}

/** The `+`/`-` totals a set of hunks describes. */
function hunkTotals(hunks: FileDiffHunk[]): { add: number; del: number } {
  let add = 0;
  let del = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'add') add += 1;
      else if (line.kind === 'del') del += 1;
    }
  }
  return { add, del };
}

/** One patch, cut at a line boundary so the last hunk it keeps is whole. */
function patchPayload(path: string, oid: string | null, raw: string): FileDiffPayload {
  let text = raw;
  let truncated = false;
  if (raw.length > MAX_PATCH_BYTES) {
    const edge = raw.lastIndexOf('\n', MAX_PATCH_BYTES);
    text = raw.slice(0, edge < 0 ? MAX_PATCH_BYTES : edge);
    truncated = true;
  }
  const parsed = parseUnifiedDiff(text);
  const { add, del } = hunkTotals(parsed.hunks);
  return {
    path,
    oid,
    status: parsed.status,
    binary: parsed.binary,
    add,
    del,
    hunks: parsed.hunks,
    truncated,
    note: null,
  };
}

/** Whether a file's first bytes hold the NUL that makes Git call it binary. */
function looksBinary(buffer: Buffer): boolean {
  const end = Math.min(buffer.length, BINARY_SNIFF_BYTES);
  for (let index = 0; index < end; index += 1) if (buffer[index] === 0) return true;
  return false;
}

/**
 * A file Git does not track yet, whose whole content is the change.
 *
 * There is no patch to ask for — `git diff` has nothing to compare it against
 * and `--no-index` answers with an exit code rather than a diff — so the file
 * is read here, and its lines become one added hunk. Anything that could not be
 * shown (a file that is gone, or one too large to read) is reported as a note
 * instead of as an empty diff, so the view can say which it is.
 */
async function untrackedPayload(cwd: string, path: string): Promise<FileDiffPayload> {
  const empty: FileDiffPayload = {
    path, oid: null, status: 'added', binary: false, add: 0, del: 0, hunks: [], truncated: false, note: null,
  };
  const info = await stat(resolve(cwd, path)).catch(() => null);
  if (!info || !info.isFile()) {
    return { ...empty, note: 'This file is not on disk. It was removed, renamed, or ignored between reads.' };
  }
  if (info.size > MAX_UNTRACKED_BYTES) {
    return { ...empty, truncated: true, note: 'This file is too large to show.' };
  }
  const buffer = await readFile(resolve(cwd, path));
  if (looksBinary(buffer)) return { ...empty, binary: true };
  const text = buffer.toString('utf8');
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  const lines = body.split('\n');
  const numbered: FileDiffLine[] = lines.map((line, index) => ({
    kind: 'add',
    // A CRLF file keeps its carriage return; the view strips it for display.
    text: line,
    old: null,
    new: index + 1,
  }));
  return {
    ...empty,
    add: numbered.length,
    hunks: [{
      heading: `@@ -0,0 +1,${numbered.length} @@`,
      oldStart: 0,
      oldCount: 0,
      newStart: 1,
      newCount: numbered.length,
      lines: numbered,
    }],
  };
}

/**
 * One file's change, either inside a commit or in the working tree.
 *
 * A commit's patch comes from `git show` scoped to the path. The working tree's
 * own change is `git diff HEAD` scoped the same way, which covers staged and
 * unstaged edits, new files that reached the index, and deletions in one read;
 * a repository whose HEAD does not exist yet has no such baseline, so the index
 * is compared against the empty tree instead. Only a file Git does not track at
 * all falls through to being read from disk.
 */
export async function fileDiffPayload(
  root: string,
  options: { worktree?: string | null; path: string; oid?: string | null; from?: string | null },
): Promise<FileDiffPayload> {
  const cwd = options.worktree ? resolve(root, options.worktree) : root;
  const path = options.path;
  assertFilePath(path);
  const oid = options.oid || null;
  if (oid) {
    if (!/^[0-9a-f]{7,64}$/i.test(oid)) throw new Error('Invalid commit id.');
    // Both ends of a rename, so Git can still see the pair it detected: asked
    // for the new path alone, it reports a file that is wholly new.
    const from = options.from ? [options.from] : [];
    if (options.from) assertFilePath(options.from);
    return patchPayload(path, oid, await git(cwd, ['show', '--no-color', '--format=', '--unified=3', oid, '--', path, ...from]));
  }
  let tracked: string;
  try {
    tracked = await git(cwd, ['diff', 'HEAD', '--no-color', '--unified=3', '--', path]);
  } catch (error) {
    // An unborn HEAD is not a baseline: the index is.
    tracked = await git(cwd, ['diff', '--cached', '--no-color', '--unified=3', '--', path]).catch(() => {
      throw error;
    });
  }
  if (tracked.trim()) return patchPayload(path, null, tracked);
  return untrackedPayload(cwd, path);
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
 * as a numstat body. The body is NUL-terminated so a renamed file is reported
 * as the path it became rather than as the `old => new` text the plain form
 * prints, which is not a path any later read could be given.
 */
export async function commitDetailPayload(root: string, oid: string): Promise<CommitDetailPayload> {
  if (!/^[0-9a-f]{7,64}$/i.test(oid)) throw new Error('Invalid commit id.');
  const raw = await git(root, [
    'show',
    '--no-color',
    '--numstat',
    '-z',
    `--format=%H${FIELD}%P${FIELD}%an${FIELD}%ae${FIELD}%cn${FIELD}%ce${FIELD}%aI${FIELD}%s${FIELD}%b${RECORD}`,
    oid,
  ]);
  const separator = raw.indexOf(RECORD);
  const header = (separator < 0 ? raw : raw.slice(0, separator)).split(FIELD);
  const body = separator < 0 ? '' : raw.slice(separator + RECORD.length);
  // `--numstat` prints no "N files changed" trailer — that belongs to `--stat` —
  // so the totals are summed here instead of parsed out of text.
  const files = parseNumstatZ(body);
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
