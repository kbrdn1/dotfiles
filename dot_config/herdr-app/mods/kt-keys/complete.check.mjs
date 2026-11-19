// bun ~/.config/herdr-app/mods/kt-keys/complete.check.mjs: complete.js (#81's completions: triggers,
// ranking, names, hints, the session's tools, the merged list, the pieces and each completion's route),
// then complete-index.ts on an invented home and an invented transcript in a temp folder (no real
// skill, no real session). categories.js' classify is the real one, gpui mocked.
import assert from "node:assert/strict";
import { plugin, spawnSync } from "bun";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, symlinkSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

plugin({
  setup(build) {
    build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => null, svg: () => null } }));
    build.module("gpui-base", () => ({ loader: "object", exports: { h_flex: () => null } }));
  },
});
const C = await import("./complete.js");
const { classify, ORDER } = await import("./categories.js");
const S = (await import("./complete.strings.js")).default;

// ── triggers ────────────────────────────────────────────────────────────────
const at = (s) => C.tokenAt(s.replace("|", ""), s.indexOf("|"));
assert.deepEqual(at("/me:go|"), { trigger: "/", start: 0, end: 6, query: "me:go" });
assert.deepEqual(at("  /co|mpact"), { trigger: "/", start: 2, end: 10, query: "co" }, "leading blanks, the end runs to the word's end");
assert.equal(at("voir /me:go|"), null, "a slash mid-message isn't a command");
assert.equal(at("/src/ma|"), null, "a path isn't a command");
assert.deepEqual(at("lis @mods/kt|"), { trigger: "@", start: 4, end: 12, query: "mods/kt" });
assert.equal(at("a@b.c|"), null, "an email isn't a mention");
assert.deepEqual(at("avec #con|"), { trigger: "#", start: 5, end: 9, query: "con" });
assert.deepEqual(at("#|"), { trigger: "#", start: 0, end: 1, query: "" });
assert.deepEqual(at("#context7/qu|"), { trigger: "#", start: 0, end: 12, query: "context7/qu" });
assert.equal(at("#93|"), null, "an issue number stays text");
assert.equal(at("## Titre|"), null);
assert.equal(at("# |Titre"), null, "after a space: nothing");
assert.equal(at("mot|"), null);
assert.equal(C.tokenAt("abc", 9), null);
assert.equal(C.tokenAt(null, 0), null);

// ── ranking ─────────────────────────────────────────────────────────────────
assert.equal(C.score("goal", "me:goal"), 5000 - 7, "the leaf's prefix");
assert.equal(C.score("me:goal", "me:goal"), 10000);
assert.ok(C.score("wt", "me:issue-worktree-pr") > 0, "a subsequence");
assert.equal(C.score("zz", "me:goal"), null);
assert.equal(C.score("", "x"), 0);
const items = [{ name: "me:goal", category: "workflow" }, { name: "commit", category: "skill" }, { name: "me:loop:ci-until-green", category: "loop" }, { name: "compact", category: "builtin" }];
assert.deepEqual(C.rank(items, "", { order: ORDER }).map((x) => x.name), ["me:goal", "commit", "me:loop:ci-until-green", "compact"], "empty: by category");
assert.deepEqual(C.rank(items, "co", { order: ORDER }).map((x) => x.name), ["commit", "compact"], "shorter first at the same rule; no match out");
assert.deepEqual(C.rank([{ name: "b", category: "skill" }, { name: "b", category: "workflow" }], "b", { order: ORDER }).map((x) => x.category), ["workflow", "skill"], "a tie: by category");
assert.equal(C.rank(Array.from({ length: 80 }, (_, i) => ({ name: `s${i}` })), "s").length, 50, "capped at 50");
// presorted (a project's files, `git ls-files`' order): best score first, a tie in the list's own
// order, the best 50, and no sort of the list: no localeCompare at all, whatever the query (#81
// review, 20 000 paths per keystroke).
{
  const dirs = ["mods/kt-chat", "mods/kt-keys", "docs", "src/App", "src/lib"];
  const files = Array.from({ length: 3000 }, (_, i) => `${dirs[i % 5]}/${["main", "Menu", "model", "complete", "a"][i % 7 % 5]}-${i}.${i % 3 ? "js" : "md"}`).sort();
  const qs = ["", "m", "mn", "kt-chat/menu", "md", "zzz"];
  const lc = String.prototype.localeCompare;
  let calls = 0;
  String.prototype.localeCompare = function (...a) { calls++; return lc.apply(this, a); };
  const got = qs.map((q) => C.rank(files, q, { key: (p) => p, presorted: true }));
  String.prototype.localeCompare = lc;
  assert.equal(calls, 0, "no localeCompare: the list is never sorted");
  const want = (q) => files.map((p, i) => [C.score(q, p), i, p]).filter(([s]) => s != null).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, 50).map(([, , p]) => p);
  assert.deepEqual(got, qs.map(want), "best score first, ties as the list comes, at most 50");
  assert.deepEqual(got.map((r) => r.length), [50, 50, 50, 50, 50, 0]);
}

// ── names, loading, hints ───────────────────────────────────────────────────
assert.equal(C.nameOf({ kind: "skill", rel: "me/loop/x/SKILL.md" }), "me:loop:x");
assert.equal(C.nameOf({ kind: "skill", rel: "synced/abc/docx/SKILL.md" }), "anthropic-skills:docx");
assert.equal(C.nameOf({ kind: "command", rel: "me/loop/x.md" }), "me:loop:x");
assert.equal(C.nameOf({ kind: "skill", rel: "review/SKILL.md", prefix: "pr-kit", source: "plugin" }), "pr-kit:review");
assert.equal(C.loads({ kind: "skill", rel: "me/goal/SKILL.md", source: "personal" }), false, "skills/me/** isn't loaded");
assert.equal(C.loads({ kind: "command", rel: "me/goal.md", source: "personal" }), true, "its cale is");
assert.equal(C.loads({ kind: "skill", rel: "x/SKILL.md", source: "personal", meta: { "user-invocable": "false" } }), false);
assert.equal(C.loads({ kind: "skill", rel: "_fragments/x/SKILL.md", source: "personal" }), false);
assert.equal(C.argHint({ meta: { "argument-hint": "[issue] [branch]" } }), "[issue] [branch]");
assert.equal(C.argHint({ meta: { "argument-hint": ["issue] [branch"] } }), "[issue] [branch]", "frontmatter.js' reading of it, unquoted");
assert.equal(C.argHint({ meta: { "argument-hint": ["objectif"] } }), "[objectif]");
assert.equal(C.argHint({ meta: { arguments: "issue branch" } }), "[issue] [branch]");
assert.equal(C.argHint({ meta: { arguments: ["a"] } }), "[a]");
assert.equal(C.argHint({ meta: {}, body: "Do $ARGUMENTS now" }), "[args]");
assert.equal(C.argHint({ meta: {}, body: "first: $0" }), "[args]");
assert.equal(C.argHint({ meta: {}, body: "costs $ 5" }), null);

// ── the session's tools and listing ─────────────────────────────────────────
let tools = C.foldTools(null, { addedNames: ["Read", "mcp__docs__query", "mcp__docs__resolve", "mcp__x_y__go"], addedLines: ["Read: r", "mcp__docs__query: Query docs", "mcp__docs__resolve: Resolve", "mcp__x_y__go: Go"] });
assert.deepEqual(tools.names.sort(), ["mcp__docs__query", "mcp__docs__resolve", "mcp__x_y__go"], "MCP tools only");
assert.equal(tools.lines.mcp__docs__query, "Query docs");
tools = C.foldTools(tools, { addedNames: [], removedNames: ["mcp__docs__resolve"] });
assert.deepEqual(tools.names.sort(), ["mcp__docs__query", "mcp__x_y__go"], "removed in order");
assert.equal(tools.lines.mcp__docs__resolve, undefined);
assert.deepEqual(C.serversOf(tools.names), ["docs", "x_y"]);
assert.deepEqual(C.toolOf("mcp__claude_ai_Docs__read"), { server: "claude_ai_Docs", tool: "read" });
assert.equal(C.toolOf("Read"), null);
assert.deepEqual(C.listingOf({ names: ["a", "me:loop:x"], content: "- a: one\n- me:loop:x: two: three" }), [{ name: "a", description: "one" }, { name: "me:loop:x", description: "two: three" }]);

// ── the merged list ─────────────────────────────────────────────────────────
const merged = C.merge(
  [{ name: "commit", description: "", hint: null, source: "personal" }, { name: "commit", description: "Commit", hint: "[msg]", source: "personal" }, { name: "me:goal", description: "Sprint", hint: "[obj]", source: "personal" }],
  [{ name: "me:goal", description: "x" }, { name: "pr-kit:review", description: "Review" }, { name: "loop", description: "Interval" }, { name: "compact", description: "c" }],
  classify,
);
const by = Object.fromEntries(merged.map((x) => [x.name, x]));
assert.equal(merged.filter((x) => x.name === "commit").length, 1, "one row per name");
assert.equal(by.commit.hint, "[msg]");
assert.equal(by.commit.description, "Commit");
assert.equal(by["me:goal"].category, "workflow");
assert.equal(by["me:goal"].live, true);
assert.equal(by.commit.live, false);
assert.equal(by["pr-kit:review"].source, "session");
assert.equal(by.loop.category, "loop", "the session's /loop");
assert.equal(by.compact.kind, "command", "a listed name stays the listing's");
assert.equal(by.context.kind, "builtin");
assert.equal(by.context.category, "builtin");
assert.equal(by.clear.confirm, true);
assert.ok(!by.model && !by.effort, "/model and /effort aren't offered");
assert.deepEqual(C.filesOf("a.js\n\n b/c.md \n", 1), ["a.js"]);

// ── pieces ──────────────────────────────────────────────────────────────────
assert.deepEqual(C.commandPiece(by["me:goal"]), { id: "cmd:me:goal", kind: "command", category: "workflow", label: "/me:goal", text: "/me:goal", source: "complete" });
assert.deepEqual(C.toolPiece("mcp__docs__query"), { id: "mcp:mcp__docs__query", kind: "mcp-tool", category: "mcp", label: "docs › query", text: "mcp__docs__query", source: "complete" });
assert.equal(C.toolPiece("Read"), null);

// ── the route of each completion ────────────────────────────────────────────
assert.deepEqual(C.routeOf("/me:goal découper #81"), { via: "send", by: "agent" }, "a skill: hc send, the agent invokes it");
assert.deepEqual(C.routeOf("/loop 5m check"), { via: "send", by: "agent" }, "the session's /loop is a skill");
assert.deepEqual(C.routeOf("/compact"), { via: "keys", keys: ["/", "c", "o", "m", "p", "a", "c", "t"], confirm: false });
assert.deepEqual(C.routeOf("/compact keep tests"), { via: "keys", keys: [..."/compact", "space", ..."keep", "space", ..."tests"], confirm: false });
assert.deepEqual(C.routeOf("  /clear "), { via: "keys", keys: [..."/clear"], confirm: true }, "trimmed; /clear asks first");
assert.deepEqual(C.routeOf("/exit"), { via: "keys", keys: [..."/exit"], confirm: true });
assert.deepEqual(C.routeOf("/compact garde l'API"), { via: "none", why: "untypable" }, "a capital can't be typed");
assert.deepEqual(C.routeOf("/compact résumé"), { via: "none", why: "untypable" }, "an accent can't");
assert.deepEqual(C.routeOf("lis @src/a.js puis mcp__docs__query"), { via: "send" }, "a message");
assert.deepEqual(C.routeOf("/model opus"), { via: "send", by: "agent" }, "not a built-in here: it would only be read");
// The bridge's route (kbrdn-herdr#8): no envelope, every /command runs natively; the one switch.
assert.deepEqual(C.routeOf("/me:goal découper", { say: true }), { via: "say", confirm: false });
assert.deepEqual(C.routeOf("/clear", { say: true }), { via: "say", confirm: true }, "/clear still asks first");
assert.deepEqual(C.routeOf("un message", { say: true }), { via: "send" }, "a plain message keeps hc send");
assert.deepEqual(C.routeOf("/tmp/build.log : pourquoi ?", { say: true }), { via: "send" }, "a path is a message, never a command for the bridge (#81 review)");
assert.deepEqual(C.routeOf("/Users/x/a.png", { say: true }), { via: "send" });
assert.deepEqual(C.routeOf("/tmp/build.log"), { via: "send" }, "nor a skill the agent would invoke");
assert.deepEqual(C.routeOf("/compact\\x"), { via: "send" });
assert.deepEqual(C.routeOf("/compact", { builtins: [] }), { via: "send", by: "agent" }, "the built-ins are the caller's");
assert.equal(C.keysOf("a:b"), null);
assert.ok(C.typeable("/reload-plugins") && !C.typeable("/Compact") && !C.typeable("_"));

// ── the words ───────────────────────────────────────────────────────────────
assert.deepEqual(Object.keys(S.fr).sort(), Object.keys(S.en).sort(), "fr and en say the same keys");
for (const b of C.BUILTINS) assert.ok(S.fr[`builtin.${b.name}`] && S.en[`builtin.${b.name}`], b.name);
for (const k of ORDER) assert.ok(S.fr[`cat.${k}`], k);

// ── complete-index.ts on an invented home and session ───────────────────────
const tmp = mkdtempSync(join(tmpdir(), "kt-complete-"));
try {
  const home = join(tmp, "home");
  const put = (p, text) => { mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, text); };
  const C2 = join(home, ".claude");
  put(join(C2, "settings.json"), JSON.stringify({ enabledPlugins: { "pr-kit@market": true, "off-kit@market": false } }));
  put(join(C2, "plugins/installed_plugins.json"), JSON.stringify({ plugins: { "pr-kit@market": [{ scope: "user", installPath: join(tmp, "plugins/pr-kit") }] } }));
  put(join(tmp, "plugins/pr-kit/skills/review/SKILL.md"), "---\nname: review\ndescription: Review a PR\n---\nbody");
  put(join(tmp, "plugins/pr-kit/commands/ship.md"), "---\nargument-hint: [tag]\n---\nShip $ARGUMENTS");
  put(join(C2, "skills/alpha/SKILL.md"), "---\ndescription: \"Alpha \u001b[31mred\u001b[0m skill\"\n---\nUse $ARGUMENTS");
  put(join(C2, "skills/alpha/venv/inner/SKILL.md"), "---\ndescription: nested\n---\n");
  put(join(C2, "skills/me/goal/SKILL.md"), "---\ndescription: hidden\n---\n");
  put(join(C2, "skills/hidden/SKILL.md"), "---\nuser-invocable: false\n---\n");
  put(join(C2, "skills/synced/id1/docx/SKILL.md"), "---\ndescription: Docx\n---\n");
  put(join(tmp, "shared/beta/SKILL.md"), "---\ndescription: Beta\n---\n");
  symlinkSync(join(tmp, "shared/beta"), join(C2, "skills/beta"));
  symlinkSync(join(tmp, "shared/beta"), join(C2, "skills/beta-again"));
  put(join(C2, "commands/me/goal.md"), "---\ndescription: Sprint\nargument-hint: [objectif]\n---\nLis le SKILL.md");
  put(join(C2, "commands/me/loop/ci.md"), "---\narguments: [pr]\n---\n");
  const root = join(tmp, "repo");
  put(join(root, ".claude/commands/local.md"), "# Local\n\nDoes local things");
  const jsonl = join(tmp, "s.jsonl");
  const line = (o) => `${JSON.stringify(o)}\n`;
  writeFileSync(jsonl, [
    line({ type: "user", message: { content: 'quoted "attachment":{"type":"skill_listing" mark' } }),
    line({ type: "attachment", attachment: { type: "skill_listing", names: ["alpha", "ext:tool"], content: "- alpha: A\n- ext:tool: External \u001b]8;;x\u0007link" } }),
    line({ type: "attachment", attachment: { type: "deferred_tools_delta", addedNames: ["Bash", "mcp__docs__query", "mcp__docs__resolve"], addedLines: ["Bash: b", "mcp__docs__query: Query", "mcp__docs__resolve: Resolve"], removedNames: [] } }),
  ].join(""));
  const cache = join(tmp, "cache");
  const run = () => {
    const r = spawnSync([process.execPath, new URL("./complete-index.ts", import.meta.url).pathname, "--home", home, "--root", root, "--jsonl", jsonl, "--cache", cache]);
    assert.equal(r.exitCode, 0, r.stderr.toString());
    return JSON.parse(r.stdout.toString().trim().split("\n").pop());
  };
  let out = run();
  const names = out.items.map((x) => x.name).sort();
  assert.deepEqual(names, ["alpha", "anthropic-skills:docx", "beta", "local", "me:goal", "me:loop:ci", "pr-kit:review", "pr-kit:ship"],
    "plugin prefixed, synced renamed, skills/me/** out (its cale in), user-invocable false out, nested out, one link of two, project in, disabled plugin out");
  const it = Object.fromEntries(out.items.map((x) => [x.name, x]));
  assert.equal(it.alpha.description, "Alpha red skill", "escape sequences cleaned");
  assert.equal(it.alpha.hint, "[args]");
  assert.equal(it["me:goal"].hint, "[objectif]");
  assert.equal(it["me:loop:ci"].hint, "[pr]");
  assert.equal(it["pr-kit:ship"].hint, "[tag]");
  assert.equal(it.local.description, "Does local things", "no description: the body's first line, headings skipped");
  assert.equal(it.local.source, "project");
  assert.ok(!out.items.some((x) => x.path.includes("/skills/me/")));
  assert.deepEqual(out.listing, [{ name: "alpha", description: "A" }, { name: "ext:tool", description: "External link" }], "the real record only, cleaned");
  assert.deepEqual(out.tools, [{ name: "mcp__docs__query", description: "Query" }, { name: "mcp__docs__resolve", description: "Resolve" }]);
  assert.deepEqual(out.servers, ["docs"]);
  assert.equal(out.session.offset, out.session.size);
  assert.deepEqual(out.errors, []);
  // Incremental: a delta appended is folded from the last offset; a line being written waits.
  appendFileSync(jsonl, line({ type: "attachment", attachment: { type: "deferred_tools_delta", addedNames: ["mcp__web__fetch"], addedLines: ["mcp__web__fetch: Fetch"], removedNames: ["mcp__docs__resolve"] } }));
  appendFileSync(jsonl, '{"type":"attachment","attachment":{"type":"deferred_tools_delta","addedNames":["mcp__half');
  out = run();
  assert.deepEqual(out.tools.map((x) => x.name), ["mcp__docs__query", "mcp__web__fetch"]);
  assert.ok(out.session.offset < out.session.size, "the unfinished line waits");
  // A shorter file (a /clear, a rewrite): from 0 again.
  writeFileSync(jsonl, line({ type: "attachment", attachment: { type: "deferred_tools_delta", addedNames: ["mcp__only__one"], addedLines: [], removedNames: [] } }));
  out = run();
  assert.deepEqual(out.tools.map((x) => x.name), ["mcp__only__one"]);
  assert.deepEqual(out.listing, [], "the old listing went with the old file");
  // The disk cache: an untouched file isn't read again (its cached item is kept as is).
  const diskCache = JSON.parse(readFileSync(join(cache, "disk.json"), "utf8"));
  const key = Object.keys(diskCache).find((k) => k.includes("/skills/alpha/SKILL.md"));
  diskCache[key].item.description = "from the cache";
  writeFileSync(join(cache, "disk.json"), JSON.stringify(diskCache));
  out = run();
  assert.equal(out.items.find((x) => x.name === "alpha").description, "from the cache", "same mtime: not read again");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log("kt-keys complete: ok");
