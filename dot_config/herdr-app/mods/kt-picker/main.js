// kbrdn Threads' Search (a clone of the shipped `picker`, kt-new's look): one field to go anywhere.
// Results in groups, each under its eyebrow and count: the threads (those that need you first), the
// projects (busy ones, the calm ones folded, the registry's closed ones), the pages of the layout's
// "view" stack, and a few actions. Fuzzy search on title, project, branch and prompt, the matched
// letters in accent. ↑/↓ and Enter, ⌘1-4 (or the pills) narrow to a group, ctrl+d closes the
// selected thread's tab after kt-confirm, Esc leaves. For keys and debugging, `kt-picker.query:<text>`
// types into the field, `kt-picker.filter:<1-4>` picks a group, `kt-picker.next` / `.prev` move.
// Keys (vim.js): it opens typing in the field (INSERT: the Input types, deletes and submits itself);
// ctrl-n / ctrl-j / ↓ and ctrl-k / ↑ move the selection, tab / shift-tab the group, Esc goes to
// NORMAL (the keyboard on the card's own handle; the popup stays). NORMAL: j / k (↓ ↑, round),
// gg / G, ctrl-u move; enter, o or l opens; tab / shift-tab the group; / or a click in the field
// types again; dd or x closes the selected thread (kt-confirm, as ctrl+d); q or esc leaves; ? the
// keys (kt-keys, Modales). ⌘1-4 and ctrl+d come first in both modes (so ctrl-d isn't a half page).
// `kt-picker.key:<keys>` feeds keys ("escape j j", "g g"); text goes through `query:`.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, ScrollHandle } from "gpui-base";
import { spaces, panes, run, theme, settings, props, closeOverlay, openOverlay, shared, home, readTextFile, nextCommand, checking, layout, appHome, keys } from "herdr";
// Copied byte for byte from mods/kt-keys/shortcuts.js: the pages' and actions' keys, read from keys(), and every
// key here drawn as keycaps (#72).
import { shortcut, kbd } from "./shortcuts.js";
import { search } from "./fuzzy.js";
import { Vim, keyOf, keysOf, step } from "./vim.js";
import { filterRow, filterState } from "./filters.js";
import { motionState, frame, sheet, leave, leaving } from "./motion.js";
import { ditherBand, TOP } from "./dither.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";
// kt-keys' machines.js (a byte-identical copy, with machines.strings.js): another machine as a tag, its
// state's dot, ROOT, its state and account on hover (#64).
import { machineTag } from "./machines.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
// The groups' tints (filters.js): Tout stays neutral.
const GROUP_TINT = { threads: "accent", projects: "ansi6", pages: "ansi5" };
const I = (name) => `mods/kt-threads/${name}.svg`;
// Replaces the alpha (Glass colors are already #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const show = (child) => run("layout.select", { stack: "view", child });
function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}

// kt-threads' label() (copied: that file moves under other hands): a name the person gave stays;
// else the agent's live title (its status glyph dropped), else the program; never a bare number.
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();
function label(tab, lead) {
  const prog = lead?.program?.name;
  const base = tab.named ? tab.name : prog ?? "Terminal";
  if (!lead?.program?.agent) return base;
  const live = clean(lead.title);
  const path = /^[~/]|^[A-Za-z]:\\/.test((lead.title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, ""));
  const telling = live && live !== lead.terminal && live !== prog && !path && !live.includes("@") && live.toLowerCase() !== lead.program.key;
  return (tab.name === prog || !tab.named) && telling ? live : base;
}
// A prompt's first line, unless it's a placeholder ("[Image #12]", "[Pasted text …]").
function firstLine(s) {
  const l = (s ?? "").split("\n").map((x) => x.trim()).find(Boolean) ?? "";
  return /^\[(Image|Pasted)\b/.test(l) ? "" : l.slice(0, 160);
}
function duration(ms) {
  const m = Math.max(0, Math.floor((Date.now() - ms) / 60e3));
  return m < 1 ? "<1M" : m < 60 ? `${m}M` : `${Math.floor(m / 60)}H${String(m % 60).padStart(2, "0")}`;
}

// Monocode's program tile (kt-threads): the program's icon on its own color.
function tile(t, p) {
  const g = p?.icon ? (p.tint ? svg(p.icon).size(13).text_color(p.color ?? "#ffffff") : image(p.icon).size(13)) : svg("mods/workspace-chrome/terminal.svg").size(12).text_color(t.muted);
  return div().size(20).flex_none().rounded(6).border(1).border_color("#00000033").bg(p?.tile ?? t.raised).flex().items_center().justify_center().child(g);
}

// The projects registry (shared "kt.projects", kt-projects manages it), its logo for the appearance
// now, and a color name or #hex.
const registry = () => [...(shared("kt.projects") ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
function logoOf(e) {
  const l = e?.logos ?? { light: e?.logo ?? null, dark: e?.logo ?? null };
  return (settings().dark ? (l.dark ?? l.light) : (l.light ?? l.dark)) ?? null;
}
const paint = (t, c) => (!c ? null : c.startsWith("#") ? c : t[c] ?? null);

const RANK = { blocked: 0, done: 1, working: 2, idle: 3 };
const STATUS = { blocked: "NEEDS YOU", done: "DONE", working: "WORKING", idle: "IDLE" }; // i18n: tech
const GROUPS = ["all", "threads", "projects", "pages"];
const groupName = (i) => tr(`group.${GROUPS[i]}`);
// [id, icon, name, overlay]: a page of the layout's "view" stack, listed when the stack has it;
// with `overlay`, a mod opened over the window (mod.open), listed when its folder has a main.js.
// A name is the page's own (a proper noun), else null: strings.js' page.<id>. Its key: keys.json's
// `layout.select:<id>`, or `mod.open:<id>` for an overlay (shortcuts.js).
const PAGES = [
  ["inbox", "layers", "Inbox"], ["skills", "sparkles", "Skills"], ["mcp", "plug", "MCP"], ["gwm", "git-branch", "Worktrees"],
  ["plugins", "puzzle", "Plugins"], ["market", "store", "Marketplaces"], ["workflow", "layout-list", "Workflow"],
  ["automation", "refresh-cw", null], ["notes", "file-text", "Notes"],
  ["kt-usage", "clock", null, true], ["kt-mods", "settings", "Mods", true],
];
// Row heights, so the list has a definite height (a scroll area without one lays out at zero).
const H = { eyebrow: 28, thread: 48, project: 36, closed: 36, fold: 30, page: 36, action: 36, empty: 110 };

export default class Search extends View {
  init(_props, cx) {
    this.query = "";
    this.group = 0;
    this.selKey = null;
    this.showCalm = false;
    this.typing = false;
    this.live = {}; // terminal -> { bridge, sl }
    this.mods = {}; // overlay page id -> its mod is there
    this.rowsShown = [];
    this.slots = [];
    this.scroll = ScrollHandle.new();
    this.groups = filterState();
    this.motion = motionState(); // ANIMATIONS.md: the veil fades and the card rises, in and out (motion.js sheet, leave)
    this.input = InputState.new({ placeholder: tr("placeholder") });
    this.input.on("change", (_e, cx) => {
      this.setQuery(this.input.value());
      cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.go(this.selected(), cx));
    // vim's mode follows the keyboard: the field's (INSERT) or the card's own handle (NORMAL).
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: true, insert: true });
    this.input.on("focus", (_e, cx) => { this.typing = true; this.vim.edit(); cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; this.vim.normal(); cx.notify(); });
    // The popup isn't keyed yet in init, so the field asks again, briefly, only while it hasn't got
    // the keyboard. Not the shipped picker's blind refocus at 600 ms: until then the first keys land
    // in the terminal under it, and then it takes the keyboard back from wherever it went. Not
    // once the card's handle has it either (Esc: NORMAL).
    this.input.focus();
    for (const ms of [16, 50, 120, 250, 500]) cx.timer.after(ms, () => { if (!this.typing && !this.handle.is_focused()) this.input.focus(); });
    // props.group (ctrl-b w: Projets, kt-head): opened on that group.
    if (props()?.group) this.group = Number(props().group) || 0;
    if (checking()) return;
    this.readLive(cx);
    // Which overlay pages exist (a mod folder with a main.js), once: a page appears when its mod does.
    cx.spawn(async (cx) => {
      for (const [id, , , overlay] of PAGES) {
        if (overlay) this.mods[id] = Boolean(await readTextFile(`${appHome()}/mods/${id}/main.js`).catch(() => null));
      }
      cx.notify();
    });
    cx.timer.every(3000, (cx) => this.readLive(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        const name = c.split(/[:\s]/)[0];
        const arg = c.slice(name.length + 1);
        if (name === "query") {
          this.input.set_value(arg);
          this.setQuery(arg);
        } else if (name === "filter") this.setGroup(Number(arg) - 1);
        else if (name === "next" || name === "prev") this.move(name === "next" ? 1 : -1);
        else if (name === "key") {
          this.refocus();
          for (const k of keysOf(arg)) this.press(k, cx);
        }
        cx.notify();
      }
    });
  }

  // Each agent's herdr-bridge facts (prompt, last action, answer) and statusline (model).
  readLive(cx) {
    if (this.reading) return;
    this.reading = true;
    cx.spawn(async (cx) => {
      const one = async (path) => {
        try { return JSON.parse(await readTextFile(path)); } catch { return null; }
      };
      const next = {};
      for (const p of panes()) {
        if (!p.terminal || p.terminal.includes("/") || !p.program?.agent || next[p.terminal]) continue;
        next[p.terminal] = {
          bridge: await one(`${home()}/.claude/cache/herdr/${p.terminal}.json`),
          sl: await one(`${home()}/.claude/cache/statusline/herdr-${p.terminal}.json`),
        };
      }
      this.reading = false;
      const key = JSON.stringify(next);
      if (key !== this.liveKey) { this.liveKey = key; this.live = next; cx.notify(); }
    });
  }

  // motion.js leave(): the veil fades out and the card sinks, then the popup closes.
  dismiss(cx) {
    leave(this.motion, cx, "kp", () => closeOverlay(props().overlay));
  }

  setQuery(q) {
    if (q === this.query) return;
    this.query = q;
    this.moved = false; // the best match, at the next render
    this.scroll.scroll_to_item(0);
  }

  setGroup(i) {
    if (!(i >= 0 && i < GROUPS.length)) return;
    this.group = i;
    this.moved = false;
    this.scroll.scroll_to_item(0);
  }

  selected() {
    return this.rowsShown.find((r) => r.key === this.selKey) ?? this.rowsShown[0] ?? null;
  }

  move(d) {
    const rows = this.rowsShown;
    if (!rows.length) return;
    const i = Math.max(0, rows.findIndex((r) => r.key === this.selKey));
    const n = (((i + d) % rows.length) + rows.length) % rows.length;
    this.selKey = rows[n].key;
    this.moved = true;
    // The selected row stays in view; the first one brings its eyebrow along.
    this.scroll.scroll_to_item(n === 0 ? 0 : this.slots[n]);
  }

  // The keyboard back where the mode says: the field (INSERT) or the card's handle (NORMAL).
  refocus() {
    (this.vim.insert ? this.input : this.handle).focus();
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours (typing in the field, ctrl-b, cmd-*): it goes on
    cx.stop_propagation();
    cx.notify();
  }

  // One key, from the keyboard or `key:` (a name): ⌘1-4 and ctrl+d first (both modes, as before),
  // then vim's.
  press(e, cx) {
    const k = keyOf(e).name;
    if (/^cmd-[1-4]$/.test(k)) this.setGroup(Number(k.slice(4)) - 1);
    else if (k === "ctrl-d") this.closeTab();
    else return this.act(this.vim.handle(e), cx);
    return true;
  }

  // One vim action; false: not one of ours. In INSERT the Input types, deletes and submits (Enter
  // already goes through its "submit"): those keys go on to it.
  act(a, cx) {
    if (!a || a === "type" || a === "backspace" || a === "submit") return false;
    if (a === "pending" || a === "count") return true;
    const rows = this.rowsShown;
    if (a === "normal") this.handle.focus();
    else if (a === "filter") this.input.focus();
    else if (a === "down" || a === "up") this.move((a === "down" ? 1 : -1) * this.vim.count);
    else if (["top", "bottom", "half-down", "half-up"].includes(a)) {
      const i = Math.max(0, rows.findIndex((r) => r.key === this.selKey));
      this.move(step(a, i, rows.length, this.vim.count, 8) - i);
    } else if (a === "tab-next" || a === "tab-prev") this.setGroup((this.group + (a === "tab-next" ? 1 : GROUPS.length - 1)) % GROUPS.length);
    else if (a === "open" || a === "right") this.go(this.selected(), cx);
    else if (a === "delete") this.closeTab();
    else if (a === "escape" || a === "quit") this.dismiss(cx);
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else return false;
    return true;
  }

  isHome(s) {
    return !s.machine && (s.name === "~" || !s.folder || s.folder === home());
  }

  // A space's registry entry: same machine, its folder or one under it.
  entryOf(s, reg) {
    if (this.isHome(s)) return null;
    return reg.find((e) => (e.machine ?? null) === (s.machine ?? null) && e.folder && (s.folder === e.folder || s.folder.startsWith(`${e.folder}/`))) ?? null;
  }

  projectName(s, reg) {
    return this.isHome(s) ? (s.named ? s.name : "Home") : this.entryOf(s, reg)?.name ?? s.name;
  }

  // Every row of every group, filtered and scored by the query.
  rows(reg) {
    const q = this.query.trim();
    const all = panes();
    const match = (r, fields) => {
      const m = search(q, fields);
      return m && Object.assign(r, { score: m.score, marks: m.marks });
    };
    const byScore = (list, tie) => (q ? list.sort((a, b) => b.score - a.score || tie(a, b)) : list.sort(tie));

    const threads = [];
    for (const w of spaces()) {
      for (const c of w.tabs) {
        const mine = all.filter((p) => p.tab === c.id && p.terminal);
        const lead = mine.find((p) => p.focused) ?? mine.find((p) => p.program?.agent) ?? mine[0];
        const agent = mine.find((p) => p.program?.agent) ?? lead;
        const live = (agent?.terminal && this.live[agent.terminal]) || {};
        const b = live.bridge ?? {};
        const prompt = firstLine(b.prompt);
        let title = label(c, agent);
        if (!c.named && title === (agent?.program?.name ?? "Terminal") && prompt) title = prompt;
        const action = firstLine(c.status === "working" || c.status === "blocked" ? b.action?.what : (b.answer ?? b.action?.what));
        const r = { kind: "thread", key: `t:${c.id}`, w, c, agent, title, prompt, action, project: this.projectName(w, reg), branch: lead?.branch ?? w.branch ?? "", model: live.sl?.model ?? "" };
        if (match(r, [r.title, r.project, r.branch, r.prompt])) threads.push(r);
      }
    }
    const urgency = (r) => (r.c.settled ? 9 : RANK[r.c.status] ?? 4);
    byScore(threads, (a, b) => urgency(a) - urgency(b) || (b.c.changed_at ?? 0) - (a.c.changed_at ?? 0));

    const ps = spaces();
    const open = ps
      .map((s) => ({ kind: "project", key: `p:${s.id}`, s, e: this.entryOf(s, reg), home: this.isHome(s), name: this.projectName(s, reg), branch: s.branch ?? "" }))
      .filter((r) => match(r, [r.name, r.branch, r.s.machine ?? ""]));
    const closed = reg
      .filter((e) => !ps.some((s) => this.entryOf(s, reg) === e))
      .map((e) => ({ kind: "closed", key: `c:${e.id}`, e, name: e.name, branch: "" }))
      .filter((r) => match(r, [r.name, "", r.e.machine ?? ""]));
    const busy = byScore(open.filter((r) => r.s.status), (a, b) => (RANK[a.s.status] ?? 4) - (RANK[b.s.status] ?? 4));
    const calm = byScore(open.filter((r) => !r.s.status), () => 0);
    // Calm projects fold under one line, unless searching.
    const projects = q
      ? byScore([...open, ...closed], () => 0)
      : [...busy, ...(calm.length ? [{ kind: "fold", key: "fold", count: calm.length }] : []), ...(this.showCalm ? calm : []), ...closed];

    // Only what exists: the stack's pages, and the overlay mods found on disk (init's check).
    const stack = new Set((find(layout(), "view")?.children ?? []).map((c) => c.id));
    const binds = keys();
    const keyFor = (...actions) => shortcut(binds, shared("layout"), ...actions);
    const pages = byScore(PAGES.filter(([id, , , overlay]) => (overlay ? this.mods[id] : stack.has(id)))
      .map(([id, icon, name, overlay]) => ({ kind: "page", key: `g:${id}`, id, icon, name: name ?? tr(`page.${id}`),
        kbd: keyFor(overlay ? `mod.open:${id}` : `layout.select:${id}`), overlay: Boolean(overlay) }))
      .filter((r) => match(r, [r.name, r.id])), () => 0);

    const actions = byScore(
      [
        // `overlay`: it opens another dialog (go() closes this popup first).
        { id: "new", icon: "square-pen", name: tr("newThread"), kbd: keyFor("mod.open:kt-new"), overlay: true, go: () => { show("thread"); run("mod.open", { name: "kt-new" }); } },
        // As kt-gwm's "Nouveau worktree": kt-new, whose Checkout pill makes it with gwm.
        { id: "worktree", icon: "folder-tree", name: tr("newWorktree"), kbd: keyFor("kt-head.worktree"), overlay: true, go: () => { show("thread"); run("mod.open", { name: "kt-new" }); } },
        { id: "palette", icon: "layout-list", name: tr("palette"), kbd: keyFor("app.palette"), overlay: true, go: () => run("app.palette") },
        // kt-head opens and closes the panel with its content moving (#73), as ctrl-b p does.
        { id: "panel", icon: "panel-right", name: tr("panel"), kbd: keyFor("kt-head.panel-toggle"), go: () => run("kt-head.panel-toggle") },
      ].map((a) => ({ kind: "action", key: `a:${a.id}`, ...a })).filter((r) => match(r, [r.name])),
      () => 0,
    );
    return { threads, projects, pages, actions, counts: [threads.length + open.length + closed.length + pages.length + actions.length, threads.length, open.length + closed.length, pages.length] };
  }

  go(r, cx) {
    if (!r || leaving(this.motion, "kp")) return; // picked already: the popup is leaving
    if (r.kind === "fold") {
      this.showCalm = !this.showCalm;
      this.refocus();
      cx?.notify();
      return;
    }
    // Another dialog opening (a mod page, kt-new, the palette): the popup goes first, at once, as the
    // shipped picker does, so its focus can't fight the new one's. Else what was picked, then the
    // popup leaves (motion.js).
    const opens = (r.kind === "page" || r.kind === "action") && r.overlay;
    if (opens) closeOverlay(props().overlay);
    if (r.kind === "thread") {
      // The sidebar's way (tab.select, any space), then the keyboard on its agent.
      show("thread");
      if (!r.w.active) run("space.select", { id: r.w.id });
      run("tab.select", { id: r.c.id });
      if (r.agent?.terminal && r.agent.program?.agent) run("agent.focus", { terminal: r.agent.terminal });
    } else if (r.kind === "project") {
      show("thread");
      run("space.select", { id: r.s.id });
    } else if (r.kind === "closed") {
      show("thread");
      run("space.new", { folder: r.e.folder, name: r.e.name, machine: r.e.machine ?? "" });
    } else if (r.kind === "page") {
      if (r.overlay) run("mod.open", { name: r.id });
      else show(r.id);
    }
    else if (r.kind === "action") r.go();
    if (!opens) this.dismiss(cx);
  }

  // ctrl+d on a thread: closes its tab, after kbrdn's confirm (this popup goes first, so its focus
  // can't fight the confirm's). kt-confirm describes the thread itself (`thread`: project, branch,
  // terminals, sub-agents, the agent's state) and closes it confirmed, so Herdr doesn't ask again.
  closeTab() {
    const r = this.selected();
    if (r?.kind !== "thread" || leaving(this.motion, "kp")) return;
    closeOverlay(props().overlay);
    openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: { thread: r.c.id } });
  }

  // Text with its matched letters in accent: runs of letters, the last one truncating.
  hl(t, text, marks) {
    const s = text ?? "";
    if (!marks?.size) return div().min_w(0).truncate().child(s);
    const runs = [];
    for (let k = 0; k < s.length; k++) {
      const on = marks.has(k);
      if (runs.length && runs[runs.length - 1].on === on) runs[runs.length - 1].s += s[k];
      else runs.push({ on, s: s[k] });
    }
    return h_flex()
      .min_w(0)
      .overflow_hidden()
      .children(runs.map((r, i) => {
        const d = div().child(r.s.replace(/ /g, " "));
        return (i === runs.length - 1 ? d.min_w(0).truncate() : d.flex_none()).when(r.on, (el) => el.text_color(t.accent));
      }));
  }

  // A picked row: the kbrdn.dev ink (transparent border elsewhere: no shift).
  line(t, r, on, h) {
    return h_flex()
      .id(`kp-${r.key}`)
      .flex_none()
      .h(h)
      .px(10)
      .gap(10)
      .items_center()
      .rounded(12)
      .border(1)
      // The selection is the keys' cursor: a 1 px accent ring on it while the popup has the keyboard.
      .border_color(alpha(t.accent, on ? (this.keyed ? "99" : "66") : "00"))
      .when(on, (el) => el.bg(alpha(t.accent, "24")))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .cursor_pointer()
      .on_click((_e, cx) => this.go(r, cx));
  }

  // Status, mono 10.5: a colored dot (only "needs you" pulses) and what it is.
  status(t, c) {
    const st = c.status ?? (c.settled ? "settled" : null);
    if (!st) return null;
    const color = st === "settled" || st === "idle" ? t.dim : t[st];
    const text = st === "settled" ? "SETTLED" : st === "working" && c.working_since ? `WORKING ${duration(c.working_since)}` : STATUS[st]; // i18n: tech
    return h_flex()
      .flex_none()
      .gap(5)
      .items_center()
      .font_family(MONO)
      .text_size(10.5)
      .text_color(color)
      .child(div().id(`kp-dot-${c.id}`).size(6).rounded(3).flex_none().bg(color).when(st === "blocked", (el) => el.loop("opacity", { from: 0.3, to: 1, period: 1200 })))
      .child(text);
  }

  threadRow(t, r, on) {
    const m = r.marks ?? [];
    const dot = () => div().flex_none().px(5).child("·");
    const meta = [
      r.project && this.hl(t, r.project.toUpperCase(), m[1]).flex_none().max_w(140),
      r.branch && this.hl(t, r.branch, m[2]).flex_shrink(1),
      r.model && div().flex_none().child(r.model),
    ].filter(Boolean);
    // The last action; the prompt instead when the search found it there (and it isn't the title).
    const why = m[3]?.size && r.prompt !== r.title ? this.hl(t, `“${r.prompt}”`, new Set([...m[3]].map((k) => k + 1))) : r.action ? div().min_w(0).truncate().child(`↳ ${r.action}`) : null;
    const st = this.status(t, r.c);
    return this.line(t, r, on, H.thread)
      .child(tile(t, r.agent?.program))
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .gap(2)
          .child(
            h_flex()
              .h(20)
              .gap(8)
              .items_center()
              .child(this.hl(t, r.title, m[0]).flex_1().text_size(13.5).font_medium().text_color(r.c.settled ? t.muted : t.foreground))
              .when(Boolean(st), (el) => el.child(st)),
          )
          .child(
            h_flex()
              .h(16)
              .gap(10)
              .items_center()
              .when(Boolean(r.w.machine), (el) => el.child(machineTag(t, r.w.machine, { id: `kp-mt-${r.c.id}` })))
              .child(h_flex().flex_none().max_w(330).min_w(0).overflow_hidden().items_center().font_family(MONO).text_size(10.5).text_color(t.dim)
                .children(meta.flatMap((x, i) => (i ? [dot(), x] : [x]))))
              .when(Boolean(why), (el) => el.child(why.flex_1().text_size(11.5).text_color(t.muted))),
          ),
      );
  }

  // A project's mark: Home's house, its logo, else its initial on its color.
  mark(t, r) {
    if (r.home) return h_flex().size(20).flex_none().items_center().justify_center().child(svg(I("house")).size(15).text_color(t.muted));
    const logo = logoOf(r.e);
    if (logo) return image(logo).size(20).flex_none().rounded(5);
    const c = (r.s && (shared("space.colors") ?? {})[r.s.id]) ?? r.e?.color;
    return h_flex().size(20).flex_none().rounded(6).bg(paint(t, c) ?? t.dim).items_center().justify_center()
      .text_size(11).font_semibold().text_color(t.chrome).child([...(r.name ?? "?")][0]?.toUpperCase() ?? "?");
  }

  projectRow(t, r, on) {
    const m = r.marks ?? [];
    const mono = (color, text) => div().flex_none().font_family(MONO).text_size(10.5).text_color(color).child(text);
    if (r.kind === "closed") {
      return this.line(t, r, on, H.closed)
        .child(div().opacity(0.5).child(this.mark(t, r)))
        .child(this.hl(t, r.name, m[0]).flex_1().text_size(13).text_color(t.dim))
        .when(Boolean(r.e.machine), (el) => el.child(machineTag(t, r.e.machine, { id: `kp-mt-${r.key}` })))
        .child(mono(t.dim, tr("closed")));
    }
    const s = r.s;
    return this.line(t, r, on, H.project)
      .child(this.mark(t, r))
      .child(this.hl(t, r.name, m[0]).flex_none().max_w(220).text_size(13).text_color(s.active ? t.foreground : t.muted))
      .child(h_flex().flex_1().min_w(0).font_family(MONO).text_size(10.5).text_color(t.dim).child(this.hl(t, r.branch, m[1])))
      .when(Boolean(s.machine), (el) => el.child(machineTag(t, s.machine, { id: `kp-mt-${r.key}` })))
      .children(["working", "blocked", "done"].filter((st) => s.tabs.some((c) => c.status === st)).map((st) => div().size(6).rounded(3).flex_none().bg(t[st])))
      .child(mono(t.muted, String(s.tabs.length)))
      .when(s.active, (el) => el.child(mono(t.accent, tr("here"))));
  }

  render(cx) {
    const t = theme();
    const reg = registry();
    // The popup has the keyboard: in its field or on its own handle (is_focused counts no child).
    this.keyed = this.typing || this.handle.is_focused();
    const { threads, projects, pages, actions, counts } = this.rows(reg);
    const g = GROUPS[this.group];
    const sections = [
      (g === "all" || g === "threads") && [tr("section.threads"), threads, threads.length],
      (g === "all" || g === "projects") && [tr("section.projects"), projects, counts[2]],
      (g === "all" || g === "pages") && [tr("section.pages"), pages, pages.length],
      g === "all" && [tr("section.actions"), actions, actions.length],
    ].filter((x) => x && x[1].length);
    const pickable = sections.flatMap(([, list]) => list);
    // Until you move, the selection is the top row (the one that needs you, or the best match),
    // even as live data reorders the list; after that it stays on its row.
    if (!this.moved || !pickable.some((r) => r.key === this.selKey)) {
      const best = this.query.trim() ? [...pickable].sort((a, b) => b.score - a.score)[0] : pickable[0];
      this.selKey = best?.key ?? null;
    }
    this.rowsShown = pickable;
    const view = find(layout(), "view")?.active;
    const sel = this.selKey;

    // The list: eyebrows and rows as direct children (scroll_to_item counts them), fixed heights.
    const children = [];
    const slots = [];
    let total = 0;
    for (const [name, list, count] of sections) {
      children.push(
        h_flex().flex_none().h(H.eyebrow).px(10).pt(8).gap(8).items_center().font_family(MONO).text_size(10.5).text_color(t.muted)
          .child(name.toUpperCase())
          .child(div().text_color(t.dim).child(String(count)))
          .child(div().flex_1().h(1).bg(t.border)),
      );
      total += H.eyebrow;
      for (const r of list) {
        const on = r.key === sel;
        slots.push(children.length);
        total += H[r.kind];
        if (r.kind === "thread") children.push(this.threadRow(t, r, on));
        else if (r.kind === "project" || r.kind === "closed") children.push(this.projectRow(t, r, on));
        else if (r.kind === "fold") {
          children.push(this.line(t, r, on, H.fold)
            .child(h_flex().size(20).flex_none().items_center().justify_center().child(svg(I(this.showCalm ? "chevron-down" : "chevron-right")).size(13).text_color(t.dim)))
            .child(div().flex_1().font_family(MONO).text_size(10.5).text_color(t.muted).child(tr("calm", { n: r.count }))));
        } else {
          const here = r.kind === "page" && view === r.id;
          children.push(this.line(t, r, on, H[r.kind])
            .child(h_flex().size(20).flex_none().items_center().justify_center().child(svg(I(r.icon)).size(15).text_color(here ? t.accent : t.muted)))
            .child(this.hl(t, r.name, r.marks?.[0]).flex_1().text_size(13).text_color(t.foreground))
            .when(here, (el) => el.child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.accent).child(tr("shown"))))
            .when(Boolean(r.kbd), (el) => el.child(kbd(t, r.kbd))));
        }
      }
    }
    this.slots = slots;
    if (!pickable.length) {
      // Nothing: why, and what to try.
      const q = this.query.trim();
      children.push(v_flex().flex_none().h(H.empty).items_center().justify_center().gap(6)
        .child(h_flex().size(32).rounded(10).items_center().justify_center().border(1).border_color(t.border).bg(t.background)
          .child(svg(I("search")).size(15).text_color(t.dim)))
        .child(div().text_size(13).font_medium().text_color(t.foreground).child(q ? tr("noMatch", { q }) : tr("nothingIn", { group: groupName(this.group) })))
        .child(div().max_w(380).text_size(12).line_height("18px").text_color(t.muted)
          .child(q ? (this.group ? tr("tryAll") : tr("tryWord")) : tr("emptyGroup"))));
      total = H.empty;
    }
    // The list takes up to 440 px, less in a short window (56 above the card, ~190 for its field,
    // pills and foot, 24 below).
    const listH = Math.min(total + 6, 440, Math.max(120, (this.winH ?? 900) - 270));

    const typing = this.typing;
    // The foot's keys are the picker's own (vim.js, keys.json's mod:kt-picker), written as keys.json does.
    const hint = (k, what) => h_flex().gap(5).items_center().child(kbd(t, k)).child(div().child(what));
    // vim's mode (kt-keys' pill): INSERT on the ink, NORMAL neutral.
    const mode = div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(typing ? "INSERT" : "NORMAL");
    const dark = settings().dark;
    // The modals' motion (ANIMATIONS.md, kt-keys' motif): the veil fades in and the card rises 6 px,
    // 180 ms, once, on the first size report, and goes back out on dismiss (motion.js sheet);
    // reduced motion: there at once.
    const still = Boolean(shared("kt.reducedMotion"));
    const shown = still || Boolean(this.winH);
    const s = sheet(frame(this.motion, still), "kp", shown);
    const card = s.card(v_flex()
      .id("kp-card")
      .flex_none()
      .w_full()
      .max_w(680))
      // Clicks in the card stay in it (the veil around it closes).
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .p(4)
      .rounded(20)
      .bg(t.popover)
      .border(1)
      .border_color(t.border)
      .shadow_lg()
      .text_size(13)
      .text_color(t.foreground)
      .child(
        v_flex()
          .rounded(16)
          .bg(t.surface)
          .border(1)
          .border_color(t.border)
          .child(
            v_flex()
              .id("kp-top")
              .relative()
              .p(12)
              .pb(4)
              .gap(10)
              // A discreet accent dither behind the field and the groups, cut at the inner card's
              // corners (radius 16 less its border).
              .on_size_change((size, cx) => {
                if (Math.abs((this.topW ?? 0) - size.width) < 0.5) return;
                this.topW = size.width;
                cx.notify();
              })
              .when(this.topW > 30, (el) => el.child(ditherBand(this.topW, 60, 15, alpha(t.accent, dark ? "40" : "33"), TOP)))
              // The field (radius 12) in its accent ring (3 px, radius 15) while it has the keyboard.
              .child(
                div()
                  .p(3)
                  .rounded(15)
                  .bg(typing ? alpha(t.accent, "33") : alpha(t.accent, "00"))
                  .child(
                    h_flex()
                      .h(44)
                      .px(14)
                      .gap(10)
                      .items_center()
                      .rounded(12)
                      .bg(t.background)
                      .border(1)
                      .border_color(typing ? t.accent : t.input)
                      .child(svg(I("search")).size(15).flex_none().text_color(t.dim))
                      .child(Input.new(this.input).flex_1().h_full().text_size(15).text_color(t.foreground))
                      .child(div().id("kp-esc").flex_none().cursor_pointer().on_click((_e, cx) => this.dismiss(cx)).child(kbd(t, "escape"))), // i18n: tech
                  ),
              )
              // The groups (filters.js), ⌘1-4 or tab / shift-tab; the ink glides to the one picked.
              .child(filterRow({
                id: "kp-groups", state: this.groups, t, bg: t.surface, reduced: still,
                items: GROUPS.map((id, i) => ({ key: id, label: groupName(i), count: counts[i], tint: GROUP_TINT[id] ?? null })),
                active: GROUPS[this.group],
                onPick: (key) => {
                  this.setGroup(GROUPS.indexOf(key));
                  this.refocus();
                },
              })),
          )
          .child(
            v_flex()
              .id("kp-list")
              .h(listH)
              .min_h(0)
              .px(6)
              .pb(6)
              .overflow_y_scrollbar()
              .track_scroll(this.scroll)
              .children(children),
          )
          // The foot, under a dashed rule: the keys.
          .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
          .child(
            h_flex()
              .px(14)
              .py(10)
              .gap(12)
              .items_center()
              .text_size(11)
              .text_color(t.dim)
              .when(this.keyed, (el) => el.child(mode))
              .child(hint("up / down", tr("hint.move")))
              .child(hint("enter", tr("hint.open")))
              .child(hint("cmd-1…4", tr("hint.filter")))
              .when(this.selected()?.kind === "thread", (el) => el.child(hint("ctrl-d", tr("hint.closeThread"))))
              .child(div().flex_1())
              .child(hint("escape", typing ? tr("hint.normal") : tr("hint.close"))),
          ),
      );

    // A full-window dialog (mod.json): our own veil, darker than the native dim (which barely
    // shows in Glass), the card on top of it, centered, 56 px down. A click on the veil closes.
    return s.veil(v_flex()
      .id("kt-picker")
      .size_full()
      .items_center()
      .px(16)
      .pt(56)
      .bg(alpha(dark ? "#000000" : "#0a0a0a", dark ? "8c" : "59")))
      .on_size_change((size, cx) => {
        this.winH = size.height / (settings().zoom || 1);
        cx.notify();
      })
      // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
      .on_mouse_down("left", (_e, cx) => this.dismiss(cx))
      // NORMAL's keys land on this handle; the field's keys bubble up here too. Esc is stopped
      // (INSERT: NORMAL; NORMAL: closes), so Herdr's own Esc doesn't close a second dialog under it.
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(card);
  }
}
