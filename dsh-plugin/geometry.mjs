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
console.log('\nToolbar geometry holds at every measured width.');
