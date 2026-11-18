// bun ~/.config/herdr-app/mods/kt-automation/auto.check.mjs: auto.js, pure. The scan sorted out, a
// loop's definition and cale, the loops running now, « Itération N/M », and above all where and how a
// loop is launched (never the main checkout, the PR required, one loop of a name per worktree, the
// space found again, the exact task), plus a Luau script's summary.
import assert from "node:assert/strict";
import { classify, loopDef, isCale, running, iteration, targets, spaceFor, launch, luau, when, trimSlash, within, TASK, intents } from "./auto.js";

const H = "/Users/k";

// classify: global and project loops (not _shared), their cales, scripts, the binary.
const c = classify([
  `1\t${H}/.claude/skills/me/loop/ci-until-green/SKILL.md`,
  `2\t${H}/.claude/skills/me/loop/_shared/SKILL.md`,
  `3\t${H}/.claude/commands/me/loop/ci-until-green.md`,
  `4\t/r/app/.claude/skills/me/loop/lint-clean/SKILL.md`,
  `5\t/r/app/.herdr/automations/nightly.luau`,
  `6\t${H}/.config/herdr-automate/automations/mine.luau`,
  "BIN\t/x/sheprd-automate",
  "SHEPRD\t/x/sheprd",
  `DIR\t${H}/.claude/skills/me/loop`,
  "garbage",
  "x\t/not/a/stat/line.luau",
].join("\n"), { home: H, project: "/r/app/" });
assert.equal(c.sheprd, "/x/sheprd");
assert.deepEqual(c.dirs, [`${H}/.claude/skills/me/loop`]);
assert.equal(Object.keys(c.mtimes).length, 6);
assert.deepEqual(c.loops.map((l) => [l.name, l.scope, l.repo]), [["ci-until-green", "global", null], ["lint-clean", "projet", "/r/app"]]);
assert.deepEqual(c.cales, { "ci-until-green": [`${H}/.claude/commands/me/loop/ci-until-green.md`] });
assert.deepEqual(c.scripts.map((s) => [s.name, s.repo]), [["mine", null], ["nightly", "/r/app"]]);
assert.equal(c.bin, "/x/sheprd-automate");
assert.equal(classify("", { home: H, project: null }).bin, null);

// loopDef: description, dimensions from the intro, the Définition's fields.
const md = `---
name: me:loop:x
description: "Loop auto-cadencé — fait x"
---

# x

Loop auto-cadencé. **mode:** closed · **trigger:** self-pace · **exécution:** single · **hardened:** true.
## Définition

- **goal** : tous les \`checks\` passent
- **max_iterations** : 6
- **exit_when** : \`CI_FAILED=0\`
- **check_command** (eval gate) : ci-dessous.

\`\`\`bash
## not a section
\`\`\`
## Suite
- **goal** : ignoré
`;
const d = loopDef(md);
assert.deepEqual(d, { description: "Loop auto-cadencé — fait x", mode: "closed", trigger: "self-pace", exec: "single", defined: true,
  goal: "tous les checks passent", max: "6", exit: "CI_FAILED=0", check: "ci-dessous. · script bash de 1 ligne" });
assert.equal(loopDef("# rien").defined, false);
assert.equal(loopDef("# rien").mode, null);

// isCale: reads the SKILL.md, never « invoque la skill ».
assert.ok(isCale("lis `~/.claude/skills/me/loop/x/SKILL.md` et applique", "x"));
assert.ok(!isCale("invoque la skill me:loop:x (skills/me/loop/x/SKILL.md)", "x"));
assert.ok(!isCale("une copie du protocole", "x"));

// running: a thread named loop:<name>, or a terminal labelled loop=<name>; deduped; finished out.
const live = running({
  agents: [{ address: "t1", tab_name: "loop:ci-until-green", status: "working", space: "s1", tab: "b1" }, { address: "t2", tab_name: "fix", status: "idle" }],
  panes: [{ terminal: "t1", cwd: "/r/app-worktrees/feat-1" }],
  terminals: [
    { address: "t1", labels: { loop: "ci-until-green" } },
    { address: "t3", labels: { role: "loop", loop: "docs-sync" }, cwd: "/r/x", status: "idle" },
    { address: "t4", labels: { loop: "gone" }, state: "finished" },
  ],
});
assert.deepEqual(live.map((r) => [r.address, r.name, r.status, r.cwd, r.via]), [["t1", "ci-until-green", "working", "/r/app-worktrees/feat-1", "thread"], ["t3", "docs-sync", "idle", "/r/x", "label"]]);

// iteration: the last one on the screen.
assert.deepEqual(iteration("Itération 1/6\n…\nitération 3 sur 6 · CI_FAILED=2"), { n: 3, m: 6 });
assert.equal(iteration("rien"), null);

// targets: never the main checkout; the trailing slash gone.
const wts = targets([{ path: "/r/app/", is_main: true, branch: "dev" }, { path: "/r/app-worktrees/feat-1", is_main: false, branch: "feat/#1-x", pr: 2 }], "app");
assert.deepEqual(wts.map((w) => [w.path, w.project]), [["/r/app-worktrees/feat-1", "app"]]);
assert.equal(trimSlash("/a/b/"), "/a/b");
assert.ok(within("/a/b/c", "/a/b/") && within("/a/b", "/a/b") && !within("/a/bc", "/a/b"));

// spaceFor: by folder, else by a pane working inside; never a remote space.
const spaces = [
  { id: "sA", folder: "/r/app", machine: null, tabs: [{ id: "bA" }] },
  { id: "sR", folder: "/r/app-worktrees/feat-1", machine: "vps", tabs: [{ id: "bR" }] },
  { id: "sB", folder: "/somewhere", machine: null, tabs: [{ id: "bB" }] },
];
assert.equal(spaceFor("/r/app-worktrees/feat-1", spaces, [{ terminal: "t9", cwd: "/r/app-worktrees/feat-1/src", tab: "bB" }])?.id, "sB");
assert.equal(spaceFor("/r/app-worktrees/feat-1", spaces, []), null);
assert.equal(spaceFor("/r/app", spaces, [])?.id, "sA");

// launch: the main checkout refused, a PR required for a PR loop, one loop of a name per worktree,
// a tab in the worktree's space or a new space there, and the exact task.
const wt = { path: "/r/app-worktrees/feat-1/", branch: "feat/#1-x", is_main: false };
assert.match(launch({ name: "ci-until-green", wt: { ...wt, is_main: true }, pr: 1 }).error, /checkout principal/);
assert.match(launch({ name: "ci-until-green", wt, pr: null }).error, /Pas de PR ouverte pour feat\/#1-x/);
assert.match(launch({ name: "bad name", wt, pr: 1 }).error, /invalide/);
assert.equal(launch({ name: "ci-until-green", wt, pr: 2, live }).show.address, "t1");
assert.ok(!launch({ name: "codex-review-pr", wt, pr: 2, live }).show); // another loop there: fine
const viaTab = launch({ name: "ci-until-green", wt, pr: 2, spaces, panes: [{ terminal: "t9", cwd: "/r/app-worktrees/feat-1", tab: "bB" }] });
assert.deepEqual(viaTab.command, { name: "tab.new", args: { space: "sB", name: "loop:ci-until-green", folder: "/r/app-worktrees/feat-1", argv: ["claude"], task: "/me:loop:ci-until-green" } });
const viaSpace = launch({ name: "test-until-green", wt, pr: null, spaces, panes: [] }); // not a PR loop: no PR needed
assert.deepEqual(viaSpace.command, { name: "space.new", args: { folder: "/r/app-worktrees/feat-1", tab: "loop:test-until-green", argv: ["claude"], task: "/me:loop:test-until-green", machine: "" } });
assert.equal(viaSpace.task, "/me:loop:test-until-green");

// luau: triggers, caps, agent and worktree steps (comments ignored).
const l = luau(`herdr.caps { agents_per_run = 2, tokens_per_day = 2_000_000, wall_time = "3h" }
-- agent { } in a comment
herdr.at("03:00", { tz = "Europe/Paris", days = "mon-fri" }, function(fire)
  pull("main")
  local v = sh("just ci", { check = false })
  if not v.ok then agent { harness = "claude", worktree = "fix-" .. fire.date, prompt = "x" } end
end)
herdr.every("6h", function() notify("ok") end)
herdr.manual({ name = "deploy-preview" }, function() sh("./deploy.sh") end)`);
assert.deepEqual(l.triggers, [{ kind: "at", spec: "03:00", name: null }, { kind: "every", spec: "6h", name: null }, { kind: "manual", spec: null, name: "deploy-preview" }]);
assert.equal(l.caps, `agents_per_run = 2, tokens_per_day = 2_000_000, wall_time = "3h"`);
assert.ok(l.agent && !l.worktree);
assert.deepEqual(l.steps, ["pull", "sh", "agent", "notify"]);
assert.ok(!luau(`herdr.manual(function() sh("x") end) -- agent { }`).agent);
assert.deepEqual(l.triggers.map(when), ["à 03:00", "toutes les 6h", "à la main"]);

// The session's task, as written, and the intentions.
assert.ok(TASK.startsWith("Session dédiée à mes automatisations : loops Claude (me:loop:*)"));
assert.ok(TASK.endsWith("sans tiret cadratin."));
assert.equal(TASK.split("\n").length, 7);
assert.equal(intents.createLoop("relance lint", null), "/me:create-loop relance lint (portée : globale, ~/.claude)");
assert.equal(intents.createLoop("x", "/r/app"), "/me:create-loop x (portée : projet, /r/app/.claude ; il part par une PR)");

console.log("auto.check: ok");
