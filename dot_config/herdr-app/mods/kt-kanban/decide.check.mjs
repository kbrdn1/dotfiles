// bun ~/.config/herdr-app/mods/kt-kanban/decide.check.mjs : the answer path the Kanban uses on a card
// (its pills and its menu), decide.js' own (a byte-identical copy of kbrdn-toast's: the sidebar's and the
// toast's), on fakes: herdr, gpui-kit and gpui-base are mocked; files live in a made-up home; no agent,
// no screen, no real path. Not loaded by Herdr.
import assert from "node:assert/strict";
import { mock } from "bun:test";

const HOME = "/tfx/home";
const files = {}; // path -> text
const writes = []; // [path, text]
const runs = []; // [command, args]
const reads = []; // hc calls
let screen = "";
let blocked = new Set();
mock.module("herdr", () => ({
  home: () => HOME,
  agents: () => [...blocked].map((address) => ({ address, status: "blocked" })),
  readTextFile: async (p) => files[p] ?? null,
  writeTextFile: async (p, text) => { writes.push([p, text]); files[p] = text; },
  hc: async (args) => { reads.push(args); return { code: 0, stdout: screen }; },
  run: (name, args) => runs.push([name, args]),
  theme: () => ({}),
  shared: () => null, setShared: () => {}, checking: () => true, exec: async () => ({ code: 1, stdout: "" }),
}));
const chain = () => new Proxy(() => {}, { get: () => chain, apply: () => chain() });
mock.module("gpui-kit", () => ({ div: chain, svg: chain }));
mock.module("gpui-base", () => ({ h_flex: chain, v_flex: chain }));
const { decide, press, pillKeys } = await import("./decide.js");

const cache = (t) => `${HOME}/.claude/cache/herdr/${t}`;
const permission = (id) => JSON.stringify({ pending: { id, kind: "permission", title: "Autoriser Bash", detail: "rm -rf build",
  options: [{ key: "accept", label: "Accepter", tone: "positive" }, { key: "refuse", label: "Refuser", tone: "negative" }] } });

// A permission herdr-bridge publishes: its two choices; « Accepter » writes the decision file the plugin
// reads ({ id, choice }), once; a second answer is refused; read again, it has no choices left.
blocked = new Set(["tfx9"]);
files[`${cache("tfx9")}.json`] = permission("tfx-p1");
const d = await decide("tfx9");
assert.equal(d.pending.kind, "permission");
assert.deepEqual(pillKeys(d), ["accept", "refuse"]);
assert.deepEqual(await press(d, "accept"), { ok: true });
assert.deepEqual(writes, [[`${cache("tfx9")}.decision.json`, JSON.stringify({ id: "tfx-p1", choice: "accept" })]]);
assert.deepEqual(await press(d, "refuse"), { ok: false, reason: "Déjà répondu." });
assert.equal(writes.length, 1);
assert.deepEqual(pillKeys(await decide("tfx9")), ["open"]); // answered here: only « Ouvrir »

// The request changed between the card and the click: nothing written.
files[`${cache("tfx8")}.json`] = permission("tfx-p2");
blocked = new Set(["tfx8"]);
const d8 = await decide("tfx8");
files[`${cache("tfx8")}.json`] = permission("tfx-p3");
assert.deepEqual(await press(d8, "refuse"), { ok: false, reason: "La demande n'est plus en attente." });
assert.equal(writes.length, 1);

// A question (no choices) and a plain wait (nothing published, nothing held on the screen): only
// « Ouvrir », which goes to the agent (agent.focus), nothing written.
files[`${cache("tfx7")}.json`] = JSON.stringify({ pending: { id: "q1", kind: "question", title: "Quel nom ?", options: [] } });
blocked = new Set(["tfx7", "tfx6"]);
const q = await decide("tfx7");
assert.deepEqual([q.pending.kind, pillKeys(q)], ["question", ["open"]]);
assert.deepEqual(await press(q, "open"), { ok: true });
assert.deepEqual(runs, [["agent.focus", { terminal: "tfx7" }]]);
screen = "some output\n> ";
const w = await decide("tfx6");
assert.deepEqual([w.pending.kind, w.pending.title, pillKeys(w)], ["input", "Attend ta réponse", ["open"]]);
assert.deepEqual(reads, [["read", "tfx6"]]); // the screen read for a blocked agent the plugin says nothing about
// Not blocked, nothing published: nothing waits.
blocked = new Set();
assert.equal((await decide("tfx5")).pending, null);

// Only the made-up home was written.
assert.ok(writes.every(([p]) => p.startsWith(`${HOME}/`)));
assert.equal(writes.length, 1);
console.log("decide (kt-kanban): ok");
