/**
 * The loopback browser-tab entry point.
 *
 * For a Codex task tab the app is opened by URL rather than through the MCP
 * bridge, so the same shared view reads over this server's own `/api/tool`
 * route. The token is taken from the URL once and then remembered for reloads.
 */
import { useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { WorktreeTab, configureView } from "./worktree.js";
import { mcpTransport } from "./transport.js";
import "./styles.css";

const query = new URLSearchParams(window.location.search);
const suppliedToken = query.get("session");
let savedToken: string | null = null;
try { savedToken = window.sessionStorage.getItem("git-worktree-graph-session"); } catch { /* Storage can be disabled by the host. */ }
if (suppliedToken) {
  try {
    window.sessionStorage.setItem("git-worktree-graph-session", suppliedToken);
    window.history.replaceState(null, "", window.location.pathname);
  } catch { /* Keep the URL token for this tab when storage is unavailable. */ }
}
const token = suppliedToken || savedToken;

function Root() {
  const call = useCallback(async <T,>(name: string, args: Record<string, unknown>): Promise<T> => {
    const response = await fetch("/api/tool", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Token": token || "" },
      body: JSON.stringify({ name, arguments: args })
    });
    const payload = await response.json() as { data?: T; error?: string };
    if (!response.ok || payload.error) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload.data as T;
  }, []);
  // Installed during render, not in an effect: the view reads once it mounts,
  // and a child's effects run before this component's.
  const transport = useMemo(() => mcpTransport(call), [call]);
  configureView(transport);

  if (!token) return <div className="dsh-gw"><div className="dsh-gw-error">This Git Graph tab has no session. Open it again from Codex.</div></div>;
  return <WorktreeTab sessionId="codex" />;
}

createRoot(document.getElementById("root")!).render(<Root />);
