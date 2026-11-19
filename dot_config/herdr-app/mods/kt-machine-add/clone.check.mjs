// bun ~/.config/herdr-app/mods/kt-machine-add/clone.check.mjs [shipped main.js] [clone main.js]: the resync rule.
// kt-machine-add is a clone of Herdr's machine-add (herdr-app 0.1.16), to resync by hand after each Herdr update.
// Its logic must stay machine-add's line for line: shellArg, I, includeFiles, parseConfig, refresh, isAdded,
// add, checkMac, and the init's ssh config read and hc timer. Only these deviations are known:
// - add()'s three messages, in strings.js (needsAnswer, noAnswer, failed);
// - add()'s refusal of a target starting with "-" (one line, after its empty-target return): machine-add hands
//   it to `hc machine add`, which reads it as an option, and down to ssh `-oProxyCommand=…` runs a command.
//   Security before likeness (2026-11-19);
// - the init's read and timer behind `if (!checking())` (one more indent): nothing reaches a machine during a
//   `herdr-app check`.
// Anything else differing, on either side, fails: « machine-add a changé : resynchroniser kt-machine-add ».
// machine-add is read where Herdr writes it (mods/machine-add, rewritten on every start); absent (a checkout
// without Herdr), the check says so and passes. Not loaded by Herdr.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const HERE = dirname(new URL(import.meta.url).pathname);
const shippedPath = process.argv[2] ?? join(HERE, "..", "machine-add", "main.js");
const clonePath = process.argv[3] ?? join(HERE, "main.js");
if (!existsSync(shippedPath)) {
  console.log(`clone: no ${shippedPath} (Herdr not here), skipped`);
  process.exit(0);
}
const shipped = readFileSync(shippedPath, "utf8").split("\n");
const clone = readFileSync(clonePath, "utf8").split("\n");

// The known deviations: a shipped line -> the clone's.
const ADD_LINES = new Map([
  ["        why = { message: (r.stderr || r.stdout || \"it didn't answer\").trim() };",
    "        why = { message: (r.stderr || r.stdout || tr(\"noAnswer\")).trim() };"],
  ["        this.state[target] = `Couldn't add ${target} here: it needs you to answer something (a password, a new host key, or installing herdr-core there). Run \\`hc machine add ${quoted}\\` in a terminal. \\`hc machine --help\\` shows the options.`;",
    "        this.state[target] = tr(\"needsAnswer\", { target, command: `hc machine add ${quoted}` });"],
  ["      } else this.state[target] = why.message || \"it didn't work\";",
    "      } else this.state[target] = why.message || tr(\"failed\");"],
]);

// A block: from the line matching `start` to the first line, at its own indentation, that closes it.
function block(lines, start, where) {
  const i = lines.findIndex((l) => start.test(l));
  if (i < 0) throw new Error(`${where}: no line matching ${start}`);
  if (/;\s*$/.test(lines[i])) return [lines[i]]; // a one-line const
  const indent = lines[i].match(/^ */)[0];
  const end = lines.findIndex((l, j) => j > i && (l === `${indent}}` || l === `${indent}});`));
  if (end < 0) throw new Error(`${where}: ${start} never closes`);
  return lines.slice(i, end + 1);
}

const failures = [];
const same = (name, a, b) => {
  if (a.length === b.length && a.every((l, k) => l === b[k])) return;
  const k = a.findIndex((l, j) => l !== b[j]);
  failures.push(`${name}: line ${k + 1} differs\n    machine-add:    ${a[k] ?? "(none)"}\n    kt-machine-add: ${b[k] ?? "(none)"}`);
};

for (const [name, start] of [
  ["I", /^const I = /],
  ["shellArg", /^const shellArg = /],
  ["includeFiles", /^async function includeFiles\(/],
  ["parseConfig", /^async function parseConfig\(/],
  ["refresh", /^ {2}async refresh\(\) \{$/],
  ["isAdded", /^ {2}isAdded\(target\) \{$/],
  ["checkMac", /^ {2}async checkMac\(target\) \{$/],
]) same(name, block(shipped, start, "machine-add"), block(clone, start, "kt-machine-add"));

// The lines the clone adds, after a shipped line.
const ADD_INSERTED = new Map([
  ["    if (!target || this.state[target] === \"adding\") return;",
    ["    if (target.startsWith(\"-\")) { this.state[target] = tr(\"dashTarget\", { target }); cx.notify(); return; } // never an option to hc (-oProxyCommand=…): not in machine-add 0.1.16"]],
]);

// add(): machine-add's, its three messages swapped for strings.js', the dash refusal inserted. A message or an
// anchor changed upstream no longer maps, and fails the same way.
const addShipped = block(shipped, /^ {2}add\(target, cx\) \{$/, "machine-add").flatMap((l) => [ADD_LINES.get(l) ?? l, ...(ADD_INSERTED.get(l) ?? [])]);
same("add", addShipped, block(clone, /^ {2}add\(target, cx\) \{$/, "kt-machine-add"));
const unmapped = [...ADD_LINES.keys(), ...ADD_INSERTED.keys()].filter((l) => !shipped.includes(l));
if (unmapped.length) failures.push(`add: a known line is gone from machine-add\n    ${unmapped.join("\n    ")}`);

// The init's ssh config read and hc timer: machine-add's lines, one indent deeper inside `if (!checking())`.
const initShipped = block(shipped, /^ {2}init\(_props, cx\) \{$/, "machine-add");
const from = initShipped.findIndex((l) => l === "    cx.spawn(async (cx) => {");
const io = initShipped.slice(from, -1);
const initClone = block(clone, /^ {2}init\(_props, cx\) \{$/, "kt-machine-add");
const at = initClone.findIndex((l) => l === "    if (!checking()) {");
if (from < 0 || at < 0) failures.push("init: the ssh config read or its checking() guard is missing");
else same("init (read and timer)", io.map((l) => `  ${l}`), initClone.slice(at + 1, at + 1 + io.length));

if (failures.length) {
  console.error(`machine-add a changé : resynchroniser kt-machine-add (the logic, by hand; the look stays ours)\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("clone: ok (kt-machine-add's logic is machine-add's, but for its known deviations)");
