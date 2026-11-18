// bun ~/.config/herdr-app/mods/kt-keys/machines.check.mjs: machines.js on invented machines (vps-a…):
// what kt.machines publishes (never host, id, target, via, session; no temporary machine; set only on a
// change), the status of a machine (loading, unavailable, needs_login, unknown, root, linger null), and
// the guard (refused at once, the machine never called; this computer always goes through).
import assert from "node:assert/strict";
import { plugin } from "bun";

const store = {};
let layouts = [];
let hcOut = { code: 0, stdout: "" };
let sets = 0;
plugin({
  setup(b) {
    b.module("herdr", () => ({
      exports: {
        shared: (k) => store[k],
        setShared: (k, v) => { sets++; store[k] = v; },
        machines: () => layouts,
        hc: async () => hcOut,
      },
      loader: "object",
    }));
  },
});
const M = await import("./machines.js");

// ---- publishable: only the fields the mods need, sorted, no temporary machine.
const ls = JSON.stringify({ machines: [
  { name: "vps-b", state: "needs_login", host: "h-b", id: "0123abcd", target: "vps-b", via: false, session: null, temporary: false, keeps_running_after_logout: null, logout_linger_user: null, version: "0.1.21" },
  { name: "vps-a", state: "connected", host: "h-a", id: "4567ef01", target: "user@vps-a", via: false, session: "s", temporary: false, keeps_running_after_logout: true, logout_linger_user: "root", version: "0.1.21" },
  { name: "sandbox-1", state: "connected", temporary: true },
] });
const list = M.publishable(ls);
assert.deepEqual(list.map((m) => m.name), ["vps-a", "vps-b"]);
for (const m of list) {
  assert.deepEqual(Object.keys(m), ["name", "state", "why", "keeps_running_after_logout", "logout_linger_user", "version"]);
  for (const k of ["host", "id", "target", "via", "session", "temporary"]) assert.ok(!(k in m), `${k} leaked`);
}
assert.equal(list[0].why, null);
assert.equal(M.publishable("not json"), null);
assert.equal(M.publishable("{}"), null);
assert.deepEqual(M.publishable('{"machines":[]}'), []);

// ---- publish: set once, not again for the same list.
sets = 0;
assert.equal(M.publish(list), true);
assert.equal(M.publish(M.publishable(ls)), false);
assert.equal(sets, 1);
assert.equal(M.publish(null), false); // a failed read keeps the last list

// ---- pollMachines: reads now, publishes, keeps the last list when hc fails.
const tasks = [];
const cx = { spawn: (f) => tasks.push(f(cx)), timer: { every: (ms, f) => { cx.tick = f; cx.ms = ms; } } };
delete store[M.KEY];
hcOut = { code: 0, stdout: ls };
M.pollMachines(cx);
await Promise.all(tasks);
assert.equal(cx.ms, 15000);
assert.deepEqual(store[M.KEY].map((m) => m.name), ["vps-a", "vps-b"]);
hcOut = { code: 1, stdout: "" };
cx.tick(cx);
await Promise.all(tasks);
assert.deepEqual(store[M.KEY].map((m) => m.name), ["vps-a", "vps-b"]);

// ---- stateOf: this computer, then each case on invented machines.
const pub = [
  { name: "vps-a", state: "connected", why: null, keeps_running_after_logout: true, logout_linger_user: "root", version: "0.1.21" },
  { name: "vps-b", state: "needs_login", why: null, keeps_running_after_logout: null, logout_linger_user: null, version: "0.1.21" },
  { name: "vps-c", state: "unreachable", why: "connection refused", keeps_running_after_logout: false, logout_linger_user: "deploy", version: "0.1.20" },
  { name: "vps-d", state: "connected", why: null, keeps_running_after_logout: null, logout_linger_user: null, version: "0.1.21" },
];
const lay = [
  { name: null, layout: "ready" },
  { name: "vps-a", layout: "ready" }, { name: "vps-b", layout: "ready" }, { name: "vps-c", layout: "unavailable" },
  { name: "vps-d", layout: "loading" }, { name: "vps-e", layout: "unavailable" }, { name: "vps-f", layout: "ready" },
];
const o = { layouts: lay, published: pub };
for (const n of [null, undefined, ""]) {
  const s = M.stateOf(n, o);
  assert.equal(s.status, "local");
  assert.equal(s.reachable, true);
  assert.equal(s.root, false);
}
const a = M.stateOf("vps-a", o);
assert.equal(a.status, "ready");
assert.equal(a.reachable, true);
assert.equal(a.root, true); // logout_linger_user "root"
assert.equal(a.linger, true);
assert.equal(M.stateOf("vps-b", o).status, "login"); // needs_login wins over a ready layout
assert.equal(M.stateOf("vps-b", o).reachable, false);
assert.equal(M.stateOf("vps-b", o).root, null); // linger user null: not known
const c = M.stateOf("vps-c", o);
assert.equal(c.status, "away");
assert.equal(c.why, "connection refused");
assert.equal(c.root, false);
assert.equal(M.stateOf("vps-d", o).status, "loading"); // connected but its layout not read yet
assert.equal(M.stateOf("vps-d", o).reachable, false);
assert.equal(M.stateOf("vps-e", o).status, "away"); // unavailable, nothing published
assert.equal(M.stateOf("vps-e", o).root, null);
// Not published yet (the first seconds): the layout decides.
assert.equal(M.stateOf("vps-f", o).status, "ready");
assert.equal(M.stateOf("vps-f", o).root, null);
// A machine the app doesn't know.
assert.equal(M.stateOf("vps-z", o).status, "away");
assert.equal(M.reachable("vps-z", o), false);
assert.equal(M.isRoot("vps-a", o), true);
// Live defaults: machines() and shared("kt.machines").
layouts = lay;
store[M.KEY] = pub;
assert.equal(M.stateOf("vps-a").status, "ready");
assert.equal(M.stateOf("vps-b").status, "login");

// ---- guard / guardRead: refused at once for a machine away, never calling it; local always passes.
const calls = [];
const exec = async (cmd, args, options) => { calls.push([cmd, options?.on ?? null]); return { code: 0, stdout: "ok", stderr: "" }; };
const g = M.guard(exec, o);
assert.equal((await g("git", ["status"], { cwd: "/r" })).stdout, "ok");
assert.equal((await g("git", ["status"], { cwd: "/r", on: null })).stdout, "ok");
assert.equal((await g("git", ["status"], { cwd: "/r", on: "vps-a" })).stdout, "ok");
for (const [on, status] of [["vps-b", "login"], ["vps-c", "away"], ["vps-d", "loading"], ["vps-z", "away"]]) {
  const t = Date.now();
  const e = await g("git", ["status"], { cwd: "/r", on }).then(() => null, (e) => e);
  assert.ok(e instanceof Error);
  assert.equal(M.isOffline(e), on);
  assert.equal(e.status, status);
  assert.ok(Date.now() - t < 50, "refused at once");
}
assert.deepEqual(calls, [["git", null], ["git", null], ["git", "vps-a"]]);
// An answer with a nonzero code is not an offline error.
assert.equal(M.isOffline(new Error("exit 128")), null);
assert.equal(M.isOffline(null), null);
const reads = [];
const gr = M.guardRead(async (p, options) => { reads.push(options?.on ?? null); return "text"; }, o);
assert.equal(await gr("/f"), "text");
assert.equal(await gr("/f", { on: "vps-a" }), "text");
assert.equal(M.isOffline(await gr("/f", { on: "vps-c" }).catch((e) => e)), "vps-c");
assert.deepEqual(reads, [null, "vps-a"]);

console.log("machines.js: ok");
