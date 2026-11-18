// bun ~/.config/herdr-app/mods/kt-keys/bus.check.mjs: bus.js's bump (one key per topic, always
// moves), moved (first sight records, then fires once per change) and refreshOn's coalescing (a bump
// during a reload runs it once more, never twice at once), with herdr mocked.
import assert from "node:assert/strict";
import { plugin } from "bun";

const store = {};
plugin({
  setup(b) {
    b.module("herdr", () => ({
      exports: { shared: (k) => store[k], setShared: (k, v) => { store[k] = v; } },
      loader: "object",
    }));
  },
});
const { bump, moved, refreshOn, gitTopics } = await import("./bus.js");

// bump: one key per topic, strictly increasing even within the same millisecond.
bump("git:/r", "git");
const a = store["kt.bus.git:/r"];
bump("git:/r");
assert.ok(store["kt.bus.git:/r"] > a);
assert.ok(store["kt.bus.git"] > 0);
assert.deepEqual(gitTopics("/r"), ["git:/r", "git"]);
assert.deepEqual(gitTopics(null), ["git"]);

// moved: first sight records without firing, then fires once per change.
const seen = {};
assert.equal(moved(seen, { x: 1 }), false);
assert.equal(moved(seen, { x: 1 }), false);
assert.equal(moved(seen, { x: 2 }), true);
assert.equal(moved(seen, { x: 2 }), false);

// refreshOn: coalesced reloads.
const tasks = [];
const cx = { spawn: (fn) => tasks.push(fn({ notify() {} })), notify() {} };
const view = {};
let runs = 0, release;
const reload = () => { runs++; return new Promise((r) => { release = r; }); };
assert.equal(refreshOn(view, cx, "s", ["plugins"], reload), false); // first render: no reload
bump("plugins");
assert.equal(refreshOn(view, cx, "s", ["plugins"], reload), true);
assert.equal(runs, 1);
bump("plugins");
refreshOn(view, cx, "s", ["plugins"], reload); // during the reload: queued, not started
assert.equal(runs, 1);
release();
await new Promise((r) => setTimeout(r, 0));
assert.equal(runs, 2); // ran once more after
release();
await Promise.all(tasks);
assert.equal(view._bus.s.running, false);
console.log("ok");
