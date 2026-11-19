// bun ~/.config/herdr-app/mods/kt-hub/recent.check.mjs: the flows, Next and Recent (recent.js): a flow's
// stage and path, the flows by workflow, the next steps, a plan's unblocked issues, the merges (flows and
// reports, once), gwm's history. Synthetic flows and plans.
import assert from "node:assert/strict";
const R = await import("./recent.js");

const flow = (key, steps, o = {}) => ({ key, workflow: "me:issue-worktree-pr", repo: "o/r", issue: 1, pr: 2, seen: 100, doneAt: {}, ...o,
  steps: Object.fromEntries(R.STEPS.map((s) => [s, steps[s] ?? "pending"])) });
const inReview = flow("a", { issue: "done", branch: "done", worktree: "done", implement: "done", commits: "done", push: "done", pr: "done", review: "active" });
assert.deepEqual(R.stage(inReview), { reached: "pr", next: "review", merged: false, noted: false });
const waiting = flow("b", { issue: "done", worktree: "done", implement: "done" });
assert.equal(R.stage(waiting).next, "commits", "the next pending step after the last done");
const merged = flow("c", { issue: "done", implement: "done", pr: "done", merge: "done", note: "done" }, { doneAt: { merge: 500 }, pr: 9, seen: 600 });
assert.deepEqual(R.stage(merged), { reached: "note", next: null, merged: true, noted: true });
assert.deepEqual(R.stage({}), { reached: null, next: null, merged: false, noted: false });

assert.deepEqual(R.path(inReview).map((s) => s.state), ["done", "done", "done", "done", "current", "todo", "todo", "todo"]);
assert.deepEqual(R.path(merged).map((s) => s.state), ["done", "skipped", "done", "done", "skipped", "skipped", "done", "done"], "steps left behind are skipped");

const old = flow("d", {}, { seen: 10 });
const goal = flow("e", { issue: "done" }, { workflow: "me:goal" });
assert.deepEqual(R.byWorkflow([inReview, waiting, merged, old, goal], 50), [
  { workflow: "me:issue-worktree-pr", total: 3, merged: 1, noted: 1, open: { pr: 1, implement: 1 } },
  { workflow: "me:goal", total: 1, merged: 0, noted: 0, open: { issue: 1 } },
]);
assert.deepEqual(R.nextFlows([merged, inReview, old], 50).map((x) => [x.key, x.next]), [["a", "review"]]);

const plan = { plan: "p", repo: "o/r", issues: [
  { n: 1, title: "faite", state: "CLOSED", status: "done", deps: [] },
  { n: 2, title: "libre", state: "OPEN", status: "todo", deps: [1], url: "u2" },
  { n: 3, title: "attend 2", state: "OPEN", status: "todo", deps: [2] },
  { n: 4, title: "bloquée", state: "OPEN", status: "blocked", deps: [] },
  { n: 5, title: "sans dépendance", state: "OPEN", status: "in-progress", deps: [] },
] };
assert.deepEqual(R.nextPlanIssues([plan]).map((i) => i.n), [2, 5]);

const reports = [
  { repo: "o/r", at: 550, issue: "1", pr: { n: 9, title: "la PR 9", state: "MERGED" } },
  { repo: "o/r", at: 700, pr: { n: 10, title: "la PR 10", state: "MERGED" } },
  { repo: "o/r", at: 700, pr: { n: 11, title: "ouverte", state: "OPEN" } },
  { repo: "o/r", at: 20, pr: { n: 12, title: "vieille", state: "MERGED" } },
];
assert.deepEqual(R.recentMerges([merged, inReview], reports, 50), [
  { repo: "o/r", pr: 10, issue: null, title: "la PR 10", at: 700 },
  { repo: "o/r", pr: 9, issue: 1, title: "la PR 9", at: 500 },
], "once each, the flow's time first, the report's title");
// A repo that isn't "owner/name" (a folder's name: no remote, or a session outside any repo): no merge
// line, even merged; the flow stays in the flows.
assert.deepEqual([R.onGitHub("o/r"), R.onGitHub("o/r.dev-v2"), R.onGitHub("folder"), R.onGitHub("a/b/c"), R.onGitHub(null), R.onGitHub("o/")], [true, true, false, false, false, false]);
const local = flow("f", { issue: "done", pr: "done", merge: "done" }, { repo: "folder", pr: 3, doneAt: { merge: 800 } });
assert.deepEqual(R.recentMerges([local], [{ repo: "folder", at: 800, pr: { n: 4, title: "x", state: "MERGED" } }], 50), []);
assert.equal(R.byWorkflow([local], 50)[0].merged, 1, "still counted in its workflow");

assert.deepEqual(R.parseHistory("11h    remove   feat-1-x\n2d     remove   fix 2\n\n"), [{ age: "11h", kind: "remove", name: "feat-1-x" }, { age: "2d", kind: "remove", name: "fix 2" }]);

// #76: the weeks, from the commits. Now: Thursday 19 Nov. 2026, noon (local); its Monday the 16th.
const day = (d, h = 12) => new Date(2026, 10, d, h).getTime();
const NOW = day(19);
const wk = (key, steps, c0, c1, o = {}) => flow(key, steps, { c0, c1, nc: c0 == null ? 0 : 3, ...o });
const fl = [
  wk("w1", { issue: "done", pr: "done", review: "active" }, day(3), day(4)), // week of the 2nd, open, waits for review
  wk("w2", { issue: "done", pr: "done", merge: "done" }, day(10), day(17)), // active both weeks, merged the 17th
  wk("w3", { issue: "done", pr: "done" }, day(17), day(18)), // waits for review too, more recent
  wk("w4", { issue: "done" }, null, null), // no commit: no week, no span; waits for its branch
];
const W = R.flowWeeks(fl, NOW);
assert.deepEqual(W.starts, [new Date(2026, 10, 2).getTime(), new Date(2026, 10, 9).getTime(), new Date(2026, 10, 16).getTime()]);
assert.deepEqual(W.active, [1, 1, 2]);
assert.deepEqual(W.merged, [0, 0, 1]);
assert.deepEqual([W.total, W.mergedTotal, W.open, W.oldest.key], [4, 1, 3, "w1"]);
assert.deepEqual([W.spanN, W.median], [3, day(18) - day(17)], "the middle of 1 d, 1 d, 7 d");
assert.deepEqual(W.blocks.map((b) => [b.step, b.n, b.oldest?.key ?? null]), [["review", 2, "w1"], ["branch", 1, null]]);
assert.deepEqual(R.flowWeeks([], NOW).active, [0, 0, 0]);

// #76: a funnel per workflow, the most flows first: passed (done or left behind) and at work, per step.
const F = R.funnels([inReview, merged, goal]);
assert.deepEqual(F.map((x) => [x.workflow, x.total, x.merged]), [["me:issue-worktree-pr", 2, 1], ["me:goal", 1, 0]]);
assert.deepEqual(F[0].steps.map((s) => s.id), R.PATH);
assert.deepEqual(F[0].steps.map((s) => s.passed), [2, 2, 2, 2, 1, 1, 1, 1], "merged's skipped steps count as passed");
assert.deepEqual(F[0].steps.map((s) => s.current), [0, 0, 0, 0, 1, 0, 0, 0]);
console.log("recent.check: ok");
