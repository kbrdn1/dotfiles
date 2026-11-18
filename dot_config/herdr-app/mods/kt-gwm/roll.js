// roll.js: numbers whose digits roll (RollingNumber.vue, components.css .reel). Written once in
// mods/kt-keys/roll.js and copied byte for byte into each mod that uses it (edit here, copy, cmp). Bun
// checks it (roll.check.mjs). No herdr import, no module state.
//
// Each digit is a column 0..9 in a window one line high that clips; a new value slides the column
// (transition on top) to its digit, 240 ms ease-out. Anything else (%, $, ., k, a thin space) stays put.
// The reels are keyed from the right, so the units keep their reel when the number grows; a reel that
// is new (one more digit) shows at once, and the width changes at once. Nothing at mount: gpui never
// animates a first render. Reduced motion: no transition, the digit changes at once. 12 elements a
// digit, and nothing runs once the column has landed.
// `snap`: the last `snap` characters change at once, drawn on the same line: a cost's cents, which
// change at every reading, would otherwise keep rolling (ANIMATIONS.md: no motion that never stops).
//
//   roll(m, "kc-ctx", "42%", 16).font_family(MONO).text_size(11).text_color(t.muted)
//   roll(m, "kc-cost", "$1118.15", 16, { snap: 2 })   // the dollars roll, the cents don't
//
// `m` is motion.js's state (or any { reduced }). `h`: the line's exact height in px, the same for every
// line (a monospace font keeps the reels lined up). Font, size and color go on what roll() returns:
// they reach the digits. `id` is unique in the view.

import { div } from "gpui-kit";

const DIGITS = "0123456789".split("");

export function roll(m, id, text, h, { ms = 240, snap = 0 } = {}) {
  const s = String(text);
  const line = (c) => div().flex_none().h(h).line_height(`${h}px`).child(c);
  return div().flex().flex_none().items_start().h(h).children([...s].map((c, i) => {
    if (c < "0" || c > "9" || i >= s.length - snap) return line(c);
    let strip = div().id(`${id}:${s.length - i}`).relative().top(-Number(c) * h).flex().flex_col().children(DIGITS.map(line));
    if (!m.reduced) strip = strip.transition("top", { duration: ms, easing: "ease-out" });
    return div().flex_none().h(h).overflow_hidden().child(strip);
  }));
}

// rollText: a line of words with numbers in it ("62 mods · 38 kbrdn · lu à 14:32"). roll() keys its reels
// from the right of the whole text, so a tail that changes length (" · 1 alerte" coming) would hand the
// reels to other digits; here each run of digits is a roll() of its own, keyed by its rank among the
// runs that roll (`${id}-${k}`). Stays text: a run touching ":" (a time) or after "#" (an issue, a PR).
// The root can shrink (min_w 0) and clips: in a narrow row its last words truncate and end in "…", the
// numbers and the words before them stay whole. A root made flex_none never shrinks.
//
//   rollText(m, "km-head", "62 mods · 38 kbrdn · lu à 14:32", 14).font_family(MONO).text_size(10.5)
export function rollText(m, id, text, h, { ms = 240 } = {}) {
  const s = String(text);
  const parts = [];
  let k = 0;
  let last = 0;
  for (const x of s.matchAll(/\d+/g)) {
    const end = x.index + x[0].length;
    if (s[x.index - 1] === ":" || s[end] === ":" || s[x.index - 1] === "#") continue;
    if (x.index > last) parts.push(s.slice(last, x.index));
    parts.push(roll(m, `${id}-${k++}`, x[0], h, { ms }));
    last = end;
  }
  if (last < s.length) parts.push(s.slice(last));
  let cut = -1;
  parts.forEach((p, i) => { if (typeof p === "string") cut = i; });
  const line = (el) => el.h(h).line_height(`${h}px`);
  return div().flex().items_start().min_w(0).overflow_hidden().h(h).children(parts.map((p, i) => (typeof p !== "string" ? p
    : i === cut ? line(div().min_w(0).truncate()).child(p) : line(div().flex_none().whitespace_nowrap()).child(p))));
}
