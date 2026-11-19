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

assert.deepEqual(R.parseHistory("11h    remove   feat-1-x\n2d     remove   fix 2\n\n"), [{ age: "11h", kind: "remove", name: "feat-1-x" }, { age: "2d", kind: "remove", name: "fix 2" }]);
console.log("recent.check: ok");
