/**
 * Commit detail and uncommitted-change tools.
 *
 * These are the reads the graph's expanded rows make: one commit's metadata and
 * changed files, and the working tree's own changes as structured file stats.
 * Both answer with the shared payloads, so the Codex app and the DSH panel read
 * the same fields.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { failure, result } from "../git.js";
import { commitDetailPayload, diffPayload, uncommittedPayload } from "../payloads.js";

export function registerHistoryTools(server: McpServer): void {
  server.registerTool("git_commit_detail", {
    title: "Get commit detail",
    description: "Return one commit's identity, message and changed-file stats for an expanded graph row.",
    inputSchema: { repoPath: z.string().optional(), oid: z.string().min(7).max(64) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ repoPath, oid }) => {
    try { return result(await commitDetailPayload(repoPath, oid)); }
    catch (error) { return failure(error); }
  });

  server.registerTool("git_uncommitted", {
    title: "Get uncommitted changes",
    description: "Return the working tree's tracked, staged and untracked changes as file stats for the graph's first row.",
    inputSchema: { repoPath: z.string().optional(), worktreePath: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ repoPath, worktreePath }) => {
    try { return result(await uncommittedPayload(repoPath, worktreePath)); }
    catch (error) { return failure(error); }
  });

  server.registerTool("git_diff", {
    title: "Get working tree diff",
    description: "Return the working tree's changes as a stat plus a patch, for a host or view that cannot read the structured file list.",
    inputSchema: { repoPath: z.string().optional(), worktreePath: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ repoPath, worktreePath }) => {
    try { return result(await diffPayload(repoPath, worktreePath)); }
    catch (error) { return failure(error); }
  });
}
