// vim.js: the vim keys every kt-* mod shares. Written once in mods/kt-keys/vim.js and copied
// byte for byte into each mod that uses it (a mod can't import from another folder): edit here,
// then copy. Pure: no herdr, no gpui-kit, no module state (copies of a mod share module code),
// so Bun checks it (vim.check.mjs).
//
// One Vim per mod copy: `this.vim = new Vim({ field })`. `handle(e)` takes an on_key_down event
// (or a key name, for `<mod>.key:<keys>`) and answers an action name, or null when the key isn't
// a vim key (then don't stop it: ctrl-b, cmd-* and the app's keys must go on). `count` is the
// count typed before it (5j), 1 without. "pending" / "count" are keys consumed while a `gg`, `dd`
// or a count is being typed: stop them, do nothing else.
//
// Normal: j k ↓ ↑ down/up · gg G top/bottom · ctrl-d ctrl-u half-down/half-up · h l ← → left/right
// · enter o open · O open-alt · / filter (with a field: insert mode) · n N next/prev · tab
// shift-tab tab-next/tab-prev · [ ] panel-prev/panel-next · y yank · r refresh · dd x delete
// · a archive · q quit · esc escape · ? help · H L scroll-left/scroll-right · digits: a count.
// Insert: esc normal (back to normal mode) · enter submit · ctrl-n ctrl-j ↓ down · ctrl-p ctrl-k ↑
// up · tab shift-tab tab-next/tab-prev · backspace · a character: type (in `char`).

const WAIT = 600; // ms between the two keys of gg / dd
const NAMED = new Set(["escape", "enter", "tab", "backspace", "delete", "up", "down", "left", "right", "home", "end", "pageup", "pagedown", "space"]);
const NORMAL = {
  j: "down", down: "down", k: "up", up: "up", G: "bottom", home: "top", end: "bottom",
  "ctrl-d": "half-down", "ctrl-u": "half-up", pagedown: "half-down", pageup: "half-up",
  h: "left", left: "left", l: "right", right: "right",
  enter: "open", o: "open", O: "open-alt", n: "next", N: "prev",
  tab: "tab-next", "shift-tab": "tab-prev", "[": "panel-prev", "]": "panel-next",
  y: "yank", r: "refresh", x: "delete", a: "archive", q: "quit", escape: "escape", "?": "help",
  H: "scroll-left", L: "scroll-right",
};
const INSERT = {
  enter: "submit", "ctrl-n": "down", "ctrl-j": "down", down: "down", "ctrl-p": "up", "ctrl-k": "up", up: "up",
  tab: "tab-next", "shift-tab": "tab-prev", backspace: "backspace",
};

// A key event -> { name, char }: "j", "G", "?", "ctrl-d", "shift-tab", "escape"; `char` is what it
// types (null for a chord or a named key). A string is already a name ("space" types " ").
export function keyOf(e) {
  if (typeof e === "string") return { name: e, char: e === "space" ? " " : [...e].length === 1 ? e : null };
  const m = e?.modifiers ?? {};
  if (m.control || m.platform) return { name: e.keystroke, char: null };
  if (NAMED.has(e.key)) return { name: m.shift && e.key === "tab" ? "shift-tab" : e.key, char: e.key === "space" ? " " : null };
  const char = e.key_char ?? (m.shift && e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return { name: m.alt && !e.key_char ? e.keystroke : char, char: e.key_char ?? null };
}

// `<mod>.key:<keys>`: "g g", "5 j", "ctrl-d": the key names, space separated.
export const keysOf = (arg) => String(arg ?? "").split(" ").filter(Boolean);

// A cursor moved by an action over n rows; `page`: the rows a screen shows (half of it for ctrl-d).
export function step(action, i, n, count = 1, page = 10) {
  if (n <= 0) return -1;
  const at = i < 0 || i >= n ? (action === "up" || action === "bottom" ? n : -1) : i;
  const half = Math.max(1, Math.floor(page / 2)) * count;
  const to = action === "down" ? at + count : action === "up" ? at - count : action === "top" ? 0 : action === "bottom" ? n - 1
    : action === "half-down" ? at + half : action === "half-up" ? at - half : at;
  return Math.max(0, Math.min(n - 1, to));
}

export class Vim {
  // field: the mod has a field `/` goes to; insert: start in insert mode (a dialog with a field);
  // counts: digits make a count (off where digits mean something else, kt-viewer's zoom).
  constructor({ field = false, insert = false, counts = true, now = () => Date.now() } = {}) {
    this.field = field;
    this.counts = counts;
    this.now = now;
    this.mode = field && insert ? "insert" : "normal";
    this.pending = null; // "g" | "d", the first key of gg / dd
    this.at = 0;
    this.digits = "";
    this.count = 1;
    this.char = null;
  }

  get insert() { return this.mode === "insert"; }
  get label() { return this.insert ? "INSERT" : "NORMAL"; }
  normal() { this.mode = "normal"; this.pending = null; this.digits = ""; }
  edit() { if (this.field) this.mode = "insert"; this.pending = null; this.digits = ""; }

  handle(e) {
    const { name, char } = keyOf(e);
    if (this.insert) {
      if (name === "escape") { this.normal(); return "normal"; }
      const a = INSERT[name];
      if (a) return a;
      // Typing: a character without ctrl / cmd (option's characters type, as on a Mac).
      if (char && !/^(ctrl|cmd)-/.test(name)) { this.char = char; return "type"; }
      return null;
    }
    const now = this.now();
    const first = this.pending && now - this.at <= WAIT ? this.pending : null;
    this.pending = null;
    if (first && name === first) return this.done(first === "g" ? "top" : "delete");
    if (name === "g" || name === "d") {
      this.pending = name;
      this.at = now;
      return "pending";
    }
    if (this.counts && /^[0-9]$/.test(name) && (name !== "0" || this.digits)) {
      this.digits += name;
      return "count";
    }
    if (name === "/") {
      if (!this.field) return this.drop();
      this.edit();
      return "filter";
    }
    const a = NORMAL[name];
    return a ? this.done(a) : this.drop();
  }

  done(action) {
    this.count = Math.max(1, Number(this.digits) || 1);
    this.digits = "";
    return action;
  }

  drop() {
    this.digits = "";
    return null;
  }
}
