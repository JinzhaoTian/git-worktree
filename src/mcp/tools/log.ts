/**
 * The commit graph tool.
 *
 * Answers with the shared `GraphPayload` — the same shape the DSH route serves —
 * so the graph read is described once. `git_log_graph` keeps its name and its
 * `worktreePath` argument for callers that already use it.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphPayload } from "../../core/types.js";
import { failure, result } from "../git.js";
import { graphPayload, type GraphParams } from "../payloads.js";

/** Read one page of a worktree's graph. */
export async function getGraph(repoPath: string | undefined, worktreePath: string, limit = 150): Promise<GraphPayload> {
  return graphPayload({ repoPath, worktreePath, limit });
}

export function registerLogTool(server: McpServer): void {
  server.registerTool("git_log_graph", {
    title: "Get commit DAG",
    description: "Get a worktree's commit graph as nodes, parent edges and the refs each row draws. Pass scope=all to walk every branch, or scope=head for HEAD ancestry only.",
    inputSchema: {
      repoPath: z.string().optional(),
      worktreePath: z.string().optional(),
      scope: z.enum(["all", "head"]).default("all"),
      branch: z.string().optional(),
      includeRemote: z.boolean().default(true),
      limit: z.number().int().min(1).max(2000).default(150),
      skip: z.number().int().min(0).default(0),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async (params: GraphParams) => {
    try {
      return result(await graphPayload({
        repoPath: params.repoPath,
        worktreePath: params.worktreePath,
        scope: params.scope,
        branch: params.branch,
        includeRemote: params.includeRemote,
        limit: params.limit,
        skip: params.skip,
      }));
    } catch (error) { return failure(error); }
  });
}
