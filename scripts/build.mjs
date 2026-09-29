/**
 * Build the plugin's two halves from their TypeScript sources.
 *
 * The package is installed as-is: the manifest declares no runtime dependencies
 * and the installer fetches nothing, so the Git core and the React view are
 * compiled into each half — `lib/index.js` for the host and `lib/client.js` for
 * the browser — and committed, so a fresh checkout installs directly.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The host half: an ES module the DSH Loader imports.
await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile: resolve(root, 'lib/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  logLevel: 'warning',
});

// The browser half: a classic script the client module loader evaluates at load
// time, so the bundle is wrapped in the one call that registers it. `react` stays
// external and is resolved through the loader's own module table — the host
// renders this component, so a second copy of React would break its hooks.
// The built-in UI primitives are also resolved there, giving this tab the
// same PathLabel and refresh artwork as the Files tab.
const browser = await build({
  entryPoints: [resolve(root, 'src/client.ts')],
  outfile: resolve(root, 'lib/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['react', '@deepseek-ai/dsh-client-ui-primitives'],
  loader: { '.css': 'local-css' },
  write: false,
  minify: false,
  legalComments: 'inline',
  logLevel: 'warning',
  banner: {
    js: 'window.__ModuleLoader__.load({\n  id: "@JinzhaoTian/git-worktree-graph",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;',
  },
  footer: {
    js: '    return module.exports.default ?? module.exports;\n  },\n});',
  },
});

// The DSH Module Loader accepts one browser script. esbuild gives CSS Modules
// their scoped class names and emits a stylesheet; embed the compiled sheet at
// the view's style marker so it mounts with the tab inside the loader lifecycle.
const script = browser.outputFiles.find((file) => file.path.endsWith('/client.js'));
const sheet = browser.outputFiles.find((file) => file.path.endsWith('/client.css'));
if (!script || !sheet) throw new Error('Browser build did not produce its script and CSS Module.');
const marker = JSON.stringify('__DSH_GIT_WORKTREE_GRAPH_STYLESHEET__');
if (!script.text.includes(marker)) throw new Error('Browser build lost its CSS Module marker.');
await writeFile(resolve(root, 'lib/client.js'), script.text.replace(marker, JSON.stringify(sheet.text)));
