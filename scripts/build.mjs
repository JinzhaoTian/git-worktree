import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });
for (const [entry, outfile] of [
  ["src/ui/index.tsx", "dist/ui.js"],
  ["src/ui/browser.tsx", "dist/ui-browser.js"]
]) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    write: false,
    outfile,
    minify: true
  });
  for (const file of result.outputFiles) await writeFile(file.path, file.contents);
}
