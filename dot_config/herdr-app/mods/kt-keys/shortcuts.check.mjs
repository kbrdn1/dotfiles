// bun ~/.config/herdr-app/mods/kt-keys/shortcuts.check.mjs: shortcuts.js's actions in one word (actionKey),
// which key it shows (the layout's section before global, a global key the layout binds again left out,
// ctrl-b before the others, the first action that has one, "" when none), a chord's keys (capsOf), the same
// glyphs as text (pretty), the keycaps (kbd: glyphs in the UI font, the rest in mono, sequences apart, "/"
// as text) and the tooltip, with gpui-kit mocked. Not loaded by Herdr.
import assert from "node:assert/strict";
import { plugin } from "bun";

const el = () => {
  const node = { kids: [], props: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "children") target.kids.push(...a[0]);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
plugin({ setup(build) { build.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el() } })); } });
const { actionKey, shortcut, capsOf, pretty, kbd, tip } = await import("./shortcuts.js");

// keys() as Herdr gives it: an object binding's action is its JSON.
const sel = (child) => JSON.stringify({ command: "layout.select", args: { stack: "view", child } });
const L = "layout:kbrdn-threads";
const binds = [
  { section: "global", keys: "cmd-w", action: "tab.close" },
  { section: "global", keys: "f2", action: "tab.rename" },
  { section: "global", keys: "cmd-d", action: "pane.split:right" },
  { section: "global", keys: "cmd-/", action: "app.help" },
  { section: L, keys: "cmd-w", action: "kt-head.close-tab" },
  { section: L, keys: "cmd-t", action: JSON.stringify({ command: "mod.open", args: { name: "kt-new" } }) },
  { section: L, keys: "ctrl-b c", action: JSON.stringify({ command: "mod.open", args: { name: "kt-new" } }) },
  { section: L, keys: "ctrl-b shift-x", action: "kt-head.close-tab" },
  { section: L, keys: "ctrl-b shift-t", action: "tab.rename" },
  { section: L, keys: "ctrl-b v", action: "pane.split:right" },
  { section: L, keys: "ctrl-b i", action: sel("inbox") },
  { section: L, keys: "ctrl-b 3", action: "tab.select:3" },
  { section: "layout:other", keys: "ctrl-b q", action: sel("notes") },
  { section: "mod:kt-picker", keys: "ctrl-n", action: "kt-picker.down" },
];

// actionKey: the help's and every mod's one word for an action.
assert.equal(actionKey("tab.rename"), "tab.rename");
assert.equal(actionKey("pane.split:right"), "pane.split:right");
assert.equal(actionKey(sel("inbox")), "layout.select:inbox");
assert.equal(actionKey(JSON.stringify({ command: "mod.open", args: { name: "kt-keys" } })), "mod.open:kt-keys");
assert.equal(actionKey("tab.select:4"), "tab.select");
assert.equal(actionKey("send:\u001bb"), "send");
assert.equal(actionKey("{not json"), "{not json");

// shortcut: the layout's ctrl-b key first, whatever keys()' order.
assert.equal(shortcut(binds, "kbrdn-threads", "layout.select:inbox"), "ctrl-b i");
assert.equal(shortcut(binds, "kbrdn-threads", "mod.open:kt-new"), "ctrl-b c", "ctrl-b before cmd-t, though cmd-t comes first");
assert.equal(shortcut(binds, "kbrdn-threads", "kt-head.close-tab"), "ctrl-b shift-x");
assert.equal(shortcut(binds, "kbrdn-threads", "tab.rename"), "ctrl-b shift-t", "the layout's before global's f2");
assert.equal(shortcut(binds, "kbrdn-threads", "pane.split:right"), "ctrl-b v", "the layout's before global's cmd-d");
// global's cmd-w is the layout's kt-head.close-tab here: tab.close has no key of its own.
assert.equal(shortcut(binds, "kbrdn-threads", "tab.close"), "");
// a global key nothing rebinds still shows.
assert.equal(shortcut(binds, "kbrdn-threads", "app.help"), "cmd-/");
// several actions: the first that has a key; an array works the same.
assert.equal(shortcut(binds, "kbrdn-threads", "tab.close", "kt-head.close-tab"), "ctrl-b shift-x");
assert.equal(shortcut(binds, "kbrdn-threads", ["space.close", "tab.rename"]), "ctrl-b shift-t");
// none, another layout's, a mod's section, the indexed tab.select: nothing.
assert.equal(shortcut(binds, "kbrdn-threads", "layout.select:notes"), "", "another layout's key");
assert.equal(shortcut(binds, "kbrdn-threads", "kt-picker.down"), "", "a mod's section");
assert.equal(shortcut(binds, "kbrdn-threads", "app.theme"), "");
assert.equal(shortcut(binds, "kbrdn-threads"), "");
assert.equal(shortcut([], "kbrdn-threads", "tab.rename"), "");
assert.equal(shortcut(null, null, "tab.rename"), "");
// the other layout: its section, then global's.
assert.equal(shortcut(binds, "other", "layout.select:notes"), "ctrl-b q");
assert.equal(shortcut(binds, "other", "tab.close"), "cmd-w");
// no layout given: kbrdn-threads.
assert.equal(shortcut(binds, null, "layout.select:inbox"), "ctrl-b i");

// capsOf: modifiers as glyphs in the Mac's order (⌃⌥⇧⌘), then the key: a letter as a capital, a named key
// as its glyph, F-keys as F2; with `vim`, a key alone stays as written (g and G differ there).
const texts = (chord, o) => capsOf(chord, o).map((c) => c.text).join(" ");
assert.equal(texts("ctrl-b"), "⌃ B");
assert.equal(texts("i"), "I");
assert.equal(texts("shift-o"), "⇧ O");
assert.equal(texts("cmd-shift-w"), "⇧ ⌘ W");
assert.equal(texts("shift-cmd-w"), "⇧ ⌘ W", "keys.json's order doesn't matter");
assert.equal(texts("cmd-alt-shift-down"), "⌥ ⇧ ⌘ ↓");
assert.equal(texts("cmd--"), "⌘ -");
assert.equal(texts("cmd-,"), "⌘ ,");
assert.equal(texts("?"), "?");
assert.equal(texts("f2"), "F2");
assert.equal(texts("shift-f2"), "⇧ F2");
assert.equal(texts("escape"), "⎋");
assert.equal(texts("ctrl-tab"), "⌃ ⇥");
assert.equal(texts("space"), "␣");
assert.equal(texts("backspace"), "⌫");
assert.equal(texts("1…9"), "1…9");
assert.equal(texts("gg", { vim: true }), "gg");
assert.equal(texts("G", { vim: true }), "G");
assert.equal(texts("j", { vim: true }), "j");
assert.equal(texts("ctrl-d", { vim: true }), "⌃ D", "a chord's key is a capital, vim or not");
assert.deepEqual(capsOf("cmd-t").map((c) => c.glyph), [true, false]);
assert.deepEqual(capsOf("enter").map((c) => c.glyph), [true]);

// pretty, for text (a tooltip): the keycaps' glyphs, a chord's side by side, the chords apart; no raw ctrl-b.
assert.equal(pretty("ctrl-b i"), "⌃B I");
assert.equal(pretty("ctrl-b shift-o"), "⌃B ⇧O");
assert.equal(pretty("ctrl-b ?"), "⌃B ?");
assert.equal(pretty("cmd-t"), "⌘T");
assert.equal(pretty("cmd-shift-w"), "⇧⌘W");
assert.equal(pretty("cmd-alt-left"), "⌥⌘←");
assert.equal(pretty("cmd-alt-shift-down"), "⌥⇧⌘↓");
assert.equal(pretty("cmd--"), "⌘-");
assert.equal(pretty("cmd-+"), "⌘+");
assert.equal(pretty("cmd-shift-/"), "⇧⌘/");
assert.equal(pretty("cmd-shift-enter"), "⇧⌘↵");
assert.equal(pretty("f2"), "F2");
assert.equal(pretty("shift-f2"), "⇧F2");
assert.equal(pretty("ctrl-tab"), "⌃⇥");
assert.equal(pretty(""), "");
assert.equal(pretty(undefined), "");

// kbd: a group per chord, a cap per key; glyphs in the UI font, the rest in mono; dim, framed; "/" as text.
const t = { dim: "#777777", border: "#333333" };
const k = kbd(t, "ctrl-b shift-o");
assert.ok(k.props.flex_none);
assert.equal(k.kids.length, 2, "two chords, two groups");
const [g1, g2] = k.kids;
assert.deepEqual(g1.kids.map((c) => c.kids[0]), ["⌃", "B"]);
assert.deepEqual(g2.kids.map((c) => c.kids[0]), ["⇧", "O"]);
assert.ok(k.props.gap[0] > g1.props.gap[0], "the chords further apart than a chord's keys");
const [ctrl, b] = g1.kids;
assert.deepEqual(ctrl.props.font_family, ["Inter"]);
assert.deepEqual(b.props.font_family, ["Monaspace Krypton"]);
assert.deepEqual(b.props.text_color, ["#777777"]);
assert.deepEqual(b.props.border_color, ["#333333"]);
assert.deepEqual([b.props.h, b.props.min_w], [[16], [16]]);
assert.ok(b.props.rounded && b.props.border && b.props.flex_none);
const vim = kbd(t, "j / k", { vim: true, h: 20 });
assert.equal(vim.kids.length, 3);
assert.deepEqual(vim.kids[1].kids, ["/"], "a choice's slash is text, not a cap");
assert.deepEqual(vim.kids[0].kids[0].kids, ["j"]);
assert.deepEqual(vim.kids[0].kids[0].props.h, [20]);
assert.equal(kbd(t, "").kids.length, 0, "no key: nothing drawn");
assert.equal(kbd(t, undefined).kids.length, 0);

// tip: the key after the words, or the words alone.
assert.equal(tip("Panneau latéral", "ctrl-b p"), "Panneau latéral · ⌃B P");
assert.equal(tip("Fermer", "cmd-w"), "Fermer · ⌘W");
assert.equal(tip("Détails", ""), "Détails");

console.log("shortcuts: ok");
