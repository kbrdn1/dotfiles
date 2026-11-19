// tiers.js: the width tiers of the Agents pages (#74), read from the page root's width (its
// on_size_change). Written once in mods/kt-keys/tiers.js and copied byte for byte (cmp) into the mods
// that use it (kt-mods/model.js SHARED). Pure: its check is mods/kt-keys/tiers.check.mjs.
//   wide   (>= 920): the secondary bits on one row (Inbox's filters, Notes' pills, Workflow's 3 columns);
//   medium (>= 664): those bits stacked, list and detail still side by side;
//   narrow (< 664):  one column, the list or the detail (solo), the detail with a way back.
// Side by side, the widths don't follow the tier: one continuous split from 664 px up, no jump at a
// threshold. The detail keeps `ratio` of the page, never under DETAIL_MIN; the list takes the rest,
// never under LIST_MIN, at most `listMax` (Inbox 400, Notes 340). 664 = LIST_MIN + GAP + DETAIL_MIN.
// Hysteresis: a tier goes up only HYST px past its threshold, down as soon as the page is under it. A
// resize around a threshold doesn't flicker, and two columns never go under their floors.

export const LIST_MIN = 280; // a skill row: its fixed parts (~194 px), ~86 px left for the name
export const DETAIL_MIN = 380; // a band with 4 icon buttons, an eyebrow 150 + its value, ~50 characters a line
const GAP = 4; // between the list and the detail
export const HYST = 32;
export const TIERS = { wide: 920, medium: LIST_MIN + GAP + DETAIL_MIN };
const RANK = { narrow: 0, medium: 1, wide: 2 };

// `prev`: the tier the page showed last (none: no margin).
export function tierOf(w, prev) {
  const r = RANK[prev] ?? 2;
  const at = (t, rank) => (r < rank ? t + HYST : t);
  return w >= at(TIERS.wide, 2) ? "wide" : w >= at(TIERS.medium, 1) ? "medium" : "narrow";
}

// The list's and the detail's widths (px) for a page `w` wide: the detail's is the card's `w(…)`, the
// list's the column's of a page whose list has a fixed width (`listMax`). `opts` may still be a number,
// the ratio alone (a page not yet passing its previous tier).
export function split(w, opts = {}) {
  const { ratio = 0.45, listMax = Infinity, prev } = typeof opts === "number" ? { ratio: opts } : opts;
  const tier = tierOf(w, prev);
  if (tier === "narrow") return { tier, list: w, detail: w, solo: true };
  const detail = Math.min(Math.max(Math.round(w * ratio), DETAIL_MIN), w - GAP - LIST_MIN);
  const list = Math.min(listMax, w - GAP - detail);
  return { tier, list, detail: w - GAP - list, solo: false };
}
