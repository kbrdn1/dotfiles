// bun ~/.config/herdr-app/mods/kt-threads/pr-pick.check.mjs : pr-pick.js's choice. Not loaded by Herdr.
import assert from "node:assert/strict";
import { longLived, pickPr } from "./pr-pick.js";

const pr = (number, state, oid, base = "dev") => ({ number, state, url: `u/${number}`, headRefOid: oid, baseRefName: base });

// long-lived branches and the repo's default branch never get one
for (const b of ["main", "master", "dev", "develop", "staging", "preprod", "prod", "production", "release", "trunk"]) assert.ok(longLived(b));
assert.ok(longLived("next", "next"));
assert.ok(!longLived("feat/#12-x", "main"));
assert.ok(longLived(""));

// the open one first, even when a newer one is merged
assert.equal(pickPr([pr(9, "MERGED", "a"), pr(8, "OPEN", "b")], "feat/x", "z")?.number, 8);
// merged: only while its head is the local HEAD
assert.equal(pickPr([pr(7, "MERGED", "abc")], "feat/x", "abc")?.number, 7);
assert.equal(pickPr([pr(7, "MERGED", "abc")], "feat/x", "def"), null);
assert.equal(pickPr([pr(7, "CLOSED", "abc")], "feat/x", null), null);
// only the newest closed one counts: an older one with a matching head is a reused branch's past
assert.equal(pickPr([pr(7, "CLOSED", "new"), pr(3, "MERGED", "abc")], "feat/x", "abc"), null);
// a PR into its own head branch is ignored
assert.equal(pickPr([pr(5, "OPEN", "a", "feat/x")], "feat/x", "a"), null);
assert.equal(pickPr([], "feat/x", "a"), null);
assert.equal(pickPr(null, "feat/x", "a"), null);
console.log("pr-pick: ok");
