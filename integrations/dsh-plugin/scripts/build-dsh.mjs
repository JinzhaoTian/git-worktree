/**
 * Build the DSH bundle's two halves from their TypeScript sources.
 *
 * The plugin directory is installed into a DSH profile as-is: its manifest
 * declares no dependencies and the installer fetches nothing. So both halves are
 * bundled — the `src/core` and `src/ui` code is compiled in rather than
 * resolved at runtime — and neither is minified, because the pre-install check
 * reads the built host half and drives the built browser half.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const integration = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The host half: an ES module the DSH Loader imports, with every payload
// function exported so the pre-install check can drive them directly.
await build({
  entryPoints: [resolve(integration, 'src/host.ts')],
  outfile: resolve(integration, 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  logLevel: 'warning',
});

// The browser half: a classic script the module loader evaluates at load time,
// so the bundle is wrapped in the one call that registers it. `react` stays
// external and is resolved through the loader's own module table — the host
// renders this component, so a second copy of React would break its hooks.
await build({
  entryPoints: [resolve(integration, 'src/client.ts')],
  outfile: resolve(integration, 'client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['react'],
  minify: false,
  legalComments: 'inline',
  logLevel: 'warning',
  banner: {
    js: 'window.__ModuleLoader__.load({ id: "@local/dsh-git-worktree", factory(require) { var module = { exports: {} }; var exports = module.exports;',
  },
  footer: {
    js: 'return module.exports.default ?? module.exports; } });',
  },
});
