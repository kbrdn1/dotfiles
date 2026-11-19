// turn-window.js: which turns the Chat draws (#59, its first point: paging by turns). A window
// [from, to) of turn indices, `to` excluded, that no longer sticks to the end: at most CAP turns are
// drawn, SHOW at a time. Pure, no herdr: checked under bun (turn-window.check.mjs).
//
// Above the window, « Tours précédents » (the head); below it, « Tours suivants » when it stops before
// the end. Every move keeps the window at CAP or under by dropping turns on the far side: gg on 120
// loaded turns draws CAP, a jump by the timeline SHOW, never everything from there to the end.
//
// CAP from the render's ~50 ms, measured on the chat wrapper's busy turns (30 calls each) under the
// load of several agents (2026-11-19, scratchpad chat-window/ab.sh, 12 rounds side by side): 60 drawn
// (the commit's G) interrupted 11 times, 20 drawn 8 times, 15 drawn once, 10 (a read) once.

export const SHOW = 10; // turns drawn at first, and added per « Tours précédents » / « Tours suivants »
export const CAP = 15; // turns drawn at most

const fit = (w, n) => {
  const to = Math.max(0, Math.min(n, w.to));
  return { from: Math.max(0, Math.min(to, w.from)), to };
};

/** The last SHOW turns: on reading a session, G, the « go to the bottom » button. */
export const bottom = (n) => ({ from: Math.max(0, n - SHOW), to: n });

/**
 * The window that holds turn `i` for the cursor (j k, ctrl-d ctrl-u, gg G): unchanged when it's in;
 * else grown to it, then cut to CAP on the other side (gg from the bottom of 120: [0, 20]).
 */
export function reach(w, n, i) {
  w = fit(w, n);
  if (i < 0 || i >= n || (i >= w.from && i < w.to)) return w;
  if (i < w.from) return { from: i, to: Math.min(w.to, i + CAP) };
  return { from: Math.max(w.from, i + 1 - CAP), to: i + 1 };
}

/**
 * The window a jump to turn `i` draws (the timeline, [ ]): unchanged when it's in; else the turn at
 * the top and SHOW - 1 after it (fewer near the end: the last SHOW), so it can come to the view's top.
 */
export function at(w, n, i) {
  w = fit(w, n);
  if (i < 0 || i >= n || (i >= w.from && i < w.to)) return w;
  const from = Math.max(0, Math.min(i, n - SHOW));
  return { from, to: Math.min(n, from + SHOW) };
}

/**
 * « Tours précédents » with turns read above: the window fills up to CAP first, nothing cut (from the
 * bottom of a live session, the live turn stays drawn); at CAP, it slides SHOW up, the bottom cut.
 */
export function older(w) {
  if (w.to - w.from < CAP) return { from: Math.max(0, w.to - CAP), to: w.to };
  const from = Math.max(0, w.from - SHOW);
  return { from, to: Math.min(w.to, from + CAP) };
}

/** « Tours suivants »: the window fills down to CAP first; at CAP, it slides SHOW down, the top cut. */
export function newer(w, n) {
  if (w.to - w.from < CAP) return { from: w.from, to: Math.min(n, w.from + CAP) };
  const to = Math.min(n, w.to + SHOW);
  return { from: Math.min(to, Math.max(w.from, to - CAP)), to };
}

/**
 * The order a render describes the window's turns in (A16): from `focus` (the turn the reader is at)
 * outwards, the one below first at each distance (the view goes on downward from it). What a render
 * may draw (code, steps, details) goes to them in this order. Following the bottom (focus: the last),
 * the last turn first, then up.
 */
export function nearFirst(from, to, focus) {
  if (to <= from) return [];
  const f = Math.max(from, Math.min(to - 1, focus));
  const out = [f];
  for (let d = 1; out.length < to - from; d++) {
    if (f + d < to) out.push(f + d);
    if (f - d >= from) out.push(f - d);
  }
  return out;
}

/**
 * How many entries the live tail keeps (chat-model.js trim) when the window's first turn is `id` and
 * the reader isn't at the bottom: never the turns being read (a « Tours précédents » read while the
 * agent works would go at the next tick), else `keep`. `id` null: following the bottom, `keep`.
 */
export function keepFor(entries, id, keep) {
  if (id == null) return keep;
  if (String(id).startsWith("head-")) return Math.max(keep, entries.length); // the read's very start
  const i = entries.findIndex((e) => e.uuid === id && e.turn);
  return i < 0 ? keep : Math.max(keep, entries.length - i);
}

/**
 * The window after the turns were built again (a read in front, the live tail's new turns, its trim
 * of the oldest), by the ids of the turns it drew. Following the bottom: it slides with the end at
 * its size (SHOW to CAP). Not following: the same turns, wherever they are now; new turns wait in
 * « Tours suivants » and nothing above what is read goes. None of them left: the bottom.
 */
export function remap(w, oldIds, newIds, follow) {
  const n = newIds.length;
  if (follow) {
    const size = Math.min(CAP, Math.max(SHOW, w.to - w.from));
    return { from: Math.max(0, n - size), to: n };
  }
  const index = new Map(newIds.map((id, i) => [id, i]));
  let from = -1, to = -1;
  for (let i = Math.max(0, w.from); i < Math.min(w.to, oldIds.length); i++) {
    const j = index.get(oldIds[i]);
    if (j == null) continue;
    if (from < 0) from = j;
    to = j + 1;
  }
  return from < 0 ? bottom(n) : { from, to };
}
