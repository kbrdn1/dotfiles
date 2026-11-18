// The threads' filter menu (kt-threads' filter icon opens it as a popup, Monocode's): Archivés,
// GROUPER PAR (Projet, the default, or Date: one of them), then three filter rows (filters.js:
// one scrolling line of pale pills each): STATUT (several, Tous = none), PÉRIODE (one), PROGRAMME
// (the programs running now, several, Tous = none). It writes shared "kt.threadFilter"
// { archived, group, status, period, programs }; kt-threads reads it.
// Keys (vim.js, NORMAL: no field): j / k (↓ ↑), gg / G, ctrl-d / ctrl-u move over the lines and the
// rows; on a row, h / l (← →) or tab / shift-tab move over its pills, which the row follows; enter,
// space or o checks the line or the pill under the cursor (l too on a line); q or esc closes; ? the
// keys (kt-keys, Modales). `kt-thread-filter.key:<keys>` feeds keys ("j j space"), for tests.
import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, shared, setShared, panes, props, closeOverlay, openOverlay, nextCommand, checking } from "herdr";
import { Vim, keyOf, keysOf, step } from "./vim.js";
import { filterRow, filterState, tintFor } from "./filters.js";
import { motionState, frame, sheet, leave } from "./motion.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const GROUP = ["project", "date"];
// Status tints are the theme's own status colors; the periods get one category tint each. Words:
// strings.js' status.<key> and period.<key>.
const STATUS = [["working", "working"], ["blocked", "blocked"], ["done", "done"]];
const PERIOD = [["all", null], ["today", "ansi3"], ["7d", "ansi4"], ["30d", "ansi5"]];
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;

function filterOf(s) {
  const f = s && typeof s === "object" ? s : {};
  return {
    archived: f.archived === true,
    group: f.group === "date" ? "date" : "project",
    status: Array.isArray(f.status) ? f.status : [],
    period: ["all", "today", "7d", "30d"].includes(f.period) ? f.period : "all",
    programs: Array.isArray(f.programs) ? f.programs : [],
  };
}
const flip = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
// Checks an option: its patch is worked out from the filter as it is now (two keys in a row both count).
const check = (patch) => {
  const f = filterOf(shared("kt.threadFilter"));
  setShared("kt.threadFilter", { ...f, ...patch(f) });
};

export default class ThreadFilter extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.vim = new Vim();
    this.cur = 0;
    this.opts = []; // the stops in the order shown: a line { id, patch } or a row { id, keys, patchOf }
    this.at = {}; // a row's pill under the cursor, by row id
    this.rows = { status: filterState(), period: filterState(), programs: filterState() };
    this.motion = motionState(); // motion.js sheet(): the popup fades and rises in, the reverse on dismiss
    // The popup isn't keyed yet in init: ask for the keyboard again, briefly, until it has it.
    this.handle.focus();
    for (const ms of [16, 50, 120, 250]) cx.timer.after(ms, () => { if (!this.handle.is_focused()) this.handle.focus(); });
    if (checking()) return;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) {
          this.handle.focus();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        }
        cx.notify();
      }
    });
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One key, from the keyboard or `key:` (a name): space checks, then vim's.
  press(e, cx) {
    if (keyOf(e).name === "space") return this.act("open", cx);
    return this.act(this.vim.handle(e), cx);
  }

  // motion.js leave(): the popup fades out and sinks, then closes.
  dismiss(cx) {
    leave(this.motion, cx, "tf", () => closeOverlay(props()?.overlay));
  }

  // One vim action; false: not one the menu has.
  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const o = this.opts[this.cur];
    const row = o?.keys;
    if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) this.cur = Math.max(0, step(a, this.cur, this.opts.length, this.vim.count, 8));
    // On a row: h / l and tab / shift-tab move over its pills (round), enter / o checks the one there.
    else if (row && ["left", "right", "tab-next", "tab-prev"].includes(a)) {
      const i = Math.max(0, row.indexOf(this.at[o.id]));
      this.at[o.id] = row[(i + (a === "right" || a === "tab-next" ? 1 : row.length - 1)) % row.length];
    } else if (row && a === "open") check(o.patchOf(this.at[o.id] ?? row[0]));
    else if (a === "open" || a === "right") { if (o) check(o.patch); }
    else if (a === "quit" || a === "escape") this.dismiss(cx);
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else return false;
    return true;
  }

  render() {
    const t = theme();
    const f = filterOf(shared("kt.threadFilter"));
    const keyed = this.handle.is_focused();
    const programs = [...new Map(panes().filter((p) => p.program?.agent).map((p) => [p.program.key, p.program])).values()];
    this.opts = [];
    // An option; under the keys' cursor (while the menu has the keyboard) a 1 px accent ring on the
    // kbrdn.dev ink, a transparent border elsewhere (no shift).
    const line = (id, label, on, patch, lead) => {
      const cursor = keyed && this.opts.length === this.cur;
      this.opts.push({ id, patch });
      return h_flex().id(id).h(32).px(10).gap(9).items_center().rounded(12).border(1)
        .border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
        .when(cursor, (el) => el.bg(alpha(t.accent, "24")))
        .text_size(13).text_color(on || cursor ? t.foreground : t.muted).cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => { check(patch); cx.notify(); })
        .when(Boolean(lead), (el) => el.child(lead))
        .child(div().flex_1().min_w(0).truncate().child(label))
        .when(on, (el) => el.child(svg("mods/kt-thread-filter/check.svg").size(13).flex_none().text_color(t.accent)));
    };
    const eyebrow = (s) => div().px(10).pt(6).pb(4).font_family(MONO).text_size(10.5).text_color(t.dim).child(s);
    const sep = () => div().mx(10).my(4).h(1).bg(t.border);
    // vim's mode, at the right of the first eyebrow while the menu has the keyboard (no height added).
    const mode = div().flex_none().h(16).mr(6).px(6).flex().items_center().rounded(5).border(1)
      .border_color(t.border).bg(t.background).font_family(MONO).text_size(9).text_color(t.muted).child(this.vim.label);
    const reduced = Boolean(shared("kt.reducedMotion"));
    // A filter row (filters.js), one keys' stop: « Tous » (key "all") is on when none is, and clears.
    // Under the cursor, its pill gets the accent ring and the row follows it.
    const row = (id, items, active, patchOf) => {
      const here = keyed && this.opts.length === this.cur;
      const keys = items.map((x) => x.key);
      if (!keys.includes(this.at[id])) this.at[id] = keys[0];
      this.opts.push({ id, keys, patchOf });
      return div().px(6).pb(2).child(filterRow({ id: `tf-${id}`, state: this.rows[id], t, bg: t.popover, reduced, items, active,
        cursor: here ? this.at[id] : null, onPick: (key) => check(patchOf(key)) }));
    };
    const many = (field) => (key) => (g) => ({ [field]: key === "all" ? [] : flip(g[field], key) });
    // A popup's motion (motion.js sheet): it fades in and rises 6 px once it has a size, the reverse on dismiss.
    const s = sheet(frame(this.motion, reduced), "tf", Boolean(this.size));
    const root = s.veil(s.card(v_flex().id("kt-thread-filter").w_full().p(4).gap(0).rounded(16).bg(t.popover).border(1).border_color(t.border)))
      .on_size_change((size, cx) => {
        if (this.size) return;
        this.size = size;
        cx.notify();
      })
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(line("tf-archived", tr("archived"), f.archived, (g) => ({ archived: !g.archived }),
        svg("mods/kt-thread-filter/archive.svg").size(14).flex_none()))
      .child(sep())
      .child(h_flex().items_center().child(eyebrow(tr("groupBy")).flex_1()).when(keyed, (el) => el.child(mode)))
      .children(GROUP.map((k) => line(`tf-grp-${k}`, tr(`group.${k}`), f.group === k, () => ({ group: k }))))
      .child(sep())
      .child(eyebrow(tr("status")))
      .child(row("status", [{ key: "all", label: tr("all") }, ...STATUS.map(([key, tint]) => ({ key, label: tr(`status.${key}`), tint }))],
        f.status.length ? f.status : "all", many("status")))
      .child(sep())
      .child(eyebrow(tr("period")))
      .child(row("period", PERIOD.map(([key, tint]) => ({ key, label: tr(`period.${key}`), tint })), f.period, (key) => () => ({ period: key })))
      .when(programs.length > 0, (el) => el.child(sep()).child(eyebrow(tr("program")))
        .child(row("programs", [{ key: "all", label: tr("all") }, ...programs.map((p) => ({ key: p.key, label: p.name, tint: tintFor(p.key) }))],
          f.programs.length ? f.programs : "all", many("programs"))))
      .child(div().h(4));
    // A program gone (its agent ended) can leave the cursor past the end.
    this.cur = Math.min(this.cur, Math.max(0, this.opts.length - 1));
    return root;
  }
}
