// bun archived.check.mjs : #88, an archived project leaves « Tous les projets », as it leaves the
// sidebar and kt-project-picker. The list goes through projects.js shown() (a copy of kt-threads', kt-mods
// SHARED): checked on that copy, then on main.js' source. Made-up projects.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shown } from "./projects.js";

const reg = [
  { id: "a", name: "alpha", folder: "/r/a", order: 0 },
  { id: "b", name: "beta", folder: "/r/b", order: 1, archived: 1795000000000 },
];
assert.deepEqual(shown(reg).map((e) => e.name), ["alpha"]);
const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
assert.match(main, /import \{[^}]*\bshown\b[^}]*\} from "\.\/projects\.js"/, "main.js imports shown from projects.js");
assert.match(main, /const projects = shown\(registry\(\)\)/, "« Tous les projets » lists the shown projects (not archived)");
console.log("kt-notes archived: ok");
