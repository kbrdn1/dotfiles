// bun runner.check.mjs : runner-plan.js, what the runner draws in each state (pure, no Herdr).
import { runnerShown, plan, doneAt, runnerProps, keepBottom, STEP } from "./runner-plan.js";

let failed = 0;
const eq = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { failed++; console.error(`FAIL ${what}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const clawd = { complete: true, poses: {} };

// kt-chat's one condition
eq(["working", "blocked", "done", "error", "idle", undefined].map((s) => runnerShown(s, "claude")), [true, true, true, true, false, false], "shown: by status");
eq([runnerShown("working", "codex"), runnerShown("working", { key: "claude" }), runnerShown("working", "pi"), runnerShown("working", null)], [true, true, false, false], "shown: by program");

const P = (o) => plan({ program: "claude", clawd, now: 10_000, ...o });
eq(P({ status: "idle" }), null, "idle: not there");
eq(P({ status: "working", program: "codex" }), { who: "companion" }, "codex: its companion");
eq(P({ status: "working", clawd: null }), { who: "companion" }, "claude without his poses: Ember");
eq(P({ status: "working", acc: "edit" }), { who: "clawd", poses: ["type-0", "type-1"], ms: 2 * STEP }, "working: types");
eq(P({ status: "working", acc: null }), { who: "clawd", poses: ["type-0", "type-1"], ms: 2 * STEP }, "working, thinking: types");
eq(P({ status: "working", acc: "read" }), { who: "clawd", poses: ["read-0", "read-1"], ms: 19 * STEP }, "reading: the magnifier");
eq(P({ status: "blocked" }), { who: "clawd", poses: ["look-0", "look-1"], ms: 4 * STEP }, "blocked: glances");
eq(P({ status: "error" }), { who: "clawd", poses: ["error"] }, "error: still");
eq(P({ status: "working", reduced: true }), { who: "clawd", poses: ["type-0"] }, "reduced motion: one pose");
// the jump: four steps, one render each, then standing
eq([0, 84, 85, 170, 255, 339].map((dt) => P({ status: "done", doneAt: 10_000 - dt }).poses[0]), ["done-0", "done-0", "done-1", "done-2", "done-3", "done-3"], "done: the jump's steps");
eq(P({ status: "done", doneAt: 10_000 - 100 }).wake, 10_000 + 70, "done: the next step's time");
eq(P({ status: "done", doneAt: 10_000 - 340 }), { who: "clawd", poses: ["idle"] }, "done: then standing, no wake");
eq(P({ status: "done", doneAt: null }), { who: "clawd", poses: ["idle"] }, "opened done: standing");
eq(P({ status: "done", doneAt: 10_000, reduced: true }), { who: "clawd", poses: ["idle"] }, "reduced motion: no jump");

// when the jump began
const t = (prev, next) => doneAt(prev, next, 777);
eq(t({ terminal: "a", status: "working" }, { terminal: "a", status: "done" }), 777, "doneAt: from work");
eq(t({ terminal: "a", status: "blocked" }, { terminal: "a", status: "done" }), 777, "doneAt: from blocked");
eq(t({ terminal: "a", status: "done", doneAt: 5 }, { terminal: "a", status: "done" }), 5, "doneAt: kept while done");
eq(t({ terminal: "a", status: "working" }, { terminal: "b", status: "done" }), null, "doneAt: another thread");
eq(t({}, { terminal: "a", status: "done" }), null, "doneAt: opened done");
eq(t({ terminal: "a", status: "done", doneAt: 5 }, { terminal: "a", status: "idle" }), null, "doneAt: gone at idle");

// the band in the flow: a followed view goes back to the bottom when it comes or goes, and only then
eq([[true, false, true], [true, true, false]].map(([f, w, n]) => keepBottom(f, w, n)), [true, true], "keepBottom: the band comes, the band goes");
eq([[true, true, true], [true, false, false], [false, false, true], [true, undefined, true]].map(([f, w, n]) => keepBottom(f, w, n)), [false, false, false, false], "keepBottom: no change, not following, first render");

// what kt-chat hands it: only when it changes
const ag = { address: "tA", status: "working", program: { key: "claude" } };
const k0 = runnerProps(ag, { action: { tool: "Edit", what: "a.js", at: 1 }, since: 5 });
eq(k0.props, { terminal: "tA", status: "working", program: { key: "claude" }, action: { tool: "Edit", what: "a.js", at: 1 }, since: 5 }, "props: from the agent and its bridge");
eq(runnerProps(ag, { action: { tool: "Edit", what: "a.js", at: 2 }, since: 5 }).key, k0.key, "props: the same action again, no hand-over");
eq([{ ...ag, status: "done" }, { ...ag, address: "tB" }].map((x) => runnerProps(x, { action: { tool: "Edit", what: "a.js" }, since: 5 }).key !== k0.key), [true, true], "props: status or thread changed");
eq([{ action: { tool: "Read", what: "a.js" }, since: 5 }, { action: null, since: 5 }, null].map((b) => runnerProps(ag, b).key !== k0.key), [true, true, true], "props: tool, thinking, no bridge");
eq([runnerProps(ag, null).props.action, runnerProps(ag, { since: 1 }).props.action], [undefined, null], "props: no bridge vs no tool");
eq(runnerProps(null, null).props, { terminal: null, status: null, program: null, action: undefined, since: undefined }, "props: no agent");

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log("runner-plan: ok");
