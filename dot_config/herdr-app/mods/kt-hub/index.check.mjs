// bun ~/.config/herdr-app/mods/kt-hub/index.check.mjs: the indexer (index.ts) on tiny JSONL fixtures in a
// tmp dir, TZ fixed: the local day (around midnight UTC), the dedup (a message's blocks, pr-links, a
// /command and its Skill call), what is a prompt, a session once a day, the offset and an unfinished
// line, a rewritten file, the attribution (registry, worktree to its repo, chezmoi to dotfiles, Home, a
// deleted worktree by its repo's name, a pr-link), history.jsonl before the junction without /usage,
// the flows' steps, the lock, the freeze, summary.json. No real name, path or session in the fixtures.
process.env.TZ = "Europe/Paris";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, readdirSync, existsSync, realpathSync, rmSync, utimesSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
const X = await import("./index.ts");

// ---------------------------------------------------------------- pure parts
assert.equal(X.localDay(Date.parse("2026-11-18T22:59:00Z")), "2026-11-18");
assert.equal(X.localDay(Date.parse("2026-11-18T23:30:00Z")), "2026-11-19", "a record after 23:00 UTC is tomorrow in Paris");
assert.equal(X.dayShift("2026-03-28", 2), "2026-03-30", "across the DST change");
assert.equal(X.slugOf("git@github.com:o/r.git"), "o/r");
assert.equal(X.slugOf("https://github.com/o/r/pull/12"), "o/r");
const u = (promptSource, content, extra = {}) => ({ type: "user", promptSource, message: { content }, ...extra });
assert.deepEqual(X.classifyUser(u("typed", "fais ceci")), { prompt: true, text: "fais ceci" });
assert.equal(X.classifyUser(u("typed", '<hc from="t1">réponds')), null, "another agent's hc send is not a prompt");
assert.equal(X.classifyUser(u("system", "<task-notification>x")), null);
assert.equal(X.classifyUser(u(undefined, "Another Claude session sent a message:\n<teammate-message>x")), null);
assert.equal(X.classifyUser(u(undefined, "une vieille version")).prompt, true, "no promptSource: plain text is a prompt");
assert.equal(X.classifyUser(u("sdk", "<monocode_context>x</monocode_context>\nfais")).prompt, true);
assert.equal(X.classifyUser(u(undefined, [{ type: "text", text: "<command-message>me:x</command-message>\n<command-name>/me:x</command-name>" }])).cmd, "me:x");
assert.equal(X.classifyUser(u("typed", "x", { isMeta: true })), null);
assert.equal(X.originOf("cli", "x"), "cli");
assert.equal(X.originOf("sdk-cli", "<monocode_context>"), "mono");
assert.equal(X.originOf("sdk-cli", "Réponds juste: ok"), "sdk");
assert.ok(X.NOISE.test("/usage") && X.NOISE.test("/status ") && !X.NOISE.test("/me:merge"));

// ---------------------------------------------------------------- fixtures
const D = realpathSync(mkdtempSync(`${tmpdir()}/kt-hub-`)); // git answers real paths (/private/var/...)
const put = (p, text) => { mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true }); writeFileSync(p, text); };
const git = (...a) => { const r = spawnSync("git", a, { encoding: "utf8" }); assert.equal(r.status, 0, `git ${a.join(" ")}: ${r.stderr}`); };
const HOME = `${D}/home`;
mkdirSync(`${HOME}/.claude`, { recursive: true });
mkdirSync(`${HOME}/.config/tool`, { recursive: true });
// A repo with a GitHub remote and a linked worktree elsewhere; a "dotfiles" repo chezmoi resolves to.
git("init", "-q", `${D}/repo`);
git("-C", `${D}/repo`, "-c", "user.name=t", "-c", "user.email=t", "commit", "-q", "--allow-empty", "-m", "init");
git("-C", `${D}/repo`, "remote", "add", "origin", "https://github.com/o/r.git");
git("-C", `${D}/repo`, "worktree", "add", "-q", `${D}/wts/feat-1`, "-b", "feat-1");
git("init", "-q", `${D}/dots`);
git("-C", `${D}/dots`, "remote", "add", "origin", "git@github.com:o/dots.git");
git("init", "-q", `${D}/zed`);
git("-C", `${D}/zed`, "remote", "add", "origin", "https://github.com/o/z");
mkdirSync(`${D}/reg/proj`, { recursive: true });
put(`${D}/shared.json`, JSON.stringify({ "kt.projects": [
  { id: "a", name: "proj", folder: `${D}/reg/proj`, machine: null },
  { id: "z", name: "zed", folder: `${D}/zed`, machine: null },
  { id: "b", name: ".claude", folder: `${HOME}/.claude`, machine: null },
  { id: "c", name: "far", folder: "/elsewhere", machine: "vps" },
] }));
const PROJ = `${D}/projects`;
const cfg = {
  home: HOME, projects: PROJ, history: `${D}/history.jsonl`, store: `${D}/store`, reports: `${D}/reports`, vaults: [`${D}/vault/pro`], shared: `${D}/shared.json`, out: `${D}/out`,
  scratch: /^\/nowhere\//,
  // chezmoi, faked: ~/.config is managed and lives in the dots repo; git is real.
  resolve: (cwd) => (cwd.startsWith(`${HOME}/.config`) ? X.gitRoot(`${D}/dots`) : X.gitRoot(cwd)),
};
let n = 0;
const at = (iso) => new Date(iso).toISOString();
const rec = (type, o) => JSON.stringify({ parentUuid: null, isSidechain: false, ...o, type, uuid: `u${n++}` });
const prompt = (sid, cwd, ts, text = "fais ceci", extra = {}) => rec("user", { sessionId: sid, cwd, entrypoint: "cli", promptSource: "typed", timestamp: at(ts), message: { role: "user", content: text }, ...extra });
const reply = (sid, cwd, ts, id, content = [{ type: "text", text: "ok" }], out = 10) => rec("assistant", { sessionId: sid, cwd, entrypoint: "cli", requestId: `r-${id}`, timestamp: at(ts), message: { id, model: "claude-test", role: "assistant", usage: { output_tokens: out }, content } });
const tool = (name, input) => [{ type: "tool_use", id: `t${n++}`, name, input }];
const result = (sid, cwd, ts) => rec("user", { sessionId: sid, cwd, timestamp: at(ts), message: { role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "sortie" }] } });
const prlink = (sid, ts, num, repo = "o/r") => JSON.stringify({ type: "pr-link", sessionId: sid, prNumber: num, prUrl: `https://github.com/${repo}/pull/${num}`, prRepository: repo, timestamp: at(ts) });
const lines = (...l) => l.map((x) => x + "\n").join("");

// Session A, in the registry project, on 2026-11-18 local (and a record after 23:00 UTC: the 19th).
const A = "sess-a", PA = `${D}/reg/proj/src`;
const fileA = `${PROJ}/-reg-proj/${A}.jsonl`;
put(fileA, lines(
  JSON.stringify({ type: "session-owner", sessionId: A }),
  // #50: its titles (the one given wins over Claude Code's).
  JSON.stringify({ type: "ai-title", aiTitle: "titre automatique", sessionId: A }),
  JSON.stringify({ type: "custom-title", customTitle: "mon titre", sessionId: A }),
  prompt(A, PA, "2026-11-18T09:00:00Z"),
  JSON.stringify({ parentUuid: null, isSidechain: false, attachment: { type: "x" }, type: "attachment", timestamp: at("2026-11-18T09:00:01Z"), sessionId: A, cwd: PA }),
  // One message, three blocks: one message, 10 tokens; its Skill and Agent calls each count.
  reply(A, PA, "2026-11-18T09:00:10Z", "m1", [{ type: "thinking", thinking: "" }]),
  reply(A, PA, "2026-11-18T09:00:11Z", "m1", tool("Skill", { skill: "me:x" })),
  reply(A, PA, "2026-11-18T09:00:12Z", "m1", tool("Agent", { subagent_type: "Explore", prompt: "x" })),
  result(A, PA, "2026-11-18T09:00:20Z"),
  // A typed /command, then its Skill call in the same turn: one launch. /usage: none.
  rec("user", { sessionId: A, cwd: PA, entrypoint: "cli", timestamp: at("2026-11-18T09:01:00Z"), message: { role: "user", content: "<command-message>me:merge</command-message>\n<command-name>/me:merge</command-name>" } }),
  reply(A, PA, "2026-11-18T09:01:05Z", "m2", tool("Skill", { skill: "me:merge" })),
  reply(A, PA, "2026-11-18T09:01:30Z", "m3", tool("Bash", { command: "gh pr merge 3 --merge" })),
  rec("user", { sessionId: A, cwd: PA, entrypoint: "cli", timestamp: at("2026-11-18T09:02:00Z"), message: { role: "user", content: "<command-name>/usage</command-name>" } }),
  rec("user", { sessionId: A, cwd: PA, timestamp: at("2026-11-18T09:03:00Z"), message: { role: "user", content: "Another Claude session sent a message:\n<teammate-message>x" } }),
  prlink(A, "2026-11-18T09:04:00Z", 3),
  prlink(A, "2026-11-18T09:04:01Z", 3),
  // 20 min later: a gap over 5 min is not active time.
  prompt(A, PA, "2026-11-18T09:24:00Z", "encore"),
  reply(A, PA, "2026-11-18T09:24:30Z", "m4"),
  reply(A, PA, "2026-11-18T23:30:00Z", "m5"),
) + prompt(A, PA, "2026-11-18T23:31:00Z", "pas fini").slice(0, 40)); // an unfinished line
// Its sub-agent: messages and tokens, never a session.
put(`${PROJ}/-reg-proj/${A}/subagents/agent-1.jsonl`, lines(reply(A, PA, "2026-11-18T09:00:30Z", "s1", [{ type: "text", text: "x" }], 5)));
// Session B, in the linked worktree: the repo o/r. Session C, in ~/.config (chezmoi: dots). D at Home.
const B = "sess-b", C = "sess-c", H = "sess-h";
put(`${PROJ}/-wt/${B}.jsonl`, lines(prompt(B, `${D}/wts/feat-1`, "2026-11-18T10:00:00Z", "x".repeat(1500)), reply(B, `${D}/wts/feat-1`, "2026-11-18T10:00:30Z", "b1")));
put(`${PROJ}/-cfg/${C}.jsonl`, lines(prompt(C, `${HOME}/.config/tool`, "2026-11-18T11:00:00Z"), reply(C, `${HOME}/.config/tool`, "2026-11-18T11:00:30Z", "c1")));
put(`${PROJ}/-home/${H}.jsonl`, lines(prompt(H, HOME, "2026-11-18T12:00:00Z"), reply(H, HOME, "2026-11-18T12:00:30Z", "h1"),
  prompt(H, `${HOME}/.claude/x`, "2026-11-18T12:01:00Z"), reply(H, `${HOME}/.claude/x`, "2026-11-18T12:01:30Z", "h2")));
// Deleted folders: worktrees named after a registry project (`worktrees/proj/`, `proj-worktrees/`), a
// repo since moved (its name), and one whose session linked a PR on o/z (the registry's zed, by slug).
const W = "sess-w", G = "sess-g", Y = "sess-y", Q = "sess-q";
const two = (sid, cwd, h, id) => lines(prompt(sid, cwd, `2026-11-18T${h}:00:00Z`), reply(sid, cwd, `2026-11-18T${h}:00:30Z`, id));
put(`${PROJ}/-gone1/${W}.jsonl`, two(W, `${D}/gone/worktrees/proj/feat-9`, 13, "w1"));
put(`${PROJ}/-gone2/${G}.jsonl`, two(G, `${D}/gone/x`, 14, "g1") + lines(prlink(G, "2026-11-18T14:01:00Z", 7, "o/z")));
put(`${PROJ}/-gone3/${Y}.jsonl`, two(Y, `${D}/gone/proj-worktrees/feat-2`, 16, "y1"));
put(`${PROJ}/-gone4/${Q}.jsonl`, two(Q, `${D}/moved/repo/src`, 17, "q1"));
// A Monocode session (SDK, its context first) and a teammate's session (no prompt of Kylian's).
const M = "sess-m";
put(`${PROJ}/-mono/${M}.jsonl`, lines(rec("user", { sessionId: M, cwd: PA, entrypoint: "sdk-cli", promptSource: "sdk", timestamp: at("2026-11-18T15:00:00Z"), message: { role: "user", content: "<monocode_context>c</monocode_context>\nfais" } }),
  rec("assistant", { sessionId: M, cwd: PA, entrypoint: "sdk-cli", requestId: "r-mono", timestamp: at("2026-11-18T15:00:10Z"), message: { id: "mono1", model: "claude-test", usage: { output_tokens: 1 }, content: [] } })));
// A session from the 16th, resumed since: its file survived Claude Code's cleanup, the others of the 16th didn't.
const OLD = "sess-old";
put(`${PROJ}/-old/${OLD}.jsonl`, lines(prompt(OLD, PA, "2026-11-16T10:00:00Z"), reply(OLD, PA, "2026-11-16T10:00:30Z", "o1")));
// The files' last writes: the oldest session file is of the 18th, the junction (OLD's was written later).
for (const dir of readdirSync(PROJ)) for (const f of readdirSync(`${PROJ}/${dir}`)) {
  if (f.endsWith(".jsonl")) utimesSync(`${PROJ}/${dir}/${f}`, new Date(f.startsWith(OLD) ? "2026-11-18T21:00:00Z" : "2026-11-18T20:00:00Z"), new Date(f.startsWith(OLD) ? "2026-11-18T21:00:00Z" : "2026-11-18T20:00:00Z"));
}
// history.jsonl: before the junction (the 18th) only, the sessions the transcripts lost; /usage-only
// sessions and old entries without a session.
put(cfg.history, lines(
  JSON.stringify({ display: "fais ceci", timestamp: Date.parse("2026-11-16T10:00:00Z"), project: PA, sessionId: OLD }),
  JSON.stringify({ display: "perdu", timestamp: Date.parse("2026-11-16T11:00:00Z"), project: PA, sessionId: "h-lost" }),
  JSON.stringify({ display: "/me:merge", timestamp: Date.parse("2026-11-16T11:05:00Z"), project: PA, sessionId: "h-lost" }),
  JSON.stringify({ display: "/usage", timestamp: Date.parse("2026-11-10T08:00:00Z"), project: `${D}/probe`, sessionId: "h-usage" }),
  JSON.stringify({ display: "/status ", timestamp: Date.parse("2026-11-10T08:00:01Z"), project: `${D}/probe`, sessionId: "h-usage" }),
  JSON.stringify({ display: "", timestamp: Date.parse("2026-11-10T08:00:02Z"), project: `${D}/probe`, sessionId: "h-usage" }),
  JSON.stringify({ display: "corrige le test", timestamp: Date.parse("2026-11-10T09:00:00Z"), project: `${D}/reg/proj`, sessionId: "h1" }),
  JSON.stringify({ display: "/me:release 1.0", timestamp: Date.parse("2026-11-10T09:05:00Z"), project: `${D}/reg/proj`, sessionId: "h1" }),
  JSON.stringify({ display: "/init ", timestamp: Date.parse("2026-11-09T09:00:00Z"), project: `${D}/repo` }),
  JSON.stringify({ display: "et ça", timestamp: Date.parse("2026-11-09T09:01:00Z"), project: `${D}/repo` }),
  JSON.stringify({ display: "déjà dans les transcripts", timestamp: Date.parse("2026-11-18T09:00:00Z"), project: `${D}/reg/proj`, sessionId: A }),
));
// #49: a branch report (me:report) and a plan (left to #50), in ~/Reports.
put(`${D}/reports/o-r/feat-1/facts.json`, JSON.stringify({ kind: "report", generatedAt: "2026-11-18T19:00:00+00:00", facts: {
  repo: "o/r", branch: "feat/#1-x", issue: "1", totals: { files: 2, add: 40, del: 3 },
  pr: { number: 3, title: "une PR", state: "MERGED", isDraft: false, url: "https://github.com/o/r/pull/3" },
  ci: { total: 3, ok: 2, fail: 1, pending: 0, runs: [] },
  review: { passes: [{ pass: 1, p0: 0, p1: 1, p2: 1, p3: 2 }, { pass: 2, p0: 0, p1: 0, p2: 0, p3: 1 }],
    findings: [{ prio: "P1", status: "fixed" }, { prio: "P2", status: "fixed" }, { prio: "P3", status: null }] } } }));
put(`${D}/reports/o-r/plans/p/facts.json`, JSON.stringify({ kind: "plan", facts: { plan: "p", repo: "o/r", issues: [
  { n: 1, title: "faite", state: "CLOSED", status: "done", deps: [] }, { n: 2, title: "libre", state: "OPEN", status: "todo", deps: [1], url: "u2" }] } }));
// #50: the vault's notes, one of these days, one old, one in a hidden folder.
put(`${D}/vault/pro/decisions/a.md`, `---\ntype: "note"\ntitle: "Une décision"\nrepo: "o/r"\n---\n\nle texte`);
put(`${D}/vault/pro/b sans titre.md`, "pas de frontmatter");
put(`${D}/vault/pro/vieille.md`, "---\ntitle: vieille\n---\n");
utimesSync(`${D}/vault/pro/vieille.md`, new Date("2026-10-01T12:00:00Z"), new Date("2026-10-01T12:00:00Z"));
put(`${D}/vault/pro/.git/c.md`, "---\ntitle: cachée\n---\n");
put(`${D}/reports/o-r/broken/facts.json`, "{");
put(`${cfg.store}/me_claude-flow-x.json`, JSON.stringify({
  "flow:o/r#1": { workflow: "me:issue-worktree-pr", repo: "o/r", issue: 1, pr: 3, steps: { issue: { status: "done" }, merge: { status: "pending" } } },
  "other:key": { x: 1 },
}));

// ---------------------------------------------------------------- pass 1
const T1 = Date.parse("2026-11-19T08:00:00Z");
let now = T1;
cfg.now = () => now;
const r1 = X.run(cfg);
assert.equal(r1.ok, true);
const arch = () => JSON.parse(readFileSync(`${cfg.out}/archive.json`, "utf8"));
const sum = () => JSON.parse(readFileSync(`${cfg.out}/summary.json`, "utf8"));
let a = arch();
const d18 = a.days["2026-11-18"], d19 = a.days["2026-11-19"];
// Sessions once a day, by origin: A, B, C, H, W, G, Y, Q (cli) and M (mono); the sub-agent adds none.
assert.deepEqual(d18.s, { cli: 8, mono: 1 });
assert.deepEqual(d19.s, { cli: 1 }, "A's reply after 23:00 UTC is a session on the 19th");
// Prompts: A's two typed ones (not the command, /usage, the teammate's), one each for B C W G Y Q, H's two, M's.
assert.deepEqual(d18.p, { cli: 10, mono: 1 });
// Messages once (m1's three blocks), with the sub-agent's: A m1 m2 m3 m4 (m5 is the 19th), s1, b1 c1 h1 h2 w1 g1 y1 q1, mono1.
assert.equal(d18.m, 4 + 1 + 8 + 1);
assert.equal(d18.o, 4 * 10 + 5 + 8 * 10 + 1);
assert.deepEqual(d18.l, { "me:x": 1, "me:merge": 1 }, "the /command and its Skill call: one launch; /usage: none");
assert.deepEqual(d18.sub, { Explore: 1 });
assert.equal(d18.pr, 2, "pr-link #3 twice, #7 once");
assert.equal(d18.mg, 1);
assert.deepEqual(d18.mo, { "claude-test": 14 });
// Active time: A's gaps under 5 min (09:00:00 -> 09:03:00 by its records, then 09:24:00 -> 09:24:30).
const aA = a.projects[`${D}/reg/proj`].days["2026-11-18"].a;
assert.ok(aA >= 90e3 && aA < 5 * 60e3, `A's active time ${aA}`);
// The unfinished line waits: the offset stops before it.
const stA = a.files[fileA];
assert.ok(stA.off < readFileSync(fileA).length && readFileSync(fileA, "utf8").slice(stA.off).startsWith('{"parentUuid'));
// Attribution.
const P = a.projects;
assert.equal(P[`${D}/reg/proj`].kind, "registry");
assert.equal(P[`${D}/reg/proj`].days["2026-11-18"].s.cli, 3, "A, and the deleted worktrees W and Y by their repo's name");
assert.equal(P[`${D}/repo`].days["2026-11-18"].s.cli, 2, "B in its worktree, Q in the repo's old place");
assert.equal(P[`${D}/reg/proj`].days["2026-11-18"].s.mono, 1);
assert.equal(P[`${D}/repo`].kind, "repo", "a linked worktree climbs to its repo");
assert.equal(P[`${D}/repo`].slug, "o/r");
assert.equal(P[`${D}/dots`].slug, "o/dots", "~/.config via chezmoi: the dotfiles repo");
assert.equal(P[HOME].kind, "home");
assert.equal(P[`${HOME}/.claude`].kind, "registry", "the registry before chezmoi");
assert.equal(P[`${HOME}/.claude`].slug, null, "a registry folder that is not its repo has no slug");
assert.equal(P[`${D}/zed`].days["2026-11-18"].s.cli, 1, "a deleted folder: the session's pr-link repo, by its slug");
assert.equal(P["gh:o/z"], undefined);
assert.equal(P["/elsewhere"], undefined, "another machine's registry entry is ignored");
// history.jsonl, before the junction only; /usage, /status and empty entries are nobody's session.
assert.equal(a.junction, "2026-11-18", "the oldest session file's last write");
assert.equal(a.first, "2026-11-09");
// Before the junction: the surviving transcript, plus history's sessions it doesn't have (not OLD again).
assert.deepEqual(a.days["2026-11-16"].s, { cli: 1, hist: 1 });
assert.deepEqual(a.days["2026-11-16"].p, { cli: 1, hist: 1 });
assert.deepEqual(a.days["2026-11-16"].l, { "me:merge": 1 });
assert.deepEqual(a.days["2026-11-10"].s, { hist: 1 });
assert.deepEqual(a.days["2026-11-10"].p, { hist: 1 });
assert.deepEqual(a.days["2026-11-10"].l, { "me:release": 1 });
assert.deepEqual(a.days["2026-11-09"].s, { hist: 1 }, "entries without a session: one per folder and day");
assert.equal(P[`${D}/repo`].days["2026-11-09"].s.hist, 1);
assert.equal(d18.s.hist, undefined, "history after the junction: the transcripts already have it");
// Flows: copied, a step done when first seen is 0.
assert.deepEqual(Object.keys(a.flows), ["flow:o/r#1"]);
assert.deepEqual(a.flows["flow:o/r#1"].doneAt, { issue: 0 });
// The summary: under 100 KB, the year's sessions, a project's PRs from its repo.
let s = sum();
assert.ok(readFileSync(`${cfg.out}/summary.json`).length < 100e3);
assert.equal(s.years["2026"].length, 365);
assert.equal(s.years["2026"][321], 9, "2026-11-18 is day 322");
assert.deepEqual(s.projects[`${D}/repo`].days["2026-11-18"], [2, 60, 2, 1], "[sessions, active s, prompts, PRs]: #3 is o/r's");
assert.equal(s.projects[`${D}/zed`].days["2026-11-18"][3], 1);
// A gh:<slug> project (a pr-link before its repo was known) joins the project that has that slug since.
const late = X.summarize({ days: {}, prs: { u: { d: "2026-11-18", r: "o/q", n: 1 } }, projects: {
  "gh:o/q": { name: "o/q", kind: "gh", slug: "o/q", last: 1, days: { "2026-11-18": { ...X.bucket(), s: { cli: 1 }, a: 2000 } } },
  "/q": { name: "q", kind: "repo", slug: "o/q", last: 2, days: { "2026-11-18": { ...X.bucket(), s: { cli: 1 }, a: 3000 } } },
} }, Date.parse("2026-11-19T08:00:00Z"));
assert.deepEqual(Object.keys(late.projects), ["/q"]);
assert.deepEqual(late.projects["/q"].days["2026-11-18"], [2, 5, 0, 1]);
assert.deepEqual(late.projects["/q"].heat, { 2026: [[321, 2]] }, "its heat joins too");

// #49: a project's launches (a 5th element, only when there are some), its sessions of every year as
// [index, sessions] pairs (the history before the junction included), the reports' recaps, the flows.
const proj = s.projects[`${D}/reg/proj`];
assert.deepEqual(proj.days["2026-11-18"][4], { "me:x": 1, "me:merge": 1 });
assert.equal(s.projects[`${D}/repo`].days["2026-11-18"].length, 4, "no launch: four");
assert.deepEqual(proj.heat["2026"], [[313, 1], [319, 2], [321, 4], [322, 1]], "the 10th (history), the 16th (OLD and h-lost), the 18th, the 19th");
assert.equal(s.reports.length, 1, "the plan and the broken file are no branch report");
assert.deepEqual(s.reports[0], { repo: "o/r", branch: "feat/#1-x", issue: "1", at: Date.parse("2026-11-18T19:00:00Z"),
  pr: { n: 3, title: "une PR", state: "MERGED", url: "https://github.com/o/r/pull/3", draft: false },
  ci: { ok: 2, fail: 1, pending: 0, total: 3 }, review: { passes: 2, found: 2, fixed: 2, open: 0 }, lines: [40, 3] });
assert.deepEqual(s.flows.map((f) => [f.key, f.steps.issue, f.doneAt.issue]), [["flow:o/r#1", "done", 0]]);
assert.equal(X.recap({ kind: "plan", facts: { repo: "o/r" } }), null);

// #50: the sessions of the last two weeks (the given title, the project where each was last), the plans,
// the vault's notes of these days (frontmatter title, else the file's name; old and hidden ones out).
const sa = s.sessions.find((x) => x.sid === A);
assert.deepEqual([sa.title, sa.project], ["mon titre", "proj"]);
assert.equal(s.sessions.find((x) => x.sid === B).title, null);
assert.ok(s.sessions.every((x) => !x.sid.startsWith("agent-")), "no sub-agent");
assert.ok(s.sessions[0].last >= s.sessions.at(-1).last, "the latest first");
assert.deepEqual(s.plans, [{ plan: "p", repo: "o/r", issues: [
  { n: 1, title: "faite", state: "CLOSED", url: null, deps: [], status: "done", pr: null },
  { n: 2, title: "libre", state: "OPEN", url: "u2", deps: [1], status: "todo", pr: null }] }]);
assert.deepEqual(s.notes.map((n) => [n.title, n.vault, n.type]).sort(), [["Une décision", "pro", "note"], ["b sans titre", "pro", null]]);
assert.deepEqual(X.frontmatter('---\ntitle: "a: b"\ndate: 2026-11-18\n---\nx'), { title: "a: b", date: "2026-11-18" });
// An archive from before titles were kept: its sessions get theirs once (and their project), no count moves.
{
  const old = arch();
  for (const st of Object.values(old.files)) { delete st.title; delete st.ctitle; delete st.proj; }
  old.titled = false;
  writeFileSync(`${cfg.out}/archive.json`, JSON.stringify(old));
  const counts = JSON.stringify({ d: old.days, p: Object.fromEntries(Object.entries(old.projects).map(([k, p]) => [k, p.days])) });
  X.run(cfg);
  const back = arch();
  assert.equal(back.titled, true);
  assert.equal(back.files[fileA].ctitle, "mon titre");
  assert.equal(back.files[fileA].proj, `${D}/reg/proj`);
  assert.equal(JSON.stringify({ d: back.days, p: Object.fromEntries(Object.entries(back.projects).map(([k, p]) => [k, p.days])) }), counts);
}
assert.deepEqual(s.streak, { cur: 2, best: 2 });
assert.equal(s.days["2026-11-18"].ids, undefined, "no session ids in the summary");
assert.equal(readdirSync(cfg.out).filter((f) => f.includes(".tmp")).length, 0, "atomic writes leave no tmp");
assert.ok(!existsSync(`${cfg.out}/lock`), "the lock is released");

// ---------------------------------------------------------------- pass 2: the unfinished line ends, a new day
const before = JSON.stringify(arch().days["2026-11-18"]);
appendFileSync(fileA, prompt(A, PA, "2026-11-18T23:31:00Z", "pas fini").slice(40) + "\n" + reply(A, PA, "2026-11-18T23:32:00Z", "m6") + "\n");
// The flow's merge turns done between two passes: its time is the pass's.
put(`${cfg.store}/me_claude-flow-x.json`, JSON.stringify({ "flow:o/r#1": { repo: "o/r", steps: { issue: { status: "done" }, merge: { status: "done" } } } }));
now = T1 + 3600e3;
X.run(cfg);
a = arch();
assert.equal(JSON.stringify(a.days["2026-11-18"]), before, "nothing counted twice on the 18th");
assert.deepEqual(a.days["2026-11-19"].p, { cli: 1 }, "the finished line counts once");
assert.deepEqual(a.days["2026-11-19"].s, { cli: 1 }, "A still once on the 19th");
assert.equal(a.days["2026-11-19"].m, 2);
assert.equal(a.flows["flow:o/r#1"].doneAt.merge, now);
// A pass with nothing new changes no count.
const snap = JSON.stringify({ d: a.days, p: a.projects });
X.run(cfg);
a = arch();
assert.equal(JSON.stringify({ d: a.days, p: a.projects }), snap);

// ---------------------------------------------------------------- a rewritten (shorter) file
// B's file (its long prompt, b1) becomes b1 again and b2, a day later: shorter than its offset.
writeFileSync(`${PROJ}/-wt/${B}.jsonl`, lines(reply(B, `${D}/wts/feat-1`, "2026-11-18T10:00:30Z", "b1"), reply(B, `${D}/wts/feat-1`, "2026-11-19T10:00:00Z", "b2")));
assert.ok(readFileSync(`${PROJ}/-wt/${B}.jsonl`).length < a.files[`${PROJ}/-wt/${B}.jsonl`].off);
X.run(cfg);
a = arch();
assert.equal(a.days["2026-11-18"].m, JSON.parse(before).m, "the records already counted are not counted again");
assert.equal(a.days["2026-11-19"].m, 3, "only b2, later than the last record counted");

// ---------------------------------------------------------------- the lock
put(`${cfg.out}/lock`, JSON.stringify({ pid: process.pid, at: now }));
assert.deepEqual(X.run(cfg), { ok: true, busy: true }, "a live lock: another pass runs");
put(`${cfg.out}/lock`, JSON.stringify({ pid: 999999, at: now }));
assert.equal(X.run(cfg).busy, undefined, "a dead pass's lock is taken over");

// ---------------------------------------------------------------- the freeze
now = Date.parse("2026-11-30T08:00:00Z");
X.run(cfg);
a = arch();
assert.equal(a.days["2026-11-18"].ids, undefined, "a day 12 days old has frozen");
assert.deepEqual(a.days["2026-11-18"].s, { cli: 8, mono: 1 }, "its counts stay");
s = sum();
assert.equal(s.days["2026-11-10"].p.hist, 1, "the summary's 12 weeks reach back before the junction");
assert.deepEqual(s.streak, { cur: 0, best: 2 });

// A broken archive stops the pass: starting over would lose the days the transcripts no longer hold.
writeFileSync(`${cfg.out}/archive.json`, "{");
assert.throws(() => X.run(cfg));
assert.equal(readFileSync(`${cfg.out}/archive.json`, "utf8"), "{", "left as it was");
assert.ok(!existsSync(`${cfg.out}/lock`));

rmSync(D, { recursive: true, force: true }); // its own mkdtemp
console.log("index.check: ok");
