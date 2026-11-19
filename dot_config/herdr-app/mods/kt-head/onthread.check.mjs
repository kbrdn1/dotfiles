// bun onthread.check.mjs: onthread.js (#86, A1), the thread's terminals on screen before a pane command:
// the thread back from a page, its terminal face from the Chat, nothing when they show, nothing without
// the stacks (another layout).
import assert from "node:assert/strict";
import { onThread } from "./onthread.js";

// The layout as kbrdn-threads has it: the stack view (thread and the pages), the thread's stack.
const tree = (page, face) => ({ id: "root", children: [{ id: "view", type: "stack", ...(page ? { active: page } : {}), children: [
  { id: "thread", children: [{ id: "thread-body", type: "stack", ...(face ? { active: face } : {}), children: [{ id: "main" }, { id: "chat" }] }] },
  { id: "inbox" }, { id: "kanban" }] }] });
const run = (root) => {
  const calls = [];
  const moved = onThread({ layout: () => root, run: (name, args) => calls.push([name, args]) });
  return { moved, calls };
};

// The terminals show (no active written: the first children, thread and main): nothing.
assert.deepEqual(run(tree()), { moved: false, calls: [] });
assert.deepEqual(run(tree("thread", "main")), { moved: false, calls: [] });
// From a page: the thread again.
assert.deepEqual(run(tree("inbox", "main")), { moved: true, calls: [["layout.select", { stack: "view", child: "thread" }]] });
// From the Chat face: the terminals.
assert.deepEqual(run(tree("thread", "chat")), { moved: true, calls: [["layout.select", { stack: "thread-body", child: "main" }]] });
// From a page over the Chat face: both, the page first.
assert.deepEqual(run(tree("kanban", "chat")).calls, [
  ["layout.select", { stack: "view", child: "thread" }], ["layout.select", { stack: "thread-body", child: "main" }]]);
// Another layout, without the stacks: nothing.
assert.deepEqual(run({ id: "root", children: [{ id: "main" }] }), { moved: false, calls: [] });
// A layout whose thread-body is a plain block (#86 lots 3-4, before the face came back), or a stack with
// no `main`: only the page half.
const block = (page, body) => ({ id: "root", children: [{ id: "view", type: "stack", ...(page ? { active: page } : {}), children: [
  { id: "thread", children: [body] }, { id: "inbox" }] }] });
assert.deepEqual(run(block("inbox", { id: "thread-body", type: "block", active: "chat" })).calls, [["layout.select", { stack: "view", child: "thread" }]]);
assert.deepEqual(run(block(null, { id: "thread-body", type: "block" })), { moved: false, calls: [] });
assert.deepEqual(run(block(null, { id: "thread-body", type: "stack", active: "chat", children: [{ id: "chat" }, { id: "other" }] })), { moved: false, calls: [] });

console.log("onthread: ok");
