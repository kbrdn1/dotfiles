// node mods/kt-flow/steps.test.mjs: steps.js on labels from real claude-flow flows.
import assert from "node:assert/strict";
import { workflowName, issueOf, phasesOf, details, runningLine, findPlans, passOf, decisionOf, locOf } from "./steps.js";

assert.equal(workflowName("me:issue-worktree-pr"), "Issue → Worktree → PR");
assert.equal(workflowName("me:spec-issue-worktree-pr"), "Spec · Issue → Worktree → PR");
assert.equal(issueOf("chore/#145-deps-audit"), "145");
assert.equal(issueOf("dev"), null);

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
