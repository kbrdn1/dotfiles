// kbrdn Threads' diff panel: what changed in the shown tab's folder since
// the last commit (staged, unstaged and new files). The top says the totals;
// each file says how much changed; click one to read its diff, colored.
// Refreshes every few seconds, only while the right panel shows Diff (the
// header's panel toggle shows it).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, focused, settings, readTextFile, theme, layout } from "herdr";

const ME = "diff"; // this block's id in the layout's "panel-body" stack
const MONO = "Monaspace Krypton";
const MAX_LINES = 1500;

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

export default class Diff extends View {
  init(_props, cx) {
    this.files = [];
    this.open = null;
    this.lines = [];
    this.error = null;
    this.busy = false;
    this.shown = false;
    this.refresh(cx);
    cx.timer.every(3000, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    if (!visible()) return;
    const f = focused();
    const cwd = f?.cwd;
    const on = f?.terminal?.includes("/") ? f.terminal.split("/")[0] : undefined;
    if (!cwd || this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        if (cwd !== this.cwd || on !== this.on) {
          this.cwd = cwd;
          this.on = on;
          this.open = null;
          this.lines = [];
        }
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
        if (top.code !== 0) {
          this.files = [];
          this.error = "not a git folder";
          return;
        }
        this.root = top.stdout.trim();
        const stat = await exec("git", ["diff", "HEAD", "--numstat"], { cwd: this.root, on: this.on });
        const files = stat.stdout
          .split("\n")
          .filter(Boolean)
          .map((l) => {
            const [a, d, ...p] = l.split("\t");
            return { path: p.join("\t"), add: a === "-" ? 0 : +a, del: d === "-" ? 0 : +d, binary: a === "-" };
          });
        const fresh = await exec("git", ["ls-files", "--others", "--exclude-standard"], { cwd: this.root, on: this.on });
        for (const path of fresh.stdout.split("\n").filter(Boolean)) files.push({ path, add: 0, del: 0, fresh: true });
        this.files = files;
        this.error = null;
        if (this.open) await this.load(this.open);
      } catch (error) { this.files = []; this.error = String(error); }
      finally {
        this.busy = false;
        cx.notify();
      }
    });
  }

  async load(path) {
    const f = this.files.find((x) => x.path === path);
    if (!f) {
      this.open = null;
      this.lines = [];
      return;
    }
    // A new file is all added: read it here (no /dev/null on Windows).
    if (f.fresh) {
      const text = (await readTextFile(`${this.root}/${path}`, { on: this.on })) ?? "";
      const body = text.replace(/\n$/, "").split("\n");
      this.lines = [`@@ new file, ${body.length} lines @@`, ...body.map((l) => `+${l}`)].slice(0, MAX_LINES);
      return;
    }
    const r = await exec("git", ["diff", "HEAD", "--", path], { cwd: this.root, on: this.on });
    // Skip the header down to the first hunk.
    const all = r.stdout.split("\n");
    const start = all.findIndex((l) => l.startsWith("@@"));
    this.lines = (start < 0 ? [] : all.slice(start)).slice(0, MAX_LINES);
  }

  pick(path, cx) {
    this.open = this.open === path ? null : path;
    cx.spawn(async (cx) => {
      if (this.open) await this.load(this.open);
      else this.lines = [];
      cx.notify();
    });
  }

  line(t, l, i) {
    const k = l[0];
    const color = k === "+" ? t.ansi2 : k === "-" ? t.ansi1 : k === "@" ? t.accent : t.muted;
    return div()
      .px(12)
      .min_h(18)
      .when(k === "+", (el) => el.bg(t.ansi2 + "1f"))
      .when(k === "-", (el) => el.bg(t.ansi1 + "1f"))
      .when(k === "@", (el) => el.mt(i ? 6 : 0))
      .text_color(color)
      .child(l || " ");
  }

  render(cx) {
    // Coming into view: look now, not at the next tick.
    const vis = visible();
    if (vis && !this.shown) this.refresh(cx);
    this.shown = vis;
    const t = theme();
    const add = this.files.reduce((n, f) => n + f.add, 0);
    const del = this.files.reduce((n, f) => n + f.del, 0);
    const name = (p) => p.split("/").pop();
    const dir = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");
    const count = (color, text) => div().font_family(MONO).text_size(11).text_color(color).child(text);
    return v_flex()
      .size_full()
      .bg(t.chrome)
      .text_color(t.foreground)
      .child(
        h_flex()
          .h(36)
          .flex_none()
          .px(16)
          .gap(10)
          .items_center()
          .border_b(1)
          .border_color(t.border)
          // kbrdn.dev `.eyebrow`.
          .child(div().flex_1().font_family(MONO).text_size(11).text_color(t.muted).truncate().child(this.root ? `CHANGES IN ${this.root.split("/").pop().toUpperCase()}` : ""))
          .when(this.files.length > 0, (el) =>
            el
              .when(add > 0, (el) => el.child(count(t.ansi2, `+${add}`)))
              .when(del > 0, (el) => el.child(count(t.ansi1, `−${del}`))),
          ),
      )
      .when(Boolean(this.error), (el) => el.child(div().p(16).text_size(13).text_color(t.dim).child(this.error)))
      .when(!this.error && this.files.length === 0, (el) => el.child(div().p(16).text_size(13).text_color(t.dim).child("No changes since the last commit.")))
      .child(
        v_flex()
          .id("kt-diff-list")
          .flex_1()
          .min_h(0)
          .overflow_y_scrollbar()
          .py(6)
          .children(
            this.files.flatMap((f) => {
              const on = f.path === this.open;
              const row = h_flex()
                .id(`df-${f.path}`)
                .mx(6)
                .px(10)
                .h(28)
                .gap(8)
                .items_center()
                .rounded(10)
                // kbrdn.dev SegmentInk on the open file (transparent border elsewhere: no shift).
                .border(1)
                .border_color(on ? t.accent + "66" : t.accent + "00")
                .text_size(13)
                .cursor_pointer()
                .when(on, (el) => el.bg(t.accent + "24"))
                .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
                .on_click((_e, cx) => this.pick(f.path, cx))
                .child(svg(`mods/kt-threads/${on ? "chevron-down" : "chevron-right"}.svg`).size(13).text_color(t.dim))
                .child(
                  h_flex()
                    .flex_1()
                    .min_w(0)
                    .child(div().truncate().text_color(t.dim).child(dir(f.path)))
                    .child(div().flex_none().text_color(t.foreground).child(name(f.path))),
                )
                .when(Boolean(f.fresh), (el) => el.child(count(t.ansi2, "NEW")))
                .when(Boolean(f.binary), (el) => el.child(count(t.dim, "BINARY")))
                .when(f.add > 0, (el) => el.child(count(t.ansi2, `+${f.add}`)))
                .when(f.del > 0, (el) => el.child(count(t.ansi1, `−${f.del}`)));
              if (!on) return [row];
              const body = v_flex()
                .mx(6)
                .my(4)
                .py(6)
                .rounded(10)
                .border(1)
                .border_color(t.border)
                .bg(t.background)
                .font_family(settings().font_family ?? "JetBrains Mono")
                .text_size(12)
                .children(this.lines.map((l, i) => this.line(t, l, i)))
                .when(this.lines.length >= MAX_LINES, (el) => el.child(div().px(12).pt(6).text_color(t.dim).child("… more lines not shown")));
              return [row, body];
            }),
          ),
      );
  }
}
