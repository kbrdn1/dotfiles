// bun mods/kt-keys/vim.check.mjs: vim.js's keys, modes, gg / dd timing, counts and cursor steps.
import assert from "node:assert/strict";
import { Vim, keyOf, keysOf, step } from "./vim.js";

let t = 0;
const clock = () => t;
const ev = (key, mods = {}, key_char = undefined, keystroke = key) => ({ key, key_char, keystroke, modifiers: { shift: false, control: false, alt: false, platform: false, ...mods } });

// Key names from events: shifted characters, chords, named keys.
assert.equal(keyOf(ev("g", { shift: true }, "G", "shift-g")).name, "G");
assert.equal(keyOf(ev("/", { shift: true }, "?", "shift-/")).name, "?");
assert.equal(keyOf(ev("d", { control: true }, undefined, "ctrl-d")).name, "ctrl-d");
assert.equal(keyOf(ev("tab", { shift: true }, undefined, "shift-tab")).name, "shift-tab");
assert.equal(keyOf(ev("escape")).name, "escape");
assert.equal(keyOf("space").char, " ");
assert.deepEqual(keysOf("g g"), ["g", "g"]);
assert.deepEqual(keysOf(" 5  j "), ["5", "j"]);

// Normal mode.
const v = new Vim({ field: true, now: clock });
assert.equal(v.mode, "normal");
assert.equal(v.handle("j"), "down");
assert.equal(v.handle(ev("down")), "down");
assert.equal(v.handle("k"), "up");
assert.equal(v.handle("G"), "bottom");
assert.equal(v.handle("ctrl-d"), "half-down");
assert.equal(v.handle(ev("u", { control: true }, undefined, "ctrl-u")), "half-up");
assert.equal(v.handle("enter"), "open");
assert.equal(v.handle("o"), "open");
assert.equal(v.handle("O"), "open-alt");
assert.equal(v.handle("shift-tab"), "tab-prev");
assert.equal(v.handle("]"), "panel-next");
assert.equal(v.handle("x"), "delete");
assert.equal(v.handle("a"), "archive");
assert.equal(v.handle("?"), "help");
assert.equal(v.handle("L"), "scroll-right");
// Not vim keys: answered null, so the mod lets them go (ctrl-b, cmd-*).
assert.equal(v.handle(ev("b", { control: true }, undefined, "ctrl-b")), null);
assert.equal(v.handle(ev("k", { platform: true }, undefined, "cmd-k")), null);
assert.equal(v.handle("z"), null);

// gg / dd within 600 ms; slower, the second key starts over; another key in between drops it.
t = 1000;
assert.equal(v.handle("g"), "pending");
t = 1500;
assert.equal(v.handle("g"), "top");
t = 2000;
assert.equal(v.handle("d"), "pending");
t = 2100;
assert.equal(v.handle("d"), "delete");
t = 3000;
assert.equal(v.handle("g"), "pending");
t = 3700;
assert.equal(v.handle("g"), "pending");
t = 3800;
assert.equal(v.handle("j"), "down");
assert.equal(v.pending, null);
assert.equal(v.handle("d"), "pending");
assert.equal(v.handle("j"), "down");
assert.equal(v.handle("d"), "pending");

// Counts: 5j, 12k; a lone 0 is no count; a count resets after its action.
assert.equal(v.handle("5"), "count");
assert.equal(v.handle("j"), "down");
assert.equal(v.count, 5);
assert.equal(v.handle("1"), "count");
assert.equal(v.handle("2"), "count");
assert.equal(v.handle("k"), "up");
assert.equal(v.count, 12);
assert.equal(v.handle("j"), "down");
assert.equal(v.count, 1);
assert.equal(v.handle("0"), null);
assert.equal(new Vim({ counts: false }).handle("5"), null);

// / goes to insert mode with a field; without one it's not a vim key.
assert.equal(new Vim().handle("/"), null);
assert.equal(v.handle("/"), "filter");
assert.equal(v.mode, "insert");
assert.equal(v.label, "INSERT");

// Insert mode: typing, the telescope keys, esc back to normal (the filter stays the mod's).
assert.equal(v.handle(ev("j", {}, "j")), "type");
assert.equal(v.char, "j");
assert.equal(v.handle(ev("space", {}, " ")), "type");
assert.equal(v.char, " ");
assert.equal(v.handle("ctrl-n"), "down");
assert.equal(v.handle("ctrl-j"), "down");
assert.equal(v.handle("ctrl-p"), "up");
assert.equal(v.handle("ctrl-k"), "up");
assert.equal(v.handle("backspace"), "backspace");
assert.equal(v.handle("enter"), "submit");
assert.equal(v.handle(ev("k", { platform: true }, "k", "cmd-k")), null);
assert.equal(v.handle("escape"), "normal");
assert.equal(v.mode, "normal");
assert.equal(v.handle("escape"), "escape");
// A dialog with a field starts typing.
assert.equal(new Vim({ field: true, insert: true }).mode, "insert");
assert.equal(new Vim({ insert: true }).mode, "normal");

// Cursor steps: clamped, from no cursor, half pages, counts.
assert.equal(step("down", -1, 5), 0);
assert.equal(step("up", -1, 5), 4);
assert.equal(step("down", 4, 5), 4);
assert.equal(step("down", 1, 5, 3), 4);
assert.equal(step("top", 3, 5), 0);
assert.equal(step("bottom", 0, 5), 4);
assert.equal(step("half-down", 0, 50, 1, 10), 5);
assert.equal(step("half-up", 20, 50, 2, 10), 10);
assert.equal(step("down", 0, 0), -1);

console.log("vim.js: ok");
