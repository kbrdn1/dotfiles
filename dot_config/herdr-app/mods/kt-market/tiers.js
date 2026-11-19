// tiers.js: the width tiers of the Agents pages (#74), read from the page root's width (its
// on_size_change). Written once in mods/kt-keys/tiers.js and copied byte for byte (cmp) into the mods
// that use it (kt-mods/model.js SHARED). Pure: its check is mods/kt-keys/tiers.check.mjs.
//   wide   (>= 1040): list and detail side by side, the detail `ratio` of the page;
//   medium (>= 720):  the list narrower (36 %, 260 to 340 px), the detail gets the rest;
//   narrow (< 720):   one column, the list or the detail (solo), the detail with a way back.

export const TIERS = { wide: 1040, medium: 720 };
const GAP = 4; // between the list and the detail

export const tierOf = (w) => (w >= TIERS.wide ? "wide" : w >= TIERS.medium ? "medium" : "narrow");

// The list's and the detail's widths (px) for a page `w` wide: the detail's is the card's `w(…)`.
export function split(w, ratio = 0.45) {
  const tier = tierOf(w);
  if (tier === "narrow") return { tier, list: w, detail: w, solo: true };
  if (tier === "wide") {
    const detail = Math.round(w * ratio);
    return { tier, list: w - detail - GAP, detail, solo: false };
  }
  const list = Math.min(340, Math.max(260, Math.round(w * 0.36)));
  return { tier, list, detail: w - list - GAP, solo: false };
}
