// bun ~/.config/herdr-app/mods/kt-keys/markdown.check.mjs: markdown.js' pure side (the cut: fences,
// alerts, HTML comments; the frontmatter as fields; parse; the hash; the fence's language and the
// fallback to plain mono; links), then its colors (one batch per render, the cache by content and
// mode, a failure kept as mono, nothing under checking) and its drawing (Aperçu / Brut, the
// skeleton while Brut is asked, the tabs). herdr and gpui mocked; exec stands for zed-tokens.ts.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { plugin } from "bun";

const el = (kind = "div") => {
  const node = { kind, kids: [], props: {}, on: {}, tr: [] };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "children") target.kids.push(...a[0]);
        else if (k === "when") return a[0] ? a[1](p) : p;
        else if (k === "transition") target.tr.push(a[0]);
        else if (k.startsWith("on_")) target.on[k] = a.at(-1);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
const home = mkdtempSync(join(tmpdir(), "md-check-"));
process.on("exit", () => rmSync(home, { recursive: true, force: true })); // a failed assertion too
let isChecking = false, dark = true, fail = false;
const calls = [];
plugin({
  setup(b) {
    b.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el(), svg: () => el("svg") } }));
    b.module("gpui-base", () => ({ loader: "object", exports: {
      v_flex: () => el("v"), h_flex: () => el("h"),
      TextView: { markdown: (id, text) => { const x = el("md"); x.props.id = [id]; x.props.text = [text]; return x; } },
    } }));
    b.module("herdr", () => ({ loader: "object", exports: {
      appHome: () => home, home: () => home, settings: () => ({ dark }), checking: () => isChecking, shared: () => undefined, setShared: () => {},
      // zed-tokens.ts: red runs for each line, none for an unknown language; `fail`: no bun.
      exec: async (cmd, args) => {
        calls.push(args);
        if (fail) return { code: 127, stdout: "", stderr: "not found" };
        const [req, out] = args.slice(-2);
        const r = JSON.parse(readFileSync(req, "utf8"));
        const files = {};
        for (const it of r.items) files[it.id] = { lang: it.lang, lines: it.lang === "nolang" ? null : it.text.split("\n").map((l) => (l ? [[l, r.mode === "dark" ? "#ff0000" : "#0000ff", 0]] : [])) };
        writeFileSync(out, JSON.stringify({ theme: {}, files }));
        return { code: 0, stdout: "", stderr: "" };
      },
    } }));
  },
});
const { blocks, fields, parse, hash, softLine, wrapPlan, mdBudget, langFor, target, mdState, docOf, colorsOf, view, preview, tabs } = await import("./markdown.js");
const { motionState, frame } = await import("./motion.js");

// ---------- the cut: fences (any indent, ``` or ~~~, unclosed runs to the end); tables stay ----------
const b = blocks(`# T

1. **config.json** :
   \`\`\`json
   { "a": 1 }
     nested
   \`\`\`
2. next

| A | \`b|c\` |
|---|:-:|
| 1 | 2 |

~~~
x
~~~
Inline \`\`\`not a fence\`\`\` here.
\`\`\`sh
unclosed`);
assert.deepEqual(b.map((x) => x.kind), ["md", "code", "md", "code", "md", "code"]);
assert.deepEqual(b[1], { kind: "code", lang: "json", text: '{ "a": 1 }\n  nested' });
assert.ok(b[2].text.startsWith("2. next") && b[2].text.includes("|---|:-:|"));
assert.equal(b[4].text, "Inline ```not a fence``` here.");
assert.deepEqual(b[5], { kind: "code", lang: "sh", text: "unclosed" });

// Alerts: a quote opening on [!TYPE]; not in the middle of a quote, nor in a fence. Comments dropped.
const a = blocks("Avant\n\n> [!WARNING]\n> Ne pas **faire** ça.\n> Deux lignes.\n\nAprès\n> intro\n> [!NOTE]\n\n```md\n> [!TIP]\n```\n<!-- template:\n  à remplir -->\nFin");
assert.deepEqual(a.map((x) => x.kind), ["md", "alert", "md", "code", "md"]);
assert.deepEqual(a[1], { kind: "alert", type: "warning", text: "Ne pas **faire** ça.\nDeux lignes." });
assert.equal(a[2].text, "Après\n> intro\n> [!NOTE]");
assert.equal(a[3].text, "> [!TIP]");
assert.equal(a[4].text, "Fin");
assert.deepEqual(blocks("<!-- only a comment -->\n"), []);
assert.deepEqual(blocks("> [!tip]").map((x) => [x.type, x.text]), [["tip", ""]]);

// ---------- the frontmatter as fields ----------
const fm = fields(`---
name: "me:loop:x"
description: >-
  Folded over
  two lines.
allowed-tools: [Bash, 'Read', "Edit"]
# a comment
list:
- one
- two
metadata:
  argument-hint: <feature>
  requires: spark
---
body
---
not: frontmatter`);
assert.deepEqual(fm.fields, [
  ["name", "me:loop:x"], ["description", "Folded over two lines."], ["allowed-tools", "Bash, Read, Edit"],
  ["list", "one, two"], ["metadata", "argument-hint: <feature>, requires: spark"],
]);
assert.equal(fm.body, "body\n---\nnot: frontmatter");
// A rule, then prose: not frontmatter. No closing line: neither. Nothing at the top: neither.
for (const s of ["---\nUn paragraphe ici.\n---\nsuite", "---\nkey: v\n", "# Titre\n---\nk: v\n---"]) assert.deepEqual(fields(s), { fields: [], body: s }, s);

// parse: line ends and tabs made plain; fields shown or not, the body cut either way.
const p = parse("---\r\ntype: note\r\n---\r\n# Hi\r\n\tcode-ish\r\n");
assert.equal(p.src, "---\ntype: note\n---\n# Hi\n    code-ish\n");
assert.deepEqual(p.fields, [["type", "note"]]);
assert.deepEqual(p.segs, [{ kind: "md", text: "# Hi\n    code-ish" }]);
assert.deepEqual(parse("---\ntype: note\n---\nx", { fields: false }).fields, []);
assert.deepEqual(parse("---\ntype: note\n---\nx", { fields: false }).segs, [{ kind: "md", text: "x" }]);
// { meta: false }: no frontmatter at all, the rules and their lines stay prose.
assert.deepEqual(parse("---\nk: v\n---\nx", { meta: false }).segs, [{ kind: "md", text: "---\nk: v\n---\nx" }]);
// A BOM off (a README saved by Windows tools); the hashes the colors are cached by, computed once.
assert.equal(parse("﻿# a").src, "# a");
assert.equal(p.hash, hash(p.src));
assert.deepEqual(parse("```js\nlet a\n```").segs, [{ kind: "code", lang: "js", text: "let a", hash: hash("let a") }]);

// hash: stable, by content and length.
assert.equal(hash("abc"), hash("abc"));
assert.notEqual(hash("abc"), hash("abd"));
assert.match(hash(""), /^811c9dc5-0$/);

// The soft wrap: the indent apart (kept on every row), pieces that break only after a space, a word
// split across runs kept whole, an indent across runs, a line of spaces, an empty line.
const R = "#ff0000", G = "#00ff00";
assert.deepEqual(softLine([["    const ", R, 0], ["a = ", G, 0], ["1;", R, 2]]),
  { indent: "    ", pieces: [[["const ", R, 0]], [["a ", G, 0]], [["= ", G, 0]], [["1;", R, 2]]] });
assert.deepEqual(softLine([["Un ", G, 0], ["**gras**", R, 2], [", fin", G, 0]]),
  { indent: "", pieces: [[["Un ", G, 0]], [["**gras**", R, 2], [", ", G, 0]], [["fin", G, 0]]] });
assert.deepEqual(softLine([["  ", G, 0], ["  - item  x", R, 0]]), { indent: "    ", pieces: [[["- ", R, 0]], [["item  ", R, 0]], [["x", R, 0]]] });
assert.deepEqual(softLine([["   ", null, 0]]), { indent: "   ", pieces: [] });
assert.deepEqual(softLine([]), { indent: "", pieces: [] });
assert.equal(softLine([["  a very long line indeed", null, 0]]).pieces.flat().map((x) => x[0]).join(""), "a very long line indeed", "nothing lost");
// wrapPlan: one style, one text (1 element); several, between pieces while the budget allows, then its
// runs merged by style, then plain; never a character lost, the indent always kept.
const multi = [["  - ", R, 0], ["**a**", G, 2], [" b c", R, 0]];
const long = [["  - ", R, 0], ["**a**", G, 2], [` b c${" d".repeat(30)}`, R, 0]];
const longText = `- **a** b c${" d".repeat(30)}`;
assert.deepEqual(wrapPlan([["  plain text", R, 0]]), { indent: "  ", mode: "one", parts: [["plain text", R, 0]], cost: 1 });
assert.deepEqual(wrapPlan([]), { indent: "", mode: "one", parts: [[" ", null, 0]], cost: 1 });
// A short line of several colors: its runs (it won't wrap: the same look, for less).
assert.deepEqual(wrapPlan(multi), { indent: "  ", mode: "segs", parts: [["- ", R, 0], ["**a**", G, 2], [" b c", R, 0]], cost: 4 });
// A long one: words, those of one style grouped up to 32 characters; 2, then 2 a chunk, 2 more a span
// for a glued one (**a** and its space).
const w = wrapPlan(long);
assert.equal(w.mode, "words");
assert.deepEqual(w.parts.slice(0, 3), [[["- ", R, 0]], [["**a**", G, 2], [" ", R, 0]], [[`b c ${"d ".repeat(14)}`, R, 0]]]);
assert.ok(w.parts.slice(2).every((c) => c.length === 1 && c[0][0].length <= 32), "chunks of 32 characters at most");
assert.equal(w.cost, 2 + 2 + (2 * 2 + 2) + 2 * (w.parts.length - 2));
const sg = wrapPlan(long, 30);
assert.deepEqual([sg.mode, sg.cost], ["segs", 4]);
const mono = wrapPlan(long, 3);
assert.deepEqual([mono.mode, mono.indent, mono.parts, mono.cost], ["mono", "  ", [[longText, null, 0]], 1]);
for (const p of [w, sg, mono]) assert.equal((p.mode === "words" ? p.parts.flat() : p.parts).map((s) => s[0]).join(""), longText, p.mode);

// The fence's language, and the fallback: no info, nothing asked (plain mono).
assert.equal(langFor(""), null);
assert.equal(langFor(undefined), null);
assert.equal(langFor("JS"), "js");
assert.equal(langFor("console"), "shellsession");
assert.equal(langFor("{.python}"), "python");

// Links.
assert.deepEqual(target("https://x.dev/a", null), { web: "https://x.dev/a" });
assert.deepEqual(target("docs/../guide/a.md#part", "/r/plugin"), { path: "/r/plugin/guide/a.md" });
assert.deepEqual(target("/abs/b.md", null), { path: "/abs/b.md" });
assert.equal(target("#anchor", "/r"), null);
assert.equal(target("docs/a.md", null), null);
assert.equal(target("vscode://x", "/r"), null);
console.log("markdown pure: ok");

// ---------- colors: one batch per render, the cache, failures as mono ----------
const spawned = [];
let notified = 0;
const cx = { spawn: (fn) => spawned.push(fn({ notify: () => notified++ })), notify: () => notified++ };
const settle = async () => { await Promise.all(spawned.splice(0)); };
let st = mdState();

isChecking = true;
assert.equal(colorsOf(st, cx, "kt-x", "const a = 1", "js"), null, "never asked under checking");
isChecking = false;
assert.equal(colorsOf(st, cx, "kt-x", "x", null), null, "no language: plain");
assert.equal(colorsOf(st, cx, "kt-x", "const a = 1", "js"), undefined);
assert.equal(colorsOf(st, cx, "kt-x", "let b", "ts"), undefined);
assert.equal(colorsOf(st, cx, "kt-x", "const a = 1", "js"), undefined, "busy: asked once");
assert.equal(spawned.length, 1, "one task for the render's misses");
await settle();
assert.equal(calls.length, 1, "one batch");
assert.deepEqual(JSON.parse(JSON.stringify(colorsOf(st, cx, "kt-x", "const a = 1", "js"))), [[["const a = 1", "#ff0000", 0]]]);
assert.ok(colorsOf(st, cx, "kt-x", "let b", "ts"));
assert.equal(notified, 1);
assert.deepEqual(readdirSync(join(home, "data/kt-x/tokens")), [], "the batch's files removed");
// The other appearance: a miss of its own.
dark = false;
assert.equal(colorsOf(st, cx, "kt-x", "const a = 1", "js"), undefined);
await settle();
assert.equal(colorsOf(st, cx, "kt-x", "const a = 1", "js")[0][0][1], "#0000ff");
dark = true;
// Unknown language, and no bun: null (mono), kept, never asked again.
assert.equal(colorsOf(st, cx, "kt-x", "x", "nolang"), undefined);
await settle();
assert.equal(colorsOf(st, cx, "kt-x", "x", "nolang"), null);
fail = true;
assert.equal(colorsOf(st, cx, "kt-x", "y", "js"), undefined);
await settle();
const n = calls.length;
assert.equal(colorsOf(st, cx, "kt-x", "y", "js"), null);
assert.equal(spawned.length, 0);
assert.equal(calls.length, n, "a failure is not asked again");
fail = false;
// The cache is bounded.
for (let i = 0; i < 140; i++) colorsOf(st, cx, "kt-x", `v${i}`, "js");
await settle();
assert.ok(st.colors.size <= 128);
// docOf: memoized by text and option.
st = mdState();
assert.equal(docOf(st, "# a"), docOf(st, "# a"));
assert.notEqual(docOf(st, "# a"), docOf(st, "# a", { fields: false }));
console.log("markdown colors: ok");

// ---------- drawing ----------
const t = { border: "#2a2a2a", raised: "#1c1c1c", foreground: "#e8e8e8", muted: "#999999", dim: "#666666", accent: "#e07a47", hover: "#333333",
  ansi1: "#ff0000", ansi2: "#00ff00", ansi3: "#ffff00", ansi5: "#ff00ff" };
const find = (n, pred, out = []) => { if (n && typeof n === "object" && "kids" in n) { if (pred(n)) out.push(n); for (const k of n.kids) find(k, pred, out); } return out; };
const texts = (n) => find(n, () => true).flatMap((x) => x.kids.filter((k) => typeof k === "string"));
let m = frame(motionState(), false);
st = mdState();
const doc = parse("---\ntitle: Démo\n---\n# Titre\n\n> [!NOTE]\n> Lu.\n\n```js\nconst a = 1;\n```\n");
const links = [];
// Aperçu: the fields card, then prose, the alert and the code block (mono until its colors come).
// A first draw has no fade of its own (the caller's swap or detail fades it: opacities multiply).
let v = view(t, m, cx, st, { id: "kx-md", mod: "kt-x", doc, onLink: (u) => links.push(u) });
assert.equal(v.props.id, undefined, "no fade on a first draw");
const pv = v.kids[0];
assert.equal(pv.kids.length, 4, "fields + 3 blocks");
assert.deepEqual(texts(pv.kids[0]), ["TITLE", "Démo"]);
assert.equal(pv.kids[1].kind, "md");
assert.equal(typeof pv.kids[1].on.on_link_click, "function");
assert.ok(texts(pv.kids[2]).includes("REMARQUE"));
assert.ok(texts(pv.kids[3]).includes("const a = 1;"), "mono while asked");
assert.equal(spawned.length, 1);
await settle();
v = view(t, m, cx, st, { id: "kx-md", mod: "kt-x", doc });
assert.equal(find(v, (x) => x.props.text_color?.[0] === "#ff0000").length, 1, "the code block in Zed's colors");
// Brut: the switch fades it in; the skeleton while asked (asked only now), then the source, one row per line.
st.raw = true;
const before = calls.length;
m = frame(m, false);
v = view(t, m, cx, st, { id: "kx-md", mod: "kt-x", doc });
assert.equal(v.props.id[0], "kx-md:raw:1", "a switch fades");
assert.deepEqual(v.tr, ["opacity"]);
assert.equal(v.kids[0].props.id[0], "kx-md:src~sk", "the skeleton");
await settle();
assert.equal(calls.length, before + 1);
m = frame(m, false);
v = view(t, m, cx, st, { id: "kx-md", mod: "kt-x", doc });
assert.equal(v.props.id[0], "kx-md:raw:1", "the same fade while it stays drawn");
assert.equal(find(v, (x) => x.props.text_color?.[0] === "#ff0000" && x.kids[0] === "# Titre").length, 1, "the source in colors");
assert.equal(find(v, (x) => x.props.id?.[0] === "kx-md:src~sk").length, 0);
// Brut without colors: mono, and said. A document first drawn in Brut: no fade.
fail = true;
const d2 = parse("plain *text*\nline 2");
m = frame(m, false);
assert.equal(view(t, m, cx, st, { id: "kx-d2", mod: "kt-x", doc: d2 }).props.id, undefined);
await settle();
m = frame(m, false);
v = view(t, m, cx, st, { id: "kx-d2", mod: "kt-x", doc: d2 });
assert.ok(texts(v).includes("plain *text*") && texts(v).includes("line 2"));
assert.ok(texts(v).some((s) => s.startsWith("Sans couleurs")));
fail = false;
// The faded one back after a render away (its detail fades it again): no second fade.
m = frame(m, false);
assert.equal(view(t, m, cx, st, { id: "kx-md", mod: "kt-x", doc }).props.id, undefined);
// preview(): Aperçu only, whatever md.raw says; it leaves the switch state alone.
const c = preview(t, cx, st, { id: "kx-c", mod: "kt-x", doc: parse("**hi**") });
assert.equal(c.kids[0].kind, "md");
assert.equal(st.seen.has("kx-c"), false);
// The tabs: a click picks, no focus held (KEYMAP.md, Space).
const tb = tabs(t, "kx-tabs", st);
assert.deepEqual(tb.kids.map((k) => k.props.id[0]), ["kx-tabs-pv", "kx-tabs-raw"]);
assert.ok(tb.kids.every((k) => !("track_focus" in k.props) && k.props.tooltip));
tb.kids[0].on.on_click(null, { stop_propagation: () => {}, notify: () => {} });
assert.equal(st.raw, false);
tb.kids[1].on.on_click(null, { stop_propagation: () => {}, notify: () => {} });
assert.equal(st.raw, true);
// Brut and code blocks soft-wrap: nothing scrolls sideways nor stays on one row, the boxes as wide as
// their caller; a line of several colors wraps between its pieces, its indent in front.
const d3 = parse("  - **a** b\nplain");
st.colors.set(`dark:markdown:${d3.hash}`, [[["  - ", R, 0], ["**a**", G, 2], [" b", R, 0]], [["plain", R, 0]]]);
m = frame(m, false);
v = view(t, m, cx, st, { id: "kx-d3", mod: "kt-x", doc: d3 });
const sideways = (n) => find(n, (x) => "overflow_x_scrollbar" in x.props || "whitespace_nowrap" in x.props).length;
assert.equal(sideways(v), 0);
assert.ok("w_full" in v.props && "w_full" in v.kids[0].props, "as wide as the caller");
assert.equal(find(v, (x) => "flex_wrap" in x.props).length, 1, "the multi-color line wraps between pieces");
assert.deepEqual(find(v, (x) => "flex_wrap" in x.props)[0].props.pl, [2 * 7.2], "its indent as padding, on every row");
assert.ok(texts(v).includes("plain"), "a one-color line wraps as text");
// The budget: a big Brut goes by pages, each bounded (a render is interrupted past ~50 ms); the pages
// cover every line once, ‹ › move between them.
const big = parse(Array.from({ length: 1400 }, (_, i) => `  - l${i} \`c\` **b** and some more words to wrap`).join("\n"));
st.colors.set(`dark:markdown:${big.hash}`, Array.from({ length: 1400 }, (_, i) => [["  - ", R, 0], [`l${i} `, G, 0], ["`c`", R, 0], [" ", G, 0], ["**b**", R, 2], [" and some more words to wrap", G, 0]]));
const nodes = (n) => find(n, () => true).length;
const seenLines = new Set();
let pages = 0, bv;
const click = (n, id) => find(n, (x) => x.props.id?.[0] === id)[0]?.on.on_click(null, { stop_propagation: () => {}, notify: () => {} });
for (;;) {
  m = frame(m, false);
  bv = view(t, m, cx, st, { id: "kx-big", mod: "kt-x", doc: big });
  pages++;
  assert.ok(nodes(bv) < 3000, `page ${pages} bounded: ${nodes(bv)} elements`);
  for (const s of texts(bv)) { const k = /^(?:- )?l(\d+) /.exec(s); if (k) { assert.ok(!seenLines.has(k[1]), "a line on one page only"); seenLines.add(k[1]); } }
  assert.ok(texts(bv).some((s) => /^lignes \d+–\d+ sur 1400$/.test(s)), "the page says where it is");
  if (!find(bv, (x) => x.props.id?.[0] === "kx-big:nextt").length) break;
  click(bv, "kx-big:nextb");
  assert.ok(pages < 40);
}
assert.equal(seenLines.size, 1400, "every line, once");
assert.ok(pages > 1 && texts(bv).some((s) => /^lignes \d+–1400 sur 1400$/.test(s)), "the last page");
click(bv, "kx-big:prevt");
m = frame(m, false);
assert.ok(!texts(view(t, m, cx, st, { id: "kx-big", mod: "kt-x", doc: big })).some((s) => /^(?:- )?l1399 /.test(s)), "‹ back a page");
// A plain line costs 1 (no plan): a page of plain lines holds BUDGET (500) of them.
const plain = parse(Array.from({ length: 3000 }, (_, i) => `row ${i}`).join("\n"));
m = frame(m, false);
view(t, m, cx, st, { id: "kx-plain", mod: "kt-x", doc: plain }); // its colors asked
await settle();
m = frame(m, false);
assert.ok(texts(view(t, m, cx, st, { id: "kx-plain", mod: "kt-x", doc: plain })).includes("lignes 1–500 sur 3000"));
// One budget for a render's documents (mdBudget): what one spends, the next has not; a page change
// tells the mod (onPage), which brings the page's top into view.
let turned = 0;
const shared = mdBudget();
m = frame(m, false);
view(t, m, cx, st, { id: "kx-s1", mod: "kt-x", doc: plain, budget: shared });
const s2 = view(t, m, cx, st, { id: "kx-s2", mod: "kt-x", doc: plain, budget: shared, onPage: () => turned++ });
assert.ok(texts(s2).includes("lignes 1–1 sur 3000"), "the second document gets what is left: a line, then its pages");
click(s2, "kx-s2:nextb");
assert.equal(turned, 1);
// Aperçu's code blocks: past the budget, plain (nothing hidden); past HARD (1000) rows a render, cut and
// said: Brut shows the rest, or (noRaw, a comment) not shown.
st.raw = false;
m = frame(m, false);
const block = (n) => parse("```\n" + Array.from({ length: n }, (_, i) => `x${i}`).join("\n") + "\n```");
const lv = view(t, m, cx, st, { id: "kx-long", mod: "kt-x", doc: block(900) });
assert.ok(texts(lv).includes("x899") && !texts(lv).some((s) => s.startsWith("…")), "900 rows: all drawn");
m = frame(m, false);
assert.ok(texts(view(t, m, cx, st, { id: "kx-long2", mod: "kt-x", doc: block(2000) })).includes("… 1000 lignes de plus : le Brut les montre (p)."));
assert.ok(texts(preview(t, cx, st, { id: "kx-c2", mod: "kt-x", doc: block(2000), noRaw: true })).includes("… 1000 lignes de plus, trop pour un seul affichage."));
st.raw = true;
st.raw = false;
m = frame(m, false);
assert.equal(sideways(view(t, m, cx, st, { id: "kx-md", mod: "kt-x", doc })), 0, "code blocks wrap too");
st.raw = true;
console.log("markdown view: ok");
