// bun ~/.config/herdr-app/mods/kt-keys/filters.check.mjs: filters.js's tints, alphas, keys, scroll
// estimate and reveal, then one filterRow driven through measuring, revealing and fading, with
// gpui-kit and gpui-base mocked (not a layout check: herdr-app check does that). Not loaded by Herdr.
import assert from "node:assert/strict";
import { plugin } from "bun";

// A mock element: records its builder calls, children and handlers.
const el = (kind) => {
  const node = { kind, kids: [], props: {}, on: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "children") target.kids.push(...a[0]);
        else if (k === "when") return a[0] ? a[1](p) : p;
        else if (k.startsWith("on_")) target.on[k] = a.at(-1);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
let revealed = [];
plugin({
  setup(build) {
    const path = { move_to: () => path, line_to: () => path, close: () => path, build: () => "rect" };
    build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el("div"), PathBuilder: { fill: () => path }, Background: { linear_gradient: (...a) => ({ gradient: a }) } } }));
    build.module("gpui-base", () => ({ loader: "object", exports: { h_flex: () => el("h"), ScrollHandle: { new: () => ({ scroll_to_item: (i) => revealed.push(i) }) } } }));
  },
});
globalThis.window = { paint_path: (_p, bg) => el("gradient").bg(bg) };
const F = await import("./filters.js");

const t = { background: "#191919", accent: "#ff8800", border: "#333333", input: "#444444", raised: "#222222", hover: "#2a2a2a",
  foreground: "#eeeeee", muted: "#aaaaaa", dim: "#777777", ansi2: "#00aa00", ansi4: "#0055ff", done: "#11cc11" };

// Tints: a theme name, a #hex, or none (neutral); a key's automatic tint never changes.
assert.equal(F.tintColor("ansi2", t), "#00aa00");
assert.equal(F.tintColor("#abcdef", t), "#abcdef");
assert.equal(F.tintColor(null, t), null);
assert.equal(F.tintColor("nope", t), null);
assert.equal(F.tintFor("claude"), F.tintFor("claude"));
assert.ok(F.TINTS.includes(F.tintFor("codex")));
assert.ok(!F.TINTS.includes("ansi1"), "red stays for danger");
assert.ok(new Set(["claude", "codex", "cursor", "opencode", "pi", "gemini"].map(F.tintFor)).size > 1);

// Light themes get stronger alphas, every one of them.
assert.equal(F.isLight(t), false);
assert.equal(F.isLight({ background: "#fafaf9" }), true);
assert.equal(F.isLight({ background: "#191919d9" }), false, "glass is dark");
const [dark, light] = [F.alphas(false), F.alphas(true)];
for (const k of ["off", "hover", "on", "border"]) assert.ok(parseInt(light[k], 16) > parseInt(dark[k], 16), k);
assert.deepEqual(dark, { off: "14", hover: "24", on: "33", border: "66" });

// Active: one key, several, or none.
assert.deepEqual([...F.activeSet("pr")], ["pr"]);
assert.deepEqual([...F.activeSet(["a", null, "b"])], ["a", "b"]);
assert.equal(F.activeSet(null).size, 0);

// [ ] / tab: the next and previous filter, round.
const items = [{ key: "all" }, { key: "pr" }, { key: "issue" }];
assert.equal(F.nextKey(items, "all", 1), "pr");
assert.equal(F.nextKey(items, "issue", 1), "all");
assert.equal(F.nextKey(items, "all", -1), "issue");
assert.equal(F.nextKey(items, "gone", 1), "all");
assert.equal(F.nextKey(items, "gone", -1), "issue");
assert.equal(F.nextKey([], "x", 1), null);

// Geometry: 3 pills of 50, 80, 60 with a 6 px gap in a 100 px row.
const w = [50, 80, 60];
assert.deepEqual(F.edgesOf(w), [[0, 50], [56, 136], [142, 202]]);
assert.equal(F.maxScroll(w, 100), 102);
assert.equal(F.maxScroll(w, 400), 0);
// Reveal: the least move, as scroll_to_item; a visible pill stays put; clamped.
assert.equal(F.reveal(w, 1, 0, 100), 36, "the second pill's right edge comes in");
assert.equal(F.reveal(w, 2, 0, 100), 102, "the last one: to the end");
assert.equal(F.reveal(w, 0, 102, 100), 0, "back to the first");
assert.equal(F.reveal(w, 1, 40, 100), 40, "already visible");
assert.equal(F.reveal(w, 5, 40, 100), 40, "no such pill");
// Wheel: content follows the delta (a swipe left scrolls right); a vertical wheel scrolls too.
assert.equal(F.wheel(0, -30, 0, 102), 30);
assert.equal(F.wheel(30, 0, 50, 102), 0);
assert.equal(F.wheel(90, -40, 0, 102), 102);
// Fades: only on a cut edge.
assert.deepEqual(F.fades(w, 0, 400), { left: false, right: false });
assert.deepEqual(F.fades(w, 0, 100), { left: false, right: true });
assert.deepEqual(F.fades(w, 50, 100), { left: true, right: true });
assert.deepEqual(F.fades(w, 102, 100), { left: true, right: false });

// One row, rendered as a mod would: first unmeasured (nothing revealed), then measured.
const state = F.filterState();
const row = { id: "r", state, t, items: [{ key: "all", label: "Tout" }, { key: "pr", label: "PR", count: 4, tint: "ansi2" }, { key: "issue", label: "Issues", tint: "ansi4", group: "rel" }] };
const cx = { notified: 0, notify() { this.notified++; } };
const pick = [];
let r = F.filterRow({ ...row, active: "issue", onPick: (k) => pick.push(k) });
assert.deepEqual(revealed, [], "nothing measured yet: nothing revealed");
const scroll = r.kids[0];
assert.equal(scroll.props.overflow_x_scroll.length, 0);
assert.equal(scroll.kids.length, 3, "one direct child per pill (scroll_to_item counts them)");
scroll.on.on_size_change({ width: 100, height: 26 }, cx);
scroll.kids.forEach((k, i) => k.on.on_size_change({ width: w[i], height: 26 }, cx));
assert.equal(cx.notified, 4);
scroll.kids[0].on.on_size_change({ width: 50, height: 26 }, cx);
assert.equal(cx.notified, 4, "an unchanged size doesn't redraw");
r = F.filterRow({ ...row, active: "issue" });
assert.deepEqual(revealed, [3], "the active pill comes into view (the ink, first, moves indices by one)");
assert.equal(state.s, 102);
assert.equal(r.kids.length, 2, "the row and its left fade");
assert.equal(r.kids[1].props.left[0], 0);
// The ink: under the pills, on the active one (past its group's rule: 142 + 7), gliding.
let ink = r.kids[0].kids[0];
assert.equal(ink.props.id[0], "r-ink-rel");
assert.deepEqual([ink.props.left[0], ink.props.w[0]], [149, 53]);
assert.equal(ink.props.bg[0], "#0055ff33");
assert.equal(ink.props.transition[1].duration, 240);
r = F.filterRow({ ...row, active: "issue" });
assert.deepEqual(revealed, [3], "once per change");
r = F.filterRow({ ...row, active: "all" });
assert.deepEqual(revealed, [3, 1]);
assert.equal(state.s, 0);
assert.equal(r.kids[1].props.right[0], 0, "back at the start: the right fade");
ink = r.kids[0].kids[0];
assert.deepEqual([ink.props.left[0], ink.props.w[0], ink.props.bg[0], ink.props.border_color[0]], [0, 50, t.hover, t.input], "the neutral ink");
// Styles: the pill under the ink clear, a tinted pill off; the rule before a new group.
const [, all, pr, issueWrap] = r.kids[0].kids;
assert.equal(all.props.bg[0], "#33333300");
assert.equal(all.props.text_color[0], t.foreground);
assert.equal(pr.props.bg[0], "#00aa0014");
assert.equal(pr.props.text_color[0], t.muted);
assert.equal(issueWrap.kids.length, 2, "rule + pill");
// The count rolls (roll.js): one reel per digit, keyed by the row, the scope and the key; jumps when reduced.
const reel = (pill) => pill.kids.at(-1).kids[0].kids[0];
assert.deepEqual([reel(pr).props.id[0], reel(pr).props.top[0], reel(pr).props.transition?.[1]?.duration], ["r-n--pr:1", -4 * 14, 240]);
assert.equal(pr.kids.at(-1).props.font_family[0], "Monaspace Krypton");
const scoped = F.filterRow({ ...row, active: "all", scope: "repo", reduced: true }).kids[0].kids[2];
assert.deepEqual([reel(scoped).props.id[0], reel(scoped).props.transition], ["r-n-repo-pr:1", undefined]);
// Several on: no ink, each pill its own fill; the cursor's ring.
// One ink per group with one pill on; none where two are on.
assert.deepEqual(F.inkIndices(row.items, F.activeSet(["pr", "issue"])), [1, 2]);
assert.deepEqual(F.inkIndices(row.items, F.activeSet(["all", "pr"])), []);
assert.deepEqual(F.inkIndices(row.items, F.activeSet(["all", "pr", "issue"])), [2]);
r = F.filterRow({ ...row, active: ["pr", "issue"] });
assert.equal(r.kids[0].kids.length, 5, "two groups, two inks");
r = F.filterRow({ ...row, active: ["all", "pr"], cursor: "pr" });
assert.equal(r.kids[0].kids.length, 3, "no ink with two on in a group");
const pr2 = r.kids[0].kids[1];
assert.equal(pr2.props.bg[0], "#00aa0033");
assert.equal(pr2.props.border_color[0], "#ff880099", "the keys' ring wins over the active border");
r = F.filterRow({ ...row, active: ["all", "pr"] });
assert.equal(r.kids[0].kids[1].props.border_color[0], "#00aa0066");
// Reduced motion: the ink jumps.
r = F.filterRow({ ...row, active: "pr", reduced: true });
assert.equal(r.kids[0].kids[0].props.transition[1].duration, 0);
// A click picks and redraws.
r.kids[0].kids[2].on.on_click({}, cx);
assert.deepEqual(pick, [], "no onPick given on this render");
r = F.filterRow({ ...row, active: "pr", onPick: (k) => pick.push(k) });
r.kids[0].kids[3].kids[1].on.on_click({}, cx);
assert.deepEqual(pick, ["issue"]);
// The wheel moves the estimate, clamped.
state.s = 0;
r.kids[0].on.on_scroll_wheel({ delta: { x: -40, y: 0 } }, cx);
assert.equal(state.s, 40);
r.kids[0].on.on_scroll_wheel({ delta_lines: { x: 0, y: -10 } }, cx);
assert.equal(state.s, 102);

console.log("filters.js: ok");
