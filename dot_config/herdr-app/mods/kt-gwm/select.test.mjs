// node mods/kt-gwm/select.test.mjs: select.js's selection, keys and bulk plans.
import assert from "node:assert/strict";
import { Select, partition, lines } from "./select.js";

const order = ["a", "b", "c", "d", "e"];
const ids = (s) => [...s.ids].sort().join("");
const s = new Select();

// ⌘-click toggles; ⇧-click adds the range from the anchor; a plain click empties and answers false.
assert.equal(s.click({ platform: true }, "b", order), true);
assert.equal(s.click({ shift: true }, "d", order), true);
assert.equal(ids(s), "bcd");
assert.equal(s.click({ platform: true }, "c", order), true);
assert.equal(ids(s), "bd");
assert.equal(s.click({}, "a", order), false);
assert.equal(s.size, 0);
// ⇧ with no anchor: a toggle.
s.click({ shift: true }, "e", order);
assert.equal(ids(s), "e");

// x / space toggle the cursor's row; not a listed one (a fold): taken, nothing changes.
s.clear();
assert.equal(s.key("x", "a", order), true);
assert.equal(s.key("space", "c", order), true);
assert.equal(ids(s), "ac");
assert.equal(s.key("x", "fold:z", order), true);
assert.equal(ids(s), "ac");

// V from d, j j would go past the end: the range follows the cursor and keeps what was there.
s.key("V", "d", order);
s.follow("e", order);
assert.equal(ids(s), "acde");
s.follow("b", order); // back up over the anchor
assert.equal(ids(s), "abcd");
// esc ends V (selection kept), esc again empties it, a third esc isn't ours.
assert.equal(s.key("escape", "b", order), true);
assert.equal(s.visual, false);
assert.equal(ids(s), "abcd");
assert.equal(s.key("escape", "b", order), true);
assert.equal(s.size, 0);
assert.equal(s.key("escape", "b", order), false);

// ctrl-a: every listed row; other keys go on to vim.
assert.equal(s.key("ctrl-a", null, order), true);
assert.equal(ids(s), "abcde");
assert.equal(s.key("j", "a", order), false);

// Rows gone leave; pick keeps the list's order.
s.keep(["e", "c", "z"]);
assert.equal(ids(s), "ce");
assert.deepEqual(s.pick([{ k: "e" }, { k: "a" }, { k: "c" }], (x) => x.k), [{ k: "e" }, { k: "c" }]);

// Bulk plans: refused ones keep their reason; the confirm lists at most `max`.
const plan = partition([1, 2, 3, 4], (n) => (n % 2 ? null : `pair ${n}`));
assert.deepEqual(plan.ok, [1, 3]);
assert.deepEqual(plan.refused, [{ item: 2, why: "pair 2" }, { item: 4, why: "pair 4" }]);
assert.equal(lines(["x", "y", "z"], 2), "• x\n• y\n… +1", "no words given: neutral");
assert.equal(lines(["x", "y", "z"], 2, (n) => `… et ${n} autre`), "• x\n• y\n… et 1 autre", "the mod's words (I18N.md)");

console.log("select: ok");
