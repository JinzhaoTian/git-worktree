// src/core/git.ts
import { execFile } from "node:child_process";
import { access, realpath } from "node:fs/promises";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var READ_TIMEOUT_MS = 2e4;
var MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
function cleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
  env.GIT_TERMINAL_PROMPT = "0";
  env.LC_ALL = "C";
  return env;
}
async function git(cwd, args, timeout = READ_TIMEOUT_MS) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      timeout,
      maxBuffer: MAX_OUTPUT_BYTES,
      encoding: "utf8",
      windowsHide: true,
      env: cleanEnv()
    });
    return stdout;
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr || "") : "";
    throw new Error((stderr || (error instanceof Error ? error.message : String(error))).trim());
  }
}
async function repoRoot(input) {
  const path = await realpath(input);
  const root = (await git(path, ["rev-parse", "--show-toplevel"])).trim();
  if (!root) throw new Error("The selected path is not a non-bare Git worktree.");
  return realpath(root);
}
function assertRefName(ref) {
  if (!ref || ref.startsWith("-") || /[\x00-\x20\x7f]/.test(ref) || ref.includes("..") || ref.includes("@{")) {
    throw new Error("Invalid Git ref.");
  }
}
async function commitOid(cwd, ref) {
  assertRefName(ref);
  const oid = (await git(cwd, ["rev-parse", "--verify", `${ref}^{commit}`])).trim();
  if (!/^[0-9a-f]{40,64}$/.test(oid)) throw new Error("Invalid commit ID returned by Git.");
  return oid;
}
async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// src/core/format.ts
var FIELD = "";
var RECORD = "";

// src/core/worktrees.ts
import { realpath as realpath2 } from "node:fs/promises";
import { resolve } from "node:path";

// src/core/types.ts
var API_VERSION = 2;
var CAPABILITIES = ["commit-detail-v2", "uncommitted-v1", "operations-v1", "file-diff-v1"];

// src/core/worktrees.ts
function parseWorktrees(raw) {
  return raw.split("\0\0").filter(Boolean).map((block) => {
    const item = {
      path: "",
      head: "",
      branch: null,
      bare: false,
      detached: false,
      locked: null,
      prunable: null
    };
    for (const field of block.split("\0").filter(Boolean)) {
      const separator = field.indexOf(" ");
      const key = separator < 0 ? field : field.slice(0, separator);
      const value = separator < 0 ? "" : field.slice(separator + 1);
      switch (key) {
        case "worktree":
          item.path = value;
          break;
        case "HEAD":
          item.head = value;
          break;
        case "branch":
          item.branch = value.replace(/^refs\/heads\//, "");
          break;
        case "bare":
          item.bare = true;
          break;
        case "detached":
          item.detached = true;
          break;
        case "locked":
          item.locked = value || "locked";
          break;
        case "prunable":
          item.prunable = value || "prunable";
          break;
        default:
          break;
      }
    }
    return item;
  }).filter((item) => item.path);
}
function parseStatus(raw) {
  const entries = raw.split("\n").filter(Boolean);
  return { dirty: entries.length > 0, entries: entries.length };
}
async function listWorktrees(root) {
  return parseWorktrees(await git(root, ["worktree", "list", "--porcelain", "-z"]));
}
async function worktreeSummary(worktree) {
  if (worktree.bare || worktree.prunable) {
    return { ...worktree, status: null, subject: null, unborn: false, error: worktree.bare ? "bare" : "prunable" };
  }
  const unborn = /^0+$/.test(worktree.head);
  try {
    const [statusRaw, subjectRaw] = await Promise.all([
      git(worktree.path, ["status", "--porcelain", "--untracked-files=normal"]),
      unborn ? Promise.resolve("") : git(worktree.path, ["log", "-1", "--format=%s"])
    ]);
    return { ...worktree, status: parseStatus(statusRaw), subject: subjectRaw.trim() || null, unborn, error: null };
  } catch (error) {
    return {
      ...worktree,
      status: null,
      subject: null,
      unborn,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
function samePath(left, right) {
  const norm = (value) => resolve(value).replace(/[\\/]+$/, "").toLowerCase();
  return norm(left) === norm(right);
}
async function findWorktree(list, root, target) {
  if (!target) return list.find((worktree) => samePath(worktree.path, root));
  const candidates = [resolve(root, target), target];
  try {
    candidates.push(await realpath2(resolve(root, target)));
  } catch {
  }
  for (const candidate of candidates) {
    const found = list.find((worktree) => samePath(worktree.path, candidate));
    if (found) return found;
  }
  return void 0;
}
async function selectActiveWorktree(root, target) {
  const list = await listWorktrees(root);
  const wanted = await realpath2(resolve(root, target));
  for (const worktree of list) {
    if (!worktree.bare && !worktree.prunable && await realpath2(worktree.path) === wanted) return worktree;
  }
  throw new Error("The path is not an active worktree in the selected repository.");
}
async function worktreesPayload(root) {
  const list = await listWorktrees(root);
  const summaries = await Promise.all(list.map((worktree) => worktreeSummary(worktree)));
  const current = summaries.find((item) => samePath(item.path, root));
  return {
    apiVersion: API_VERSION,
    capabilities: [...CAPABILITIES],
    repo: { root, branch: current?.branch ?? null, head: current?.head ?? null },
    worktrees: summaries
  };
}

// src/core/graph.ts
function parseGraph(raw) {
  const nodes = raw.split(RECORD).map((record) => record.trim()).filter(Boolean).map((record) => {
    const [id, parents, author, authoredAt, subject] = record.split(FIELD);
    return {
      id: id ?? "",
      parents: parents ? parents.split(" ") : [],
      author: author ?? "",
      authoredAt: authoredAt ?? "",
      subject: subject ?? "",
      refs: []
    };
  });
  const present = new Set(nodes.map((node) => node.id));
  const edges = nodes.flatMap(
    (node) => node.parents.filter((parent) => present.has(parent)).map((parent) => ({ source: node.id, target: parent }))
  );
  return { nodes, edges };
}
async function refsFor(cwd) {
  const raw = await git(cwd, [
    "for-each-ref",
    "--format=%(refname)%09%(objectname)%09%(*objectname)%09%(HEAD)",
    "refs/heads",
    "refs/remotes",
    "refs/tags",
    "refs/stash"
  ]);
  return raw.split("\n").filter(Boolean).map((line) => {
    const [refname = "", object, peeled, headMark] = line.split("	");
    const kind = refname.startsWith("refs/tags/") ? "tag" : refname.startsWith("refs/remotes/") ? "remote" : refname.startsWith("refs/stash") ? "stash" : "branch";
    return {
      name: refname.replace(/^refs\/(heads|remotes|tags)\//, "").replace(/^refs\/stash$/, "stash"),
      full: refname,
      commit: peeled || object || "",
      kind,
      current: headMark === "*"
    };
  });
}
function mirrorsOf(matched, local) {
  if (local.kind !== "branch") return [];
  const mirrors = [];
  for (const ref of matched) {
    if (ref.kind !== "remote") continue;
    const slash = ref.name.indexOf("/");
    if (slash <= 0) continue;
    const branch = ref.name.slice(slash + 1);
    if (branch !== local.name) continue;
    mirrors.push({ name: ref.name.slice(0, slash), fullName: ref.name });
  }
  return mirrors;
}
async function graphPayload(root, query) {
  const target = query.worktree ?? null;
  const list = parseWorktrees(await git(root, ["worktree", "list", "--porcelain", "-z"]));
  const selected = await findWorktree(list, root, target);
  if (!selected) throw new Error("The path is not an active worktree in the selected repository.");
  const scope = query.scope || "all";
  const branch = query.branch ?? null;
  const includeRemote = query.includeRemote !== false;
  const requested = query.limit ?? Number.NaN;
  const skip = Math.max(query.skip ?? 0, 0);
  const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : query.defaultLimit, 1), 2e3);
  const unborn = /^0+$/.test(selected.head);
  const notHistory = ["--exclude=refs/codex/*", "--exclude=refs/stash"];
  const everything = includeRemote ? [...notHistory, "--all"] : ["--exclude=refs/remotes/*", ...notHistory, "--all"];
  const range = branch ? [branch] : scope === "head" ? ["HEAD"] : everything;
  const raw = unborn && scope === "head" ? "" : await git(selected.path, [
    "log",
    "--topo-order",
    "--date-order",
    `--max-count=${limit}`,
    `--skip=${skip}`,
    `--format=%H${FIELD}%P${FIELD}%an${FIELD}%aI${FIELD}%s${RECORD}`,
    ...range
  ]);
  const graph = parseGraph(raw);
  const refs = await refsFor(selected.path);
  refs.push({ name: "current worktree", full: "", commit: selected.head, kind: "worktree", current: false });
  const byCommit = /* @__PURE__ */ new Map();
  for (const ref of refs) {
    if (!ref.commit) continue;
    byCommit.set(ref.commit, [...byCommit.get(ref.commit) || [], ref]);
  }
  for (const node of graph.nodes) {
    const matched = byCommit.get(node.id) || [];
    const drawable = [
      ...matched.filter((ref) => ref.kind === "worktree"),
      ...matched.filter((ref) => ref.kind === "branch")
    ];
    node.refs = drawable.slice(0, 6).map((ref) => {
      const mirrors = includeRemote ? mirrorsOf(matched, ref) : [];
      return {
        name: ref.name,
        kind: ref.kind,
        current: ref.current,
        ...mirrors.length > 0 ? { linkedRemotes: mirrors } : {}
      };
    });
    node.refCount = drawable.length;
  }
  return {
    repo: root,
    worktree: selected.path,
    head: selected.head,
    branch: selected.branch,
    unborn,
    scope,
    branches: [...new Set(refs.filter((ref) => ref.kind === "branch").map((ref) => ref.name))].sort(),
    skip,
    nodes: graph.nodes,
    edges: graph.edges
  };
}

// src/core/diff.ts
import { readFile, stat } from "node:fs/promises";
import { resolve as resolve2 } from "node:path";
var NUMSTAT = /\t/;
var HUNK_HEADING = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;
var MAX_PATCH_BYTES = 512 * 1024;
var MAX_UNTRACKED_BYTES = 1024 * 1024;
var BINARY_SNIFF_BYTES = 8e3;
function parseNumstat(raw) {
  const files = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const [addText = "", delText = "", path] = line.split(NUMSTAT);
    if (path === void 0) continue;
    files.push({
      path,
      add: /^\d+$/.test(addText) ? Number(addText) : 0,
      del: /^\d+$/.test(delText) ? Number(delText) : 0,
      binary: addText === "-" || delText === "-",
      status: "M"
    });
  }
  return files;
}
function counts(addText, delText) {
  return {
    add: /^\d+$/.test(addText) ? Number(addText) : 0,
    del: /^\d+$/.test(delText) ? Number(delText) : 0,
    binary: addText === "-" || delText === "-"
  };
}
function parseNumstatZ(raw) {
  const parts = raw.split("\0");
  const files = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index].replace(/^[\r\n]+/, "");
    const columns = part.split(NUMSTAT);
    if (columns.length < 2) continue;
    const [addText = "", delText = "", path = ""] = columns;
    if (!/^\d+$|^-$/.test(addText) || !/^\d+$|^-$/.test(delText)) continue;
    let resolved = path;
    let from = null;
    if (!resolved) {
      from = parts[index + 1] || null;
      resolved = parts[index + 2] || "";
      index += 2;
    }
    if (!resolved) continue;
    const { add, del, binary } = counts(addText, delText);
    files.push({ path: resolved, add, del, binary, status: "M", from });
  }
  return files;
}
function assertFilePath(path) {
  if (!path || path.startsWith("-") || path.startsWith(":") || path.includes("\0")) {
    throw new Error("Invalid file path.");
  }
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
    throw new Error("A file path must be relative to the worktree.");
  }
  if (path.split(/[\\/]+/).includes("..")) {
    throw new Error("A file path must stay inside the worktree.");
  }
}
function parseUnifiedDiff(raw) {
  const hunks = [];
  let binary = false;
  let status = "modified";
  let hunk = null;
  let oldLine = 0;
  let newLine = 0;
  for (const line of raw.split("\n")) {
    const heading = HUNK_HEADING.exec(line);
    if (heading) {
      oldLine = Number(heading[1]);
      newLine = Number(heading[3]);
      hunk = {
        heading: line,
        oldStart: oldLine,
        oldCount: heading[2] === void 0 ? 1 : Number(heading[2]),
        newStart: newLine,
        newCount: heading[4] === void 0 ? 1 : Number(heading[4]),
        lines: []
      };
      hunks.push(hunk);
      continue;
    }
    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      binary = true;
      hunk = null;
      continue;
    }
    if (line.startsWith("new file mode")) {
      status = "added";
      continue;
    }
    if (line.startsWith("deleted file mode")) {
      status = "deleted";
      continue;
    }
    if (line.startsWith("rename from ") || line.startsWith("rename to ")) {
      status = "renamed";
      continue;
    }
    if (!hunk) continue;
    if (line.startsWith("\\")) continue;
    if (line.startsWith("+")) {
      hunk.lines.push({ kind: "add", text: line.slice(1), old: null, new: newLine });
      newLine += 1;
      continue;
    }
    if (line.startsWith("-")) {
      hunk.lines.push({ kind: "del", text: line.slice(1), old: oldLine, new: null });
      oldLine += 1;
      continue;
    }
    if (line.startsWith(" ")) {
      hunk.lines.push({ kind: "context", text: line.slice(1), old: oldLine, new: newLine });
      oldLine += 1;
      newLine += 1;
    }
  }
  return { hunks, binary, status };
}
function hunkTotals(hunks) {
  let add = 0;
  let del = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === "add") add += 1;
      else if (line.kind === "del") del += 1;
    }
  }
  return { add, del };
}
function patchPayload(path, oid, raw) {
  let text2 = raw;
  let truncated = false;
  if (raw.length > MAX_PATCH_BYTES) {
    const edge = raw.lastIndexOf("\n", MAX_PATCH_BYTES);
    text2 = raw.slice(0, edge < 0 ? MAX_PATCH_BYTES : edge);
    truncated = true;
  }
  const parsed = parseUnifiedDiff(text2);
  const { add, del } = hunkTotals(parsed.hunks);
  return {
    path,
    oid,
    status: parsed.status,
    binary: parsed.binary,
    add,
    del,
    hunks: parsed.hunks,
    truncated,
    note: null
  };
}
function looksBinary(buffer) {
  const end = Math.min(buffer.length, BINARY_SNIFF_BYTES);
  for (let index = 0; index < end; index += 1) if (buffer[index] === 0) return true;
  return false;
}
async function untrackedPayload(cwd, path) {
  const empty = {
    path,
    oid: null,
    status: "added",
    binary: false,
    add: 0,
    del: 0,
    hunks: [],
    truncated: false,
    note: null
  };
  const info = await stat(resolve2(cwd, path)).catch(() => null);
  if (!info || !info.isFile()) {
    return { ...empty, note: "This file is not on disk. It was removed, renamed, or ignored between reads." };
  }
  if (info.size > MAX_UNTRACKED_BYTES) {
    return { ...empty, truncated: true, note: "This file is too large to show." };
  }
  const buffer = await readFile(resolve2(cwd, path));
  if (looksBinary(buffer)) return { ...empty, binary: true };
  const text2 = buffer.toString("utf8");
  const body = text2.endsWith("\n") ? text2.slice(0, -1) : text2;
  const lines = body.split("\n");
  const numbered = lines.map((line, index) => ({
    kind: "add",
    // A CRLF file keeps its carriage return; the view strips it for display.
    text: line,
    old: null,
    new: index + 1
  }));
  return {
    ...empty,
    add: numbered.length,
    hunks: [{
      heading: `@@ -0,0 +1,${numbered.length} @@`,
      oldStart: 0,
      oldCount: 0,
      newStart: 1,
      newCount: numbered.length,
      lines: numbered
    }]
  };
}
async function fileDiffPayload(root, options) {
  const cwd = options.worktree ? resolve2(root, options.worktree) : root;
  const path = options.path;
  assertFilePath(path);
  const oid = options.oid || null;
  if (oid) {
    if (!/^[0-9a-f]{7,64}$/i.test(oid)) throw new Error("Invalid commit id.");
    const from = options.from ? [options.from] : [];
    if (options.from) assertFilePath(options.from);
    return patchPayload(path, oid, await git(cwd, ["show", "--no-color", "--format=", "--unified=3", oid, "--", path, ...from]));
  }
  let tracked;
  try {
    tracked = await git(cwd, ["diff", "HEAD", "--no-color", "--unified=3", "--", path]);
  } catch (error) {
    tracked = await git(cwd, ["diff", "--cached", "--no-color", "--unified=3", "--", path]).catch(() => {
      throw error;
    });
  }
  if (tracked.trim()) return patchPayload(path, null, tracked);
  return untrackedPayload(cwd, path);
}
async function diffPayload(root, worktree) {
  const cwd = worktree ? resolve2(root, worktree) : root;
  const [stat2, patch] = await Promise.all([
    git(cwd, ["diff", "HEAD", "--stat", "--no-color"]),
    git(cwd, ["diff", "HEAD", "--no-color", "--unified=1"])
  ]);
  return { path: cwd, stat: stat2, patch };
}
async function commitDetailPayload(root, oid) {
  if (!/^[0-9a-f]{7,64}$/i.test(oid)) throw new Error("Invalid commit id.");
  const raw = await git(root, [
    "show",
    "--no-color",
    "--numstat",
    "-z",
    `--format=%H${FIELD}%P${FIELD}%an${FIELD}%ae${FIELD}%cn${FIELD}%ce${FIELD}%aI${FIELD}%s${FIELD}%b${RECORD}`,
    oid
  ]);
  const separator = raw.indexOf(RECORD);
  const header = (separator < 0 ? raw : raw.slice(0, separator)).split(FIELD);
  const body = separator < 0 ? "" : raw.slice(separator + RECORD.length);
  const files = parseNumstatZ(body);
  return {
    oid,
    parents: header[1] ? header[1].split(" ").filter(Boolean) : [],
    author: { name: header[2] || "", email: header[3] || "" },
    committer: { name: header[4] || "", email: header[5] || "" },
    authoredAt: header[6] || "",
    subject: header[7] || "",
    body: (header[8] || "").trim(),
    files,
    summary: {
      changed: files.length,
      insertions: files.reduce((sum, file) => sum + file.add, 0),
      deletions: files.reduce((sum, file) => sum + file.del, 0)
    }
  };
}
async function uncommittedPayload(root, worktree) {
  const cwd = worktree ? resolve2(root, worktree) : root;
  const porcelain = await git(cwd, ["status", "--porcelain", "--untracked-files=all", "--no-renames"]);
  const entries = porcelain.split("\n").filter(Boolean);
  const untracked = entries.filter((line) => line.startsWith("??")).map((line) => line.slice(3));
  const trackedOnly = entries.filter((line) => !line.startsWith("??"));
  const unborn = trackedOnly.some((line) => line.startsWith("## No commits yet"));
  const diffArgs = unborn ? ["diff", "--numstat", "--no-color"] : ["diff", "HEAD", "--numstat", "--no-color"];
  let tracked = [];
  try {
    tracked = parseNumstat(await git(cwd, diffArgs));
  } catch {
    tracked = [];
  }
  const staged = parseNumstat(await git(cwd, ["diff", "--cached", "--numstat", "--no-color"]).catch(() => ""));
  const byPath = /* @__PURE__ */ new Map();
  for (const file of tracked) byPath.set(file.path, file);
  for (const file of staged) if (!byPath.has(file.path)) byPath.set(file.path, file);
  for (const path of untracked) {
    byPath.set(path, { path, add: 0, del: 0, binary: false, status: "A", untracked: true });
  }
  const files = [...byPath.values()];
  const generated = files.filter((file) => file.untracked).length;
  return {
    path: cwd,
    branch: (await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])).trim(),
    unborn,
    entries: entries.length,
    files,
    summary: {
      changed: files.length,
      insertions: files.reduce((sum, file) => sum + file.add, 0),
      deletions: files.reduce((sum, file) => sum + file.del, 0),
      generated
    }
  };
}

// src/core/operations.ts
import { isAbsolute, resolve as resolve3 } from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, realpath as realpath3 } from "node:fs/promises";
var PLAN_TTL_MS = 5 * 6e4;
var WRITE_TIMEOUT_MS = 12e4;
var IN_PROGRESS_MARKERS = ["rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "MERGE_HEAD", "REVERT_HEAD"];
var plans = /* @__PURE__ */ new Map();
async function isDirty(cwd) {
  const porcelain = await git(cwd, ["status", "--porcelain"]);
  return porcelain.split("\n").some((line) => line.length > 0);
}
async function requireReady(root, worktreePath) {
  const selected = await selectActiveWorktree(root, worktreePath);
  if (selected.bare || !selected.branch) throw new Error("A checked-out branch is required for this operation.");
  if (selected.locked || selected.prunable) throw new Error("This worktree is not available for history operations.");
  if (await isDirty(selected.path)) throw new Error("The worktree must be clean before a history operation.");
  for (const marker of IN_PROGRESS_MARKERS) {
    const markerPath = (await git(selected.path, ["rev-parse", "--git-path", marker])).trim();
    if (await pathExists(resolve3(selected.path, markerPath))) {
      throw new Error(`Git operation in progress (${marker}). Resolve it first.`);
    }
  }
  return selected;
}
function storePlan(plan) {
  const now = Date.now();
  for (const [id, old] of plans) if (now - old.issuedAt >= PLAN_TTL_MS) plans.delete(id);
  const saved = {
    ...plan,
    planId: randomUUID(),
    issuedAt: now,
    expiresAt: new Date(now + PLAN_TTL_MS).toISOString()
  };
  plans.set(saved.planId, saved);
  const { root: _root, issuedAt: _issuedAt, base: _base, ...publicPlan } = saved;
  return publicPlan;
}
async function createWorktree(root, path, branch, startPoint = "HEAD") {
  if (branch.startsWith("-")) throw new Error("Branch cannot start with '-'.");
  await git(root, ["check-ref-format", "--branch", branch]);
  const oid = await commitOid(root, startPoint);
  const target = isAbsolute(path) ? resolve3(path) : resolve3(root, path);
  await mkdir(resolve3(target, ".."), { recursive: true });
  await git(root, ["worktree", "add", "-b", branch, target, oid], WRITE_TIMEOUT_MS);
  return { created: true, path: await realpath3(target), branch, head: oid };
}
async function previewRebase(root, worktreePath, target) {
  const worktree = await requireReady(root, worktreePath);
  const targetCommit = await commitOid(worktree.path, target);
  const base = (await git(worktree.path, ["merge-base", worktree.head, targetCommit])).trim();
  const commits = (await git(worktree.path, ["rev-list", "--reverse", `${targetCommit}..${worktree.head}`])).trim().split("\n").filter(Boolean);
  const merges = (await git(worktree.path, ["rev-list", "--merges", `${base}..${worktree.head}`])).trim();
  const warnings = ["Rebase rewrites commit IDs. Conflicts may require manual resolution."];
  if (merges) warnings.push("This branch contains merge commits; default rebase may flatten them.");
  if (!commits.length) warnings.push("No commits need replaying.");
  return storePlan({
    operation: "rebase",
    root,
    worktreePath: worktree.path,
    branch: worktree.branch,
    head: worktree.head,
    target,
    targetCommit,
    base,
    commits,
    warnings
  });
}
async function previewCherryPick(root, worktreePath, commit) {
  const worktree = await requireReady(root, worktreePath);
  const targetCommit = await commitOid(worktree.path, commit);
  const parents = (await git(worktree.path, ["rev-list", "--parents", "-n", "1", targetCommit])).trim().split(" ").slice(1);
  if (parents.length > 1) throw new Error("Cherry-picking a merge commit requires a mainline; select a non-merge commit.");
  return storePlan({
    operation: "cherry-pick",
    root,
    worktreePath: worktree.path,
    branch: worktree.branch,
    head: worktree.head,
    target: commit,
    targetCommit,
    commits: [targetCommit],
    warnings: ["Cherry-pick creates a new commit. Conflicts may require manual resolution."]
  });
}
async function applyPlan(operation, planId, confirm) {
  if (!confirm) throw new Error("Set confirm=true after reviewing the preview.");
  const plan = plans.get(planId);
  if (!plan || plan.operation !== operation) throw new Error("Plan not found. Request a new preview.");
  plans.delete(planId);
  if (Date.now() - plan.issuedAt >= PLAN_TTL_MS) throw new Error("Plan expired. Request a new preview.");
  const worktree = await requireReady(plan.root, plan.worktreePath);
  if (worktree.head !== plan.head || worktree.branch !== plan.branch) {
    throw new Error("The worktree changed since preview. Request a new preview.");
  }
  if (await commitOid(worktree.path, plan.target) !== plan.targetCommit) {
    throw new Error("The target ref changed since preview. Request a new preview.");
  }
  const args = operation === "rebase" ? ["rebase", plan.targetCommit] : ["cherry-pick", plan.targetCommit];
  try {
    await git(worktree.path, args, WRITE_TIMEOUT_MS);
    return { applied: true, operation, worktreePath: worktree.path, head: await commitOid(worktree.path, "HEAD") };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const resume = operation === "rebase" ? "rebase" : "cherry-pick";
    throw new Error(`${detail}
Git may have stopped for conflicts in ${worktree.path}. Resolve them there with git ${resume} --continue or --abort.`);
  }
}

// src/index.ts
var ROUTE = "/git-worktree-graph/api";
var SESSION_WAIT_MS = 3e3;
var SESSION_POLL_MS = 120;
var DEFAULT_COMMIT_LIMIT = 120;
function settingsOf(config) {
  const limit = config.commitLimit;
  return {
    ctx: config.ctx,
    defaultRepo: typeof config.defaultRepo === "string" && config.defaultRepo ? config.defaultRepo : null,
    commitLimit: typeof limit === "number" && Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_COMMIT_LIMIT,
    sessionWaitMs: typeof config.sessionWaitMs === "number" && Number.isFinite(config.sessionWaitMs) ? config.sessionWaitMs : SESSION_WAIT_MS
  };
}
var wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
async function sessionCwd(ctx, sessionId, waitMs) {
  const deadline = Date.now() + waitMs;
  for (; ; ) {
    const sessions = ctx.get("sessions");
    const cwd = sessions ? sessions.get(sessionId)?.header?.cwd : void 0;
    if (cwd) return cwd;
    if (Date.now() >= deadline) return null;
    await wait(SESSION_POLL_MS);
  }
}
async function resolveRepo(query, settings) {
  const sessionId = query.get("session");
  let sessionMissing = false;
  const candidates = [query.get("repo")];
  if (typeof sessionId === "string" && sessionId) {
    const cwd = await sessionCwd(settings.ctx, sessionId, Math.max(settings.sessionWaitMs, 0));
    if (cwd) candidates.push(cwd);
    else sessionMissing = true;
  }
  if (!sessionMissing) candidates.push(settings.defaultRepo, process.cwd());
  const tried = [];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate) continue;
    try {
      return await repoRoot(candidate);
    } catch (error) {
      tried.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (sessionMissing) {
    throw new Error(
      `Session ${String(sessionId)} has not registered a working directory yet, and this panel only reads the workspace its Session sits in. Reopen the tab in a moment.`
    );
  }
  throw new Error(`No Git repository found. Tried \u2014 ${tried.join(" | ")}`);
}
function numeric(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value !== "string" || !value) return Number.NaN;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
function text(value) {
  return typeof value === "string" && value ? value : null;
}
async function worktreesPayload2(query, config) {
  return worktreesPayload(await resolveRepo(query, settingsOf(config)));
}
async function graphPayload2(query, config) {
  const settings = settingsOf(config);
  const root = await resolveRepo(query, settings);
  return graphPayload(root, {
    worktree: text(query.get("worktree")),
    scope: text(query.get("scope")),
    branch: text(query.get("branch")),
    // Remote-tracking history is opt-out: `remote=0` walks only what exists
    // locally. Anything else — including an older browser half that never sends
    // the parameter — keeps every ref, so the two halves stay interchangeable.
    includeRemote: query.get("remote") !== "0",
    limit: numeric(query.get("limit")),
    skip: numeric(query.get("skip")) || 0,
    defaultLimit: settings.commitLimit
  });
}
async function diffPayload2(query, config) {
  const root = await resolveRepo(query, settingsOf(config));
  return diffPayload(root, text(query.get("worktree")));
}
async function commitDetailPayload2(query, config) {
  const root = await resolveRepo(query, settingsOf(config));
  return commitDetailPayload(root, text(query.get("oid")) || "");
}
async function uncommittedPayload2(query, config) {
  const root = await resolveRepo(query, settingsOf(config));
  return uncommittedPayload(root, text(query.get("worktree")));
}
async function fileDiffPayload2(query, config) {
  const root = await resolveRepo(query, settingsOf(config));
  return fileDiffPayload(root, {
    worktree: text(query.get("worktree")),
    path: text(query.get("path")) || "",
    oid: text(query.get("oid")),
    // The path a rename moved the file away from, when the file list knew one.
    from: text(query.get("from"))
  });
}
var MAX_BODY_BYTES = 64 * 1024;
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store"
  });
  res.end(payload);
}
function sameOrigin(request) {
  const origin = request.headers.origin;
  if (typeof origin !== "string" || !origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}
async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body exceeds 64 KiB.");
    chunks.push(buffer);
  }
  if (size === 0) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object.");
  return parsed;
}
function mergedQuery(params, body) {
  return {
    get(key) {
      if (Object.hasOwn(body, key)) {
        const value = body[key];
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
      }
      return params.get(key);
    }
  };
}
function apply(ctx, config) {
  const settings = settingsOf({ ctx, ...config ?? {} });
  const handlers = {
    worktrees: worktreesPayload2,
    graph: graphPayload2,
    diff: diffPayload2,
    commit: commitDetailPayload2,
    uncommitted: uncommittedPayload2,
    "file-diff": fileDiffPayload2
  };
  const writers = {
    "worktree-create": async (query, hostConfig) => createWorktree(
      await resolveRepo(query, settingsOf(hostConfig)),
      text(query.get("path")) || "",
      text(query.get("branch")) || "",
      text(query.get("startPoint")) || "HEAD"
    ),
    "rebase-preview": async (query, hostConfig) => previewRebase(
      await resolveRepo(query, settingsOf(hostConfig)),
      text(query.get("worktree")) || "",
      text(query.get("target")) || ""
    ),
    "rebase-apply": async (query) => applyPlan("rebase", text(query.get("planId")) || "", query.get("confirm") === true || query.get("confirm") === "true"),
    "cherry-pick-preview": async (query, hostConfig) => previewCherryPick(
      await resolveRepo(query, settingsOf(hostConfig)),
      text(query.get("worktree")) || "",
      text(query.get("commit")) || ""
    ),
    "cherry-pick-apply": async (query) => applyPlan("cherry-pick", text(query.get("planId")) || "", query.get("confirm") === true || query.get("confirm") === "true")
  };
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: ROUTE,
    async handler(req, res) {
      const url = new URL(req.url || ROUTE, "http://127.0.0.1");
      const action = url.pathname.slice(ROUTE.length).replace(/^\/+/, "");
      try {
        if (req.method === "GET") {
          const run2 = handlers[action];
          if (!run2) {
            sendJson(res, 404, { ok: false, error: `Unknown action: ${action || "(none)"}` });
            return;
          }
          const data2 = await run2(url.searchParams, settings);
          sendJson(res, 200, { ok: true, data: data2 });
          return;
        }
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "Only GET and POST are served." });
          return;
        }
        if (!sameOrigin(req)) {
          sendJson(res, 403, { ok: false, error: "A write must come from this page." });
          return;
        }
        if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
          sendJson(res, 415, { ok: false, error: "A write must be sent as application/json." });
          return;
        }
        const run = writers[action];
        if (!run) {
          sendJson(res, 404, { ok: false, error: `Unknown write: ${action || "(none)"}` });
          return;
        }
        const body = await readBody(req);
        const data = await run(mergedQuery(url.searchParams, body), settings);
        sendJson(res, 200, { ok: true, data });
      } catch (error) {
        sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }), "git-worktree-graph: http route");
}
var inject = ["webServer"];
export {
  apply,
  commitDetailPayload2 as commitDetailPayload,
  diffPayload2 as diffPayload,
  fileDiffPayload2 as fileDiffPayload,
  graphPayload2 as graphPayload,
  inject,
  parseNumstat,
  parseNumstatZ,
  uncommittedPayload2 as uncommittedPayload,
  worktreesPayload2 as worktreesPayload
};
