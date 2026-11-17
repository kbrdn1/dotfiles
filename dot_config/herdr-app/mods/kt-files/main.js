// kbrdn Threads' Files surface: the shown thread's repo as a tree on the
// right (changed files tinted, M / U), the open file on the left as a code
// view with highlighting. Type in "Search files" to filter by path. Lists
// what git knows (tracked and new, not ignored); outside git, what `rg
// --files` finds. Read-only: the agent edits, you read. Polls only while the
// right panel shows Files.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState } from "gpui-base";
import { spaces, panes, exec, readTextFile, settings, theme, layout } from "herdr";

const ME = "files"; // this block's id in the layout's "panel-body" stack
const I = (name) => `mods/kt-threads/${name}.svg`;
const MAX_FILES = 5000;
const MAX_BYTES = 400e3;
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
    this.typing = false;
    this.shown = false;
    this.handle = cx.focus_handle();
    this.refresh(cx);
    cx.timer.every(5000, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    if (!visible()) return;
    const cwd = folder(), on = machine(), key = location();
    if (!cwd || this.busy) return;
    this.busy = true;
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
        const list = top.code === 0 ? await exec("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, on }) : await exec("rg", ["--files"], { cwd: root, on });
        if (location() !== key) return;
        this.paths = [...new Set(list.stdout.split("\n").filter(Boolean))].sort().slice(0, MAX_FILES);
        this.marks = {};
        if (top.code === 0) {
          const st = await exec("git", ["status", "--porcelain"], { cwd: root, on });
          for (const l of st.stdout.split("\n").filter(Boolean)) this.marks[l.slice(3)] = l.startsWith("??") ? "U" : "M";
        }
      } catch { this.paths = []; this.marks = {}; }
      finally { this.busy = false; cx.notify(); }
    });
  }

  show(path, cx) {
    this.code?.release();
    this.code = null;
    this.file = path;
    if (!path || !cx) return;
    const root = this.root, on = this.on;
    cx.spawn(async (cx) => {
      const text = (await readTextFile(`${root}/${path}`, { on }).catch(() => null)) ?? "(can't read this file)";
      if (this.file !== path || root !== this.root || on !== this.on) return;
      const t = theme();
      this.code = EditorState.new({
        language: ((ext) => LANG[ext] ?? ext)(path.includes(".") ? path.split(".").pop() : "txt"),
        value: text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) + "\n… (cut)" : text,
        readonly: true,
        font_family: settings().font_family,
        font_size: 12,
        syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 },
      });
      cx.notify();
    });
  }

  fileRow(t, path, name, depth) {
    const m = this.marks[path];
    const on = this.file === path;
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
      .border_color(on ? t.accent + "66" : t.accent + "00")
      .text_size(12)
      .cursor_pointer()
      .text_color(m === "U" ? t.ansi2 : m === "M" ? t.ansi3 : t.muted)
      .when(on, (el) => el.bg(t.accent + "24").text_color(t.foreground))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .on_click((_e, cx) => this.show(path, cx))
      .child(svg(I("file")).size(13).flex_none())
      .child(div().flex_1().truncate().child(name))
      .when(Boolean(m), (el) => el.child(div().font_family("Monaspace Krypton").text_size(10.5).child(m)));
  }

  rows(t, node, prefix, depth, out) {
    for (const [name, child] of [...node.dirs].sort((a, b) => a[0].localeCompare(b[0]))) {
      const path = prefix + name;
      const open = this.open.has(path);
      out.push(
        h_flex()
          .id(`td-${path}`)
          .h(24)
          .pl(10 + depth * 14)
          .gap(6)
          .items_center()
          .rounded(10)
          .text_size(12)
          .text_color(t.foreground)
          .cursor_pointer()
          .hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => {
            if (open) this.open.delete(path);
            else this.open.add(path);
            cx.notify();
          })
          .child(svg(I(open ? "chevron-down" : "chevron-right")).size(13).text_color(t.dim))
          .child(div().truncate().child(name)),
      );
      if (open) this.rows(t, child, path + "/", depth + 1, out);
    }
    for (const name of node.files) out.push(this.fileRow(t, prefix + name, name, depth));
    return out;
  }

  render(cx) {
    // Coming into view (or still without a folder): look now, not at the next tick.
    const vis = visible();
    if (vis && (!this.shown || !this.root)) this.refresh(cx);
    this.shown = vis;
    const t = theme();
    const q = this.query.toLowerCase();
    const list = q
      ? this.paths
          .filter((p) => p.toLowerCase().includes(q))
          .slice(0, 300)
          .map((p) => this.fileRow(t, p, p, 0))
      : this.rows(t, tree(this.paths), "", 0, []);
    const side = v_flex()
      .h_full()
      .when(Boolean(this.file), (el) => el.w(240).flex_none().border_l(1).border_color(t.border))
      .when(!this.file, (el) => el.flex_1())
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
          .border_color(this.typing ? t.accent : t.border)
          .bg(t.background)
          .text_size(12)
          .cursor_text()
          .on_click((_e, cx) => {
            this.typing = true;
            this.handle.focus();
            cx.notify();
          })
          .child(svg(I("search")).size(13).text_color(t.dim))
          .child(
            this.query
              ? div().flex_1().truncate().text_color(t.foreground).child(this.query + (this.typing ? "▏" : ""))
              : div().flex_1().text_color(t.dim).child((this.typing ? "▏" : "") + "Search files"),
          ),
      )
      .child(
        v_flex()
          .id("tf-list")
          .flex_1()
          .min_h(0)
          .px(4)
          .pb(8)
          .overflow_y_scrollbar()
          .children(list)
          .when(this.paths.length === 0, (el) => el.child(div().p(12).text_size(12).text_color(t.dim).child(this.root ? "No files." : "No folder."))),
      );
    return h_flex()
      .id("kt-files")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (!this.typing) return;
        const m = e.modifiers;
        if (e.key === "escape") {
          this.typing = false;
          this.query = "";
        } else if (e.key === "backspace") this.query = this.query.slice(0, -1);
        else if (e.key === "enter") {
          const first = this.paths.find((p) => p.toLowerCase().includes(this.query.toLowerCase()));
          if (first) this.show(first, cx);
        } else if (e.key_char && !m.control && !m.platform) this.query += e.key_char;
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .size_full()
      .bg(t.chrome)
      .text_color(t.foreground)
      .when(Boolean(this.file), (el) =>
        el.child(
          v_flex()
            .h_full()
            .flex_1()
            .min_w(0)
            .child(
              h_flex()
                .h(36)
                .px(12)
                .gap(4)
                .items_center()
                .border_b(1)
                .border_color(t.border)
                .font_family("Monaspace Krypton")
                .text_size(11)
                .text_color(t.muted)
                .child(div().flex_1().truncate().child(this.file.split("/").join("  ›  ")))
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
            .child(this.code ? Editor.new(this.code).flex_1().min_h(0) : div().flex_1()),
        ),
      )
      .child(side);
  }
}
