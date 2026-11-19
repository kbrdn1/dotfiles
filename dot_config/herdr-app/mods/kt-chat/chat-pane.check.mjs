// bun ~/.config/herdr-app/mods/kt-chat/chat-pane.check.mjs: chat-pane.js (#86, lot 2), kt-chat as a
// pane: its agent from its props, its own pane found, whether it shows, the registry. Made-up ids.
import assert from "node:assert/strict";
import { REGISTRY, paneTarget, ownPane, paneShown, register, unregister } from "./chat-pane.js";

// ── Its agent: the terminal of its props ────────────────────────────────────
const claude = (address) => ({ address, program: { key: "claude", name: "Claude Code" }, app: "claude-code" });
const shell = (address) => ({ address, program: { key: "shell", name: "zsh" } });
const agents = [claude("t1"), claude("t2"), { address: "t3", program: { key: "codex", name: "Codex" }, app: "codex" }, claude("vps/t7")];
const terms = [shell("t1"), shell("t2"), shell("t3"), shell("t4"), shell("vps/t7")];
assert.deepEqual(paneTarget({ terminal: "t2", agents, terminals: terms }), { agent: agents[1] }, "two Claude in the tab: each pane its own");
assert.deepEqual(paneTarget({ terminal: "t9", agents, terminals: terms }), { reason: "closed" }, "its terminal gone: agent fermé");
assert.deepEqual(paneTarget({ terminal: null, agents, terminals: terms }), { reason: "closed" });
assert.deepEqual(paneTarget({ terminal: "t3", agents, terminals: terms }), { reason: "notClaude", app: "Codex" });
assert.deepEqual(paneTarget({ terminal: "t4", agents, terminals: terms }), { reason: "notClaude", app: "zsh" }, "Claude left, its shell stays");
assert.equal(paneTarget({ terminal: "vps/t7", agents, terminals: terms }).reason, "remote", "another machine's: refused, as the stack's Chat does");
assert.equal(paneTarget({ terminal: "vps/t7", agents, terminals: terms }).machine, "vps");

// ── Its own pane ────────────────────────────────────────────────────────────
// Tab A: t1's terminal pane p1, t2's p2, two Chat panes c1, c2; tab B: its own Chat c9.
const panes = [
  { pane: "p1", terminal: "t1", tab: "A" }, { pane: "p2", terminal: "t2", tab: "A" },
  { pane: "c1", terminal: null, mod: "kt-chat", tab: "A" }, { pane: "c2", terminal: null, mod: "kt-chat", tab: "A" },
  { pane: "c9", terminal: null, mod: "kt-chat", tab: "B" }, { pane: "x1", terminal: null, mod: "kt-notes", tab: "A" },
];
const own = (o) => ownPane({ panes, terminal: "t1", agentTab: "A", registry: {}, ...o });
assert.equal(own({ known: "c1", given: "c2" }), "c2", "its props' pane first, when Herdr gives it");
assert.equal(own({ known: "c1" }), "c1", "found before");
assert.equal(own({ given: "c2" }), "c2", "its props' pane, when Herdr gives it");
assert.equal(own({ given: "p1" }), null, "not a Chat pane: not its own (two Chats, none registered)");
assert.equal(own({ keyed: true, focused: "c2" }), "c2", "holding the keyboard: the focused pane is its own");
assert.equal(own({ keyed: true, focused: "c2", registry: { c1: "t1" } }), "c2", "the keyboard's proof before the registry");
assert.equal(own({ keyed: false, focused: "c2" }), null, "not holding it: the focused pane says nothing");
assert.equal(own({ keyed: true, focused: "x1" }), null, "another mod's pane is never its own");
assert.equal(own({ registry: { c2: "t1" } }), "c2", "the registry's pane for its terminal (it survives a restart)");
assert.equal(own({ registry: { c2: "t2" } }), "c1", "elimination: the one Chat of its tab nobody has");
assert.equal(own({ registry: {} }), null, "two Chats of its tab, none registered: wait for a focus");
// Never a pane that isn't there: one gone, by any way in.
assert.equal(own({ known: "gone", given: "gone2", keyed: true, focused: "gone3", registry: { gone4: "t1", c2: "t2" } }), "c1", "every pane named is gone: the elimination, from what is there");
assert.equal(own({ known: "gone" }), null, "found before, gone since: not its own any more");
assert.equal(own({ registry: { gone: "t1" } }), null, "a line left by a crash: not its own");
// After a restart: two Claude, two Chats of one tab, each finds its own by its terminal.
const after = { c1: "t1", c2: "t2" };
assert.equal(ownPane({ panes, terminal: "t1", agentTab: "A", registry: after }), "c1");
assert.equal(ownPane({ panes, terminal: "t2", agentTab: "A", registry: after }), "c2");
assert.equal(ownPane({ panes, terminal: "t5", agentTab: "B", registry: {} }), "c9", "the only Chat of its tab");
assert.equal(ownPane({ panes, terminal: "t5", agentTab: null, registry: {} }), null, "its agent's tab unknown");

// ── Does it show ────────────────────────────────────────────────────────────
const view = (page) => ({ id: "root", children: [{ id: "view", active: page, children: [{ id: "thread" }, { id: "inbox" }] }] });
const spaces = (tab) => [{ id: "s1", active: true, tabs: [{ id: "A", active: tab === "A" }, { id: "B", active: tab === "B" }] }, { id: "s2", active: false, tabs: [] }];
const shown = (o) => paneShown({ pane: "c1", agentTab: "A", panes, spaces: spaces("A"), layout: view("thread"), ...o });
assert.equal(shown({}), true, "its tab shown, the thread on screen, nothing zoomed");
assert.equal(shown({ spaces: spaces("B") }), false, "another tab shown");
assert.equal(shown({ spaces: [{ id: "s1", active: false, tabs: [{ id: "A", active: true }] }] }), false, "another space shown");
assert.equal(shown({ layout: view("inbox") }), false, "a page over the thread");
assert.equal(shown({ layout: { id: "root", children: [] } }), true, "a layout without pages");
const zoomed = (z) => panes.map((p) => ({ ...p, zoomed: p.pane === z }));
assert.equal(shown({ panes: zoomed("p1") }), false, "another pane zoomed");
assert.equal(shown({ panes: zoomed("c1") }), true, "itself zoomed: ctrl-b z, the full width");
assert.equal(shown({ pane: null }), true, "its pane unknown: its agent's tab shown stands for it");
assert.equal(shown({ pane: null, spaces: spaces("B") }), false);

// ── The registry: { [pane]: terminal }, each copy its own line ──────────────
assert.equal(REGISTRY, "kt.chat.panes");
const reg0 = { c2: "t2" };
const reg1 = register(reg0, "c1", "t1");
assert.deepEqual(reg1, { c2: "t2", c1: "t1" }, "it adds itself, the others stay");
assert.equal(register(reg1, "c1", "t1"), reg1, "already there: the same object, nothing to write");
assert.deepEqual(register(reg1, "c1", "t9"), { c2: "t2", c1: "t9" }, "its own line only is ever rewritten");
// No clean-up of others' lines: at start, panes() may come before every tab is loaded.
assert.deepEqual(register({ old: "t4", c2: "t2" }, "c1", "t1"), { old: "t4", c2: "t2", c1: "t1" }, "another copy's line stays, even if its pane isn't listed yet");
assert.deepEqual(register(null, "c1", "t1"), { c1: "t1" });
assert.equal(register(reg1, null, "t1"), reg1, "no pane: nothing");
// Two copies, one terminal (a second Chat opened by hand): both stay, no write loop.
const both = register(register({}, "c1", "t1"), "c2", "t1");
assert.deepEqual(both, { c1: "t1", c2: "t1" });
assert.equal(register(both, "c1", "t1"), both);
assert.equal(register(both, "c2", "t1"), both);
assert.deepEqual(unregister(reg1, "c1"), { c2: "t2" }, "its copy closes: its line goes");
assert.equal(unregister(reg1, "zz"), reg1, "not there: unchanged");
assert.equal(unregister(null, "c1"), null);

console.log("chat-pane.check: ok");
