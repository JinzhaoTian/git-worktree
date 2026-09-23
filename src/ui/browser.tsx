import { useCallback } from "react";
import { createRoot } from "react-dom/client";
import { GraphApp } from "./GraphApp.js";

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
  if (!token) return <div className="error">This Git Graph tab has no session. Open it again from Codex.</div>;
  return <GraphApp call={call} initial={null} />;
}

createRoot(document.getElementById("root")!).render(<Root />);
