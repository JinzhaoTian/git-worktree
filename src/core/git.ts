/**
 * The one place a Git command is started.
 *
 * Bindings are fixed argument arrays passed to `git` through `execFile`; no
 * shell string is ever assembled from input, so no path, ref, or commit subject
 * can become a command. Inherited `GIT_*` variables are stripped for the same
 * reason: a hook, alias, or `GIT_DIR` in the caller's environment must not
 * change what a read means.
 */
import { execFile } from 'node:child_process';
import { access, realpath } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Long enough for a cold repository on a slow disk, short enough to fail loudly. */
export const READ_TIMEOUT_MS = 20_000;

/** A graph page of a large history is megabytes of text, not a buffer overflow. */
export const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

/** Strip inherited Git environment so a nested hook or alias cannot change behavior. */
export function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  env.GIT_TERMINAL_PROMPT = '0';
  env.LC_ALL = 'C';
  return env;
}

/** Run one Git command and answer its stdout, or throw Git's own message. */
export async function git(cwd: string, args: string[], timeout: number = READ_TIMEOUT_MS): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout,
      maxBuffer: MAX_OUTPUT_BYTES,
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

/** The repository root containing `input`, with Git's own answer as the source of truth. */
export async function repoRoot(input: string): Promise<string> {
  const path = await realpath(input);
  const root = (await git(path, ['rev-parse', '--show-toplevel'])).trim();
  if (!root) throw new Error('The selected path is not a non-bare Git worktree.');
  return realpath(root);
}

/**
 * Reject a ref name before it reaches Git's argv.
 *
 * `git` would read a leading `-` as an option and a revision expression could
 * reach a parent or a reflog entry, so a name that is not a plain ref is refused
 * here rather than quoted somewhere later.
 */
export function assertRefName(ref: string): void {
  if (!ref || ref.startsWith('-') || /[\x00-\x20\x7f]/.test(ref) || ref.includes('..') || ref.includes('@{')) {
    throw new Error('Invalid Git ref.');
  }
}

/** Resolve a ref to the exact commit it names. */
export async function commitOid(cwd: string, ref: string): Promise<string> {
  assertRefName(ref);
  const oid = (await git(cwd, ['rev-parse', '--verify', `${ref}^{commit}`])).trim();
  if (!/^[0-9a-f]{40,64}$/.test(oid)) throw new Error('Invalid commit ID returned by Git.');
  return oid;
}

/** True when the path exists, which is how an in-progress operation is detected. */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
