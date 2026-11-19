// bun runner.check.mjs : runner-plan.js, what the runner draws in each state (pure, no Herdr), its chance
// replayed from fixed seeds.
import { runnerShown, plan, doneAt, runnerProps, keepBottom, freshAction, moodOf, variantAt, glanceLoops, hash, VARIANTS, CLAWD_POSES, STEP, EPOCH, RUN } from "./runner-plan.js";

let failed = 0;
const eq = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { failed++; console.error(`FAIL ${what}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const clawd = { complete: true, poses: {} };

// kt-chat's one condition
eq(["working", "blocked", "done", "error", "idle", undefined].map((s) => runnerShown(s, "claude")), [true, true, true, true, false, false], "shown: by status");
eq([runnerShown("working", "codex"), runnerShown("working", { key: "claude" }), runnerShown("working", "pi"), runnerShown("working", null)], [true, true, false, false], "shown: by program");

// what he does: the mood, from the status and the action's accessory
eq(["read", "web", "edit", "bash", "git", "tests", null, "think", "agent-claude", "agent-codex"].map((a) => moodOf("working", a)),
  ["read", "read", "type", "type", "type", "type", "type", "think", "think", "think"], "mood: by accessory (a message sent types)");
eq(["blocked", "done", "error"].map((s) => moodOf(s, "read")), ["blocked", "rest", "error"], "mood: the status first");
eq([freshAction(undefined, 5), freshAction(null, 5), freshAction({ tool: "Read", at: 4 }, 5), freshAction({ tool: "Read", at: 6 }, 5)?.tool, freshAction({ tool: "Read" }, 5)?.tool],
  [undefined, null, null, "Read", "Read"], "fresh: an action from before this state is over");
// every variant names extracted poses only
eq(Object.values(VARIANTS).flat().flatMap((v) => [...v.poses, v.glance?.pose].filter(Boolean)).filter((p) => !CLAWD_POSES.includes(p)), [], "variants: known poses");

// chance: seeded, replayed, every variant comes, never the same twice in a row inside a run
eq(hash(1, 0, 3) === hash(1, 0, 3) && hash(1, 0, 3) !== hash(2, 0, 3) && hash(1, 0, 3) !== hash(1, 1, 3), true, "hash: deterministic, the seed and the salt count");
for (const mood of ["type", "read", "think", "blocked", "rest"]) {
  const seq = Array.from({ length: 160 }, (_, e) => variantAt(mood, 42, e));
  eq(new Set(seq).size, VARIANTS[mood].length, `${mood}: every variant comes`);
  eq(seq.filter((v, e) => e % RUN !== 0 && v === seq[e - 1]).length, 0, `${mood}: no repeat inside a run`);
  eq(seq.filter((v, e) => e > 0 && v === seq[e - 1]).length <= 2, true, `${mood}: a repeat only where a run starts (${seq.filter((v, e) => e > 0 && v === seq[e - 1]).length})`);
}
eq(variantAt("error", 42, 7), 0, "error: one variant");
eq(Array.from({ length: 16 }, (_, e) => variantAt("type", 7, e)).join("") !== Array.from({ length: 16 }, (_, e) => variantAt("type", 8, e)).join(""), true, "two seeds, two runs");

// the plan
const P = (o) => plan({ program: "claude", clawd, now: 10 * EPOCH + 100, seed: 42, ...o });
eq(P({ status: "idle" }), null, "idle: not there");
eq(P({ status: "working", program: "codex" }), { who: "companion" }, "codex: its companion");
eq(P({ status: "working", clawd: null }), { who: "companion" }, "claude without his poses: Ember");
const w = P({ status: "working", acc: "edit" });
eq([w.mood, VARIANTS.type[w.variant].poses, w.wake], ["type", w.poses, 11 * EPOCH], "working: types, a variant, then the next epoch");
eq(P({ status: "working", acc: "read" }).mood, "read", "reading: the magnifier");
eq(P({ status: "working", acc: "think" }).mood, "think", "thinking: glances");
eq(P({ status: "blocked" }).mood, "blocked", "blocked: waits");
// the timer of the draws runs while the agent works or waits: done, the last draw holds (error: one pose)
eq(["working", "blocked", "done", "error"].map((s) => P({ status: s, acc: "edit" }).wake ?? null), [11 * EPOCH, 11 * EPOCH, null, null], "wake: not once done");
eq(P({ status: "error" }), { who: "clawd", mood: "error", variant: 0, poses: ["error"] }, "error: still, no wake");
eq(P({ status: "working", acc: "edit", now: 10 * EPOCH + 100 }).variant, P({ status: "working", acc: "edit", now: 11 * EPOCH - 1 }).variant, "inside an epoch: the same variant");
eq(P({ status: "working", acc: "edit", now: 10 * EPOCH }).variant !== P({ status: "working", acc: "edit", now: 11 * EPOCH }).variant, true, "the next epoch: another one");
for (const s of [["working", "edit"], ["working", "read"], ["working", "think"], ["blocked", null], ["done", null], ["error", null]])
  eq(P({ status: s[0], acc: s[1], reduced: true }), { who: "clawd", mood: moodOf(s[0], s[1]), variant: 0, poses: [VARIANTS[moodOf(s[0], s[1])][0].poses[0]] }, `reduced motion: one pose, still (${s.join(" ")})`);
// the jump: its four poses once, natively (runner.js hands them to companion.js once()), over the
// resting variant; no timer: drawn while its 340 ms last, gone after
const T = 10 * EPOCH + 1000;
const J = { poses: ["done-0", "done-1", "done-2", "done-3"], ms: STEP };
eq([0, 100, 339].map((dt) => P({ status: "done", doneAt: T - dt, now: T }).jump), [0, 100, 339].map((dt) => ({ ...J, at: T - dt })), "done: the jump, from doneAt");
eq([340, 5000].map((dt) => P({ status: "done", doneAt: T - dt, now: T }).jump ?? null), [null, null], "done: no jump once it is over");
const rest = P({ status: "done", doneAt: T, now: T });
eq([rest.mood, VARIANTS.rest[rest.variant].poses, rest.wake ?? null], ["rest", rest.poses, null], "done: the jump over the resting variant, no wake");
eq([P({ status: "done", doneAt: null }).mood, P({ status: "done", doneAt: null }).jump ?? null], ["rest", null], "opened done: resting, no jump");
eq(P({ status: "done", doneAt: T, now: T, reduced: true }), { who: "clawd", mood: "rest", variant: 0, poses: ["idle"] }, "reduced motion: no jump");

// a glance's windows: up `for` ms in the middle of each period, the rest down meanwhile
const at = (l, t) => { const h = l.period / 2, u = t % l.period, x = u < h ? u / h : 2 - u / h; return Math.min(1, Math.max(0, l.from + (l.to - l.from) * x)); };
for (const [every, ms] of [[40 * STEP, 8 * STEP], [60 * STEP, 6 * STEP], [24 * STEP, 8 * STEP]]) {
  const g = glanceLoops(every, ms);
  let up = 0, both = 0, none = 0;
  for (let t = 0; t < every; t++) { const s = at(g.show, t), r = at(g.hide, t); if (s > 0.5) up++; if (s > 0.5 && r > 0.5) both++; if (s < 0.5 && r < 0.5) none++; }
  eq(Math.abs(up - ms) <= 16 && both === 0 && none <= 2, true, `glance ${every}/${ms}: up ${up} ms, both ${both}, none ${none}`);
  eq(at(g.show, every / 2) === 1 && at(g.show, 0) === 0 && at(g.hide, 0) === 1, true, `glance ${every}/${ms}: in the middle`);
}

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
