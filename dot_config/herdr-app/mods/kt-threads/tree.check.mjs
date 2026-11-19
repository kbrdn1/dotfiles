// bun ~/.config/herdr-app/mods/kt-threads/tree.check.mjs: tree.js (#90), the branches' geometry. A branch
// is two boxes: the trunk going on below (none on the last), then the trunk down to the bend and the bend
// as one rounded box, drawn last; its bend at the middle of the row's first line; `reach` past the row's
// edges. hang() puts them on the child itself (no wrapper), 2·x in; stem() starts a trunk under an icon.
// gpui-kit and herdr mocked. Not loaded by Herdr; herdr-app check does the layout.
import assert from "node:assert/strict";
import { plugin } from "bun";

const el = (kind) => {
  const node = { kind, kids: [], props: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "children") target.kids.push(...a[0]);
        else if (k === "when") return a[0] ? a[1](p) : p;
        else target.props[k] = a.length > 1 ? a : a[0] ?? true;
        return p;
      };
    },
  });
  return p;
};
plugin({
  setup(build) {
    build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el("div") } }));
    build.module("herdr", () => ({ loader: "object", exports: { settings: () => ({ dark: true }) } }));
  },
});
const { twig, hang, stem, treeLine } = await import("./tree.js");

const t = { foreground: "#eeeeef" };
const C = "#c79bffaa", R = "#eeeeef38";
// A box's vertical span in its row, from its top / height / bottom (bottom as a distance from the row's end).
const span = (b, H) => [b.props.top + 0, b.props.h != null ? b.props.top + b.props.h : H - b.props.bottom]; // + 0: -0 (top(-reach), reach 0) reads 0

// ── twig: a row of 28, x 10 ─────────────────────────────────────────────────
const w = twig(t, { h: 28, x: 10, last: false, color: C, rest: R });
assert.equal(w.props.w, 20, "2·x wide");
assert.equal(w.kids.length, 2, "two boxes: the trunk below, the bend");
const [below, bend] = w.kids;
assert.deepEqual(span(below, 28), [10, 28], "the trunk below from 4 above the middle to the row's end");
assert.equal(below.props.border_color, R, "at rest");
assert.deepEqual(span(bend, 28), [0, 15], "the trunk down to the bend, the bend's bottom 1 past the middle");
assert.equal(bend.props.left, 10);
assert.equal(bend.props.w, 10, "the bend reaches x further: the column's right edge");
assert.equal(bend.props.rounded_bl, 8, "the ╰: 8 px");
assert.equal(bend.props.border_color, C, "the bend and the trunk to it in the branch's color");
assert.equal(bend.props.border_l, 1);
assert.equal(bend.props.border_b, 1);

// The last: no trunk below, the bend only.
const l = twig(t, { h: 28, x: 10, last: true, color: C, rest: R });
assert.equal(l.kids.length, 1, "the last child ends the trunk at its bend");
assert.deepEqual(span(l.kids[0], 28), [0, 15]);

// reach: past the row's edges, both ways.
const r = twig(t, { h: 32, x: 7, last: false, color: C, rest: R, reach: 1 });
assert.equal(r.kids[0].props.bottom, -1, "the trunk below reaches 1 past the row's end");
assert.equal(r.kids[1].props.top, -1, "the trunk to the bend reaches 1 above the row");
assert.equal(r.kids[1].props.h, 18, "to 1 past the middle of 32, from 1 above");

// ── hang: the child itself, 2·x in, its first line's middle ─────────────────
const row = el("h_flex");
const out = hang(t, row, { h: 20, last: false });
assert.equal(out, row, "no wrapper: the child holds its branch");
assert.equal(row.props.pl, 22, "x 11 by default: 22 in");
assert.equal(row.props.relative, true, "the pieces are placed in the child's box");
assert.equal(row.kids.length, 2);
assert.deepEqual(span(row.kids[1], 60), [0, 11], "the bend at the middle of a 20 px first line, whatever the child's height");
assert.equal(row.kids[1].props.border_color, R, "no color: at rest");
const failed = hang(t, el("v_flex"), { last: true, color: C });
assert.equal(failed.kids.length, 1, "the last: the bend only");
assert.equal(failed.kids[0].props.border_color, C);
assert.deepEqual(span(failed.kids[0], 28), [0, 15], "h 28 by default");

// ── stem and treeLine ───────────────────────────────────────────────────────
const s = stem(R, { top: 23 });
assert.deepEqual([s.props.left, s.props.top, s.props.bottom, s.props.border_l], [11, 23, 0, 1], "from the icon's bottom to its row's end, at x 11");
assert.equal(treeLine(t), "#eeeeef38", "dark: the foreground at 0x38");

console.log("tree.check: ok");
