// bun mods/kt-panel-head/surfaces.check.mjs: the panel's segment names (#91). A name written in main.js'
// SURFACES stays as is in every language, so it must be a product's or a view's own name (NAMES below);
// any other is null there and translated under its id in strings.js, fr and en. The i18n audit can't see
// it (an array's string isn't in a UI place): « CONTEXT » showed in English in a French window.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import strings from "./strings.js";

const NAMES = ["Files", "Changes", "History", "Flow", "Crosstalk", "GWM"];
const src = readFileSync(join(import.meta.dir, "main.js"), "utf8");
const block = /const SURFACES = \[([\s\S]*?)\n\];/.exec(src)?.[1] ?? "";
const rows = [...block.matchAll(/\[\s*"([^"]+)"\s*,\s*(null|"[^"]*")\s*,/g)].map((m) => [m[1], m[2] === "null" ? null : m[2].slice(1, -1)]);

let fails = 0;
const fail = (msg) => { fails++; console.error(`FAIL ${msg}`); };
if (rows.length < 7) fail(`SURFACES not read (${rows.length} rows)`);
for (const [id, name] of rows) {
  if (name != null && !NAMES.includes(name)) fail(`${id}: « ${name} » is written as is: a plain word goes in strings.js (null here)`);
  if (name == null) for (const l of ["fr", "en"]) if (!strings[l]?.[id]) fail(`${id}: no ${l} name in strings.js`);
}
if (strings.fr.context !== "Contexte") fail(`context: fr « ${strings.fr.context} », not « Contexte »`);
if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log(`surfaces: ok (${rows.length})`);
