// helprows.js: the help's list (ctrl-b ?) as a virtual list's items, and each item's height. Every row of
// « Tout » (219 on 2026-11-19, about 19 600 native calls in one render) went past a mod call's ~50 ms under
// load; a virtual list draws only the rows on screen, but it places them by heights the script gives
// (no measure inside its renderer). So the heights are estimated from the text, on the high side: a row a
// few px too tall leaves a gap, one too short would overlap the next. Pure: helprows.check.mjs.
//
// The numbers follow main.js' row: 10 px aside, py 4, at least 32 high, 2 between rows; the keycaps
// (shortcuts.js kbd, caps 20 high) wrap in 230 px with 7 between them; the description in Inter 12.5,
// 20 px a line; the place pill in mono 9.5.
import { capsOf } from "./shortcuts.js";

export const ROW = { min: 32, py: 4, px: 10, gap: 12, keys: 230, between: 2 };
export const CAP = { h: 20, gap: 7, chord: 2 };
const LINE = 20; // a description line (Inter 12.5)
const CHAR = 6.9; // its average advance, high (French text averages ~6.4 at 12.5)
const MONO_CHAR = 7.4; // a cap's mono letter (Monaspace 12)
const GLYPH = 12; // a cap's glyph (Inter 12: ⌃ ⇧ ⌘ ⌥ ↵ …)
const PILL_CHAR = 6.1; // the place pill (mono 9.5, upper case)
const HEAD = { first: 27, next: 35 }; // a group's eyebrow: pt 4 or 12, its 17 px line, pb 4, the 2 under it

/** One chord's width as kbd() draws it: its caps side by side. */
function chordW(chord, vim) {
  const caps = capsOf(chord, { vim });
  const cap = (c) => Math.max(CAP.h, Math.ceil((c.glyph ? GLYPH : c.text.length * MONO_CHAR) + 10));
  return caps.reduce((w, c) => w + cap(c), 0) + CAP.chord * (caps.length - 1);
}

/** How many lines `keys` takes in the keycaps' 230 px. */
export function capLines(keys, vim = false) {
  let lines = 1, x = 0;
  for (const chord of String(keys ?? "").split(" ").filter(Boolean)) {
    const w = chord === "/" ? 5 : chordW(chord, vim);
    if (x > 0 && x + CAP.gap + w > ROW.keys) { lines++; x = w; }
    else x += (x > 0 ? CAP.gap : 0) + w;
  }
  return lines;
}

/** How many lines the description takes beside the keycaps (and the pill), in a row `width` wide. */
export function textLines(what, where, width) {
  const pill = where ? ROW.gap + 16 + String(where).length * PILL_CHAR : 0;
  const room = Math.max(80, width - 2 * ROW.px - ROW.keys - ROW.gap - pill);
  return Math.max(1, Math.ceil((String(what ?? "").length * CHAR) / (room * 0.92)));
}

/** A row's height in the list, the 2 px under it included. */
export function rowHeight(r, width) {
  const caps = capLines(r.keys, r.g !== "global");
  const capsH = caps * CAP.h + (caps - 1) * CAP.gap;
  const textH = textLines(r.what, r.where, width) * LINE;
  return Math.max(ROW.min, 2 * ROW.py + Math.max(capsH, textH)) + ROW.between;
}

/** The list's items: a group's eyebrow before its first row (« Tout » only), then each row. `itemOf[i]`:
 *  row i's item, for the cursor's reveal; `sizes`: their heights. */
export function items(rows, all, width) {
  const list = [], itemOf = [], sizes = [];
  rows.forEach((r, i) => {
    if (all && rows[i - 1]?.g !== r.g) {
      list.push({ head: r.g, first: i === 0 });
      sizes.push(i === 0 ? HEAD.first : HEAD.next);
    }
    itemOf[i] = list.length;
    list.push({ row: i });
    sizes.push(rowHeight(r, width));
  });
  return { list, itemOf, sizes };
}
