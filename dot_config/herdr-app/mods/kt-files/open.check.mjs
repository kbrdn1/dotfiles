// bun ~/.config/herdr-app/mods/kt-files/open.check.mjs: Files opened on a file at a line (open.js, #82).
import assert from "node:assert/strict";
import { openRequest, wantStep, lineRange } from "./open.js";

const now = 1_000_000, root = "/w/outil";
// A request: a repo-relative path (an absolute one under the root made relative), a line, a range.
assert.deepEqual(openRequest({ path: "src/main.ts", line: 12, at: now }, now, root), { path: "src/main.ts", line: 12, to: null });
assert.deepEqual(openRequest({ path: "/w/outil/docs/GUIDE.md", line: 4, to: 9, at: now }, now, root), { path: "docs/GUIDE.md", line: 4, to: 9 });
assert.deepEqual(openRequest({ path: "./README.md", at: now }, now, root), { path: "README.md", line: null, to: null });
assert.deepEqual(openRequest({ path: "a.md", line: 0, to: 3, at: now }, now, root), { path: "a.md", line: null, to: null }, "no line: no range");
assert.deepEqual(openRequest({ path: "a.md", line: 5, to: 2, at: now }, now, root), { path: "a.md", line: 5, to: null }, "a range backwards: the line alone");
// Nothing outside the repo, nothing stale.
for (const path of ["/etc/passwd", "../secret", "src/../../x", "a//b", "", "a\0b", null]) assert.equal(openRequest({ path, at: now }, now, root), null, String(path));
assert.equal(openRequest({ path: "src/main.ts", at: now - 31_000 }, now, root), null);

// Listed: opened; not read yet: waits; read and not listed: dropped (said).
const paths = ["README.md", "src/main.ts"];
assert.deepEqual(wantStep(paths, "src/main.ts", true), { select: "src/main.ts" });
assert.deepEqual(wantStep([], "src/main.ts", false), { wait: true });
assert.deepEqual(wantStep(paths, "src/absent.ts", true), { drop: "notListed" });

// The selection, in UTF-16 offsets (é and 🍵 count as JS counts them).
const text = "un\ndeux é\ntrois 🍵\nquatre";
assert.deepEqual(lineRange(text, 1), { start: 0, end: 2 });
assert.deepEqual(lineRange(text, 2), { start: 3, end: 9 });
assert.equal(text.slice(lineRange(text, 3).start, lineRange(text, 3).end), "trois 🍵");
assert.equal(text.slice(lineRange(text, 2, 3).start, lineRange(text, 2, 3).end), "deux é\ntrois 🍵");
assert.equal(text.slice(lineRange(text, 99).start, lineRange(text, 99).end), "quatre", "past the end: the last line");

console.log("kt-files open ok");
