// bun mods/kt-new/skills.check.mjs [dir]: skills.js, the consigne's `/` completion, the workflow presets,
// the list's height, and the scan itself (real sh, rg and stat) on a fake home written under `dir`
// (default: a new temporary folder). Nothing outside `dir` is read or written.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync, utimesSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { roots, files, entry, invocable, scan, fit, tokenOf, complete, suggest, insert, presets, leading, withWorkflow, checkoutOf } from "./skills.js";

const H = "/h";
const settings = JSON.stringify({ enabledPlugins: { "codex@m": true, "off@m": false } });
const installed = JSON.stringify({ plugins: { "codex@m": [{ scope: "user", installPath: "/p/codex" }], "off@m": [{ installPath: "/p/off" }] } });
const rs = roots({ home: H, settings, installed, projects: ["/r/app", H, "/r/app"] });
assert.deepEqual(rs.map((r) => r.dir), ["/h/.claude/skills", "/p/codex/skills", "/p/codex/commands", "/r/app/.claude/skills", "/r/app/.claude/commands", "/h/.claude/commands"],
  "skills, enabled plugins only, each project once (home is not one), commands last");

// LIST's lines: mtime \t real \t path; each file goes to its deepest root.
const line = (path) => `1\t${path}\t${path}`;
const fs = files([
  line("/h/.claude/skills/gwm/SKILL.md"),
  line("/h/.claude/skills/me/goal/SKILL.md"),
  line("/h/.claude/skills/synced/abc/pdf/SKILL.md"),
  line("/h/.claude/skills/quiet/SKILL.md"),
  line("/h/.claude/commands/me/goal.md"),
  line("/h/.claude/commands/me/issue-worktree-pr.md"),
  line("/h/.claude/commands/me/loop/ci-until-green.md"),
  line("/h/.claude/commands/_fragments/web/a11y.md"),
  line("/p/codex/skills/rescue/SKILL.md"),
  line("/p/codex/commands/review.md"),
  line("/r/app/.claude/commands/deploy.md"),
  "",
].join("\n"), rs);
const meta = {
  "/h/.claude/skills/me/goal/SKILL.md": { description: "Sprint." },
  "/h/.claude/skills/quiet/SKILL.md": { "user-invocable": "false" },
  "/h/.claude/commands/me/issue-worktree-pr.md": { description: "Issue, worktree, PR.", category: "workflow" },
  "/h/.claude/skills/gwm/SKILL.md": { description: "Worktrees with gwm." },
};
const all = fs.map((f) => entry(f, meta[f.path] ?? {}));
const byPath = Object.fromEntries(fs.map((f, i) => [f.path, all[i]]));

// Names as Claude Code lists them.
assert.equal(byPath["/h/.claude/skills/gwm/SKILL.md"].name, "gwm");
assert.equal(byPath["/h/.claude/skills/synced/abc/pdf/SKILL.md"].name, "anthropic-skills:pdf");
assert.equal(byPath["/h/.claude/commands/me/loop/ci-until-green.md"].name, "me:loop:ci-until-green");
assert.equal(byPath["/p/codex/skills/rescue/SKILL.md"].name, "codex:rescue");
assert.equal(byPath["/p/codex/commands/review.md"].name, "codex:review");
assert.equal(byPath["/r/app/.claude/commands/deploy.md"].project, "/r/app");
// What Claude Code loads: skills/me/goal only through commands/me/goal.md; user-invocable: false is out.
assert.equal(byPath["/h/.claude/skills/me/goal/SKILL.md"].loaded, false);
assert.equal(byPath["/h/.claude/skills/synced/abc/pdf/SKILL.md"].loaded, true);
assert.equal(byPath["/h/.claude/skills/quiet/SKILL.md"].loaded, false);
assert.equal(byPath["/h/.claude/commands/_fragments/web/a11y.md"].internal, true);

const list = invocable(all);
const names = list.map((e) => e.name);
assert.deepEqual(names, ["anthropic-skills:pdf", "codex:rescue", "codex:review", "deploy", "gwm", "me:goal", "me:issue-worktree-pr", "me:loop:ci-until-green"],
  "one per name, sorted; no quiet skill, no internal brick");
const goal = list.find((e) => e.name === "me:goal");
assert.equal(goal.kind, "command", "the command wins over the skill it shims");
assert.equal(goal.description, "Sprint.", "its description falls back to the skill's");

// The `/word` at the consigne's end: at a line's start or after a space, never mid-word.
assert.equal(tokenOf("/"), "");
assert.equal(tokenOf("/me:is"), "me:is");
assert.equal(tokenOf("fix the login /gw"), "gw");
assert.equal(tokenOf("first line\n/go"), "go");
assert.equal(tokenOf("and/or"), null);
assert.equal(tokenOf("x /a/b"), null);
assert.equal(tokenOf("/me:goal "), null, "completed: closed");
assert.equal(tokenOf(""), null);

// Best first: the name's start, then a `:` part's start, then inside the name, then the description.
assert.deepEqual(complete(list, "me:").map((e) => e.name), ["me:goal", "me:issue-worktree-pr", "me:loop:ci-until-green"]);
assert.deepEqual(complete(list, "re").map((e) => e.name), ["codex:rescue", "codex:review", "me:issue-worktree-pr", "me:loop:ci-until-green", "gwm"],
  "a part's start (rescue, review), inside the name (worktree, green), then the description (Worktrees)");
assert.deepEqual(complete(list, "worktree").map((e) => e.name), ["me:issue-worktree-pr", "gwm"]);
// Another project's own commands are out; the selected project's are in.
assert.equal(complete(list, "dep").length, 0);
assert.equal(complete(list, "dep", "/r/app")[0].name, "deploy");

// By agent: Claude's skills for Claude only; esc closes it on that very text.
assert.deepEqual(suggest(list, "do /gw", "claude").items.map((e) => e.name), ["gwm"]);
assert.deepEqual(suggest(list, "do /gw", "codex"), { q: "gw", items: [], note: "other" });
assert.deepEqual(suggest(list, "do /gw", "vibe"), { q: "gw", items: [], note: "other" });
assert.deepEqual(suggest(list, "do /gw", null), { q: "gw", items: [], note: "shell" });
assert.equal(suggest(list, "do /gw", "claude", { shut: "do /gw" }), null, "dismissed");
assert.equal(suggest(list, "do /gwm", "claude", { shut: "do /gw" }).items[0].name, "gwm", "typing again reopens it");
assert.equal(suggest(list, "do it", "claude"), null);
assert.equal(suggest(list, "/zzz", "claude").note, "empty");
assert.equal(suggest([], "/zz", "claude", { loading: true }).note, "loading");

// Completing: the word becomes `/name `, the rest kept.
assert.equal(insert("Fais ça\npuis /me:is", "me:issue-worktree-pr"), "Fais ça\npuis /me:issue-worktree-pr ");
assert.equal(insert("/", "gwm"), "/gwm ");

// The presets: installed, ORDER first, then any other `category: workflow` command; never a project's.
const more = [...list, { name: "me:issue-branch-pr", description: "", category: "workflow", source: "personal" }, { name: "me:triage", description: "", category: "workflow", source: "personal" },
  { name: "me:spec-x", description: "", category: "workflow", source: "project" }];
assert.deepEqual(presets(more).map((e) => e.name), ["me:issue-worktree-pr", "me:issue-branch-pr", "me:goal", "me:triage"]);
const flows = ["me:issue-worktree-pr", "me:issue-branch-pr", "me:goal"];
assert.equal(leading("/me:goal fix", flows), "me:goal");
assert.equal(leading("  /me:goal", flows), "me:goal");
assert.equal(leading("/me:goalx fix", flows), null);
assert.equal(leading("fix /me:goal", flows), null);
// Prefilling: a preset goes first (its space after), another swaps it, libre takes it off.
assert.equal(withWorkflow("", "me:goal", flows), "/me:goal ");
assert.equal(withWorkflow("fix the login", "me:issue-branch-pr", flows), "/me:issue-branch-pr fix the login");
assert.equal(withWorkflow("/me:issue-branch-pr fix the login", "me:issue-worktree-pr", flows), "/me:issue-worktree-pr fix the login");
assert.equal(withWorkflow("/me:issue-branch-pr fix the login", null, flows), "fix the login");
assert.equal(withWorkflow("/me:goal ", null, flows), "");
// Where it starts: the worktree ones make their own (gwm); the others keep the checkout.
assert.equal(checkoutOf("me:issue-worktree-pr"), "worktree");
assert.equal(checkoutOf("me:spec-issue-worktree-pr"), "worktree");
assert.equal(checkoutOf("me:issue-branch-pr"), "current");
assert.equal(checkoutOf("me:goal"), "current");

// The list's height: as many rows as the window leaves, START included. With the defaults, the list
// takes 49 px plus 31 a row, and 32 px of air stay around the card.
assert.deepEqual(fit({ win: 0, base: 600 }), { rows: 6, flow: true }, "unknown sizes (a check): all of it");
assert.deepEqual(fit({ win: 1000, base: 600 }), { rows: 6, flow: true }, "room to spare: 6 rows at most");
assert.deepEqual(fit({ win: 800, base: 600 }), { rows: 3, flow: true }, "(800 - 32 - 600 - 49) / 31 = 3.8: 3");
assert.deepEqual(fit({ win: 750, base: 600 }), { rows: 3, flow: false }, "under 3 rows: the Workflow row goes (48 px back)");
assert.deepEqual(fit({ win: 750, base: 552, flowShown: false }), { rows: 3, flow: false }, "measured without it: the same answer, no flip-flop");
assert.deepEqual(fit({ win: 800, base: 552, flowShown: false }), { rows: 3, flow: true }, "taller again: it comes back");
assert.deepEqual(fit({ win: 500, base: 600 }), { rows: 3, flow: false }, "far too low: 3 rows anyway, the list scrolls");
assert.deepEqual(fit({ win: 750, base: 600, flow: 0 }), { rows: 3, flow: false }, "no Workflow row to hide: 3 rows");
for (let win = 400; win <= 1400; win += 7) for (const base of [480, 560, 640]) {
  const { rows, flow } = fit({ win, base });
  const card = base - (flow ? 0 : 48) + 49 + rows * 31;
  assert.ok(rows >= 3 && rows <= 6, `rows in 3..6 (${win}, ${base})`);
  // START stays in the window whenever 3 rows fit at all (the Workflow row gone if it must).
  if (win - 32 >= base - 48 + 49 + 3 * 31) assert.ok(card <= win - 32, `the card fits (${win}, ${base}): ${card}`);
}

// The scan (main.js' loadSkills is this call with herdr's exec and readTextFile), on a fake home:
// personal skills and commands, a linked skill, an enabled plugin and a project's own command.
const D = process.argv[2] ?? mkdtempSync(`${tmpdir()}/kt-new-skills-`);
const FH = `${D}/home`;
const put = (p, text) => { mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true }); writeFileSync(p, text); };
const md = (fm) => `---\n${fm}\n---\n\nbody\n`;
put(`${FH}/.claude/settings.json`, JSON.stringify({ enabledPlugins: { "demo@m": true, "gone@m": false } }));
put(`${FH}/.claude/plugins/installed_plugins.json`, JSON.stringify({ plugins: { "demo@m": [{ scope: "user", installPath: `${FH}/plugins/demo` }], "gone@m": [{ installPath: `${FH}/plugins/gone` }] } }));
put(`${FH}/plugins/demo/skills/tidy/SKILL.md`, md("name: tidy\ndescription: Tidy up."));
put(`${FH}/plugins/demo/commands/run.md`, md('description: "Run it."'));
put(`${FH}/plugins/gone/commands/nope.md`, md("description: Disabled."));
put(`${FH}/.claude/skills/gwm/SKILL.md`, md("name: gwm\ndescription: >\n  Worktrees\n  with gwm."));
put(`${FH}/.claude/skills/me/goal/SKILL.md`, md("name: me:goal\ndescription: Sprint."));
put(`${FH}/.claude/skills/quiet/SKILL.md`, md("name: quiet\nuser-invocable: false"));
put(`${FH}/.agents/skills/linked/SKILL.md`, md("name: linked\ndescription: Linked in."));
put(`${FH}/.agents/skills/unlinked/SKILL.md`, md("name: unlinked\ndescription: Not linked."));
if (!existsSync(`${FH}/.claude/skills/linked`)) symlinkSync(`${FH}/.agents/skills/linked`, `${FH}/.claude/skills/linked`);
put(`${FH}/.claude/commands/me/goal.md`, md('argument-hint: "[objectif]"'));
put(`${FH}/.claude/commands/me/issue-worktree-pr.md`, md('description: "Issue, worktree, PR."\ncategory: workflow'));
put(`${FH}/.claude/commands/_fragments/web/a11y.md`, md("description: Brick."));
put(`${D}/repo/.claude/commands/deploy.md`, md("description: Ship."));
// herdr's exec and readTextFile, as the mod gets them: { code, stdout, stderr }; a missing file rejects.
const reads = [];
const exec = (cmd, args) => new Promise((ok) => execFile(cmd, args, { maxBuffer: 1e8 }, (e, stdout, stderr) => ok({ code: e ? e.code ?? 1 : 0, stdout, stderr })));
const read = (p) => { reads.push(p); return readFile(p, "utf8"); };
const cache = new Map();
const found = await scan({ home: FH, projects: [`${D}/repo`], exec, read, cache });
assert.deepEqual(found.map((e) => `${e.name} [${e.source}] ${e.description}`), [
  "demo:run [plugin] Run it.",
  "demo:tidy [plugin] Tidy up.",
  "deploy [project] Ship.",
  "gwm [personal] Worktrees with gwm.",
  "linked [personal] Linked in.",
  "me:goal [personal] Sprint.",
  "me:issue-worktree-pr [personal] Issue, worktree, PR.",
], "rg found them all; a disabled plugin, an unlinked ~/.agents skill, a quiet skill and a brick are out");
assert.equal(found.find((e) => e.name === "deploy").project, `${D}/repo`);
assert.deepEqual(presets(found).map((e) => e.name), ["me:issue-worktree-pr", "me:goal"]);
// The next opening re-reads only what changed: the two config files, then the one file touched.
reads.length = 0;
await scan({ home: FH, projects: [`${D}/repo`], exec, read, cache });
assert.deepEqual(reads.map((p) => p.slice(FH.length)), ["/.claude/settings.json", "/.claude/plugins/installed_plugins.json"], "nothing re-read");
const later = new Date(Date.now() + 120e3);
utimesSync(`${FH}/.claude/skills/gwm/SKILL.md`, later, later);
reads.length = 0;
await scan({ home: FH, projects: [`${D}/repo`], exec, read, cache });
assert.deepEqual(reads.slice(2).map((p) => p.slice(FH.length)), ["/.claude/skills/gwm/SKILL.md"], "only the file touched");
// A home without any of it: an empty list, no throw.
assert.deepEqual(await scan({ home: `${D}/empty`, exec, read }), []);

console.log(`skills.js: ok (fake home: ${D})`);
