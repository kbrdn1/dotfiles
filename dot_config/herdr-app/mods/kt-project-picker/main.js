// kbrdn Threads' project picker: the popup kt-threads opens from the shown project ("Home ▾").
// What its fold-out was, floating: Home first; the open projects by machine (a header only once
// there are several), worktrees under their repo, status dots and thread counts; the registry's
// closed projects, dimmed (a click opens them again); then New project and Manage projects. A
// registry project's line drags to reorder (shared "kt.projects", as in kt-threads). Picking
// shows the thread again and closes the popup; so does a click outside it.
// Props: { real, homeReal, repos }, kt-threads' maps (same keys and values): Home, projects and
// worktrees are worked out exactly as there. spaces() and the registry are read live.
// A filter on top (name, branch, machine) has the keyboard when it opens (INSERT).
// Keys (vim.js): INSERT: type to filter; ctrl-n / ctrl-p, ctrl-j / ctrl-k, ↓ ↑ move; enter opens;
// esc: NORMAL. NORMAL: j / k, gg / G, ctrl-d / ctrl-u, n / N move; enter, o or l opens; / (or k
// on the first line) back to the filter; q or esc closes; ? the keys (kt-keys, Modales).
// `kt-project-picker.key:<keys>` feeds keys, space separated ("escape j enter"), for tests.
// Its height, unfiltered: 118 + 33 per line + 25 per eyebrow (a machine header, FERMÉS).

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { spaces, run, theme, shared, setShared, openOverlay, closeOverlay, props, home, checking, nextCommand, settings } from "herdr";
import { Vim, keysOf, step } from "./vim.js";
import { motionState, frame, sheet, leave, leaving, rows } from "./motion.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const show = (child) => run("layout.select", { stack: "view", child });
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
// A registry color: a theme name ("ansi6", "accent") or a #hex.
const paint = (t, c) => (!c ? null : c.startsWith("#") ? c : t[c] ?? null);

// kt-threads' projects registry (shared "kt.projects"): [{ id, name, folder, machine, color, logos,
// order }], id = [machine, the folder's real path].
const registry = () => [...(shared("kt.projects") ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const where = (s) => JSON.stringify([s.machine ?? null, s.folder]);
// `from` takes `to`'s place in the registry (after it going down, before it going up).
function reorder(fromId, toId) {
  const list = registry();
  const i = list.findIndex((e) => e.id === fromId);
  const j = list.findIndex((e) => e.id === toId);
  if (i < 0 || j < 0 || i === j) return;
  list.splice(j, 0, ...list.splice(i, 1));
  setShared("kt.projects", list.map((e, k) => ({ ...e, order: k })));
}
// A project's logo for the appearance now: its own, else the other mode's; null for none.
function logoOf(e) {
  const l = e?.logos ?? { light: e?.logo ?? null, dark: e?.logo ?? null };
  return (settings().dark ? (l.dark ?? l.light) : (l.light ?? l.dark)) ?? null;
}
// A space's color, read only: kt-threads gives each space one (shared "space.colors") before this opens.
const PROJECT_COLORS = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
function spaceColor(t, p) {
  if (p.name === "~") return t.dim;
  const c = (shared("space.colors") ?? {})[p.id] ?? PROJECT_COLORS[0];
  return c.startsWith("#") ? c : t[c];
}

export default class ProjectPicker extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.real = p.real ?? {}; // where(space) -> [machine, its folder's real path], null: unresolved
    this.homeReal = p.homeReal ?? null; // home()'s real path
    this.repos = p.repos ?? {}; // [machine, folder] -> { key, name, linked } | null (not git)
    this.handle = cx.focus_handle();
    this.scroll = ScrollHandle.new();
    this.vim = new Vim({ field: true, insert: true });
    this.query = "";
    this.cur = null; // the cursor's line in this.rows; null: the shown project's, at the first render
    this.rows = []; // the lines the cursor walks, in order: { open, on }
    this.pressed = null; // the line a drag started on (a registry id)
    this.over = null;
    this.motion = motionState(); // motion.js sheet(): the card fades in, and out on dismiss
    // The popup isn't keyed yet in init: ask for the keyboard again, briefly, until it has it.
    this.handle.focus();
    for (const ms of [16, 50, 120, 250]) cx.timer.after(ms, () => { if (!this.handle.is_focused()) this.handle.focus(); });
    // The keyboard gone without a render (a dialog over it): the cursor's ring goes out.
    cx.timer.every(500, (cx) => { if (this.keyed !== this.handle.is_focused()) cx.notify(); });
    if (checking()) return;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) {
          this.handle.focus();
          for (const k of keysOf(c.slice(4))) this.act(this.vim.handle(k), cx);
        }
        cx.notify();
      }
    });
  }

  // motion.js leave(): the card fades out, then the popup closes.
  dismiss(cx) {
    leave(this.motion, cx, "pp", () => closeOverlay(props().overlay));
  }

  // ---------- what a line does ----------

  // Not again while the popup leaves: a double click would run it twice (a second space.new).
  select(s, cx) {
    if (leaving(this.motion, "pp")) return;
    show("thread");
    run("space.select", { id: s.id });
    this.dismiss(cx);
  }

  reopen(e, cx) {
    if (leaving(this.motion, "pp")) return;
    show("thread");
    run("space.new", { folder: e.folder, name: e.name, machine: e.machine ?? "" });
    this.dismiss(cx);
  }

  // The system's folder picker is asked by kt-threads (`kt-threads.new-project`), which outlives this
  // popup: a popup closed while the picker is up (the window loses focus) would cancel the wait here.
  // Closed at once, not by leave(): the folder picker takes the window's focus right away.
  newProject() {
    show("thread");
    closeOverlay(props().overlay);
    run("kt-threads.new-project");
  }

  // Closed at once, not by leave(): kt-projects takes the keyboard once, in its init, and a popup
  // closing after it would hand the keyboard back to what is under.
  manage() {
    openOverlay({ mod: "kt-projects", kind: "dialog", width: 1, height: 1, frame: "none" });
    closeOverlay(props().overlay);
  }

  // ---------- keys (vim.js; kt-keys lists them under Modales) ----------

  key(e, cx) {
    if (!this.act(this.vim.handle(e), cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One vim action; false: not one the picker has, and the key goes on.
  act(a, cx) {
    if (!a) return false;
    // "filter": vim is in INSERT already; "normal": esc in INSERT, the popup stays.
    if (a === "pending" || a === "count" || a === "filter" || a === "normal") return true;
    this.model(theme()); // the lines for the filter as it is now (keys can come faster than renders)
    const cur = this.cur;
    if (a === "type" || a === "backspace") {
      this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
      this.cur = 0;
      this.reveal = true;
    } else if (a === "up" && !this.vim.insert && cur === 0) this.vim.edit(); // k on the first line: the filter
    else if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev"].includes(a)) {
      const j = step(a === "next" ? "down" : a === "prev" ? "up" : a, cur, this.rows.length, this.vim.count, 10);
      if (j >= 0) this.cur = j;
      this.reveal = true;
    } else if (a === "submit" || a === "open" || a === "right") this.rows[cur]?.open(cx);
    else if (a === "quit" || a === "escape") this.dismiss(cx);
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else return false;
    return true;
  }

  // ---------- kt-threads' project model, as there ----------

  // The Home space: its folder is this computer's home (a remote machine's home isn't known here).
  isHome(s) {
    if (s.machine) return false;
    return s.folder === home() || (this.homeReal !== null && this.real[where(s)] === JSON.stringify([null, this.homeReal]));
  }

  homeLabel(s) {
    return s.named ? s.name : "Home";
  }

  // A space's registry entry (by project, else by its folder as written while that's unknown).
  entryOf(s, reg) {
    const id = this.projectId(s);
    return reg.find((e) => (id ? e.id === id : e.folder === s.folder && (e.machine ?? null) === (s.machine ?? null))) ?? null;
  }

  // The folder's repo of a space (where it was made), or null outside git.
  spaceRepo(s) {
    return this.repos[JSON.stringify([s.machine ?? null, s.folder])] ?? null;
  }

  // A space's project, as the registry ids it: its repo's main checkout, else its folder's real
  // path; null while that's being worked out.
  projectId(s) {
    const r = this.spaceRepo(s);
    if (r) return JSON.stringify([s.machine ?? null, JSON.parse(r.key)[1].replace(/\/\.git$/, "")]);
    return r === null ? (this.real[where(s)] ?? null) : null;
  }

  // Spaces grouped by project: its first plain checkout on top, then its other spaces.
  projectTree(ps) {
    const groups = new Map();
    for (const s of ps) {
      const id = this.projectId(s) ?? `space:${s.id}`;
      const g = groups.get(id);
      if (!g) groups.set(id, { s, kids: [] });
      else if (!this.spaceRepo(s)?.linked && this.spaceRepo(g.s)?.linked) { g.kids.unshift(g.s); g.s = s; }
      else g.kids.push(s);
    }
    return [...groups.values()];
  }

  // ---------- lines ----------

  statusDots(t, id, tabs) {
    return ["working", "blocked", "done"].filter((st) => tabs.some((c) => c.status === st)).map((st) =>
      div().id(`pp-dot-${id}-${st}`).size(6).rounded(3).flex_none().bg(t[st]));
  }

  // A project's mark: its logo, else its color square.
  mark(t, e, color, size) {
    const logo = logoOf(e);
    // The selector's own: a logo at 16 px, else the color square.
    return logo ? image(logo).size(16).flex_none().rounded(3) : div().size(size).rounded(2).flex_none().bg(color);
  }

  // A 32 px line, radius 12 in the 16 card (4 px in). `on`: the shown project, on the kbrdn.dev ink.
  // `cursor`: under the keys' cursor while the popup has the keyboard, a 1 px accent ring on the
  // ink; a transparent border elsewhere (no shift: 7 px + the border is the fold-out's 8).
  // `ink`: the text color on hover, if it changes.
  base(id, t, on, cursor, ink) {
    return h_flex().id(id).h(32).px(7).gap(8).items_center().rounded(12).border(1)
      .border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
      .when(on || cursor, (el) => el.bg(alpha(t.accent, "24")))
      .cursor_pointer()
      .when(!on && !cursor, (el) => el.hover((st) => (ink ? st.bg(t.hover).text_color(ink) : st.bg(t.hover))));
  }

  // A registry project's line drags: pressed here, moved over another (a 2 px accent bar where it
  // lands), released there rewrites the order; a press released where it began is a click.
  draggable(el, t, e, onClick) {
    const order = this.pickOrder ?? [];
    const from = order.indexOf(this.pressed);
    const at = order.indexOf(e.id);
    return el
      .relative()
      .when(this.pressed === e.id && this.over !== e.id, (el) => el.opacity(0.5))
      .when(this.pressed !== null && this.over === e.id && this.pressed !== e.id, (el) => el.child(
        div().absolute().left(6).right(6).h(2).rounded(1).bg(t.accent).when(from < at, (b) => b.bottom(-1)).when(from > at, (b) => b.top(-1))))
      .on_mouse_down("left", () => { this.pressed = e.id; this.over = e.id; })
      .on_mouse_move((_ev, cx) => {
        if (this.pressed !== null && this.over !== e.id) { this.over = e.id; cx.notify(); }
      })
      .on_mouse_up("left", (_ev, cx) => {
        const src = this.pressed;
        this.pressed = null;
        this.over = null;
        if (src !== null && src !== e.id) reorder(src, e.id);
        else if (src === e.id) onClick(cx);
        cx.notify();
      });
  }

  // Home: a house (accent when shown), "Home" or the name it was given; no project color, no drag.
  homeLine(t, s, cursor) {
    return this.base(`pp-home-${s.id}`, t, s.active, cursor)
      .on_click((_e, cx) => this.select(s, cx))
      .child(svg(I("house")).size(14).flex_none().text_color(s.active ? t.accent : t.muted))
      .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(s.active || cursor ? t.foreground : t.muted).child(this.homeLabel(s)))
      .children(this.statusDots(t, s.id, s.tabs))
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child(String(s.tabs.length)));
  }

  // A space: color, name, branch, its status dots, how many threads. Under its project, a worktree
  // with its branch mark, a second space on the folder bare.
  projectLine(t, s, kid, e, cursor) {
    const line = this.base(`pp-${s.id}`, t, s.active, cursor);
    return (e && !kid ? this.draggable(line, t, e, (cx) => this.select(s, cx)) : line.on_click((_e, cx) => this.select(s, cx)))
      .when(kid, (el) => el.pl(15).child(svg(I("git-branch")).size(12).flex_none().text_color(this.spaceRepo(s)?.linked ? t.dim : alpha(t.dim, "00"))))
      .when(!kid, (el) => el.child(this.mark(t, e, spaceColor(t, s), 8)))
      .child(div().flex_none().max_w(120).truncate().text_size(13).text_color(s.active || cursor ? t.foreground : t.muted).child(s.name))
      .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(s.branch ?? ""))
      .children(this.statusDots(t, s.id, s.tabs))
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child(String(s.tabs.length)));
  }

  // A closed project of the registry, dimmed: a click opens it again as a space.
  closedLine(t, e, i, cursor) {
    const line = this.base(`pp-closed-${i}`, t, false, cursor, t.muted).text_color(cursor ? t.muted : t.dim);
    return this.draggable(line, t, e, (cx) => this.reopen(e, cx))
      .child(div().opacity(0.5).child(this.mark(t, e, paint(t, e.color) ?? t.dim, 8)))
      .child(div().flex_none().max_w(120).truncate().text_size(13).child(e.name))
      .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(10.5).child(e.machine ?? ""))
      .child(div().flex_none().font_family(MONO).text_size(10.5).child(tr("closed")));
  }

  // The lines for the filter as it is now, and the cursor kept among them.
  model(t) {
    const q = this.query.trim().toLowerCase();
    const hit = (...s) => !q || s.some((x) => x && String(x).toLowerCase().includes(q));
    // kt-threads' fold-out: Home first, on its own; the rest are projects, by machine, worktrees
    // under their repo, in the registry's order; then the registry's closed projects.
    const all = spaces();
    const homes = all.filter((s) => this.isHome(s));
    const ps = all.filter((s) => !this.isHome(s));
    const names = [...new Set(ps.map((s) => s.machine).filter(Boolean))].sort();
    const groups = [...(ps.some((s) => !s.machine) ? [null] : []), ...names];
    const reg = registry();
    const rank = (s) => reg.indexOf(this.entryOf(s, reg)) >>> 0; // not in it (-1): last
    const closed = reg.filter((e) => !ps.some((s) => this.entryOf(s, reg) === e));
    const trees = groups.map((m) => this.projectTree(ps.filter((s) => (s.machine ?? null) === m)).sort((a, b) => rank(a.s) - rank(b.s)));
    // The list as shown, filtered line by line: { head } an eyebrow, else a line the cursor stops
    // on ({ draw(cursor), open, on, drag: its registry id when it drags }).
    const list = [];
    // `key`: each entry's, stable, for rows() (motion.js): lines open and close on their height as the
    // filter changes.
    for (const s of homes) if (hit(this.homeLabel(s), s.branch)) list.push({ key: `home:${s.id}`, on: s.active, open: (cx) => this.select(s, cx), draw: (c) => this.homeLine(t, s, c) });
    groups.forEach((m, gi) => {
      const shown = trees[gi].flatMap(({ s, kids }) => [
        ...(hit(s.name, s.branch, s.machine) ? [{ s, kid: false, e: this.entryOf(s, reg) }] : []),
        ...kids.filter((k) => hit(k.name, k.branch, k.machine)).map((k) => ({ s: k, kid: true, e: null })),
      ]);
      if (shown.length && groups.length > 1) list.push({ key: `head:${m ?? ""}`, head: (m ?? tr("thisComputer")).toUpperCase(), n: shown.length });
      for (const x of shown) list.push({ key: `space:${x.s.id}`, on: x.s.active, drag: x.kid ? null : x.e?.id, open: (cx) => this.select(x.s, cx), draw: (c) => this.projectLine(t, x.s, x.kid, x.e, c) });
    });
    const gone = closed.map((e, i) => ({ e, i })).filter(({ e }) => hit(e.name, e.machine));
    if (gone.length) list.push({ key: "head:closed", head: tr("closedGroup"), n: gone.length });
    for (const { e, i } of gone) list.push({ key: `closed:${e.id}`, drag: e.id, open: (cx) => this.reopen(e, cx), draw: (c) => this.closedLine(t, e, i, c) });
    // The draggable lines in the order shown, for the drop bar's side.
    this.pickOrder = list.map((x) => x.drag);
    // Under a dashed rule, always there whatever the filter: New project, Manage projects.
    const action = (id, icon, label, open) => ({
      open,
      draw: (c) => this.base(id, t, false, c, t.foreground).text_size(13).text_color(c ? t.foreground : t.muted)
        .on_click((_e, cx) => open(cx))
        .child(svg(I(icon)).size(14).flex_none())
        .child(label),
    });
    const foot = [
      action("pp-new", "plus", tr("newProject"), () => this.newProject()),
      action("pp-manage", "settings", tr("manage"), () => this.manage()),
    ];
    // The cursor: the shown project's line at first, then wherever the keys put it.
    const lines = list.filter((x) => x.open);
    this.rows = [...lines, ...foot];
    if (this.cur === null) this.cur = Math.max(0, this.rows.findIndex((r) => r.on));
    this.cur = Math.min(this.cur, this.rows.length - 1);
    return { list, foot, lines, q };
  }

  render(cx) {
    const t = theme();
    const keyed = (this.keyed = this.handle.is_focused());
    const typing = this.vim.insert;
    const { list, foot, lines, q } = this.model(t);
    // 24 px (6 + 16 + 2): the height stays a sum of whole lines (kt-threads' formula). The section's
    // name, how many lines it has, a dashed rule (h 0: it adds nothing to the height).
    const eyebrow = (text, n) => h_flex().flex_none().h(24).px(8).pt(6).pb(2).gap(8).items_center().font_family(MONO).text_size(10.5).line_height("16px")
      .child(div().flex_none().text_color(t.dim).child(text))
      .when(n != null, (el) => el.child(div().flex_none().text_color(t.muted).child(String(n))))
      .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(alpha(t.border, "99")));
    // Nothing to list, said plainly: what the filter missed, or that there is nothing yet.
    const empty = v_flex().id("pp-empty").flex_none().px(9).py(10).gap(4)
      .child(h_flex().gap(8).items_center()
        .child(svg(I(q ? "list-filter" : "folder-plus")).size(14).flex_none().text_color(q ? t.dim : t.accent))
        .child(div().min_w(0).truncate().text_size(13).font_medium().text_color(t.foreground).child(q ? tr("noMatch") : tr("noProject"))))
      .child(div().pl(22).max_w(340).text_size(13).line_height("20px").text_color(t.muted)
        .child(q ? tr("noMatchText", { q: this.query.trim() }) : tr("noProjectText")));
    // The popups' motion (motion.js sheet): the card fades in, once, on its first size report, and out
    // on dismiss; no rise (only veil(), on the card): the card fills the overlay's box, a rise would
    // be clipped. Reduced motion: at once.
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const s = sheet(m, "pp", Boolean(this.size));
    // The cursor's line rank (lines only, eyebrows skipped) by the entry's place in the list.
    const lineOf = new Map();
    let k = 0;
    list.forEach((x, slot) => { if (x.open) lineOf.set(slot, k++); });
    // The lines open and close on their height, in order, as the filter changes (motion.js rows(): 12
    // entries at most, else at once). rows() builds them in the order of its children, a closing line
    // included: `child` is a line's index among them, for scroll_to_item.
    let child = 0;
    const items = rows(m, cx, "pp-items", list, (x) => x.key, (x, slot) => {
      const at = child++;
      if (!x.open) return eyebrow(x.head, x.n);
      const i = slot < 0 ? -1 : lineOf.get(slot);
      // The cursor's line comes into view once after it moved.
      if (this.reveal && i === this.cur) this.scroll.scroll_to_item(at);
      return x.draw(keyed && i === this.cur);
    });
    this.reveal = false;
    // The filter: typing goes there in INSERT (its ring then); vim's mode at its right, mono 9 px.
    const mode = div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(this.vim.label);
    const field = h_flex().id("pp-filter").flex_none().h(32).px(10).gap(8).items_center().rounded(12).border(1)
      .border_color(keyed && typing ? alpha(t.accent, "99") : t.border).bg(t.background).cursor_text()
      .on_click((_e, cx) => { this.vim.edit(); this.handle.focus(); cx.notify(); })
      .child(svg(I("list-filter")).size(14).flex_none().text_color(t.dim))
      .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
        .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : tr("filter")))
      .child(mode);
    // The card fills the popup (radius 16, 4 px in: lines 12). Height: border 1 + 4, the field 32,
    // 4, the list (32 a line, 24 an eyebrow, 1 between), 4, the foot (rule 1 + 2, 1, 32, 1, 32),
    // 4 + border 1: 118 + 33 × lines + 25 × eyebrows.
    // A popup is as tall as its content (`height` is only its most): the card takes the height
    // kt-threads gave the popup (props.height), else its list (a flex_1 scroll area) would be 0.
    return s.veil(v_flex()
      .id("pp-card")
      .w_full()
      .when(Boolean(props()?.height), (el) => el.h(props().height))
      .when(!props()?.height, (el) => el.size_full())
      .p(4)
      .gap(4)
      .rounded(16)
      .border(1)
      .border_color(t.border)
      .bg(t.popover)
      .shadow_lg()
      .text_color(t.foreground)
      .on_size_change((size, cx) => {
        this.size = size;
        cx.notify();
      }))
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      // A drag let go outside a line ends there.
      .on_mouse_up("left", (_e, cx) => { if (this.pressed != null) { this.pressed = null; this.over = null; cx.notify(); } })
      .child(field)
      .child(v_flex().id("pp-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).gap(1)
        .children(items.length ? items : [empty]))
      .child(v_flex().flex_none().gap(1)
        .child(div().mx(8).mb(2).h(0).border_t(1).border_dashed().border_color(t.border))
        .children(foot.map((x, j) => x.draw(keyed && lines.length + j === this.cur))));
  }
}
