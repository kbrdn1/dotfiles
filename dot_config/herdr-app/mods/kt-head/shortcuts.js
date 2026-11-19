// shortcuts.js: the key bound to an action, read from keys() (keys.json), and drawn the same in every mod
// as keycaps (kbd). Written once in mods/kt-keys/shortcuts.js and copied byte for byte into each mod that
// uses it (edit here, copy, cmp). Bun checks it (shortcuts.check.mjs). No herdr import: the caller hands
// keys() and the shown layout.
//
//   import { keys, shared, theme } from "herdr";
//   const k = shortcut(keys(), shared("layout"), "layout.select:inbox");   // "ctrl-b i", "" when none
//   line.child(div().flex_1().child(name)).child(kbd(theme(), k))           // ⌃ B  I; nothing for ""
//   el.tooltip(tip(tr("panel"), shortcut(keys(), shared("layout"), "layout.toggle:panel")))
//
// An action is keys.json's in one word (actionKey): "tab.rename", "pane.split:right", and for an object
// binding its command and its child, name or id ("layout.select:inbox", "mod.open:kt-new"). Several
// actions: the first one that has a key. Which key: the shown layout's section before global (a global key
// the layout binds again is the layout's), a ctrl-b one before the others (vim first, KEYMAP.md), then
// keys()' order. Never written by hand: a key changed in keys.json shows everywhere.
//
// kbd: a keycap per key (a thin rounded frame, dim), a chord's keys side by side, the chords of a sequence
// ("ctrl-b", then "i") a little apart, "/" between choices as plain text. Modifiers and named keys are
// glyphs (⌃ ⌥ ⇧ ⌘ ↵ ⇥ ⎋ ␣ ⌫ ← → ↑ ↓), drawn in the layout's UI font (Inter): Monaspace Krypton, the mono
// font, has only the arrows and ↩ (fc-list, 2026-11-19). The rest in mono, a letter as a capital, unless
// `vim` (the help's vim keys, where g and G differ): then a key alone stays as written. A tooltip takes text
// only (gpui-kit): pretty() writes the same glyphs there (⌃B F), in the shell's font (Inter, which has them).

import { div } from "gpui-kit";

const MONO = "Monaspace Krypton";
const UI = "Inter";

/** keys.json's action as one word: `command:arg` for an object binding, tab.select without its index. */
export function actionKey(action) {
  if (action.startsWith("send:")) return "send";
  if (!action.startsWith("{")) return /^tab\.select:/.test(action) ? "tab.select" : action;
  try {
    const o = JSON.parse(action);
    const arg = o.args?.child ?? o.args?.name ?? o.args?.id;
    return arg ? `${o.command}:${arg}` : o.command;
  } catch {
    return action;
  }
}

/** The keys bound to the first of `actions` that has some, as keys.json writes them; "" when none. */
export function shortcut(binds, layout, ...actions) {
  const local = `layout:${layout ?? "kbrdn-threads"}`;
  const own = new Set((binds ?? []).filter((b) => b.section === local).map((b) => b.keys));
  const live = (binds ?? []).filter((b) => b.section === local || (b.section === "global" && !own.has(b.keys)));
  const rank = (b) => (b.section === local ? 0 : 2) + (b.keys.startsWith("ctrl-b ") ? 0 : 1);
  for (const a of actions.flat()) {
    const found = live.filter((b) => actionKey(b.action) === a);
    if (found.length) return found.reduce((best, b) => (rank(b) < rank(best) ? b : best)).keys;
  }
  return "";
}

const MODS = ["ctrl", "alt", "shift", "cmd"]; // the Mac's order
const GLYPH = { ctrl: "⌃", alt: "⌥", shift: "⇧", cmd: "⌘" };
const NAMED = { left: "←", right: "→", up: "↑", down: "↓", enter: "↵", escape: "⎋", tab: "⇥", backspace: "⌫", space: "␣" };

/** A chord ("cmd-shift-w") as its keys: [{ text, glyph }], modifiers in the Mac's order, then the key. */
export function capsOf(chord, { vim = false } = {}) {
  const [, head, key] = /^((?:(?:ctrl|alt|shift|cmd)-)*)(.+)$/.exec(chord);
  const mods = head.split("-").filter(Boolean);
  const named = NAMED[key];
  const last = named ? { text: named, glyph: true } : { text: vim && !mods.length ? key : key.length === 1 ? key.toUpperCase() : key.replace(/^f(\d+)$/, "F$1"), glyph: false };
  return [...MODS.filter((m) => mods.includes(m)).map((m) => ({ text: GLYPH[m], glyph: true })), last];
}

/** The keycaps as text, for what takes no element (a tooltip is a string): each chord's glyphs side by side,
 *  the chords apart, as kbd() draws them ("ctrl-b f" is ⌃B F, "cmd-shift-w" ⇧⌘W). */
export function pretty(keys) {
  return String(keys ?? "").split(" ").filter(Boolean).map((chord) => capsOf(chord).map((c) => c.text).join("")).join(" ");
}

/** The keycaps of `keys` ("ctrl-b i", "cmd-t", "j / k"): an empty element when there are none. `h`: a cap's
 *  height (16 at a line's end, larger in the help). */
export function kbd(t, keys, { vim = false, h = 16 } = {}) {
  const cap = (c) => div().flex_none().h(h).min_w(h).px(Math.round(h / 5)).flex().items_center().justify_center()
    .rounded(Math.round(h / 4)).border(1).border_color(t.border).font_family(c.glyph ? UI : MONO)
    .text_size(Math.round(h * 0.62)).text_color(t.dim).child(c.text);
  return div().flex().flex_row().flex_none().items_center().gap(Math.round(h / 3))
    .children(String(keys ?? "").split(" ").filter(Boolean).map((chord) => (chord === "/"
      ? div().text_size(Math.round(h * 0.62)).text_color(t.dim).child("/")
      : div().flex().flex_row().flex_none().items_center().gap(2).children(capsOf(chord, { vim }).map(cap)))));
}

/** A tooltip with its key after it: "Panneau latéral · ⌃B P". */
export const tip = (text, keys) => (keys ? `${text} · ${pretty(keys)}` : text);
