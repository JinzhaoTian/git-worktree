import { useCallback, useEffect, useMemo, useState } from "react";
import { scaleOrdinal, schemeTableau10 } from "d3";
import type { CommitGraph, GitStatus, OperationPreview, Worktree } from "../shared/types.js";
import "./styles.css";

export type WorktreeList = { root: string; worktrees: Worktree[] };
export type ToolCall = <T>(name: string, args: Record<string, unknown>) => Promise<T>;
type Action = { operation: "rebase" | "cherry-pick"; commit: string };

function shortRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, "").replace(/^refs\/tags\//, "tag: ").replace(/^worktree:/, "WT: ");
}

function Graph({ graph, onContext }: { graph: CommitGraph; onContext: (event: React.MouseEvent, commit: string) => void }) {
  const layout = useMemo(() => {
    const laneById = new Map<string, number>();
    const rows = graph.nodes.map((node, index) => {
      const lane = laneById.get(node.id) ?? 0;
      node.parents.forEach((parent, parentIndex) => {
        if (!laneById.has(parent)) laneById.set(parent, parentIndex === 0 ? lane : lane + parentIndex);
      });
      return { id: node.id, lane, y: index * 62 + 31 };
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const maxLane = Math.max(0, ...rows.map((row) => row.lane));
    return { rows, byId, width: Math.min(138, Math.max(48, (maxLane + 1) * 18 + 28)) };
  }, [graph]);
  const color = useMemo(() => scaleOrdinal<number, string>(schemeTableau10), []);

  if (!graph.nodes.length) return <div className="empty">No commits found for this Worktree.</div>;
  return <div className="graph-scroll">
    <div className="graph-body" style={{ minHeight: graph.nodes.length * 62 }}>
      <svg className="dag" width={layout.width} height={graph.nodes.length * 62} aria-label="Commit DAG">
        {graph.edges.map((edge) => {
          const from = layout.byId.get(edge.source);
          const to = layout.byId.get(edge.target);
          if (!from || !to) return null;
          const x1 = 20 + from.lane * 18;
          const x2 = 20 + to.lane * 18;
          const mid = (from.y + to.y) / 2;
          return <path key={`${edge.source}-${edge.target}`} d={`M${x1},${from.y} C${x1},${mid} ${x2},${mid} ${x2},${to.y}`} stroke={color(from.lane)} fill="none" strokeWidth="2" />;
        })}
        {layout.rows.map((row) => <circle key={row.id} cx={20 + row.lane * 18} cy={row.y} r={graph.head === row.id ? 6 : 4.5} fill={color(row.lane)} stroke="var(--surface)" strokeWidth="2" />)}
      </svg>
      <div className="commit-list" style={{ marginLeft: layout.width }}>
        {graph.nodes.map((node) => <div className="commit" key={node.id} onContextMenu={(event) => onContext(event, node.id)} title={`${node.id}\n${node.author} · ${node.authoredAt}`}>
          <div className="subject">{node.subject || "(no subject)"}</div>
          <div className="commit-meta"><code>{node.id.slice(0, 8)}</code><span>{node.author}</span>{node.refs.filter((ref) => !ref.startsWith("worktree:")).map((ref) => <span className="ref" key={ref}>{shortRef(ref)}</span>)}</div>
        </div>)}
      </div>
    </div>
  </div>;
}

export function GraphApp({ call, initial, defaultRepoPath = "" }: { call: ToolCall; initial: WorktreeList | null; defaultRepoPath?: string }) {
  const [repoPath, setRepoPath] = useState(initial?.root || defaultRepoPath);
  const [worktrees, setWorktrees] = useState<Worktree[]>(initial?.worktrees || []);
  const [selected, setSelected] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, GitStatus>>({});
  const [graph, setGraph] = useState<CommitGraph | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; commit: string } | null>(null);
  const [preview, setPreview] = useState<OperationPreview | null>(null);
  const [newPath, setNewPath] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(async (root = repoPath) => {
    setBusy(true); setError("");
    try {
      const data = await call<WorktreeList>("git_worktree_list", { repoPath: root || undefined });
      setRepoPath(data.root); setWorktrees(data.worktrees);
      setSelected((current) => data.worktrees.some((item) => item.path === current) ? current : (data.worktrees.find((item) => !item.bare)?.path || null));
      const statusPairs = await Promise.all(data.worktrees.filter((item) => !item.bare && !item.prunable).map(async (item) => {
        try { return [item.path, await call<GitStatus>("git_status", { repoPath: data.root, worktreePath: item.path })] as const; }
        catch { return null; }
      }));
      setStatuses(Object.fromEntries(statusPairs.filter((item): item is readonly [string, GitStatus] => item !== null)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }, [call, repoPath]);

  useEffect(() => { if (initial) { setRepoPath(initial.root); setWorktrees(initial.worktrees); } }, [initial]);
  useEffect(() => { if (!worktrees.length) void refresh(); }, [worktrees.length, refresh]);
  useEffect(() => { if (!selected && worktrees.length) setSelected(worktrees.find((item) => !item.bare)?.path || null); }, [selected, worktrees]);
  useEffect(() => {
    if (!selected || !repoPath) return;
    let active = true;
    setGraph(null); setError("");
    void call<CommitGraph>("git_log_graph", { repoPath, worktreePath: selected, limit: 150 })
      .then((data) => { if (active) setGraph(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [call, repoPath, selected]);

  const chooseAction = async (action: Action) => {
    if (!selected) return;
    setMenu(null); setBusy(true); setError("");
    try {
      const name = action.operation === "rebase" ? "git_rebase_preview" : "git_cherry_pick_preview";
      setPreview(await call<OperationPreview>(name, { repoPath, worktreePath: selected, [action.operation === "rebase" ? "target" : "commit"]: action.commit }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const apply = async () => {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      await call(preview.operation === "rebase" ? "git_rebase_apply" : "git_cherry_pick_apply", { planId: preview.planId, confirm: true });
      setPreview(null);
      await refresh(repoPath);
      if (selected) setGraph(await call<CommitGraph>("git_log_graph", { repoPath, worktreePath: selected, limit: 150 }));
    } catch (cause) { setPreview(null); setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const create = async () => {
    setBusy(true); setError("");
    try {
      const created = await call<{ path: string }>("git_worktree_create", { repoPath, path: newPath, branch: newBranch, startPoint: "HEAD" });
      setShowCreate(false); setNewPath(""); setNewBranch("");
      await refresh(repoPath); setSelected(created.path);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  return <main onClick={() => menu && setMenu(null)}>
    <header><div><strong>Git Worktree Graph</strong><small>{repoPath || "Choose a repository"}</small></div><button onClick={() => void refresh()} disabled={busy} title="Refresh">↻</button></header>
    <section className="worktrees"><div className="section-title"><span>WORKTREES</span><button onClick={() => setShowCreate((value) => !value)} title="Create Worktree">＋</button></div>
      {showCreate && <form onSubmit={(event) => { event.preventDefault(); void create(); }} className="create-form"><input value={newPath} onChange={(event) => setNewPath(event.target.value)} placeholder="New Worktree path" required /><input value={newBranch} onChange={(event) => setNewBranch(event.target.value)} placeholder="New branch name" required /><button disabled={busy}>Create from HEAD</button></form>}
      {worktrees.map((item) => <button key={item.path} className={`worktree ${selected === item.path ? "active" : ""}`} disabled={item.bare || !!item.prunable} onClick={() => setSelected(item.path)}>
        <span className="worktree-main"><span className="branch">{item.branch || (item.bare ? "bare" : "detached")}</span><span className={`dot ${statuses[item.path] ? (statuses[item.path].dirty ? "dirty" : "clean") : "unknown"}`} title={statuses[item.path] ? (statuses[item.path].dirty ? "Dirty" : "Clean") : "Status unavailable"} /></span>
        <span className="worktree-path">{item.path}</span><span className="worktree-head">{item.head.slice(0, 8)}{item.locked ? " · locked" : ""}</span>
      </button>)}
    </section>
    <section className="history"><div className="section-title"><span>COMMIT HISTORY</span><small>{graph?.branch || ""}</small></div>
      {error && <div className="error" role="alert">{error}</div>}
      {graph ? <Graph graph={graph} onContext={(event, commit) => { event.preventDefault(); setMenu({ x: Math.min(event.clientX, window.innerWidth - 180), y: Math.min(event.clientY, window.innerHeight - 88), commit }); }} /> : <div className="empty">{busy ? "Loading…" : selected ? "Loading commits…" : "Select a Worktree"}</div>}
    </section>
    {menu && <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}><button onClick={() => void chooseAction({ operation: "rebase", commit: menu.commit })}>Rebase onto commit</button><button onClick={() => void chooseAction({ operation: "cherry-pick", commit: menu.commit })}>Cherry-pick commit</button></div>}
    {preview && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label="Confirm Git operation"><h2>Confirm {preview.operation}</h2><p>Worktree <code>{preview.worktreePath}</code></p><p>Branch <strong>{preview.branch}</strong> at <code>{preview.head.slice(0, 8)}</code></p><p>Target <code>{preview.targetCommit.slice(0, 8)}</code></p><p>{preview.commits.length} commit{preview.commits.length === 1 ? "" : "s"} in preview · expires {new Date(preview.expiresAt).toLocaleTimeString()}</p><details><summary>Commits in plan</summary><ol className="preview-commits">{preview.commits.map((commit) => <li key={commit}><code title={commit}>{commit.slice(0, 12)}</code></li>)}</ol></details>{preview.warnings.map((warning) => <p className="warning" key={warning}>{warning}</p>)}<div className="modal-actions"><button onClick={() => setPreview(null)}>Cancel</button><button className="danger" disabled={busy} onClick={() => void apply()}>Apply {preview.operation}</button></div></div></div>}
  </main>;
}
