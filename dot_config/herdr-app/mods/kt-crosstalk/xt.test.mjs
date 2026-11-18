// node mods/kt-crosstalk/xt.test.mjs: xt.js on v1 and v2 publications shaped like the contract's.
import assert from "node:assert/strict";
import { baseName, normalize, addr, nextOutbox, sendState, unreadOf, groupOf, entryOf, matchPeer, snippet, runsOf, DAY } from "./xt.js";

const NAMES = ["claude-flow", "kbrdn.dev-v2", "gwm-cli", "claude-crosstalk"];
assert.equal(baseName("claude-flow-1d", NAMES), "claude-flow");
assert.equal(baseName("claude-98", NAMES), "claude");
assert.equal(baseName("gwm-cli", NAMES), "gwm-cli");
assert.equal(baseName("kbrdn.dev-v2", NAMES), "kbrdn.dev-v2");
assert.equal(baseName("kbrdn.dev-v2-a7", NAMES), "kbrdn.dev-v2");
assert.equal(baseName("claude-crosstalk-fe", NAMES), "claude-crosstalk");
assert.equal(baseName("api", NAMES), "api");

// v1: key = name, title and project from the name, unknown fields null.
const v1 = normalize({
  v: 1,
  session: { id: "S1", name: "claude-crosstalk-7k" },
  peers: [
    { name: "claude-flow-1d", address: "claude-flow-1d", status: "idle", unread: 2, last: { dir: "in", text: "**ready?**", at: 30 } },
    { name: "web", address: "web", status: "busy", unread: 0 },
  ],
  threads: { "claude-flow-1d": [{ dir: "out", text: "on it", at: 10, id: "a" }, { dir: "in", text: "**ready?**", at: 30 }] },
  handled: { a: { status: "sent", at: 10 }, b: { status: "refused", reason: "unknown peer: nobody", at: 11 } },
}, NAMES);
const [flow, web] = v1.peers;
assert.equal(flow.key, "claude-flow-1d");
assert.equal(flow.title, "claude-flow");
assert.equal(flow.project, "claude-flow");
assert.equal(flow.kind, null);
assert.equal(flow.live, null);
assert.equal(flow.lastIn, 30);
assert.equal(flow.lastMessageAt, 30);
assert.equal(web.msgs.length, 0);
assert.equal(web.last, null);
assert.equal(addr(v1, flow), "claude-flow-1d");
assert.deepEqual(normalize({ v: 3 }), { error: "version", version: 3 });
assert.deepEqual(normalize(null), { error: "unreadable" });

// v2: title as published, thread by key (by name before the key resolved), outbox by key.
const v2 = normalize({
  v: 2,
  session: { id: "S2", name: "claude-crosstalk-7k", terminal: "t9", cwd: "/p/claude-crosstalk", project: "claude-crosstalk" },
  peers: [
    { key: "sid-1", sessionId: "sid-1", title: "claude-flow · review", name: "claude-flow-1d", address: "x", project: "/p/claude-flow", topic: "review", kind: "remote", status: "waiting", live: true, unread: 1, lastMessageAt: 50, last: { dir: "in", text: "hi", at: 50 } },
    { key: "api-2k", title: "api", name: "api-2k", address: "api-2k", kind: "interactive", live: false, unread: 0 },
  ],
  threads: { "sid-1": [{ dir: "in", text: "hi", at: 50 }], "api-2k": [{ dir: "out", text: "yo", at: 5 }] },
  handled: {},
}, NAMES);
assert.equal(v2.peers[0].title, "claude-flow · review");
assert.equal(v2.peers[0].msgs.length, 1);
assert.equal(v2.peers[0].live, true);
assert.equal(v2.peers[1].msgs[0].text, "yo");
assert.equal(addr(v2, v2.peers[0]), "sid-1");
assert.equal(v2.session.cwd, "/p/claude-crosstalk");
// v2: no project (Remote Control, cloud) stays none; a bare step name is no topic.
const v2b = normalize({ v: 2, session: { id: "S" }, peers: [{ key: "k", name: "laptop-bubble", kind: "remote", topic: "branch" }], threads: {} }, NAMES);
assert.equal(v2b.peers[0].project, null);
assert.equal(v2b.peers[0].topic, null);

// The outbox: a send goes in, a handled one leaves, read only moves forward, title is v2's only,
// another session's outbox starts over.
const e1 = { id: "u1", to: "claude-flow-1d", text: "go", at: 1 };
let box = nextOutbox(v1, null, { send: e1, read: { "claude-flow-1d": 30 } });
assert.deepEqual(box, { v: 1, session: "S1", send: [e1], read: { "claude-flow-1d": 30 } });
box = nextOutbox(v1, box, { read: { "claude-flow-1d": 20 } });
assert.equal(box.read["claude-flow-1d"], 30);
const handledV1 = { ...v1, handled: { ...v1.handled, u1: { status: "refused", reason: "unknown peer: x", at: 2 } } };
assert.deepEqual(nextOutbox(handledV1, box).send, []);
assert.equal(nextOutbox(v1, { ...box, title: { x: "t" } }).title, undefined);
assert.deepEqual(nextOutbox(v2, box), { v: 2, session: "S2", send: [], read: {}, title: {} });
assert.deepEqual(nextOutbox(v2, null, { title: { "sid-1": "" } }).title, { "sid-1": "" });
// A title is written once and leaves when the publication shows it; never for an unpublished key.
assert.deepEqual(nextOutbox(v2, null, { title: { "sid-1": "API backend" } }).title, { "sid-1": "API backend" });
const renamed = { ...v2, peers: v2.peers.map((p) => (p.key === "sid-1" ? { ...p, title: "API backend" } : p)) };
assert.deepEqual(nextOutbox(renamed, { v: 2, session: "S2", send: [], read: {}, title: { "sid-1": "API backend" } }).title, {});
assert.deepEqual(nextOutbox(v2, null, { title: { ghost: "x" } }).title, {});

// A send's fate.
assert.deepEqual(sendState({ id: "u1" }, handledV1, box), { state: "refused", reason: "unknown peer: x" });
assert.deepEqual(sendState({ id: "a" }, v1, box), { state: "sent" });
assert.deepEqual(sendState({ id: "u1" }, v1, box), { state: "pending" });
assert.equal(sendState({ id: "zz" }, v1, box).state, "failed");
assert.equal(sendState({ id: "zz" }, v1, box).gone, true, "not in the outbox: main.js says so");

// Unread after Herdr's read mark, and the inbox's groups.
assert.equal(unreadOf(flow, 0), 2);
assert.equal(unreadOf(flow, 30), 0);
assert.equal(groupOf(flow, 2, 100), "todo");
assert.equal(groupOf({ ...flow, unread: 0 }, 0, 100), "active");
assert.equal(groupOf({ ...flow, lastMessageAt: 1 }, 0, 2 * DAY), "idle");
assert.equal(groupOf({ ...flow, lastMessageAt: null, live: true }, 0, 2 * DAY), "active");
assert.equal(groupOf({ status: "waiting", lastMessageAt: null }, 0, 0), "todo");

// The registry: a folder (deepest wins, through realpath), a name, else the session name's prefix.
const REG = [{ name: "claude-flow", folder: "/p/claude-flow" }, { name: "claude", folder: "/p" }, { name: "gwm-cli", folder: "/q/gwm-cli" }];
assert.equal(entryOf(REG, "/p/claude-flow/sub", null).name, "claude-flow");
assert.equal(entryOf(REG, "/link/gwm", null, (p) => (p === "/link/gwm" ? "/q/gwm-cli" : p)).name, "gwm-cli");
assert.equal(entryOf(REG, "GWM-CLI", null).name, "gwm-cli");
assert.equal(entryOf(REG, null, "claude-flow-1d").name, "claude-flow");
assert.equal(entryOf(REG, null, "nope-1"), null);

// Search: fuzzy on the short fields, substring in the messages.
const m = matchPeer("flow", ["claude-flow", "claude-flow", null, "claude-flow-1d"], ["on it"]);
assert.deepEqual([...m.marks[0]], [7, 8, 9, 10]);
assert.equal(matchPeer("ready", ["web"], ["**ready?**"]).hit.text, "**ready?**");
assert.equal(matchPeer("zzz", ["web"], ["hello"]), null);
assert.deepEqual([...snippet("say **ready?** now", "ready").marks], [6, 7, 8, 9, 10]);

// Runs: by day, then by side.
const runs = runsOf([{ dir: "in", at: 1 }, { dir: "in", at: 2 }, { dir: "out", at: 3 }, { dir: "out", at: 99 }], (at) => (at < 50 ? "d1" : "d2"));
assert.deepEqual(runs.map((d) => [d.day, d.runs.map((r) => `${r.dir}${r.items.length}`)]), [["d1", ["in2", "out1"]], ["d2", ["out1"]]]);

console.log("xt ok");
