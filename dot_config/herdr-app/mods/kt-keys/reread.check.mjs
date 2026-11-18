// bun ~/.config/herdr-app/mods/kt-keys/reread.check.mjs: reread.js's decision, for the three cases the
// end-to-end test found (a new place always reads, shown or back from hidden; the same place only past 10 s).
import assert from "node:assert/strict";
import { shouldRead } from "./reread.js";

const A = '[null,"/repo"]', B = '[null,"/repo-wt"]', now = 100_000;
// Hidden: never.
assert.equal(shouldRead({ vis: false, shown: false, loc: B, lastLoc: A, readAt: 0, now }), false);
// Shown, the thread or worktree changed: at once.
assert.equal(shouldRead({ vis: true, shown: true, loc: B, lastLoc: A, readAt: now - 1000, now }), true);
// Back on the tab 2 s after a change of thread made while it was hidden: at once, despite the 10 s rule.
assert.equal(shouldRead({ vis: true, shown: false, loc: B, lastLoc: A, readAt: now - 2000, now }), true);
// Back on the tab, same place: only past 10 s.
assert.equal(shouldRead({ vis: true, shown: false, loc: A, lastLoc: A, readAt: now - 2000, now }), false);
assert.equal(shouldRead({ vis: true, shown: false, loc: A, lastLoc: A, readAt: now - 11_000, now }), true);
// Shown all along, same place: never (the poll and the bus do that).
assert.equal(shouldRead({ vis: true, shown: true, loc: A, lastLoc: A, readAt: 0, now }), false);
// First render: no place seen yet, read.
assert.equal(shouldRead({ vis: true, shown: false, loc: A, lastLoc: undefined, readAt: undefined, now }), true);

console.log("reread.js: ok");
