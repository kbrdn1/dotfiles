// node mods/kt-flow/steps.test.mjs: steps.js on labels from real claude-flow flows.
import assert from "node:assert/strict";
import { workflowName, issueOf, flowBranch, phasesOf, nameOf, details, runningLine, findPlans, passOf, decisionOf, locOf, checkState, tally, checkOrder, duration, runIdOf, logTail, ciLine } from "./steps.js";

assert.equal(workflowName("me:issue-worktree-pr"), "Issue → Worktree → PR");
assert.equal(workflowName("me:spec-issue-worktree-pr"), "Spec · Issue → Worktree → PR");
assert.equal(issueOf("chore/#145-deps-audit"), "145");
assert.equal(issueOf("dev"), null);

// The flow's branch (t2v, t1s): the branch step's, else the worktree's folder, else none.
const B = (id, label) => ({ id, label, state: "done" });
assert.equal(flowBranch([B("issue", "issue #61"), B("branch", "branch feat/#61-every-workflow"), B("worktree", "worktree feat-61-every-workflow")]), "feat/#61-every-workflow");
assert.equal(flowBranch([B("branch", "branch"), B("worktree", "worktree feat-50-securite-du-compte")]), "feat-50-securite-du-compte");
assert.equal(flowBranch([B("worktree", "worktree /Users/x/wt/repo/feat-7-herdr-outbox")]), "feat-7-herdr-outbox");
assert.equal(flowBranch([B("issue", "issue #61")]), null);
assert.equal(flowBranch(undefined), null);
assert.equal(flowBranch([{ id: "branch" }, null]), null);

// CI: check runs as `gh api repos/<repo>/commits/<sha>/check-runs` gives them (claude-crosstalk #8's, kalima #29's).
const run = (name, status, conclusion, s, e, url) => ({ name, status, conclusion, started_at: s, completed_at: e, html_url: url });
const runs = [
  run("GitGuardian Security Checks", "completed", "success", "2026-11-18T05:35:05Z", "2026-11-18T05:35:06Z", "https://github.com/kbrdn1/claude-crosstalk/runs/134602560289"),
  run("validate + test", "completed", "success", "2026-11-18T05:35:07Z", "2026-11-18T05:35:32Z", "https://github.com/kbrdn1/claude-crosstalk/actions/runs/44245262519/job/134602555105"),
  run("Build et tests", "completed", "cancelled", "2026-11-18T05:35:00Z", "2026-11-18T05:38:10Z", "https://github.com/kbrdn1/kalima/actions/runs/43288079227/job/131426699584"),
  run("lint", "in_progress", null, "2026-11-18T05:36:00Z", null, null),
  run("docs", "completed", "skipped", null, null, null),
];
assert.deepEqual(runs.map(checkState), ["ok", "ok", "fail", "pending", "skip"]);
assert.deepEqual(tally(runs.slice(0, 2)), { ok: 2, fail: 0, pending: 0, total: 2, ms: 27000 });
assert.deepEqual(tally(runs), { ok: 3, fail: 1, pending: 1, total: 5, ms: null });
assert.deepEqual(checkOrder(runs).map((r) => r.name), ["Build et tests", "lint", "GitGuardian Security Checks", "validate + test", "docs"]);
assert.deepEqual([duration(27000), duration(190000), duration(3725000), duration(null)], ["27 s", "3 min 10", "1 h 02", ""]);
assert.deepEqual(runs.map(runIdOf), [null, "44245262519", "43288079227", null, null]);
const log = "build\tRun tests\t\x1b[31m2026-11-18T05:37:59.1234567Z FAIL a.test.ts\x1b[0m\nlint\tRun lint\t2026-11-18T05:37:59Z ok\nbuild\tRun tests\t2026-11-18T05:38:00.5Z exit 1\n";
assert.deepEqual(logTail(log, "build"), ["FAIL a.test.ts", "exit 1"]);
assert.deepEqual(logTail(log, "other", 1), ["exit 1"]);
assert.deepEqual(logTail("", "build"), []);
const P = (sha, rs) => ({ sha, tally: tally(rs) });
assert.equal(ciLine([P("aaaaaaa1", [runs[2]]), P("bbbbbbb2", runs.slice(0, 2)), P("ccccccc3", runs.slice(0, 2))]), "3 runs · 2/2 checks · vert depuis bbbbbbb");
assert.equal(ciLine([P("aaaaaaa1", runs.slice(0, 3))]), "1 run · 2/3 checks · 1 en échec");
assert.equal(ciLine([P("aaaaaaa1", [runs[3]])]), "1 run · 0/1 checks · 1 en cours");
assert.equal(ciLine([]), "aucun run");

const d = (id, label) => details({ id, label });
assert.deepEqual(d("review", "review 4/8 · P0P1P2=2"), [{ text: "passe 4/8" }, { text: "2 bloquants", tone: "err" }]);
assert.deepEqual(d("review", "review 3/8 · P0P1P2=0"), [{ text: "passe 3/8" }, { text: "0 bloquant", tone: "ok" }]);
assert.deepEqual(d("ci", "ci 5/6"), [{ text: "5/6 checks", tone: "err" }]);
assert.deepEqual(d("ci", "ci 2/6 · 9/9"), [{ text: "passe 2/6" }, { text: "9/9 checks", tone: "ok" }]);
assert.deepEqual(d("implement", "implement 7 edits · +168 -16"), [{ text: "7 edits" }, { text: "+168", tone: "ok", mono: true }, { text: "−16", tone: "err", mono: true }]);
assert.deepEqual(d("implement", "implement 1 edit · +12 -0"), [{ text: "1 edit" }, { text: "+12", tone: "ok", mono: true }]);
assert.deepEqual(d("pr", "pr #716"), [{ text: "#716", pr: 716, mono: true }]);
assert.deepEqual(d("pin", "pinned"), []);
assert.deepEqual(d("merge", "merge 1eeb1dce"), [{ text: "1eeb1dce", mono: true }]);
assert.deepEqual(d("branch", "branch docs/#50-banner-new-design"), [{ text: "docs/#50-banner-new-design", mono: true }]);
assert.deepEqual(d("review", "review"), []);

const steps = [
  { id: "issue", state: "done" }, { id: "branch", state: "done" }, { id: "worktree", state: "done" }, { id: "pin", state: "done" },
  { id: "implement", state: "done" }, { id: "review", label: "review 4/8 · P0P1P2=2", state: "current" },
  { id: "ci", label: "ci 5/6", state: "current" }, { id: "merge", state: "pending" },
];
const ph = phasesOf(steps);
assert.deepEqual(ph.map((p) => [p.id, p.done, p.total, p.current]), [["prep", 4, 4, false], ["impl", 1, 1, false], ["ship", 0, 2, true], ["close", 0, 1, false]]);
assert.equal(runningLine(steps), "review 4/8 · ci 5/6");
// report (/me:report, me:goal runs it between pr and review): a delivery step, with its name.
const goal = phasesOf([{ id: "pr", state: "done" }, { id: "report", state: "current" }, { id: "review", state: "pending" }]);
assert.deepEqual(goal.map((p) => [p.id, p.steps.map((s) => s.id)]), [["ship", ["pr", "report", "review"]]]);
assert.equal(nameOf("report"), "Rapport");
assert.deepEqual(details({ id: "report", label: "report", state: "current" }), []);
// Review passes: an axis not run never counts as zero; decisions; locations.
const ok = (p2) => ({ state: "ok", p0: 0, p1: 0, p2, p3: 1 });
assert.deepEqual(passOf({ standards: ok(0), spec: ok(0) }).clean, true);
assert.deepEqual(passOf({ standards: ok(1), spec: ok(2) }).blockers, 3);
assert.equal(passOf({ standards: ok(0), spec: { state: "error" } }).clean, false);
assert.equal(passOf({ standards: ok(0), spec: { state: "error" } }).spec, false);
assert.deepEqual(decisionOf({ status: "fixed", ref: "3728d01abc" }), { text: "corrigé 3728d01", tone: "ok" });
assert.deepEqual(decisionOf({ status: "discarded" }), { text: "écarté", tone: "dim" });
assert.deepEqual(decisionOf({}), { text: "ouvert", tone: "warn" });
assert.equal(locOf(".github/workflows/deploy.yml:193 (idem .github/workflows/release.yml:272)"), ".github/workflows/deploy.yml:193");

// Plans: given a folder laid out like ~/Reports (a fixture), the plans holding an issue.
const base = process.argv[2];
if (base) {
  const { readdirSync, readFileSync } = await import("node:fs");
  const list = async (d) => { try { return readdirSync(d); } catch { return []; } };
  const read = async (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };
  const dirs = [`${base}/kbrdn1-kbrdn.dev/plans`, `${base}/_plans`];
  assert.deepEqual((await findPlans(dirs, "163", list, read)).map((p) => p.slug), ["deps-and-ci", "side"]);
  assert.deepEqual((await findPlans(dirs, "145", list, read)).map((p) => p.title), ["Dépendances et CI : audit, épinglage, déploiement"]);
  assert.deepEqual(await findPlans(dirs, "99", list, read), []);
  assert.deepEqual(await findPlans(dirs, null, list, read), []);
  console.log("plans ok");
}
console.log("steps.js ok");
