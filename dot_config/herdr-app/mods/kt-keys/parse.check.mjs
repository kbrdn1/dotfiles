// bun ~/.config/herdr-app/mods/kt-keys/parse.check.mjs [mod folder…]: every mod's main.js, and each module it
// imports from its own folder (followed import by import), read by a real ES module parser (bun's transpiler).
// The app's runtime forgives what a module may not hold: a name declared twice at the top level loads, the last
// one winning without a word (kt-threads, 2026-11-19: `import * as registry` hidden by its own `const registry`,
// every registry.<fn> undefined for a day). Here it fails, with the file and the parser's message, like any other
// syntax error. Without arguments: every folder of mods/ that has a main.js. Not loaded by Herdr.
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";

const MODS = resolve(dirname(new URL(import.meta.url).pathname), "..");
const folders = process.argv.length > 2
  ? process.argv.slice(2).map((p) => resolve(p))
  : readdirSync(MODS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(MODS, d.name));

const transpiler = new Bun.Transpiler({ loader: "js" });
const seen = new Set();
const failed = [];
let files = 0;

// One module, then the relative imports it names (inside its mod folder only: herdr, gpui-kit… are the app's).
function check(file, root) {
  if (seen.has(file)) return;
  seen.add(file);
  files++;
  const code = readFileSync(file, "utf8");
  try {
    transpiler.transformSync(code);
  } catch (e) {
    failed.push(`${relative(MODS, file)}: ${String(e?.message ?? e).split("\n")[0]}`);
    return;
  }
  for (const { path } of transpiler.scanImports(code)) {
    if (!path.startsWith(".")) continue;
    const next = resolve(dirname(file), path);
    if (next.startsWith(root) && existsSync(next)) check(next, root);
  }
}

for (const folder of folders) {
  const main = join(folder, "main.js");
  if (existsSync(main)) check(main, folder);
}

if (failed.length) {
  console.error(`parse: ${failed.length} module(s) a real parser refuses:\n${failed.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log(`parse: ok (${files} modules in ${folders.length} folders)`);
