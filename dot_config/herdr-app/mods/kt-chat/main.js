// kt-chat: the thread's Claude Code transcript as a chat (issue #53, read only), in place of the
// terminal. The agent is the shown tab's Claude agent (the focused pane's if it is one): when the
// Chat has the keyboard, focused().terminal is no longer the agent's.
//
// Data: ~/.claude/cache/statusline/herdr-<terminal>.json gives transcript_path (statusline.ts),
// else its session_id is looked up under ~/.claude/projects. chat-index.ts (bun, by exec) reads
// the JSONL from a byte and prints the last K turns, trimmed; chat-model.js (pure) makes the turns,
// their items and folds. render only walks built turns: nothing is parsed or grouped there.
//
// Shown: user bubbles (images, files, /command), the fold « A travaillé 3 min · 4 lectures · 2
// modifs » (a click opens it), tool steps with their detail (command and output, diff, lines read,
// report), thinking, prose through markdown.js, notices (compaction and its summary, interruption,
// API error, command output, background task), sub-agents' cards in a live turn, « Tours
// précédents » at the top. Keys (focusable): j k turns, gg G, ctrl-d ctrl-u, o / enter fold, y copy
// the turn's answer, r reread. `kt-chat.file:<path>` shows that JSONL instead (tests), `file:` back.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, TextView } from "gpui-base";
import { agents, focused, panes, theme, settings, shared, home, appHome, exec, readTextFile, checking, nextCommand, notify, props, layout } from "herdr";
import { ingest, prepend, build, tally, foldedSteps } from "./chat-model.js";
import { pickTarget, tallyText, firstShown, childOf, shownAfterRead, chatShown } from "./chat-view.js";
import { preview, docOf, mdState, mdBudget, target as linkTarget } from "./markdown.js";
import { motionState, frame, enter } from "./motion.js";
import { skeleton, readyFor } from "./skeleton.js";
import { Vim, keyOf, keysOf, step } from "./vim.js";
import { makeT, duration, time, num } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const K = 30; // turns read at first, and per read of « Tours précédents »
// Turns drawn, then added per « Tours précédents » (the loaded ones first, then a read): a render
// has ~50 ms, and 30 busy turns took ~40 ms to describe under herdr-app check.
const SHOW = 10;
const BUDGET = 500000; // chat-index.ts --budget: characters of JSON per read
const MAX_ENTRIES = 900; // --max-entries: JSON.parse + build() stay ~15 ms in the mod engine
const STEPS = 6; // steps an activity shows before « N étapes de plus »
const MORE = 30; // steps each « N étapes de plus » adds
const LINES = 60; // lines a detail box shows
const I = (name) => `mods/kt-threads/${name}.svg`;
const OWN = (name) => `mods/kt-chat/${name}.svg`;
const SPIN = "mods/workspace-chrome/spinner.svg";
const MSG = "mods/kt-panel-head/messages-square.svg";
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const red = (t) => t.ansi1 ?? t.blocked;

const KIND_ICON = { read: I("file-text"), edit: I("square-pen"), execute: OWN("terminal"), search: I("search"), agent: I("bot"), skill: I("sparkles"), tasks: I("list"), other: OWN("wrench") };
const FOLD_ICON = { edit: I("square-pen"), run: OWN("terminal"), agent: I("bot"), research: I("search"), other: OWN("wrench"), think: OWN("brain"), note: MSG };
// Claude Code's agent colors, on the theme's (a teammate's `color`).
const AGENT_COLOR = { red: "ansi1", green: "ansi2", yellow: "ansi3", blue: "ansi4", purple: "ansi5", magenta: "ansi5", cyan: "ansi6", pink: "ansi13", orange: "ansi11" };
const agentColor = (t, c) => (c ? t[AGENT_COLOR[c]] ?? (c.startsWith("#") ? c : null) : null) ?? t.accent;

const lines = (s) => String(s ?? "").replace(/\n+$/, "").split("\n");
const target = () => pickTarget({ focused, agents, panes });

/** The answer of a turn, as the reader reads it: its prose, joined. */
const answerOf = (turn) => turn.blocks.filter((b) => b.role === "prose").map((b) => b.text.trim()).filter(Boolean).join("\n\n");

export default class Chat extends View {
  init(_props, cx) {
    this.state = null; // chat-model's state (ingest / prepend)
    this.turns = [];
    this.builtLive = false;
    this.err = null; // { code, path?, why? }: why the transcript isn't shown
    this.readFor = undefined; // the target the shown data was read for (skeleton.js readyFor)
    this.loadedFor = undefined;
    this.fixed = props()?.file ?? null; // a JSONL shown instead of the agent's
    this.open = new Set(); // opened: f:<turn> fold, s:<step> detail, c:<notice> summary, r:<run> report
    this.shownSteps = new Map(); // activity id -> steps drawn (STEPS, then MORE at a time)
    this.cur = -1; // the turn cursor (-1: the last)
    this.show = SHOW; // turns drawn (the last ones)
    this.follow = true; // stuck to the bottom until the reader scrolls up
    this.reveal = null; // a child to bring into view after the next layout
    this.width = 640;
    this.scroll = ScrollHandle.new();
    this.md = mdState();
    this.motion = motionState();
    this.handle = cx.focus_handle();
    this.vim = new Vim();
    // ctrl-b space (kt-composer / kt-head view.js) asks for the keyboard through this shared stamp (a
    // time). One older than 2 s when this copy starts is not a request; a fresh one is (the first
    // ctrl-b space starts this copy: its stamp is written just before).
    const stamp = shared("kt.chat.focus");
    this.focusAsked = stamp && Date.now() - stamp > 2000 ? stamp : null;
    if (checking()) return;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        const name = c.split(":")[0];
        const arg = c.slice(name.length + 1);
        if (name === "focus") this.focusIn();
        else if (name === "key") {
          this.focusIn();
          for (const k of keysOf(arg)) this.press(k, cx);
        } else if (name === "file") {
          this.fixed = arg || null;
          this.loadedFor = undefined;
        } else if (name === "refresh") this.load(cx);
        cx.notify();
      }
    });
  }

  focusIn() {
    this.handle.focus();
    this.vim.normal();
  }

  // ---------- reading ----------

  /** What is shown: a fixed file, the agent, or nothing (with the reason, from target()). */
  wanted(tg) {
    if (this.fixed) return `file:${this.fixed}`;
    return tg.agent && !tg.reason ? tg.agent.address : null;
  }

  async locate(address) {
    let line = null;
    try {
      const s = await readTextFile(`${home()}/.claude/cache/statusline/herdr-${address}.json`);
      line = s ? JSON.parse(s) : null;
    } catch {
      line = null;
    }
    if (line?.transcript_path) return line.transcript_path;
    if (!line?.session_id) return null;
    // A status line written before it published transcript_path: the session's file by its id.
    const r = await exec("/bin/sh", ["-c", 'ls -1 "$HOME"/.claude/projects/*/"$1".jsonl 2>/dev/null | head -1', "sh", line.session_id]).catch(() => null); // i18n: tech
    return r?.stdout?.trim() || null;
  }

  async index(path, extra = []) {
    const args = [`${appHome()}/mods/kt-chat/chat-index.ts`, path, "--last-turns", String(K), "--budget", String(BUDGET), "--max-entries", String(MAX_ENTRIES), ...extra];
    const r = await exec(`${home()}/.nix-profile/bin/bun`, args, { timeout: 60000 });
    if (r.code !== 0) throw new Error((r.stderr || r.stdout || `exit ${r.code}`).trim().split("\n").slice(-3).join(" "));
    return JSON.parse(r.stdout);
  }

  /** Reads the last K turns of what is shown now. Coalesced: one read at a time, one more after. */
  load(cx) {
    if (this.busy) {
      this.again = true;
      return;
    }
    this.busy = true;
    const tg = target();
    const want = this.wanted(tg);
    cx.spawn(async (cx) => {
      try {
        if (!want) {
          this.state = null;
          this.turns = [];
          this.err = null;
        } else {
          const path = this.fixed ?? (await this.locate(want));
          const out = path ? await this.index(path) : null;
          if (!path) this.err = { code: "noSession" };
          else if (out.error === "missing") this.err = { code: "missing", path };
          else {
            this.err = null;
            this.state = ingest(null, out);
            this.rebuild(tg.agent?.status === "working" && !this.fixed);
            this.follow = true;
            this.cur = -1;
            this.show = SHOW;
            this.reveal = "bottom";
          }
          if (this.err) {
            this.state = null;
            this.turns = [];
          }
        }
      } catch (e) {
        this.state = null;
        this.turns = [];
        this.err = { code: "failed", why: String(e?.message ?? e).slice(0, 300) };
      } finally {
        this.readFor = want;
        this.busy = false;
        cx.notify();
      }
      if (this.again) {
        this.again = false;
        this.load(cx);
      }
    });
  }

  rebuild(live) {
    this.builtLive = live;
    this.turns = this.state ? build(this.state.entries, { live }) : [];
    // The fold's counts, once per build rather than on every render.
    for (const turn of this.turns) turn.tally = turn.fold ? tally(foldedSteps(turn.items, turn.fold)) : null;
  }

  /** The first turn drawn: the last `this.show` of them. */
  first() {
    return firstShown(this.turns.length, this.show);
  }

  /**
   * « Tours précédents »: the loaded turns not drawn yet first, then a read before the first one.
   * Either way the turn that was first drawn stays where the reader was looking. The caller redraws.
   */
  older(cx) {
    const was = this.first();
    if (was > 0) {
      this.show += SHOW;
      this.reveal = childOf(was, this.first());
      return;
    }
    if (!this.state?.more || this.olderBusy) return;
    this.olderBusy = true;
    const before = this.turns.length;
    cx.spawn(async (cx) => {
      try {
        const next = prepend(this.state, await this.index(this.state.path, ["--to", String(this.state.start)]));
        if (next !== this.state) {
          this.state = next;
          this.rebuild(this.builtLive);
          const added = Math.max(0, this.turns.length - before);
          this.show = shownAfterRead(before, added, SHOW);
          this.reveal = childOf(added, this.first()); // the old first turn is now at `added`
          if (this.cur >= 0) this.cur += added;
        }
      } catch (e) {
        notify({ title: tr("empty.failed.title"), body: String(e?.message ?? e).slice(0, 300), level: "error" });
      } finally {
        this.olderBusy = false;
        cx.notify();
      }
    });
  }

  // ---------- keys ----------

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* and the app's keys go on
    cx.stop_propagation();
    cx.notify();
  }

  press(e, cx) {
    const a = this.vim.handle(e);
    if (a === "pending" || a === "count") return true;
    const n = this.turns.length;
    const at = this.cur < 0 ? n - 1 : this.cur;
    const move = (to) => {
      this.cur = to;
      this.follow = to === n - 1;
      if (to < this.first()) this.show = n - to; // the cursor draws the turns it reaches
      this.reveal = childOf(to, this.first());
    };
    switch (a) {
      case "down":
      case "up":
      case "top":
      case "bottom":
      case "half-down":
      case "half-up":
        if (n) move(step(a, at, n, this.vim.count, 10));
        return true;
      case "open": {
        const turn = this.turns[at];
        if (turn?.fold) this.toggle(`f:${turn.id}`);
        return true;
      }
      case "yank": {
        const text = this.turns[at] ? answerOf(this.turns[at]) : "";
        if (text) {
          cx.write_to_clipboard(text);
          notify({ title: tr("copied"), level: "success", timeout: 2000 });
        }
        return true;
      }
      case "refresh":
        this.load(cx);
        return true;
    }
    return false;
  }

  toggle(id) {
    if (this.open.has(id)) this.open.delete(id);
    else this.open.add(id);
  }

  // ---------- pieces ----------

  label(t, text, color = t.dim) {
    return div().font_family(MONO).text_size(10.5).text_color(color).child(text);
  }

  // A detail box's text: one div per line (a line wraps), the last LINES of them.
  mono(t, text, color = t.muted) {
    const all = lines(text);
    const shown = all.length > LINES ? all.slice(-LINES) : all;
    return v_flex().min_w(0).font_family(MONO).text_size(11).line_height("16px").text_color(color)
      .children(shown.map((l) => div().min_w(0).child(l || " ")));
  }

  // A call's state after its title: nothing when it went fine. A tooltip needs a div around the svg.
  stateMark(t, state, id) {
    const mark = (icon, color, tip) => div().id(`kc-sm-${id}`).flex_none().tooltip(tip).child(svg(icon).size(12).text_color(color));
    if (state === "running") return svg(SPIN).size(12).flex_none().text_color(t.working).spin(900);
    if (state === "error") return mark(I("circle-alert"), red(t), tr("state.error"));
    if (state === "stopped") return mark(I("x"), t.dim, tr("state.stopped"));
    return null;
  }

  detail(t, b) {
    const r = b.result;
    const box = v_flex().ml(22).mt(2).mb(4).p(8).gap(6).min_w(0).rounded(10).border(1).border_color(t.border).bg(t.raised);
    const out = [];
    const section = (title, el) => out.push(v_flex().gap(3).min_w(0).child(this.label(t, title)).child(el));
    const i = b.input ?? {};
    if (b.kind === "execute") {
      if (i.command) section(tr("detail.command"), this.mono(t, i.command, t.foreground));
      if (r) section(tr("detail.output"), r.text ? this.mono(t, r.text, r.ok ? t.muted : red(t)) : this.label(t, tr("detail.noOutput")));
      if (r?.interrupted) out.push(this.label(t, tr("detail.interrupted"), red(t)));
      if (r?.background || i.background) out.push(this.label(t, tr("detail.background")));
    } else if (b.kind === "edit" && r?.diff) {
      if (r.create) out.push(this.label(t, tr("detail.created", { n: r.lines ?? 0 })));
      const rows = [];
      for (const h of r.diff) for (const l of h.lines) rows.push(l);
      if (rows.length) {
        out.push(v_flex().min_w(0).font_family(MONO).text_size(11).line_height("16px").children(rows.slice(0, LINES * 2).map((l) => {
          const c = l[0] === "+" ? t.ansi2 : l[0] === "-" ? red(t) : null;
          return div().min_w(0).px(4).rounded(3).text_color(c ?? t.muted).when(Boolean(c), (el) => el.bg(alpha(c, "1a"))).child(l || " ");
        })));
      }
      if (r.diff.some((h) => h.cut) || rows.length > LINES * 2) out.push(this.label(t, tr("detail.diffCut")));
    } else if (b.kind === "read" && r?.file) {
      out.push(this.label(t, r.file.image ? tr("detail.image") : tr("detail.lines", { a: r.file.start ?? 1, b: (r.file.start ?? 1) + Math.max(0, (r.file.lines ?? 1) - 1), n: r.file.total ?? r.file.lines ?? 0 })));
    } else {
      const input = i.command ?? i.pattern ?? i.prompt ?? (i.todos ? i.todos.map((x) => `${x.status === "completed" ? "[x]" : "[ ]"} ${x.text}`).join("\n") : null) ?? i.json ?? (i.skill ? [i.skill, i.args].filter(Boolean).join(" ") : null);
      if (input) section(tr("detail.input"), this.mono(t, input, t.foreground));
      if (r?.text) section(b.kind === "agent" ? tr("detail.report") : tr("detail.output"), this.mono(t, r.text, r.ok ? t.muted : red(t)));
    }
    if (r && r.size > (r.text?.length ?? 0) + 1 && r.text) out.push(this.label(t, tr("detail.cut", { n: num(r.size) })));
    if (!out.length) return null;
    return box.children(out);
  }

  // One step of an activity: thinking, an interjection the turn absorbed, a tool call.
  step(t, b) {
    const row = (id, icon, main, extra, onClick) => h_flex().id(id).h(24).px(4).gap(8).items_center().min_w(0).rounded(6)
      .when(Boolean(onClick), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => { onClick(); cx.notify(); }))
      .child(svg(icon).size(13).flex_none().text_color(t.dim))
      .children(main)
      .when(Boolean(extra), (el) => el.child(extra));
    if (b.role === "thinking") {
      const has = Boolean(b.text?.trim());
      const id = `s:${b.id}`;
      const el = row(`kc-st-${b.id}`, OWN("brain"), [div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).child(b.ms ? tr("think.ms", { d: duration(b.ms) }) : tr("think"))], null, has ? () => this.toggle(id) : null);
      return has && this.open.has(id) ? v_flex().min_w(0).child(el).child(v_flex().ml(22).mb(4).child(this.mono(t, b.text))) : el;
    }
    if (b.role === "note") {
      return row(`kc-st-${b.id}`, MSG, [div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).child(lines(b.text)[0] || " ")], this.label(t, tr("sentDuring")));
    }
    const id = `s:${b.id}`;
    const opened = this.open.has(id);
    const el = row(`kc-st-${b.id}`, KIND_ICON[b.kind] ?? KIND_ICON.other, [
      div().flex_none().font_family(MONO).text_size(11).text_color(t.foreground).child(b.name), // i18n: tech
      div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).child(b.title || " "),
    ], this.stateMark(t, b.state, b.id), () => this.toggle(id));
    const d = opened ? this.detail(t, b) : null;
    return d ? v_flex().min_w(0).child(el).child(d) : el;
  }

  // The last STEPS steps; « N étapes de plus » adds MORE at a time (a run of 300 calls drawn at once
  // would not fit in a render), « Ne montrer que les dernières » goes back.
  activity(t, item) {
    const n = Math.min(item.steps.length, this.shownSteps.get(item.id) ?? STEPS);
    const hidden = item.steps.length - n;
    const steps = hidden ? item.steps.slice(-n) : item.steps;
    const more = (id, icon, text, to) => h_flex().id(id).h(22).px(4).gap(8).items_center().rounded(6).cursor_pointer()
      .hover((s) => s.bg(t.hover)).on_click((_e, cx) => { this.shownSteps.set(item.id, to); cx.notify(); })
      .child(svg(I(icon)).size(12).text_color(t.dim))
      .child(this.label(t, text));
    return v_flex().min_w(0).gap(1)
      .when(hidden > 0, (el) => el.child(more(`kc-more-${item.id}`, "chevron-down", tr("steps.more", { n: hidden }), n + MORE)))
      .when(n > STEPS, (el) => el.child(more(`kc-less-${item.id}`, "chevron-up", tr("steps.less"), STEPS)))
      .children(steps.map((b) => this.step(t, b)));
  }

  subagents(t, item) {
    return v_flex().gap(6).min_w(0).children(item.runs.map((b) => {
      const a = b.result?.agent ?? {};
      const c = agentColor(t, a.color);
      const id = `r:${b.id}`;
      const name = a.name || b.input?.name || b.input?.description || b.title || b.name;
      const sub = [b.input?.type ?? a.type, a.model, tr(`sub.${b.state ?? "running"}`)].filter(Boolean).join(" · ");
      const card = h_flex().id(`kc-sub-${b.id}`).px(10).py(8).gap(10).items_center().min_w(0).rounded(12).border(1)
        .border_color(alpha(c, "4d")).bg(alpha(c, settings().dark ? "14" : "0f")).cursor_pointer()
        .on_click((_e, cx) => { this.toggle(id); cx.notify(); })
        .child(svg(I("bot")).size(16).flex_none().text_color(c))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().truncate().text_size(12.5).font_medium().text_color(t.foreground).child(name))
          .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(sub)))
        .when(b.state === "running" || b.state === "error" || b.state === "stopped", (el) => el.child(this.stateMark(t, b.state, `sub-${b.id}`)));
      return this.open.has(id) && b.result?.text
        ? v_flex().min_w(0).child(card).child(v_flex().ml(12).mt(4).child(this.mono(t, b.result.text)))
        : card;
    }));
  }

  notice(t, b) {
    const line = (icon, color, text) => h_flex().gap(8).items_center().min_w(0).text_size(12).text_color(color)
      .child(svg(icon).size(13).flex_none()).child(div().flex_1().min_w(0).child(text));
    if (b.kind === "compact") {
      const id = `c:${b.id}`;
      const opened = this.open.has(id);
      const head = [b.trigger === "auto" ? tr("notice.compactAuto") : tr("notice.compact"), b.tokens ? tr("notice.tokens", { n: num(b.tokens) }) : null].filter(Boolean).join(" · ");
      const sep = h_flex().id(`kc-cp-${b.id}`).py(6).gap(10).items_center()
        .when(Boolean(b.text), (el) => el.cursor_pointer().tooltip(opened ? tr("notice.hideSummary") : tr("notice.summary")).on_click((_e, cx) => { this.toggle(id); cx.notify(); }))
        .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border))
        .child(h_flex().gap(6).items_center().child(svg(I("layers")).size(12).text_color(t.dim)).child(this.label(t, head)))
        .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border));
      return opened && b.text
        ? v_flex().min_w(0).child(sep).child(v_flex().p(10).rounded(10).border(1).border_color(t.border).bg(t.raised).text_size(12).text_color(t.muted)
          .child(TextView.markdown(`kc-sum-${b.id}`, b.text).selectable(true)))
        : sep;
    }
    if (b.kind === "interrupt") return line(I("x"), t.dim, tr("notice.interrupt"));
    if (b.kind === "error") {
      return v_flex().gap(4).min_w(0)
        .child(line(I("circle-alert"), red(t), [tr("notice.error"), b.code].filter(Boolean).join(" · ")))
        .when(Boolean(b.text), (el) => el.child(div().ml(21).text_size(12).text_color(t.muted).child(b.text)));
    }
    if (b.kind === "task") {
      const failed = b.status && b.status !== "completed";
      return line(I(failed ? "circle-alert" : "circle-check"), failed ? red(t) : t.dim, [failed ? tr("notice.taskFailed") : tr("notice.task"), b.text].filter(Boolean).join(" · "));
    }
    if (b.kind === "command") {
      return v_flex().gap(4).min_w(0).px(10).py(8).rounded(10).border(1).border_color(t.border).bg(t.raised)
        .child(this.label(t, tr("notice.command")))
        .child(this.mono(t, b.text));
    }
    return null;
  }

  prose(t, cx, b, budget) {
    const doc = docOf(this.md, b.text, { meta: false });
    return v_flex().w_full().min_w(0).text_size(13).text_color(t.foreground)
      .child(preview(t, cx, this.md, { id: `kc-md-${b.id}`, mod: "kt-chat", doc, budget, noRaw: true, onLink: (url) => this.link(url) }));
  }

  // A web link opens in the browser; a path in the prose is left alone (no viewer chosen yet).
  link(url) {
    const to = linkTarget(url, this.state?.meta?.cwd ?? null);
    if (to?.web) exec("open", [to.web]).catch(() => {});
  }

  // The interjection of a live turn: a pale bubble on the right, under the work it landed in.
  note(t, b) {
    return v_flex().items_end().gap(3)
      .child(div().max_w(this.bubbleW()).px(12).py(6).rounded(14).border(1).border_dashed().border_color(alpha(t.accent, "4d"))
        .bg(alpha(t.accent, "0f")).text_size(12.5).text_color(t.foreground).child(TextView.markdown(`kc-note-${b.id}`, b.text).selectable(true)))
      .child(this.label(t, tr("sentDuring")));
  }

  item(t, cx, it, budget) {
    if (it.type === "activity") return this.activity(t, it);
    if (it.type === "subagents") return this.subagents(t, it);
    const b = it.block;
    if (b.role === "prose") return this.prose(t, cx, b, budget);
    if (b.role === "notice") return this.notice(t, b);
    if (b.role === "note") return this.note(t, b);
    return null;
  }

  bubbleW() {
    return Math.max(260, Math.round(this.width * 0.7));
  }

  chip(t, icon, text, mono = false) {
    return h_flex().h(20).px(7).gap(5).items_center().rounded_full().border(1).border_color(t.border).bg(t.background)
      .text_size(10.5).text_color(t.muted).when(mono, (el) => el.font_family(MONO))
      .child(svg(icon).size(11).flex_none()).child(div().max_w(220).truncate().child(text));
  }

  opener(t, turn) {
    const u = turn.user;
    if (!u) return null;
    const at = u.at ? ` · ${time(u.at)}` : "";
    if (u.from?.kind === "task") {
      const failed = u.from.status && u.from.status !== "completed";
      return h_flex().justify_center().child(h_flex().px(10).py(4).gap(6).items_center().rounded_full().border(1).border_color(t.border)
        .text_size(11.5).text_color(failed ? red(t) : t.muted)
        .child(svg(I(failed ? "circle-alert" : "circle-check")).size(12).flex_none())
        .child(div().max_w(this.bubbleW()).truncate().child([failed ? tr("notice.taskFailed") : tr("notice.task"), u.text].filter(Boolean).join(" · ") + at)));
    }
    if (u.from) {
      // Another agent speaking (a peer session, a teammate): on the left, its color as a stripe.
      const c = agentColor(t, u.from.color);
      return v_flex().items_start().gap(4)
        .child(this.label(t, `${u.from.name}${at}`))
        .child(div().relative().max_w(this.bubbleW()).py(8).pr(12).pl(15).rounded(12).border(1).overflow_hidden()
          .border_color(alpha(c, "4d")).bg(alpha(c, settings().dark ? "14" : "0f")).text_size(12.5).text_color(t.foreground)
          .child(div().absolute().top(8).bottom(8).left(5).w(3).rounded_full().bg(c))
          .child(TextView.markdown(`kc-from-${turn.id}`, u.text || " ").selectable(true)));
    }
    const chips = [];
    if (u.cmd) chips.push(this.chip(t, OWN("terminal"), [u.cmd.name, u.cmd.args].filter(Boolean).join(" "), true));
    if (u.images) chips.push(this.chip(t, I("file"), tr("images", { n: u.images })));
    for (const f of turn.files) chips.push(this.chip(t, I("file-text"), f, true));
    return v_flex().items_end().gap(4)
      .when(chips.length > 0, (el) => el.child(h_flex().max_w(this.bubbleW()).gap(4).flex_wrap().justify_end().children(chips)))
      .when(Boolean(u.text?.trim()), (el) => el.child(div().max_w(this.bubbleW()).px(12).py(8).rounded(14).bg(t.raised)
        .text_size(13).text_color(t.foreground).child(TextView.markdown(`kc-u-${turn.id}`, u.text).selectable(true))))
      .child(this.label(t, `${tr("you")}${at}`));
  }

  foldLine(t, turn, opened) {
    const c = turn.tally;
    const text = [turn.ms ? tr("fold.worked", { d: duration(turn.ms) }) : tr("fold.work"), tallyText(c, tr)].filter(Boolean).join(" · ");
    return h_flex().id(`kc-fold-${turn.id}`).h(26).px(4).gap(8).items_center().min_w(0).rounded(8).cursor_pointer()
      .hover((s) => s.bg(t.hover)).on_click((_e, cx) => { this.toggle(`f:${turn.id}`); cx.notify(); })
      .child(svg(I(opened ? "chevron-down" : "chevron-right")).size(12).flex_none().text_color(t.dim))
      .child(svg(FOLD_ICON[c.kind] ?? FOLD_ICON.other).size(13).flex_none().text_color(t.dim))
      .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).child(text));
  }

  turn(t, cx, turn, i, budget, keyed) {
    const out = [];
    const op = this.opener(t, turn);
    if (op) out.push(op);
    const f = turn.fold;
    const opened = f && this.open.has(`f:${turn.id}`);
    turn.items.forEach((it, n) => {
      if (f && n === f.start) out.push(this.foldLine(t, turn, opened));
      // Inside a closed fold only the sub-agents keep their rows (Monocode pins them outside it).
      if (f && !opened && n >= f.start && n <= f.end && it.type !== "subagents") return;
      const el = this.item(t, cx, it, budget);
      if (el) out.push(el);
    });
    const here = keyed && i === (this.cur < 0 ? this.turns.length - 1 : this.cur);
    return v_flex().id(`kc-turn-${turn.id}`).flex_none().w_full().min_w(0).py(10).pl(here ? 10 : 12).pr(12).gap(8)
      .border_l(2).border_color(here ? t.accent : alpha(t.accent, "00"))
      .children(out);
  }

  head(t) {
    if (this.first() > 0 || this.state?.more) {
      return h_flex().id("kc-older").flex_none().justify_center().py(8).child(h_flex().id("kc-older-btn").h(26).px(12).gap(6).items_center().rounded_full()
        .border(1).border_color(t.border).cursor_pointer().hover((s) => s.bg(t.hover)).text_size(11.5).text_color(t.muted)
        .on_click((_e, cx) => { this.older(cx); cx.notify(); })
        .child(svg(this.olderBusy ? SPIN : I("chevron-up")).size(12).when(Boolean(this.olderBusy), (el) => el.spin(900)))
        .child(this.olderBusy ? tr("olderLoading") : tr("older")));
    }
    return h_flex().flex_none().justify_center().py(8).child(this.label(t, tr("start")));
  }

  empty(t, title, body, retry) {
    return v_flex().flex_1().min_h(0).p(16).gap(10).items_center().justify_center()
      .child(svg(MSG).size(22).text_color(t.dim))
      .child(div().text_size(13).font_medium().text_color(t.foreground).child(title))
      .child(div().max_w(380).text_size(12).text_color(t.muted).child(body))
      .when(retry, (el) => el.child(h_flex().id("kc-retry").h(26).px(10).gap(6).items_center().rounded_full().border(1).border_color(t.border)
        .font_family(MONO).text_size(10.5).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => { this.load(cx); cx.notify(); })
        .child(svg(I("refresh-cw")).size(11)).child(tr("retry"))));
  }

  body(t, cx, tg, keyed) {
    if (!this.fixed && tg.reason === "noAgent") return this.empty(t, tr("empty.noAgent.title"), tr("empty.noAgent.text"));
    if (!this.fixed && tg.reason === "notClaude") return this.empty(t, tr("empty.notClaude.title"), tr("empty.notClaude.text", { app: tg.app }));
    if (!this.fixed && tg.reason === "remote") return this.empty(t, tr("empty.remote.title"), tr("empty.remote.text", { machine: tg.machine }));
    const want = this.wanted(tg);
    if (!readyFor(this.readFor, want)) {
      // Not read yet for this agent: rows as bars, breathing (skeleton.js), not the previous agent's.
      const S = skeleton(t, this.m);
      return S.pulse(v_flex().id("kc-sk").flex_1().min_h(0).p(12).gap(10).child(S.list(5, { h: 52, icon: 0, lines: [0.4, 0.75], gap_y: 6 })));
    }
    const e = this.err;
    if (e?.code === "noSession") return this.empty(t, tr("empty.noSession.title"), tr("empty.noSession.text"), true);
    if (e?.code === "missing") return this.empty(t, tr("empty.missing.title"), tr("empty.missing.text", { path: e.path }), true);
    if (e?.code === "failed") return this.empty(t, tr("empty.failed.title"), tr("empty.failed.text", { why: e.why }), true);
    if (!this.turns.length) return this.empty(t, tr("empty.empty.title"), tr("empty.empty.text"), true);
    const budget = mdBudget(); // one per render, shared by every prose block (markdown.js)
    const from = this.first();
    // The 1 px end mark: revealing it shows the bottom of a last turn taller than the view.
    const children = [this.head(t), ...this.turns.slice(from).map((turn, i) => this.turn(t, cx, turn, from + i, budget, keyed)), div().flex_none().h(1)];
    if (this.reveal != null) {
      this.scroll.scroll_to_item(this.reveal === "bottom" ? children.length - 1 : Math.min(this.reveal, children.length - 1));
      this.reveal = null;
    }
    return div().relative().flex_1().min_h(0).flex().flex_col()
      .child(v_flex().id("kc-scroll").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).py(6)
        // Scrolling up leaves the bottom: new turns no longer pull the view down (G or the pill bring it back).
        .on_scroll_wheel((ev, cx) => { if (ev.delta.y > 0 && this.follow) { this.follow = false; cx.notify(); } })
        .children(children))
      .when(!this.follow, (el) => el.child(h_flex().absolute().bottom(10).right(14).child(h_flex().id("kc-bottom").size(28).rounded_full()
        .items_center().justify_center().border(1).border_color(t.border).bg(t.popover).shadow_md().cursor_pointer().tooltip(tr("bottom"))
        .on_click((_e, cx) => { this.follow = true; this.cur = -1; this.reveal = "bottom"; cx.notify(); })
        .child(svg(I("chevron-down")).size(14).text_color(t.muted)))));
  }

  render(cx) {
    const t = theme();
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const tg = target();
    const want = this.wanted(tg);
    if (!checking() && want !== this.loadedFor) {
      this.loadedFor = want;
      this.open.clear();
      this.shownSteps.clear();
      this.load(cx);
    }
    // The agent started or stopped working: only the last turn's live state moves (a cheap rebuild).
    const live = tg.agent?.status === "working" && !this.fixed;
    if (this.state && live !== this.builtLive && !checking()) cx.spawn(async (cx) => { this.rebuild(live); cx.notify(); });
    // The thread switched to its Chat face: take the keyboard, once per request, only when the
    // layout shows this face (a hidden copy doesn't draw anyway).
    const ask = shared("kt.chat.focus");
    if (ask && ask !== this.focusAsked && !checking()) {
      this.focusAsked = ask;
      if (chatShown(layout())) cx.spawn(async (cx) => { this.focusIn(); cx.notify(); });
    }
    const keyed = this.handle.is_focused();
    return v_flex().id("kt-chat").size_full().rounded(16).border(1).border_color(keyed ? t.accent : t.border).bg(t.background)
      .overflow_hidden().text_color(t.foreground)
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => {
        const w = size.width / (Number(settings().zoom) || 1);
        if (Math.abs(w - this.width) > 1) { this.width = w; cx.notify(); }
      })
      .child(enter(this.m, this.body(t, cx, tg, keyed), `kc-body-${want ?? "none"}`, { dy: 0 }).flex_1().min_h(0))
      .when(keyed, (el) => el.child(div().flex_none().px(14).py(6).border_t(1).border_dashed().border_color(t.border)
        .font_family(MONO).text_size(10).text_color(t.dim).child(tr("hint"))));
  }
}
