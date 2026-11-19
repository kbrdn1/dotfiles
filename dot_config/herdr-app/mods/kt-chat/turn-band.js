// turn-band.js: which loaded turns the Chat draws whole (#59, the infinite scroll's lot 2). A band around the
// view; every other loaded turn is a box as tall as it was last measured, or as estimate() guesses before
// it ever was. The scroll area holds them all (its height and the child indices are the whole read's), so
// a jump, the scrollbar and the wheel's maths work on the whole read, and a render still describes only
// the band. Pure, no herdr: checked under bun (turn-band.check.mjs).
import { CAP } from "./turn-window.js";

export const OVER = 1; // views drawn whole above and below the view (the wheel never reaches a box)

/** Where each turn's row starts (`at`) and where the last ends: the head's row first, from `inset`. */
export function layout(head, heights, inset) {
  const at = [];
  let y = inset + head;
  for (const h of heights) {
    at.push(y);
    y += h;
  }
  return { at, end: y };
}

/**
 * The turns drawn whole for a view at `top`, `vh` tall: those meeting [top - over·vh, top + (1 + over)·vh),
 * at most `cap`, the ones around the view's middle kept. None meets it (the view past the rows): the last.
 */
export function band({ head, heights, inset, top, vh, cap = CAP, over = OVER }) {
  const n = heights.length;
  if (!n) return { from: 0, to: 0 };
  const { at } = layout(head, heights, inset);
  const lo = top - over * vh, hi = top + (1 + over) * vh;
  let from = -1, to = -1;
  for (let i = 0; i < n; i++) {
    if (at[i] + heights[i] > lo && at[i] < hi) {
      if (from < 0) from = i;
      to = i + 1;
    }
  }
  if (from < 0) return at[0] >= hi ? { from: 0, to: 1 } : { from: n - 1, to: n };
  if (to - from > cap) {
    const mid = top + vh / 2;
    let m = from;
    while (m + 1 < to && at[m + 1] <= mid) m++;
    from = Math.max(from, Math.min(to - cap, m - Math.floor(cap / 2)));
    to = from + cap;
  }
  return { from, to };
}

/** Following the bottom: from the last turn up, until the view and `over` more are filled, at most `cap`. */
export function bottomBand({ heights, vh, cap = CAP, over = OVER }) {
  const n = heights.length;
  let from = n, sum = 0;
  while (from > 0 && n - from < cap && sum < (1 + over) * vh) sum += heights[--from];
  return { from, to: n };
}

/**
 * A jump to turn `i`: the band starts at it (no turn above it changes height in that render, so its top is
 * exact), down until the view and `over` more are filled, at most `cap`. It grows upward afterwards.
 */
export function jumpBand({ heights, i, vh, cap = CAP, over = OVER }) {
  let to = i, sum = 0;
  while (to < heights.length && to - i < cap && sum < (1 + over) * vh) sum += heights[to++];
  return { from: i, to: Math.max(to, i + 1) };
}

/**
 * The scroll area's turn rows (main.js body()): each turn of the band [from, to) and within `near` of it
 * a row of its own (drawn whole, or a box), each run past that one spacer. [{ i } | { i, to }]: turn
 * i, or the run [i, to). 480 boxes cost ~25 ms a render (2026-11-19, scratchpad vscroll/bench3).
 */
export function rowPlan(n, from, to, near = CAP) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (i >= from - near && i < to + near) out.push({ i });
    else if (out.at(-1)?.to === i) out.at(-1).to = i + 1;
    else out.push({ i, to: i + 1 });
  }
  return out;
}

/** The cursor's turn `i` (j k, gg G): the band around its middle, as the view will be once it is revealed. */
export function aroundBand({ head, heights, inset, i, vh, cap = CAP, over = OVER }) {
  const { at } = layout(head, heights, inset);
  return band({ head, heights, inset, top: at[i] + heights[i] / 2 - vh / 2, vh, cap, over });
}

/**
 * A turn's height before it was ever drawn (design px), from what it says: its prompt's bubble (4 lines
 * at most, folded past), « … a travaillé » when it folds work, its answer's prose (`cols` characters a
 * line at 24 px, 12 above), the row under the answer, what is neither (a notice, a phase left open: 28 a
 * row). A guess the box takes until the first measure, which is compensated above the view.
 */
export function estimate(turn, { cols = 90 } = {}) {
  const lines = (s) => String(s ?? "").split("\n").reduce((k, l) => k + Math.max(1, Math.ceil(l.length / cols)), 0);
  const u = turn.user;
  let h = 8; // the turn's bottom padding
  if (u && !u.from) h += 4 + 16 + 20 * Math.min(4, lines(u.cmd ? u.cmd.name : u.text)) + 26;
  else if (u) h += 60; // a notice card from elsewhere
  const f = turn.fold;
  if (f) h += 36;
  (turn.items ?? []).forEach((it, n) => {
    if (f && n >= f.start && n <= f.end) return;
    if (it.type === "block" && it.block.role === "prose") h += 12 + 24 * lines(it.block.text);
    else h += 28;
  });
  if (!turn.live && (turn.blocks ?? []).some((b) => b.role === "prose" && b.text?.trim())) h += 38;
  return h;
}
