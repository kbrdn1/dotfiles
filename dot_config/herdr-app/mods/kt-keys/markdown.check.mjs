// bun ~/.config/herdr-app/mods/kt-keys/markdown.check.mjs: markdown.js' pure side (the cut: fences,
// alerts, HTML comments; the frontmatter as fields; parse; the hash; the soft wrap: rows, indent,
// colors cut at the same points, words longer than a row, surrogate pairs, rowCount = wrapLine; the
// fence's language and the fallback to plain mono; links), then its colors (one batch per render, the
// cache by content and mode, a failure kept as mono, nothing under checking) and its drawing (Aperçu,
// the paged Brut, the virtual-list Brut and its scroll, the columns from the width, the tabs). herdr and
// gpui mocked; exec stands for zed-tokens.ts.
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
      v_virtual_list: (...args) => { const x = el("list"); x.props.args = args; return x; },
      Scrollbar: { vertical: (id) => { const x = el("bar"); x.props.for = [id]; return x; } },
      VirtualListScrollHandle: { new: () => ({ calls: [], scroll_to_item(i, s) { this.calls.push(["item", i, s]); }, scroll_to_bottom() { this.calls.push(["bottom"]); } }) },
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
const { blocks, fields, parse, hash, wrapLine, wrapRows, rowCount, rowStarts, lineAt, colsFor, mdBudget, langFor, target, mdState, docOf, colorsOf,
  view, preview, rawList, rawScroll, tabs } = await import("./markdown.js");
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

// ---------- the soft wrap ----------
const R = "#ff0000", G = "#00ff00";
const rowText = (r) => r.runs.map((s) => s[0]).join("");
// Every row fits its columns (avail, or avail + 1 when the extra is the space it was cut after); the
// rows give back the line's text after its indent; nothing starts with half a surrogate pair.
function wellCut(runs, cols) {
  const text = runs.map((s) => s[0]).join("");
  const rows = wrapLine(runs, cols);
  const lead = text.length - text.trimStart().length;
  for (const r of rows) {
    const avail = Math.max(20, cols - r.pad);
    const s = rowText(r);
    assert.ok(s.length <= avail || (s.length === avail + 1 && s.endsWith(" ")), `row too long: ${JSON.stringify(s)} (${avail})`);
    const c = s.charCodeAt(0);
    assert.ok(!(c >= 0xdc00 && c <= 0xdfff), "half a surrogate pair");
    assert.equal(r.pad, Math.min(lead, Math.max(0, cols - 20)), "the indent on every row");
  }
  assert.equal(rows.map(rowText).join(""), text.trimStart(), "nothing lost");
  assert.equal(rowCount(text, cols), rows.length, "rowCount agrees");
  return rows;
}
assert.deepEqual(wrapLine([["short", R, 0]], 30), [{ pad: 0, runs: [["short", R, 0]] }]);
assert.deepEqual(wrapLine([], 30), [{ pad: 0, runs: [] }], "an empty line: one empty row");
// Cut after the last space that fits; a space at the column stays at the row's end.
assert.deepEqual(wellCut([["alpha beta gamma delta epsilon zeta eta theta", null, 0]], 20).map(rowText),
  ["alpha beta gamma ", "delta epsilon zeta ", "eta theta"]);
// A word longer than a row: cut at the column (défaut c).
assert.deepEqual(wellCut([["x".repeat(50), null, 0]], 20).map(rowText), ["x".repeat(20), "x".repeat(20), "x".repeat(10)]);
assert.deepEqual(wellCut([["see https://raw.githubusercontent.com/USER/main/banner.png", null, 0]], 24).map(rowText),
  ["see ", "https://raw.githubuserco", "ntent.com/USER/main/bann", "er.png"]);
// The indent: padding on every row, capped so a row keeps 20 columns of text.
const ind = wellCut([["    - item with quite a few words to wrap around the column", null, 0]], 30);
assert.ok(ind.length > 1 && ind.every((r) => r.pad === 4));
assert.equal(wellCut([[`${" ".repeat(30)}deep`, null, 0]], 24)[0].pad, 4);
// Colors cut at the same points, each character keeping its run's color and style.
const colored = [["  ", null, 0], ["- ", R, 0], ["**gras**", G, 2], [` ${"mot ".repeat(12)}fin`, R, 0]];
const cr = wellCut(colored, 24);
const colorAt = (runs) => runs.flatMap(([s, c, st]) => [...s].map(() => `${c}/${st}`));
assert.deepEqual(colorAt(cr.flatMap((r) => r.runs)), colorAt(colored).slice(2), "every character keeps its color");
assert.ok(cr.length > 2);
// Emoji (a surrogate pair each), never split.
wellCut([["😀".repeat(30), null, 0]], 21);
wellCut([["a😀b😀".repeat(15), R, 0]], 23);
// rowCount = wrapLine().length over many lines (a fixed pseudo-random draw).
let seed = 7;
const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2147483648) % n);
for (let k = 0; k < 400; k++) {
  const words = Array.from({ length: rnd(25) }, () => (rnd(10) === 0 ? "😀" : "w".repeat(1 + rnd(rnd(8) === 0 ? 40 : 9))));
  wellCut([[`${" ".repeat(rnd(12))}${words.join(rnd(5) === 0 ? "  " : " ")}`, R, 0]], 20 + rnd(60));
}
// wrapRows, rowStarts, lineAt, colsFor.
assert.equal(wrapRows([[["a", null, 0]], [["x".repeat(45), null, 0]]], 20).map((x) => x.length).join(), "1,3");
const st0 = rowStarts(["a", "x".repeat(45), "", "b"], 20);
assert.deepEqual(st0, [0, 1, 4, 5, 6]);
assert.deepEqual([0, 1, 3, 4, 5].map((v) => lineAt(st0, v)), [0, 1, 1, 2, 3]);
assert.equal(colsFor(28 + 7.2 * 40), 39);
assert.equal(colsFor(0), 20);

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
const nodes = (n) => find(n, () => true).length;
const sizeCx = () => { const c = { n: 0, notify: () => c.n++ }; return c; };
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
// A code block's columns: from its width (on_size_change), a render only when they change.
const blockEl = find(v, (x) => x.props.id?.[0] === "kx-md#2-code")[0];
const sc = sizeCx();
blockEl.on.on_size_change({ width: 28 + 7.2 * 41, height: 80 }, sc);
blockEl.on.on_size_change({ width: 28 + 7.2 * 41 + 3, height: 120 }, sc);
assert.equal(sc.n, 1, "one render for a change of columns, none for a pixel or a height");
// Paged Brut (view: a Brut inside a longer page): the switch fades it in; the skeleton while asked
// (asked only now), then the source, one row per line.
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
// Rows: one per wrapped row, never wrapping by themselves (nowrap), nothing scrolling sideways, the box
// as wide as its caller; a line of several colors as its runs side by side, its indent as padding.
const d3 = parse("  - **a** b\nplain");
st.colors.set(`dark:markdown:${d3.hash}`, [[["  - ", R, 0], ["**a**", G, 2], [" b", R, 0]], [["plain", R, 0]]]);
m = frame(m, false);
v = view(t, m, cx, st, { id: "kx-d3", mod: "kt-x", doc: d3 });
assert.equal(find(v, (x) => "overflow_x_scrollbar" in x.props).length, 0, "nothing scrolls sideways");
assert.ok("w_full" in v.props && "w_full" in v.kids[0].props, "as wide as the caller");
const row1 = find(v, (x) => x.kind === "h" && "whitespace_nowrap" in x.props)[0];
assert.deepEqual(row1.props.pl, [2 * 7.2], "its indent as padding");
assert.deepEqual(texts(row1), ["- ", "**a**", " b"]);
assert.ok(texts(v).includes("plain"));
// The paged Brut's budget: pages, each bounded (a render is interrupted past ~50 ms); every line once,
// ‹ › move between them.
const big = parse(Array.from({ length: 1400 }, (_, i) => `  - l${i} \`c\` **b** and some more words to wrap`).join("\n"));
st.colors.set(`dark:markdown:${big.hash}`, Array.from({ length: 1400 }, (_, i) => [["  - ", R, 0], [`l${i} `, G, 0], ["`c`", R, 0], [" ", G, 0], ["**b**", R, 2], [" and some more words to wrap", G, 0]]));
const seenLines = new Set();
let pages = 0, bv;
const click = (n, id) => find(n, (x) => x.props.id?.[0] === id)[0]?.on.on_click(null, { stop_propagation: () => {}, notify: () => {} });
for (;;) {
  m = frame(m, false);
  bv = view(t, m, cx, st, { id: "kx-big", mod: "kt-x", doc: big });
  pages++;
  assert.ok(nodes(bv) < 3000, `page ${pages} bounded: ${nodes(bv)} elements`);
  for (const s of texts(bv)) { const k = /^(?:- )?l(\d+) $/.exec(s); if (k) { assert.ok(!seenLines.has(k[1]), "a line on one page only"); seenLines.add(k[1]); } }
  assert.ok(texts(bv).some((s) => /^lignes \d+–\d+ sur 1400$/.test(s)), "the page says where it is");
  if (!find(bv, (x) => x.props.id?.[0] === "kx-big:nextt").length) break;
  click(bv, "kx-big:nextb");
  assert.ok(pages < 60);
}
assert.equal(seenLines.size, 1400, "every line, once");
assert.ok(pages > 1 && texts(bv).some((s) => /^lignes \d+–1400 sur 1400$/.test(s)), "the last page");
click(bv, "kx-big:prevt");
m = frame(m, false);
assert.ok(!texts(view(t, m, cx, st, { id: "kx-big", mod: "kt-x", doc: big })).some((s) => /^(?:- )?l1399 $/.test(s)), "‹ back a page");
// A one-color line costs a row: a page of short plain lines holds BUDGET (500) of them.
const plain = parse(Array.from({ length: 3000 }, (_, i) => `row ${i}`).join("\n"));
m = frame(m, false);
view(t, m, cx, st, { id: "kx-plain", mod: "kt-x", doc: plain }); // its colors asked
await settle();
m = frame(m, false);
assert.ok(texts(view(t, m, cx, st, { id: "kx-plain", mod: "kt-x", doc: plain })).includes("lignes 1–500 sur 3000"));
// One budget for a render's documents (mdBudget): what one spends, the next has not.
const shared = mdBudget();
m = frame(m, false);
view(t, m, cx, st, { id: "kx-s1", mod: "kt-x", doc: plain, budget: shared });
assert.ok(texts(view(t, m, cx, st, { id: "kx-s2", mod: "kt-x", doc: plain, budget: shared })).includes("lignes 1–1 sur 3000"), "the second gets what is left");
// Aperçu's code blocks: past the budget, plain (nothing hidden); past HARD (1000) rows a render, cut and
// said: Brut shows the rest, or (noRaw, a comment) not shown.
st.raw = false;
m = frame(m, false);
const block = (k) => parse("```\n" + Array.from({ length: k }, (_, i) => `x${i}`).join("\n") + "\n```");
const lv = view(t, m, cx, st, { id: "kx-long", mod: "kt-x", doc: block(900) });
assert.ok(texts(lv).includes("x899") && !texts(lv).some((s) => s.startsWith("…")), "900 rows: all drawn");
m = frame(m, false);
assert.ok(texts(view(t, m, cx, st, { id: "kx-long2", mod: "kt-x", doc: block(2000) })).includes("… 1000 lignes de plus : le Brut les montre (p)."));
assert.ok(texts(preview(t, cx, st, { id: "kx-c2", mod: "kt-x", doc: block(2000), noRaw: true })).includes("… 1000 lignes de plus, trop pour un seul affichage."));
// A long code line in Aperçu: cut into rows at the block's columns, a word longer than a row too.
const url = parse("```html\n    srcset=\"https://raw.githubusercontent.com/USER/USER/main/banner-light.png\">\n```");
m = frame(m, false);
const uv = view(t, m, cx, st, { id: "kx-url", mod: "kt-x", doc: url });
const cols0 = colsFor(st.lastW);
const urlRows = find(uv, (x) => "whitespace_nowrap" in x.props);
assert.ok(urlRows.length > 1 && urlRows.every((r) => texts(r).join("").length <= cols0 - 4 + 1), "every row fits");
assert.equal(urlRows.map((r) => texts(r).join("")).join(""), "srcset=\"https://raw.githubusercontent.com/USER/USER/main/banner-light.png\">");
st.raw = true;
console.log("markdown view: ok");

// ---------- rawList: Brut as a virtual list ----------
st = mdState();
const gdoc = parse(Array.from({ length: 300 }, (_, i) => (i % 3 ? `line ${i}` : `${"  ".repeat(i % 4)}- item ${i} ${"word ".repeat(30)}`)).join("\n"));
m = frame(motionState(), false);
let lv2 = rawList(t, m, cx, st, { id: "kx-list", mod: "kt-x", doc: gdoc });
assert.equal(find(lv2, (x) => x.props.id?.[0] === "kx-list:src~sk").length, 1, "the skeleton while its colors are asked");
await settle();
m = frame(m, false);
lv2 = rawList(t, m, cx, st, { id: "kx-list", mod: "kt-x", doc: gdoc });
const list = find(lv2, (x) => x.kind === "list")[0];
const [lid, count, size, key, render] = list.props.args;
const cols = colsFor(st.lastW);
const gsrc = gdoc.src.replace(/\n+$/, "").split("\n");
assert.equal(lid, "kx-list:list");
assert.equal(count, gsrc.reduce((s, l) => s + rowCount(l, cols), 0), "one item per row");
assert.equal(size, 19, "uniform rows of 19 px");
assert.equal(key(7), "7");
assert.ok(find(lv2, (x) => x.kind === "bar" && x.props.for[0] === "kx-list:list").length === 1, "its scrollbar");
assert.equal(list.props.track_scroll[0], st.scroll);
// The renderer builds the rows on screen only, from the line that holds the first one.
const got = render({ start: 40, end: 70 }, cx);
assert.equal(got.length, 30);
assert.deepEqual(st.range, { start: 40, end: 70 });
const all = wrapRows(gsrc.map((l) => [[l, "#ff0000", 0]]), cols).flat();
assert.deepEqual(got.map((r) => texts(r).join("")), all.slice(40, 70).map((r) => r.runs.map((s) => s[0]).join("") || " "));
assert.ok(got.every((r) => "whitespace_nowrap" in r.props && r.props.pr?.[0] === 14), "rows padded inside the box, never wrapping");
assert.ok(nodes(v_list_of(render({ start: 0, end: 50 }, cx))) < 200, "a screen of rows costs a screen of elements");
function v_list_of(rows) { const x = el("v"); x.kids.push(...rows); return x; }
// The scroll: a row, half the rows on screen, the top, the bottom, a row's number; a new document at its top.
// scroll_to_item only brings a row into view (the nearest edge, seen on screen): a move aims at the
// first row wholly off the screen, never at one of them (a row already shown moves nothing). The
// rendered range holds one row more on each side (OVER): 40 and 69 are off screen, 41 to 68 on it.
render({ start: 40, end: 70 }, cx);
st.scroll.calls.length = 0;
for (const how of ["down", "up", "half-down", "half-up", "bottom", "12", "top", "99999"]) rawScroll(st, how);
assert.deepEqual(st.scroll.calls, [["item", 69, "top"], ["item", 40, "top"], ["item", 82, "top"], ["item", 27, "top"], ["bottom"], ["item", 12, "top"], ["item", 0, "top"], ["item", count - 1, "top"]]);
for (const [how, at] of [["down", 69], ["up", 40], ["half-down", 82], ["half-up", 27]]) assert.ok(at < 41 || at > 68, `${how} aims off screen`);
// ctrl-e / ctrl-y: a row a press, each way (#43). A model of the list as measured on screen
// (2026-11-19): rows of 19 px, the rendered range = the rows on screen and one more on each side,
// scroll_to_item bringing a row to the nearest edge, the list a whole number of rows tall (rawList).
// Before: 3 rows a ctrl-e from the top, 2 a ctrl-y (seen on screen); here, 2 each way.
{
  const N = 400, R = 19, H = 43 * R;
  let off = 0;
  const range = () => ({ start: Math.max(0, Math.floor(off / R) - 1), end: Math.min(N, Math.ceil((off + H) / R) + 1) });
  const sim = { range: range(), total: N, scroll: { scroll_to_item(v) {
    if (v * R < off) off = v * R;
    else if ((v + 1) * R > off + H) off = (v + 1) * R - H;
    off = Math.max(0, Math.min(N * R - H, off));
  }, scroll_to_bottom() { off = N * R - H; } } };
  const press = (how) => { const was = off; rawScroll(sim, how); sim.range = range(); return off - was; };
  assert.equal(press("up"), 0, "at the top, ctrl-y stays");
  const moves = ["down", "down", "down", "up", "down", "up", "up", "up"].map(press);
  assert.deepEqual(moves, [R, R, R, -R, R, -R, -R, -R], "a row a press, from the top and after a change of way");
  const half = press("half-down");
  assert.ok(Math.abs(half - Math.floor(43 / 2) * R) <= R, `half-down: half the screen (${half} px)`);
  assert.ok(Math.abs(press("half-up") + half) <= R, "half-up: back about as far");
  press("bottom");
  assert.equal(press("down"), 0, "at the bottom, ctrl-e stays");
  assert.equal(press("up"), -R, "and ctrl-y goes back a row");
}
render({ start: 0, end: 30 }, cx);
st.scroll.calls.length = 0;
rawScroll(st, "up");
rawScroll(st, "half-up");
assert.deepEqual(st.scroll.calls, [["item", 0, "top"], ["item", 0, "top"]], "at the top: stays there");
m = frame(m, false);
rawList(t, m, cx, st, { id: "kx-other", mod: "kt-x", doc: plain });
assert.deepEqual(st.scroll.calls.at(-1), ["item", 0, "top"], "another document starts at its top");
// The columns follow the box: a narrower one, more rows (rowStarts cached per columns).
const area = (n) => find(n, (x) => x.props.id?.[0] === "kx-list:area")[0];
m = frame(m, false);
lv2 = rawList(t, m, cx, st, { id: "kx-list", mod: "kt-x", doc: gdoc });
const sc2 = sizeCx();
area(lv2).on.on_size_change({ width: 300, height: 500 }, sc2);
assert.equal(sc2.n, 1);
assert.equal(st.rows.get("kx-list"), 26, "the area's height in whole rows (500 / 19)");
area(lv2).on.on_size_change({ width: 300, height: 510 }, sc2);
assert.equal(sc2.n, 1, "a few pixels more, the same rows: no render");
m = frame(m, false);
const narrow = find(rawList(t, m, cx, st, { id: "kx-list", mod: "kt-x", doc: gdoc }), (x) => x.kind === "list")[0].props.args[1];
assert.ok(narrow > count, "narrower: more rows");
console.log("markdown list: ok");
