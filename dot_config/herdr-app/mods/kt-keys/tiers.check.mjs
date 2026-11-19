// bun mods/kt-keys/tiers.check.mjs: tiers.js' tiers and widths.
import { TIERS, tierOf, split } from "./tiers.js";

let bad = 0;
const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; console.error(`✗ ${what}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); } };

eq(tierOf(TIERS.wide), "wide", "1040 is wide");
eq(tierOf(TIERS.wide - 1), "medium", "1039 is medium");
eq(tierOf(TIERS.medium), "medium", "720 is medium");
eq(tierOf(TIERS.medium - 1), "narrow", "719 is narrow");
eq(tierOf(0), "narrow", "0 (not measured yet) is narrow");

eq(split(1500), { tier: "wide", list: 821, detail: 675, solo: false }, "wide: 45 %");
eq(split(1500, 0.42).detail, 630, "wide: the mod's ratio");
eq(split(870), { tier: "medium", list: 313, detail: 553, solo: false }, "medium: the list at 36 %");
eq(split(720).list, 260, "medium: the list's floor");
eq(split(1039).list, 340, "medium: the list's ceiling");
eq(split(600), { tier: "narrow", list: 600, detail: 600, solo: true }, "narrow: one column");
// Side by side, list + gap + detail fill the page, at every width.
for (let w = 720; w <= 2400; w += 7) {
  const s = split(w);
  if (s.list + 4 + s.detail !== w || s.list < 1 || s.detail < 1) { bad++; console.error(`✗ split(${w}) = ${JSON.stringify(s)}`); break; }
}

if (bad) process.exit(1);
console.log("tiers: ok");
