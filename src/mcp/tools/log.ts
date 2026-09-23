import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CommitGraph, CommitNode } from "../../shared/types.js";
import { failure, git, result, selectedWorktree } from "../git.js";

const FIELD = "\x1f";
const RECORD = "\x1e";

export async function getGraph(repoPath: string | undefined, worktreePath: string, limit = 150): Promise<CommitGraph> {
  const selected = await selectedWorktree(repoPath, worktreePath);
  const unborn = /^0+$/.test(selected.head);
  const raw = unborn ? "" : await git(selected.path, [
    "log", "HEAD", "--topo-order", `--max-count=${limit}`,
    "--format=%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1e"
  ]);
  const nodes: CommitNode[] = raw.split(RECORD).map((record) => record.trim()).filter(Boolean).map((record) => {
    const [id, parents, author, authoredAt, subject] = record.split(FIELD);
    return { id, parents: parents ? parents.split(" ") : [], author, authoredAt, subject, refs: [] };
  });

  const refsRaw = await git(selected.path, ["for-each-ref", "--format=%(refname)%09%(objectname)%09%(*objectname)", "refs/heads", "refs/tags"]);
  const refs: CommitGraph["refs"] = refsRaw.split("\n").filter(Boolean).map((line) => {
    const [name, object, peeled] = line.split("\t");
    return { name, commit: peeled || object, kind: name.startsWith("refs/tags/") ? "tag" as const : "branch" as const };
  });
  refs.push({ name: `worktree:${selected.path}`, commit: selected.head, kind: "worktree" });
  const refsByCommit = new Map<string, string[]>();
  for (const ref of refs) refsByCommit.set(ref.commit, [...(refsByCommit.get(ref.commit) || []), ref.name]);
  for (const node of nodes) node.refs = refsByCommit.get(node.id) || [];
  const present = new Set(nodes.map((node) => node.id));
  const edges = nodes.flatMap((node) => node.parents.filter((parent) => present.has(parent)).map((parent) => ({ source: node.id, target: parent })));
  return { worktreePath: selected.path, head: selected.head, branch: selected.branch, nodes, edges, refs };
}

export function registerLogTool(server: McpServer): void {
  server.registerTool("git_log_graph", {
    title: "Get commit DAG",
    description: "Get the selected worktree HEAD ancestry as nodes, parent edges, and branch/tag/worktree refs for graph rendering.",
    inputSchema: { repoPath: z.string().optional(), worktreePath: z.string().min(1), limit: z.number().int().min(1).max(500).default(150) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ repoPath, worktreePath, limit }) => {
    try { return result(await getGraph(repoPath, worktreePath, limit)); }
    catch (error) { return failure(error); }
  });
}
