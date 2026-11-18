// The threads' filter menu (kt-threads' filter icon opens it as a popup, Monocode's): Archivés,
// GROUPER PAR (Projet, the default, or Date: one of them), STATUT (several, none = all), PÉRIODE,
// PROGRAMME (the programs running now, several, none = all). It writes shared "kt.threadFilter"
// { archived, group, status, period, programs }; kt-threads reads it.
// Keys (vim.js, NORMAL: no field): j / k (↓ ↑), gg / G, ctrl-d / ctrl-u move over the options;
// enter, space, l or o checks the one under the cursor; q or esc closes; ? the keys (kt-keys,
// Modales). `kt-thread-filter.key:<keys>` feeds keys ("j j space"), for tests.
import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, shared, setShared, panes, props, closeOverlay, openOverlay, nextCommand, checking } from "herdr";
import { Vim, keyOf, keysOf, step } from "./vim.js";

const MONO = "Monaspace Krypton";
const GROUP = [["project", "Projet"], ["date", "Date"]];
const STATUS = [["working", "Working"], ["blocked", "Needs approval"], ["done", "Done"]];
const PERIOD = [["all", "Tout"], ["today", "Aujourd'hui"], ["7d", "7 derniers jours"], ["30d", "30 derniers jours"]];
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
    this.opts = []; // the options in the order shown: { id, patch }
    // The popup isn't keyed yet in init: ask for the keyboard again, briefly, until it has it.
    this.handle.focus();
    for (const ms of [16, 50, 120, 250]) cx.timer.after(ms, () => { if (!this.handle.is_focused()) this.handle.focus(); });
    if (checking()) return;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) {
          this.handle.focus();
          for (const k of keysOf(c.slice(4))) this.press(k);
        }
        cx.notify();
      }
    });
  }

  key(e, cx) {
    if (!this.press(e)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One key, from the keyboard or `key:` (a name): space checks, then vim's.
  press(e) {
    if (keyOf(e).name === "space") return this.act("open");
    return this.act(this.vim.handle(e));
  }

  // One vim action; false: not one the menu has.
  act(a) {
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) this.cur = Math.max(0, step(a, this.cur, this.opts.length, this.vim.count, 8));
    else if (a === "open" || a === "right") { const o = this.opts[this.cur]; if (o) check(o.patch); }
    else if (a === "quit" || a === "escape") closeOverlay(props()?.overlay);
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
    const eyebrow = (s) => div().px(10).pt(6).pb(2).font_family(MONO).text_size(10.5).text_color(t.dim).child(s);
    const sep = () => div().mx(10).my(4).h(1).bg(t.border);
    // vim's mode, at the right of the first eyebrow while the menu has the keyboard (no height added).
    const mode = div().flex_none().h(16).mr(6).px(6).flex().items_center().rounded(5).border(1)
      .border_color(t.border).bg(t.background).font_family(MONO).text_size(9).text_color(t.muted).child(this.vim.label);
    // The program's tile, as the cards draw it (Herdr's own icon on its own color).
    const tile = (p) => div().w(18).h(15).flex_none().rounded(4).bg(p.tile ?? t.raised).flex().items_center().justify_center()
      .child(p.icon ? (p.tint ? svg(p.icon).size(10).text_color(p.color ?? "#ffffff") : image(p.icon).w(10).h(10)) : div());
    const root = v_flex().id("kt-thread-filter").w_full().p(4).gap(0).rounded(16).bg(t.popover).border(1).border_color(t.border)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(line("tf-archived", "Archivés", f.archived, (g) => ({ archived: !g.archived }),
        svg("mods/kt-thread-filter/archive.svg").size(14).flex_none()))
      .child(sep())
      .child(h_flex().items_center().child(eyebrow("GROUPER PAR").flex_1()).when(keyed, (el) => el.child(mode)))
      .children(GROUP.map(([k, label]) => line(`tf-grp-${k}`, label, f.group === k, () => ({ group: k }))))
      .child(sep())
      .child(eyebrow("STATUT"))
      .children(STATUS.map(([k, label]) => line(`tf-s-${k}`, label, f.status.includes(k), (g) => ({ status: flip(g.status, k) }))))
      .child(sep())
      .child(eyebrow("PÉRIODE"))
      .children(PERIOD.map(([k, label]) => line(`tf-p-${k}`, label, f.period === k, () => ({ period: k }))))
      .when(programs.length > 0, (el) => el.child(sep()).child(eyebrow("PROGRAMME"))
        .children(programs.map((p) => line(`tf-g-${p.key}`, p.name, f.programs.includes(p.key), (g) => ({ programs: flip(g.programs, p.key) }), tile(p)))));
    // A program gone (its agent ended) can leave the cursor past the end.
    this.cur = Math.min(this.cur, Math.max(0, this.opts.length - 1));
    return root;
  }
}
