// bun ~/.config/herdr-app/mods/kt-gwm/open.check.mjs: the Worktrees page opened on a card (open.js, #82),
// and the proof that this way in never reaches a remove.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openRequest, matchStop } from "./open.js";

const now = 1_000_000;
// A request: an absolute path and/or a branch; anything else is nothing.
assert.deepEqual(openRequest({ path: "/w/outil-82/", at: now }, now), { path: "/w/outil-82", branch: null });
assert.deepEqual(openRequest({ branch: "feat/#82-refs", at: now }, now), { path: null, branch: "feat/#82-refs" });
for (const r of [{ path: "rel/x" }, { path: "/w/../etc" }, { branch: "a b" }, { branch: "x/../y" }, { branch: "a;rm -rf ~" }, {}]) assert.equal(openRequest({ ...r, at: now }, now), null, JSON.stringify(r));
assert.equal(openRequest({ branch: "dev", at: now - 31_000 }, now), null, "stale");

// The card: by path first, else by a branch only one card has.
const stops = [
  { id: "/w/outil", w: { path: "/w/outil", branch: "dev" } },
  { id: "/w/outil-82", w: { path: "/w/outil-82", branch: "feat/#82-refs" } },
  { id: "/x/autre", w: { path: "/x/autre", branch: "dev" } },
];
assert.equal(matchStop(stops, { path: "/w/outil-82", branch: null }).id, "/w/outil-82");
assert.equal(matchStop(stops, { path: null, branch: "feat/#82-refs" }).id, "/w/outil-82");
assert.equal(matchStop(stops, { path: null, branch: "dev" }), null, "two cards with it: none, never a guess");
assert.equal(matchStop(stops, { path: "/nope", branch: null }), null);

// Never a remove from this way in: open.js names none, and the page's openAsked / applyWant (read from
// main.js) neither remove, sync, ask, act, nor touch the remove request (`kt-gwm.remove`).
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
const code = (s) => s.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n"); // its code, not its words
assert.ok(!/remove/i.test(code(src("./open.js"))), "open.js: no remove");
const main = src("./main.js");
const body = (name) => {
  const at = main.indexOf(`\n  ${name}(`);
  assert.ok(at >= 0, `${name} found`);
  const end = main.indexOf("\n  }\n", at);
  return code(main.slice(at, end));
};
for (const name of ["openAsked", "applyWant"]) {
  const b = body(name);
  for (const bad of [/remove/i, /\.act\(/, /\.ask\(/, /askBulk/, /\bsync\b/i, /\brun\(/, /\bexec\(/, /\bsh\(/]) assert.ok(!bad.test(b), `${name}: ${bad}`);
}

console.log("kt-gwm open ok");
