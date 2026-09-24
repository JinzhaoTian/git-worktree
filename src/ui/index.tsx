/**
 * The Codex MCP App entry point.
 *
 * The panel is the shared view from `src/ui/worktree.ts`; this file only
 * supplies what makes it a Codex app — the MCP App connection and the tool call
 * the view reads through — plus the page stylesheet that defines the theme
 * tokens the view's own styles are written against.
 */
import { useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { WorktreeTab, configureView } from "./worktree.js";
import { mcpTransport } from "./transport.js";
import "./styles.css";

function unpack<T>(response: CallToolResult): T {
  if (response.isError) throw new Error(response.content.find((part) => part.type === "text")?.text || "Git tool failed");
  if (response.structuredContent) return response.structuredContent as T;
  const text = response.content.find((part) => part.type === "text")?.text;
  if (!text) throw new Error("The Git tool returned no data.");
  return JSON.parse(text) as T;
}

function Root() {
  const { app, error } = useApp({
    appInfo: { name: "Git Worktree Graph", version: "0.1.0" }, capabilities: {},
  });
  const call = useCallback(async <T,>(name: string, args: Record<string, unknown>): Promise<T> => {
    if (!app) throw new Error("MCP App is not connected.");
    return unpack<T>(await app.callServerTool({ name, arguments: args }));
  }, [app]);
  // The view reads once it mounts, and a child's effects run before this
  // component's, so the transport is installed during render rather than in an
  // effect: an effect would leave the view's first read without one.
  const transport = useMemo(() => (app ? mcpTransport(call) : null), [app, call]);
  if (transport) configureView(transport);

  if (error) return <div className="dsh-gw"><div className="dsh-gw-error">{error.message}</div></div>;
  if (!transport) return <div className="dsh-gw"><div className="dsh-gw-msg">Connecting to Codex…</div></div>;
  return <WorktreeTab sessionId="codex" />;
}

createRoot(document.getElementById("root")!).render(<Root />);
