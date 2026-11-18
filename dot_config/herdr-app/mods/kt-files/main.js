// kbrdn Threads' Files surface: the shown thread's repo as a tree on the
// right (changed files tinted, M / U), the open file on the left as a code
// view with highlighting. Type in "Search files" to filter by path. Lists
// what git knows (tracked and new, not ignored); outside git, what `rg
// --files` finds. Read-only: the agent edits, you read. Polls only while the
// right panel shows Files.
// Keys (vim.js; kt-keys lists them, group "panel"): ctrl-b l (pane.go, "focus") or
// `kt-files.key:<keys>` gives the tree the keyboard: a cursor (an accent ring on the ink) on a
// row, or on Search files. j k gg G ctrl-d ctrl-u move; k past the first row, or /, goes to
// Search files and types there (INSERT: ctrl-n / ctrl-p move, enter opens, esc back to NORMAL,
// the filter stays); h folds the folder (on a file or a folded one: folds its parent and goes
// there); l unfolds a folder or opens a file; enter / o as a click; O opens in Zed; y copies the
// path; r reads again; n N next / previous match; esc clears the filter, else gives the keyboard
// back to the terminal; [ ] the panel's previous / next tab; ? the keys.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState, ScrollHandle, Scrollbar } from "gpui-base";
import { spaces, panes, exec, readTextFile, settings, theme, layout, home, appHome, checking, run, nextCommand, notify, openOverlay, shared } from "herdr";
import { ICON_MAP, catIcon } from "./icons.js";
import { Vim, keysOf, step } from "./vim.js";
import { motionState, frame, enter } from "./motion.js";
import { skeleton, readyFor } from "./skeleton.js";
import { gitTopics, refreshOn } from "./bus.js";
import { shouldRead } from "./reread.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);

const ME = "files"; // this block's id in the layout's "panel-body" stack
const I = (name) => `mods/kt-threads/${name}.svg`;
const MONO = "Monaspace Krypton";
const MAX_FILES = 5000;
const MAX_BYTES = 400e3;
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
// The panel's tabs in order, and each one's mod: [ / ] show the next one and give it the keyboard.
const TABS = ["files", "diff", "history", "flow", "crosstalk", "gwm-panel"];
const TAB_MODS = { files: "kt-files", diff: "kt-diff", history: "kt-history", flow: "kt-flow", crosstalk: "kt-crosstalk", "gwm-panel": "kt-gwm" };
// The keyboard follows a moment later: a `<mod>.focus` sent at once reaches no copy (the new tab
// isn't shown yet) and the app gives the keyboard back to the terminal.
function panelTab(dir, cx) {
  const child = TABS[(TABS.indexOf(ME) + dir + TABS.length) % TABS.length];
  run("layout.select", { stack: "panel-body", child });
  // gwm-panel: kt-gwm's panel copy only (its page copy may show too).
  cx.timer.after(120, () => run(child === "gwm-panel" ? "kt-gwm.panel-focus" : `${TAB_MODS[child]}.focus`));
}
// NORMAL / INSERT, kt-keys' pill: INSERT on the ink, NORMAL plain.
const modePill = (t, vim) => div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
  .border_color(vim.insert ? alpha(t.accent, "66") : t.border).bg(vim.insert ? alpha(t.accent, "24") : t.background)
  .font_family(MONO).text_size(9).text_color(vim.insert ? t.accent : t.muted).child(vim.label);
// File endings the highlighter doesn't know, read as one it does.
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
// Shown: the "panel" column isn't hidden and its stack shows this block.
function visible() {
  const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
  return Boolean(panel && !panel.hidden && body && (body.active ?? body.children?.[0]?.id) === ME);
}

function folder() {
  const p = spaces().find((x) => x.active);
  const c = p?.tabs.find((x) => x.active);
  const mine = panes().filter((x) => x.tab === c?.id && x.terminal);
  const lead = mine.find((x) => x.program?.agent) ?? mine[0];
  return lead?.cwd ?? p?.folder ?? null;
}
const machine = () => spaces().find((s) => s.active)?.machine;
const location = () => JSON.stringify([machine() ?? null, folder()]);

// Paths into a tree: { dirs: Map(name -> node), files: [name] }.
function tree(paths) {
  const root = { dirs: new Map(), files: [] };
  for (const p of paths) {
    const parts = p.split("/");
    let n = root;
    for (const d of parts.slice(0, -1)) {
      if (!n.dirs.has(d)) n.dirs.set(d, { dirs: new Map(), files: [] });
      n = n.dirs.get(d);
    }
    n.files.push(parts[parts.length - 1]);
  }
  return root;
}

export default class Files extends View {
  init(_props, cx) {
    this.root = null;
    this.paths = [];
    this.marks = {}; // path -> "M" | "U"
    this.open = new Set();
    this.file = null;
    this.code = null;
    this.query = "";
    this.shown = false;
    this.motion = motionState(); // ANIMATIONS.md: the tab and an opened file fade in
    this.showGen = 0;
    this.handle = cx.focus_handle();
    // Search files is the field: typing in it is vim's INSERT mode.
    this.vim = new Vim({ field: true });
    this.cur = null; // the keys' cursor: "search", "d:<folder>" or "f:<file>"
    this.flat = []; // what it walks, in order: Search files, then the rows shown { id, path, dir, parent }
    this.listScroll = ScrollHandle.new();
    this.map = null; // Catppuccin's map.json
    if (!checking()) {
      cx.spawn(async (cx) => {
        try { this.map = JSON.parse(await readTextFile(`${appHome()}/${ICON_MAP}`)); } catch { this.map = null; }
        cx.notify();
      });
      // `focus` (pane.go) takes the keyboard; `key:<keys>` takes it and types those keys, for tests.
      cx.spawn(async (cx) => {
        for (;;) {
          const c = await nextCommand();
          if (c === "focus") this.focusIn();
          else if (c.startsWith("key:")) {
            this.focusIn();
            for (const k of keysOf(c.slice(4))) this.act(this.vim.handle(k), cx);
          }
          cx.notify();
        }
      });
      // The keyboard went away (Herdr doesn't always redraw then): drop the cursor. A hidden copy
      // doesn't render, so this tick notes that the tab went away: shown again, it reads and fades in.
      cx.timer.every(500, (cx) => {
        if (this.shown && !visible()) this.shown = false;
        if (this.keyed !== this.handle.is_focused()) cx.notify();
      });
    }
    this.refresh(cx);
    cx.timer.every(5000, (cx) => this.refresh(cx));
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  // The keyboard comes here: NORMAL, the cursor on the open file, else the first row.
  focusIn() {
    this.handle.focus();
    this.vim.normal();
    if (!this.flat.some((x) => x.id === this.cur) || this.cur === "search")
      this.cur = (this.flat.find((x) => x.path === this.file && !x.dir) ?? this.flat[1] ?? this.flat[0])?.id ?? null;
    this.reveal = true;
  }

  key(e, cx) {
    if (!this.act(this.vim.handle(e), cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One vim action on the tree; false: not one Files has, and the key goes on.
  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count" || a === "normal") return true; // vim keeps the mode
    const flat = this.flat;
    const i = flat.findIndex((x) => x.id === this.cur);
    const x = flat[i]?.field ? null : flat[i]; // a row, not Search files
    // On Search files is typing there (INSERT).
    const to = (id) => { this.cur = id; this.reveal = true; if (id === "search") this.vim.edit(); };
    if (a === "filter") to("search");
    else if (a === "type" || a === "backspace") {
      this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
      this.cur = "search"; // the first match next
    } else if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) {
      let j = step(a, i, flat.length, this.vim.count, 20);
      if (j === 0 && a !== "up" && flat.length > 1) j = 1; // only k climbs into the field
      if (j >= 0) to(flat[j].id);
    } else if (a === "next" || a === "prev") {
      if (!this.query) return false;
      const j = step(a === "next" ? "down" : "up", i, flat.length, this.vim.count);
      if (j > 0) to(flat[j].id);
    } else if (this.cur === "search" && (a === "open" || a === "right")) this.vim.edit();
    else if (a === "left") {
      // An open folder folds; on a file or a folded folder, its parent folds and takes the cursor.
      if (x?.dir && this.open.has(x.path)) this.open.delete(x.path);
      else if (x?.parent) { this.open.delete(x.parent); to(`d:${x.parent}`); }
    } else if (a === "right") {
      if (x?.dir) this.open.add(x.path);
      else if (x) this.show(x.path, cx);
    } else if (a === "submit" && !x) {
      // enter in the field, no cursor yet: the first match, as before.
      const first = this.paths.find((p) => p.toLowerCase().includes(this.query.toLowerCase()));
      if (first) this.show(first, cx);
    } else if (a === "open" || a === "submit") {
      if (x?.dir) { if (this.open.has(x.path)) this.open.delete(x.path); else this.open.add(x.path); }
      else if (x) this.show(x.path, cx);
    } else if (a === "open-alt") {
      if (x && this.root && !this.on) exec("open", [`zed://file${this.root}/${x.path}`]).catch(() => {});
    } else if (a === "yank") {
      const p = x && this.root ? (this.on ? x.path : `${this.root}/${x.path}`) : null;
      if (p) {
        cx.write_to_clipboard(p);
        notify({ title: tr("copied"), body: p, level: "success", timeout: 2000 });
      }
    } else if (a === "refresh") {
      this.plain = null;
      this.refresh(cx);
    } else if (a === "escape") {
      if (this.query) { this.query = ""; this.cur = null; }
      else run("pane.go", { direction: "left" });
    } else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "panel" } });
    else if (a === "panel-prev" || a === "panel-next") panelTab(a === "panel-next" ? 1 : -1, cx);
    else return false;
    return true;
  }

  refresh(cx) {
    // A read already running (maybe for the previous place, which it drops): run once more when it ends.
    if (this.busy) { this.again = true; return; }
    if (!visible()) return;
    const cwd = folder(), on = machine(), key = location();
    if (!cwd) return;
    this.busy = true;
    this.readAt = Date.now(); // DATA-SYNC.md: back on the tab, read again only past 10 s
    cx.spawn(async (cx) => {
      try {
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
        if (location() !== key) return;
        const root = top.code === 0 ? top.stdout.trim() : cwd;
        if (root !== this.root || on !== this.on) {
          this.root = root;
          this.on = on;
          this.open = new Set();
          this.show(null);
        }
        // kbrdn: outside git, list a folder once (no 5 s rg), and never the whole home folder.
        if (top.code !== 0) {
          if (!on && root === home()) {
            this.paths = []; this.marks = {}; this.note = "home"; // i18n: tech (note.<note>, said at render)
            return;
          }
          if (this.plain === key) return;
          this.plain = key;
        } else this.plain = null;
        this.note = null;
        const list = top.code === 0 ? await exec("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, on }) : await exec("rg", ["--files"], { cwd: root, on });
        if (location() !== key) return;
        this.paths = [...new Set(list.stdout.split("\n").filter(Boolean))].sort().slice(0, MAX_FILES);
        this.marks = {};
        if (top.code === 0) {
          const st = await exec("git", ["status", "--porcelain"], { cwd: root, on });
          for (const l of st.stdout.split("\n").filter(Boolean)) this.marks[l.slice(3)] = l.startsWith("??") ? "U" : "M";
        }
      } catch { this.paths = []; this.marks = {}; }
      finally {
        this.busy = false;
        // An answer for this place, even a failed one: no skeleton after it (readyFor). Not when the place
        // moved during the read (it returned without listing): the read again below lists the new one.
        if (location() === key) this.readFor = key;
        cx.notify();
        if (this.again) { this.again = false; this.refresh(cx); }
      }
    });
  }

  show(path, cx) {
    this.code?.release();
    this.code = null;
    this.file = path;
    if (!path || !cx) return;
    const root = this.root, on = this.on;
    cx.spawn(async (cx) => {
      const text = (await readTextFile(`${root}/${path}`, { on }).catch(() => null)) ?? tr("unreadable");
      if (this.file !== path || root !== this.root || on !== this.on) return;
      const t = theme();
      this.code = EditorState.new({
        language: ((ext) => LANG[ext] ?? ext)(path.includes(".") ? path.split(".").pop() : "txt"),
        value: text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) + "\n" + tr("cut") : text,
        readonly: true,
        font_family: settings().font_family,
        font_size: 12,
        syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 },
      });
      cx.notify();
    });
  }

  fileRow(t, path, name, depth, flat, parent) {
    const m = this.marks[path];
    const on = this.file === path;
    const id = `f:${path}`;
    flat.push({ id, path, dir: false, parent });
    // The keys' cursor, while Files has the keyboard: an accent ring on the ink.
    const cursor = this.keyed && this.cur === id;
    return h_flex()
      .id(`tf-${path}`)
      .h(24)
      .pl(10 + depth * 14)
      .pr(10)
      .gap(6)
      .items_center()
      .rounded(10)
      // kbrdn.dev SegmentInk on the open file (transparent border elsewhere: no shift).
      .border(1)
      .border_color(cursor ? alpha(t.accent, "99") : on ? alpha(t.accent, "66") : alpha(t.accent, "00"))
      .text_size(12)
      .cursor_pointer()
      .text_color(m === "U" ? t.ansi2 : m === "M" ? t.ansi3 : t.muted)
      .when(on || cursor, (el) => el.bg(alpha(t.accent, "24")).text_color(t.foreground))
      .when(!on && !cursor, (el) => el.hover((s) => s.bg(t.hover)))
      .on_click((_e, cx) => this.show(path, cx))
      .child(image(catIcon(this.map, path.split("/").pop(), { dark: settings().dark !== false })).size(14).flex_none())
      .child(div().flex_1().truncate().child(name))
      .when(Boolean(m), (el) => el.child(div().font_family("Monaspace Krypton").text_size(10.5).child(m)));
  }

  // The tree's rows into `out`, and what the cursor walks into `flat` (same order, one each).
  rows(t, node, prefix, depth, out, flat) {
    const parent = prefix ? prefix.slice(0, -1) : null;
    for (const [name, child] of [...node.dirs].sort((a, b) => a[0].localeCompare(b[0]))) {
      const path = prefix + name;
      const open = this.open.has(path);
      flat.push({ id: `d:${path}`, path, dir: true, parent });
      const cursor = this.keyed && this.cur === `d:${path}`;
      out.push(
        h_flex()
          .id(`td-${path}`)
          .h(24)
          .pl(10 + depth * 14)
          .gap(6)
          .items_center()
          .rounded(10)
          .border(1)
          .border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00"))
          .when(cursor, (el) => el.bg(alpha(t.accent, "24")))
          .text_size(12)
          .text_color(t.foreground)
          .cursor_pointer()
          .when(!cursor, (el) => el.hover((s) => s.bg(t.hover)))
          .on_click((_e, cx) => {
            if (open) this.open.delete(path);
            else this.open.add(path);
            cx.notify();
          })
          .child(svg(I(open ? "chevron-down" : "chevron-right")).size(13).flex_none().text_color(t.dim))
          .child(image(catIcon(this.map, name, { folder: true, open, dark: settings().dark !== false })).size(14).flex_none())
          .child(div().truncate().child(name)),
      );
      if (open) this.rows(t, child, path + "/", depth + 1, out, flat);
    }
    for (const name of node.files) out.push(this.fileRow(t, prefix + name, name, depth, flat, parent));
    return out;
  }

  render(cx) {
    // Another thread, space or worktree: read now, shown or back from hidden (never the previous checkout
    // until the 5 s tick); back on the tab at the same place, only past 10 s (reread.js); still without a
    // folder: now. this.loc moves only while shown: a hidden copy doesn't render.
    const vis = visible();
    const loc = location();
    const read = !checking() && (shouldRead({ vis, shown: this.shown, loc, lastLoc: this.loc, readAt: this.readAt, now: Date.now() }) || (vis && !this.root));
    if (vis) this.loc = loc;
    if (read) this.refresh(cx);
    if (vis && !this.shown) this.showGen++;
    this.shown = vis;
    // DATA-SYNC.md: the M / U badges follow another mod's action on this repo, or an agent of this space
    // that stopped working.
    const sp = spaces().find((s) => s.active)?.id;
    if (vis) refreshOn(this, cx, "git", [...gitTopics(this.root), ...(sp ? [`agent:${sp}`] : [])], async (cx) => this.refresh(cx));
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const t = theme();
    this.keyed = this.handle.is_focused();
    const typing = this.keyed && this.vim.insert;
    const onField = this.keyed && this.cur === "search"; // ctrl-n moved it to a row: the caret and INSERT say it types
    const q = this.query.toLowerCase();
    // Listed for this place (readyFor): before the first listing, and after a change of thread, space or
    // worktree until its own listing answers, the tree's shape, never the previous place's files nor its
    // open file. ponytail: the place is the thread's folder, so a cd within the same repo shows the
    // skeleton for one read too; key it by the repo's root if that flicker bites.
    // No folder: nothing to read, and nothing of the previous place either (« no folder »).
    const here = Boolean(folder());
    const ready = readyFor(this.readFor, here ? loc : null);
    const paths = ready && here ? this.paths : [];
    const file = ready && here ? this.file : null;
    // Search files first (k climbs into it), then the rows: tf-list's children are flat[1..].
    const flat = [{ id: "search", field: true }];
    const list = q
      ? paths
          .filter((p) => p.toLowerCase().includes(q))
          .slice(0, 300)
          .map((p) => this.fileRow(t, p, p, 0, flat, null))
      : this.rows(t, tree(paths), "", 0, [], flat);
    this.flat = flat;
    if (this.reveal) {
      const at = flat.findIndex((x) => x.id === this.cur);
      if (at > 0) this.listScroll.scroll_to_item(at - 1);
      this.reveal = false;
    }
    const side = v_flex()
      .h_full()
      .when(Boolean(file), (el) => el.w(240).flex_none().border_l(1).border_dashed().border_color(t.border))
      .when(!file, (el) => el.flex_1())
      .min_w(0)
      .child(
        h_flex()
          .id("tf-search")
          .m(8)
          .h(30)
          .px(10)
          .gap(8)
          .items_center()
          .rounded(10)
          .border(1)
          // The cursor on the field, the keyboard here: the ring on the ink.
          .border_color(onField ? alpha(t.accent, "99") : t.border)
          .bg(onField ? alpha(t.accent, "24") : t.background)
          .text_size(12)
          .cursor_text()
          .on_click((_e, cx) => {
            this.cur = "search";
            this.vim.edit();
            this.handle.focus();
            cx.notify();
          })
          .child(svg(I("search")).size(13).text_color(t.dim))
          .child(
            this.query
              ? div().flex_1().truncate().text_color(t.foreground).child(this.query + (typing ? "▏" : ""))
              : div().flex_1().text_color(t.dim).child((typing ? "▏" : "") + tr("search")),
          )
          .when(this.keyed, (el) => el.child(modePill(t, this.vim))),
      )
      // overflow_y_scroll + a Scrollbar of the same id: scroll_to_item does nothing on overflow_y_scrollbar.
      .child(div().relative().flex_1().min_h(0)
        .child(
          v_flex()
            .id("tf-list")
            .size_full()
            .px(4)
            .pb(8)
            .overflow_y_scroll()
            .track_scroll(this.listScroll)
            .children(list)
            // Not listed for this place yet: file rows (24 px) as bars (skeleton.js), breathing, rather than
            // « no files » or the previous place's tree. A later read of the same place keeps what it had
            // (DATA-SYNC.md).
            .when(!ready, (el) => el.child(((S) => S.pulse(S.list(8, { h: 24, icon: 13, lines: [0.45], px: 6, gap: 6 }).id("tf-list-sk")))(skeleton(t, m))))
            .when(ready && paths.length === 0, (el) => el.child(div().p(12).text_size(12).text_color(t.dim).child(!here ? tr("noFolder") : this.note ? tr(`note.${this.note}`) : this.root ? tr("noFiles") : tr("noFolder")))),
        )
        .child(Scrollbar.vertical("tf-list").absolute().inset_0()));
    // The content fades in each time the tab is shown (the root keeps the keyboard), an opened file too.
    return h_flex()
      .id("kt-files")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .size_full()
      .text_color(t.foreground)
      .child(enter(m, h_flex().size_full(), `tf-in-${this.showGen}`, { dy: 0 })
      .when(Boolean(file), (el) =>
        el.child(
          enter(m, v_flex()
            .h_full()
            .flex_1()
            .min_w(0), `tf-view-${file}`, { dy: 0 })
            .child(
              h_flex()
                .h(36)
                .px(12)
                .gap(4)
                .items_center()
                .font_family("Monaspace Krypton")
                .text_size(11)
                .text_color(t.muted)
                .child(div().flex_1().truncate().child(file.split("/").join("  ›  ")))
                .child(
                  div()
                    .id("tf-close")
                    .p(4)
                    .rounded(6)
                    .cursor_pointer()
                    .hover((s) => s.bg(t.hover).text_color(t.foreground))
                    .on_click((_e, cx) => {
                      this.show(null);
                      cx.notify();
                    })
                    .child(svg(I("x")).size(13)),
                ),
            )
            // While the file is read (show() drops the previous one's code at once): code lines as bars
            // (skeleton.js), breathing; the code fades in over them.
            .child(this.code
              ? enter(m, v_flex().flex_1().min_h(0), `tf-code-${file}`, { dy: 0 }).child(Editor.new(this.code).flex_1().min_h(0))
              : ((S) => S.pulse(v_flex().id("tf-code-sk").flex_1().min_h(0).px(12).overflow_hidden()
                .children([0.42, 0.7, 0.55, 0.8, 0.35, 0.62, 0.48, 0.74, 0.3, 0.58].map((w) => S.line(w, { h: 7, lh: 18 })))))(skeleton(t, m))),
        ),
      )
      .child(side));
  }
}
