// bun ~/.config/herdr-app/mods/kt-history/open.check.mjs: History opened on a commit (open.js, #82).
import assert from "node:assert/strict";
import { openRequest, wantStep } from "./open.js";

const now = 1_000_000;
// A request: a sha (7 to 40 hex), fresh; anything else is nothing.
assert.equal(openRequest({ sha: "A1B2C3D", at: now - 1000 }, now), "a1b2c3d");
assert.equal(openRequest({ sha: "a1b2c3d", at: now - 31_000 }, now), null, "stale");
assert.equal(openRequest({ sha: "a1b2", at: now }, now), null, "too short");
assert.equal(openRequest({ sha: "main", at: now }, now), null, "a ref, not a sha");
assert.equal(openRequest({ sha: "a1b2c3d; rm -rf ~", at: now }, now), null);
assert.equal(openRequest(null, now), null);

const commits = [
  { hash: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678" },
  { hash: "a1b2c3d9999999999999999999999999999999ff" },
  { hash: "0f9e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6" },
];
// Listed: selected by its full hash; a prefix naming two commits is refused, never a guess.
assert.deepEqual(wantStep(commits, "0f9e8d7", true), { select: "0f9e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6" });
assert.deepEqual(wantStep(commits, "a1b2c3d4", true), { select: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678" });
assert.deepEqual(wantStep(commits, "a1b2c3d", true), { drop: "ambiguous" });
// Not listed: waits for the list's read, then is said not to be among the last commits.
assert.deepEqual(wantStep([], "0f9e8d7", false), { wait: true });
assert.deepEqual(wantStep(commits, "deadbee", true), { drop: "notListed" });

console.log("kt-history open ok");
