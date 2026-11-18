// bun ~/.config/herdr-app/mods/kt-keys/keyclick.check.mjs: no `.on_click` on an element that also
// holds a `.track_focus(...)`, in every kt-* and kbrdn-* mod (KEYMAP.md, Modales).
// Why: GPUI (gpui-pre, elements/div.rs, "Press enter, space to trigger click") turns Space and Enter
// into a click on the focused element when the key comes back up. The listener that arms it is
// registered before the mod's on_key_down on the same node, so a stop_propagation there doesn't help:
// a space typed into a vim field held by a veil closed the dialog. A veil closes on
// on_mouse_down("left", …) instead (its card already stops mouse_down).
//
// ponytail: a text scan, not a parser. It reads the element chain around each `.track_focus(`, the
// `.when(c, (el) => el…)` branches on it, and the element given to s.veil / s.card / enter. A chain
// built in two statements (`const r = div()…; r.on_click(…)`) escapes it.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

// Code only: comments, strings and regex literals become spaces (same length, so lines still count).
function codeOf(src) {
  const out = src.split("");
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " "; };
  let i = 0, prev = "";
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { const e = src.indexOf("\n", i); const j = e < 0 ? src.length : e; blank(i, j); i = j; continue; }
    if (c === "/" && n === "*") { const j = src.indexOf("*/", i + 2) + 2 || src.length; blank(i, j); i = j; continue; }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      blank(i + 1, j); i = j + 1; prev = c; continue;
    }
    if (c === "/" && (prev === "" || "(,=:[!&|?{};+".includes(prev))) {
      let j = i + 1, cls = false;
      while (j < src.length && (cls || src[j] !== "/") && src[j] !== "\n") {
        if (src[j] === "\\") j++;
        else if (src[j] === "[") cls = true;
        else if (src[j] === "]") cls = false;
        j++;
      }
      blank(i + 1, j); i = j + 1; prev = "/"; continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join("");
}

const OPEN = "([{", CLOSE = ")]}";
const close = (s, i) => { let d = 0; for (let j = i; j < s.length; j++) { if (OPEN.includes(s[j])) d++; else if (CLOSE.includes(s[j]) && --d === 0) return j; } return s.length; };

// The calls on the chain that starts at `from`: [{ name, at, args: [start, end] }].
function callsFrom(s, from) {
  const calls = [];
  for (let j = from; j < s.length;) {
    const c = s[j];
    if (OPEN.includes(c)) { j = close(s, j) + 1; continue; }
    if (CLOSE.includes(c) || c === ";" || c === ",") break;
    const m = c === "." && /^\.(\w+)\s*\(/.exec(s.slice(j, j + 80));
    if (m) { const o = j + m[0].length - 1, e = close(s, o); calls.push({ name: m[1], at: j, args: [o + 1, e] }); j = e + 1; continue; }
    j++;
  }
  return calls;
}

// Where the chain holding position i starts: after `=`, `=>`, `return`, `(`, `,`, `?`, `:` or `;`.
function chainStart(s, i) {
  for (let j = i - 1; j >= 0; j--) {
    const c = s[j];
    if (CLOSE.includes(c)) { let d = 0; for (; j >= 0; j--) { if (CLOSE.includes(s[j])) d++; else if (OPEN.includes(s[j]) && --d === 0) break; } continue; }
    if (OPEN.includes(c) || "=;,?:".includes(c)) return j + 1;
    if (/\breturn$/.test(s.slice(Math.max(0, j - 6), j + 1))) return j + 1;
  }
  return 0;
}

// Every call on the element: its own chain, its .when branches, and the element a wrapper returns.
function elementCalls(s, from, depth = 0) {
  if (depth > 6) return [];
  const calls = callsFrom(s, from);
  const more = [];
  for (const c of calls) {
    const body = s.slice(c.args[0], c.args[1]);
    if (c.name === "when") {
      const m = /,\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\b/.exec(body);
      if (m) more.push(...elementCalls(s, c.args[0] + m.index + m[0].length, depth + 1));
    } else if (["veil", "card"].includes(c.name)) more.push(...elementCalls(s, c.args[0] + body.search(/\S/), depth + 1));
  }
  // A wrapper call at the head (enter(m, el, …), fade(m, el, …)): the element is its second argument.
  const head = s.slice(from, calls[0]?.at ?? from).trim();
  const w = /^(enter|fade|pulse|ink)\s*\($/.exec(head.slice(0, head.indexOf("(") + 1));
  if (w) {
    const o = from + s.slice(from).indexOf("("), comma = s.slice(o, close(s, o)).search(/,/);
    if (comma > 0) more.push(...elementCalls(s, o + comma + 1 + s.slice(o + comma + 1).search(/\S/), depth + 1));
  }
  return [...calls, ...more];
}

// Lines where a focus-holding element also has on_click.
export function offenders(src) {
  const s = codeOf(src);
  const hits = [];
  for (let i = s.indexOf(".track_focus("); i >= 0; i = s.indexOf(".track_focus(", i + 1)) {
    if (elementCalls(s, chainStart(s, i)).some((c) => c.name === "on_click")) hits.push(s.slice(0, i).split("\n").length);
  }
  return hits;
}

// The scan itself.
const bad = [
  `return div().on_click((_e, cx) => this.dismiss(cx)).track_focus(this.handle);`,
  `return div().track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx)).on_click(() => go());`,
  `return s.veil(div().id("v").on_click(() => close())).track_focus(this.handle);`,
  `const r = div().when(full, (el) => el.bg(veil()).when(!danger, (el) => el.on_click(() => close()))).track_focus(h);`,
  `return enter(m, v_flex().on_click(() => x()), "id", { dy: 0 }).track_focus(this.handle);`,
  `return div() // a comment; with ( and ,\n  .on_click(() => x())\n  .track_focus(h);`,
];
const good = [
  `return div().on_mouse_down("left", (_e, cx) => this.dismiss(cx)).track_focus(this.handle).child(card);`,
  `return div().track_focus(h).child(div().id("x").on_click(() => x()));`,
  `return div().track_focus(h).when(a, (el) => el.child(div().on_click(() => x())));`,
  `const re = /[(;"]/; return div().track_focus(h).child(div().on_click(() => "a ; ( ,"));`,
];
for (const src of bad) assert.equal(offenders(src).length, 1, `missed: ${src}`);
for (const src of good) assert.deepEqual(offenders(src), [], `false alarm: ${src}`);

// Every kt-* and kbrdn-* mod.
const mods = join(dirname(fileURLToPath(import.meta.url)), "..");
const found = [];
for (const mod of readdirSync(mods).filter((m) => /^(kt|kbrdn)-/.test(m)).sort()) {
  const dir = join(mods, mod);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".js")).sort()) {
    for (const line of offenders(readFileSync(join(dir, f), "utf8"))) found.push(`${mod}/${f}:${line}`);
  }
}
if (found.length) {
  console.log(`keyclick: on_click on an element holding track_focus (Space and Enter would click it):\n  ${found.join("\n  ")}`);
  process.exit(1);
}
console.log("keyclick: ok");
