// bun ~/.config/herdr-app/mods/kt-chat/chat-view.check.mjs: chat-view.js, what herdr-app check can't
// reach in kt-chat: the agent chosen (the focused pane's Claude first, another tab never), the fold's
// words in the order the work was done, and where « Tours précédents » and the cursor leave the view.
import assert from "node:assert/strict";
import { pickTarget, tallyText, firstShown, childOf, shownAfterRead, chatShown } from "./chat-view.js";

// ── The agent ───────────────────────────────────────────────────────────────
const claude = (address, tab) => ({ address, tab, program: { key: "claude", name: "Claude Code" }, app: "claude-code" });
const other = (address, tab) => ({ address, tab, program: { key: "codex", name: "Codex" }, app: "codex" });
const env = (agents, panes, tab = "tab-1") => ({ focused: () => ({ tab }), agents: () => agents, panes: () => panes });

assert.deepEqual(pickTarget(env([], [])), { reason: "noAgent" });
assert.deepEqual(pickTarget({ focused: () => null, agents: () => [claude("t1", "tab-1")], panes: () => [] }), { reason: "noAgent" });
assert.deepEqual(pickTarget(env([claude("t9", "tab-2")], [])), { reason: "noAgent" }, "another tab's agent is not this thread's");
// Two Claude agents in the tab: the focused pane's, else the first.
const two = [claude("t1", "tab-1"), claude("t2", "tab-1")];
assert.equal(pickTarget(env(two, [{ tab: "tab-1", terminal: "t2", focused: true }])).agent.address, "t2");
assert.equal(pickTarget(env(two, [{ tab: "tab-1", terminal: "t2", focused: false }])).agent.address, "t1");
assert.equal(pickTarget(env(two, [{ tab: "tab-2", terminal: "t2", focused: true }])).agent.address, "t1", "a focused pane of another tab doesn't count");
// A Claude agent wins over a focused Codex one; no Claude at all says which program it is.
assert.equal(pickTarget(env([other("t1", "tab-1"), claude("t2", "tab-1")], [{ tab: "tab-1", terminal: "t1", focused: true }])).agent.address, "t2");
assert.deepEqual(pickTarget(env([other("t1", "tab-1")], [])), { reason: "notClaude", app: "Codex" });
// Claude on another machine.
const remote = pickTarget(env([claude("vps/t4", "tab-1")], []));
assert.equal(remote.reason, "remote");
assert.equal(remote.machine, "vps");

// ── The fold's words ────────────────────────────────────────────────────────
const tr = (k, v) => `${k}=${v?.n ?? ""}`;
const base = { order: [], reads: 0, edits: 0, searches: 0, runs: 0, agents: 0, others: 0, thoughts: 0, notes: 0, errors: 0 };
assert.equal(tallyText({ ...base, order: ["research", "edit", "run"], reads: 4, searches: 1, edits: 2, runs: 3 }, tr),
  "count.reads=4 · count.searches=1 · count.edits=2 · count.runs=3");
assert.equal(tallyText({ ...base, order: ["run", "research"], runs: 1, searches: 2 }, tr), "count.runs=1 · count.searches=2", "the order the work was done, no zero count");
assert.equal(tallyText({ ...base, thoughts: 2 }, tr), "count.thoughts=2", "thinking only");
assert.equal(tallyText({ ...base, order: ["edit"], edits: 1, thoughts: 3 }, tr), "count.edits=1", "thinking is not counted beside work");
assert.equal(tallyText({ ...base, order: ["agent", "other"], agents: 1, others: 2, notes: 1, errors: 1 }, tr), "count.agents=1 · count.others=2 · count.notes=1 · count.errors=1");

// ── Which turns are drawn, where the view goes ──────────────────────────────
// 30 turns read, the last 10 drawn: the head is child 0, turn 20 child 1.
assert.equal(firstShown(30, 10), 20);
assert.equal(firstShown(4, 10), 0);
assert.equal(childOf(20, 20), 1);
// « Tours précédents » with turns already read: 10 more drawn, the old first (20) stays in view.
let show = 10;
const was = firstShown(30, show);
show += 10;
assert.equal(childOf(was, firstShown(30, show)), 11);
// Then with every read turn drawn (a session cut by the budget: 4 read, 10 allowed), a read adds 30
// older turns in front: the 4 stay drawn plus 10 new, and the old first is at index 30 now.
const before = 4, added = 30;
show = shownAfterRead(before, added, 10);
assert.equal(show, 14);
const first = firstShown(before + added, show);
assert.equal(first, 20);
assert.equal(childOf(added, first), 11, "the turn that was first drawn is child 11 (the head, then 10 new)");
assert.equal(shownAfterRead(4, 3, 10), 7, "fewer older turns than a step: all of them");
assert.equal(shownAfterRead(4, -1, 10), 4, "a read that merged a turn adds nothing below zero");
// The cursor above the drawn turns draws down to it.
const n = 30;
show = 10;
const to = 5;
if (to < firstShown(n, show)) show = n - to;
assert.equal(firstShown(n, show), 5);
assert.equal(childOf(to, firstShown(n, show)), 1);

// ── The Chat face shown (it takes the keyboard on ctrl-b space only then) ───
const lay = (body, page) => ({ id: "root", children: [{ id: "view", ...(page ? { active: page } : {}), children: [
  { id: "thread", children: [{ id: "thread-body", ...(body ? { active: body } : {}), children: [{ id: "main" }, { id: "chat" }] }] },
  { id: "inbox" }] }] });
assert.equal(chatShown(lay("chat", "thread")), true);
assert.equal(chatShown(lay("chat")), true, "the stack view's first child is the thread");
assert.equal(chatShown(lay("main", "thread")), false);
assert.equal(chatShown(lay()), false, "thread-body shows main by default");
assert.equal(chatShown(lay("chat", "inbox")), false, "a page covers the thread");
assert.equal(chatShown({ id: "root", children: [] }), false, "another layout");

console.log("chat-view ok");
