// turn-window.js: the turns the Chat draws whole (#59), a band [from, to) of turn indices, `to`
// excluded, at most CAP; turn-band.js picks it around the view, every other loaded turn is a box. Here:
// the band followed by id when the turns are built again, what the live tail's trim keeps, the order a
// render describes the band in. Pure, no herdr: checked under bun (turn-window.check.mjs).
//
// CAP from the render's ~50 ms, measured on the chat wrapper's busy turns (30 calls each) under the
// load of several agents (2026-11-19, scratchpad chat-window/ab.sh, 12 rounds side by side): 60 drawn
// (the commit's G) interrupted 11 times, 20 drawn 8 times, 15 drawn once, 10 (a read) once.

export const SHOW = 10; // turns drawn on reading a session, before turn-band.js has the view's height
export const CAP = 15; // turns drawn at most

/** The last SHOW turns: on reading a session, G, the « go to the bottom » button (body() then picks the bottom's band). */
export const bottom = (n) => ({ from: Math.max(0, n - SHOW), to: n });

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
 * How many entries the live tail keeps (chat-model.js trim) from turn `id` on, the reader not at the
 * bottom: never what comes from it (main.js passes the first loaded turn: every one is a row), else
 * `keep`. `id` null: following the bottom, `keep`.
 */
export function keepFor(entries, id, keep) {
  if (id == null) return keep;
  if (String(id).startsWith("head-")) return Math.max(keep, entries.length); // the read's very start
  const i = entries.findIndex((e) => e.uuid === id && e.turn);
  return i < 0 ? keep : Math.max(keep, entries.length - i);
}

/**
 * The band after the turns were built again (a read in front, the live tail's new turns, its trim
 * of the oldest), by the ids of the turns it drew. Following the bottom: it slides with the end at
 * its size (SHOW to CAP). Not following: the same turns, wherever they are now; nothing above what
 * is read goes. None of them left: the bottom.
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
