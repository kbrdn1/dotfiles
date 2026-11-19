// bun ~/.config/herdr-app/mods/kt-keys/helprows.check.mjs: helprows.js, the help's list as a virtual list's
// items and their estimated heights (high side): a short row at its 32 px, keycaps or a description that wrap
// growing it by whole lines, a pill taking room from the description, the eyebrows of « Tout », each row's
// item for the cursor's reveal. gpui-kit is stood in (shortcuts.js imports div). Not loaded by Herdr.
import assert from "node:assert/strict";
import { plugin } from "bun";

plugin({ name: "stand-in", setup(b) { b.module("gpui-kit", () => ({ loader: "object", exports: { div: () => ({}) } })); } });
const { capLines, textLines, rowHeight, items, ROW } = await import("./helprows.js");

// Keycaps: a key or two on one line; the Pages row's ten chords wrap.
assert.equal(capLines("ctrl-b v"), 1);
assert.equal(capLines("j / k", true), 1);
const pages = "ctrl-b shift-h / i / shift-s / shift-a / a / m / u / shift-e / shift-o / shift-i";
assert.ok(capLines(pages) >= 3, `the Pages row wraps (${capLines(pages)})`);

// The description: one line when short, more when long or squeezed by a long pill.
assert.equal(textLines("Scinder à droite", null, 700), 1);
const long = "Menu du thread (aussi sur le titre du panneau central) : renommer, nouveau thread, copier le nom, l'id de session, le dossier, la branche, l'adresse, fermer";
assert.ok(textLines(long, null, 700) >= 2);
assert.ok(textLines("Aperçu / Brut du document", "Skills, Plugins, Inbox, Workflow, Notes, Marketplaces", 700) > textLines("Aperçu / Brut du document", null, 700));
// Narrower (the card under 720 px), never fewer lines.
assert.ok(textLines(long, null, 480) >= textLines(long, null, 700));

// Heights: 32 + 2 for a short row, whole lines more for wrapping ones.
const short = { g: "global", keys: "ctrl-b v", what: "Scinder à droite" };
assert.equal(rowHeight(short, 700), ROW.min + ROW.between);
assert.ok(rowHeight({ g: "global", keys: pages, what: "Pages" }, 700) >= 2 * 4 + 3 * 20 + 2 * 7 + 2);
assert.ok(rowHeight({ g: "sidebar", keys: "sb.menuKeys", what: long }, 700) > rowHeight(short, 700));

// Items: an eyebrow before each group's first row in « Tout », none in a group; itemOf points at the rows.
const rows = [{ g: "global", keys: "a", what: "x" }, { g: "global", keys: "b", what: "y" }, { g: "pages", keys: "c", what: "z" }];
const all = items(rows, true, 700);
assert.deepEqual(all.list.map((e) => (e.head ? `h:${e.head}` : `r:${e.row}`)), ["h:global", "r:0", "r:1", "h:pages", "r:2"]);
assert.deepEqual(all.itemOf, [1, 2, 4]);
assert.equal(all.sizes.length, all.list.length);
assert.ok(all.sizes[0] < all.sizes[3], "the first eyebrow has less room above it");
const one = items(rows, false, 700);
assert.deepEqual(one.itemOf, [0, 1, 2]);
assert.equal(one.list.length, 3);

console.log("helprows: ok");
