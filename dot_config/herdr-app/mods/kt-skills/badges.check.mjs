// bun mods/kt-skills/badges.check.mjs: the badges a skill row keeps at a list's width (badges.js).
import { rowBadges } from "./badges.js";

let bad = 0;
const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; console.error(`✗ ${what}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); } };

const tools = "outils restreints";
// Seen on screen (2026-11-19): at the two-column floor the list is ~296 px, and a row with this badge
// lost its whole name.
eq(rowBadges(296, [tools], "personnel"), [], "296 px: the badge goes, the name stays");
eq(rowBadges(316, [tools], "personnel"), [], "316 px (page 700): still none");
eq(rowBadges(565, [tools], "personnel"), [tools], "565 px (page 1035, as in the dialog): kept");
// Its threshold: the fixed parts 132, the source tag 70, the name 120, the badge and its gap 126.
eq(rowBadges(447, [tools], "personnel"), [], "447 px: one short");
eq(rowBadges(448, [tools], "personnel"), [tools], "448 px: fits");
// Several: kept in order while they fit, the last ones go first.
eq(rowBadges(520, ["commande", tools, "non invocable"], "plugin"), ["commande", tools], "the last one goes first");
eq(rowBadges(2000, ["commande", tools, "non invocable"], "plugin"), ["commande", tools, "non invocable"], "wide: all");
eq(rowBadges(600, [], "personnel"), [], "none to keep");

if (bad) process.exit(1);
console.log("badges: ok");
