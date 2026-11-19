// kbrdn Threads' keys (ctrl-b ?): the vim-first keymap, grouped Global / Sidebar / Pages / Panneau /
// Modales, with a filter. A dialog (mod.json, frame "none"): a veil, the card (20) and its inner
// cards (16), kt-new's look. Global is read from keys(): the shown layout's ctrl-b keys as keys.json
// has them. The other groups are this file's table: keep it in step with the mods.
// Opens typing in the filter (INSERT, as every dialog with a field); esc: NORMAL, where j/k move,
// gg/G, ctrl-d/u, tab / shift-tab change group, q or esc close. props.group ("sidebar", "pages",
// "panel", "modals"): opened on that group (a mod's `?`). `kt-keys.key:<keys>` feeds keys, space
// separated ("j", "g g", "escape"), and `kt-keys.group:<id>` picks a group: for tests.
// vim.js is the keys every kt-* mod shares; vim.check.mjs (bun) checks it.
// `kt-keys.lang:<auto|fr|en>` sets shared "kt.lang" (I18N.md), for tests: the help must be open.
// Words: strings.js (I18N.md); i18n.js is shared byte for byte, i18n.check.mjs and i18n-audit.mjs here.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, Scrollbar } from "gpui-base";
import { keys, theme, props, closeOverlay, settings, nextCommand, checking, shared } from "herdr";
import { Vim, keysOf, step } from "./vim.js";
import { motionState, frame, ink, fade, sheet, leave, sharpen } from "./motion.js";
import { makeT, setLang } from "./i18n.js";
import strings from "./strings.js";
// The keys' one word and their keycaps, shared with every mod that shows a key (shortcuts.js, KEYMAP.md).
import { actionKey, kbd } from "./shortcuts.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const CARD = 720;
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));
const GROUPS = ["all", "global", "sidebar", "pages", "panel", "modals"];
const groupName = (id) => tr(`group.${id}`);

// Global: the ctrl-b actions in the order shown (keys.json's action, `command:arg` for an object
// binding); what each does is strings.js' `g.<action>`.
const ORDER = ["pane.go:left", "pane.go:right", "pane.go:down", "pane.go:up", "pane.split:right", "pane.split:down", "pane.zoom",
  "kt-head.close-pane", "mod.open:kt-new", "tab.next", "tab.prev", "tab.select", "tab.rename", "kt-head.close-tab", "space.new",
  "space.next", "space.prev", "space.rename", "kt-head.picker:2", "kt-head.picker:0", "kt-head.worktree", "agent.next", "agent.prev",
  "kt-head.attention", "layout.select:thread", "layout.select:hub", "layout.select:inbox", "layout.select:kanban", "layout.select:skills", "layout.select:mcp", "layout.select:plugins",
  "layout.select:workflow", "layout.select:gwm", "layout.select:notes", "layout.toggle:side", "layout.toggle:panel", "kt-head.panel:files",
  "kt-head.panel:diff", "kt-head.panel:history", "kt-head.panel:flow", "kt-head.panel:crosstalk", "mod.open:kt-keys", "mod.open:kt-mods",
  "app.settings", "send"];

// The groups held here: [keys, what, where]. Keys: names separated by spaces, "/" between choices.
// A cell naming a key of strings.js (r.*, sb.*, pg.*, pn.*, md.*) is translated (cell()); the rest are
// key names, page and mod names, and modes, the same in every language.
const TABLE = {
  sidebar: [
    ["ctrl-b h", "sb.focus"],
    ["j / k", "sb.move"],
    ["gg / G", "sb.ends"],
    ["enter", "sb.enter"],
    ["ctrl-d / ctrl-u", "sb.half"],
    ["5 j", "sb.count"],
    ["tab / shift-tab", "sb.groups"],
    ["h / l", "sb.fold"],
    ["l", "sb.show"],
    ["enter / o", "sb.open"],
    ["a", "sb.archive"],
    ["dd / x", "sb.close"],
    ["y", "sb.copy"],
    ["sb.menuKeys", "sb.menu"],
    ["r", "sb.refresh"],
    ["H / L", "sb.scroll"],
    ["esc / q", "r.release"],
    ["?", "sb.help"],
  ],
  pages: [
    ["ctrl-b shift-h / i / shift-s / shift-a / a / m / u / shift-o / shift-i", "pg.pages"],
    ["h / l", "pg.kanbanCol", "Kanban"],
    ["enter / o", "pg.kanbanGo", "Kanban"],
    ["c / b / s / t", "pg.kanbanOpts", "Kanban"],
    ["[ / ]", "pg.kanbanSlice", "Kanban"],
    ["g t / g T", "pg.kanbanViews", "Kanban"],
    ["+ / -", "pg.kanbanLimit", "Kanban"],
    ["/", "pg.kanbanFilter", "Kanban"],
    ["space / o", "pg.kanbanDrawer", "Kanban"],
    ["esc / q", "pg.kanbanDrawerClose", "Kanban"],
    ["p / z / O / I / e", "pg.kanbanDrawerActs", "Kanban"],
    ["1 / 2 / 3 / 0", "pg.kanbanSnooze", "Kanban"],
    ["n", "pg.kanbanDraftNew", "Kanban"],
    ["i / tab / esc", "pg.kanbanDraftEdit", "Kanban"],
    ["L", "pg.kanbanDraftLaunch", "Kanban"],
    ["x / dd", "pg.kanbanDraftDelete", "Kanban"],
    ["m", "pg.kanbanMenu", "Kanban"],
    ["j / k / enter / esc", "pg.kanbanMenuKeys", "Kanban"],
    ["< / > / =", "pg.kanbanWidth", "Kanban"],
    ["D", "pg.kanbanDensity", "Kanban"],
    ["↑ ↓ / tab / esc", "pg.kanbanComplete", "Kanban"],
    ["F, h / l, x", "pg.kanbanChips", "Kanban"],
    ["f", "pg.kanbanFilterBy", "Kanban"],
    ["e / u / dd / +", "pg.plugins", "Plugins"],
    ["h / L / [ / ]", "pg.market", "Plugins"],
    ["p", "pg.mdRaw", "Skills, Plugins, Inbox, Workflow, Notes"], // i18n: tech
    ["ctrl-e / ctrl-y", "pg.mdScroll", "Skills, Plugins, Inbox, Notes"], // i18n: tech
    ["j / k, ctrl-d / ctrl-u, gg / G", "pg.notesRawScroll", "Notes · Brut"], // i18n: tech
    ["esc", "pg.skillsEsc", "Skills, Plugins"], // i18n: tech
    ["[ / ]", "pg.relation", "Inbox"],
    ["j / k", "r.line"],
    ["gg / G", "r.ends"],
    ["ctrl-d / ctrl-u", "r.half"],
    ["/", "pg.filter"],
    ["k", "pg.above"],
    ["n / N", "pg.match"],
    ["tab / shift-tab", "pg.segment"],
    ["enter / o", "pg.open"],
    ["O", "pg.elsewhere"],
    ["y", "pg.copy"],
    ["r", "r.refresh"],
    ["dd / x", "pg.close", "Inbox"],
    ["dd", "pg.remove", "Worktrees"],
    ["pg.toggleKeys", "pg.toggle", "Skills, MCP, Worktrees"], // i18n: tech
    ["V", "pg.visual", "Skills, MCP, Worktrees"], // i18n: tech
    ["ctrl-a", "pg.all", "Skills, MCP, Worktrees"], // i18n: tech
    ["esc", "pg.esc", "Skills, MCP, Worktrees"], // i18n: tech
    ["pg.clickKeys", "pg.click", "Skills, MCP, Worktrees"], // i18n: tech
    ["l / enter / o", "pg.codeIn", "Inbox · Code"], // i18n: tech
    ["h / l", "pg.codeFold", "Inbox · Code"], // i18n: tech
    ["O", "pg.codeZed", "Inbox · Code"], // i18n: tech
    ["y", "pg.codePath", "Inbox · Code"], // i18n: tech
    ["esc", "pg.codeBack", "Inbox · Code"], // i18n: tech
    ["i", "pg.notesEdit", "Notes"],
    ["x / space", "pg.notesTick", "Notes"],
    ["ctrl-s", "pg.notesSave", "Notes"],
    ["esc / h", "pg.notesBack", "Notes"],
    ["tab / shift-tab", "pg.notesSections", "Notes"],
    ["j / k, gg / G", "pg.hubSections", "pg.hubPage"],
    ["[ / ], h / l", "pg.hubYear", "pg.hubPage"],
    ["enter / o", "pg.hubGo", "pg.hubPage"],
    ["r", "pg.hubIndex", "pg.hubPage"],
    ["q / esc", "pg.hubBack", "pg.hubPage"],
    ["q", "r.back"],
    ["esc", "pg.clear"],
    ["ctrl-n / ctrl-p", "pg.insertMove", "INSERT"],
    ["ctrl-j / ctrl-k", "r.same", "INSERT"],
    ["enter", "pg.insertOpen", "INSERT"],
    ["esc", "pg.insertEsc", "INSERT"],
  ],
  panel: [
    ["ctrl-b l", "pn.focus"],
    ["ctrl-b f / d / y / e / r", "pn.tabs"],
    ["[ / ]", "pn.tab"],
    ["j / k", "r.line"],
    ["gg / G", "r.ends"],
    ["ctrl-d / ctrl-u", "r.half"],
    ["h / l", "pn.fold"],
    ["enter / o", "r.open"],
    ["O", "pn.zed"],
    ["gi / gI", "pn.flowIssue", "Flow"], // i18n: tech
    ["gp / gP", "pn.flowPr", "Flow"], // i18n: tech
    ["O", "pn.flowGithub", "Flow"],
    ["k", "pn.above", "Files, Changes"], // i18n: tech
    ["tab", "pn.commits", "History"],
    ["tab / shift-tab", "pn.xtFilter", "Crosstalk"],
    ["l / enter / o", "pn.xtOpen", "Crosstalk"],
    ["/", "pn.xtSearch", "Crosstalk"],
    ["i / enter", "pn.xtReply", "Crosstalk"],
    ["r", "pn.xtRename", "Crosstalk"],
    ["h / esc", "pn.xtBack", "Crosstalk"],
    ["y", "pn.copy"],
    ["r", "r.refresh"],
    ["dd / x", "pn.discard", "Changes"],
    ["cmd-enter", "pn.commit", "Changes"],
    ["esc", "r.release"],
  ],
  modals: [
    ["", "md.modes"],
    ["ctrl-n / ctrl-p", "r.select", "INSERT"],
    ["ctrl-j / ctrl-k", "r.same", "INSERT"],
    ["enter", "md.validate", "INSERT"],
    ["esc", "r.normal", "INSERT"],
    ["j / k", "r.select", "NORMAL"],
    ["gg / G", "r.ends", "NORMAL"],
    ["enter / o / l", "md.confirmSel", "NORMAL"],
    ["/", "md.field", "NORMAL"],
    ["q / esc", "r.close", "NORMAL"],
    ["tab / shift-tab", "r.group", "kt-picker"],
    ["dd / x / ctrl-d", "md.closeThread", "kt-picker"],
    ["tab / shift-tab", "md.branches", "kt-branch"],
    ["j / k", "md.newLine", "kt-new"],
    ["h / l / tab", "md.newChoice", "kt-new"],
    ["enter / o", "md.rename", "kt-projects"],
    ["dd / x", "md.remove", "kt-projects"],
    ["j / k", "md.option", "kt-thread-filter"],
    ["enter / space / l", "md.check", "kt-thread-filter"],
    ["k", "md.aboveFilter", "md.projects"],
    ["y / enter", "r.confirm", "kt-confirm"],
    ["n / esc / q", "md.cancel", "kt-confirm"],
    ["h j k l", "md.pan", "kt-viewer"],
    ["+ / - / 0 / 1", "md.zoom", "kt-viewer"],
    ["[ / ]", "md.image", "kt-viewer"],
    ["ctrl-p / ctrl-w / ctrl-t / ctrl-a", "md.newKeys", "kt-new"],
    ["ctrl-o", "md.newTask", "kt-new"],
    ["ctrl-f", "md.newFlow", "kt-new"],
    ["/", "md.newSlash", "kt-new"],
    ["cmd-enter / ctrl-enter", "md.newStart", "kt-new"],
    ["j / k", "md.usageMove", "kt-usage"],
    ["tab / shift-tab", "md.card", "kt-usage"],
    ["enter / o", "md.session", "kt-usage"],
    ["r", "r.refresh", "kt-usage"],
    ["i", "md.usageSources", "kt-usage"],
    ["q / esc", "r.close", "kt-usage"],
    ["/ esc", "md.modsSearch", "kt-mods"],
    ["tab / [ ]", "md.modsFilters", "kt-mods"],
    ["l / enter", "md.modsDetail", "kt-mods"],
    ["O / v / D / y", "md.modsActions", "kt-mods"],
    ["dd / x", "md.modsDelete", "kt-mods"],
  ],
};
const cell = (s) => (s && /^(r|sb|pg|pn|md)\.\w+$/.test(s) ? tr(s) : s);

export default class Keys extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.scroll = ScrollHandle.new();
    this.vim = new Vim({ field: true, insert: true });
    this.query = "";
    const g = GROUPS.indexOf(props()?.group);
    this.group = Math.max(0, g);
    this.cur = 0;
    this.rowsShown = [];
    this.motion = motionState(); // ANIMATIONS.md: the card rises in, the segments' ink glides, the cursor fades
    this.segW = {}; // group id -> its segment's measured width, for the ink
    // The dialog isn't keyed yet in init: ask for the keyboard again, briefly, until it has it.
    this.handle.focus();
    for (const ms of [16, 50, 120, 250]) cx.timer.after(ms, () => { if (!this.handle.is_focused()) this.handle.focus(); });
    if (checking()) return;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) {
          this.handle.focus();
          for (const k of keysOf(c.slice(4))) this.act(this.vim.handle(k), cx);
        } else if (c.startsWith("group:")) this.group = Math.max(0, GROUPS.indexOf(c.slice(6)));
        else if (c.startsWith("lang:")) setLang(c.slice(5));
        cx.notify();
      }
    });
  }

  // Not close(): Herdr calls a View's close() on a reload too (a saved file), and the dialog would shut.
  // motion.js leave(): the veil fades out and the card sinks, then the dialog closes.
  dismiss(cx) {
    leave(this.motion, cx, "kk", () => closeOverlay(props().overlay));
  }

  globals() {
    const section = `layout:${shared("layout") ?? "kbrdn-threads"}`;
    const rows = [];
    for (const b of keys()) {
      if (b.section !== section || !b.keys.startsWith("ctrl-b ")) continue;
      const k = actionKey(b.action);
      if (k === "tab.select") {
        if (!rows.some((r) => r.k === "tab.select")) rows.push({ g: "global", k, keys: "ctrl-b 1…9", what: tr("g.tab.select") });
        continue;
      }
      rows.push({ g: "global", k, keys: b.keys, what: ORDER.includes(k) ? tr(`g.${k}`) : b.action });
    }
    const at = (r) => (ORDER.includes(r.k) ? ORDER.indexOf(r.k) : ORDER.length);
    rows.sort((a, b) => at(a) - at(b));
    // Without the prefix (keys.json, both layout sections): they take ctrl-h / ctrl-l from the terminal.
    rows.push({ g: "global", keys: "ctrl-h / ctrl-l", what: tr("g.panelLR") }); // i18n: tech
    rows.push({ g: "global", keys: "cmd-t / cmd-p / cmd-w / cmd-1…9", what: tr("g.mac"), where: "Mac" }); // i18n: tech
    return rows;
  }

  rows() {
    const all = [...this.globals(), ...Object.entries(TABLE).flatMap(([g, list]) => list.map(([keys, what, where]) => ({ g, keys: cell(keys), what: cell(what), where: cell(where) })))];
    const group = GROUPS[this.group];
    const q = this.query.trim().toLowerCase();
    return all.filter((r) => (group === "all" || r.g === group) && (!q || `${r.keys} ${r.what} ${r.where ?? ""}`.toLowerCase().includes(q)));
  }

  // One vim action (vim.js); null: not a key of ours.
  act(a, cx) {
    if (!a) return false;
    const n = this.rowsShown.length;
    if (a === "type") { this.query += this.vim.char; this.cur = 0; }
    else if (a === "backspace") { this.query = this.query.slice(0, -1); this.cur = 0; }
    else if (a === "submit") this.vim.normal();
    else if (a === "escape" || a === "quit") this.dismiss(cx);
    else if (a === "tab-next" || a === "tab-prev") {
      this.group = (this.group + (a === "tab-next" ? 1 : GROUPS.length - 1)) % GROUPS.length;
      this.cur = 0;
    } else if (a === "next" || a === "prev") this.move(a === "next" ? "down" : "up");
    else if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) this.move(a);
    return true;
  }

  move(a) {
    this.cur = step(a, this.cur, this.rowsShown.length, this.vim.count, 12);
    this.reveal = true;
  }

  key(e, cx) {
    if (!this.act(this.vim.handle(e), cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  render() {
    const t = theme();
    const rows = (this.rowsShown = this.rows());
    this.cur = Math.min(this.cur, Math.max(0, rows.length - 1));
    const typing = this.vim.insert;
    const focused = this.handle.is_focused();
    const shown = Boolean(this.size);
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const s = sheet(m, "kk", shown); // the veil's fade and the card's 6 px, in on its first layout, out on dismiss
    if (this.cur !== this.inkCur) { this.inkFrom = this.inkCur; this.inkCur = this.cur; } // the line the ink fades from
    const eyebrow = (text) => div().font_family(MONO).text_size(10.5).text_color(t.muted).child(text.toUpperCase());
    const dashed = () => div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
    // The list: a header per group (Tout), one 32 px line per key; the cursor line on the ink.
    const items = [];
    rows.forEach((r, i) => {
      if (GROUPS[this.group] === "all" && rows[i - 1]?.g !== r.g)
        items.push(h_flex().px(10).pt(i ? 12 : 4).pb(4).gap(10).items_center()
          .child(eyebrow(groupName(r.g)).flex_none())
          .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border)));
      if (i === this.cur && this.reveal) { this.scroll.scroll_to_item(items.length); this.reveal = false; }
      const on = i === this.cur;
      // The cursor's ink: a layer under the line that fades from one line to the next (120 ms). Only on the
      // cursor's line and the one it left: 120 layers would weigh on every render.
      items.push(h_flex().id(`kk-row-${i}`).relative().min_h(32).px(10).py(4).gap(12).items_center().rounded(12).border(1)
        .border_color(alpha(t.accent, "00"))
        .when(on || i === this.inkFrom, (el) => el.child(fade(m, div().id(`kk-row-ink-${i}`).absolute().top(-1).left(-1).right(-1).bottom(-1).rounded(12)
          .border(1).border_color(alpha(t.accent, "66")).bg(alpha(t.accent, "24")), on)))
        .on_click((_e, cx) => { this.cur = i; cx.notify(); })
        // shortcuts.js' keycaps, wrapping in 230 px: Global's keys.json keys as everywhere, the table's vim keys
        // as written (g and G differ).
        .child(kbd(t, r.keys, { vim: r.g !== "global", h: 20 }).w(230).flex_wrap())
        .child(div().flex_1().min_w(0).text_size(12.5).text_color(on ? t.foreground : t.muted).child(r.what))
        .when(Boolean(r.where), (el) => el.child(div().flex_none().h(18).px(7).flex().items_center().rounded_full().border(1)
          .border_color(alpha(t.accent, "4d")).bg(alpha(t.accent, "1a")).font_family(MONO).text_size(9.5).text_color(t.accent).child(r.where.toUpperCase()))));
    });
    const listH = Math.max(160, (this.size?.height ?? 700) - 260);
    // Segments: the card's inner card (16) holds them 4 px in, so their box is 12 and theirs 9.
    // The ink: one pill gliding to the shown group (SegmentInk), once the segments before it are measured.
    const before = GROUPS.slice(0, this.group).map((id) => this.segW[id]);
    const segOn = GROUPS[this.group];
    const placed = this.segW[segOn] && before.every(Boolean);
    const seg = h_flex().relative().flex_none().h(34).p(3).gap(2).items_center().rounded(12).border(1).border_color(t.border).bg(t.background)
      .child(placed
        ? ink(m, div().id("kk-seg-ink").absolute().top(3).bottom(3).left(3 + before.reduce((s, w) => s + w + 2, 0)).w(this.segW[segOn])
          .rounded(9).border(1).border_color(alpha(t.accent, "66")).bg(alpha(t.accent, "24")))
        : div().id("kk-seg-ink-wait").absolute().w(0).h(0))
      .children(GROUPS.map((id, i) => {
        const on = i === this.group;
        return h_flex().id(`kk-seg-${id}`).h_full().px(10).items_center().rounded(9).border(1)
          .on_size_change((size, cx) => {
            if (this.segW[id] === size.width) return;
            this.segW[id] = size.width;
            cx.notify();
          })
          .border_color(alpha(t.accent, "00"))
          .when(!on, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
          .text_size(12).text_color(on ? t.foreground : t.muted).cursor_pointer()
          .on_click((_e, cx) => { this.group = i; this.cur = 0; cx.notify(); })
          .child(groupName(id));
      }));
    const field = h_flex().id("kk-filter").flex_1().min_w(0).h(34).px(12).gap(8).items_center().rounded(12).border(1)
      .border_color(focused && typing ? t.accent : t.border).bg(t.background).cursor_text()
      .on_click((_e, cx) => { this.vim.edit(); this.handle.focus(); cx.notify(); })
      .child(div().flex_none().font_family(MONO).text_size(12).text_color(t.dim).child("/"))
      .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
        .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : tr("filter")));
    const mode = div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(this.vim.label);
    const hint = (k, what) => h_flex().gap(5).items_center()
      .child(div().flex_none().h(18).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted).child(k))
      .child(what);
    const card = s.card(v_flex().id("kk-card")
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .w(CARD).max_w_full())
      .p(4).gap(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg()
      .child(v_flex().rounded(16).bg(t.surface).border(1).border_color(t.border).p(4).gap(4)
        .child(h_flex().px(10).pt(8).pb(4).gap(10).items_center()
          // motion.js sharpen: the title comes into focus as the dialog opens, once.
          .child(sharpen(m, "kk-title", () => div().text_size(16).font_semibold().text_color(t.foreground).child(tr("title"))).flex_1())
          .child(div().font_family(MONO).text_size(11).text_color(t.dim).child(tr("count", { n: rows.length }))))
        .child(h_flex().gap(4).items_center().child(field).child(seg)))
      .child(v_flex().rounded(16).bg(t.surface).border(1).border_color(t.border)
        // overflow_y_scroll + a Scrollbar of the same id: scroll_to_item does nothing on overflow_y_scrollbar.
        .child(div().relative()
          .child(v_flex().id("kk-list").max_h(listH).overflow_y_scroll().track_scroll(this.scroll).p(4).gap(2)
            .children(items.length ? items : [div().p(16).text_size(13).text_color(t.dim).child(tr("empty"))]))
          .child(Scrollbar.vertical("kk-list").absolute().inset_0()))
        .child(dashed())
        .child(h_flex().px(12).py(8).gap(12).items_center().text_size(11).text_color(t.dim)
          .child(mode)
          .child(hint("/", tr("hint.filter")))
          .child(hint("j k", tr("hint.line")))
          .child(hint("tab", tr("hint.group")))
          .child(div().flex_1())
          .child(hint("esc", typing ? tr("hint.normal") : tr("hint.close")))));
    return s.veil(div().id("kk-veil").size_full().flex().items_center().justify_center().bg(veil()))
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
      .on_mouse_down("left", (_e, cx) => this.dismiss(cx))
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(card);
  }
}
