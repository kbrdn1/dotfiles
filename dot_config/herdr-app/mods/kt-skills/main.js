// kbrdn Skills (Monocode's Settings › Skills, kbrdn.dev look): every Claude Code
// skill and slash command on this machine, read-only, as a page: the "skills"
// child of kbrdn-threads' main "view" stack (kt-threads' Skills shows it), or a
// dialog (openOverlay; props.select opens one skill by name).
// Sources: ~/.claude/skills/**/SKILL.md (synced/<id>/x is claude.ai's,
// anthropic-skills:x), ~/.agents/skills/**/SKILL.md (the folder shared between
// harnesses, the real home of many skills linked into ~/.claude/skills: one
// entry per real path, named as Claude Code lists it), the enabled plugins'
// skills and commands (settings.json enabledPlugins, installed_plugins.json's
// install), ~/.claude/commands/**/*.md, and the shown space's git root's
// .claude/skills and .claude/commands. Names follow the path, as Claude Code
// lists them: skills/me/loop/x/SKILL.md is me:loop:x, a plugin's are plugin:x.
// Top: title, counter, filter, refresh, source segments. Then one card-row per
// skill (name, description, path; source and harness; on hover preview, copy,
// open), grouped by source, 80 to a page. A row opens the detail on the right:
// description and frontmatter in a card, then SKILL.md (markdown.js: Aperçu, its fenced code in
// Zed's colors, or Brut, its source in Zed's colors; p or the two chips switch), ~80 characters a
// line, scrolling; a relative link to another .md of the skill opens it in the same pane (SKILL.md ›
// file, its frontmatter as fields, back on SKILL.md), anything else of it in Zed, the web in the
// browser. Copy / Zed (the file shown) / Finder.
// Scans when the page shows, when the shown space changes while it shows, and
// on Rafraîchir; never on a timer. Files are re-read only when their mtime moved.
// Selection (select.js): ⌘-click toggles a row, ⇧-click selects from the anchor, the box left of a
// row (on hover, or once one is selected) toggles it; a plain click opens and empties it. While
// rows are selected, a bar floats at the list's foot: copy the /names (one a line), open in Zed,
// reveal in the Finder, ✕ to empty.
// + Ajouter (the header, `a`, kt-skills.add): this mod again as a popup (props.add "menu": with the
// assistant, an empty skeleton, from a folder, from GitHub, from a plugin), then as a dialog
// (props.add: the way): its form, then a confirmation showing the exact commands (form.js, add.js).
// The source segments are a filter row (FILTERS.md): one line scrolling sideways, pale tints.
// Mod commands: kt-skills.add, kt-skills.refresh, kt-skills.bulk:<copy|zed|finder> (tests).
// Keys (vim.js; kt-keys lists them under Pages): the page opens typing in the filter (INSERT);
// ctrl-b h/l (pane.go, "focus") or `kt-skills.key:<keys>` give it the keyboard in NORMAL.
// INSERT: type to filter, ctrl-n/ctrl-p, ctrl-j/ctrl-k, ↓ ↑ move the cursor, enter opens it, esc:
// NORMAL. NORMAL: j/k, gg/G, ctrl-d/u, n/N move the cursor over the rows and the "Fragments et
// templates" folds, across pages (k on the first row: the filter, INSERT); / the filter, tab /
// shift-tab the source segments, enter/o/l open the detail (a click; on a fold: unfold), h folds,
// O Zed, y copies /skill, r refresh, a + Ajouter, p Aperçu / Brut of the open file, ? kt-keys, q back
// to the thread (a dialog closes); x or space
// toggle the row's selection, V a visual range (j/k extend it, esc ends it), ctrl-a selects every
// listed row; esc ends the range, then empties the selection, then clears the filter, then as q.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { exec, readTextFile, theme, spaces, panes, run, layout, props, home, notify, checking, nextCommand, openOverlay, closeOverlay, shared, watchFolder } from "herdr";
import { frontmatter } from "./frontmatter.js";
import { parse as mdParse, mdState, view, tabs, target } from "./markdown.js";
import { Select } from "./select.js";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { AddMenu, AddForm, menuSize } from "./form.js";
import { filterRow, filterState } from "./filters.js";
import { dither, iconBtn, bandRow, moreMenu } from "./band.js";
import { motionState, frame, enter, pulse, rows as rowsOf } from "./motion.js";
import { skeleton, still } from "./skeleton.js";
// kt-keys' roll.js (a byte-identical copy): the head's and the selection's counts roll to their new digits.
import { rollText } from "./roll.js";
import { bump, refreshOn } from "./bus.js";
import { METHODS } from "./add.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);

const MONO = "Monaspace Krypton";
const MEASURE = 620; // the viewer's text column, padding included: ~80 characters of 13.5 px Inter
const I = (name) => `mods/kt-threads/${name}.svg`;
const OWN = (name) => `mods/kt-skills/${name}.svg`;
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const PAGE = 80; // rows per page: plain rows (a virtual list's rows can't hold their own buttons)
// The source segments and their filter tints (FILTERS.md; "Tous" stays neutral).
const SEGS = [["all"], ["personal", "ansi4"], ["plugin", "ansi5"], ["project", "ansi2"], ["command", "ansi3"]];
// A group's key word per source: glabel ("Personnel · me") keys the ids (kts-fold-…) and the
// unfolded set, the same in every language; gtext() shows it in words (strings.js' src.<source>).
const GROUP = { personal: "Personnel", plugin: "Plugin", project: "Projet", commands: "Commandes" }; // i18n: tech
const gtext = (g) => {
  const i = g.indexOf(" · ");
  const src = Object.keys(GROUP).find((k) => GROUP[k] === g.slice(0, i));
  return src ? `${tr(`src.${src}`)}${g.slice(i)}` : g;
};
// The whole scan in one process: each (glob, dir) listed by rg (links followed, hidden
// folders skipped), then every file's mtime and real path (macOS stat: PATH's may be GNU's).
const LIST = `while [ $# -gt 1 ]; do g=$1; d=$2; shift 2; [ -d "$d" ] && rg --files --follow --no-ignore -g "$g" "$d"; done | tr '\\n' '\\0' | xargs -0 /usr/bin/stat -L -f '%m%t%R%t%N'`;

const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };
const dirOf = (p) => p.slice(0, p.lastIndexOf("/"));
const tilde = (p) => (p.startsWith(home() + "/") ? `~${p.slice(home().length)}` : p);
const fmt = (v) => (Array.isArray(v) ? v.join(", ")
  : v && typeof v === "object" ? Object.entries(v).map(([k, s]) => `${k}: ${s}`).join(" · ")
  : String(v ?? "")).trim();
// A list entry's id for the keys' cursor: a row's key, or its group's fold.
const idOf = (e) => e.x?.key ?? `fold:${e.glabel}`;

// Shown: kbrdn-threads' main "view" stack is on this page, or this copy is a dialog.
function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
function visible() {
  if (props()?.overlay) return true;
  const v = find(layout(), "view");
  return (v?.active ?? v?.children?.[0]?.id) === "skills";
}
const activeSpace = () => spaces().find((s) => s.active);

export default class Skills extends View {
  init(_props, cx) {
    // + Ajouter's popup or dialog: this mod again, in that role only (no scan, no page keys).
    const add = props()?.add;
    if (add) {
      const m = METHODS.find((x) => x.id === add);
      this.role = add === "menu" ? new AddMenu("kt-skills", METHODS, cx) : m ? new AddForm("kt-skills", m, cx) : null;
      if (!checking()) cx.spawn(async (cx) => {
        for (;;) {
          const c = await nextCommand();
          this.role?.command(c, cx);
          cx.notify();
        }
      });
      return;
    }
    this.handle = cx.focus_handle();
    this.segRow = filterState(); // the source filter row (filters.js)
    this.motion = motionState(); // motion.js: the detail and the bulk bar fade in, the rows open and close
    this.headW = 0; // the head card's width (its dither)
    this.more = false; // the head's ⋯ menu
    this.scannedAt = 0;
    this.watches = []; // ~/.claude/skills and ~/.claude/commands while the page shows
    this.root = null; // the shown space's git root, as the last scan found it
    this.scroll = ScrollHandle.new();
    this.query = "";
    this.seg = "all";
    this.page = 0;
    this.items = [];
    this.cache = new Map(); // "path\treal" -> { mtime, item }
    this.sel = null; // the open item's key
    this.doc = null; // the file its viewer shows: { key, path, md, note } (md: markdown.js' parse, null while read)
    this.md = mdState(); // Aperçu / Brut (kept from one file to the next) and the colors asked
    this.docScroll = ScrollHandle.new();
    this.multi = new Select(); // the rows selected for the bulk bar (keys)
    this.hot = null; // the hovered row's key
    this.reveal = null; // a row to scroll to once drawn (props.select)
    this.unfolded = new Set(); // groups whose "Fragments et templates" are open
    this.error = null;
    this.busy = false;
    this.scanned = false;
    this.space = undefined; // the space the last scan looked at
    this.width = 1100;
    this.vim = new Vim({ field: true });
    this.cur = null; // the keys' cursor (idOf an entry); null: the page's first
    if (checking()) return;
    // The keyboard left without a render (a click on a terminal): the cursor goes out.
    // Recorded here too: a hidden copy never renders, so a stale `keyed` would notify every second.
    cx.timer.every(1000, (cx) => { const f = this.handle.is_focused(); if (this.keyed !== f) { this.keyed = f; cx.notify(); } });
    // `focus` (pane.go) takes the keyboard in NORMAL; `key:<keys>` takes it and types those keys
    // ("j", "g g", "/ r e v i e w"), for tests.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn();
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        }
        // `bulk:<id>`: the bulk bar's action of that id (copy, zed, finder), as its click, for tests.
        else if (c.startsWith("bulk:")) this.bulkActions?.find(([id]) => id === c.slice(5))?.[3](cx);
        else if (c === "add") this.openAdd();
        else if (c === "refresh") this.scan(cx);
        cx.notify();
      }
    });
  }

  // ---------- data ----------

  // The shown space's git root (local spaces: a remote one's files are on that machine).
  async projectRoot() {
    const s = activeSpace();
    if (!s || s.machine) return null;
    const tab = s.tabs.find((x) => x.active);
    const mine = panes().filter((p) => p.tab === tab?.id && p.terminal);
    const cwd = (mine.find((p) => p.program?.agent) ?? mine[0])?.cwd ?? s.folder;
    if (!cwd) return null;
    const r = await exec("git", ["-C", cwd, "rev-parse", "--show-toplevel"]).catch(() => null);
    return r?.code === 0 ? r.stdout.trim() : null;
  }

  // Where to look, in dedupe order: ~/.claude/skills first, so a skill linked there from
  // ~/.agents/skills keeps the name Claude Code gives it.
  async roots() {
    const h = home();
    const C = `${h}/.claude`;
    const roots = [
      { dir: `${C}/skills`, glob: "SKILL.md", kind: "skill", source: "personal", group: "~/.claude/skills", order: 0 },
      { dir: `${h}/.agents/skills`, glob: "SKILL.md", kind: "skill", source: "personal", group: "~/.agents/skills", order: 2 },
    ];
    const [st, inst, proj] = await Promise.all([
      readTextFile(`${C}/settings.json`).catch(() => null),
      readTextFile(`${C}/plugins/installed_plugins.json`).catch(() => null),
      this.projectRoot(),
    ]);
    this.root = proj && proj !== h ? proj : null; // + Ajouter's project scope
    const installed = parse(inst)?.plugins ?? {};
    for (const [key, on] of Object.entries(parse(st)?.enabledPlugins ?? {})) {
      if (on !== true) continue;
      const [plugin, market] = key.split("@");
      const all = installed[key] ?? [];
      const e = all.find((x) => x.scope === "user") ?? all.find((x) => x.projectPath === proj) ?? all[0];
      let dir = e?.installPath, version = e?.version;
      if (!dir && market) { // no installed_plugins.json entry: the cache's newest version
        const base = `${C}/plugins/cache/${market}/${plugin}`;
        version = (await exec("ls", ["-t", base]).catch(() => null))?.stdout.split("\n")[0]?.trim();
        dir = version ? `${base}/${version}` : null;
      }
      if (!dir) continue;
      const common = { source: "plugin", group: plugin, prefix: plugin, version, order: 3 };
      roots.push({ ...common, dir: `${dir}/skills`, glob: "SKILL.md", kind: "skill" });
      roots.push({ ...common, dir: `${dir}/commands`, glob: "*.md", kind: "command" });
    }
    // At home, the "project" is ~/.claude itself: already listed.
    if (proj && proj !== h) {
      const common = { source: "project", group: proj.split("/").pop(), order: 4 };
      roots.push({ ...common, dir: `${proj}/.claude/skills`, glob: "SKILL.md", kind: "skill" });
      roots.push({ ...common, dir: `${proj}/.claude/commands`, glob: "*.md", kind: "command" });
    }
    roots.push({ dir: `${C}/commands`, glob: "*.md", kind: "command", source: "personal", group: "~/.claude/commands", order: 5 });
    return roots;
  }

  scan(cx) {
    if (this.busy) return;
    this.busy = true;
    this.space = activeSpace()?.id ?? null;
    cx.spawn(async (cx) => {
      try {
        const roots = await this.roots();
        const r = await exec("sh", ["-c", LIST, "sh", ...roots.flatMap((x) => [x.glob, x.dir])], { timeout: 60e3 });
        const files = [];
        for (const line of r.stdout.split("\n")) {
          const [mtime, real, path] = line.split("\t");
          if (!path) continue;
          const root = roots.filter((x) => path.startsWith(x.dir + "/")).sort((a, b) => b.dir.length - a.dir.length)[0];
          if (root) files.push({ path, real, mtime: Number(mtime), root });
        }
        // A SKILL.md inside another skill's folder (a bundled venv's) isn't a skill.
        const skillDirs = new Set(files.filter((f) => f.root.kind === "skill").map((f) => dirOf(f.path)));
        const nested = (f) => {
          for (let d = dirOf(dirOf(f.path)); d.length > f.root.dir.length; d = dirOf(d)) if (skillDirs.has(d)) return true;
          return false;
        };
        const seen = new Set();
        const keep = files.filter((f) => {
          if (f.root.kind === "skill" && nested(f)) return false;
          if (seen.has(f.real)) return false; // the same file seen through a link
          seen.add(f.real);
          return true;
        });
        this.items = await Promise.all(keep.map(async (f) => {
          const k = `${f.path}\t${f.real}`;
          const c = this.cache.get(k);
          if (c?.mtime === f.mtime) return c.item;
          const item = this.item(f, await readTextFile(f.path).catch(() => null));
          this.cache.set(k, { mtime: f.mtime, item });
          return item;
        }));
        // By group, its internal bricks last, then by name (me: aside).
        this.items.sort((a, b) => a.order - b.order || a.group.localeCompare(b.group) || a.internal - b.internal || a.sort.localeCompare(b.sort));
        this.multi.keep(this.items.map((x) => x.key)); // gone (another project): out of the selection
        this.error = this.items.length ? null : r.stderr.trim() || null;
        // A dialog asked for one skill (props.select): open it once; list() pages and scrolls to it.
        const want = props()?.select;
        const x = want && !this.scanned ? this.items.find((i) => i.name === want) : null;
        if (x) {
          this.reveal = x.key;
          this.select(x, cx);
        }
      } catch (e) {
        this.error = String(e);
      } finally {
        this.busy = false;
        this.scanned = true;
        this.scannedAt = Date.now();
        cx.notify();
      }
    });
  }

  item(f, text) {
    const { meta } = frontmatter(text ?? "");
    const r = f.root;
    const rel = f.path.slice(r.dir.length + 1);
    let parts = r.kind === "skill" ? rel.split("/").slice(0, -1) : rel.replace(/\.md$/i, "").split("/");
    let group = r.group, order = r.order;
    // ponytail: Claude Code lists synced/<id>/x as anthropic-skills:x (its claude.ai skills); hardcoded.
    if (r.source === "personal" && r.kind === "skill" && parts[0] === "synced" && parts.length > 2) {
      parts = ["anthropic-skills", ...parts.slice(2)];
      group = "claude.ai";
      order = 1;
    }
    const name = [r.prefix, ...parts].filter(Boolean).join(":");
    const label = GROUP[r.kind === "command" && r.source === "personal" ? "commands" : r.source];
    const off = fmt(meta["user-invocable"]).toLowerCase() === "false";
    return {
      key: f.path, path: f.path, real: f.real, name, kind: r.kind, source: r.source, group, order,
      // _fragments, _templates: internal bricks, folded at the end of their group.
      internal: Boolean(parts[0]?.startsWith("_")), sort: name.replace(/^me:/, ""),
      glabel: `${label} · ${group}`, version: r.version ?? null, meta,
      harness: f.real.startsWith(`${home()}/.agents/`) ? "agents" : "claude",
      description: fmt(meta.description), model: fmt(meta.model), tools: fmt(meta["allowed-tools"]),
      // Claude Code doesn't load ~/.agents/skills itself: only what's linked into ~/.claude/skills (kept
      // under that path by the dedupe) is a /command. The "agents" harness label says why, no badge.
      off, invocable: r.kind === "command" || (!off && !f.path.startsWith(`${home()}/.agents/`)),
      unreadable: text == null,
    };
  }

  matches(x, seg) {
    if (seg === "personal") return x.source === "personal" && x.kind === "skill";
    if (seg === "plugin" || seg === "project") return x.source === seg;
    if (seg === "command") return x.kind === "command";
    return true;
  }

  // The query's matches (name, frontmatter name, description), before the source filter.
  queried() {
    const q = this.query.trim().toLowerCase();
    return q ? this.items.filter((x) => `${x.name} ${fmt(x.meta.name)} ${x.description}`.toLowerCase().includes(q)) : this.items;
  }

  // What the list shows: the query's matches in the segment.
  listed() {
    return this.queried().filter((x) => this.matches(x, this.seg));
  }

  // What the pages hold: the rows, each group's internal bricks (sorted last) behind one fold.
  entries(shown) {
    const internal = {};
    for (const x of shown) if (x.internal) internal[x.glabel] = (internal[x.glabel] ?? 0) + 1;
    const entries = [];
    shown.forEach((x, i) => {
      const open = this.unfolded.has(x.glabel);
      const prev = shown[i - 1];
      if (x.internal && !(prev?.internal && prev.glabel === x.glabel)) entries.push({ glabel: x.glabel, fold: internal[x.glabel], open });
      if (!x.internal || open) entries.push({ glabel: x.glabel, x });
    });
    return entries;
  }

  select(x, cx) {
    if (this.sel === x.key && this.doc?.key === x.key) return;
    this.sel = x.key;
    this.loadDoc(x, x.path, cx);
  }

  // A file of the open skill for the viewer, parsed by markdown.js (in a task, never in render): SKILL.md
  // without its frontmatter's fields (the card above shows them), or a .md one of its links points to.
  loadDoc(x, path, cx) {
    this.doc = { key: x.key, path, md: null, note: null };
    cx.spawn(async (cx) => {
      const text = await readTextFile(path).catch(() => null);
      if (this.doc?.key !== x.key || this.doc.path !== path) return;
      const md = mdParse(text ?? "", { fields: path !== x.path });
      this.doc.md = md;
      this.doc.note = text == null ? "unreadableMd" : md.segs.length || md.fields.length ? null : "emptyMd";
      this.docScroll.scroll_to_item(0);
      cx.notify();
    });
  }

  // A link in the viewer: the web in the browser; a .md of the skill (relative, or absolute) in this
  // pane when it reads, else in Zed, as any other file; an anchor alone does nothing.
  link(x, url, cx) {
    const to = target(url, dirOf(this.doc?.path ?? x.path));
    if (to?.web) return void exec("open", [to.web]).catch(() => {});
    if (!to) return;
    const path = to.path;
    if (!/\.(md|markdown)$/i.test(path)) return this.zed([path]);
    cx.spawn(async (cx) => {
      if ((await readTextFile(path).catch(() => null)) == null) return this.zed([path]);
      this.loadDoc(x, path, cx);
      cx.notify();
    });
  }

  // + Ajouter's popup (this mod as the menu), with what its forms need: the space, its project root.
  openAdd() {
    if (checking()) return;
    openOverlay({ mod: "kt-skills", kind: "popup", frame: "none", ...menuSize(METHODS.length),
      props: { add: "menu", space: activeSpace()?.id ?? null, root: this.root } });
  }

  async close() {
    await this.role?.dispose?.();
  }

  copy(x, cx) {
    const text = x.invocable ? `/${x.name}` : x.name;
    cx.write_to_clipboard(text);
    notify({ title: tr("copied"), body: text, level: "success", timeout: 2000 });
  }

  // Zed's CLI when it's there (every file in one window), else its URL scheme, one by one.
  zed(paths) {
    exec("zed", paths).catch(() => { for (const p of paths) exec("open", [`zed://file${p}`]).catch(() => {}); });
  }

  // What the selection walks: every listed row, in order, across pages (not folds, nor what they hide).
  order() {
    return this.entries(this.listed()).filter((e) => e.x).map((e) => e.x.key);
  }

  // ---------- pieces ----------

  card(t) {
    return v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
  }

  eyebrow(t, text, color) {
    return div().font_family(MONO).text_size(11).text_color(color ?? t.muted).child(String(text).toUpperCase());
  }

  // kbrdn.dev `.tag`: pill, border 30% / fill 10% of its own color.
  tag(t, color, text) {
    return h_flex().flex_none().h(18).px(7).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
      .text_color(color).font_family(MONO).text_size(10).child(String(text).toUpperCase());
  }

  dashed(t) {
    return div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
  }

  empty(t, text, color) {
    return div().p(16).text_size(13).text_color(color ?? t.dim).child(text);
  }

  // A small round icon button; it keeps its click from the row.
  icon(t, id, icon, tip, onClick) {
    return div().id(id).p(4).rounded_full().flex_none().text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); cx.notify(); })
      .child(svg(icon).size(13));
  }

  pill(t, id, label, icon, onClick) {
    return h_flex().id(`kts-${id}`).flex_none().h(30).px(13).gap(6).items_center().rounded_full().border(1)
      .border_color(t.border).bg(t.background).text_size(12.5).font_medium().text_color(t.foreground)
      .cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { onClick(cx); cx.notify(); })
      .when(Boolean(icon), (el) => el.child(svg(icon).size(13)))
      .child(label);
  }

  // A row's selection box (select.js): drawn on hover or once a row is selected, its room always
  // kept so the row never moves; a click toggles the row, as ⌘-click does.
  check(t, id, on, shown, onClick) {
    return div().id(id).size(16).flex_none().rounded(5).border(1).flex().items_center().justify_center()
      .when(!shown, (el) => el.border_color(alpha(t.input, "00")))
      .when(shown, (el) => el.border_color(on ? t.accent : t.input).bg(on ? t.accent : t.background).cursor_pointer()
        .hover((s) => s.border_color(t.accent))
        .on_click((_e, cx) => { cx.stop_propagation(); onClick(); cx.notify(); }))
      .when(on, (el) => el.child(svg(I("check")).size(11).text_color(t.accent_foreground)));
  }

  // The bulk bar (select.js): floats over the list's foot while rows are selected: how many, the
  // actions ([id, label, icon, onClick]), ✕ to empty. A card (radius 12, shadow), its buttons 4 px in: 8.
  bulkBar(t, n, actions) {
    // It fades in and rises 6 px when a first row is selected (motion.js).
    // Narrow (the detail and the panel open), its buttons wrap rather than leave the list.
    return h_flex().absolute().bottom(12).left(0).right(0).px(8).justify_center()
      .child(enter(this.m, div().max_w_full(), "kts-bulk-in").child(h_flex().id("kts-bulk").max_w_full().flex_wrap().p(4).gap(2).items_center().rounded(12).border(1).border_color(t.border).bg(t.popover).shadow_lg()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(div().pl(10).pr(8).font_family(MONO).text_size(11).text_color(t.foreground).child(rollText(this.m, "kts-sel-n", tr("selected", { n }), 15)))
        .child(div().w(1).h(18).flex_none().bg(t.border))
        .children(actions.map(([id, label, icon, onClick]) => h_flex().id(`kts-bulk-${id}`).h(28).px(10).gap(6).items_center().rounded(8)
          .text_size(12).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { onClick(cx); cx.notify(); })
          .child(svg(icon).size(13)).child(label)))
        .child(h_flex().id("kts-bulk-clear").size(28).flex_none().items_center().justify_center().rounded(8).text_color(t.muted)
          .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tr("clearSelection"))
          .on_click((_e, cx) => { this.multi.clear(); cx.notify(); })
          .child(svg(I("x")).size(13)))));
  }

  // The bar's actions on the selected skills (hidden by the filter or not), in list order.
  bulk(t) {
    const picked = this.multi.pick(this.items, (x) => x.key);
    this.bulkActions = null;
    if (!picked.length) return null;
    this.bulkActions = [
      ["copy", tr("copyNames"), OWN("copy"), (cx) => {
        cx.write_to_clipboard(picked.map((x) => (x.invocable ? `/${x.name}` : x.name)).join("\n"));
        notify({ title: tr("namesCopied", { n: picked.length }), body: tr("onePerLine"), level: "success", timeout: 2000 });
      }],
      ["zed", tr("openZed"), I("external-link"), () => this.zed(picked.map((x) => x.real))],
      ["finder", tr("revealFinder"), I("folder"), () => exec("open", ["-R", ...picked.map((x) => x.real)]).catch(() => {})],
    ];
    return this.bulkBar(t, picked.length, this.bulkActions);
  }

  // ---------- header ----------

  // ---------- keys (vim.js; kt-keys lists them) ----------

  // The keyboard comes here (pane.go, a key command): NORMAL, the cursor on the open skill.
  focusIn() {
    this.handle.focus();
    this.vim.normal();
    const entries = this.entries(this.listed());
    if (!entries.some((e) => idOf(e) === this.cur)) this.cur = entries.some((e) => idOf(e) === this.sel) ? this.sel : null;
    const e = this.at(entries);
    this.reveal = e ? idOf(e) : null;
  }

  // The cursor's entry: this.cur when listed, else the shown page's first.
  at(entries) {
    return entries.find((e) => idOf(e) === this.cur) ?? entries[Math.min(this.page * PAGE, entries.length - 1)] ?? null;
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One key (an event, or a name from `kt-skills.key:`): the selection's first (select.js, NORMAL
  // only: x space V ctrl-a esc), then p (Aperçu / Brut of the open file), then vim's; a visual range
  // then follows the cursor.
  press(k, cx) {
    const cur = () => { const e = this.at(this.entries(this.listed())); return e ? idOf(e) : null; };
    if (!this.vim.insert && this.multi.key(keyOf(k).name, cur(), this.order())) {
      this.vim.normal(); // a `d` or a count typed before it is dropped
      return true;
    }
    if (!this.vim.insert && keyOf(k).name === "p" && this.doc) {
      this.vim.normal();
      this.md.raw = !this.md.raw;
      return true;
    }
    if (!this.keyAct(this.vim.handle(k), cx)) return false;
    if (this.multi.visual) this.multi.follow(cur(), this.order());
    return true;
  }

  // One vim action; false: not one this page has, and the key goes on.
  keyAct(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count" || a === "filter" || a === "normal") return true;
    const entries = this.entries(this.listed());
    const e = this.at(entries);
    const i = entries.indexOf(e);
    // The cursor onto an entry; list() turns to its page and scrolls to it (reveal).
    const go = (to) => {
      if (!to) return;
      this.cur = idOf(to);
      this.reveal = this.cur;
    };
    if (a === "type" || a === "backspace") {
      this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
      this.page = 0;
      this.cur = null;
    } else if (a === "up" && i <= 0 && !this.vim.insert) this.vim.edit(); // k on the first row: the filter
    else if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev"].includes(a))
      go(entries[step(a === "next" ? "down" : a === "prev" ? "up" : a, i, entries.length, this.vim.count, 10)]);
    else if (a === "tab-next" || a === "tab-prev") {
      const k = SEGS.findIndex(([id]) => id === this.seg);
      this.seg = SEGS[(k + (a === "tab-next" ? 1 : SEGS.length - 1)) % SEGS.length][0];
      this.page = 0;
      this.cur = null;
    } else if (e && !e.x && ["open", "right", "submit", "left"].includes(a)) {
      // A fold: enter / o flip it, l unfolds, h folds.
      if (a === "left" || (a !== "right" && e.open)) this.unfolded.delete(e.glabel);
      else this.unfolded.add(e.glabel);
    } else if (a === "open" || a === "right" || a === "submit") { if (e) this.select(e.x, cx); }
    else if (a === "left") {
      // h on a fragment folds its group, the cursor on the fold.
      if (!e?.x.internal) return false;
      this.unfolded.delete(e.glabel);
      go({ glabel: e.glabel });
    } else if (a === "open-alt") { if (e?.x) this.zed([e.x.real]); }
    else if (a === "yank") { if (e?.x) this.copy(e.x, cx); }
    else if (a === "refresh") { if (!checking()) this.scan(cx); }
    else if (a === "archive") this.openAdd(); // a: + Ajouter
    else if (a === "escape" && this.query) {
      this.query = "";
      this.page = 0;
      this.cur = null;
    } else if (a === "escape" || a === "quit") {
      if (props()?.overlay) closeOverlay(props().overlay);
      else run("layout.select", { stack: "view", child: "thread" });
    } else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else return false;
    return true;
  }

  // NORMAL / INSERT (kt-keys' pill), mono 9 px, while the page has the keyboard.
  mode(t, typing) {
    return div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(this.vim.label);
  }

  header(t, q, shown) {
    const typing = this.keyed && this.vim.insert;
    const skills = this.items.filter((x) => x.kind === "skill").length;
    const filtered = this.query.trim() || this.seg !== "all";
    const count = !this.scanned ? "…" : filtered ? `${shown} / ${this.items.length}` : tr("count", { skills, commands: this.items.length - skills });
    // Concentric radii: the card (16) holds its toolbar 4 px in, so the toolbar's boxes are 12.
    const seg = filterRow({ id: "kts-seg", t, state: this.segRow, active: this.seg, reduced: Boolean(shared("kt.reducedMotion")),
      items: SEGS.map(([key, tint]) => ({ key, label: tr(`seg.${key}`), tint, count: q.filter((x) => this.matches(x, key)).length })),
      onPick: (k) => { this.seg = k; this.page = 0; this.cur = null; } });
    // DESIGN-REFERENCE.md's head: the band on the page's dither (Skills: ansi4), the rest under it.
    return this.card(t).id("kts-head").relative().flex_none().px(4).pb(4).gap(4)
      .on_size_change((s, cx) => { if (s.width !== this.headW) { this.headW = s.width; cx.notify(); } })
      .children([dither(this.headW, 60, 16, t.ansi4)].filter(Boolean))
      .child(bandRow(t, { m: this.m, color: t.ansi4, icon: I("sparkles"), title: "Skills", // i18n: tech
        // Filtering or not in the id: « shown / total » and « N skills · N commandes » don't roll into each other.
        // Before the first scan, the count as a bar (skeleton.js), breathing.
        sub: [!this.scanned && !this.error ? ((S) => S.pulse(S.line(110, { h: 7, lh: 14 }).id("kts-count-sk")))(skeleton(t, this.m))
          : rollText(this.m, `kts-head-n-${filtered ? "f" : "a"}`, count, 14), tr("sources")],
        buttons: [
          iconBtn(t, "kts-b-add", I("plus"), tr("addTip"), () => this.openAdd()),
          iconBtn(t, "kts-b-refresh", I("refresh-cw"), this.busy ? tr("analysingTip") : tr("refreshTip"), (cx) => { if (!checking()) this.scan(cx); }),
          iconBtn(t, "kts-b-more", "mods/kt-crosstalk/ellipsis.svg", tr("moreTip"), () => { this.more = !this.more; }, this.more)] }))
      .child(div().flex_none().mx(-4).h(0).border_t(1).border_dashed().border_color(alpha(t.ansi4, "4d")))
      .child(h_flex().flex_wrap().gap(4).items_center()
        // The filter: the keys' ring (and the ink) while typing in it; the mode beside it.
        .child(h_flex().id("kts-filter").w(280).h(36).px(12).gap(8).items_center().rounded(12).border(1)
          .border_color(typing ? alpha(t.accent, "99") : t.border).when(typing, (el) => el.bg(alpha(t.accent, "24"))).cursor_text()
          .track_focus(this.handle)
          .on_key_down((e, cx) => this.key(e, cx))
          // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
          .on_mouse_down("left", (_e, cx) => { this.vim.edit(); this.handle.focus(); cx.notify(); })
          .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
          .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
            .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : tr("filter")))
          .when(Boolean(this.query), (el) => el.child(div().id("kts-clear").flex_none().text_color(t.dim).cursor_pointer()
            .hover((s) => s.text_color(t.foreground))
            .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.handle.focus(); }) // not the field's press: × keeps the mode
            .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; this.page = 0; this.cur = null; cx.notify(); })
            .child(svg(I("x")).size(13)))))
        .when(Boolean(this.keyed), (el) => el.child(this.mode(t, typing)))
        .when(this.busy, (el) => el.child(pulse(this.m, div().px(8).font_family(MONO).text_size(11).text_color(t.dim).child(tr("analysing")), true))))
      .child(div().px(4).pb(2).child(seg));
  }

  // The head's ⋯: the rest of the page's actions.
  moreItems() {
    const dir = `${home()}/.claude/skills`;
    return [
      ["kts-mi-add", I("plus"), tr("mi.add"), () => this.openAdd()],
      ["kts-mi-finder", I("folder"), tr("mi.finder"), () => exec("open", [dir]).catch(() => {})],
      ["kts-mi-zed", I("external-link"), tr("mi.zed"), () => this.zed([dir])],
      ["kts-mi-keys", I("keyboard"), tr("mi.keys"), () => openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } })],
    ];
  }


  // ---------- list ----------

  groupRow(t, label, n, first) {
    return h_flex().px(8).pt(first ? 6 : 14).pb(6).gap(10).items_center()
      .child(this.eyebrow(t, `${gtext(label)} · ${n}`).flex_none())
      .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border));
  }

  // `cursor`: "ring" (NORMAL: a 1 px accent ring with the ink), "mark" (INSERT: ctrl-n/p's row) or null.
  // Selected (select.js): its box checked and a lighter ink than the open row's (border 66, ink 24).
  // `gone`: closing (rows() gave it -1), drawn as it was but no longer a target: no click, hover or box.
  row(t, x, cursor, gone = false) {
    const on = x.key === this.sel;
    const hot = !gone && (on || x.key === this.hot);
    const picked = this.multi.has(x.key);
    const badges = [];
    if (x.kind === "command" && x.source !== "personal") badges.push(tr("badge.command"));
    if (x.model) badges.push(tr("badge.model", { model: x.model }));
    if (x.tools) badges.push(tr("badge.tools"));
    if (x.off) badges.push(tr("badge.off"));
    return h_flex().id(`kts-row-${x.key}`).pl(10).pr(14).py(10).gap(10).items_start().rounded(12).border(1)
      .border_color(cursor === "ring" ? alpha(t.accent, "99") : on ? alpha(t.accent, "66") : t.border)
      .bg(on || cursor === "ring" ? alpha(t.accent, "24") : picked ? alpha(t.accent, "14") : cursor === "mark" ? t.hover : t.background)
      .when(!gone && !on && !cursor && !picked, (el) => el.hover((s) => s.bg(t.hover)))
      .when(!gone, (el) => el.cursor_pointer()
        .on_click((e, cx) => {
          this.cur = x.key;
          if (!this.multi.click(e.modifiers, x.key, this.order())) this.select(x, cx);
          cx.notify();
        })
        .on_hover((h, cx) => {
          const next = h ? x.key : this.hot === x.key ? null : this.hot;
          if (next !== this.hot) { this.hot = next; cx.notify(); }
        }))
      .child(this.check(t, `kts-check-${x.key}`, picked, !gone && (picked || this.multi.size > 0 || x.key === this.hot), () => this.multi.toggle(x.key)).mt(2))
      .child(v_flex().flex_1().min_w(0).gap(3).child(h_flex().h(20).gap(8).items_center()
        .child(h_flex().min_w(0).items_center().font_family(MONO).text_size(13).font_medium()
          .when(x.invocable, (el) => el.child(div().flex_none().text_color(t.dim).child("/")))
          .child(div().min_w(0).truncate().text_color(t.foreground).child(x.name)))
        .children(badges.map((b) => this.tag(t, t.dim, b)))
        .child(div().flex_1())
        .child(this.tag(t, t.muted, tr(`src.${x.source}`)))
        .child(div().w(46).flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(x.harness)))
      .child(div().truncate().text_size(12.5).text_color(x.description ? t.muted : t.dim)
        .child(x.unreadable ? tr("unreadable") : x.description || tr("noDescription")))
      .child(h_flex().h(20).gap(8).items_center()
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(tilde(x.real)))
        .when(hot, (el) => el.child(h_flex().flex_none().gap(2)
          .child(this.icon(t, `kts-see-${x.key}`, OWN("eye"), tr("preview"), (cx) => this.select(x, cx)))
          .child(this.icon(t, `kts-copy-${x.key}`, OWN("copy"), x.invocable ? tr("copySlash", { name: x.name }) : tr("copyName"), (cx) => this.copy(x, cx)))
          .child(this.icon(t, `kts-open-${x.key}`, I("external-link"), tr("openZed"), () => this.zed([x.real])))))));
  }

  // A group's "Fragments et templates · N", folded by default; a click unfolds it.
  foldRow(t, e, cursor, gone = false) {
    return h_flex().id(`kts-fold-${e.glabel}`).h(36).px(14).gap(8).items_center().rounded(12).border(1).border_dashed()
      .border_color(cursor === "ring" ? alpha(t.accent, "99") : t.border).text_size(12.5).text_color(cursor === "ring" ? t.foreground : t.muted)
      .when(cursor === "ring", (el) => el.bg(alpha(t.accent, "24")))
      .when(cursor === "mark", (el) => el.bg(t.hover))
      .when(!gone, (el) => el.cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => {
          this.cur = idOf(e);
          if (this.unfolded.has(e.glabel)) this.unfolded.delete(e.glabel);
          else this.unfolded.add(e.glabel);
          cx.notify();
        }))
      .child(svg(I(e.open ? "chevron-down" : "chevron-right")).size(13).flex_none())
      .child(tr("fragments", { n: e.fold }));
  }

  list(t, shown, cx) {
    const card = this.card(t).flex_1().min_w(0).h_full();
    // Before the first scan: cards in the shape of the skills' rows (skeleton.js), breathing; then the
    // list fades in over them, its rows at rest (still(): no opening from 0 under the fade).
    const S = skeleton(t, this.m);
    if (!this.scanned && !this.error) return card.child(S.swap("kts-list", false, null, () => v_flex().p(4).gap(4)
      .children([0, 1, 2, 3, 4, 5].map((k) => S.block(null, 84).child(S.row({ h: 82, icon: 14, lines: [0.35, 0.8], k }))))));
    if (!shown.length) {
      const text = this.error ?? (!this.scanned || this.busy ? tr("analysingSkills") : this.items.length ? tr("noMatch") : tr("none"));
      return card.child(this.empty(t, text, this.error ? t.ansi1 : t.dim));
    }
    const per = {};
    for (const x of shown) per[x.glabel] = (per[x.glabel] ?? 0) + 1;
    const entries = this.entries(shown);
    // A row to show (props.select, the keys' cursor): its page here, scrolled to below.
    if (this.reveal) {
      const at = entries.findIndex((e) => idOf(e) === this.reveal);
      if (at >= 0) this.page = Math.floor(at / PAGE);
      else this.reveal = null; // folded away: open the detail only
    }
    const pages = Math.ceil(entries.length / PAGE);
    const page = Math.min(this.page, pages - 1);
    const from = page * PAGE;
    const slice = entries.slice(from, from + PAGE);
    // The keys' cursor, while the page has the keyboard.
    const typing = this.keyed && this.vim.insert;
    const onCur = this.keyed ? this.at(entries) : null;
    const cur = onCur ? idOf(onCur) : null;
    // One rows() per section of the page (motion.js): a filter or a fold closes and opens its rows on
    // their height, in order. The page is in the id: another page replaces this one at once and its
    // rows open. `at` counts the rows as rows() builds them, the closing ones included: they are the
    // list's direct children, which scroll_to_item reveals.
    const rowsAt = (mm) => {
      const rows = [];
      for (const g of [...new Set(slice.map((e) => e.glabel))]) {
        rows.push(this.groupRow(t, g, per[g], rows.length === 0));
        let at = rows.length;
        rows.push(...rowsOf(mm, cx, `kts-rows-${page}-${g}`, slice.filter((e) => e.glabel === g), idOf, (e, i) => {
          if (i >= 0 && idOf(e) === this.reveal) { this.scroll.scroll_to_item(at); this.reveal = null; }
          at++;
          const c = i >= 0 && idOf(e) === cur ? (typing ? "mark" : "ring") : null;
          return e.x ? this.row(t, e.x, c, i < 0) : this.foldRow(t, e, c, i < 0);
        }));
      }
      return rows;
    };
    const go = (p) => (_e, cx) => { this.page = p; this.cur = null; this.scroll.scroll_to_item(0); cx.notify(); };
    // The pager sits 4 px inside the card (16): its buttons are 12.
    const step = (id, label, to, ok) => h_flex().id(id).h(30).px(11).items_center().rounded(12).border(1).border_color(t.border)
      .text_size(12).text_color(ok ? t.muted : t.dim)
      .when(ok, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(go(to)))
      .when(!ok, (el) => el.opacity(0.5))
      .child(label);
    const bar = this.bulk(t);
    // The bulk bar floats over the rows' foot: room under the last row so it never hides it.
    return card
      .child(S.swap("kts-list", true, (first) => v_flex().flex_1().min_h(0).relative()
        .child(v_flex().id("kts-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).p(4).gap(4)
          .when(Boolean(bar), (el) => el.pb(64)).children(rowsAt(first ? still(this.m) : this.m)))
        .when(Boolean(bar), (el) => el.child(bar)), null, { grow: true }))
      .when(pages > 1, (el) => el.child(this.dashed(t)).child(h_flex().flex_none().p(4).gap(4).items_center()
        .child(this.eyebrow(t, tr("paging", { from: from + 1, to: from + slice.length, n: entries.length })).px(10).flex_1())
        .child(step("kts-prev", tr("prev"), page - 1, page > 0))
        .child(step("kts-next", tr("next"), page + 1, page < pages - 1))));
  }

  // ---------- detail ----------

  detail(t, x, w, cx) {
    const meta = Object.entries(x.meta).filter(([k]) => k !== "description");
    const pair = (k, v) => h_flex().gap(10).items_start()
      .child(this.eyebrow(t, k).w(150).flex_none().pt(1))
      .child(div().flex_1().min_w(0).font_family(MONO).text_size(12).text_color(t.foreground).child(v || "—"));
    const path = (label, p) => h_flex().gap(8).items_center()
      .child(this.eyebrow(t, label, t.dim).w(64).flex_none())
      .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.muted).child(tilde(p)));
    // The viewer's file: SKILL.md, or one of its links (then "SKILL.md › that file", back on a click).
    const d = this.doc?.key === x.key ? this.doc : null;
    const sub = d && d.path !== x.path ? d.path : null;
    const file = sub ?? x.real;
    const crumb = h_flex().flex_none().px(14).pt(12).pb(6).gap(6).items_center()
      .child(sub
        ? div().id("kts-doc-back").font_family(MONO).text_size(11).text_color(t.accent).cursor_pointer().hover((s) => s.text_color(t.foreground))
          .on_click((_e, cx) => { this.loadDoc(x, x.path, cx); cx.notify(); }).child(x.path.split("/").pop().toUpperCase())
        : this.eyebrow(t, x.real.split("/").pop()))
      .when(Boolean(sub), (el) => el.child(this.eyebrow(t, "›", t.dim))
        .child(this.eyebrow(t, sub?.startsWith(dirOf(x.path) + "/") ? sub.slice(dirOf(x.path).length + 1) : tilde(sub ?? ""), t.foreground).min_w(0).truncate()))
      .child(div().flex_1())
      .when(Boolean(d?.md) && d?.note !== "unreadableMd", (el) => el.child(tabs(t, "kts-md-tabs", this.md)));
    // The card (16): DESIGN-REFERENCE.md's band on the page's dither (its width is known: w), the
    // actions as icon buttons with their key; it fades in and rises when a skill opens (motion.js).
    const card = this.card(t).w(w).flex_none().h_full().relative().px(4).pb(4).overflow_hidden()
      .children([dither(w, 60, 16, t.ansi4)].filter(Boolean))
      .child(bandRow(t, { m: this.m, color: t.ansi4, icon: I("sparkles"), title: x.invocable ? `/${x.name}` : x.name,
        sub: [gtext(x.glabel), x.version, x.harness],
        buttons: [
          iconBtn(t, "kts-d-copy", OWN("copy"), x.invocable ? tr("copySlashY", { name: x.name }) : tr("copyNameY"), (cx) => this.copy(x, cx)),
          iconBtn(t, "kts-d-zed", I("external-link"), tr("openZedO"), () => this.zed([file])),
          iconBtn(t, "kts-d-finder", I("folder"), tr("revealFinder"), () => exec("open", ["-R", file]).catch(() => {})),
          iconBtn(t, "kts-close", I("x"), tr("close"), () => { this.sel = null; this.doc = null; })] }))
      .child(div().flex_none().mx(-4).h(0).border_t(1).border_dashed().border_color(alpha(t.ansi4, "4d")))
      .child(v_flex().flex_none().px(10).py(8).gap(2)
        .child(path(tr("path.file"), x.real))
        .when(x.path !== x.real, (el) => el.child(path("Via", x.path))))
      .child(this.dashed(t))
      // Everything below scrolls as one: the description and frontmatter card, then the file.
      .child(v_flex().id("kts-doc").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.docScroll)
        .child(v_flex().flex_none().px(14).py(12).gap(12)
          .child(div().text_size(13).line_height("19px").text_color(x.description ? t.foreground : t.dim).child(x.description || tr("noDescription")))
          .when(meta.length > 0, (el) => el.child(v_flex().gap(6).children(meta.map(([k, v]) => pair(k, fmt(v)))))))
        .child(this.dashed(t))
        .child(crumb)
        .child(this.body(t, x, d, cx)));
    return enter(this.m, card, `kts-detail-${x.key}`);
  }

  // The file, by markdown.js: Aperçu in a ~80-character column with airy lines, Brut as wide as the
  // card (it soft-wraps; Kylian, 2026-11-18: « attention à la droite, c'est pas dynamique »).
  // While it is read: two paragraphs and a code block as bars (skeleton.js), in the same column, then
  // the file fades in over them. Unreadable, or empty in Aperçu: said in the column.
  body(t, x, d, cx) {
    const S = skeleton(t, this.m);
    const para = (n) => v_flex().children(Array.from({ length: n }, (_, i) => S.line(i === n - 1 ? 0.55 : 0.95, { h: 9, lh: 22 })));
    const col = () => v_flex().flex_none().px(18).pt(2).pb(28).gap(14).when(!this.md.raw, (el) => el.max_w(MEASURE)).when(this.md.raw, (el) => el.w_full());
    return S.swap(`kts-body-${d?.path}`, Boolean(d?.md), () => col().text_size(13.5).line_height("22px").text_color(t.foreground)
      .child(d.note === "unreadableMd" || (d.note && !this.md.raw) ? div().text_color(t.dim).child(tr(d.note))
        : view(t, this.m, cx, this.md, { id: `kts-md-${d.path}`, mod: "kt-skills", doc: d.md,
          onLink: (url, cx) => { this.link(x, url, cx); cx.notify(); },
          // Another page of Brut: back to its top, the crumb (the doc scroll's 3rd child).
          onPage: () => this.docScroll.scroll_to_item(2) })),
    () => col().child(para(3)).child(S.block(null, 72, { r: 10 })).child(para(2)));
  }

  render(cx) {
    if (props()?.add) return this.role ? this.role.render(cx) : div();
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const vis = visible();
    if (!checking()) {
      // The bus (DATA-SYNC.md): an add here or in kt-plugins rescans, shown or not.
      refreshOn(this, cx, "data", ["skills", "plugins"], async (cx) => this.scan(cx));
      // Outside Herdr: the skill and command folders, watched while the page shows.
      if (vis && !this.watches.length) for (const dir of [`${home()}/.claude/skills`, `${home()}/.claude/commands`]) {
        cx.spawn(async (cx) => {
          for (;;) {
            const w = watchFolder(dir);
            this.watches.push(w);
            let paths;
            try { paths = await w; } catch { return; }
            this.watches = this.watches.filter((x) => x !== w);
            if (!paths.length) return; // cancelled
            // A hidden page doesn't render: stop here rather than rescan while nobody looks.
            if (!visible()) { for (const x of this.watches) x.cancel(); this.watches = []; return; }
            if (!this.busy) this.scan(cx);
          }
        });
      }
      if (!vis && this.watches.length) { for (const w of this.watches) w.cancel(); this.watches = []; }
    }
    if (vis && !checking()) {
      if (!this.shown) {
        // The thread's terminal is hidden under this page: take the keyboard (typing filters),
        // after the app has settled its own focus on the switch.
        // INSERT then, unless pane.go or a key command already gave it the keyboard (NORMAL).
        cx.timer.after(150, (cx) => {
          if (visible() && !this.handle.is_focused()) {
            this.handle.focus();
            this.vim.edit();
          }
          cx.notify();
        });
        // Back on the page: read again when the last read is more than 10 s old (DATA-SYNC.md).
        if (Date.now() - this.scannedAt > 10e3) this.scan(cx);
      } else if (!this.busy && (activeSpace()?.id ?? null) !== this.space) this.scan(cx);
    }
    if (!vis && this.shown && this.handle.is_focused() && !checking()) {
      // Back to the thread: the keyboard goes back to its terminal.
      const tab = activeSpace()?.tabs.find((c) => c.active)?.id;
      const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
      if (pane) cx.spawn(async () => run("pane.focus", { pane }));
    }
    this.shown = vis;
    this.keyed = this.handle.is_focused();
    const t = theme();
    const x = this.items.find((i) => i.key === this.sel);
    const q = this.queried();
    const shown = q.filter((i) => this.matches(i, this.seg));
    // No frame of its own as a page: the layout's center column (chrome, radius 20, padding 4)
    // holds it. As a frameless dialog (frame: "none") it draws that same frame.
    return v_flex().id("kts-root").size_full().gap(4).text_color(t.foreground)
      .when(Boolean(props()?.overlay), (el) => el.p(4).rounded(20).border(1).border_color(t.border).bg(t.chrome))
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
      .child(this.header(t, q, shown.length))
      .child(h_flex().flex_1().min_h(0).gap(4)
        .child(this.list(t, shown, cx))
        .when(Boolean(x), (el) => el.child(this.detail(t, x, Math.round(this.width * 0.45), cx))))
      // The head's ⋯, last so that it draws over the list.
      .when(this.more, (el) => el.relative().child(moreMenu(t, "kts-more", props()?.overlay ? 60 : 56, this.moreItems(), () => { this.more = false; })));
  }
}
