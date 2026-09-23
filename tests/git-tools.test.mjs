import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listWorktrees } from "../dist/mcp/git.js";
import { getGraph } from "../dist/mcp/tools/log.js";
import { getStatus } from "../dist/mcp/tools/status.js";
import { previewCherryPick, previewRebase, applyPlan } from "../dist/mcp/tools/operations.js";
import { createServer, GRAPH_UI_URI } from "../dist/server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startBrowserServer } from "../dist/browser.js";

const run = promisify(execFile);

test("MCP exposes all requested tools and the graph UI resource", async () => {
  const server = createServer();
  const client = new Client({ name: "git-worktree-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = await client.listTools();
    assert.deepEqual(new Set(tools.tools.map((tool) => tool.name)), new Set([
      "git_worktree_list", "git_worktree_create", "git_status", "git_log_graph",
      "git_rebase_preview", "git_rebase_apply", "git_cherry_pick_preview", "git_cherry_pick_apply"
    ]));
    assert.equal(tools.tools.find((tool) => tool.name === "git_worktree_list")?._meta?.ui?.resourceUri, GRAPH_UI_URI);
    const resource = await client.readResource({ uri: GRAPH_UI_URI });
    assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app");
    assert.match(resource.contents[0].text, /id="root"/);
  } finally {
    await client.close();
    await server.close();
  }
});

test("compiled stdio entrypoint starts and serves tools", async () => {
  const client = new Client({ name: "stdio-smoke-test", version: "0.1.0" });
  const transport = new StdioClientTransport({ command: process.execPath, args: [new URL("../dist/server.js", import.meta.url).pathname] });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "git_worktree_list"));
  } finally {
    await client.close();
  }
});

test("loopback browser tab serves the graph and rejects unauthenticated calls", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "git-worktree-browser-"));
  let browser;
  try {
    await git(temporary, "init", "-b", "main");
    browser = await startBrowserServer({ repoPath: temporary });
    const url = new URL(browser.url);
    const origin = url.origin;
    const page = await fetch(browser.url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /ui-browser\.js/);

    const body = JSON.stringify({ name: "git_worktree_list", arguments: {} });
    const denied = await fetch(`${origin}/api/tool`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.equal(denied.status, 403);
    const wrongOrigin = await fetch(`${origin}/api/tool`, { method: "POST", headers: { "Content-Type": "application/json", "X-Session-Token": url.searchParams.get("session"), Origin: "https://example.com" }, body });
    assert.equal(wrongOrigin.status, 403);

    const call = async (name, args) => {
      const response = await fetch(`${origin}/api/tool`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": url.searchParams.get("session"), Origin: origin },
        body: JSON.stringify({ name, arguments: args })
      });
      assert.equal(response.status, 200);
      return (await response.json()).data;
    };
    const listed = await call("git_worktree_list", {});
    assert.equal(listed.worktrees.length, 1);
    const empty = await call("git_log_graph", { worktreePath: listed.worktrees[0].path });
    assert.equal(empty.nodes.length, 0);

    await git(temporary, "config", "user.name", "Test User");
    await git(temporary, "config", "user.email", "test@example.com");
    await writeFile(join(temporary, "README"), "first commit\n");
    await git(temporary, "add", "README");
    await git(temporary, "commit", "-m", "first");
    const graph = await call("git_log_graph", { worktreePath: listed.worktrees[0].path });
    assert.equal(graph.nodes.length, 1);
  } finally {
    if (browser) await browser.close();
    await rm(temporary, { recursive: true, force: true });
  }
});

async function git(cwd, ...args) {
  const { stdout } = await run("git", args, { cwd, encoding: "utf8" });
  return stdout.trim();
}

test("worktree graph and preview/apply history workflow", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "git-worktree-plugin-"));
  const repo = join(temporary, "repo");
  const feature = join(temporary, "feature");
  try {
    await mkdir(repo);
    await git(repo, "init", "-b", "main");
    await git(repo, "config", "user.name", "Test User");
    await git(repo, "config", "user.email", "test@example.com");
    await writeFile(join(repo, "base.txt"), "base\n");
    await git(repo, "add", "base.txt");
    await git(repo, "commit", "-m", "base");
    await git(repo, "branch", "feature");
    await writeFile(join(repo, "main.txt"), "main\n");
    await git(repo, "add", "main.txt");
    await git(repo, "commit", "-m", "main change");
    await git(repo, "worktree", "add", feature, "feature");
    await writeFile(join(feature, "feature.txt"), "feature\n");
    await git(feature, "add", "feature.txt");
    await git(feature, "commit", "-m", "feature change");
    const featureHead = await git(feature, "rev-parse", "HEAD");

    const listed = await listWorktrees(repo);
    assert.equal(listed.worktrees.length, 2);
    const featureCanonical = await realpath(feature);
    assert.ok(listed.worktrees.some((item) => item.path === featureCanonical && item.branch === "feature"), JSON.stringify(listed.worktrees));
    const mainGraph = await getGraph(repo, repo);
    const featureGraph = await getGraph(repo, feature);
    assert.notEqual(mainGraph.head, featureGraph.head);
    assert.ok(featureGraph.edges.length > 0);

    await writeFile(join(repo, "untracked.txt"), "dirty\n");
    assert.equal((await getStatus(repo, repo)).dirty, true);
    await assert.rejects(previewCherryPick(repo, repo, featureHead), /clean/);
    await rm(join(repo, "untracked.txt"));

    const beforePick = await git(repo, "rev-parse", "HEAD");
    const pickPlan = await previewCherryPick(repo, repo, featureHead);
    assert.equal(pickPlan.operation, "cherry-pick");
    assert.equal(await git(repo, "rev-parse", "HEAD"), beforePick);
    assert.ok(Date.parse(pickPlan.expiresAt) > Date.now());
    await assert.rejects(applyPlan("cherry-pick", pickPlan.planId, false), /confirm=true/);
    await applyPlan("cherry-pick", pickPlan.planId, true);
    assert.notEqual(await git(repo, "rev-parse", "HEAD"), beforePick);
    await assert.rejects(applyPlan("cherry-pick", pickPlan.planId, true), /Plan not found/);

    await writeFile(join(feature, "extra.txt"), "extra\n");
    await git(feature, "add", "extra.txt");
    await git(feature, "commit", "-m", "extra change");
    const beforeRebase = await git(feature, "rev-parse", "HEAD");
    const rebasePlan = await previewRebase(repo, feature, "main");
    assert.equal(await git(feature, "rev-parse", "HEAD"), beforeRebase);
    assert.ok(rebasePlan.commits.length >= 1);
    await applyPlan("rebase", rebasePlan.planId, true);
    assert.notEqual(await git(feature, "rev-parse", "HEAD"), beforeRebase);
    assert.equal(await git(feature, "merge-base", "HEAD", "main"), await git(repo, "rev-parse", "HEAD"));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
