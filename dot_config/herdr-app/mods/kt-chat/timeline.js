// timeline.js: the Chat's timeline (#85), Monocode's prompt outline (github.com/hardbeat920/monocode,
// MIT, crates/monocode-gpui/src/transcript/outline.rs): a bar per message Kylian typed, on the right
// edge of the transcript; the one on screen lit, a card with its first line on hover, a click (or
// [ ]) brings it to the top of the view. Pure, no herdr: checked under bun (timeline.check.mjs).
//
// No scroll offset is exposed (gpui-kit.d.ts ScrollHandle: scroll_to_item only, the smallest scroll):
// where each turn is comes from the heights its row reports (on_size_change), the offset from a wheel
// event (the pointer's place in the row under it and in the view), and a jump puts a transient anchor
// a view tall at the turn's top, which that smallest scroll brings to the top whichever way it goes.

export const TL = {
  MIN: 2, // MIN_PROMPTS (outline.rs:14): fewer messages, no rail
  BAR_H: 2, BAR_W: 11, BAR_LIFT: 24, // :15-17, a bar's height, its width at rest and lifted
  IDLE: 0.15, LIT: 0.85, // :18-19, its ink at rest and lit
  STEP: 18, MS: 200, // :20-21, the ripple's beat and the transition (ease-out: bezier(0, 0, .58, 1), :43)
  GAP: 10, GAP_MIN: 1, STACK_MAX: 330, SHARE: 0.75, // :22-25, the gap shrinks before the stack slides
  MIN_W: 928, NEAR_END: 16, RIPPLE: 2, // :27-30, the pane width under which it hides; the bottom's slack
  RIGHT: 16, // :328, from the transcript's right edge
  OPEN: 25, CARD_W: 288, CARD_PAD: 12, CARD_GAP: 10, // :12-13, :297-304, the card waits out a pass-through
  CARD_LINE: 19.25, CARD_COLS: 34, // :290-293, 14 px text, two lines (its 262 px hold ~34 characters of Inter)
};

/** A message's first non-empty line, its spaces collapsed (prompt_label, outline.rs:378-384); "" when none. */
export function label(text) {
  for (const line of String(text ?? "").split("\n")) {
    const s = line.trim().split(/\s+/).join(" ");
    if (s) return s;
  }
  return "";
}

/**
 * The messages Kylian typed, in order: a turn's prompt (not another agent's message, a task's notice
 * or a line the harness injected: `from` or `meta`), its / and ! commands, then what he sent while the
 * agent worked (a note without `from`). Each: { i: its turn, turn: its id, id, text, images, note }.
 * A note has no place of its own in the scroll area: its jump goes to its turn's top.
 */
export function marks(turns) {
  const out = [];
  turns.forEach((t, i) => {
    const u = t.user;
    if (u && !u.from && !u.meta) {
      const text = u.cmd ? [u.cmd.name, u.cmd.args].filter(Boolean).join(" ") : u.text;
      out.push({ i, turn: t.id, id: t.id, text: label(text), images: u.images ?? 0, note: false });
    }
    for (const b of t.blocks ?? []) {
      if (b.role === "note" && !b.from && b.text?.trim()) out.push({ i, turn: t.id, id: b.id, text: label(b.text), images: 0, note: true });
    }
  });
  return out;
}

/** At most `max` bars: the window slides to keep the active one inside, the newest preferred (bar_window, :386-395). */
export function barWindow(count, active, max) {
  if (count <= max) return [0, count];
  const newest = count - max;
  const start = active == null || active < 0 ? newest : Math.min(active, newest);
  return [start, start + max];
}

/** One bar per message while they fit `budget` px, the gap shrinking first; past that, a window (bar_stack, :397-411). */
export function barStack(count, active, budget) {
  const fit = Math.max(1, Math.floor((budget + TL.GAP_MIN) / (TL.BAR_H + TL.GAP_MIN)));
  const [start, end] = barWindow(count, active, fit);
  const shown = end - start;
  const gap = shown > 1 ? Math.min(TL.GAP, Math.max(TL.GAP_MIN, Math.floor((budget - shown * TL.BAR_H) / (shown - 1)))) : 0;
  return { start, end, gap };
}

/** The dock's lift: 1 on the hovered bar, tapering to 0 past the ripple (bar_lift, :413-423). */
export function barLift(index, hover) {
  if (hover == null || hover < 0) return 0;
  const d = Math.abs(index - hover);
  return d > TL.RIPPLE ? 0 : (TL.RIPPLE + 1 - d) / (TL.RIPPLE + 1);
}

/** The hover card's top in the stack (its band of `band` px centred on bar `mid`), kept inside the
 *  transcript's box: the stack is centred in vh, and a card past its bottom would be drawn over the
 *  composer (the runner's band, a dialog). */
export function cardTop(mid, stack, vh, band = 120) {
  const off = (vh - stack) / 2; // the stack's top in the box
  return Math.max(-off, Math.min(mid - band / 2, vh - off - band));
}

/**
 * Where the scroll area's children are, from their heights (undefined: not measured yet), the first
 * at `inset` (the area's top padding). { tops, end, known }: each one's top, the bottom of the last,
 * whether every height was known (if not, nothing after the first unknown is right).
 */
export function offsets(heights, inset = 0) {
  const tops = [];
  let y = inset, known = true;
  for (const h of heights) {
    tops.push(y);
    if (!(h >= 0)) known = false;
    y += h >= 0 ? h : 0;
  }
  return { tops, end: y, known };
}

/**
 * The view's top in the content (design px), as gpui painted it. Measured in the engine (2026-11-20, a
 * journal under Kylian's trackpad): the scroll area's own handlers get the bounds of the CONTENT it
 * scrolls, so their y is the view's top less the offset, and their local y is in the content. The view's
 * top (`viewY`, window px) comes from the box around the area (main.js kc-view). `z`: the app's zoom.
 */
export const viewTop = ({ viewY, contentY, z = 1 }) => Math.max(0, (viewY - contentY) / z);

/**
 * The offset after a wheel event (dy > 0 goes up), within [0, max]. `top`: as the bounds `by` it came
 * with say (viewTop). gpui delivers events on the bounds of its last paint, several before the next one
 * (13 in 2 ms after a stall, measured): from the same bounds, each starts where the last one left it,
 * as gpui moves the offset (clamped at each). `est`: the last answer, { by, top }, or null.
 */
export function wheelAfter(est, { by, top, dy, max }) {
  const from = est && est.by === by ? est.top : top;
  return { by, top: Math.max(0, Math.min(Math.max(0, max), from - dy)) };
}

/**
 * How far a wheel event moves the scroll area, which scrolls y only: its delta.y, or its delta.x when
 * delta.y is 0 (gpui takes the other axis then: a sideways swipe scrolls the transcript, A14).
 */
export const wheelDy = (delta) => (delta?.y ? delta.y : delta?.x ?? 0);

/**
 * The message on screen (measure_active, :101-125): following the bottom, or within NEAR_END of it
 * when it is the conversation's end (`whole`), the last; else the first whose turn starts in the
 * view, else the last one above it. A turn after the drawn ones has no top: below. `tops`: turn id
 * -> its top (a drawn turn); a turn before `first` isn't drawn: above. A note shares its turn's place:
 * the turn's first message stands for it, unless `cur` (the one lit now) is of that turn. Answers
 * { k, above }: its index (-1: none), and whether its turn starts above the view (`[` goes back to it).
 */
export function activeAt({ marks: list, tops, first = 0, scrollTop, vh, end, follow = false, whole = true, cur = -1 }) {
  const n = list.length;
  if (!n) return { k: -1, above: false };
  if (follow || atEnd({ scrollTop, vh, end, whole })) return { k: n - 1, above: false };
  let above = -1, hit = -1;
  for (let k = 0; k < n; k++) {
    const m = list[k];
    const y = m.i < first ? -Infinity : tops.get(m.turn);
    if (y == null) break; // not measured: below, like every later one
    if (y < scrollTop) { above = k; continue; }
    if (y >= scrollTop + vh) break;
    hit = k;
    break;
  }
  let k = hit >= 0 ? hit : above >= 0 ? above : 0;
  while (k > 0 && list[k - 1].turn === list[k].turn) k--;
  if (cur >= 0 && cur < n && list[cur].turn === list[k].turn) k = cur;
  return { k, above: hit < 0 && above >= 0 };
}

/**
 * The view at the conversation's bottom: within NEAR_END of the scroll area's end, when that end is
 * the conversation's (`whole`, #59: a window that stops before the end has « Tours suivants » there).
 * A wheel going down that lands here follows the bottom again (#59).
 */
export const atEnd = ({ scrollTop, vh, end, whole = true }) => whole && end - (scrollTop + vh) <= TL.NEAR_END;

/** The jump's anchor: a view tall, never past the content's end (it would lengthen the scroll). */
export const anchorH = ({ y, end, vh }) => Math.max(1, Math.min(vh, end - y));

/**
 * The jump's glide (Kylian's ask after #86): the jump stays the anchor's, and the content slides
 * instead, natively, from where it was. `top`: where the anchor [y, y + h) leaves the view's top, the
 * smallest scroll from `from` (the view's top before; null when unknown, then `dir` says from where:
 * 1 from above, -1 from below). `dy`: how much lower the content is drawn at first (dy < 0: higher), so
 * that image still shows the view it left; one view at most (Monocode jumps, this only eases it), and
 * never showing past the content (top - dy in [0, max]). 0: nothing to glide.
 */
export function glide({ y, h, vh, max, from = null, dir = 0 }) {
  const hi = Math.max(0, max);
  const near = from == null ? (dir < 0 ? y : y + h - vh) : y < from ? y : y + h > from + vh ? y + h - vh : from;
  const top = Math.max(0, Math.min(hi, near));
  const raw = from == null ? dir * vh : top - from;
  const dy = Math.max(top - hi, Math.min(top, Math.max(-vh, Math.min(vh, raw))));
  return { top, dy: Math.abs(dy) < 1 ? 0 : dy };
}

/**
 * [ ] by `count`: the message before or after `at`. Going back from a message whose turn starts above
 * the view, the first step is that message's own top (vim's `{`). -1 without messages.
 */
export function stepMark(n, at, above, dir, count = 1) {
  if (n <= 0) return -1;
  const from = at < 0 || at >= n ? n - 1 : at;
  const to = dir < 0 ? from - (above ? count - 1 : count) : from + count;
  return Math.max(0, Math.min(n - 1, to));
}

/** The message a turn belongs to: that turn's first, else the last before it (0 when none is). */
export function ownerOf(list, turnIndex) {
  let best = -1;
  for (let k = 0; k < list.length; k++) {
    if (list[k].i === turnIndex) return k;
    if (list[k].i > turnIndex) break;
    best = k;
  }
  return Math.max(0, best);
}
