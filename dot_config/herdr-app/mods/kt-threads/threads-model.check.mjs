// bun ~/.config/herdr-app/mods/kt-threads/threads-model.check.mjs : threads-model.js (the threads, their
// statuses, projects, flow phases, snoozes, pins, order, sub-agents) and threads-io.js on fakes. Made-up
// data only ("fx" ids, /fx folders). Not loaded by Herdr.
import assert from "node:assert/strict";
import * as M from "./threads-model.js";
import * as io from "./threads-io.js";
import { filterOf } from "./thread-filter.js";

const now = new Date(2026, 10, 18, 15, 0).getTime();
const MIN = 60e3, H = 3600e3, D = 86400e3;
const J = (...a) => JSON.stringify(a);
const claude = { key: "claude", name: "Claude Code", agent: true };
const zsh = { key: "shell", name: "zsh", agent: false };
const tab = (id, o = {}) => ({ id, name: "1", named: false, active: false, status: null, settled: false, settled_at: null, changed_at: null, working_since: null, ...o });
const pane = (tabId, terminal, program, o = {}) => ({ pane: `p-${terminal}`, terminal, tab: tabId, title: program.name, cwd: null, branch: null, status: null, app: null, program, focused: false, ...o });

const HOME = "/fx/home";
const acmeGit = J(null, "/fx/acme/.git");
const spaces = [
  { id: "fx-s1", name: "~", named: false, folder: HOME, machine: null, active: false, tabs: [tab("fx-t1", { status: "working", changed_at: now - 2 * MIN })] },
  { id: "fx-s2", name: "acme", named: false, folder: "/fx/acme", machine: null, active: false,
    tabs: [tab("fx-t2", { status: "blocked", changed_at: now - 5 * MIN }), tab("fx-t3", { status: "done", changed_at: now - 26 * H })] },
  { id: "fx-s3", name: "acme", named: false, folder: "/fx/wt/acme/feat-12-x", machine: null, active: true,
    tabs: [tab("fx-t4", { active: true, status: "working", changed_at: now - 3 * MIN }), tab("fx-t5", { settled: true, settled_at: now - 3 * D, changed_at: now - 4 * D })] },
  { id: "fx-s4", name: "beta", named: false, folder: "/fx/beta", machine: null, active: false,
    tabs: [tab("fx-t6", { status: "idle", changed_at: now - 40 * MIN }), tab("fx-t7"), tab("fx-t8", { status: "done", changed_at: now - MIN })] },
];
const panes = [
  pane("fx-t1", "fx1", claude, { cwd: HOME, title: "✳ Notes", status: "working" }),
  pane("fx-t2", "fx2", claude, { cwd: "/fx/acme/src", branch: "fix/#9-login", status: "blocked", title: "✳ Login" }),
  pane("fx-t3", "fx3", { key: "codex", name: "Codex", agent: true }, { cwd: "/fx/acme", branch: "dev", status: "done" }),
  pane("fx-t4", "fx4b", zsh, { cwd: "/fx/wt/acme/feat-12-x", branch: "feat/#12-x", focused: true }),
  pane("fx-t4", "fx4", claude, { cwd: "/fx/wt/acme/feat-12-x", branch: "feat/#12-x", status: "working", title: "✳ Ring model" }),
  pane("fx-t5", "fx5", claude, { cwd: "/fx/wt/acme/feat-12-x", branch: "feat/#13-old" }),
  pane("fx-t6", "fx6", claude, { cwd: "/fx/beta" }),
  pane("fx-t7", "fx7", zsh, { cwd: "/fx/beta" }),
  pane("fx-t8", "fx8", claude, { cwd: "/fx/beta", status: "done" }),
];
const acme = { key: acmeGit, name: "acme", linked: false };
const registry = M.sortRegistry([
  { id: J(null, "/fx/beta"), name: "beta", folder: "/fx/beta", machine: null, color: null, logos: { light: "b.svg", dark: null }, order: 1 },
  { id: J(null, "/fx/acme"), name: "acme", folder: "/fx/acme", machine: null, color: "ansi4", logos: { light: null, dark: "a-dark.svg" }, order: 0 },
]);
const world = {
  spaces, panes, now, home: HOME, homeReal: HOME, registry, dark: true,
  repos: {
    [J(null, HOME)]: null, [J(null, "/fx/acme")]: acme, [J(null, "/fx/acme/src")]: acme,
    [J(null, "/fx/wt/acme/feat-12-x")]: { key: acmeGit, name: "acme", linked: true }, [J(null, "/fx/beta")]: null,
  },
  real: { [J(null, HOME)]: J(null, HOME), [J(null, "/fx/beta")]: J(null, "/fx/beta") },
  colors: { "fx-s2": "ansi4", "fx-s3": "ansi4", "fx-s4": "#aa5500" },
  live: {
    fx4: {
      updatedAt: now - 30e3, slAt: now - MIN, sl: { model: "Opus", effort: "high", ctx_pct: 42, cost_usd: 3.21 },
      action: { tool: "Bash", what: "Run bun test", at: now - 20e3 },
      flow: { workflow: "me:issue-worktree-pr", steps: [{ id: "issue", label: "issue #12", state: "done" }, { id: "implement", label: "implement", state: "current" }, { id: "pr", label: "pr", state: "pending" }] },
      agents: [
        { id: "a1", state: "running", startedAt: now - 2 * MIN },
        { id: "a2", state: "background", startedAt: now - MIN },
        { id: "a3", state: "done", startedAt: now - 10 * MIN, endedAt: now - 90e3 },
        { id: "a4", state: "killed", startedAt: now - H, endedAt: now - 30 * MIN },
        { id: "a5", state: "error", startedAt: now - 200e3, endedAt: now - 30e3 },
        { id: "a6", at: now - 2 * H, state: "done" }, // a 0.3.0 bridge's row: `at` only
      ],
    },
    fx6: { updatedAt: now - 40 * MIN, flow: { steps: [{ id: "issue", label: "issue #3", state: "done" }, { id: "report", label: "report", state: "current" }] } },
    fx2: { pending: { id: "p1", kind: "permission", title: "Autoriser Bash", detail: "rm -rf build", options: [] } },
    fx8: { answer: "La PR\n  est prête." },
  },
  reports: { "acme|fix/#9-login": { review: null, ci: null, pr: { number: 9, state: "OPEN", url: "u/9" }, at: null } },
  prs: { [M.prKey(null, "/fx/wt/acme/feat-12-x", "feat/#12-x")]: { number: 34, state: "OPEN", url: "u/34" } },
  defaults: { [acmeGit]: "main" },
  snoozed: { "fx-t6": { until: now + 2 * H, at: now - 10 * MIN }, "fx-t8": { until: now + H, at: now - 10 * MIN }, "fx-t3": { until: now - MIN, at: now - H } },
  pins: ["fx-t7"],
  firstSeen: { "fx-t7": now - 2 * D },
};
const threads = M.threadsOf(world);
const th = Object.fromEntries(threads.map((x) => [x.id, x]));

// Every tab, in spaces' and tabs' order, plain objects keyed by tab id.
assert.deepEqual(threads.map((x) => x.id), ["fx-t1", "fx-t2", "fx-t3", "fx-t4", "fx-t5", "fx-t6", "fx-t7", "fx-t8"]);
assert.equal(th["fx-t4"].shown, true);
assert.equal(th["fx-t1"].shown, false);

// Statuses: Herdr's, null without an agent; the Kanban's columns put it in idle.
assert.equal(th["fx-t2"].status, "blocked");
assert.equal(th["fx-t7"].status, null);
assert.equal(th["fx-t7"].agentKey, null);
assert.equal(th["fx-t3"].agentKey, "codex");
const cols = M.byStatus(threads.filter((x) => !x.settled), world.pins);
assert.deepEqual(Object.keys(cols), ["blocked", "done", "working", "idle"]);
assert.deepEqual(cols.blocked.map((x) => x.id), ["fx-t2"]);
assert.deepEqual(cols.done.map((x) => x.id), ["fx-t8", "fx-t3"]);
assert.deepEqual(cols.idle.map((x) => x.id), ["fx-t7", "fx-t6"]); // pinned first at equal status

// The lead and the agent: the focused shell shows first, the agent stays the agent's.
assert.equal(th["fx-t4"].lead.terminal, "fx4b");
assert.equal(th["fx-t4"].agent.terminal, "fx4");
assert.equal(th["fx-t4"].terminal, "fx4");
assert.equal(th["fx-t4"].program.key, "claude");
assert.equal(th["fx-t4"].title, "Ring model");

// A worktree's project is its repo's: the main checkout's registry entry, its color and logo.
const wt = th["fx-t4"];
assert.equal(wt.worktree, true);
assert.equal(wt.project.key, J(null, "/fx/acme"));
assert.equal(wt.project.id, J(null, "/fx/acme"));
assert.equal(wt.project.name, "acme");
assert.equal(wt.project.color, "ansi4");
assert.equal(wt.project.logo, "a-dark.svg");
assert.equal(wt.repo.name, "acme");
assert.equal(wt.repo.first.id, "fx-s2"); // the repo's first space
assert.equal(th["fx-t2"].worktree, false);
assert.equal(th["fx-t2"].project.key, wt.project.key);
assert.equal(M.projectId(spaces[2], world), M.projectId(spaces[1], world));

// Home: never a project, a house of its own.
assert.equal(th["fx-t1"].project.key, "home");
assert.equal(th["fx-t1"].project.home, true);
assert.equal(th["fx-t1"].project.id, null);
assert.equal(th["fx-t1"].project.name, "Home");
assert.equal(th["fx-t1"].project.color, "dim");
assert.ok(M.isHome({ machine: null, folder: "/fx/elsewhere" }, { ...world, real: { [J(null, "/fx/elsewhere")]: J(null, HOME) } }));
assert.ok(!M.isHome({ machine: "vps", folder: HOME }, world));

// A thread without git: its project is its folder's real path, its repo its space.
const beta = th["fx-t6"];
assert.equal(beta.worktree, null);
assert.equal(beta.project.key, J(null, "/fx/beta"));
assert.equal(beta.project.name, "beta");
assert.equal(beta.project.color, "#aa5500"); // no registry color: the space's
assert.equal(beta.project.logo, "b.svg"); // dark asked, only a light one: that one
assert.deepEqual([beta.repo.key, beta.repo.name, beta.repo.first.id], ["fx-s4", "beta", "fx-s4"]);
assert.deepEqual([beta.branch, beta.pr, beta.prFrom, beta.report], [null, null, null, null]);
// Not known yet (no repo, no real path): its space.
const unknown = M.threadOf({ id: "fx-s9", name: "new", folder: "/fx/new", machine: null, tabs: [] }, tab("fx-t9"), world);
assert.deepEqual([unknown.project.key, unknown.project.id, unknown.worktree], ["space:fx-s9", null, null]);

// Issue, PR, report: the branch's issue; /me:report's PR before gh's; none on a long-lived branch.
assert.equal(wt.issue, "12");
assert.deepEqual([wt.pr.number, wt.prFrom], [34, "gh"]);
assert.deepEqual([th["fx-t2"].pr.number, th["fx-t2"].prFrom, th["fx-t2"].issue], [9, "report", "9"]);
assert.deepEqual([th["fx-t3"].pr, th["fx-t3"].prFrom], [null, null]); // dev
assert.equal(beta.issue, "3"); // no branch: the flow's issue step
assert.deepEqual(M.prOf({ cwd: "/fx/acme", branch: "main" }, spaces[1], { ...world, reports: {}, prs: { [M.prKey(null, "/fx/acme", "main")]: { number: 1 } } }), { pr: null, from: null });

// What it waits on (herdr-bridge's pending) and what it does (the sidebar's live line).
assert.deepEqual(th["fx-t2"].asks, { kind: "permission", title: "Autoriser Bash", detail: "rm -rf build" });
assert.equal(wt.asks, null);
assert.equal(wt.line, "Run bun test"); // working: its last action
assert.equal(th["fx-t8"].line, "La PR est prête."); // done: its answer, on one line
assert.equal(th["fx-t2"].line, null); // blocked: none (it asks)
assert.equal(M.lineOf("idle", { action: { what: "x" } }), null);
assert.equal(M.lineOf("working", null), null);
assert.equal(M.lineOf("working", { action: { what: "  " } }), null);

// Cost, context, model: the agent's statusline.
assert.deepEqual([wt.cost, wt.ctx, wt.model, wt.effort], [3.21, 42, "Opus", "high"]);
assert.deepEqual([beta.cost, beta.ctx], [null, null]);

// Flow phases: the current step's; a step out of the table, none; nothing current, none. report
// (/me:report, between pr and review) is a delivery step.
assert.deepEqual([wt.flow.step.id, wt.flow.phase, wt.flow.at, wt.flow.done, wt.flow.total, wt.flow.workflow], ["implement", "impl", "impl", 1, 3, "me:issue-worktree-pr"]);
assert.deepEqual([beta.flow.step.id, beta.flow.phase, beta.flow.at], ["report", "ship", "ship"]);
assert.equal(M.flowOf({ steps: [{ id: "merge", state: "done" }, { id: "note", state: "done" }] }).step, null);
assert.equal(M.flowOf({ steps: [{ id: "merge", state: "done" }] }).phase, null);
assert.deepEqual(M.flowOf({ steps: [{ id: "issue", state: "pending" }] }), { workflow: null, step: null, phase: null, at: null, done: 0, total: 1 });
assert.equal(M.flowOf({ steps: [{ id: "constructor", state: "current" }] }).phase, null);
// Where it stands: the current step, else the furthest reached (a skipped step doesn't hold it back,
// a failed one counts), "other" out of the table, null before anything.
const at = (states, ids = ["issue", "implement", "docs", "push", "ci", "merge", "note"]) => M.flowOf({ steps: ids.map((id, i) => ({ id, state: states[i] ?? "pending" })) }).at;
assert.equal(at(["done", "done", "pending", "done", "done"]), "ship"); // waiting on merge, docs skipped
assert.equal(at(["done", "done", "done", "done", "failed"]), "ship"); // CI failed
assert.equal(at(["done", "current", "pending", "done"]), "impl"); // the current one wins
assert.equal(at(["done", "done", "done", "done", "done", "done", "done"]), "close");
assert.equal(at([]), null);
assert.equal(at(["done", "done"], ["issue", "constructor"]), "other");
assert.equal(M.flowOf({ steps: [] }).at, null);
assert.equal(M.flowOf({ steps: "torn" }), null);
assert.equal(M.flowOf(null), null);
for (const [id, phase] of [["pin", "prep"], ["tasks", "spec"], ["docs", "impl"], ["ci", "ship"], ["issue-closed", "close"]])
  assert.equal(M.flowOf({ steps: [{ id, state: "current" }] }).phase, phase);
assert.equal(th["fx-t1"].flow, null);

// Sub-agents: k ended / n over the whole list; shown, the alive (running, background) then the ended
// under GONE, latest first. killed and error count as ended.
assert.deepEqual([wt.subagents.done, wt.subagents.total], [4, 6]);
assert.deepEqual(wt.subagents.shown.map((a) => a.id), ["a1", "a2", "a5", "a3"]);
assert.equal(M.agentAge(wt.subagents.shown[0], now), "2m");
assert.equal(M.agentAge(wt.subagents.shown[3], now), "1m~"); // ended 90 s ago: faded
assert.deepEqual([beta.subagents.done, beta.subagents.total, beta.subagents.shown.length], [0, 0, 0]);
assert.deepEqual(M.shownAgents(undefined, now), []);

// Snooze: asleep until due; a due one wakes; an agent asking since wakes it; settled never sleeps.
assert.equal(beta.asleep, true);
assert.deepEqual(beta.snooze, world.snoozed["fx-t6"]);
assert.equal(th["fx-t8"].asleep, false); // done after the snooze
assert.equal(th["fx-t3"].asleep, false); // due a minute ago
assert.equal(M.asleep(tab("fx-t6"), world.snoozed, now + 3 * H), false); // expired
assert.equal(M.asleep(tab("fx-t6", { settled: true }), world.snoozed, now), false);
assert.equal(M.until(now + 2 * H, now), "2h");

// Pins.
assert.equal(th["fx-t7"].pinned, true);
assert.equal(th["fx-t6"].pinned, false);

// Activity: the agents' last write, else Herdr's change, else first seen, else now.
assert.equal(wt.activity, now - 30e3);
assert.equal(th["fx-t2"].activity, now - 5 * MIN);
assert.equal(th["fx-t7"].activity, now - 2 * D);
assert.equal(unknown.activity, now);

// Shelves and order: the archived view, else pinned / awake / snoozed.
const f = filterOf(null);
const s = M.sections(threads, f, world.pins);
assert.deepEqual(s.pinned.map((x) => x.id), ["fx-t7"]);
assert.deepEqual(s.active.map((x) => x.id), ["fx-t1", "fx-t2", "fx-t3", "fx-t4", "fx-t8"]);
assert.deepEqual(s.snoozed.map((x) => x.id), ["fx-t6"]);
const arch = M.sections(threads, filterOf({ archived: true }), world.pins);
assert.deepEqual([arch.archived.map((x) => x.id), arch.archived[0].activity, arch.pinned.length], [["fx-t5"], now - 3 * D, 0]);
// Groups: Home first, then the projects that need you, then the registry's order; inside, byNeed.
const groups = M.projectGroups([...s.pinned, ...s.active], world.pins, registry);
assert.deepEqual(groups.map((g) => [g.key, g.need, g.at]), [["home", 0, -1], [J(null, "/fx/acme"), 1, 0], [J(null, "/fx/beta"), 0, 1]]);
assert.deepEqual(groups[1].threads.map((x) => x.id), ["fx-t2", "fx-t3", "fx-t4"]);
assert.equal(groups[1].space.id, "fx-s2");
assert.deepEqual(M.sortByNeed([th["fx-t7"], th["fx-t6"], th["fx-t8"]], []).map((x) => x.id), ["fx-t8", "fx-t6", "fx-t7"]);
// By date, newest tab first inside each group.
assert.deepEqual(M.datedGroups(s.active, now).map(([id, l]) => [id, l.map((x) => x.id)]), [["today", ["fx-t8", "fx-t4", "fx-t2", "fx-t1"]], ["yesterday", ["fx-t3"]]]);
// The shown project (its worktrees too), or every one; the filter.
assert.deepEqual(M.scoped(threads, spaces[2], world.repos).map((x) => x.id), ["fx-t2", "fx-t3", "fx-t4", "fx-t5"]);
assert.equal(M.scoped(threads, null, world.repos).length, threads.length);
assert.deepEqual(M.filtered(threads, filterOf({ status: ["blocked"] }), now).map((x) => x.id), ["fx-t2"]);
assert.deepEqual(M.filtered(threads, filterOf({ programs: ["codex"] }), now).map((x) => x.id), ["fx-t3"]);

// Colors: a new space gets the least used, "~" none; closed spaces drop out.
const c1 = M.assignColors([{ id: "a", name: "x" }, { id: "b", name: "y" }, { id: "h", name: "~" }], { a: "ansi6", gone: "ansi3" });
assert.deepEqual([c1.colors, c1.changed], [{ a: "ansi6", b: "ansi3" }, true]);
assert.equal(M.assignColors([{ id: "a", name: "x" }], { a: "ansi6" }).changed, false);

// Formatters.
assert.deepEqual([M.age(now - 30e3, now), M.age(now - 3 * MIN, now), M.age(now - 5 * H, now), M.age(now - 3 * D, now), M.age(0, now)], ["now", "3m", "5h", "3d", ""]);
assert.deepEqual([M.duration(now - 12e3, now), M.duration(now - 3 * MIN, now), M.duration(now - 75 * MIN, now)], ["12s", "3m", "1h 15m"]);

// ---------- threads-io.js, on fakes ----------
const files = {
  [`${HOME}/.claude/cache/herdr/fx1.json`]: JSON.stringify({ state: "working" }),
  [`${HOME}/.claude/cache/statusline/herdr-fx1.json`]: JSON.stringify({ model: "Opus", updated_at: 1794900030 }),
  [`${HOME}/.claude/cache/herdr/fx1.flow.json`]: JSON.stringify({ steps: [] }),
  [`${HOME}/.claude/cache/herdr/fx3.json`]: "{torn",
  [`${HOME}/.claude/cache/statusline/herdr-quota.json`]: JSON.stringify({ five_hour: { used_percentage: 3 }, updated_at: 1 }),
  [`${HOME}/Reports/fx-acme/fix-9-login/data.js`]: `window.__report = ${JSON.stringify({ facts: { pr: { number: 9 } }, generatedAt: "g" })};`,
  [`${HOME}/Reports/fx-acme/dev/facts.json`]: JSON.stringify({ ci: { ok: 1, total: 1 }, generatedAt: "f" }),
  [`${HOME}/Reports/fx-acme/dev/data.js`]: "never read",
};
const read = [];
const readTextFile = async (p) => { read.push(p); return files[p] ?? null; };
const livePanes = [pane("fx-t1", "fx1", claude, { app: "claude-code" }), pane("fx-t3", "fx3", { key: "codex", name: "Codex", agent: true }), pane("fx-t7", "fx7", zsh), pane("x", "vps/fx9", claude)];
const prevLive = { fx3: { state: "done" } };
const r1 = await io.readLive(livePanes, { home: HOME, readTextFile }, { live: prevLive, quota: null });
assert.deepEqual(r1.live.fx1, { state: "working", sl: { model: "Opus" }, slAt: 1794900000e3, flow: { steps: [] } });
assert.deepEqual(r1.live.fx3, { state: "done" }); // torn: the last one
assert.ok(!read.some((p) => p.includes("herdr-fx3") || p.includes("fx7") || p.includes("fx9"))); // statusline: Claude only; no shell, no remote
assert.deepEqual(r1.quota, { five_hour: { used_percentage: 3 } });
read.length = 0;
const r2 = await io.readLive([livePanes[1]], { home: HOME, readTextFile }, { live: {}, quota: { kept: 1 } });
assert.equal(r2.quota, null); // no Claude thread: no quota read
assert.ok(!read.some((p) => p.includes("quota")));

const repos = { [J(null, "/fx/acme")]: acme, [J(null, "/fx/acme/src")]: acme };
read.length = 0;
const reps = await io.readReports([pane("fx-t2", "fx2", claude, { cwd: "/fx/acme/src", branch: "fix/#9-login" }), pane("fx-t3", "fx3", claude, { cwd: "/fx/acme", branch: "dev" })],
  repos, { home: HOME, readTextFile, readdir: async () => ["fx-other", "fx-acme"] });
assert.equal(reps["acme|fix/#9-login"].pr.number, 9); // data.js while facts.json is missing
assert.equal(reps["acme|fix/#9-login"].pr.draft, false);
assert.equal(M.summarizeReport({ facts: { pr: { number: 3, state: "OPEN", isDraft: true } } }).pr.draft, true); // a draft PR
assert.deepEqual([reps["acme|dev"].ci.ok, reps["acme|dev"].at], [1, "f"]); // facts.json first
assert.ok(!read.includes(`${HOME}/Reports/fx-acme/dev/data.js`));
assert.deepEqual(await io.readReports([], repos, { home: HOME, readTextFile, readdir: async () => { throw new Error("no Reports"); } }), {});

const calls = [];
const exec = async (cmd, args, { cwd }) => {
  calls.push(`${cmd} ${args.slice(0, 2).join(" ")} @${cwd}`);
  if (cmd === "git" && args[1] === "--path-format=absolute") return cwd.startsWith("/fx/acme") || cwd.startsWith("/fx/wt") ? { code: 0, stdout: "/fx/acme/.git\n" } : { code: 128, stdout: "" };
  if (cmd === "git" && args[1] === "--show-toplevel") return { code: 0, stdout: cwd.startsWith("/fx/wt") ? "/fx/wt/acme/feat-12-x\n" : "/fx/acme\n" };
  if (cmd === "git" && args[0] === "rev-parse") return { code: 0, stdout: "abc\n" };
  if (cmd === "gh" && args[0] === "repo") return { code: 0, stdout: "main\n" };
  if (cmd === "gh" && args[0] === "pr") return { code: 0, stdout: JSON.stringify([{ number: 34, state: "OPEN", url: "u", headRefOid: "abc", baseRefName: "main", isDraft: true }]) };
  if (cmd === "pwd") { if (cwd === "/fx/gone") throw new Error("no such folder"); return { code: 0, stdout: `${cwd}\n` }; }
  throw new Error(cmd);
};
assert.deepEqual(await io.findRepo(J(null, "/fx/wt/acme/feat-12-x"), exec), { key: acmeGit, name: "acme", linked: true });
assert.deepEqual(await io.findRepo(J(null, "/fx/acme"), exec), { key: acmeGit, name: "acme", linked: false });
assert.equal(await io.findRepo(J(null, "/fx/beta"), exec), null);
assert.equal(await io.realOf(J(null, "/fx/beta"), exec), J(null, "/fx/beta"));
assert.equal(await io.realOf(J(null, "/fx/gone"), exec), null);
calls.length = 0;
const defaults = {};
const got = await io.lookupPr(M.prKey(null, "/fx/acme", "feat/#12-x"), { exec, repos, defaults });
assert.deepEqual([got.number, got.draft], [34, true]); // gh's isDraft, as /me:report's draft
assert.deepEqual(calls, ["gh repo view @/fx/acme", "gh pr list @/fx/acme", "git rev-parse HEAD @/fx/acme"]);
assert.deepEqual(defaults, { [acmeGit]: "main" });
calls.length = 0;
assert.equal(await io.lookupPr(M.prKey(null, "/fx/acme", "main"), { exec, repos, defaults }), null); // the default branch
assert.deepEqual(calls, []); // default known, long-lived: no gh at all
// A card's drawer (kt-kanban): its PR and checks, its issue, its diff, on a fake exec (no gh, no git).
const asked = [];
const fx = async (cmd, args, { cwd, on }) => {
  asked.push([cmd, args[0], args[1], args[2], cwd, on]);
  if (cmd === "gh" && args[1] === "view" && args[0] === "pr") return { code: 0, stdout: JSON.stringify({ number: 34, title: "Ring", state: "OPEN", isDraft: true, url: "u/34", baseRefName: "dev" }) };
  if (cmd === "gh" && args[1] === "checks") return { code: 8, stdout: JSON.stringify([{ name: "test", bucket: "fail" }]) }; // non-zero: a failing check
  if (cmd === "gh" && args[0] === "issue") return args[2] === "12" ? { code: 0, stdout: JSON.stringify({ number: 12, title: "Anneau", state: "CLOSED", url: "u/12" }) } : { code: 1, stdout: "" };
  if (cmd === "git" && args[2] === "dev...HEAD") return { code: 128, stdout: "" }; // no local dev
  if (cmd === "git" && args[2] === "origin/dev...HEAD") return { code: 0, stdout: " 3 files changed, 42 insertions(+), 7 deletions(-)\n" };
  return { code: 1, stdout: "" };
};
const where = { exec: fx, cwd: "/fx/acme", on: "vps" };
assert.deepEqual(await io.readPr(34, where), { number: 34, title: "Ring", state: "OPEN", draft: true, url: "u/34", base: "dev", checks: [{ name: "test", bucket: "fail" }] });
assert.ok(asked.every(([, , , , cwd, on]) => cwd === "/fx/acme" && on === "vps")); // run where the thread is
assert.equal(await io.readPr(35, { ...where, exec: async () => ({ code: 1, stdout: "" }) }), null);
assert.deepEqual((await io.readPr(36, { ...where, exec: async (c, a) => (a[1] === "view" ? { code: 0, stdout: '{"number":36}' } : { code: 1, stdout: "no checks" }) })).checks, []);
assert.deepEqual(await io.readIssue(12, where), { number: 12, title: "Anneau", state: "CLOSED", url: "u/12" });
assert.equal(await io.readIssue(13, where), null);
assert.deepEqual(await io.readDiff("dev", where), { files: 3, added: 42, removed: 7 }); // origin/dev after dev
assert.equal(await io.readDiff("nope", where), null);
assert.deepEqual(io.shortstat(" 1 file changed, 1 insertion(+)"), { files: 1, added: 1, removed: 0 });
assert.deepEqual(io.shortstat(" 2 files changed, 5 deletions(-)"), { files: 2, added: 0, removed: 5 });
assert.deepEqual(io.shortstat(""), { files: 0, added: 0, removed: 0 });
assert.equal(io.shortstat("fatal: bad revision"), null);
console.log("threads-model: ok");
