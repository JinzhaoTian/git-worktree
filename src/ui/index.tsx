import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GraphApp, type WorktreeList } from "./GraphApp.js";

function unpack<T>(response: CallToolResult): T {
  if (response.isError) throw new Error(response.content.find((part) => part.type === "text")?.text || "Git tool failed");
  if (response.structuredContent) return response.structuredContent as T;
  const text = response.content.find((part) => part.type === "text")?.text;
  if (!text) throw new Error("The Git tool returned no data.");
  return JSON.parse(text) as T;
}

function Root() {
  const [initial, setInitial] = useState<WorktreeList | null>(null);
  const { app, error } = useApp({
    appInfo: { name: "Git Worktree Graph", version: "0.1.0" }, capabilities: {},
    onAppCreated: (instance) => {
      instance.ontoolresult = (response) => { try { setInitial(unpack<WorktreeList>(response)); } catch { /* Other tool results are fetched by the view. */ } };
    }
  });
  const call = useCallback(async <T,>(name: string, args: Record<string, unknown>): Promise<T> => {
    if (!app) throw new Error("MCP App is not connected.");
    return unpack<T>(await app.callServerTool({ name, arguments: args }));
  }, [app]);
  if (error) return <div className="error">{error.message}</div>;
  if (!app) return <div className="empty">Connecting to Codex…</div>;
  return <GraphApp call={call} initial={initial} />;
}

createRoot(document.getElementById("root")!).render(<Root />);
