/**
 * A minimal, dependency-free Chrome DevTools Protocol client.
 *
 * Geometry has to run on Windows, macOS and Linux, and the two obvious shortcuts
 * do not survive that requirement:
 *
 * 1. **No WebSocket package.** This file carries its own handshake and framing —
 *    a few dozen lines — rather than depending on a package the repository does
 *    not declare, so the check runs from a fresh checkout with `npm install` only.
 *
 * 2. **No page-target socket.** A page target's `webSocketDebuggerUrl` still
 *    accepts the upgrade on current Chrome and then answers nothing, which is
 *    exactly how this check used to hang. The browser endpoint is the one that
 *    works, so every page command is routed through an attached session
 *    (`Target.attachToTarget` with `flatten: true`).
 *
 * It also refuses to hang: every command carries a deadline, and a renderer that
 * dies is noticed through `Inspector.targetCrashed` and retried once with the
 * sandbox disabled. Chrome's renderer sandbox cannot start in some containers
 * and CI images, and that failure is otherwise silent — no command ever answers,
 * which is indistinguishable from a slow machine.
 */
import net from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Where each platform keeps Chrome or Edge, in the order worth trying. */
const BROWSERS = [
  process.env.GIT_WORKTREE_BROWSER,
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The first installed browser, or null when this machine has none. */
export async function findBrowser() {
  for (const candidate of BROWSERS) {
    if (!candidate) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/** One TCP port that was free a moment ago. */
async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

/**
 * A WebSocket carrying CDP text frames.
 *
 * Only what CDP needs: a masked client handshake, text frames both ways, and
 * fragmentation reassembly. Chrome never sends ping frames during a short
 * measurement, and a close frame ends the read loop.
 */
function openSocket(url) {
  const target = new URL(url);
  const key = randomBytes(16).toString('base64');
  const socket = net.connect(Number(target.port), target.hostname);
  const handlers = [];
  let buffer = Buffer.alloc(0);
  let handshakeDone = false;
  let fragments = [];

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!handshakeDone) {
      const end = buffer.indexOf('\r\n\r\n');
      if (end < 0) return;
      const head = buffer.subarray(0, end).toString('latin1');
      const expected = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
      if (!head.includes(expected)) throw new Error(`DevTools refused the WebSocket upgrade: ${head.split('\r\n')[0]}`);
      buffer = buffer.subarray(end + 4);
      handshakeDone = true;
    }
    for (;;) {
      if (buffer.length < 2) return;
      const fin = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      let length = buffer[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        length = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if (buffer.length < offset + length) return;
      const payload = buffer.subarray(offset, offset + length);
      buffer = buffer.subarray(offset + length);
      if (opcode === 0x8) {
        socket.end();
        return;
      }
      if (opcode === 0x9 || opcode === 0xA) continue;
      if (opcode === 0x1 || opcode === 0x0) fragments.push(payload);
      if (fin && fragments.length > 0) {
        const text = Buffer.concat(fragments).toString('utf8');
        fragments = [];
        for (const handler of handlers) handler(text);
      }
    }
  });

  const ready = (async () => {
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    socket.write([
      `GET ${target.pathname} HTTP/1.1`,
      `Host: ${target.host}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      '', '',
    ].join('\r\n'));
    const deadline = Date.now() + 10_000;
    while (!handshakeDone) {
      if (Date.now() > deadline) throw new Error('DevTools never finished the WebSocket handshake.');
      await sleep(10);
    }
  })();

  return {
    ready,
    onMessage(handler) { handlers.push(handler); },
    send(text) {
      const payload = Buffer.from(text, 'utf8');
      const mask = randomBytes(4);
      let header;
      if (payload.length < 126) {
        header = Buffer.from([0x81, 0x80 | payload.length]);
      } else if (payload.length < 65_536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(payload.length, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(payload.length), 2);
      }
      const masked = Buffer.from(payload);
      for (let index = 0; index < masked.length; index += 1) masked[index] ^= mask[index % 4];
      socket.write(Buffer.concat([header, mask, masked]));
    },
    close() { socket.destroy(); },
  };
}

/** Poll the DevTools HTTP endpoint until it answers. */
async function waitForEndpoint(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return await response.json();
    } catch {
      // The browser is not listening yet.
    }
    if (Date.now() > deadline) throw new Error(`The browser never exposed its DevTools endpoint on port ${port}.`);
    await sleep(200);
  }
}

/** One browser process with an attached page session. */
async function startOnce(binary, { url, timeoutMs, sandboxArgs }) {
  const port = await freePort();
  const profile = await mkdtemp(join(tmpdir(), 'git-worktree-cdp-'));
  const child = spawn(binary, [
    '--headless',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1400,1400',
    ...sandboxArgs,
    'about:blank',
  ], { stdio: 'ignore' });

  let socket = null;
  let crashed = false;
  const cleanup = async () => {
    socket?.close();
    child.kill('SIGKILL');
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  };

  try {
    const version = await waitForEndpoint(port, timeoutMs);
    socket = openSocket(version.webSocketDebuggerUrl);
    await socket.ready;

    let nextId = 1;
    const pending = new Map();
    socket.onMessage((raw) => {
      const message = JSON.parse(raw);
      if (message.method === 'Inspector.targetCrashed') {
        // A dead renderer never answers, so waiting out each command's deadline
        // would spend the whole timeout learning what this event already says.
        crashed = true;
        for (const [id, waiter] of pending) {
          pending.delete(id);
          clearTimeout(waiter.timer);
          waiter.reject(new Error(`${waiter.method}: the renderer process crashed.`));
        }
        return;
      }
      if (!message.id) return;
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(`${waiter.method}: ${JSON.stringify(message.error)}`));
      else waiter.resolve(message.result);
    });

    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(crashed
          ? `${method} never answered: the browser's renderer process crashed.`
          : `${method} never answered within ${timeoutMs} ms.`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer, method });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

    const created = await send('Target.createTarget', { url });
    const attached = await send('Target.attachToTarget', { targetId: created.targetId, flatten: true });
    const page = attached.sessionId;
    await send('Page.enable', {}, page);
    return {
      send: (method, params) => send(method, params, page),
      close: cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/**
 * Attach to a headless browser page and hand it to `use`.
 *
 * The sandbox is kept when it works. Chrome's renderer cannot start inside some
 * containers and CI images, and that shows up only as commands that never
 * answer, so a failed first attempt is retried once with the sandbox disabled
 * and the retry is what the caller is told about.
 */
export async function withPage({ url, use, timeoutMs = 15_000 }) {
  const binary = await findBrowser();
  if (!binary) throw new Error('No Chrome or Edge binary found; set GIT_WORKTREE_BROWSER to one.');
  const attempts = [
    { sandboxArgs: [], note: 'the renderer sandbox on' },
    { sandboxArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'], note: 'the renderer sandbox off' },
  ];
  let lastError = null;
  for (const attempt of attempts) {
    let session = null;
    try {
      session = await startOnce(binary, { url, timeoutMs, sandboxArgs: attempt.sandboxArgs });
      return await use(session, { binary, sandbox: attempt.note });
    } catch (error) {
      lastError = error;
    } finally {
      // Closing on the way out either way: an open socket holds the event loop
      // open, so a successful measurement would otherwise hang the script.
      await session?.close().catch(() => {});
    }
  }
  throw lastError ?? new Error('The browser could not be attached to.');
}
