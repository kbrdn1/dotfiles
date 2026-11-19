// bun mods/kt-keys/tiers.check.mjs: tiers.js' tiers, hysteresis and widths.
import { TIERS, HYST, LIST_MIN, DETAIL_MIN, tierOf, split } from "./tiers.js";

let bad = 0;
const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; console.error(`✗ ${what}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); } };

// No previous tier: the plain thresholds.
eq(TIERS.medium, LIST_MIN + 4 + DETAIL_MIN, "narrow starts where two columns no longer fit");
eq(tierOf(TIERS.wide), "wide", "920 is wide");
eq(tierOf(TIERS.wide - 1), "medium", "919 is medium");
eq(tierOf(TIERS.medium), "medium", "664 is medium");
eq(tierOf(TIERS.medium - 1), "narrow", "663 is narrow");
eq(tierOf(0), "narrow", "0 (not measured yet) is narrow");

// Hysteresis: up only HYST px past the threshold, down as soon as under it.
eq(tierOf(TIERS.wide + HYST - 1, "medium"), "medium", "medium stays medium inside the band");
eq(tierOf(TIERS.wide + HYST, "medium"), "wide", "medium goes wide past the band");
eq(tierOf(TIERS.wide, "wide"), "wide", "wide stays wide down to the threshold");
eq(tierOf(TIERS.wide - 1, "wide"), "medium", "wide goes medium under it");
eq(tierOf(TIERS.medium + HYST - 1, "narrow"), "narrow", "narrow stays narrow inside the band");
eq(tierOf(TIERS.medium + HYST, "narrow"), "medium", "narrow goes medium past the band");
eq(tierOf(TIERS.medium - 1, "medium"), "narrow", "medium goes narrow under it");
eq(tierOf(600, "wide"), "narrow", "wide to narrow in one step");
eq(tierOf(1500, "narrow"), "wide", "narrow to wide in one step");
eq(tierOf(TIERS.wide + 10, "narrow"), "medium", "narrow to medium only, inside the wide band");
// Kylian's widths (the panel open, 962 to 1082; closed, ~1530; the dialogs, 1706 and 1896): wide,
// whatever came before.
for (const w of [962, 1009, 1035, 1082, 1530, 1706, 1896]) for (const p of [undefined, "narrow", "medium", "wide"]) eq(tierOf(w, p), "wide", `${w} after ${p}`);

eq(split(1035), { tier: "wide", list: 565, detail: 466, solo: false }, "1035: 45 %, as in the dialog");
eq(split(1035, { ratio: 0.42 }).detail, 435, "the mod's ratio");
eq(split(1035, 0.42), split(1035, { ratio: 0.42 }), "the ratio alone, as a number (the old call)");
eq(split(1706), { tier: "wide", list: 934, detail: 768, solo: false }, "Skills' dialog");
eq(split(800), { tier: "medium", list: 416, detail: 380, solo: false }, "the detail at its floor, the list gives way");
eq(split(TIERS.medium), { tier: "medium", list: LIST_MIN, detail: DETAIL_MIN, solo: false }, "both at their floors");
eq(split(1035, { listMax: 400 }), { tier: "wide", list: 400, detail: 631, solo: false }, "Inbox: its list at 400");
eq(split(722, { listMax: 400 }).list, 338, "Inbox: its list narrower once the detail is at its floor");
eq(split(600), { tier: "narrow", list: 600, detail: 600, solo: true }, "narrow: one column");
eq(split(TIERS.medium + 10, { prev: "narrow" }).solo, true, "narrow stays one column inside the band");
eq(split(TIERS.medium + 10, { prev: "medium" }).solo, false, "two columns stay two inside the band");

// Side by side: list + gap + detail fill the page, each at least its floor, and a pixel more moves
// each column by a pixel at most (no jump at a threshold), for every ratio and list a page uses.
for (const o of [{}, 0.42, { ratio: 0.42 }, { ratio: 0.46 }, { listMax: 400 }, { listMax: 340 }]) {
  let last = null;
  for (let w = TIERS.medium; w <= 2400; w++) {
    const s = split(w, o);
    if (s.solo || s.list + 4 + s.detail !== w || s.list < LIST_MIN || s.detail < DETAIL_MIN
      || (last && (Math.abs(s.list - last.list) > 1 || Math.abs(s.detail - last.detail) > 1))) {
      bad++; console.error(`✗ split(${w}, ${JSON.stringify(o)}) = ${JSON.stringify(s)} after ${JSON.stringify(last)}`); break;
    }
    last = s;
  }
}

if (bad) process.exit(1);
console.log("tiers: ok");
