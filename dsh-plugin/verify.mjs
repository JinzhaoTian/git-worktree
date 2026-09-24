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
// The sidebar foot stays clear: the tab opens from the tab strip's guide card,
// and a second entry point beside Settings was removed deliberately.
check(!client.includes('sidebar.footer.action'), 'browser half registers no sidebar-foot action');
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
// `--all` is the default reach, narrowed by excludes that must stay attached to
// the `--all` they modify: `remote=0` drops remote-tracking refs, and the tool's
// own snapshot/turn-diff refs and the stash are never history entry points.
check(
  host.includes("scope === 'head' ? ['HEAD'] : everything")
  && host.includes("['--exclude=refs/codex/*', '--exclude=refs/stash']")
  && host.includes("['--exclude=refs/remotes/*', ...notHistory, '--all']"),
  'host half can walk every ref, not only HEAD, and skips its own refs',
);
check(host.includes('--skip='), 'host half pages the graph history');
check(client.includes('function layoutLanes'), 'browser half lays out lanes');
// A lane change is a polyline — two columns joined by a ramp — clipped into row
// slices. The ramp slopes instead of stepping, and clipping a straight polyline
// by y is exact, so a slice ends on a row edge at precisely the point its
// neighbour begins on.
check(client.includes('function edgeRuns'), 'browser half routes a lane change as a polyline');
check(client.includes('function clipSegment'), 'a slice is clipped exactly, not approximated');
check(client.includes('function rowPath'), 'one row draws its own slice of the polyline');
check(!client.includes('clipCurve'), 'no bezier trimming survives the polyline routing');
{
  const start = client.indexOf('    /**\n     * One lane change, as the polyline');
  const end = client.indexOf("/** One row's slice of the graph");
  // `edgeRuns` measures in rows and columns, and both are declared with the other
  // geometry constants, outside the slice: read them out rather than assume them.
  const rowHeight = Number(/const ROW = (\d+)/.exec(client)?.[1]);
  const column = Number(/const COL = (\d+)/.exec(client)?.[1]);
  const pad = Number(/const PAD = (\d+)/.exec(client)?.[1]);
  const nearSlot = Number(/const CROSS_NEAR = (\d+)/.exec(client)?.[1]);
  // `edgeRuns` names the column it steps to, so it needs the same column → x
  // mapping the drawing uses.
  const laneX = (lane) => pad + lane * column + column / 2;
  const routing = start >= 0 && end > start && Number.isFinite(rowHeight) && Number.isFinite(column)
    ? new Function('ROW', 'COL', 'laneX', `${client.slice(start, end)}; return { edgeRuns, rowPath };`)(rowHeight, column, laneX)
    : null;
  if (!routing) {
    check(false, 'verify could not extract the lane routing for a behavior check');
  } else {
    // A lane two columns out that walks in one column at a time while the parent
    // it is heading for slides left, from row 8 down to row 20.
    const leftward = routing.edgeRuns(
      {
        from: 8,
        to: 20,
        crossing: 9 * rowHeight + nearSlot,
        route: [{ lane: 1, y: 10 * rowHeight + nearSlot }],
      },
      17 + 2 * column, 8 * rowHeight + rowHeight / 2, 17 + column, 20 * rowHeight + rowHeight / 2,
    );
    check(
      leftward[0].x === 17 + 2 * column && leftward[leftward.length - 1].x === 17 + column,
      'a lane change starts on the source column and ends on the parent\'s',
    );
    check(
      leftward[1].y === 9 * rowHeight + nearSlot,
      'the first ramp leaves the source column in the slot the layout chose',
    );
    const hops = [];
    for (let step = 0; step < leftward.length - 1; step += 1) {
      if (leftward[step + 1].x !== leftward[step].x) hops.push([leftward[step], leftward[step + 1]]);
    }
    check(
      hops.length === 1,
      `a lane change steps once per column its parent moves (${hops.length} step for one column)`,
    );
    check(
      hops.every(([from, to]) => Math.abs(to.x - from.x) === column),
      'every step is exactly one column wide, so a ramp never reaches across a lane',
    );
    // The point of the slope: on a lane moving left, the left end of the ramp is
    // the lower one and the right end the higher one.
    check(
      hops.every(([from, to]) => to.x < from.x && to.y > from.y),
      'a leftward ramp is low on the left and high on the right',
    );
    const pointsIn = (d) => (d.match(/-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?/g) || [])
      .map((pair) => pair.split(' ').map(Number));
    const rowTop = 9 * rowHeight;
    const first = pointsIn(routing.rowPath(leftward, rowTop, rowTop + rowHeight));
    const second = pointsIn(routing.rowPath(leftward, rowTop + rowHeight, rowTop + 2 * rowHeight));
    check(
      first.length >= 2 && second.length >= 2
      && first[first.length - 1][1] === rowHeight && second[0][1] === 0
      && first[first.length - 1][0] === second[0][0],
      'a slice ends on the row edge exactly where the next row begins',
    );
  }
}
check(client.includes('ref.kind'), 'rows render a ref kind, so branches, tags and remotes differ');
check(client.includes("h('style', null, CSS)"), 'browser half mounts its stylesheet into the tab');
check(client.includes('normalizeRef(props.gitRef)'), 'ref chips avoid React\'s reserved ref prop');
check(client.includes("'--dsh-gw-ref-color': props.laneColor"), 'branch ref chips inherit their commit lane color');
check(client.includes("h('span', { className: 'dsh-gw-ref-icon' }, h(BranchRefIcon, { size: 14 }))"), 'branch ref chips render the Git Graph-style branch glyph at graph-column weight');
check(client.includes("transform: props.flipVertical ? 'translate(0 16) scale(1 -1)' : undefined"), 'branch and graph glyphs share one shape with vertical reflection');
check(client.includes('background: var(--dsh-gw-ref-color); color: white;'), 'branch glyph tile uses its commit lane color');
check(client.includes("className: 'dsh-gw-ref-remote-name'"), 'the chip keeps its remote-mirror cell for an older Host');
check(client.includes('}, h(GraphToggleIcon))'), 'graph toggle keeps its graph-specific glyph');
// The toolbar chip carries the one string in the panel that can be arbitrarily
// long, so it has to be able to lose width to the controls beside it — and to cut
// its own text if the shrink ever fails — instead of pushing its status dot and
// the worktree name out of the toolbar.
{
  const chipRule = /\.dsh-gw-wt \{[^}]*\}/.exec(client)?.[0] ?? '';
  check(
    /min-width: 0/.test(chipRule) && /flex: 0 1 auto/.test(chipRule),
    'the worktree chip is allowed to shrink rather than push the toolbar controls',
  );
  check(
    /overflow: hidden/.test(chipRule),
    'the worktree chip clips its own overflow, so a long path cannot escape it',
  );
  check(
    /\.dsh-gw-wt \.dsh-gw-subjtext \{[^}]*min-width: 0[^}]*overflow: hidden/.test(client),
    'the path inside the chip ellipsises instead of widening the chip',
  );
  const dotRule = /\.dsh-gw-dot \{[^}]*\}/.exec(client)?.[0] ?? '';
  check(
    /flex: 0 0 auto/.test(dotRule),
    'the status dot never shrinks, so its state colour always has a dot to sit in',
  );
}
// The working tree is a row on the graph, not a node joined to HEAD by a grey
// stub: that stub read as a stray grey line whenever the row it connected from
// was scrolled out of view.
// The connector is conditional now: it exists only while the working tree has
// its own row to connect to, which is what made a bare stub read as a stray line.
check(client.includes('const worktreeLink = dirty &&'), 'the working-tree connector is tied to a dirty worktree');
check(client.includes('above: worktreeLink && index === 0'), 'only the row under the working tree draws the connector');
check(client.includes('head: isHead && !dirty'), 'the hollow marker moves off HEAD while the worktree is dirty');
// The lane is one ROW-tall slice per row, so a row's pitch has to be exactly
// ROW and each slice has to begin at its row's top. A bottom border and an
// inline SVG's baseline gap each add height the drawing cannot see, and the
// lane visibly broke between rows until both were removed from the box model.
const rowRule = /\.dsh-gw-row \{[^}]*\}/.exec(client)?.[0] ?? '';
check(
  /(?<!min-)height: 26px/.test(rowRule) && !/border-bottom/.test(rowRule),
  'a commit row is exactly ROW tall, with its separator out of layout',
);
const gcellRule = /\.dsh-gw-gcell \{[^}]*\}/.exec(client)?.[0] ?? '';
check(/align-self: stretch/.test(gcellRule), 'the graph slice begins at its row top');
check(/\.dsh-gw-gcell svg \{ display: block/.test(client), 'the graph slice adds no inline-baseline space');
check(
  client.includes('Math.max(64, PAD + layout.width * COL + MARGIN)'),
  'the graph column is as wide as the drawing, so no lane is clipped',
);
// An expanded detail is taller than a row, so its band has to be drawn beside
// the detail rather than by a row slice, and on the x the row above ended on.
check(client.includes('function GraphRail'), 'the graph is drawn beside an expanded row');
check(client.includes("className: 'dsh-gw-rail-turn'"), 'a rail draws the ramp a lane change crosses its band with');
check(
  /\.dsh-gw-detailrow \{[^}]*\}[\s\S]*?\.dsh-gw-detailbody \{/.test(client),
  'an expanded row keeps the rail and the detail in one flex row',
);
{
  const railRule = /\.dsh-gw-rail \{[^}]*\}/.exec(client)?.[0] ?? '';
  const lineRule = /\.dsh-gw-rail-line \{[^}]*\}/.exec(client)?.[0] ?? '';
  check(/align-self: stretch/.test(railRule), 'the rail spans the whole band it carries a lane across');
  check(
    /top: 0/.test(lineRule) && /bottom: 0/.test(lineRule),
    'a rail line reaches both edges of its band, leaving no gap at either row',
  );
}
// The light theme's layer surface is the same white the panel already sits on,
// so an open row was marked by its left stripe alone and an expanded detail was
// the same white as every closed row around it. Both surfaces are mixed from a
// theme token — a fixed grey is wrong in one of the two themes — and the row has
// to stay the stronger of the pair, or the block loses its header.
{
  const openRowRule = /\.dsh-gw-row-open \{[^}]*\}/.exec(client)?.[0] ?? '';
  check(
    /background: color-mix\(in srgb, var\(--dsw-alias-label-primary\)/.test(openRowRule),
    'an open row is tinted from a theme token, so it marks itself in either theme',
  );
  check(
    /border-left-color: var\(--dsw-alias-brand-primary\)/.test(openRowRule),
    'an open row keeps the brand stripe that points at its detail',
  );
  check(
    client.includes('.dsh-gw-row:hover:not(.dsh-gw-row-open)'),
    'hovering an open row does not wash its tint out',
  );
  const detailRowRule = /\.dsh-gw-detailrow \{[^}]*\}/.exec(client)?.[0] ?? '';
  const mixPercent = (rule) => Number(/var\(--dsw-alias-label-primary\) (\d+(?:\.\d+)?)%/.exec(rule)?.[1]);
  const detailMix = mixPercent(detailRowRule);
  check(
    Number.isFinite(detailMix) && detailMix > 0,
    'an expanded detail is tinted from the same theme token as the row that opened it',
  );
  check(
    detailMix > 0 && detailMix < mixPercent(openRowRule),
    `the detail is one step weaker than its row (${detailMix}% against ${mixPercent(openRowRule)}%), so the row stays the block's header`,
  );
  // The cap sits on the changed-file column alone: the metadata and the commit
  // message beside it keep their natural height, so a long file list scrolls in
  // its own box while a long message still reads in full — which is also why the
  // cap cannot live on the row.
  // Anchored at the line start: the narrow layout's overrides also name these
  // classes, and an unanchored pattern would read one of those instead.
  const detailRightRule = /^\.dsh-gw-detail-right \{[^}]*\}/m.exec(client)?.[0] ?? '';
  const detailLeftRule = /^\.dsh-gw-detail-left \{[^}]*\}/m.exec(client)?.[0] ?? '';
  check(
    /max-height: var\(--dsh-gw-detail-max\)/.test(detailRightRule) && /overflow: auto/.test(detailRightRule),
    'only the changed-file column is capped, and it scrolls on its own',
  );
  check(
    !/max-height/.test(detailLeftRule) && !/overflow/.test(detailLeftRule),
    'the metadata and message column is never capped, so a long message reads in full',
  );
  check(
    !/max-height/.test(detailRowRule),
    'the row itself is uncapped, so the rail is drawn down however tall the block grows',
  );
  // A grid row is sized from its item's content and ignores that item's
  // max-height, so capping the file column inside a grid grew the row to the whole
  // file list and left the capped column in empty space. A flex line's cross size
  // does honour the cap, which is why the two halves are flex columns.
  check(
    /\.dsh-gw-detail \{[^}]*display: flex/.test(client),
    'a detail is a flex line, so its row ends at the capped column and not at the file list',
  );
  check(
    /\.dsh-gw-detail-narrow \{[^}]*flex-direction: column/.test(client),
    'a narrow panel stacks the two halves instead of splitting the width',
  );
  check(
    ['DETAIL_MAX_SHARE', 'DETAIL_MAX_CEILING', 'DETAIL_MAX_FLOOR'].every((name) => client.includes(name)),
    'the cap is a share of the panel with a floor and a ceiling, not a bare constant',
  );
}
// The panel reads the one worktree the Session sits in and offers no other, but
// it still names the one it is reading — as a label, not a control.
check(!client.includes('onSelectWorktree'), 'the panel offers no worktree switching');
check(
  client.includes('data.worktrees.find((item) => samePath(item.path, data.repo.root))'),
  'the panel reads the worktree the Session itself sits in',
);
check(client.includes("className: 'dsh-gw-wt dsh-gw-wt-current'"), 'the current worktree is named');
check(!client.includes("'Worktree:'"), 'the worktree chip carries no separate caption');
// The Host answers `repo.root` from realpath and the worktree list from `git
// worktree list`, and on Windows those spell the same path with different
// separators — exact equality made the panel read whichever came first.
{
  const start = client.indexOf('function samePath');
  const end = client.indexOf('function compactPath');
  const samePath = start >= 0 && end > start
    ? new Function(`${client.slice(start, end)}; return samePath;`)()
    : null;
  if (!samePath) {
    check(false, 'verify could not extract samePath for a behavior check');
  } else {
    check(samePath('E:/workspace/X', 'E:\\workspace\\X'), 'worktree paths match across separators');
    check(samePath('E:/Workspace/X/', 'e:/workspace/x'), 'worktree paths match across case and a trailing separator');
    check(!samePath('E:/a', 'E:/b'), 'different worktree paths do not match');
    check(!samePath('', ''), 'two empty paths are not the same worktree');
  }
}
// Long worktree paths are shortened by a rule rather than by chance, so exercise
// the real function on the shapes a Windows workspace actually produces.
{
  const start = client.indexOf('const PATH_MIN_SAVING');
  const end = client.indexOf('function shortOid');
  const compactPath = start >= 0 && end > start
    ? new Function(`${client.slice(start, end)}; return compactPath;`)()
    : null;
  if (!compactPath) {
    check(false, 'verify could not extract compactPath for a behavior check');
  } else {
    check(
      compactPath('E:/workspace/ThBIMWindowsUI') === 'E:/w…wo/ThBIMWindowsUI',
      `a long path keeps its front, its parent's head and its folder (${compactPath('E:/workspace/ThBIMWindowsUI')})`,
    );
    check(
      compactPath('D:\\repos\\some\\git-worktree') === 'D:\\r…som\\git-worktree',
      `a backslash path shortens the same way (${compactPath('D:\\repos\\some\\git-worktree')})`,
    );
    // Reported from a live panel: the rule kept the whole path because eliding it
    // came out one character shorter, so the chip drew the path it was meant to
    // shorten. A shortening that small is not worth an ellipsis, so the rule now
    // gives up the parent folder's name instead of its width.
    check(
      compactPath('E:/www.p6c/ThBIMWindowsUI') === 'E:/w…/ThBIMWindowsUI',
      `a path whose parent name is short still loses it (${compactPath('E:/www.p6c/ThBIMWindowsUI')})`,
    );
    check(
      compactPath('D:\\repos\\git-worktree') === 'D:\\repos\\git-worktree',
      'a path whose shortening would come out the same length is left whole',
    );
    check(
      compactPath('C:/Users/tianjinzhao/AppData/Local/Temp/dsh-gw-verify-31480') === 'C:/U…Temp/dsh-gw-verify-31480',
      `a deep path keeps its last two folders (${compactPath('C:/Users/tianjinzhao/AppData/Local/Temp/dsh-gw-verify-31480')})`,
    );
    check(compactPath('D:/x') === 'D:/x', 'a path with nothing to elide is left whole');
    check(compactPath('D:/xy') === 'D:/xy', 'a path that cannot save enough is left whole');
    check(compactPath('ThBIMWindowsUI') === 'ThBIMWindowsUI', 'a bare folder name is left whole');
    check(compactPath('') === '', 'an absent path stays absent');
    // The two properties every shape shares: a shortened path is shorter by a
    // margin worth reading, and it still ends in the folder it names.
    const shapes = [
      'E:/www.p6c/ThBIMWindowsUI', 'E:/workspace/ThBIMWindowsUI', 'D:\\repos\\some\\git-worktree',
      'D:\\repos\\git-worktree', 'D:/a/b/c/d/e/verydeep/folder-name', 'C:/Users/tianjinzhao/AppData/Local/Temp/dsh-gw-verify-31480',
      'E:/one/TwoWords', 'E:/a-b/c', '/home/user/projects/ab', 'E:/x/y/z',
    ];
    const shortened = shapes.map(compactPath).filter((value, index) => value !== shapes[index]);
    check(shortened.length >= 6, `most long shapes are shortened (${shortened.length}/${shapes.length})`);
    check(
      shapes.every((shape, index) => {
        const out = compactPath(shape);
        return out === shape || shape.length - out.length >= 5;
      }),
      'every shortened path saves at least the minimum, and no other shape is touched',
    );
    check(
      shapes.every((shape, index) => {
        const out = compactPath(shape);
        const folder = shape.slice(Math.max(shape.lastIndexOf('/'), shape.lastIndexOf('\\')) + 1);
        return out.endsWith(folder);
      }),
      'a shortened path still ends in the folder it names',
    );
  }
}
// The checkbox scopes the history too, so the choice must travel with the read
// and re-read the graph when it flips.
check(client.includes("const remoteParam = showRemote ? '1' : '0'"), 'the remote-refs choice becomes one request value');
check(
  (client.match(/remote: remoteParam/g) ?? []).length === 2,
  'both graph reads send the remote-refs choice',
);
check(/\[repo, selected, scope, remoteParam, reloadKey\]/.test(client), 'toggling remote refs re-reads the graph');
// The worktree's own ref and the branch it holds are one fact about one commit,
// so they render as one chip in two cells: the inverted 'worktree' label, then
// the branch in that commit's lane colour. Detached, there is no branch to name.
check(!client.includes('function WorktreeRefIcon'), 'worktree refs render without a stacked-folder glyph');
check(!client.includes('dsh-gw-worktree-icon'), 'no leftover stacked-folder glyph styling');
check(
  client.includes('background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-base);'),
  'the worktree cell inverts the label color (black on light, white on dark)',
);
check(
  client.includes("h('span', { className: 'dsh-gw-ref-worktree-label' }, 'worktree')"),
  'the worktree cell names itself',
);
{
  // The frame belongs to the chip and the surfaces belong to the cells: the label
  // colour rings the whole pair, the label cell keeps the inverted fill, and the
  // branch name sits on its own lane-tinted surface — never on the label's fill.
  const chipRule = /\.dsh-gw-ref-worktree \{[^}]*\}/.exec(client)?.[0] ?? '';
  check(/gap: 0/.test(chipRule) && /padding: 0/.test(chipRule), 'the two cells sit flush as one chip');
  check(
    /border: 1px solid var\(--dsw-alias-label-primary\)/.test(chipRule),
    'the chip frames both cells in the label colour (black on light, white on dark)',
  );
  check(
    /border-radius: 5px/.test(chipRule) && /overflow: hidden/.test(chipRule),
    'the frame clips the cells to its own corners',
  );
  check(
    /background: none/.test(chipRule),
    'the chip paints no fill of its own, so the branch name is never on the label colour',
  );
  const labelRule = /\.dsh-gw-ref-worktree-label \{[^}]*\}/.exec(client)?.[0] ?? '';
  check(
    /background: var\(--dsw-alias-label-primary\)/.test(labelRule),
    'the worktree cell carries the inverted fill',
  );
  check(!/border/.test(labelRule), 'the worktree cell draws no border of its own');
  const heldRule = /\.dsh-gw-ref-worktree-held \{[^}]*\}/.exec(client)?.[0] ?? '';
  check(
    /background: color-mix\(in srgb, var\(--dsh-gw-ref-color\)/.test(heldRule),
    'the branch cell carries its own lane-tinted surface',
  );
  check(!/border/.test(heldRule), 'the branch cell draws no border of its own');
}
// A detached HEAD wears the graph's own marker: the hollow ring it draws on the
// node for the newest change, so the chip's icon and the lane agree.
check(
  client.includes('function HeadRingGlyph'),
  'a detached worktree is marked with a ring',
);
{
  const ring = /function HeadRingGlyph[\s\S]*?\n    \}/.exec(client)?.[0] ?? '';
  check(/fill: 'none'/.test(ring) && /h\('circle'/.test(ring), 'the marker is a hollow circle');
  check(!client.includes('HeadTagGlyph'), 'the tag glyph is gone, not merely unused');
}
check(
  client.includes("h('span', { className: 'dsh-gw-ref-worktree-name' }, held || 'HEAD')"),
  'a detached worktree reads HEAD in the same cell a branch name would use',
);
check(
  client.includes(".sort((left, right) => (right.kind === 'worktree') - (left.kind === 'worktree'))"),
  'the worktree chip sorts ahead of branch chips in the Description cell',
);
check(
  host.indexOf("ref.kind === 'worktree'") < host.indexOf("ref.kind === 'branch'"),
  'the Host orders the worktree ref before branches',
);
// A row draws local branches and the worktree's own chip, and nothing else: tags,
// stashes and remote mirrors are neither sent by the Host nor rendered by the
// browser half, which is what keeps a busy repository's rows readable.
check(
  !host.includes("ref.kind === 'tag'") && !host.includes("ref.kind === 'stash'"),
  'the Host sends no tag or stash ref for a row to draw',
);
check(
  client.includes(".filter((ref) => ref.kind === 'branch' || ref.kind === 'worktree')"),
  'the browser half draws local branches and the worktree chip only',
);
// Absorbing the branch is the merge, and it has to leave every other ref alone.
{
  const start = client.indexOf('function mergeWorktreeBranch');
  const end = client.indexOf('function HeadRingGlyph');
  const mergeWorktreeBranch = start >= 0 && end > start
    ? new Function(`${client.slice(start, end)}; return mergeWorktreeBranch;`)()
    : null;
  if (!mergeWorktreeBranch) {
    check(false, 'verify could not extract mergeWorktreeBranch for a behavior check');
  } else {
    const merged = mergeWorktreeBranch([
      { kind: 'worktree', name: 'current worktree' },
      { kind: 'branch', name: 'main', current: true, linkedRemotes: [{ name: 'origin', fullName: 'origin/main' }] },
      { kind: 'tag', name: 'v1' },
    ], 'main');
    check(
      merged.length === 2 && merged.some((ref) => ref.kind === 'worktree' && ref.holdsBranch === 'main'),
      'the worktree chip absorbs the branch it holds',
    );
    check(!merged.some((ref) => ref.kind === 'branch'), 'the absorbed branch is not drawn a second time');
    check(merged.some((ref) => ref.kind === 'tag'), 'every other ref survives the merge');
    check(
      merged.some((ref) => ref.kind === 'worktree' && (ref.linkedRemotes || []).length === 1),
      'the branch keeps its merged remote mirrors across the merge',
    );
    check(
      mergeWorktreeBranch([{ kind: 'worktree' }, { kind: 'branch', name: 'side' }], 'main').length === 2,
      'a branch this worktree does not hold is left alone',
    );
    const detached = mergeWorktreeBranch([{ kind: 'worktree' }, { kind: 'branch', name: 'main' }], null);
    check(
      detached.length === 2 && !detached[0].holdsBranch,
      'a detached worktree absorbs nothing, so its chip stays unnamed',
    );
  }
}
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

// The browser half is evaluated as one unit, so one syntax error stops the whole
// module from loading and the page only reports "import failed".
//
// The factory is captured by running the file with a stubbed module loader, then
// compiled with an explicit line offset. String-slicing the body is what made an
// earlier version of this check report a syntax error that the plugin did not
// have: the factory ends with the same `  },` an inner method does.
let captured;
// The factory closes over its own context's globals, so the read-effect case
// injects its stubs here rather than on the verifier's globalThis.
let sandbox;
{
  const source = await readFile(join(here, 'client.js'), 'utf8');
  const absolute = join(here, 'client.js');
  sandbox = {
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
  // The panel reads its remembered worktree from a factory-private map that only
  // an effect ever fills, and effects never run here. This overrides that one
  // hook's initial value so a case can render a panel that already has a
  // worktree selected. Hook 1 is `selected`; hook 0 is the whole panel state.
  let scenarioSelected = null;
  // Which component is being invoked, so a hook override can be aimed at one of
  // them: the tab body and every detail panel it renders have a hook 0 of their
  // own, and a scenario must not leak into a nested component's state.
  let currentComponent = '';
  // Hook values a case supplies because no effect has filled them yet: the
  // panel's `openKey` and `showGraph`, and a detail read that already arrived.
  const hookValues = new Map();
  // Effects are collected rather than run, so the render cases stay pure. The
  // read-effect case turns them on: a promise callback that dies on a free
  // identifier never reaches a render, and that is how the graph read once
  // stopped arriving with no error anywhere on the panel.
  const effects = [];
  let effectsEnabled = false;
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
      currentComponent = type.name || '';
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
    useEffect: (fn) => { if (effectsEnabled) effects.push(fn); },
    useMemo: (fn) => fn(),
    useRef: (initial) => ({ current: initial }),
    useState: (initial) => {
      const index = hookIndex;
      hookIndex += 1;
      const key = `${currentComponent}:${index}`;
      if (hookValues.has(key)) return [hookValues.get(key), noop];
      // The tab's first two hooks are its whole panel state and the worktree it
      // has selected; a scenario replaces them so the render reaches the branch
      // under test. Only the tab itself is aimed at: a nested detail keeps its
      // own hook 0.
      if (currentComponent === 'WorktreeTab' && index === 0 && scenario) return [scenario, noop];
      if (currentComponent === 'WorktreeTab' && index === 1 && scenarioSelected) return [scenarioSelected, noop];
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
      graph: { unborn: false, nodes, head: nodes[0] ? nodes[0].id : null, branches: ['main'] },
      nodes, capabilities: ['uncommitted-v1'], error: null, more: false,
    });
    const node = {
      id: 'a'.repeat(40), parents: [], author: 'Verify', authoredAt: '2026-09-24T06:00:00.000Z',
      subject: 'second', refs: [{ name: 'main', kind: 'branch', current: true }], refCount: 1,
    };
    // The working-tree row is conditional: a clean worktree must not render it.
    // Walk the rendered tree for the row's class so both states are asserted on
    // real output instead of on the source text that decides it.
    const containsUncommittedRow = (element) => {
      if (Array.isArray(element)) return element.some(containsUncommittedRow);
      if (!element || typeof element !== 'object') return false;
      const className = element.props && element.props.className;
      if (typeof className === 'string' && className.includes('dsh-gw-uncommitted')) return true;
      if (Array.isArray(element.children)) return element.children.some(containsUncommittedRow);
      return element.props ? containsUncommittedRow(element.props.children) : false;
    };
    const renderers = [
      ['the tab body', registered.get('sidebar.right.pane.tab')],
      ['the tab title', registered.get('sidebar.right.pane.tab.title')],
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

    const body = registered.get('sidebar.right.pane.tab');
    // The view map is module-scoped and keyed by session, and the render cases
    // above have already written to it. A session id that no earlier case used
    // resolves from a clean slate.
    const dirtyPanel = panel([node]);
    const cleanPanel = panel([node]);
    cleanPanel.worktrees = cleanPanel.worktrees.map((worktree) => ({ ...worktree, status: { dirty: false, entries: 0 } }));
    const renderWith = (state, sessionId, hooks = null) => {
      scenario = state;
      scenarioSelected = state.worktrees[0].path;
      hookValues.clear();
      for (const [key, value] of Object.entries(hooks || {})) hookValues.set(key, value);
      try {
        return body({ tabInfo: () => ({ tab: { sessionId, navigation: null } }) });
      } finally {
        scenarioSelected = null;
        hookValues.clear();
      }
    };
    const dirtyTree = renderWith(dirtyPanel, 'verify-dirty');
    const cleanTree = renderWith(cleanPanel, 'verify-clean');
    check(containsUncommittedRow(dirtyTree), 'a dirty worktree renders its Uncommitted Changes row');
    check(!containsUncommittedRow(cleanTree), 'a clean worktree renders no Uncommitted Changes row');

    // HEAD is marked on real output, not just in the source text that decides
    // it: the row is bold, and the hollow circle sits on whichever row is the
    // newest change — the working tree's own row while it is dirty, this commit
    // once the working tree is clean.
    const findElement = (element, match) => {
      if (Array.isArray(element)) {
        for (const child of element) {
          const hit = findElement(child, match);
          if (hit) return hit;
        }
        return null;
      }
      if (!element || typeof element !== 'object') return null;
      if (element.props && match(element.props, element.type)) return element;
      if (Array.isArray(element.children)) return findElement(element.children, match);
      return element.props ? findElement(element.props.children, match) : null;
    };
    const isRing = (elementProps, type) => type === 'circle' && elementProps.r === 4.5
      && elementProps.fill === 'var(--dsw-alias-bg-base)';
    const isConnector = (elementProps, type) => type === 'line'
      && elementProps.stroke === 'var(--dsw-alias-label-secondary)';
    const rowWithHeadClass = (element) => findElement(
      element,
      (elementProps) => typeof elementProps.className === 'string' && elementProps.className.includes('dsh-gw-row-head'),
    );

    const headTree = renderWith(panel([node]), 'verify-head');
    const headRow = rowWithHeadClass(headTree);
    check(Boolean(headRow), 'the commit under HEAD carries the HEAD row class');
    check(
      Boolean(headRow) && !findElement(headRow, isRing),
      'a dirty worktree leaves the HEAD node filled, because its own row holds the ring',
    );
    check(
      Boolean(headRow) && Boolean(findElement(headRow, isConnector)),
      'a dirty worktree connects the HEAD commit up to the working-tree ring',
    );

    const cleanHead = panel([node]);
    cleanHead.worktrees = cleanHead.worktrees.map((worktree) => ({ ...worktree, status: { dirty: false, entries: 0 } }));
    const cleanHeadTree = renderWith(cleanHead, 'verify-clean-head');
    const cleanHeadRow = rowWithHeadClass(cleanHeadTree);
    check(Boolean(cleanHeadRow), 'a clean worktree still marks the commit under HEAD');
    check(
      Boolean(cleanHeadRow) && Boolean(findElement(cleanHeadRow, isRing)),
      'a clean worktree moves the hollow ring onto the HEAD commit',
    );
    check(
      !findElement(cleanHeadTree, isConnector),
      'a clean worktree draws no connector, because it has no row to connect to',
    );

    const otherHead = panel([node]);
    otherHead.graph = { ...otherHead.graph, head: 'b'.repeat(40) };
    const strayHeadTree = renderWith(otherHead, 'verify-other-head');
    check(
      !rowWithHeadClass(strayHeadTree),
      'a commit that is not HEAD carries no HEAD row class',
    );
    check(
      !findElement(strayHeadTree, isConnector),
      'a commit that is not HEAD is never wired to the working-tree row',
    );

    // An expanded row keeps the graph's own column. A detail is many rows tall,
    // so the band between the two rows it sits between holds no row slice at
    // all: the row above ends its lane at the band's top and the row below
    // starts again at its bottom, which is what left the two dots reading as
    // unrelated. The rail carries every lane across that band, and it is also
    // what indents the detail's text out from under the lane.
    const uncommittedRead = {
      status: 'ready',
      data: {
        branch: 'main', path: 'C:/repo', unborn: false,
        summary: { changed: 2, insertions: 5, deletions: 1 },
        files: [
          { path: 'dsh-plugin/client.js', add: 3, del: 1, untracked: false },
          { path: 'dsh-plugin/notes/todo.md', add: 2, del: 0, untracked: true },
        ],
      },
    };
    const commitRead = {
      status: 'ready',
      data: {
        oid: 'a'.repeat(40), parents: ['b'.repeat(40)],
        author: { name: 'Verify', email: 'verify@example.com' },
        committer: { name: 'Verify', email: 'verify@example.com' },
        authoredAt: '2026-09-24T06:00:00.000Z', body: '',
        summary: { changed: 1, insertions: 2, deletions: 0 },
        files: [{ path: 'a.txt', add: 2, del: 0, untracked: false }],
      },
    };
    // A child list is whatever `createElement` was handed, so an array passed as
    // one child stays an array: flatten before matching on it.
    const flatten = (element) => (Array.isArray(element) ? element.flatMap(flatten) : [element]);
    const railRowOf = (tree) => findElement(
      tree,
      (elementProps) => elementProps.className === 'dsh-gw-detailrow',
    );
    const railLinesOf = (row) => {
      const rail = row && Array.isArray(row.children) ? row.children[0] : null;
      if (!rail || !Array.isArray(rail.children)) return [];
      return flatten(rail.children)
        .filter((line) => line && line.props && line.props.className === 'dsh-gw-rail-line');
    };
    const leftOf = (line) => parseFloat(String(line.props.style.left));
    const near = (value, expected) => Number.isFinite(value) && Math.abs(value - expected) < 0.01;

    const railTree = renderWith(dirtyPanel, 'verify-rail', {
      'WorktreeTab:5': 'uncommitted',
      'UncommittedDetail:0': uncommittedRead,
    });
    const railRow = railRowOf(railTree);
    check(Boolean(railRow), 'an expanded row renders the graph rail beside its detail');
    check(
      Boolean(railRow) && railRow.children.length === 2
        && railRow.children[0].props.className === 'dsh-gw-rail'
        && railRow.children[1].props.className === 'dsh-gw-detailbody',
      'the rail and the detail share one row, so the graph keeps its own column',
    );
    const colsHost = findElement(railTree, (elementProps) => elementProps.style && elementProps.style['--dsh-gw-cols']);
    const graphColumn = colsHost ? String(colsHost.props.style['--dsh-gw-cols']).split(' ')[0] : '';
    check(
      Boolean(railRow) && `${railRow.children[0].props.style.width}px` === graphColumn,
      `the rail is exactly the graph column, so the detail starts under Description (${graphColumn})`,
    );
    const connectorLine = railLinesOf(railRow)[0];
    check(
      Boolean(connectorLine) && near(leftOf(connectorLine), 16.2)
        && connectorLine.props.style.background === 'var(--dsw-alias-label-secondary)',
      'the working-tree connector crosses the band its own detail occupies',
    );
    // The open row is the surface the tint is painted on, so the class has to be
    // on the row the detail belongs to and not on some other one.
    check(
      Boolean(findElement(railTree, (elementProps) => typeof elementProps.className === 'string'
        && elementProps.className.split(' ').includes('dsh-gw-row-open'))),
      'the expanded row carries the open class the tint is painted by',
    );

    // A lane below an expanded row picks up where the row above ended, so the
    // rail is drawn per crossing lane rather than as one line for the row's node.
    const straightPanel = panel([
      { ...node, id: 'a'.repeat(40), parents: ['b'.repeat(40)] },
      { ...node, id: 'b'.repeat(40), parents: [], subject: 'first' },
    ]);
    const straightLines = railLinesOf(railRowOf(renderWith(straightPanel, 'verify-rail-straight', {
      'WorktreeTab:5': 'a'.repeat(40),
      'CommitDetail:0': commitRead,
    })));
    check(
      straightLines.length === 1 && near(leftOf(straightLines[0]), 15.7)
        && straightLines[0].props.style.background === '#2f8ae0',
      'a straight lane runs through the expanded band at its own x',
    );

    // A lane change crossing the band is routed, not curved, so it enters on the
    // column it came from and leaves on the column it turns into — never between
    // them. With the crossing half a row into the band, the rail draws all three
    // runs; either column alone would jog at the wrong height.
    const shared = 'c'.repeat(40);
    const curvePanel = panel([
      { ...node, id: 'a'.repeat(40), parents: [shared] },
      { ...node, id: 'b'.repeat(40), parents: [shared], subject: 'side' },
      { ...node, id: shared, parents: [], subject: 'shared' },
    ]);
    const curveRow = railRowOf(renderWith(curvePanel, 'verify-rail-curve', {
      'WorktreeTab:5': 'b'.repeat(40),
      'CommitDetail:0': commitRead,
    }));
    const curveLines = railLinesOf(curveRow);
    const railChildren = curveRow && Array.isArray(curveRow.children) && Array.isArray(curveRow.children[0].children)
      ? flatten(curveRow.children[0].children)
      : [];
    const turnSvg = railChildren.find((element) => element && element.props
      && element.props.className === 'dsh-gw-rail-turn');
    const mergeLines = curveLines.filter((line) => line.props.style.background === '#d0569b');
    const verticals = mergeLines.filter((line) => Number.parseFloat(line.props.style.width) < 5);
    const columns = verticals.map((line) => leftOf(line) + 1.3).sort((left, right) => left - right);
    check(
      verticals.length === 2,
      `a lane change crosses its band as two columns and one ramp (${verticals.length} columns)`,
    );
    check(
      verticals.length === 2 && Math.abs(columns[0] - 17) < 1.6 && Math.abs(columns[1] - 31) < 1.6,
      `a lane change is drawn on its own two columns (${columns.join(', ')})`,
    );
    check(
      Boolean(turnSvg) && Boolean(turnSvg.children[0]) && turnSvg.children[0].type === 'line'
      && turnSvg.children[0].props.stroke === '#d0569b',
      'the ramp between those columns is drawn as a slope, not a step',
    );
    check(
      Boolean(turnSvg) && Number.parseFloat(turnSvg.props.style.top) === 7,
      `the ramp starts in the slot the layout chose (top ${turnSvg?.props.style.top})`,
    );
    check(
      Boolean(turnSvg) && Boolean(turnSvg.children[0])
      && Number.parseFloat(turnSvg.children[0].props.y1) === 0
      && Number.parseFloat(turnSvg.children[0].props.y2) > 0
      && Number.parseFloat(turnSvg.children[0].props.x2) < Number.parseFloat(turnSvg.children[0].props.x1),
      'the rail\'s ramp runs leftward and downward, like the row slices it continues',
    );

    // With the graph column hidden the detail keeps the full width — but it is
    // still drawn in the same row, because that row carries the tint and the cap;
    // only the rail is missing from it.
    const hiddenGraphRow = railRowOf(renderWith(dirtyPanel, 'verify-rail-hidden', {
      'WorktreeTab:4': false,
      'WorktreeTab:5': 'uncommitted',
      'UncommittedDetail:0': uncommittedRead,
    }));
    check(Boolean(hiddenGraphRow), 'a hidden graph column drops the rail, not the detail row');
    check(
      Boolean(hiddenGraphRow) && !findElement(
        hiddenGraphRow,
        (elementProps) => typeof elementProps.className === 'string' && elementProps.className.includes('dsh-gw-rail'),
      ),
      'with the graph column hidden the detail still takes the full width',
    );

    // An expanded detail is capped: a share of the panel's own height, floored so
    // a short panel still shows its first rows and capped so a tall one does not
    // open a detail that fills it. The number travels as the row's own property,
    // so the rail beside the detail is capped with it and stays joined to the
    // rows above and below while the detail scrolls inside itself.
    const capOf = (sessionId, panelHeight) => {
      const row = railRowOf(renderWith(dirtyPanel, sessionId, {
        'WorktreeTab:5': 'uncommitted',
        'WorktreeTab:8': panelHeight,
        'UncommittedDetail:0': uncommittedRead,
      }));
      return row && row.props.style['--dsh-gw-detail-max'];
    };
    const capShare = capOf('verify-cap-share', 500);
    const capCeiling = capOf('verify-cap-ceiling', 4000);
    const capFloor = capOf('verify-cap-floor', 100);
    check(capShare === '225px', `the cap follows the panel's measured height (${capShare})`);
    check(capCeiling === '420px', `a tall panel opens no detail taller than the ceiling (${capCeiling})`);
    check(capFloor === '156px', `a short panel still shows the first rows (${capFloor})`);

    // A row draws local branches and the worktree chip, and the "+N" badge counts
    // what the Host sent but the row did not draw — which only means anything while
    // both halves agree on that policy. An older Host counts tags and remote
    // mirrors too, so its rows must show no badge rather than one promising refs
    // this browser half will never draw.
    const badgeIn = (tree) => findElement(tree, (elementProps) => typeof elementProps.className === 'string'
      && elementProps.className.split(' ').includes('dsh-gw-ref')
      && typeof elementProps.title === 'string' && elementProps.title.includes('本地分支'));
    const tip = (refs, refCount) => panel([{ ...node, refs, refCount }]);
    const mixedRefs = renderWith(tip([
      { name: 'main', kind: 'branch', current: true },
      { name: 'origin/main', kind: 'remote', current: false },
      { name: 'v1', kind: 'tag', current: false },
    ], 3), 'verify-badge-mixed');
    check(
      !badgeIn(mixedRefs),
      'a Host that still counts tags and mirrors earns no "+N" badge',
    );
    const branchRefs = renderWith(tip([
      { name: 'main', kind: 'branch', current: true },
      { name: 'side', kind: 'branch', current: false },
    ], 4), 'verify-badge-branches');
    check(
      Boolean(badgeIn(branchRefs)),
      'a Host counting only what a row draws still gets its "+N" badge',
    );

    // The panel names the worktree it reads, by path, and it is not a control.
    // The fixture's worktree path and branch differ, so the assertion tells the
    // two apart instead of accepting either.
    const worktreeChip = findElement(
      headTree,
      (elementProps) => typeof elementProps.className === 'string' && elementProps.className.includes('dsh-gw-wt-current'),
    );
    check(Boolean(worktreeChip), 'the rendered panel names the worktree it is reading');
    check(
      Boolean(worktreeChip) && worktreeChip.type === 'span',
      'the worktree indicator is a label, not a control',
    );
    const worktreeText = worktreeChip && findElement(
      worktreeChip,
      (elementProps) => typeof elementProps.className === 'string' && elementProps.className.includes('dsh-gw-subjtext'),
    );
    check(
      Boolean(worktreeText) && worktreeText.children.includes('C:/repo'),
      'the indicator names the worktree by path rather than by branch',
    );
    // …and the shortening is wired into that render, not merely available to it.
    const longPath = panel([node]);
    longPath.worktrees = longPath.worktrees.map((worktree) => ({ ...worktree, path: 'E:/workspace/ThBIMWindowsUI' }));
    const longTree = renderWith(longPath, 'verify-long-path');
    const longChip = findElement(
      longTree,
      (elementProps) => typeof elementProps.className === 'string' && elementProps.className.includes('dsh-gw-wt-current'),
    );
    const longText = longChip && findElement(
      longChip,
      (elementProps) => typeof elementProps.className === 'string' && elementProps.className.includes('dsh-gw-subjtext'),
    );
    check(
      Boolean(longText) && longText.children.includes('E:/w…wo/ThBIMWindowsUI'),
      'the rendered chip shows the shortened path',
    );
    // The chip exists to show the shortened path, so what it renders has to be
    // materially shorter than the worktree's own path — the earlier rule could
    // answer with the whole path, and that is the state the panel was reported in.
    check(
      Boolean(longText) && longText.children[0].length <= 'E:/workspace/ThBIMWindowsUI'.length - 5,
      'the rendered chip is not the full path with an ellipsis bolted on',
    );
    // The dot always renders; its colour is the worktree's state. The third
    // state matters most: `status` is null for a bare or prunable worktree and
    // when `git status` fails, and reading that as "clean" would be a claim the
    // panel cannot make.
    const dotIn = (tree) => {
      const chip = findElement(
        tree,
        (elementProps) => typeof elementProps.className === 'string' && elementProps.className.includes('dsh-gw-wt-current'),
      );
      return chip && findElement(
        chip,
        (elementProps) => typeof elementProps.className === 'string' && elementProps.className.includes('dsh-gw-dot'),
      );
    };
    const unknownPanel = panel([node]);
    unknownPanel.worktrees = unknownPanel.worktrees.map((worktree) => ({
      ...worktree, status: null, error: 'bare',
    }));
    const unknownDot = dotIn(renderWith(unknownPanel, 'verify-unknown-status'));
    const dirtyDot = dotIn(headTree);
    const cleanDot = dotIn(cleanHeadTree);
    check(Boolean(dirtyDot), 'a dirty worktree shows its status dot');
    check(Boolean(cleanDot), 'a clean worktree still shows its status dot');
    check(
      Boolean(dirtyDot) && !/dsh-gw-dot-(clean|unknown)/.test(dirtyDot.props.className),
      'a dirty worktree leaves the status dot amber',
    );
    check(
      Boolean(cleanDot) && cleanDot.props.className.includes('dsh-gw-dot-clean'),
      'a clean worktree marks the status dot green',
    );
    check(
      Boolean(unknownDot) && unknownDot.props.className.includes('dsh-gw-dot-unknown'),
      'an unreadable worktree marks the status dot unknown',
    );
    check(
      Boolean(unknownDot) && !unknownDot.props.className.includes('dsh-gw-dot-clean'),
      'an unreadable worktree is never dressed as clean',
    );
    check(
      Boolean(longChip) && longChip.props.title.startsWith('E:/workspace/ThBIMWindowsUI'),
      'the tooltip still carries the whole path',
    );

    // The merge is the point of the redesign, so assert it on the rendered row:
    // one chip carrying both cells, and no second chip for the same branch.
    const collect = (element, match, out = []) => {
      if (Array.isArray(element)) {
        for (const child of element) collect(child, match, out);
        return out;
      }
      if (!element || typeof element !== 'object') return out;
      if (element.props && match(element.props, element.type)) out.push(element);
      if (Array.isArray(element.children)) collect(element.children, match, out);
      return out;
    };
    // Exact class tokens, not substrings: `dsh-gw-ref-worktree-label` contains
    // `dsh-gw-ref-worktree`, and a prefix test counts the label as a second chip.
    const byClass = (needle) => (elementProps) => typeof elementProps.className === 'string'
      && elementProps.className.split(/\s+/).includes(needle);
    const heldNode = {
      ...node,
      refs: [
        { name: 'current worktree', kind: 'worktree', current: false },
        { name: 'main', kind: 'branch', current: true },
      ],
      refCount: 2,
    };
    const heldPanel = panel([heldNode]);
    heldPanel.graph = { ...heldPanel.graph, head: heldNode.id, branch: 'main' };
    const heldTree = renderWith(heldPanel, 'verify-held-branch');
    const worktreeChips = collect(heldTree, byClass('dsh-gw-ref-worktree'));
    check(worktreeChips.length === 1, `the HEAD row draws one worktree chip (${worktreeChips.length})`);
    check(
      collect(heldTree, byClass('dsh-gw-ref-branch')).length === 0,
      'the branch the worktree holds is not drawn a second time',
    );
    const cells = worktreeChips[0] ? collect(worktreeChips[0], byClass('dsh-gw-ref-worktree-label')) : [];
    check(
      cells.length === 1 && cells[0].children.includes('worktree'),
      'the first cell is the worktree label',
    );
    const held = worktreeChips[0] ? collect(worktreeChips[0], byClass('dsh-gw-ref-worktree-held')) : [];
    check(
      held.length === 1 && held[0].children.some((child) => child
        && child.props && child.props.className === 'dsh-gw-ref-worktree-name'
        && child.children.includes('main')),
      'the second cell names the branch the worktree holds',
    );
    check(
      Boolean(worktreeChips[0]) && worktreeChips[0].props.style['--dsh-gw-ref-color'] !== undefined,
      'the branch cell takes the commit lane colour',
    );
    // Detached: the same row, with the worktree holding no branch. The chip keeps
    // both cells — it still has to say which worktree it is about.
    const detachedPanel = panel([heldNode]);
    detachedPanel.graph = { ...detachedPanel.graph, head: heldNode.id, branch: null };
    const detachedTree = renderWith(detachedPanel, 'verify-detached');
    const detachedChips = collect(detachedTree, byClass('dsh-gw-ref-worktree'));
    check(detachedChips.length === 1, `a detached worktree draws one worktree chip (${detachedChips.length})`);
    const detachedCells = detachedChips[0] ? collect(detachedChips[0], byClass('dsh-gw-ref-worktree-label')) : [];
    check(
      detachedCells.length === 1 && detachedCells[0].children.includes('worktree'),
      'a detached worktree still names the worktree it is',
    );
    const detachedName = detachedChips[0] ? collect(detachedChips[0], byClass('dsh-gw-ref-worktree-name')) : [];
    check(
      detachedName.length === 1 && detachedName[0].children.includes('HEAD'),
      'a detached worktree reads HEAD where a branch name would stand',
    );
    const detachedIcon = detachedChips[0] ? collect(detachedChips[0], byClass('dsh-gw-ref-worktree-icon')) : [];
    check(
      detachedIcon.length === 1
      && collect(detachedIcon[0], (elementProps, type) => type === 'circle').length === 1
      && collect(detachedIcon[0], (elementProps, type) => type === 'path').length === 0,
      'the detached chip draws the hollow ring, not a glyph outline',
    );

    // Every read is a promise chain, and a callback that dies on a free
    // identifier never reaches a render: the graph read once stopped arriving
    // and the panel said only "still reading". Run the effects against a stub
    // fetch so that death surfaces as an unhandled rejection here.
    const realWindow = sandbox.window;
    const rejections = [];
    const trackRejection = (reason) => { rejections.push(reason); };
    let reads = 0;
    try {
      sandbox.window = { location: { origin: 'http://verify.invalid' } };
      sandbox.AbortController = AbortController;
      sandbox.URL = URL;
      // The browser half legitimately reaches for the page's timer when it waits
      // between retries, so the sandbox has to hand it one like any other global.
      sandbox.setTimeout = setTimeout;
      sandbox.fetch = async (url) => {
        reads += 1;
        const action = String(url).split('/').pop().split('?')[0];
        const data = action === 'worktrees'
          ? { repo: { root: 'C:/repo', branch: 'main', head: 'a'.repeat(40) }, worktrees: panel([]).worktrees, capabilities: ['uncommitted-v1'] }
          : { nodes: [], edges: [], branches: ['main'], head: 'a'.repeat(40), unborn: false, scope: 'all', skip: 0 };
        return { ok: true, json: async () => ({ ok: true, data }) };
      };
      // Registering the listener also suppresses Node's default crash-on-reject,
      // so the assertion below is what reports the failure.
      process.on('unhandledRejection', trackRejection);
      effectsEnabled = true;
      effects.length = 0;
      // `resolved: true` and a matching session id let the graph effect past its
      // re-entry guard, which is where the request is actually issued.
      renderWith(panel([node]), 'verify');
      const cleanups = [];
      for (const effect of effects.splice(0)) {
        const cleanup = effect();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      }
      // fetch → json → then is three microtask hops; the macrotask also lets
      // Node decide the unhandled-rejection question.
      await new Promise((resolve) => setTimeout(resolve, 5));
      for (const cleanup of cleanups) cleanup();
      check(reads > 0, 'the read-effect case issues a read, so its assertions are not vacuous');
      check(
        rejections.length === 0,
        `the panel's reads settle without throwing (${rejections.map((reason) => (reason && reason.message) || reason).join('; ') || 'none'})`,
      );

      // The first read after a Host restart can arrive before the Host knows this
      // Session, and the panel answers that with a retry instead of a dead error.
      // A read that fails twice and then answers has to be issued a third time.
      let attempts = 0;
      sandbox.fetch = async (url) => {
        const action = String(url).split('/').pop().split('?')[0];
        if (action !== 'worktrees') {
          const data = { nodes: [], edges: [], branches: ['main'], head: 'a'.repeat(40), unborn: false, scope: 'all', skip: 0 };
          return { ok: true, json: async () => ({ ok: true, data }) };
        }
        attempts += 1;
        if (attempts < 3) return { ok: false, status: 503, json: async () => ({ ok: false, error: 'the Session is not back yet' }) };
        const data = { repo: { root: 'C:/repo', branch: 'main', head: 'a'.repeat(40) }, worktrees: panel([]).worktrees, capabilities: ['uncommitted-v1'] };
        return { ok: true, json: async () => ({ ok: true, data }) };
      };
      effects.length = 0;
      renderWith(panel([node]), 'verify-retry');
      const retryCleanups = [];
      for (const effect of effects.splice(0)) {
        const cleanup = effect();
        if (typeof cleanup === 'function') retryCleanups.push(cleanup);
      }
      await new Promise((resolve) => setTimeout(resolve, 1400));
      for (const cleanup of retryCleanups) cleanup();
      check(
        attempts >= 3,
        `a Session read that fails while the Host is starting is retried (${attempts} attempts)`,
      );
    } catch (error) {
      check(false, `running the panel's read effects threw: ${error.message}`);
    } finally {
      effectsEnabled = false;
      process.off('unhandledRejection', trackRejection);
      sandbox.window = realWindow;
      delete sandbox.AbortController;
      delete sandbox.URL;
      delete sandbox.setTimeout;
      delete sandbox.fetch;
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
  // `layoutLanes` places the crossings, so it reads the row height and the two
  // slots; both are declared with the other geometry constants, outside the slice.
  const rowHeight = Number(/const ROW = (\d+)/.exec(source)?.[1]);
  const near = Number(/const CROSS_NEAR = (\d+)/.exec(source)?.[1]);
  const far = Number(/const CROSS_FAR = ([^;]+);/.exec(source)?.[1].replace('ROW', rowHeight));
  const layoutLanes = start >= 0 && end > start
    ? new Function('ROW', 'CROSS_NEAR', 'CROSS_FAR', `${source.slice(start, end)}; return layoutLanes;`)(rowHeight, near, far)
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
    // Interleaved branches are the common case in a busy repository: a column left
    // waiting for a commit that already arrived collapses, and the branches still
    // running slide into it. An older commit is then drawn further left than the
    // row before it, and the lane bends on the way — which is the point.
    const sliding = layoutLanes([
      { id: 'top', parents: ['trunk'] },
      { id: 'side', parents: ['tail'] },
      { id: 'trunk', parents: [] },
      { id: 'tail', parents: [] },
    ]);
    check(
      sliding.lanes[1] === 1 && sliding.lanes[3] === 0,
      `an older branch slides left into a column a finished one vacates (${sliding.lanes.join(', ')})`,
    );
    const slideEdge = sliding.edges.find((edge) => edge.parent === 'tail');
    check(
      Boolean(slideEdge) && slideEdge.fromLane === 1 && slideEdge.toLane === 0,
      'the edge that slides is read back from where its rows were drawn, not from when it was queued',
    );
    // Every column the parent moves to is a step of its own, so the drawing walks
    // the lane across rather than reaching over a column another branch runs in.
    check(
      Boolean(slideEdge) && slideEdge.route.every((step, index) => {
        const previous = index === 0 ? slideEdge.fromLane : slideEdge.route[index - 1].lane;
        return Math.abs(step.lane - previous) <= 1;
      }) && Math.abs(slideEdge.toLane - (slideEdge.route[slideEdge.route.length - 1] || { lane: slideEdge.fromLane }).lane) <= 1,
      `a slide is taken one column at a time (${(slideEdge?.route || []).map((step) => step.lane).join(' -> ') || 'none'})`,
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

      // "Show Remote Branches" scopes the history, not only the labels, so
      // `remote=0` must drop every commit that only a refs/remotes ref reaches.
      // The commits are built with plumbing so the scratch worktree keeps the
      // uncommitted changes the checks above just asserted.
      const headTree = run(['rev-parse', 'HEAD^{tree}']).stdout.trim();
      const remoteOnly = run(['commit-tree', headTree, '-p', 'HEAD', '-m', 'remote only']).stdout.trim();
      run(['update-ref', 'refs/remotes/origin/only', remoteOnly]);
      const withRemote = await host.graphPayload(query({ repo: scratch, scope: 'all', limit: 50 }), config);
      check(
        withRemote.nodes.some((node) => node.subject === 'remote only'),
        'the graph reaches remote-only history by default',
      );
      const localOnly = await host.graphPayload(query({ repo: scratch, scope: 'all', remote: '0', limit: 50 }), config);
      check(
        !localOnly.nodes.some((node) => node.subject === 'remote only'),
        'remote=0 drops a commit that only refs/remotes reaches',
      );
      check(
        localOnly.nodes.length === withRemote.nodes.length - 1,
        `remote=0 shrinks the graph by exactly that commit (${withRemote.nodes.length} -> ${localOnly.nodes.length})`,
      );
      const deepRemote = run(['commit-tree', headTree, '-p', 'HEAD', '-m', 'deep remote only']).stdout.trim();
      run(['update-ref', 'refs/remotes/origin/feature/deep', deepRemote]);
      const localDeep = await host.graphPayload(query({ repo: scratch, scope: 'all', remote: '0', limit: 50 }), config);
      check(
        !localDeep.nodes.some((node) => node.subject === 'deep remote only'),
        'remote=0 also drops a nested refs/remotes name',
      );
      // An older browser half never sends the parameter; it must keep every ref.
      const legacyClient = await host.graphPayload(query({ repo: scratch, scope: 'all', limit: 50 }), config);
      check(
        legacyClient.nodes.some((node) => node.subject === 'remote only')
        && legacyClient.nodes.some((node) => node.subject === 'deep remote only'),
        'a client that omits remote keeps the full history',
      );

      // A row's "+N" badge is `refCount` minus the refs the browser can draw, so
      // both must describe the same set. The tip commit here carries a local
      // branch, a remote mirror, a tag and a stash at once: the row may draw only
      // the branch and the worktree chip, and the count must agree with it however
      // many other refs sit on that commit. Whether the remote refs are walked at
      // all is a question about the history, not about the row.
      const localTip = run(['rev-parse', 'HEAD']).stdout.trim();
      run(['update-ref', 'refs/remotes/origin/mirror', localTip]);
      run(['update-ref', 'refs/tags/row-tag', localTip]);
      run(['update-ref', 'refs/stash', localTip]);
      const withExtras = await host.graphPayload(query({ repo: scratch, scope: 'all', limit: 50 }), config);
      const remoteOff = await host.graphPayload(query({ repo: scratch, scope: 'all', remote: '0', limit: 50 }), config);
      const rowWithExtras = withExtras.nodes.find((node) => node.id === localTip);
      const rowRemoteOff = remoteOff.nodes.find((node) => node.id === localTip);
      const sentKinds = [...new Set((rowWithExtras?.refs ?? []).map((ref) => ref.kind))];
      check(
        sentKinds.length > 0 && sentKinds.every((kind) => kind === 'branch' || kind === 'worktree'),
        `a row carries local branches and the worktree chip only (${sentKinds.join(', ') || 'none'})`,
      );
      check(
        rowWithExtras?.refCount === (rowWithExtras?.refs ?? []).length,
        `refCount describes the refs that were sent (${rowWithExtras?.refCount} for ${(rowWithExtras?.refs ?? []).length})`,
      );
      check(
        rowRemoteOff?.refCount === rowWithExtras?.refCount,
        `the remote-refs choice changes the history, not what a row draws (${rowWithExtras?.refCount})`,
      );
      // The mirrors a branch shares its commit with are what "Show Remote
      // Branches" also controls: the row is still one branch chip, but that chip
      // now says `origin`. A remote-tracking ref is never a cell of its own, so
      // the counts asserted above must not move when the mirror appears.
      run(['update-ref', `refs/remotes/origin/${primaryBranch}`, localTip]);
      const withMirror = await host.graphPayload(query({ repo: scratch, scope: 'all', limit: 50 }), config);
      const mirrorOff = await host.graphPayload(query({ repo: scratch, scope: 'all', remote: '0', limit: 50 }), config);
      const mirrorRow = withMirror.nodes.find((node) => node.id === localTip);
      const mirrorRef = (mirrorRow?.refs ?? []).find((ref) => ref.kind === 'branch' && ref.name === primaryBranch);
      check(
        (mirrorRef?.linkedRemotes ?? []).some((remote) => remote.fullName === `origin/${primaryBranch}`),
        `a branch names the remote mirror it shares the commit with (${(mirrorRef?.linkedRemotes ?? []).map((remote) => remote.fullName).join(', ') || 'none'})`,
      );
      check(
        mirrorRow?.refCount === mirrorRow?.refs.length,
        'naming a mirror adds no ref of its own to the row',
      );
      const quietRow = mirrorOff.nodes.find((node) => node.id === localTip);
      const quietRef = (quietRow?.refs ?? []).find((ref) => ref.kind === 'branch' && ref.name === primaryBranch);
      check(
        (quietRef?.linkedRemotes ?? []).length === 0,
        'the same branch names no mirror once the choice is off',
      );

      // The walk's entry points are branches, tags and remote-tracking refs. A
      // commit that only this tool's own snapshot ref reaches must stay out of the
      // graph: it is a tip, and a tip drawn mid-list starts a lane with no line
      // above it, which reads as a branch out of nowhere.
      const snapshotOnly = run(['commit-tree', headTree, '-p', 'HEAD', '-m', 'snapshot only']).stdout.trim();
      run(['update-ref', 'refs/codex/snapshots/verify', snapshotOnly]);
      const stashOnly = run(['commit-tree', headTree, '-p', 'HEAD', '-m', 'stash only']).stdout.trim();
      run(['update-ref', 'refs/stash', stashOnly]);
      const walked = await host.graphPayload(query({ repo: scratch, scope: 'all', limit: 100 }), config);
      check(
        !walked.nodes.some((node) => node.id === snapshotOnly),
        'a commit only a snapshot ref reaches is not walked into the graph',
      );
      check(
        !walked.nodes.some((node) => node.id === stashOnly),
        'a commit only the stash reaches is not walked into the graph',
      );
      // A tag is still an entry point: the same shape of commit, reached by a tag,
      // stays part of the history.
      const tagOnly = run(['commit-tree', headTree, '-p', 'HEAD', '-m', 'tag only']).stdout.trim();
      run(['update-ref', 'refs/tags/verify-entry', tagOnly]);
      const withTag = await host.graphPayload(query({ repo: scratch, scope: 'all', limit: 100 }), config);
      check(
        withTag.nodes.some((node) => node.id === tagOnly),
        'a commit a tag reaches is still part of the history',
      );

      // A restart serves the panel's first read before the Host knows the Session.
      // The Session's working directory is therefore looked up again for a moment
      // instead of being replaced by the Host's own start directory — the fallback
      // that made the panel announce "No Git repository found. Tried —
      // C:\Users\<user>", the right message about a directory the tab never asked
      // about. A caller with an explicit repo still wins, and a Session that never
      // arrives is named rather than papered over.
      const scratchName = scratch.split(/[\\/]/).pop().toLowerCase();
      const knownSession = {
        ctx: { get: () => ({ get: (id) => (id === 'verify-session' ? { header: { cwd: scratch } } : undefined) }) },
        commitLimit: 50,
        sessionWaitMs: 0,
      };
      const fromSession = await host.worktreesPayload(query({ session: 'verify-session' }), knownSession);
      check(
        fromSession.repo.root.toLowerCase().includes(scratchName),
        `the Session's own working directory is what gets read (${fromSession.repo.root})`,
      );

      let lookups = 0;
      const lateSession = {
        ctx: {
          get: () => ({
            get: () => {
              lookups += 1;
              return lookups >= 3 ? { header: { cwd: scratch } } : undefined;
            },
          }),
        },
        commitLimit: 50,
        sessionWaitMs: 2000,
      };
      const late = await host.worktreesPayload(query({ session: 'verify-late' }), lateSession);
      check(
        lookups >= 3 && late.repo.root.toLowerCase().includes(scratchName),
        `a Session that registers during the wait is read from its own workspace (${lookups} lookups)`,
      );

      const unknownSession = { ctx: { get: () => undefined }, defaultRepo: scratch, commitLimit: 50, sessionWaitMs: 0 };
      let sessionError = null;
      try {
        await host.worktreesPayload(query({ session: 'verify-never' }), unknownSession);
      } catch (error) {
        sessionError = error;
      }
      check(
        Boolean(sessionError) && String(sessionError.message).includes('verify-never'),
        `an unknown Session is named rather than replaced by another repository (${sessionError ? String(sessionError.message).slice(0, 56) : 'no error'})`,
      );
      check(
        Boolean(sessionError) && !String(sessionError.message).includes(scratchName),
        'the fallback repository is never offered to a caller that named a Session',
      );
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
