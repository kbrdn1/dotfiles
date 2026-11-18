// bun ~/.config/herdr-app/mods/kt-automation/session.check.mjs: session.js with herdr mocked. The
// session found by its tab's name only; shown when it lives; an intention sent between two turns
// only (idle: --if idle, done: plain send), refused while it works or waits for Kylian, or once
// Claude left; else a tab beside the folder's space, or a space of its own, with the task.
import assert from "node:assert/strict";
import { plugin } from "bun";

const h = { spaces: [], agents: [], panes: [], ran: [], sent: [], sendCode: 0 };
plugin({
  setup(b) {
    b.module("herdr", () => ({
      exports: {
        spaces: () => h.spaces, agents: () => h.agents, panes: () => h.panes,
        run: (name, args) => { h.ran.push([name, args]); return null; },
        hc: async (args) => { h.sent.push(args); return { code: h.sendCode, stdout: "", stderr: h.sendCode ? "refused" : "" }; },
        notify: () => "n1",
      },
      loader: "object",
    }));
  },
});
const { session, decide, dedicated, intention } = await import("./session.js");
const reset = () => { h.ran = []; h.sent = []; h.sendCode = 0; };
const C = "/Users/k/.claude";

// decide: idle --if idle, done plain, working and blocked refused.
assert.deepEqual(decide("idle", "A"), { args: ["send", "--if", "idle"] });
assert.deepEqual(decide("done", "A"), { args: ["send"] });
assert.match(decide("working", "A").why, /travaille \(working\)/);
assert.match(decide("blocked", "A").why, /attend une réponse/);

// No session: a tab beside the folder's space (found by a pane there), with the task then the intention.
h.spaces = [{ id: "s1", folder: "/elsewhere", machine: null, tabs: [{ id: "b1", name: "1", named: false }] }];
h.panes = [{ pane: "p1", tab: "b1", cwd: C }];
assert.equal(session("Automatisation"), null);
assert.deepEqual(await dedicated({ name: "Automatisation", folder: C, task: "T", intent: "faire x" }), { done: "opened" });
assert.deepEqual(h.ran[0], ["tab.new", { space: "s1", name: "Automatisation", folder: C, argv: ["claude"], task: `T\n${intention("faire x")}` }]);
assert.deepEqual(h.ran[1], ["layout.select", { stack: "view", child: "thread" }]);

// No space there: a space of its own, on this machine; no intention: the task alone.
reset();
h.panes = [];
await dedicated({ name: "Automatisation", folder: C, task: "T", intent: null });
assert.deepEqual(h.ran[0], ["space.new", { name: "Automatisation", tab: "Automatisation", folder: C, argv: ["claude"], task: "T", machine: "" }]);

// A live session (by its tab's name, wherever it is; a remote space's ignored): shown, nothing typed.
reset();
h.spaces = [
  { id: "sR", folder: C, machine: "vps", tabs: [{ id: "bR", name: "Automatisation", named: true }] },
  { id: "s2", folder: "/p", machine: null, tabs: [{ id: "b2", name: "Automatisation", named: true }] },
];
h.agents = [{ address: "t7", tab: "b2", status: "done" }];
assert.equal(session("Automatisation").space.id, "s2");
assert.deepEqual(await dedicated({ name: "Automatisation", folder: C, task: "T", intent: null }), { done: "shown" });
assert.deepEqual(h.ran.map(([n]) => n), ["space.select", "tab.select", "layout.select"]);
assert.equal(h.sent.length, 0);

// done: plain hc send, then shown.
reset();
assert.deepEqual(await dedicated({ name: "Automatisation", folder: C, task: "T", intent: "x" }), { done: "sent" });
assert.deepEqual(h.sent, [["send", "t7", "Intention : x"]]);
// idle: --if idle.
reset();
h.agents = [{ address: "t7", tab: "b2", status: "idle" }];
await dedicated({ name: "Automatisation", folder: C, task: "T", intent: "x" });
assert.deepEqual(h.sent, [["send", "--if", "idle", "t7", "Intention : x"]]);
// hc refuses (it started a turn meanwhile): said, not shown.
reset();
h.sendCode = 1;
assert.match((await dedicated({ name: "Automatisation", folder: C, task: "T", intent: "x" })).why, /n'a pas pris l'intention : refused/);
assert.equal(h.ran.length, 0);
// working, blocked: nothing typed.
for (const status of ["working", "blocked"]) {
  reset();
  h.agents = [{ address: "t7", tab: "b2", status }];
  assert.ok((await dedicated({ name: "Automatisation", folder: C, task: "T", intent: "x" })).why);
  assert.equal(h.sent.length, 0);
  assert.equal(h.ran.length, 0);
}
// Claude left the tab: said, nothing typed, no second session.
reset();
h.agents = [];
assert.match((await dedicated({ name: "Automatisation", folder: C, task: "T", intent: "x" })).why, /n'a plus d'agent/);
assert.equal(h.ran.length + h.sent.length, 0);

console.log("session.check: ok");
