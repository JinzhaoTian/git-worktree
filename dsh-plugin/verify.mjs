/**
 * Pre-install checks for the DSH Git Worktree bundle.
 *
 * Run with:  node dsh-plugin/verify.mjs
 *
 * It parses both plugin halves, checks the manifest and patch the installer
 * reads, and confirms every file the manifest points at exists. It never
 * installs anything and never touches the network.
 */
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const failures = [];
const notes = [];

function check(condition, message) {
  if (condition) notes.push(`  ok   ${message}`);
  else failures.push(message);
}

/** Parse a module without running any of it, so a syntax error is caught here. */
async function checkSyntax(relative) {
  const path = join(here, relative);
  const source = await readFile(path, 'utf8');
  if (typeof vm.SourceTextModule === 'function') {
    // Compilation only: constructing a module never evaluates it.
    try {
      new vm.SourceTextModule(source, { identifier: path });
      check(true, `${relative} parses`);
    } catch (error) {
      check(false, `${relative} failed to parse: ${error.message}`);
    }
    return source;
  }
  // Without --experimental-vm-modules the only ESM-aware parser is a child
  // process: `--check` compiles the file and runs nothing.
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.error) {
    check(false, `${relative} could not be checked: ${result.error.message}`);
  } else if (result.status === 0) {
    check(true, `${relative} parses`);
  } else {
    const detail = String(result.stderr || '').split('\n').filter(Boolean).slice(0, 3).join(' ');
    check(false, `${relative} failed to parse: ${detail}`);
  }
  return source;
}

const manifest = JSON.parse(await readFile(join(here, 'package.json'), 'utf8'));
check(manifest.name === '@local/dsh-git-worktree', `manifest name is ${manifest.name}`);
check(manifest.type === 'module', 'manifest declares ES modules');
check(manifest.exports?.['.'] === './index.js', 'manifest exports the host half');
check(manifest.exports?.['./client'] === './client.js', 'manifest exports the browser half');
check(Boolean(manifest.dsh?.bundle?.patch), 'manifest declares a bundle patch');
check(manifest.dsh?.client?.platform === 'web', 'browser half targets the web platform');
const injectList = manifest.dsh?.client?.inject ?? [];
check(
  injectList.includes('@deepseek-ai/dsh-client-ui-sidebar-right'),
  'browser half loads after the right-sidebar package',
);

const patchPath = resolve(here, manifest.dsh.bundle.patch);
const patch = await readFile(patchPath, 'utf8');
check(patch.includes('insert:'), 'patch inserts a row');
check(patch.includes(manifest.name), 'patch row names this package');

await checkSyntax('index.js');
await checkSyntax('client.js');

const host = await readFile(join(here, 'index.js'), 'utf8');
check(host.includes("export function apply"), 'host half exports apply');
check(host.includes("export const inject = ['webServer']"), 'host half injects the web server');
check(host.includes('ctx.webServer.register'), 'host half registers its HTTP route');
// Only a bare `exec(` is a shell call; `/(\d+)/.exec(x)` is RegExp.exec.
check(!/(^|[^.\w])exec\(/.test(host), 'host half never calls the shell exec');
check(host.includes('execFileAsync'), 'host half uses execFile with argument arrays');

const client = await readFile(join(here, 'client.js'), 'utf8');
check(client.includes('__ModuleLoader__.load'), 'browser half registers a client module');
check(client.includes('ctx.sidebarRightTabs.register'), 'browser half registers a tab type');
check(client.includes("'sidebar.right.pane.tab'"), 'browser half registers the tab body');
check(client.includes("'sidebar.right.pane.tab.title'"), 'browser half registers the tab title');
check(!client.includes('dsh-client-ui-primitives'), 'browser half imports no Harness client package');
check(!client.includes('<iframe'), 'browser half renders no iframe');
// The host parses the action out of the path; a client that sends it as a query
// parameter gets a 404 for every read, which is exactly what happened once.
check(
  client.includes('`${API}/${action}`') || client.includes("API + '/' + action"),
  'browser half sends the action as a path segment, matching the host route',
);
check(
  !client.includes("searchParams.set('action'"),
  'browser half does not pass the action as a query parameter',
);
// The tab follows the current workspace only because the session travels with
// every read and the Host resolves that session's working directory.
check(client.includes("searchParams.set('session'"), 'browser half sends the session with each read');
check(host.includes("query.get('session')"), 'host half resolves the session working directory');
check(host.includes("get('sessions')"), 'host half reads the session store to find that directory');
check(
  !/status: 'ready'[^}]*graph: null/.test(client),
  'no state update blanks the graph while resolving the repository',
);
check(client.includes('state.resolved'), 'repository resolution is guarded against re-entry');
// Lane identity and diff counts are artwork, which the host's token policy
// allows literal colors for; every other color must come from a token.
const artworkDeclarations = client.match(/const (LANE_COLORS|DIFF_ADD|DIFF_DEL) = [^;]+;/g) ?? [];
check(artworkDeclarations.length >= 3, `browser half declares its artwork palette (${artworkDeclarations.length} of 3)`);
let withoutPalette = client;
for (const declaration of artworkDeclarations) withoutPalette = withoutPalette.replace(declaration, '');
const literalColors = withoutPalette.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
check(literalColors.length === 0, `only declared artwork uses literal colors (elsewhere: ${literalColors.join(', ') || 'none'})`);

// A graph worth drawing needs branches, merges and refs, not one lane of history.
check(host.includes("'refs/remotes'"), 'host half collects remote refs');
check(host.includes("'refs/stash'"), 'host half collects the stash');
check(host.includes("scope === 'head' ? ['HEAD'] : ['--all']"), 'host half can walk every ref, not only HEAD');
check(host.includes('--skip='), 'host half pages the graph history');
check(client.includes('function layoutLanes'), 'browser half lays out lanes');
check(client.includes('function clipCurve'), 'browser half trims curves to a row');
check(
  client.includes('(at(mid) < target) === rising'),
  'curve clipping handles both rising and falling edges',
);
check(client.includes('ref.kind'), 'rows render a ref kind, so branches, tags and remotes differ');
check(client.includes("h('style', null, CSS)"), 'browser half mounts its stylesheet into the tab');
check(client.includes('normalizeRef(props.gitRef)'), 'ref chips avoid React\'s reserved ref prop');
check(client.includes("'--dsh-gw-ref-color': props.laneColor"), 'branch ref chips inherit their commit lane color');
check(client.includes("h('span', { className: 'dsh-gw-ref-icon' }, h(BranchRefIcon, { size: 14 }))"), 'branch ref chips render the Git Graph-style branch glyph at graph-column weight');
check(client.includes("transform: props.flipVertical ? 'translate(0 16) scale(1 -1)' : undefined"), 'branch and graph glyphs share one shape with vertical reflection');
check(client.includes('background: var(--dsh-gw-ref-color); color: white;'), 'branch glyph tile uses its commit lane color');
check(client.includes('function mergeMatchingRemoteRefs'), 'matching local and remote refs can share one glyph');
check(client.includes("className: 'dsh-gw-ref-remote-name'"), 'a merged ref retains its remote name');
check(client.includes('}, h(GraphToggleIcon))'), 'graph toggle keeps its graph-specific glyph');
check(client.includes("typeof data.text === 'string'"), 'commit detail tolerates the previous Host wire format');
check(client.includes("api('diff', { repo, worktree }"), 'uncommitted detail falls back while an old Host is still running');
check(client.includes("state.capabilities.includes('uncommitted-v1')"), 'client negotiates the uncommitted endpoint before requesting it');
// The two halves update independently, so a reader must tolerate either wire
// shape: an object ref, or the bare name string an older Host half sends.
check(client.includes('function normalizeRef'), 'browser half normalizes refs before rendering');
check(
  client.includes("typeof ref === 'string'"),
  'ref normalization accepts the bare-name shape',
);
check(
  !/const \{ ref \} = props;\s*\n\s*const suffix = ref\./.test(client),
  'no render path reads a ref field before normalizing',
);
const concatCount = (client.match(/previous\.nodes\.concat\(/g) ?? []).length;
check(concatCount === 1, `paging appends commits exactly once (found ${concatCount})`);

{
  const start = client.indexOf('function mergeMatchingRemoteRefs');
  const end = client.indexOf('function GraphBranchGlyph');
  const mergeMatchingRemoteRefs = start >= 0 && end > start
    ? new Function(`${client.slice(start, end)}; return mergeMatchingRemoteRefs;`)()
    : null;
  if (!mergeMatchingRemoteRefs) {
    check(false, 'verify could not extract the matching-ref merger');
  } else {
    const refs = mergeMatchingRemoteRefs([
      { name: 'main', kind: 'branch', current: true },
      { name: 'origin/main', kind: 'remote', current: false },
      { name: 'upstream/topic', kind: 'remote', current: false },
    ]);
    const local = refs.find((ref) => ref.kind === 'branch' && ref.name === 'main');
    check(refs.length === 2, 'matching local and remote refs collapse into one visual ref');
    check(local?.linkedRemotes?.[0]?.name === 'origin', 'merged ref shows the remote name after the local branch');
    check(refs.some((ref) => ref.name === 'upstream/topic'), 'an unmatched remote ref remains independent');
  }
}

// The browser half is evaluated as one unit, so one syntax error stops the whole
// module from loading and the page only reports "import failed".
//
// The factory is captured by running the file with a stubbed module loader, then
// compiled with an explicit line offset. String-slicing the body is what made an
// earlier version of this check report a syntax error that the plugin did not
// have: the factory ends with the same `  },` an inner method does.
let captured;
{
  const source = await readFile(join(here, 'client.js'), 'utf8');
  const absolute = join(here, 'client.js');
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(definition) {
          captured = definition;
        },
      },
    },
  };
  sandbox.globalThis = sandbox;
  try {
    vm.runInNewContext(source, sandbox, { filename: absolute });
    check(Boolean(captured), 'client.js calls the module loader at load time');
  } catch (error) {
    const line = error.lineNumber ?? error.line;
    const column = error.columnNumber ?? error.column;
    const where = typeof line === 'number'
      ? ` at client.js line ${line}${typeof column === 'number' ? `, column ${column}` : ''}`
      : '';
    const snippet = typeof line === 'number'
      ? `\n         ${source.split('\n')[line - 1] ?? ''}\n         ${' '.repeat(Math.max(0, (typeof column === 'number' ? column : 1) - 1))}^`
      : '';
    check(false, `client.js threw while loading its module definition${where}: ${error.message}${snippet}`);
  }

  if (captured) {
    check(captured.id === '@local/dsh-git-worktree', `module id is ${captured.id}`);
    check(typeof captured.factory === 'function', 'module definition carries a factory');
    if (typeof captured.factory === 'function') {
      check(captured.factory.length === 1, 'factory takes the module `require`');
      // Take the body off the live function instead of wrapping the whole
      // source: a wrapping expression is illegal for some function forms, and
      // the loader already ran, so this only has to prove the body parses.
      const printed = captured.factory.toString();
      const bodyStart = printed.indexOf('{');
      const body = bodyStart < 0 ? '' : printed.slice(bodyStart + 1, printed.lastIndexOf('}'));
      try {
        // Compiling is not running: the body is never invoked here.
        vm.compileFunction(body, ['require'], { filename: absolute });
        check(true, 'client.js factory body compiles');
      } catch (error) {
        const stack = String(error.stack || '');
        const match = /client\.js:(\d+)(?::(\d+))?/.exec(stack);
        const where = match ? ` (client.js line ${match[1]}${match[2] ? `, column ${match[2]}` : ''})` : '';
        check(false, `client.js factory body fails to compile${where}: ${error.message}`);
      }
    }
  }
}

// A bundle can load cleanly and still fail at first render. Deleting a state
// variable leaves its remaining readers as free identifiers, which no
// source-text check sees; the panel reported only "面板渲染失败: branch is not
// defined" from its error boundary. Render every registered component against a
// stub React so that defect fails here instead of in the panel.
{
  const noop = () => {};
  const Fragment = Symbol('Fragment');
  let hookIndex = 0;
  let scenario = null;
  class Component {
    constructor(props) { this.props = props; }
    setState() {}
  }
  // Components are invoked as their parent builds them, which is where React
  // would run them too: arguments evaluate before `createElement` is called, so
  // the whole tree is walked without a reconciler.
  const createElement = (type, props, ...children) => {
    if (typeof type === 'function') {
      if (type.prototype && typeof type.prototype.render === 'function') {
        return new type({ ...(props || {}), children }).render();
      }
      hookIndex = 0;
      return type({ ...(props || {}), children });
    }
    return { type, props, children };
  };
  const React = {
    Fragment,
    Component,
    createElement,
    createContext: () => ({ Provider: 'Provider', Consumer: 'Consumer' }),
    useCallback: (fn) => fn,
    useContext: () => null,
    useEffect: noop,
    useMemo: (fn) => fn(),
    useRef: (initial) => ({ current: initial }),
    useState: (initial) => {
      const index = hookIndex;
      hookIndex += 1;
      // The tab's first hook is its whole panel state; a scenario replaces it so
      // the render reaches the branch under test.
      if (index === 0 && scenario) return [scenario, noop];
      return [typeof initial === 'function' ? initial() : initial, noop];
    },
  };

  const registered = new Map();
  const ctx = {
    get: () => null,
    effect: (fn) => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose(); }; },
    sidebarRightTabs: { register: () => noop },
    slots: {
      inject: (_name, fn) => fn(),
      register: (descriptor, renderer) => { registered.set(descriptor.name, renderer); return noop; },
    },
  };

  const clientModule = captured && typeof captured.factory === 'function'
    ? captured.factory((name) => (name === 'react' ? React : undefined))
    : null;
  if (!clientModule || typeof clientModule.apply !== 'function') {
    check(false, 'verify could not run the browser half for its render check');
  } else {
    clientModule.apply(ctx);
    const props = { tabInfo: () => ({ tab: { sessionId: 'verify', navigation: null } }) };
    const panel = (nodes) => ({
      status: 'ready', repo: 'C:/repo', resolved: true, sessionId: 'verify',
      worktrees: [{
        path: 'C:/repo', branch: 'main', head: 'a'.repeat(40), bare: false, detached: false,
        locked: null, prunable: null, status: { dirty: true, entries: 2 }, subject: 'second',
        unborn: false, error: null,
      }],
      graph: { unborn: false, nodes, branches: ['main'] },
      nodes, capabilities: ['uncommitted-v1'], error: null, more: false,
    });
    const node = {
      id: 'a'.repeat(40), parents: [], author: 'Verify', authoredAt: '2026-09-24T06:00:00.000Z',
      subject: 'second', refs: [{ name: 'main', kind: 'branch', current: true }], refCount: 1,
    };
    const renderers = [
      ['the tab body', registered.get('sidebar.right.pane.tab')],
      ['the tab title', registered.get('sidebar.right.pane.tab.title')],
      ['the sidebar-foot action', registered.get('sidebar.footer.action')],
    ];
    const cases = [
      ['its first paint', null],
      ['a ready panel with no commits', panel([])],
      ['a ready panel with one commit', panel([node])],
    ];
    for (const [label, state] of cases) {
      scenario = state;
      try {
        for (const [what, renderer] of renderers) if (typeof renderer === 'function') renderer(props);
        check(true, `browser half renders ${label}`);
      } catch (error) {
        check(false, `browser half threw rendering ${label}: ${error.message}`);
      }
    }
    scenario = null;
  }
}

// Sanity: the graph layout is the one algorithm in the bundle a reader cannot
// check by eye, so exercise the real implementation on a merge topology.
{
  const source = await readFile(join(here, 'client.js'), 'utf8');
  const start = source.indexOf('function layoutLanes');
  const end = source.indexOf('function strokeWidthFor');
  const layoutLanes = start >= 0 && end > start
    ? new Function(`${source.slice(start, end)}; return layoutLanes;`)()
    : null;
  if (!layoutLanes) {
    check(false, 'verify could not extract layoutLanes for a behavior check');
  } else {
    const nodes = [
      { id: 'm', parents: ['a', 'b'] },
      { id: 'a', parents: ['base'] },
      { id: 'b', parents: ['base'] },
      { id: 'base', parents: [] },
    ];
    const result = layoutLanes(nodes);
    check(result.lanes.length === nodes.length, 'layout assigns one lane per commit');
    check(result.lanes[0] === 0, 'the newest commit starts in lane 0');
    check(result.width >= 2, `a merge widens the graph (width ${result.width})`);
    check(
      result.edges.filter((edge) => edge.from === 0).length === 2,
      'a merge emits one edge per parent',
    );
    check(
      result.edges.some((edge) => edge.from === 0 && edge.parent === 'b' && edge.to === 2),
      'a merge edge reaches the parent actual row instead of stopping at the next row',
    );
    check(
      result.lanes[3] === result.lanes[1] || result.lanes[3] === result.lanes[2],
      'the shared ancestor lands on one of its children lanes',
    );
  }
}

// Host behavior against a scratch repository. A real working tree is the only
// way to catch what a source-text check cannot: `--numstat` prints no
// "N files changed" trailer, so parsing one silently returned zero files.
{
  const scratch = join(tmpdir(), `dsh-gw-verify-${process.pid}`);
  const run = (args, cwd = scratch) => spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Verify', GIT_AUTHOR_EMAIL: 'verify@example.com', GIT_COMMITTER_NAME: 'Verify', GIT_COMMITTER_EMAIL: 'verify@example.com' },
  });
  try {
    await rm(scratch, { recursive: true, force: true });
    await mkdir(scratch, { recursive: true });
    const gitOk = run(['init', '--quiet']).status === 0;
    if (!gitOk) {
      notes.push('  note git is unavailable; skipping the host behavior checks');
    } else {
      await writeFile(join(scratch, 'a.txt'), 'one\n');
      run(['add', '.']);
      run(['commit', '--quiet', '-m', 'first']);
      await writeFile(join(scratch, 'b.txt'), 'two\nthree\n');
      run(['add', '.']);
      run(['commit', '--quiet', '-m', 'second']);
      const primaryBranch = run(['branch', '--show-current']).stdout.trim();
      run(['branch', 'side', 'HEAD~1']);
      run(['checkout', '--quiet', 'side']);
      await writeFile(join(scratch, 'side.txt'), 'side\n');
      run(['add', '.']);
      run(['commit', '--quiet', '-m', 'side only']);
      run(['checkout', '--quiet', primaryBranch]);
      await writeFile(join(scratch, 'a.txt'), 'one changed\n');
      await writeFile(join(scratch, 'untracked.txt'), 'new\n');

      const host = await import(pathToFileURL(join(here, 'index.js')).href);
      const config = { ctx: { get: () => undefined }, defaultRepo: scratch, commitLimit: 50 };
      const query = (params) => ({ get: (key) => (key in params ? params[key] : null) });

      const head = run(['rev-parse', 'HEAD']).stdout.trim();
      const worktrees = await host.worktreesPayload(query({ repo: scratch }), config);
      check(worktrees.apiVersion === 2, `worktrees advertises API version ${worktrees.apiVersion}`);
      check(worktrees.capabilities.includes('uncommitted-v1'), 'worktrees advertises structured uncommitted support');
      const detail = await host.commitDetailPayload(query({ repo: scratch, oid: head }), config);
      check(detail.subject === 'second', `commit subject reads as ${JSON.stringify(detail.subject)}`);
      check(detail.files.length === 1, `commit lists its changed files (${detail.files.length})`);
      check(detail.summary.insertions === 2, `commit sums insertions (${detail.summary.insertions})`);
      check(detail.author.name === 'Verify', 'commit reads its author identity');

      const uncommitted = await host.uncommittedPayload(query({ worktree: scratch }), config);
      check(uncommitted.unborn === false, 'uncommitted reports a born branch');
      check(uncommitted.files.length === 2, `uncommitted lists tracked and untracked files (${uncommitted.files.length})`);
      check(
        uncommitted.files.some((file) => file.untracked && file.path === 'untracked.txt'),
        'uncommitted includes untracked files',
      );

      const graph = await host.graphPayload(query({ repo: scratch, scope: 'all', limit: 10 }), config);
      check(graph.nodes.length === 3, `graph walks every branch (${graph.nodes.length} nodes)`);
      check(
        graph.nodes.every((node) => Array.isArray(node.refs) && node.refs.every((ref) => ref && typeof ref === 'object' && 'kind' in ref)),
        'graph refs are objects with a kind',
      );
      check(Array.isArray(graph.branches) && graph.branches.includes('master') === true || graph.branches.includes('main') === true, 'graph reports its branch names');
      check(graph.scope === 'all', 'graph echoes the requested scope');
      const filtered = await host.graphPayload(query({ repo: scratch, scope: 'all', branch: primaryBranch, limit: 10 }), config);
      check(filtered.nodes.length === 2, `branch filter excludes unrelated history (${filtered.nodes.length} nodes)`);
      check(!filtered.nodes.some((node) => node.subject === 'side only'), 'branch filter does not union the selected branch with --all');
    }
  } catch (error) {
    check(false, `host behavior checks threw: ${error.message}`);
  } finally {
    await rm(scratch, { recursive: true, force: true }).catch(() => {});
  }
}

process.stdout.write(`${notes.join('\n')}\n`);
if (failures.length > 0) {
  process.stdout.write(`\n${failures.length} check(s) failed:\n${failures.map((line) => `  FAIL ${line}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('\nAll pre-install checks passed. Install with plugin_manager install_bundle using this directory as target.\n');
}
