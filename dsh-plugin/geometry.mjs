/**
 * Toolbar geometry check for the DSH Git Worktree bundle.
 *
 * Run with:  node dsh-plugin/geometry.mjs
 *
 * The toolbar chip carries a worktree path, and a path is the one string in this
 * panel that can be arbitrarily long. `verify.mjs` checks the shortening rule as
 * a function, but nothing there measures the result: only a layout engine can
 * answer whether the chip, its text and its status dot still fit the toolbar at
 * the widths a docked right-sidebar panel actually takes.
 *
 * So this renders the real stylesheet and the real chip markup out of `client.js`
 * in headless Chrome and reads the boxes back. It never installs anything and
 * never touches the network; it only needs a Chrome or Edge binary on this
 * machine, and it says so and exits non-zero when it cannot find one.
 */
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));
const failures = [];

function check(condition, message) {
  if (condition) console.log(`  ok   ${message}`);
  else failures.push(message);
}

/** Light-theme values of the host tokens the toolbar uses, as the theme ships them. */
const HOST_TOKENS = {
  '--dsw-alias-label-primary': '#0f1115',
  '--dsw-alias-label-secondary': '#545557',
  '--dsw-alias-bg-base': '#ffffff',
  '--dsw-alias-bg-layer-1': '#ffffff',
  '--dsw-alias-bg-layer-2': '#ffffff',
  '--dsw-alias-border-l1': 'rgba(0,0,0,0.04)',
  '--dsw-alias-border-l2': 'rgba(0,0,0,0.10)',
  '--dsw-alias-brand-primary': '#0f1115',
  '--dsw-alias-state-warn-primary': '#f59e0b',
  '--dsw-alias-state-success-primary': '#22c55e',
  '--dsw-alias-state-error-primary': '#dc2626',
  '--dsw-specific-sidebar-fill': '#fafafa',
};

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

async function findBrowser() {
  for (const candidate of BROWSERS) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next one.
    }
  }
  return null;
}

const client = await readFile(join(here, 'client.js'), 'utf8');
const stylesheet = /const CSS = `([\s\S]*?)`;/.exec(client)?.[1];
if (!stylesheet) {
  console.error('Could not read the stylesheet out of client.js.');
  process.exit(1);
}

// The shortening rule straight out of the bundle, so the rendered text is the
// text the panel really draws.
const ruleStart = client.indexOf('const PATH_MIN_SAVING');
const ruleEnd = client.indexOf('function shortOid');
const compactPath = ruleStart >= 0 && ruleEnd > ruleStart
  ? new Function(`${client.slice(ruleStart, ruleEnd)}; return compactPath;`)()
  : null;
if (!compactPath) {
  console.error('Could not read compactPath out of client.js.');
  process.exit(1);
}

// The commit grid's own column template, straight out of the bundle's layout, so
// the markup below is handed the `--dsh-gw-cols` the panel really writes. The
// page under test is the ordinary state of a long history: its oldest commit's
// parent has not been fetched yet, so one edge leaves the page.
const GRID_WIDTHS = [260, 380, 520];
const graphColumns = (() => {
  const start = client.indexOf('function layoutLanes');
  const end = client.indexOf('function strokeWidthFor');
  if (start < 0 || end <= start) return null;
  const row = Number(/const ROW = (\d+)/.exec(client)?.[1]);
  const near = Number(/const CROSS_NEAR = (\d+)/.exec(client)?.[1]);
  const far = Number(/const CROSS_FAR = ([^;]+);/.exec(client)?.[1].replace('ROW', row));
  const layoutLanes = new Function('ROW', 'CROSS_NEAR', 'CROSS_FAR', `${client.slice(start, end)}; return layoutLanes;`)(row, near, far);
  const pad = Number(/const PAD = (\d+)/.exec(client)?.[1]);
  const column = Number(/const COL = (\d+)/.exec(client)?.[1]);
  const margin = Number(/const MARGIN = (\d+)/.exec(client)?.[1]);
  const layout = layoutLanes([
    { id: 'p3', parents: ['p2'] },
    { id: 'p2', parents: ['p1'] },
    { id: 'p1', parents: ['p0'] },
  ]);
  return { track: Math.max(64, pad + layout.width * column + margin), layoutWidth: layout.width };
})();
if (!graphColumns) {
  console.error('Could not read layoutLanes out of client.js.');
  process.exit(1);
}
const gridCols = `${graphColumns.track}px minmax(0, 1fr)`;

const PATHS = [
  ['reported', 'E:/www.p6c/ThBIMWindowsUI'],
  ['long-name', 'E:/workspace/ThBIMWindowsUI'],
  ['over-long', 'C:/Users/someone/AppData/Local/Temp/AnExtraordinarilyLongWorktreeFolderName'],
  ['short', 'D:/x'],
];
const WIDTHS = [260, 380, 520, 640, 780];

/** The chip exactly as the toolbar renders it, with the state dot before the path. */
const toolbar = (path) => `
  <div class="dsh-gw" style="height:120px">
    <div class="dsh-gw-tbar">
      <span class="dsh-gw-wt dsh-gw-wt-current" title="${path} — main">
        <span class="dsh-gw-dot"></span>
        <span class="dsh-gw-subjtext">${compactPath(path)}</span>
      </span>
      <label class="dsh-gw-check"><input type="checkbox" checked> Show Remote Branches</label>
      <span class="dsh-gw-spacer"></span>
      <div class="dsh-gw-icons">
        <button class="dsh-gw-iconbtn" type="button"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M2 8h12M2 12h12"/></svg></button>
        <button class="dsh-gw-iconbtn" type="button"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 8a5 5 0 1 1-1.6-3.7M13 2v3h-3"/></svg></button>
      </div>
    </div>
  </div>`;

let sections = '';
for (const [label, path] of PATHS) {
  for (const width of WIDTHS) {
    sections += `<section data-case="${label}-${width}"><p>${label} @ ${width}px</p>`
      + `<div class="frame" style="width:${width}px">${toolbar(path)}</div></section>`;
  }
}

// One commit row and the header, exactly as the panel builds them: the graph
// column's cell, then the description cell. A history is longer than one page, so
// the header is the two columns a panel under 560px wide shows.
const gridCell = (index) => `
      <div class="dsh-gw-gcell"><svg width="${graphColumns.track}" height="26" aria-hidden="true">
        <line x1="17" y1="0" x2="17" y2="26" stroke="#4a7dff" stroke-width="1.6"/>
        <circle cx="17" cy="13" r="4.5" fill="#fff" stroke="#4a7dff" stroke-width="2"/></svg></div>
      <div class="dsh-gw-cell"><div class="dsh-gw-subj"><span class="dsh-gw-subjtext">commit number ${index}</span></div></div>`;
const gridRow = (index) => `
    <div class="dsh-gw-row" style="--dsh-gw-cols: ${gridCols}" role="button" tabindex="0">
      ${gridCell(index)}
    </div>`;
const grid = (width) => `
  <section data-grid="${width}"><p>paged graph @ ${width}px</p>
    <div class="frame" style="width:${width}px"><div class="dsh-gw"><div class="dsh-gw-scroll"><div class="dsh-gw-grid">
      <div class="dsh-gw-hrow" style="--dsh-gw-cols: ${gridCols}">
        <div class="dsh-gw-hcell">Graph</div><div class="dsh-gw-hcell">Description</div>
      </div>
      ${[0, 1, 2, 3, 4].map(gridRow).join('')}
    </div></div></div></div>
  </section>`;
for (const width of GRID_WIDTHS) sections += grid(width);

const tokenCss = Object.entries(HOST_TOKENS).map(([name, value]) => `${name}:${value};`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
:root{${tokenCss}}
body{margin:0;font-family:system-ui,sans-serif;background:#fff;color:#0f1115}
section{display:inline-block;vertical-align:top;margin:6px}
section p{font:11px system-ui;margin:2px 4px}
.frame{border:1px solid #bbb;box-sizing:border-box;overflow:hidden}
${stylesheet}
</style></head><body>${sections}
<script>
window.__measure = () => Array.from(document.querySelectorAll('section[data-case]')).map((section) => {
  const bar = section.querySelector('.dsh-gw-tbar');
  const chip = section.querySelector('.dsh-gw-wt');
  const dot = section.querySelector('.dsh-gw-dot');
  const text = section.querySelector('.dsh-gw-subjtext');
  const box = (el) => { const b = el.getBoundingClientRect(); return { l: +b.left.toFixed(1), r: +b.right.toFixed(1), w: +b.width.toFixed(1) }; };
  const barBox = box(bar); const chipBox = box(chip); const dotBox = box(dot);
  return {
    case: section.dataset.case,
    path: section.querySelector('.dsh-gw-wt').getAttribute('title'),
    text: text.textContent,
    chipWidth: chipBox.w,
    chipOverflowsToolbar: +(chipBox.r - barBox.r).toFixed(1),
    dotWidth: dotBox.w,
    dotInsideChip: dotBox.l >= chipBox.l - 0.5 && dotBox.r <= chipBox.r + 0.5,
    dotInsideToolbar: dotBox.l >= barBox.l - 0.5 && dotBox.r <= barBox.r + 0.5,
    dotPainted: getComputedStyle(dot).backgroundColor !== 'rgba(0, 0, 0, 0)',
    textEllipsised: text.scrollWidth > text.clientWidth,
  };
});
// The commit grid: a cell that wrapped onto a grid row of its own lands outside
// the 26px band its row clips to, so a description is measured where it is drawn,
// not by the width it would have had.
window.__measureGrid = () => Array.from(document.querySelectorAll('section[data-grid]')).map((section) => {
  const box = (el) => { const b = el.getBoundingClientRect(); return { t: +b.top.toFixed(1), b: +b.bottom.toFixed(1), l: +b.left.toFixed(1), r: +b.right.toFixed(1), w: +b.width.toFixed(1) }; };
  // Cells laid out on one line run left to right; a cell that wrapped onto a grid
  // row of its own starts back at the container's own left edge instead.
  const beside = (el) => {
    const cells = Array.from(el.children).map(box);
    return cells.length > 1 && cells.every((cell, index) => cell.w > 0 && (index === 0 || cell.l >= cells[index - 1].r - 0.5));
  };
  // Cells of different heights sit centred in one band, so they share a row when
  // each one's middle is inside that band — not when their tops are equal.
  const banded = (el) => {
    const band = box(el);
    const cells = Array.from(el.children).map(box);
    return cells.length > 1 && cells.every((cell) => {
      const middle = (cell.t + cell.b) / 2;
      return cell.w > 0 && middle >= band.t - 0.5 && middle <= band.b + 0.5;
    });
  };
  const header = section.querySelector('.dsh-gw-hrow');
  const rows = Array.from(section.querySelectorAll('.dsh-gw-row'));
  return {
    case: 'paged-' + section.dataset.grid,
    headerTracks: getComputedStyle(header).gridTemplateColumns.split(' ').length,
    headerValue: getComputedStyle(header).gridTemplateColumns,
    headerBeside: beside(header),
    cells: header.children.length,
    rows: rows.map((row) => {
      const rowBox = box(row);
      const desc = row.querySelector('.dsh-gw-cell');
      const text = row.querySelector('.dsh-gw-subjtext');
      const descBox = desc ? box(desc) : null;
      const textBox = text ? box(text) : null;
      return {
        beside: beside(row),
        banded: banded(row),
        descInsideRow: descBox !== null && descBox.t >= rowBox.t - 0.5 && descBox.b <= rowBox.b + 0.5,
        textInsideRow: textBox !== null && textBox.w > 0 && textBox.t >= rowBox.t - 0.5 && textBox.b <= rowBox.b + 0.5,
        textWidth: textBox ? textBox.w : 0,
        subject: text ? text.textContent : '',
      };
    }),
  };
});
</script></body></html>`;

const browser = await findBrowser();
if (!browser) {
  console.error('No Chrome or Edge binary found; geometry was not measured.');
  process.exit(1);
}

const workdir = await mkdtemp(join(tmpdir(), 'dsh-gw-geometry-'));
const page = join(workdir, 'toolbar.html');
const profile = join(workdir, 'profile');
await writeFile(page, html, 'utf8');

const port = 9337 + Math.floor(Math.random() * 200);
const chrome = spawn(browser, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1400,1400', '--hide-scrollbars', pathToFileURL(page).href,
], { stdio: 'ignore' });

let target = null;
for (let attempt = 0; attempt < 40 && !target; attempt += 1) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find((item) => item.type === 'page' && item.url.startsWith('file:'));
  } catch {
    // The browser is not listening yet.
  }
  if (!target) await sleep(250);
}
if (!target) {
  chrome.kill();
  await rm(workdir, { recursive: true, force: true });
  console.error('The browser started but never exposed a page.');
  process.exit(1);
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 1;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

try {
  await send('Page.enable');
  await sleep(600);
  const result = await send('Runtime.evaluate', {
    expression: 'JSON.stringify(window.__measure())', returnByValue: true,
  });
  const rows = JSON.parse(result.result.value);

  for (const row of rows) {
    const verdict = row.dotInsideToolbar && row.dotInsideChip && row.dotWidth >= 5 && row.chipOverflowsToolbar <= 0.5
      ? 'ok  '
      : 'FAIL';
    console.log(`  ${verdict} ${row.case.padEnd(16)} chip=${String(row.chipWidth).padStart(6)} overflow=${String(row.chipOverflowsToolbar).padStart(7)} dot=${row.dotWidth} ${JSON.stringify(row.text)}`);
  }
  check(rows.length === PATHS.length * WIDTHS.length, `every width and path was measured (${rows.length} cases)`);
  check(
    rows.every((row) => row.dotWidth >= 5 && row.dotInsideChip && row.dotInsideToolbar),
    'the status dot keeps its full size and stays inside the chip and the toolbar',
  );
  check(rows.every((row) => row.dotPainted), 'the status dot is painted in every case');
  check(
    rows.every((row) => row.chipOverflowsToolbar <= 0.5),
    'the chip never extends past the toolbar, so nothing is clipped outside it',
  );
  check(
    rows.filter((row) => row.textEllipsised).every((row) => row.dotInsideToolbar),
    'a path too long for the chip loses its own tail, never the dot',
  );
  // The over-long path has to actually be cut somewhere, or the chip is being
  // measured on a case that never exercises the ellipsis.
  check(
    rows.some((row) => row.textEllipsised && row.case.startsWith('over-long')),
    'the over-long path is ellipsised inside the chip',
  );

  // A graph whose history does not fit one page is the case that used to render
  // as a stack of empty stripes: the page's last edge ends on a lane with no row
  // of its own, a lane left undefined there made the column width NaN, and CSS
  // dropped the whole `grid-template-columns` declaration. Every cell of every row
  // then wrapped onto a row of its own and the fixed 26px band clipped all of them
  // but the graph — the descriptions were drawn, just never inside their row.
  const grids = JSON.parse((await send('Runtime.evaluate', {
    expression: 'JSON.stringify(window.__measureGrid())', returnByValue: true,
  })).result.value);
  for (const section of grids) {
    const row = section.rows[0];
    const laid = (entry) => entry.beside && entry.banded && entry.descInsideRow && entry.textInsideRow;
    const verdict = section.headerTracks === section.cells && section.headerBeside
      && section.rows.every(laid)
      ? 'ok  '
      : 'FAIL';
    console.log(`  ${verdict} ${section.case.padEnd(16)} tracks=${section.headerTracks} template=${JSON.stringify(section.headerValue)} desc=${row.textWidth} ${JSON.stringify(row.subject)} (layout width ${graphColumns.layoutWidth})`);
  }
  check(grids.length === GRID_WIDTHS.length, `every paged grid width was measured (${grids.length} cases)`);
  check(
    grids.every((section) => section.headerTracks === section.cells),
    'the paged grid keeps one column per cell, so nothing wraps onto a row of its own',
  );
  check(
    grids.every((section) => section.headerBeside),
    'the Graph and Description headers sit side by side in a paged grid',
  );
  check(
    grids.every((section) => section.rows.every((row) => row.beside && row.descInsideRow)),
    'every row of a paged grid draws its description beside the graph, inside its own band',
  );
  check(
    grids.every((section) => section.rows.every((row) => row.banded && row.textInsideRow && row.textWidth > 20)),
    'every commit subject of a paged grid is drawn and readable, not clipped away',
  );
} finally {
  socket.close();
  // The browser's own profile holds lock files while it exits, so the cleanup
  // waits for it and then tolerates a directory that is still not deletable. A
  // leftover temp directory is not worth failing a geometry check over.
  const exited = new Promise((resolve) => { chrome.once('exit', resolve); });
  chrome.kill();
  await Promise.race([exited, sleep(4000)]);
  await rm(workdir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}

if (failures.length > 0) {
  console.error(`\n${failures.length} geometry check(s) failed:`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log('\nToolbar geometry holds at every measured width, and a paged commit grid lays its cells out in columns.');
