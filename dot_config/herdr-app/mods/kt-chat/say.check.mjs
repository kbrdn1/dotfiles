// bun say.check.mjs : kt-chat's send through herdr-bridge (say.js), on fakes: a made-up home, a fake
// plugin that answers said.json, a fake hc. No terminal is touched.
import assert from "node:assert/strict";
import { say, saidOf, sayId } from "./say.js";

const HOME = "/tfx/home";
const P = (n) => `${HOME}/.claude/cache/herdr/tfx1.${n}.json`;
function world({ token = "a".repeat(32), answer = (r) => ({ id: r.id, ok: true }), at = 2, enter = 0, blocked = false } = {}) {
  const files = {};
  const keys = [];
  let sleeps = 0;
  if (token !== null) files[P("saytoken")] = JSON.stringify({ token });
  const io = {
    home: HOME,
    blocked: async () => blocked,
    read: async (p) => files[p] ?? null,
    write: async (p, t) => { files[p] = t; },
    hc: async (args) => { keys.push(args); return { code: enter }; },
    // The plugin answers on the `at`-th look; before that, said.json holds an older id's answer.
    sleep: async () => {
      sleeps++;
      const r = JSON.parse(files[P("say")] ?? "null");
      files[P("said")] = JSON.stringify(sleeps < at || !r ? { id: "say-old", ok: true } : answer(r));
    },
  };
  return { files, keys, io, sleeps: () => sleeps };
}

// Sent: the request carries the session token and the text as is; Enter once, after the plugin's ok
// for THIS id (an older ok in the file doesn't count).
let w = world();
assert.deepEqual(await say("tfx1", "/me:hello é « »", w.io, { id: "say-1" }), { ok: true });
assert.deepEqual(JSON.parse(w.files[P("say")]), { id: "say-1", token: "a".repeat(32), text: "/me:hello é « »" });
assert.deepEqual(w.keys, [["keys", "tfx1", "enter"]]);
assert.equal(w.sleeps(), 2);

// Refused by the plugin (a draft in the box, a dialog): its reason, and no Enter.
for (const why of ["draft", "dialog", "changed", "token"]) {
  w = world({ answer: (r) => ({ id: r.id, ok: false, why }) });
  assert.deepEqual(await say("tfx1", "x", w.io, { id: "say-2" }), { ok: false, why });
  assert.deepEqual(w.keys, []);
}

// No session token (the plugin isn't the say one, or isn't there): nothing written, no Enter.
w = world({ token: null });
assert.deepEqual(await say("tfx1", "x", w.io), { ok: false, why: "noBridge" });
assert.deepEqual([w.files[P("say")], w.keys], [undefined, []]);

// No answer in time: no Enter, ever.
w = world({ at: 99 });
assert.deepEqual(await say("tfx1", "x", w.io, { id: "say-3", tries: 5 }), { ok: false, why: "timeout" });
assert.deepEqual(w.keys, []);

// A dialog came up after ok (the agent blocked, or a pending published): no Enter, it would answer it.
w = world({ blocked: true });
assert.deepEqual(await say("tfx1", "x", w.io, { id: "say-5" }), { ok: false, why: "blocked" });
assert.deepEqual(w.keys, []);
w = world();
w.files[`${HOME}/.claude/cache/herdr/tfx1.json`] = JSON.stringify({ pending: { id: "toolu_x", kind: "permission" } });
assert.deepEqual(await say("tfx1", "x", w.io, { id: "say-6" }), { ok: false, why: "blocked" });
assert.deepEqual(w.keys, []);

// Enter failed after ok.
w = world({ enter: 1 });
assert.deepEqual(await say("tfx1", "x", w.io, { id: "say-4" }), { ok: false, why: "enter" });

// The answer read: another id is none; a refusal without a reason is still a refusal.
assert.equal(saidOf(JSON.stringify({ id: "b", ok: true }), "a"), null);
assert.equal(saidOf("{", "a"), null);
assert.deepEqual(saidOf(JSON.stringify({ id: "a" }), "a"), { ok: false, why: "refused" });
assert.notEqual(sayId(1), sayId(1)); // two Sends in the same millisecond still differ

console.log("say: ok");
