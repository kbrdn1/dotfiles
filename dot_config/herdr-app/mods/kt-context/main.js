// kbrdn Threads' Context (#91, the "context" child of the right panel's stack): what the followed Claude Code
// session holds in its context window, read without touching it (no /context, no message, no hook).
// - On top, the gauge: the context's share of the window (ring.js, the composer's ring), the tokens, the
//   model and effort, and how old the reading is. From ~/.claude/cache/statusline/herdr-<terminal>.json,
//   written by the status line at each refresh: exact. A compaction since its last call makes it stale
//   (its ctx_pct reads 0): then the compaction's « after » (model.js current()), said on screen.
// - The breakdown by category, said ESTIMATED on screen: the last request's shape (its system prompt
//   blocks, the built-in tools' and the MCP tools' schemas, by server), measured in characters at about
//   4 a token; the messages the rest of the real total. Without a shape in the transcript (an older
//   session, another version): a line that says so, never a guess. Memory files and skills aren't split
//   out: they come in as messages, and only /context tells them apart.
// - The context over the calls (viz.js area chart), exact from each call's usage, and the compactions
//   (auto or manual, before and after) as lines under it.
// The transcript (soon past readTextFile's 1 MiB) goes through ctx-index.ts (Bun, by exec), from the byte
// offset read last: only when the status line changed (a call answered), only while Context shows.
// Follows the focused terminal, else the shown tab's agent (as Flow). Local terminals only.
// Keys (vim.js; kt-keys lists them, group "panel"): `kt-context.focus` (pane.go) or
// `kt-context.key:<keys>` gives Context the keyboard: r reads the whole transcript again; [ ] the
// panel's previous / next tab; esc gives the keyboard back to the terminal; ? the keys.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { focused, panes, spaces, theme, layout, readTextFile, exec, home, appHome, nextCommand, checking, run, openOverlay, shared } from "herdr";
import { makeT, compact, relative, time } from "./i18n.js";
import strings from "./strings.js";
import { motionState, frame, enter } from "./motion.js";
// Copied byte for byte from mods/kt-keys/panel.js: in and out with the right panel (#73).
import { panelIn } from "./panel.js";
import { skeleton, readyFor } from "./skeleton.js";
// kt-keys' viz.js and roll.js, kt-threads' ring.js (with levels.js, ring.strings.js): byte-identical copies.
import { viz } from "./viz.js";
import { roll } from "./roll.js";
import { ring } from "./ring.js";
import { Vim, keysOf } from "./vim.js";
import { merge, breakdown, curve, current } from "./model.js";

const tr = makeT(strings);
const ME = "context"; // this block's id in the layout's "panel-body" stack
const EVERY = 4000; // the status line, while Context shows
const MONO = "Monaspace Krypton";
const SERIES = { system: "ansi4", tools: "ansi5", mcp: "ansi6", messages: "accent" };
// The panel's tabs in order, and each one's mod: [ / ] show the next one and give it the keyboard.
const TABS = ["files", "diff", "history", "flow", "crosstalk", "context", "gwm-panel"];
const TAB_MODS = { files: "kt-files", diff: "kt-diff", history: "kt-history", flow: "kt-flow", crosstalk: "kt-crosstalk", context: "kt-context", "gwm-panel": "kt-gwm" };
// The keyboard follows a moment later: a `<mod>.focus` sent at once reaches no copy (the new tab isn't shown yet).
function panelTab(dir, cx) {
  const child = TABS[(TABS.indexOf(ME) + dir + TABS.length) % TABS.length];
  run("layout.select", { stack: "panel-body", child });
  cx.timer.after(120, () => run(child === "gwm-panel" ? "kt-gwm.panel-focus" : `${TAB_MODS[child]}.focus`));
}
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const modePill = (t, vim) => div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
  .border_color(vim.insert ? alpha(t.accent, "66") : t.border).bg(vim.insert ? alpha(t.accent, "24") : t.background)
  .font_family(MONO).text_size(9).text_color(vim.insert ? t.accent : t.muted).child(vim.label);

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
function visible() {
  const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
  return Boolean(panel && !panel.hidden && body && (body.active ?? body.children?.[0]?.id) === ME);
}
// The focused terminal, else the shown tab's agent (else its first terminal). Local ones only (kt-flow's).
function terminal() {
  const f = focused()?.terminal;
  if (f && !f.includes("/")) return f;
  const tab = spaces().find((s) => s.active)?.tabs.find((x) => x.active);
  const mine = panes().filter((p) => p.tab === tab?.id && p.terminal && !p.terminal.includes("/"));
  return (mine.find((p) => p.program?.agent) ?? mine[0])?.terminal ?? null;
}

export default class Context extends View {
  init(_props, cx) {
    this.motion = motionState();
    this.handle = cx.focus_handle();
    this.vim = new Vim();
    this.term = null; // the terminal the last read followed
    this.readFor = undefined; // the terminal the last read answered for (skeleton.js' readyFor)
    this.line = null; // its status line
    this.lineAt = null; // that line's updated_at when the transcript was read
    this.st = null; // model.js' state of its transcript
    this.err = null;
    this.busy = false; // one read at a time, one more after
    this.again = null; // asked while busy: "yes", or "full" (from 0)
    this.shown = false;
    this.showGen = 0;
    if (checking()) return;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn();
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.act(this.vim.handle(k), cx);
        } else if (c === "refresh") this.read(cx, true);
        cx.notify();
      }
    });
    cx.timer.every(EVERY, (cx) => {
      if (visible()) this.read(cx);
      else if (this.shown) { this.shown = false; cx.notify(); }
    });
  }

  focusIn() {
    this.handle.focus();
    this.vim.normal();
  }

  key(e, cx) {
    if (!this.act(this.vim.handle(e), cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    if (a === "refresh") this.read(cx, true);
    else if (a === "escape") run("pane.go", { direction: "left" });
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "panel" } });
    else if (a === "panel-prev" || a === "panel-next") panelTab(a === "panel-next" ? 1 : -1, cx);
    else return false;
    return true;
  }

  // The status line, then the transcript from where it was left, if the line moved (or `full`: from 0).
  read(cx, full = false) {
    if (this.busy) { this.again = this.again === "full" || full ? "full" : "yes"; return; }
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const term = terminal();
        if (term !== this.term) { this.term = term; this.st = null; this.line = null; this.lineAt = null; this.err = null; }
        const line = term ? await this.lineOf(term) : null;
        this.line = line;
        const path = line ? line.transcript_path ?? (await this.bySession(line.session_id)) : null;
        if (!path) { this.st = null; this.err = null; }
        else if (full || this.st?.path !== path || line.updated_at !== this.lineAt) {
          const st = full || this.st?.path !== path ? null : this.st;
          let next = merge(st, path, await this.index(path, st?.offset ?? 0));
          if (!next) next = merge(null, path, await this.index(path, 0)); // didn't follow: the whole file
          this.st = next;
          this.lineAt = line.updated_at;
          this.err = null;
        }
      } catch (e) {
        this.err = String(e?.message ?? e).slice(0, 200);
      }
      this.readFor = this.term;
      this.busy = false;
      cx.notify();
      if (this.again) { const full = this.again === "full"; this.again = null; this.read(cx, full); }
    });
  }

  async lineOf(term) {
    try {
      const s = await readTextFile(`${home()}/.claude/cache/statusline/herdr-${term}.json`);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  // A status line written before it published transcript_path: the session's file by its id (kt-chat's).
  async bySession(id) {
    if (!id) return null;
    const r = await exec("/bin/sh", ["-c", 'ls -1 "$HOME"/.claude/projects/*/"$1".jsonl 2>/dev/null | head -1', "sh", id]).catch(() => null); // i18n: tech
    return r?.stdout?.trim() || null;
  }

  async index(path, from) {
    const r = await exec(`${home()}/.nix-profile/bin/bun`, [`${appHome()}/mods/kt-context/ctx-index.ts`, path, "--from", String(from)], { timeout: 60000 });
    if (r.code !== 0) throw new Error((r.stderr || r.stdout || `exit ${r.code}`).trim().split("\n").slice(-2).join(" "));
    return JSON.parse(r.stdout);
  }

  // ---------- drawing ----------

  card(t, id) {
    return v_flex().id(id).flex_none().rounded(16).border(1).border_color(t.border).bg(t.background).px(14).py(12).gap(10);
  }

  title(t, text, tag) {
    return h_flex().gap(8).items_center()
      .child(div().text_size(12.5).font_semibold().text_color(t.foreground).child(text))
      .when(Boolean(tag), (el) => el.child(div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1).border_color(t.border)
        .font_family(MONO).text_size(9).text_color(t.muted).child(tag)));
  }

  note(t, text, color) {
    return div().text_size(11.5).text_color(color ?? t.muted).child(text);
  }

  head(t, now) {
    const l = this.line;
    return this.card(t, "kc-head")
      .child(h_flex().gap(12).items_center()
        .child(ring(t, "kc-ring", now.pct, 44, { kind: "ctx", window: now.window, roll, m: this.motion }))
        .child(v_flex().flex_1().min_w(0).gap(3)
          .child(h_flex().gap(8).items_center()
            .child(div().flex_1().min_w(0).truncate().text_size(13.5).font_semibold().child(tr("title")))
            .when(this.keyed, (el) => el.child(modePill(t, this.vim))))
          .child(div().truncate().font_family(MONO).text_size(11.5).text_color(t.muted)
            .child(tr("of", { used: compact(now.tokens), window: compact(now.window) })))
          // A compaction since the last call: its « after », until the next call says exactly.
          .when(Boolean(now.compacted), (el) => el.child(div().truncate().text_size(11).text_color(t.muted)
            .child(tr("afterCompaction", { at: time(now.compacted) }))))
          .child(div().truncate().font_family(MONO).text_size(11).text_color(t.dim)
            .child([l.model, l.effort, l.updated_at ? tr("readAt", { ago: relative(l.updated_at * 1000) }) : null].filter(Boolean).join(" · ")))));
  }

  split(t, V, now) {
    const rows = breakdown(this.st?.shape, now.tokens);
    const card = this.card(t, "kc-split").child(this.title(t, tr("split"), rows ? tr("estimated") : null));
    if (!rows) return card.child(this.note(t, tr("noSplit")));
    const total = rows.reduce((n, r) => n + r.tokens, 0) || 1;
    return card
      .children(rows.map((r) => V.progress(tr(r.key), r.tokens, {
        max: total, id: `kc-p-${r.key}`, color: SERIES[r.key],
        figure: tr("share", { n: compact(r.tokens), p: Math.round((r.tokens / total) * 100) }),
        detail: r.servers ? r.servers.slice(0, 6).map((s) => `${s.name} ${compact(s.tokens)}`).join(" · ") : null,
      })))
      .child(this.note(t, tr("splitHow"), t.dim));
  }

  over(t, V) {
    const turns = this.st?.turns ?? [];
    const card = this.card(t, "kc-curve").child(this.title(t, tr("curve"), turns.length ? tr("calls", { n: turns.length }) : null));
    if (!turns.length) return card.child(this.note(t, tr("noCalls")));
    const { values, labels } = curve(turns);
    return card
      .child(V.chart("area", [{ label: tr("title"), values, color: "accent" }], { labels, height: 150, id: "kc-chart" }))
      .children((this.st.compactions ?? []).slice(-5).map((c, i) => div().id(`kc-cp-${i}`).font_family(MONO).text_size(11).text_color(t.muted)
        .child(tr("compaction", { how: tr(c.trigger === "manual" ? "manual" : "auto"), at: time(c.at), pre: compact(c.pre), post: compact(c.post) }))));
  }

  empty(t, text) {
    return v_flex().size_full().gap(4)
      .when(this.keyed, (el) => el.child(h_flex().flex_none().px(14).pt(6).child(div().flex_1()).child(modePill(t, this.vim))))
      .child(this.card(t, "kc-empty").child(this.note(t, text)));
  }

  skel(t, m) {
    const S = skeleton(t, m);
    const card = () => v_flex().flex_none().rounded(16).border(1).border_color(t.border).bg(t.background).px(14).py(12).gap(10);
    return S.pulse(v_flex().id("kc-sk").size_full().gap(4).overflow_hidden()
      .child(card().child(h_flex().gap(12).items_center().child(S.circle(44, { ring: 5 }))
        .child(v_flex().flex_1().gap(4).child(S.line(0.4, { h: 9, lh: 18 })).child(S.line(0.6, { h: 7, lh: 15 })))))
      .child(card().child(S.line(0.3, { h: 8, lh: 16 })).children([0.9, 0.5, 0.3].map((w) => S.line(w, { h: 9, lh: 22 }))))
      .child(card().child(S.line(0.3, { h: 8, lh: 16 })).child(S.block(null, 150, { r: 6 }))));
  }

  // panel.js: the whole view glides in and out with the right panel (#73).
  render(cx) {
    return panelIn(this.motion, this.draw(cx));
  }

  draw(cx) {
    const vis = visible();
    const target = terminal();
    if (vis && !checking() && (!this.shown || target !== this.term)) this.read(cx);
    if (vis && !this.shown) this.showGen++;
    this.shown = vis;
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const t = theme();
    this.keyed = this.handle.is_focused();
    // The same root in every state, so the keyboard stays here.
    const root = (el) => el.id("kt-context").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx));
    if (!readyFor(this.readFor, target)) return root(this.skel(t, m));
    if (!target) return root(this.empty(t, tr("noTerminal")));
    if (!this.line) return root(this.empty(t, tr("noLine")));
    const V = viz(t, this.motion, { roll });
    const now = current(this.st, this.line);
    return root(v_flex().size_full().text_color(t.foreground)).child(enter(m, v_flex().size_full().gap(4), `kc-in-${this.showGen}`, { dy: 0 })
      .child(this.head(t, now))
      .child(v_flex().id("kc-body").flex_1().min_h(0).overflow_y_scrollbar().gap(4)
        .when(Boolean(this.err), (el) => el.child(this.card(t, "kc-err").child(this.note(t, tr("readError", { why: this.err }), t.ansi1))))
        .when(!this.st && !this.err, (el) => el.child(this.card(t, "kc-none").child(this.note(t, tr("noTranscript")))))
        .when(Boolean(this.st), (el) => el.child(this.split(t, V, now)).child(this.over(t, V)))));
  }
}
