import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import type { Worktree } from "../shared/types.js";

const execFileAsync = promisify(execFile);
const READ_TIMEOUT = 20_000;

export async function git(cwd: string, args: string[], timeout = READ_TIMEOUT): Promise<string> {
  try {
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
    env.GIT_TERMINAL_PROMPT = "0";
    env.LC_ALL = "C";
    const { stdout } = await execFileAsync("git", args, {
      cwd, timeout, maxBuffer: 16 * 1024 * 1024,
      encoding: "utf8", windowsHide: true,
      env
    });
    return stdout;
  } catch (error) {
    const e = error as Error & { stderr?: string };
    throw new Error((e.stderr || e.message).trim());
  }
}

export function repoInput(repoPath?: string): string {
  return resolve(repoPath || process.env.GIT_WORKTREE_REPO || process.cwd());
}

export async function repoRoot(repoPath?: string): Promise<string> {
  const input = await realpath(repoInput(repoPath));
  const root = (await git(input, ["rev-parse", "--show-toplevel"])).trim();
  if (!root) throw new Error("The selected path is not a non-bare Git worktree.");
  return realpath(root);
}

export function parseWorktrees(raw: string): Worktree[] {
  return raw.split("\0\0").filter(Boolean).map((block) => {
    const fields = block.split("\0").filter(Boolean);
    const item: Worktree = { path: "", head: "", branch: null, bare: false, detached: false, locked: null, prunable: null };
    for (const field of fields) {
      const separator = field.indexOf(" ");
      const key = separator < 0 ? field : field.slice(0, separator);
      const value = separator < 0 ? "" : field.slice(separator + 1);
      switch (key) {
        case "worktree": item.path = value; break;
        case "HEAD": item.head = value; break;
        case "branch": item.branch = value.replace(/^refs\/heads\//, ""); break;
        case "bare": item.bare = true; break;
        case "detached": item.detached = true; break;
        case "locked": item.locked = value || "locked"; break;
        case "prunable": item.prunable = value || "prunable"; break;
      }
    }
    return item;
  }).filter((item) => item.path);
}

export async function listWorktrees(repoPath?: string): Promise<{ root: string; worktrees: Worktree[] }> {
  const root = await repoRoot(repoPath);
  return { root, worktrees: parseWorktrees(await git(root, ["worktree", "list", "--porcelain", "-z"])) };
}

export async function selectedWorktree(repoPath: string | undefined, worktreePath: string): Promise<Worktree> {
  const { root, worktrees } = await listWorktrees(repoPath);
  const selected = await realpath(resolve(root, worktreePath));
  for (const worktree of worktrees) {
    if (!worktree.bare && !worktree.prunable && await realpath(worktree.path) === selected) return worktree;
  }
  throw new Error("The path is not an active worktree in the selected repository.");
}

export function assertRefName(ref: string): void {
  if (!ref || ref.startsWith("-") || /[\x00-\x20\x7f]/.test(ref) || ref.includes("..") || ref.includes("@{")) {
    throw new Error("Invalid Git ref.");
  }
}

export async function commitOid(cwd: string, ref: string): Promise<string> {
  assertRefName(ref);
  const oid = (await git(cwd, ["rev-parse", "--verify", `${ref}^{commit}`])).trim();
  if (!/^[0-9a-f]{40,64}$/.test(oid)) throw new Error("Invalid commit ID returned by Git.");
  return oid;
}

export function result<T>(value: T) {
  return { structuredContent: value as Record<string, unknown>, content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

export function failure(error: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] };
}
