// bun completer.check.mjs: completer.js (#81 L4) on an invented catalog: the menu for each trigger,
// the active row kept or reset, Esc's dismissal, the moves, what a pick writes (and its piece), a
// command typed by hand, the effect. gpui mocked for categories.js.
import assert from "node:assert/strict";
import { plugin } from "bun";

plugin({
  setup(build) {
    build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => null, svg: () => null } }));
    build.module("gpui-base", () => ({ loader: "object", exports: { h_flex: () => null } }));
  },
});
const { menuFor, move, pick, typed, effectOf } = await import("./completer.js");
const { merge } = await import("./complete.js");
const { classify } = await import("./categories.js");
const { mentionText } = await import("./attach.js");

const catalog = {
  commands: merge(
    [{ name: "me:goal", description: "Sprint", hint: "[obj]", source: "personal" }, { name: "commit", description: "Commit", hint: null, source: "personal" }, { name: "me:loop:ci-until-green", description: "CI", hint: "[pr]", source: "personal" }],
    [{ name: "schedule", description: "Routines" }], classify),
  tools: [{ name: "mcp__docs__query", description: "Query docs" }, { name: "mcp__docs__resolve", description: "Resolve" }, { name: "mcp__web__fetch", description: "Fetch" }],
  files: ["mods/kt-chat/main.js", "mods/kt-chat/composer.js", "README.md", "notes/a b.md"],
};

// "/": the commands, best first; the active row kept while it still shows.
let m = menuFor("/go", 3, catalog);
assert.equal(m.trigger, "/");
assert.equal(m.rows[0].id, "cmd:me:goal");
assert.equal(m.rows[0].category, "workflow");
m = move(menuFor("/", 1, catalog), 1);
const kept = m.rows[m.active].id;
assert.equal(menuFor("/", 1, catalog, { prev: m }).rows[menuFor("/", 1, catalog, { prev: m }).active].id, kept, "the active row stays");
assert.equal(menuFor("/zzz", 4, catalog).rows.length, 0, "no match: open, empty");
assert.equal(menuFor("texte /go", 9, catalog), null, "mid-message: no menu");

// "#": the servers, then one server's tools.
m = menuFor("#d", 2, catalog);
assert.deepEqual(m.rows.map((r) => [r.id, r.count]), [["srv:docs", 2]]);
let p = pick(m, m.rows[0]);
assert.deepEqual(p, { start: 0, end: 2, text: "#docs/", piece: null, reopen: true }, "a server narrows the list");
m = menuFor("#docs/q", 7, catalog);
assert.deepEqual(m.rows.map((r) => r.id), ["mcp:mcp__docs__query"]);
assert.equal(m.rows[0].label, "docs › query");
p = pick(m, m.rows[0]);
assert.equal(p.text, "mcp__docs__query ", "the real name goes");
assert.equal(p.piece.label, "docs › query");

// "@": the files; the mention is attach.js' (#93), the one form for a file.
m = menuFor("lis @comp", 9, catalog);
assert.equal(m.rows[0].path, "mods/kt-chat/composer.js");
p = pick(m, m.rows[0], { mention: (x) => mentionText("claude", x) });
assert.deepEqual(p, { start: 4, end: 9, text: "@mods/kt-chat/composer.js ", piece: { id: "file:mods/kt-chat/composer.js", kind: "file", category: "file", label: "composer.js", text: "@mods/kt-chat/composer.js", source: "complete" }, reopen: false });
p = pick(m, m.rows[0], { mention: (x) => mentionText("codex", `/abs/${x}`) });
assert.equal(p.text, "/abs/mods/kt-chat/composer.js ", "Codex: the path, as attach.js writes it");
assert.equal(pick({ start: 0, end: 4 }, { type: "file", path: "notes/a b.md" }, { mention: (x) => mentionText("claude", x) }).text, '"notes/a b.md" ', "a space: quoted, as attach.js writes it");

// 20 000 files: a keystroke in `@` sorts nothing (#81 review: the whole list went through localeCompare
// at each keystroke); the best matches still come first.
{
  const many = Array.from({ length: 20000 }, (_, i) => `src/m${String(i).padStart(5, "0")}/f.js`);
  many.push("src/zz/menu.js");
  const big = { ...catalog, files: many };
  const lc = String.prototype.localeCompare;
  let calls = 0;
  String.prototype.localeCompare = function (...a) { calls++; return lc.apply(this, a); };
  const shown = [menuFor("@", 1, big), menuFor("@m", 2, big), menuFor("@menu", 5, big)];
  String.prototype.localeCompare = lc;
  assert.equal(calls, 0, "no sort of the files at a keystroke");
  assert.deepEqual(shown.map((x) => x.rows.length), [50, 50, 1]);
  assert.equal(shown[2].rows[0].path, "src/zz/menu.js");
  assert.equal(shown[0].rows[0].path, "src/m00000/f.js", "an empty query: the list's order");
}

// A command: its piece, then a space.
m = menuFor("/go", 3, catalog);
p = pick(m, m.rows[0]);
assert.equal(p.text, "/me:goal ");
assert.deepEqual(effectOf(p.piece), { category: "workflow", rail: true });
m = menuFor("/sch", 4, catalog);
assert.deepEqual(effectOf(pick(m, m.rows[0]).piece), { category: "automation", rail: false });
assert.deepEqual(effectOf(null), { category: "file", rail: false });

// Esc: closed until another token.
const d = { trigger: "/", start: 0 };
assert.equal(menuFor("/go", 3, catalog, { dismissed: d }), null);
assert.notEqual(menuFor("lis @r", 6, catalog, { dismissed: d }), null);

// Moves wrap; an empty menu doesn't move.
m = menuFor("/", 1, catalog);
assert.equal(move(m, -1).active, m.rows.length - 1);
assert.equal(move(move(m, -1), 1).active, 0);
assert.equal(move(menuFor("/zzz", 4, catalog), 1).active, 0);

// Typed by hand: a known command then a space at the head.
assert.deepEqual(typed("/commit fix", catalog.commands), { start: 0, piece: { id: "cmd:commit", kind: "command", category: "skill", label: "/commit", text: "/commit", source: "complete" } });
assert.equal(typed(" /me:goal x", catalog.commands).start, 1);
assert.equal(typed("/commit", catalog.commands), null, "no space yet");
assert.equal(typed("/nope x", catalog.commands), null);
assert.equal(typed("dis /commit x", catalog.commands), null);

console.log("kt-chat completer: ok");
