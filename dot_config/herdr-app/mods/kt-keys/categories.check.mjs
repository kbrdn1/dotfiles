// bun ~/.config/herdr-app/mods/kt-keys/categories.check.mjs: categories.js (the color code of #81: one
// hue, one meaning, measured on the real kbrdn themes), its classify() and pieceChip(), and workflows.js'
// invariants. gpui-kit and gpui-base are mocked (not a layout check: herdr-app check does that).
import assert from "node:assert/strict";
import { plugin } from "bun";
import { readFileSync } from "node:fs";

// A mock element: records its builder calls and children.
const el = (kind, arg) => {
  const node = { kind, arg, kids: [], props: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "when") return a[0] ? a[1](p) : p;
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
plugin({
  setup(build) {
    build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el("div"), svg: (path) => el("svg", path) } }));
    build.module("gpui-base", () => ({ loader: "object", exports: { h_flex: () => el("h") } }));
  },
});
const { CATEGORIES, ORDER, classify, tintOf, colorOf, iconOf, pieceChip } = await import("./categories.js");
const { REFS, STEPS, BRANCHES, WORKFLOWS, refOf, isWorkflow } = await import("./workflows.js");

// ── classify ────────────────────────────────────────────────────────────────
const cases = [
  ["/me:issue-worktree-pr", "workflow"], ["me:goal", "workflow"], ["me:report", "workflow"], ["spec-git-flow-worktree", "workflow"],
  ["/me:loop:ci-until-green", "loop"], ["me:run-loop", "loop"], ["me:create-loop", "loop"], ["loop", "loop"],
  ["schedule", "automation"], ["herdr-automations", "automation"],
  ["mcp__context7__query-docs", "mcp"], ["/mcp__github__list_prs", "mcp"],
  ["commit", "skill"], ["me:design-export", "skill"], ["frontend-design:frontend-design", "skill"], ["", "skill"],
];
for (const [name, cat] of cases) assert.equal(classify(name), cat, name);
assert.equal(classify("compact", { builtin: true }), "builtin");
assert.equal(classify("loop", { builtin: true }), "loop", "a built-in loop is still a loop");
assert.equal(classify("mcp__x__y", { builtin: true }), "mcp");

// ── one hue, one meaning ────────────────────────────────────────────────────
const FIVE = ["workflow", "skill", "mcp", "loop", "automation"];
const hues = FIVE.map(tintOf);
assert.equal(new Set(hues).size, 5, "five distinct hues");
for (const h of hues) assert.ok(!["done", "blocked", "working", "idle", "unknown", "ansi1", "ansi2"].includes(h), `${h}: a state's color`);
for (const k of Object.keys(CATEGORIES)) if (!FIVE.includes(k)) assert.equal(tintOf(k), null, `${k} is neutral`);
assert.equal(tintOf("nope"), null);
assert.deepEqual([...ORDER].sort(), ["automation", "builtin", "file", "loop", "mcp", "skill", "workflow"]);

// The real themes: ansiN is ansi[N]; the panel colors are "colors".
const themeOf = (file) => {
  const j = JSON.parse(readFileSync(new URL(`../../themes/${file}`, import.meta.url), "utf8"));
  const t = { ...j.colors, background: j.background, foreground: j.foreground };
  j.ansi.forEach((c, i) => { t[`ansi${i}`] = c; });
  return t;
};
const dark = themeOf("kbrdn-dark.json");
const light = themeOf("kbrdn-light.json");
assert.equal(light.ansi2.toLowerCase(), light.done.toLowerCase(), "why ansi2 is out: it is done's color in light");
for (const t of [dark, light]) {
  const states = new Set([t.done, t.blocked].map((c) => c.toLowerCase()));
  for (const k of FIVE) assert.ok(!states.has(colorOf(t, k).toLowerCase()), `${k} shares a state's color`);
  assert.equal(colorOf(t, "file"), t.muted);
}

// Contrast on the chip (WCAG): the label's color over alpha(hue, "24"|"1f") on the background.
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => {
  const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const over = (fg, bg, a) => `#${rgb(fg).map((v, i) => Math.round(a * v + (1 - a) * rgb(bg)[i]).toString(16).padStart(2, "0")).join("")}`;
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const k of FIVE) {
  const d = colorOf(dark, k);
  assert.ok(ratio(d, over(d, dark.background, 0x24 / 255)) >= 4.5, `dark ${k}: hue label on its chip`);
  const l = colorOf(light, k);
  assert.ok(ratio(light.foreground, over(l, light.background, 0x1f / 255)) >= 4.5, `light ${k}: foreground label on its chip`);
}

// ── pieceChip ───────────────────────────────────────────────────────────────
const t = { ...dark, border: "#333333" };
const chip = pieceChip(t, { kind: "command", category: "workflow", label: "/me:goal" }, { dark: true });
assert.deepEqual(chip.props.border_color, [`${dark.ansi3}66`]);
assert.deepEqual(chip.props.bg, [`${dark.ansi3}24`]);
const [icon, label] = chip.kids;
assert.equal(icon.arg, "mods/kt-threads/workflow.svg");
assert.deepEqual(icon.props.text_color, [dark.ansi3]);
assert.deepEqual(label.props.text_color, [dark.ansi3], "dark: the label takes the hue");
assert.deepEqual(label.props.font_family, ["Monaspace Krypton"]);
assert.deepEqual(label.kids, ["/me:goal"]);
const lchip = pieceChip({ ...light, border: "#dddddd" }, { kind: "mcp-tool", category: "mcp", label: "context7 › query-docs" }, { dark: false });
assert.deepEqual(lchip.props.bg, [`${light.accent}1f`]);
assert.deepEqual(lchip.kids[1].props.text_color, [light.foreground], "light: the label stays foreground");
const file = pieceChip(t, { kind: "file", category: "file", label: "main.js" });
assert.deepEqual(file.props.border_color, ["#333333"], "neutral: the theme's border");
assert.deepEqual(file.kids[0].props.text_color, [dark.muted]);
assert.equal(file.kids[1].props.font_family, undefined, "a file name isn't mono");
assert.equal(iconOf({ kind: "image", category: "file" }), "mods/kt-chat/image.svg");
assert.equal(iconOf({ kind: "file", category: "nope" }), "mods/kt-threads/file.svg");

// Every icon exists.
for (const p of [...Object.values(CATEGORIES).map((c) => c.icon), "mods/kt-chat/image.svg"])
  assert.ok(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").includes("<svg"), p);

// ── workflows.js ────────────────────────────────────────────────────────────
for (const w of WORKFLOWS) assert.ok(REFS[w], `${w} has its refs`);
for (const s of [...STEPS, ...BRANCHES]) {
  if (s.ref) assert.ok(refOf(s.ref), `${s.id}: ${s.ref}`);
  if (s.alt) assert.ok(refOf(s.alt.ref), `${s.id}: ${s.alt.ref}`);
}
assert.equal(new Set([...STEPS, ...BRANCHES].map((s) => s.id)).size, STEPS.length + BRANCHES.length, "unique ids");
assert.equal(STEPS.length, 8, "the rail draws one bead per step");
assert.ok(isWorkflow("/me:issue-worktree-pr") && isWorkflow("me:check-reviews") && isWorkflow("spec-git-flow-branch"));
assert.ok(!isWorkflow("me:loop:ci-until-green") && !isWorkflow("gwm") && !isWorkflow("me:design-export") && !isWorkflow(null));

console.log("kt-keys categories: ok");
