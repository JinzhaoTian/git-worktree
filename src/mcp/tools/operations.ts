import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OperationPreview } from "../../shared/types.js";
import { commitOid, failure, git, result, selectedWorktree } from "../git.js";
import { getStatus } from "./status.js";

const TTL_MS = 5 * 60_000;
type Plan = OperationPreview & { repoPath?: string; issuedAt: number; base?: string };
const plans = new Map<string, Plan>();

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function requireReady(repoPath: string | undefined, worktreePath: string) {
  const selected = await selectedWorktree(repoPath, worktreePath);
  if (selected.bare || !selected.branch) throw new Error("A checked-out branch is required for this operation.");
  if (selected.locked || selected.prunable) throw new Error("This worktree is not available for history operations.");
  const status = await getStatus(repoPath, selected.path);
  if (status.dirty) throw new Error("The worktree must be clean before a history operation.");
  for (const marker of ["rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "MERGE_HEAD", "REVERT_HEAD"]) {
    const markerPath = (await git(selected.path, ["rev-parse", "--git-path", marker])).trim();
    if (await exists(resolve(selected.path, markerPath))) throw new Error(`Git operation in progress (${marker}). Resolve it first.`);
  }
  return selected;
}

function storePlan(plan: Omit<Plan, "planId" | "issuedAt" | "expiresAt">): OperationPreview {
  const now = Date.now();
  for (const [id, old] of plans) if (now - old.issuedAt >= TTL_MS) plans.delete(id);
  const saved: Plan = { ...plan, planId: randomUUID(), issuedAt: now, expiresAt: new Date(now + TTL_MS).toISOString() };
  plans.set(saved.planId, saved);
  const { repoPath: _repoPath, issuedAt: _issuedAt, base: _base, ...publicPlan } = saved;
  return publicPlan;
}

export async function previewRebase(repoPath: string | undefined, worktreePath: string, target: string): Promise<OperationPreview> {
  const worktree = await requireReady(repoPath, worktreePath);
  const targetCommit = await commitOid(worktree.path, target);
  const base = (await git(worktree.path, ["merge-base", worktree.head, targetCommit])).trim();
  const commits = (await git(worktree.path, ["rev-list", "--reverse", `${targetCommit}..${worktree.head}`])).trim().split("\n").filter(Boolean);
  const merges = (await git(worktree.path, ["rev-list", "--merges", `${base}..${worktree.head}`])).trim();
  const warnings = ["Rebase rewrites commit IDs. Conflicts may require manual resolution."];
  if (merges) warnings.push("This branch contains merge commits; default rebase may flatten them.");
  if (!commits.length) warnings.push("No commits need replaying.");
  return storePlan({ operation: "rebase", repoPath, worktreePath: worktree.path, branch: worktree.branch!, head: worktree.head, target, targetCommit, base, commits, warnings });
}

export async function previewCherryPick(repoPath: string | undefined, worktreePath: string, commit: string): Promise<OperationPreview> {
  const worktree = await requireReady(repoPath, worktreePath);
  const targetCommit = await commitOid(worktree.path, commit);
  const parents = (await git(worktree.path, ["rev-list", "--parents", "-n", "1", targetCommit])).trim().split(" ").slice(1);
  if (parents.length > 1) throw new Error("Cherry-picking a merge commit requires a mainline; select a non-merge commit.");
  return storePlan({ operation: "cherry-pick", repoPath, worktreePath: worktree.path, branch: worktree.branch!, head: worktree.head, target: commit, targetCommit, commits: [targetCommit], warnings: ["Cherry-pick creates a new commit. Conflicts may require manual resolution."] });
}

export async function applyPlan(operation: "rebase" | "cherry-pick", planId: string, confirm: boolean) {
  if (!confirm) throw new Error("Set confirm=true after reviewing the preview.");
  const plan = plans.get(planId);
  if (!plan || plan.operation !== operation) throw new Error("Plan not found. Request a new preview.");
  plans.delete(planId); // A plan can only be attempted once, including failures.
  if (Date.now() - plan.issuedAt >= TTL_MS) throw new Error("Plan expired. Request a new preview.");
  const worktree = await requireReady(plan.repoPath, plan.worktreePath);
  if (worktree.head !== plan.head || worktree.branch !== plan.branch) throw new Error("The worktree changed since preview. Request a new preview.");
  if (await commitOid(worktree.path, plan.target) !== plan.targetCommit) throw new Error("The target ref changed since preview. Request a new preview.");
  const args = operation === "rebase" ? ["rebase", plan.targetCommit] : ["cherry-pick", plan.targetCommit];
  try {
    await git(worktree.path, args, 120_000);
    return { applied: true, operation, worktreePath: worktree.path, head: await commitOid(worktree.path, "HEAD") };
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nGit may have stopped for conflicts in ${worktree.path}. Resolve them there with git ${operation === "rebase" ? "rebase" : "cherry-pick"} --continue or --abort.`);
  }
}

export function registerOperationTools(server: McpServer): void {
  server.registerTool("git_rebase_preview", {
    title: "Preview rebase",
    description: "Preview rebasing the selected clean worktree branch onto target. Returns an expiring planId; does not change Git state.",
    inputSchema: { repoPath: z.string().optional(), worktreePath: z.string().min(1), target: z.string().min(1) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ repoPath, worktreePath, target }) => {
    try { return result(await previewRebase(repoPath, worktreePath, target)); }
    catch (error) { return failure(error); }
  });

  server.registerTool("git_rebase_apply", {
    title: "Apply previewed rebase",
    description: "Apply a rebase only with a valid unexpired planId from git_rebase_preview and explicit confirm=true.",
    inputSchema: { planId: z.string().uuid(), confirm: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
  }, async ({ planId, confirm }) => {
    try { return result(await applyPlan("rebase", planId, confirm)); }
    catch (error) { return failure(error); }
  });

  server.registerTool("git_cherry_pick_preview", {
    title: "Preview cherry-pick",
    description: "Preview cherry-picking one non-merge commit into a clean worktree. Returns an expiring planId; does not change Git state.",
    inputSchema: { repoPath: z.string().optional(), worktreePath: z.string().min(1), commit: z.string().min(1) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ repoPath, worktreePath, commit }) => {
    try { return result(await previewCherryPick(repoPath, worktreePath, commit)); }
    catch (error) { return failure(error); }
  });

  server.registerTool("git_cherry_pick_apply", {
    title: "Apply previewed cherry-pick",
    description: "Apply a cherry-pick only with a valid unexpired planId from git_cherry_pick_preview and explicit confirm=true.",
    inputSchema: { planId: z.string().uuid(), confirm: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
  }, async ({ planId, confirm }) => {
    try { return result(await applyPlan("cherry-pick", planId, confirm)); }
    catch (error) { return failure(error); }
  });
}
