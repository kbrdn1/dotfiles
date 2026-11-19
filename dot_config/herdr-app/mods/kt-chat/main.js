// kt-chat: the thread's Claude Code transcript as a chat, in place of the terminal (#53), with
// Monocode's look (#57, #75). The agent is the shown tab's Claude agent (the focused pane's if it
// is one): when the Chat has the keyboard, focused().terminal is no longer the agent's.
//
// Data: ~/.claude/cache/statusline/herdr-<terminal>.json gives transcript_path, the model and effort
// (statusline.ts), else its session_id is looked up under ~/.claude/projects. chat-index.ts (bun, by
// exec) reads the JSONL from a byte and prints the last K turns, trimmed; chat-model.js (pure) makes
// the turns, their items and folds. render only walks built turns: nothing is parsed or grouped there.
//
// The look is Monocode Native's (github.com/hardbeat920/monocode, MIT, crates/monocode-gpui at
// 09d0443), its values read in the code, not by eye (the references are by the constants below and
// in each piece): nothing paints a background, the project's image (#57) shows behind everything;
// a reading column of 832 px; the user's bubbles on the right; the prose at 14/24; the work folded
// under « Opus 5.5 a travaillé 3m 12s » with its phases and steps; code blocks with their language,
// a copy button and line numbers; copy and the time under each answer; the composer as a card of
// radius 12 in the flow under the transcript (Monocode's isn't over it: conversation.rs:3849-3932).
// Kept from Kylian's setup: the fonts (Inter, Monaspace). Not possible in a mod: the blur behind
// the card, the transcript's edge mask.
// Attachments (#80): a prompt's images as photos above its bubble, its files as chips in it (name,
// kind, size); chat-att.ts (bun, by exec, argv) makes the thumbnails into data/kt-chat/att, a bounded
// cache swept to its own names; a click opens kt-viewer on the message's attachments.
//
// Keys (focusable): j k turns, gg G, ctrl-d ctrl-u, o / enter fold, y copy the turn's answer, r
// reread, i write, [ ] Kylian's message before / after (the timeline, #85). `kt-chat.file:<path>`
// shows that JSONL instead (tests), `file:` back; `kt-chat.tl:hover:<n>` / `tl:jump:<n>` / `tl:off`
// hover or jump to the timeline's n-th message (captures: never the focus).
//
// The timeline (#85, timeline.js): Monocode's prompt outline, a bar per message Kylian typed on the
// right edge of the transcript, the one on screen lit, a card on hover, a click or [ ] to it. No
// scroll offset is exposed: the rows report their heights, a wheel event the pointer's place.
//
// Live (#55, live()): while this face shows and the agent works, a delta (`--from end`) every TICK
// ms, plus one at each status change and on coming back on screen; nothing at rest.

import { View, div, svg, image, PathBuilder, Background } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, TextView, TextareaState, Textarea } from "gpui-base";
import { agents, focused, panes, theme, settings, shared, setShared, home, appHome, exec, hc, readTextFile, checking, nextCommand, notify, props, layout, run, openOverlay } from "herdr";
// #56: the composer (pure, composer.check.mjs); kt-threads' decide.js (a byte-identical copy, with
// decide.strings.js): what a blocked agent waits on, and its Accepter / Refuser; kt-head's view.js (a
// byte-identical copy): « Ouvrir le terminal », the thread's other face.
import { mode as sendMode, canSend, sendArgs, sendResult } from "./composer.js";
import { decide, decisionButtons } from "./decide.js";
import { view } from "./view.js";
import { ingest, prepend, build, tally, foldedSteps, trim, pendingQueue } from "./chat-model.js";
import {
  pickTarget, tallyText, firstShown, childOf, shownAfterRead, chatShown, liveStep,
  projectOf, bgSettings, bgLayers, modelName, workedFor, ink, OPACITY, CELL_SIZES, orphans, clampText,
  foldMd, noticeHead, veilRects, VEIL,
} from "./chat-view.js";
import { docOf, mdState, colorsOf, langFor, target as linkTarget } from "./markdown.js";
import { attachmentsOf, photoSize } from "./att-model.js";
// kt-keys' dither.js (a byte-identical copy): the windows that keep the background inside the corners.
import { bandWindows, ALL } from "./dither.js";
import { motionState, frame, enter } from "./motion.js";
import { TL, marks as markList, barStack, barLift, offsets, pairWheel, wheelTop, activeAt, anchorH, stepMark, ownerOf } from "./timeline.js";
import { skeleton, readyFor } from "./skeleton.js";
import { Vim, keyOf, keysOf, step } from "./vim.js";
import { makeT, duration, time, num } from "./i18n.js";
import strings from "./strings.js";
import * as fs from "fs/promises";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const CODE = "Monaspace Neon";
const K = 30; // turns read at first, and per read of « Tours précédents »
// Turns drawn, then added per « Tours précédents » (the loaded ones first, then a read): a render
// has ~50 ms, and 30 busy turns took ~40 ms to describe under herdr-app check.
const SHOW = 10;
const BUDGET = 500000; // chat-index.ts --budget: characters of JSON per read
const MAX_ENTRIES = 900; // --max-entries: JSON.parse + build() stay ~15 ms in the mod engine
const KEEP = 1200; // entries the live tail keeps (trim), whole turns, before the oldest go
// The live tail: a delta read this often, only while the Chat shows and its agent works.
const TICK = 750;
const STEPS = 6; // steps a phase shows before « N étapes de plus »
const MORE = 30; // steps each « N étapes de plus » adds
const LINES = 60; // lines a detail box shows
const CODE_FOLD = 40; // a code block's lines shown before « Afficher les N lignes » (the render's budget)
const CODE_MAX = 400; // and at most, opened
// What one render may spend on code (the ~50 ms of a mod call; 30 blocks of 40 colored lines, 8 runs
// each, were interrupted under herdr-app check): colored runs, then plain lines, then none (the block
// then says how many are left, a click shows them).
const CODE_SPANS = 600;
const CODE_ROWS = 240;
const BG = "kt.chat.backgrounds"; // shared: { [project key]: chat-view.js bgSettings }
const ATT_DIR = "data/kt-chat/att"; // #80: attachments' thumbnails and decoded images (chat-att.ts, swept there)
const sizeText = (n) => (n >= 1048576 ? tr("size.mb", { n: num(n / 1048576, 1) }) : n >= 1024 ? tr("size.kb", { n: num(n / 1024, 1) }) : tr("size.b", { n }));
const IMAGE = /\.(png|jpe?g|gif|webp|heic|heif|tiff?|bmp|avif)$/i;
const I = (name) => `mods/kt-threads/${name}.svg`;
const OWN = (name) => `mods/kt-chat/${name}.svg`;
const COPY = "mods/kt-diff/copy.svg";
const SEND = "mods/kt-crosstalk/send.svg";
const CLAUDE_ICON = "icons/claude.svg";
const SPIN = "mods/workspace-chrome/spinner.svg";
const MSG = "mods/kt-panel-head/messages-square.svg";
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;

// ── Monocode's values (crates/monocode-gpui/src, 09d0443) ───────────────────
const COLUMN = 832; // theme.rs:8, the reading column
const COLUMN_PAD = 23; // theme.rs:12, its sides (the composer's 10 + 1 + 12: prose lines up with its text)
const TOP_INSET = 20; // transcript.rs:208
const BUBBLE_MAX = 576; // transcript.rs:217, PROMPT_BUBBLE_MAX
const BUBBLE_ROW_PAD = 56; // transcript.rs:5590, the bubble's row: pl 56, justify_end
const ERR = "#f87171"; // tools.rs:436-545, an error's words
const ERR_TARGET = "#ff6467"; // its target and its cross
const WARN = "#fbbf24"; // context_meter.rs, the ring past 75 %
const FULL_ACCESS = "#ffb900e6"; // conversation.rs, « Full access » at 0.9
// The phase tiles' gradients (tab_tile.rs:465-503), drawn at their middle color. A gradient exists
// (paint_path + Background.linear_gradient, as filters.js), but not on a rounded 22×18 box: radius 5.
const TILE = { claude: "#da785a", edit: "#eb9f2e", research: "#4c8ff2", run: "#2b2b2d", agent: "#8d68ea" };
const TILE_ICON = { edit: I("square-pen"), research: I("search"), run: OWN("terminal"), agent: I("bot") };
const PERM = { default: OWN("lock"), acceptEdits: I("square-pen"), plan: I("sparkles"), bypassPermissions: OWN("shield-alert") };
// Claude Code's agent colors, on the theme's (a teammate's `color`).
const AGENT_COLOR = { red: "ansi1", green: "ansi2", yellow: "ansi3", blue: "ansi4", purple: "ansi5", magenta: "ansi5", cyan: "ansi6", pink: "ansi13", orange: "ansi11" };
const agentColor = (t, c) => (c ? t[AGENT_COLOR[c]] ?? (c.startsWith("#") ? c : null) : null) ?? t.accent;

const lines = (s) => String(s ?? "").replace(/\n+$/, "").split("\n");
// A gradient filling its parent (kt-keys viz.js's way): the veil's fade.
const RECT = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();
const paint = (path, c) => globalThis.window.paint_path(path, c).absolute().inset_0();
const hex2 = (a) => Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, "0");
const target = () => pickTarget({ focused, agents, panes });
const appPath = (p) => (p && p.startsWith(appHome() + "/") ? p.slice(appHome().length + 1) : p);

/** The answer of a turn, as the reader reads it: its prose, joined. */
const answerOf = (turn) => turn.blocks.filter((b) => b.role === "prose").map((b) => b.text.trim()).filter(Boolean).join("\n\n");
/** When the answer was written: its last prose block's time. */
const answerAt = (turn) => {
  let at = null;
  for (const b of turn.blocks) if (b.role === "prose" && b.at) at = b.at;
  return at;
};

export default class Chat extends View {
  init(_props, cx) {
    this.state = null; // chat-model's state (ingest / prepend)
    this.turns = [];
    this.builtLive = false;
    this.queued = []; // pendingQueue() of a live turn
    this.ticker = null; // the live tail's timer, only while the face shows and the agent works
    this.wasShown = false;
    this.lastStatus = undefined;
    this.err = null; // { code, path?, why? }: why the transcript isn't shown
    this.readFor = undefined; // the target the shown data was read for (skeleton.js readyFor)
    this.loadedFor = undefined;
    this.line = null; // the agent's status line (model, effort, ctx_pct), read with its transcript_path
    this.fixed = props()?.file ?? null; // a JSONL shown instead of the agent's
    this.open = new Set(); // opened: f:<turn> fold, s:<step> detail, c:<notice> summary, r:<run> report, k:<code> block
    this.shownSteps = new Map(); // phase id -> steps drawn (STEPS, then MORE at a time)
    this.cur = -1; // the turn cursor (-1: the last)
    this.show = SHOW; // turns drawn (the last ones)
    this.follow = true; // stuck to the bottom until the reader scrolls up
    this.reveal = null; // a child to bring into view after the next layout
    // The timeline (#85): Kylian's messages (timeline.js marks, made in rebuild), the scroll area's
    // rows' heights (col() id -> design px) and its own, the message lit (its id; the last while
    // following) and whether its turn starts above the view, the bar hovered and its card, a jump
    // waiting for its rows' heights (a turn id), and the half of a wheel event already in (wheel()).
    this.marks = [];
    this.hts = new Map();
    this.vh = 0;
    this.tlId = null;
    this.tlAbove = false;
    this.tlHover = -1;
    this.tlOpen = false;
    this.tlOpening = false;
    this.jump = null;
    this.wheelAt = null;
    this.width = 640;
    this.size = null; // { w, h } of this card, in design px (the background's)
    this.hover = null; // the row under the pointer, for what Monocode shows on hover
    this.copied = null; // the copy button showing its check
    this.roots = {}; // folder -> its repo's main checkout (null: no repo), git asked once per folder
    this.bgDone = new Map(); // `${src}|${cell}|${tint}` -> chat-bg.ts' { path, w, h }
    this.bgBusy = new Set();
    // #80: an attachment's key -> chat-att.ts' answer ({ thumb, w, h, bytes } | { kind, bytes } |
    // { busy } | { error }), what is waiting for it, whether its task runs, thumbnails made since a sweep.
    this.att = new Map();
    this.attQ = [];
    this.attRun = false;
    this.attMade = 0;
    this.bgMenu = false;
    this.bgNote = null; // { busy } | { err } of the last image chosen
    this.cleanDue = true; // sweepBg() at the next render: once at start, then after each setting
    this.scroll = ScrollHandle.new();
    this.md = mdState();
    this.motion = motionState();
    this.handle = cx.focus_handle();
    this.vim = new Vim();
    // ctrl-b space (kt-head's view.js) asks for the keyboard through this shared stamp (a time). One
    // older than 2 s when this copy starts is not a request; a fresh one is (the first ctrl-b space
    // starts this copy: its stamp is written just before).
    const stamp = shared("kt.chat.focus");
    this.focusAsked = stamp && Date.now() - stamp > 2000 ? stamp : null;
    // #56, the composer: its field (a TextareaState is made here, never in render), what is typed,
    // whether a send runs, its refusal or failure, and the blocked agent's request (decide.js).
    this.draft = "";
    this.typing = false;
    this.sending = false;
    this.sendErr = null; // { why, message } from composer.js sendResult
    this.decision = null; // decide(terminal) while the agent is blocked
    this.composer = TextareaState.new({ placeholder: tr("composer.ph") });
    // Monocode's field: one row of 22 px, up to 140 (input.rs:27, :407-411).
    this.composer.set_auto_grow(1, 6);
    this.composer.on("change", (_e, cx) => {
      const had = Boolean(this.draft.trim());
      this.draft = this.composer.value();
      if (this.sendErr && this.sendErr.why !== "blocked") this.sendErr = null;
      if (had !== Boolean(this.draft.trim())) cx.notify();
    });
    // Enter sends; shift-enter asks for a line break (the field may give one by itself).
    this.composer.on("submit", (e, cx) => {
      if (e?.shift) this.composer.replace("\n");
      else this.send(cx);
    });
    this.composer.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.composer.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
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
        else if (name === "background") this.bgMenu = !this.bgMenu;
        else if (name === "tl") this.tlCommand(arg);
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
    this.line = line;
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

  /**
   * Reads what is shown now: the last K turns (`delta` false), or the live tail (`delta`: what the
   * session wrote since the last read, `--from end`, appended). A delta falls back to a full read
   * when there is nothing to continue (another agent, another session's file after /clear).
   * Coalesced: one read at a time, one more after (a full one wins over a delta). A delta redraws
   * only when something came, and a failed one keeps what is shown (the next tick tries again).
   */
  load(cx, delta = false) {
    if (this.busy) {
      this.again = this.again === "full" || !delta ? "full" : "delta";
      return;
    }
    this.busy = true;
    const tg = target();
    const want = this.wanted(tg);
    const live = tg.agent?.status === "working" && !this.fixed;
    cx.spawn(async (cx) => {
      let changed = true;
      try {
        if (!want) {
          this.state = null;
          this.turns = [];
          this.err = null;
        } else {
          const path = this.fixed ?? (await this.locate(want));
          if (delta && path && this.state?.path === path && this.readFor === want) {
            changed = await this.tail(path, live);
          } else {
            const out = path ? await this.index(path) : null;
            if (!path) this.err = { code: "noSession" };
            else if (out.error === "missing") this.err = { code: "missing", path };
            else {
              this.err = null;
              this.state = ingest(null, out);
              this.rebuild(live);
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
        }
      } catch (e) {
        if (delta && this.state) changed = false;
        else {
          this.state = null;
          this.turns = [];
          this.err = { code: "failed", why: String(e?.message ?? e).slice(0, 300) };
        }
      } finally {
        this.readFor = want;
        this.busy = false;
        if (changed) cx.notify();
      }
      if (this.again) {
        const again = this.again;
        this.again = false;
        this.load(cx, again === "delta");
      }
    });
  }

  /** The live tail of `path` into the state. Answers whether anything changed (a redraw is due). */
  async tail(path, live) {
    const out = await this.index(path, ["--from", String(this.state.end)]);
    if (out.error === "missing") {
      this.err = { code: "missing", path };
      this.state = null;
      this.turns = [];
      return true;
    }
    const before = this.state;
    this.state = trim(ingest(before, out), KEEP);
    // ingest keeps the entries array when nothing came (skipped lines only), trim when under KEEP.
    const grew = this.state.entries !== before.entries;
    if (!grew && live === this.builtLive) return false; // the state still moves on to the new end
    // The cursor follows its turn by id (turns come in at the bottom, old ones go at the top); the
    // drawn window keeps its size.
    const curId = this.cur >= 0 ? this.turns[this.cur]?.id : null;
    this.rebuild(live);
    this.cur = curId ? this.turns.findIndex((t) => t.id === curId) : -1;
    if (this.follow) this.reveal = "bottom";
    return true;
  }

  rebuild(live) {
    this.builtLive = live;
    this.turns = this.state ? build(this.state.entries, { live }) : [];
    // Messages typed while it works, not taken yet: their « en file » bubbles under the live turn.
    this.queued = live && this.state ? pendingQueue(this.state.entries) : [];
    // The counts, once per build rather than on every render: the fold's, each phase's.
    for (const turn of this.turns) {
      turn.tally = turn.fold ? tally(foldedSteps(turn.items, turn.fold)) : null;
      for (const it of turn.items) if (it.type === "activity") it.tally = tally(it.steps);
    }
    // The timeline's messages, here rather than in render; the heights of turns gone (trim) go too.
    this.marks = markList(this.turns);
    const rows = new Set(this.turns.map((t) => `kc-turn-${t.id}`));
    for (const k of this.hts.keys()) if (k.startsWith("kc-turn-") && !rows.has(k)) this.hts.delete(k);
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
    // The composer has the keyboard: typing is its own; esc gives the keyboard back to the turns.
    if (this.typing) {
      if (keyOf(e).name !== "escape") return false;
      this.focusIn();
      return true;
    }
    // i: into the composer (when there is an agent to write to).
    if (keyOf(e).name === "i" && this.composerShown()) {
      this.composer.focus();
      return true;
    }
    const a = this.vim.handle(e);
    if (a === "pending" || a === "count") return true;
    const n = this.turns.length;
    const at = this.cur < 0 ? n - 1 : this.cur;
    const move = (to) => {
      this.cur = to;
      this.follow = to === n - 1;
      if (to < this.first()) this.show = n - to; // the cursor draws the turns it reaches
      this.reveal = childOf(to, this.first());
      this.jump = null; // a jump still waiting for its rows: this move wins
      // No wheel measures this scroll: the timeline lights the cursor's message.
      this.tlId = this.marks[ownerOf(this.marks, to)]?.id ?? null;
      this.tlAbove = false;
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
      // [ ] (vim.js's panel-prev / panel-next: the Chat isn't in the panel): Kylian's message before /
      // after the one on screen, a count too; back to the top of the one on screen first when it
      // starts above the view (vim's `{`).
      case "panel-prev":
      case "panel-next": {
        const to = stepMark(this.marks.length, this.tlIndex(), this.tlAbove, a === "panel-next" ? 1 : -1, this.vim.count);
        if (to >= 0) this.jumpTo(to);
        return true;
      }
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

  // ---------- the composer (#56) ----------

  /** The composer shows under the agent's transcript (not a fixed file's, not without an agent). */
  composerShown() {
    const tg = target();
    return !this.fixed && Boolean(tg.agent) && !tg.reason;
  }

  /**
   * The draft to the agent, by `hc send` (composer.js: never --force). Working, Claude Code queues it;
   * blocked, nothing goes (the request shows instead). Sent, the field empties and the live tail
   * shows it come in; refused or failed, the text stays and the reason shows under the field.
   */
  send(cx) {
    const a = target().agent;
    const can = canSend({ status: this.fixed ? null : a?.status ?? null, text: this.draft, sending: this.sending });
    if (!can.ok) {
      if (can.why === "blocked") this.sendErr = { why: "blocked" };
      cx.notify();
      return;
    }
    this.sending = true;
    this.sendErr = null;
    const text = this.draft;
    cx.spawn(async (cx) => {
      const res = sendResult(await hc(sendArgs(a.address, text)).catch((e) => (e instanceof Error ? e : new Error(String(e)))));
      this.sending = false;
      if (res.ok) {
        // Only what was sent goes (typing meanwhile stays).
        if (this.composer.value() === text) this.composer.set_value("");
        this.draft = this.composer.value();
        this.follow = true;
        this.reveal = "bottom";
        this.load(cx, true);
      } else this.sendErr = res;
      cx.notify();
    });
  }

  // The blocked agent's request (decide.js reads the bridge's cache, or the screen for a held message):
  // read when the status turns blocked, dropped when it leaves it.
  readDecision(cx, address) {
    cx.spawn(async (cx) => {
      const d = await decide(address).catch(() => null);
      if (target().agent?.address === address && target().agent?.status === "blocked") this.decision = d;
      cx.notify();
    });
  }

  // « Ouvrir le terminal »: the thread's terminal face, which gets the keyboard (view.js).
  openTerminal() {
    view("main", { layout, run, setShared, panes, focused });
  }

  // ---------- the project and its background (#57) ----------

  /** The repo's main checkout of `cwd` (git asked once per folder; null outside git). */
  rootOf(cx, cwd) {
    if (!cwd) return null;
    if (!(cwd in this.roots) && !checking()) {
      this.roots[cwd] = undefined;
      cx.spawn(async (cx) => {
        const r = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd }).catch(() => null); // i18n: tech
        const dir = r?.code === 0 ? r.stdout.trim() : "";
        this.roots[cwd] = dir ? (dir.endsWith("/.git") ? dir.slice(0, -5) : dir) : null;
        cx.notify();
      });
    }
    return this.roots[cwd] ?? null;
  }

  /**
   * The agent's project: { key, name, tint, cwd, root, branch, worktree }. key: the registry's id
   * (shared kt.projects), else the repo's main checkout, else the folder. tint: its sidebar color.
   */
  project(t, cx, tg) {
    const pane = tg.agent ? panes().find((p) => p.terminal === tg.agent.address) : null;
    const cwd = pane?.cwd ?? null;
    if (!cwd) return null;
    const root = this.rootOf(cx, cwd);
    const e = projectOf(shared("kt.projects"), cwd, root);
    const c = e?.color ?? null;
    const tint = c ? (c.startsWith("#") ? c.slice(0, 7) : String(t[c] ?? "").slice(0, 7)) : String(t.accent).slice(0, 7);
    const base = root ?? cwd;
    return {
      key: e?.id ?? `root:${base}`, name: e?.name ?? base.split("/").pop(), tint, cwd, root, branch: pane.branch ?? null,
      worktree: Boolean(root) && !(cwd === root || cwd.startsWith(root + "/")),
    };
  }

  bgOf(key) {
    return key ? bgSettings((shared(BG) ?? {})[key]) : null;
  }

  setBg(key, patch) {
    const all = { ...(shared(BG) ?? {}) };
    if (patch === null) delete all[key];
    else all[key] = { ...(all[key] ?? {}), ...patch };
    setShared(BG, all);
    this.cleanDue = true; // the next render sweeps data/kt-chat
  }

  /**
   * The disk was full once (ENOSPC): each image, cell or color tried leaves a 2048 px PNG. Once a
   * setting changes (and once when this copy starts), the files no setting refers to go, one unlink
   * each, only names chat-bg.ts writes (chat-view.js orphans()); the cache forgets them.
   */
  sweepBg(cx) {
    // Not while a texture is being made (its file exists before its setting), and never without the
    // settings themselves: an absent key could read as « nothing is referred to ».
    if (this.bgNote?.busy || this.bgBusy.size) return;
    const all = shared(BG);
    this.cleanDue = false;
    if (!all || typeof all !== "object") return;
    const dir = `${appHome()}/data/kt-chat`;
    cx.spawn(async () => {
      const names = await fs.readdir(dir).catch(() => []);
      for (const n of orphans(names, all)) {
        await fs.unlink(`${dir}/${n}`).catch(() => {});
        for (const [k, v] of this.bgDone) if (v.path?.endsWith(`/${n}`) || v.src?.endsWith(`/${n}`)) this.bgDone.delete(k);
      }
    });
  }

  /** chat-bg.ts on `src`: { src, path, w, h } or throws. */
  async dither(src, cell, tint) {
    const args = [`${appHome()}/mods/kt-chat/chat-bg.ts`, src, "--out", `${appHome()}/data/kt-chat`, "--cell", String(cell), ...(tint ? ["--tint", tint] : [])];
    const r = await exec(`${home()}/.nix-profile/bin/bun`, args, { timeout: 120000 });
    const out = JSON.parse(r.stdout || "null");
    if (!out || out.error) throw new Error(out?.message ?? out?.error ?? (r.stderr || `exit ${r.code}`).trim());
    return out;
  }

  /** The dithered texture for these settings: made once (then kept), null until it is. */
  bgImage(cx, s, tint) {
    const k = `${s.src}|${s.cell}|${tint ?? "photo"}`;
    const done = this.bgDone.get(k);
    if (done || checking() || this.bgBusy.has(k)) return done ?? null;
    this.bgBusy.add(k);
    cx.spawn(async (cx) => {
      try {
        this.bgDone.set(k, await this.dither(s.src, s.cell, tint));
      } catch (e) {
        this.bgNote = { err: String(e?.message ?? e).slice(0, 200) };
      } finally {
        this.bgBusy.delete(k);
        cx.notify();
      }
    });
    return null;
  }

  /** A chosen image (the picker, a drop) for the project: kept, resized and dithered once. */
  importBg(cx, pr, path) {
    if (!pr || !path) return;
    const s = this.bgOf(pr.key);
    const cell = s?.cell ?? 2;
    const color = s?.color ?? "photo";
    const tint = color === "project" ? pr.tint : null;
    this.bgNote = { busy: true };
    cx.spawn(async (cx) => {
      try {
        const out = await this.dither(path, cell, tint);
        this.bgDone.set(`${out.src}|${cell}|${tint ?? "photo"}`, out);
        this.setBg(pr.key, { src: out.src, w: out.w, h: out.h, cell, color, opacity: s?.opacity ?? OPACITY.dflt, scope: s?.scope ?? "all" });
        this.bgNote = null;
      } catch (e) {
        this.bgNote = { err: String(e?.message ?? e).slice(0, 200) };
      }
      cx.notify();
    });
  }

  // The system's file picker, from the app in front (Herdr): its dialog comes up over the window.
  pickBg(cx, pr) {
    const prompt = tr("bg.prompt").replace(/["\\]/g, "");
    const script = `tell application (path to frontmost application as text) to POSIX path of (choose file of type {"public.image"} with prompt "${prompt}")`; // i18n: tech
    cx.spawn(async (cx) => {
      const r = await exec("osascript", ["-e", script], { timeout: 600000 }).catch(() => null);
      const path = r?.code === 0 ? r.stdout.trim() : "";
      if (path) this.importBg(cx, pr, path);
      cx.notify();
    });
  }

  /** The background's layers (chat-view.js bgLayers) under everything, to the block's rounded edges. */
  background(t, cx, pr) {
    const s = pr ? this.bgOf(pr.key) : null;
    if (!s || !this.size || (s.scope === "empty" && this.turns.length)) return null;
    const img = this.bgImage(cx, s, s.color === "project" ? pr.tint : null);
    if (!img) return null;
    const w = Math.floor(this.size.w), h = Math.floor(this.size.h); // no border: the whole block
    if (w <= 30 || h <= 30) return null;
    const layers = bgLayers({ w, h, iw: img.w, ih: img.h, windows: bandWindows(w, h, 16, ALL), opacity: s.opacity, empty: !this.turns.length });
    const src = appPath(img.path);
    // The veil under the reading column (chat-view.js veilRects: why, and why not a lower opacity).
    const ground = `${String(t.background).slice(0, 7)}${hex2(VEIL)}`;
    const veil = veilRects({ w, h, column: COLUMN, r: 16, empty: !this.turns.length }).map((v) =>
      div().absolute().left(v.x).top(v.y).w(v.w).h(v.h)
        .when(!v.fade, (el) => el.bg(ground))
        .when(v.fade, (el) => el.child(paint(RECT(), Background.linear_gradient(180, ground, `${String(t.background).slice(0, 7)}00`)))));
    return div().absolute().top(0).left(0).w(w).h(h).children(layers.map((l) =>
      div().absolute().left(l.x).top(l.y).w(l.w).h(l.h).overflow_hidden()
        .child(image(src).absolute().left(l.ix).top(l.iy).w(l.iw).h(l.ih).opacity(l.o)))).children(veil);
  }

  // The background's settings: a small button at the top right, its panel under it.
  bgControls(t, pr) {
    if (!pr) return null;
    const s = this.bgOf(pr.key);
    const btn = h_flex().id("kc-bg-btn").absolute().top(10).right(10).size(26).items_center().justify_center().rounded(7)
      .bg(ink(t, this.bgMenu ? 0.15 : 0.06)).text_color(ink(t, this.bgMenu ? 1 : 0.5)).cursor_pointer().tooltip(tr("bg.button"))
      .hover((st) => st.bg(ink(t, 0.1)).text_color(ink(t, 1)))
      // A press outside the panel closes it, this button's too: that press must not open it again.
      .on_click((_e, cx) => { if (Date.now() - (this.bgClosedAt ?? 0) > 400) this.bgMenu = !this.bgMenu; cx.notify(); })
      .child(svg(OWN("image")).size(14));
    if (!this.bgMenu) return [btn];
    const seg = (id, options, on, pick) => h_flex().h(24).p(2).gap(2).rounded(7).bg(ink(t, 0.06)).children(options.map(([v, label]) =>
      h_flex().id(`${id}-${v}`).h(20).px(8).items_center().rounded(5).text_size(11).cursor_pointer()
        .bg(v === on ? ink(t, 0.12) : alpha(t.foreground, "00")).text_color(ink(t, v === on ? 1 : 0.55))
        .hover((st) => st.text_color(ink(t, 1)))
        .on_click((_e, cx) => { pick(v); cx.notify(); })
        .child(label)));
    const row = (label, el) => h_flex().gap(10).items_center().child(div().w(72).flex_none().text_size(11).text_color(ink(t, 0.5)).child(label)).child(el);
    const button = (id, label, onClick, color) => h_flex().id(id).h(26).px(10).gap(6).items_center().rounded(7).bg(ink(t, 0.1)).cursor_pointer()
      .text_size(12).text_color(color ?? ink(t, 1)).hover((st) => st.bg(ink(t, 0.15)))
      .on_click((_e, cx) => { onClick(cx); cx.notify(); })
      .child(label);
    const pct = s ? Math.round(s.opacity * 100) : 0;
    const nudge = (d) => this.setBg(pr.key, { opacity: Math.round(Math.min(OPACITY.max, Math.max(OPACITY.min, s.opacity + d)) * 100) / 100 });
    const panel = v_flex().id("kc-bg-panel").absolute().top(42).right(10).w(280).p(12).gap(10).rounded(12).border(1).border_color(ink(t, 0.1))
      .bg(t.popover).shadow_lg()
      .on_mouse_down_out((_e, cx) => { this.bgMenu = false; this.bgClosedAt = Date.now(); cx.notify(); })
      .child(div().text_size(12).font_semibold().text_color(ink(t, 1)).child(tr("bg.title", { project: pr.name })))
      .child(h_flex().gap(8).items_center().child(button("kc-bg-pick", tr("bg.pick"), (cx) => this.pickBg(cx, pr)))
        .when(Boolean(this.bgNote?.busy), (el) => el.child(svg(SPIN).size(12).text_color(t.working).spin(900))))
      .child(div().text_size(11).text_color(ink(t, 0.45)).child(tr("bg.drop")))
      .when(Boolean(this.bgNote?.err), (el) => el.child(div().text_size(11).text_color(ERR).child(tr("bg.failed", { why: this.bgNote.err }))))
      .when(Boolean(s), (el) => el
        .child(row(tr("bg.color"), seg("kc-bg-color", [["photo", tr("bg.photo")], ["project", tr("bg.project")]], s.color, (v) => this.setBg(pr.key, { color: v }))))
        .child(row(tr("bg.cell"), seg("kc-bg-cell", CELL_SIZES.map((c) => [c, `${c} px`]), s.cell, (v) => this.setBg(pr.key, { cell: v }))))
        .child(row(tr("bg.opacity"), h_flex().gap(4).items_center()
          .child(button("kc-bg-less", "−", () => nudge(-OPACITY.step))) // i18n: tech
          .child(div().w(44).text_size(12).text_color(ink(t, 1)).flex().justify_center().child(`${pct} %`))
          .child(button("kc-bg-more", "+", () => nudge(OPACITY.step))))) // i18n: tech
        .child(row(tr("bg.scope"), seg("kc-bg-scope", [["all", tr("bg.all")], ["empty", tr("bg.empty")]], s.scope, (v) => this.setBg(pr.key, { scope: v }))))
        .child(button("kc-bg-remove", tr("bg.remove"), () => this.setBg(pr.key, null), ERR)));
    return [btn, panel];
  }

  // ---------- the timeline (#85, timeline.js) ----------

  zoom() {
    return Number(settings().zoom) || 1;
  }

  /** The message lit: the last while following the bottom, else the one measured or jumped to. */
  tlIndex() {
    const n = this.marks.length;
    if (!n) return -1;
    if (this.follow) return n - 1;
    const k = this.marks.findIndex((m) => m.id === this.tlId);
    return k < 0 ? n - 1 : k;
  }

  /**
   * To the k-th message: its turn drawn (as the cursor does), the cursor on it, then its top at the
   * view's top once its rows are measured (body(): the anchor). A note goes to its turn's top.
   */
  jumpTo(k) {
    const m = this.marks[k];
    if (!m) return;
    this.cur = m.i;
    this.follow = false;
    if (m.i < this.first()) this.show = this.turns.length - m.i;
    this.jump = m.turn;
    this.reveal = null;
    this.tlId = m.id;
    this.tlAbove = false;
  }

  /** `tl:hover:<n>` (its card open, no delay), `tl:jump:<n>`, `tl:off`: the captures' pointer. */
  tlCommand(arg) {
    const [what, at] = String(arg).split(":");
    const k = Number(at);
    if (what === "off") {
      this.tlHover = -1;
      this.tlOpen = false;
    } else if (Number.isInteger(k) && k >= 0 && k < this.marks.length) {
      if (what === "hover") {
        this.tlHover = k;
        this.tlOpen = true;
      } else if (what === "jump") this.jumpTo(k);
    }
  }

  // The pointer on a bar: the ripple follows at once, the card waits out a pass-through (OPEN, one
  // timer per entry on the rail).
  hoverMark(cx, k) {
    if (this.tlHover === k) return;
    this.tlHover = k;
    cx.notify();
    if (this.tlOpen || this.tlOpening) return;
    this.tlOpening = true;
    cx.timer.after(TL.OPEN, (cx) => {
      this.tlOpening = false;
      if (this.tlHover >= 0 && !this.tlOpen) {
        this.tlOpen = true;
        cx.notify();
      }
    });
  }

  closeCard(cx) {
    if (this.tlHover < 0 && !this.tlOpen) return;
    this.tlHover = -1;
    this.tlOpen = false;
    cx.notify();
  }

  /** A row's height (design px). A redraw only when a jump waits for it. */
  measured(id, size, cx) {
    const h = size.height / this.zoom();
    if (Math.abs((this.hts.get(id) ?? -9) - h) < 0.5) return;
    this.hts.set(id, h);
    if (this.jump != null) cx.notify();
  }

  /** The scroll area's rows, top to bottom (as body() draws them): { tops: turn id -> top, at: row id -> top, end, known }. */
  geom() {
    const turns = this.turns.slice(this.first());
    const ids = ["kc-head", ...turns.map((t) => `kc-turn-${t.id}`), ...(this.builtLive ? ["kc-working"] : [])];
    // The end mark: 1 px, never measured.
    const o = offsets([...ids.map((id) => this.hts.get(id)), 1], TOP_INSET);
    const at = new Map(ids.map((id, k) => [id, o.tops[k]]));
    return { at, tops: new Map(turns.map((t) => [t.id, at.get(`kc-turn-${t.id}`)])), end: o.end, known: o.known };
  }

  /**
   * One wheel event reaches the row under the pointer (`row`: its id) and the scroll area (`row`
   * null), in either order (timeline.js pairWheel): once both halves are in, the offset it leaves, then
   * the message on screen; a redraw only when that changes.
   */
  wheel(cx, row, ev) {
    if (!ev.local_position) return;
    const { keep, pair: w } = pairWheel(this.wheelAt, { row, px: ev.position.x, py: ev.position.y, y: ev.local_position.y, dy: ev.delta.y });
    this.wheelAt = keep;
    if (!w || !this.marks.length || this.vh <= 0) return;
    const g = this.geom();
    if (!g.known || !g.at.has(w.id)) return;
    const z = this.zoom();
    // The area's padding (TOP_INSET above, 8 under) is part of what scrolls.
    const scrollTop = wheelTop({ top: g.at.get(w.id), inRow: w.inRow / z, inView: w.inView / z, dy: w.dy / z, max: g.end + 8 - this.vh });
    const cur = this.follow ? -1 : this.marks.findIndex((m) => m.id === this.tlId);
    const r = activeAt({ marks: this.marks, tops: g.tops, first: this.first(), scrollTop, vh: this.vh, end: g.end + 8, follow: this.follow, cur });
    const id = this.marks[r.k]?.id ?? null;
    if (id !== this.tlId || r.above !== this.tlAbove) {
      this.tlId = id;
      this.tlAbove = r.above;
      cx.notify();
    }
  }

  /**
   * outline.rs:165-333: the rail, 16 px from the right edge, centred; a bar per message (2 high, 11
   * wide, 24 lifted under the pointer and its neighbours less, ink 0.15, 0.85 lit), in a stack that
   * fits min(330, 75 % of the view); the card at its left (288, padding 12, radius 12, 14/19.25, two
   * lines). Hidden under 928 px or two messages.
   */
  rail(t) {
    const list = this.marks, n = list.length;
    if (n < TL.MIN || this.width < TL.MIN_W || this.vh <= 0) return null;
    const active = this.tlIndex();
    const { start, end, gap } = barStack(n, active, Math.min(TL.STACK_MAX, Math.floor(this.vh * TL.SHARE)));
    const hov = this.tlHover >= start && this.tlHover < end ? this.tlHover : -1;
    const row = TL.BAR_H + gap;
    const bars = [];
    for (let k = start; k < end; k++) {
      const m = list[k];
      const lit = hov >= 0 ? k === hov : k === active;
      // The wave reaches the outer bars a beat after the hovered one; back at rest, all at once.
      const p = { duration: TL.MS, delay: hov >= 0 ? Math.min(Math.abs(k - hov), TL.RIPPLE) * TL.STEP : 0, easing: "ease-out" };
      let bar = div().id(`kc-tlb-${m.id}`).h(TL.BAR_H).w(TL.BAR_W + (TL.BAR_LIFT - TL.BAR_W) * barLift(k, hov)).rounded_full()
        .bg(ink(t, 1)).opacity(lit ? TL.LIT : TL.IDLE);
      if (!this.m.reduced) bar = bar.transition("width", p).transition("opacity", p);
      bars.push(h_flex().id(`kc-tl-${m.id}`).w_full().h(row).flex_none().items_center().justify_end().cursor_pointer()
        .on_hover((h, cx) => { if (h) this.hoverMark(cx, k); })
        .on_click((_e, cx) => { this.jumpTo(k); cx.notify(); })
        .child(bar));
    }
    let card = null;
    if (this.tlOpen && hov >= 0) {
      const m = list[hov];
      const text = clampText(m.text || (m.images ? tr("images", { n: m.images }) : tr("tl.empty")), { lines: 2, cols: TL.CARD_COLS }).text;
      // Centred on its bar, whatever its height (one line or two): a band around it that centres it.
      const mid = (hov - start) * row + row / 2;
      card = h_flex().absolute().right(TL.BAR_LIFT + TL.CARD_GAP).top(mid - 60).h(120).items_center()
        .child(enter(this.m, div().w(TL.CARD_W).p(TL.CARD_PAD).rounded(12).border(1).border_color(ink(t, 0.1)).bg(t.popover).shadow_lg()
          .child(div().max_h(TL.CARD_LINE * 2).overflow_hidden().text_size(14).line_height(`${TL.CARD_LINE}px`).text_color(ink(t, 1)).child(text)), "kc-tl-card", { dy: 0 }));
    }
    return h_flex().absolute().top(0).bottom(0).right(TL.RIGHT).items_center()
      .child(v_flex().id("kc-tl").relative().w(TL.BAR_LIFT).items_end()
        .on_hover((h, cx) => { if (!h) this.closeCard(cx); })
        .children(bars)
        .when(Boolean(card), (el) => el.child(card)));
  }

  // ---------- pieces (Monocode's values) ----------

  toggle(id) {
    if (this.open.has(id)) this.open.delete(id);
    else this.open.add(id);
  }

  /**
   * Wraps a row of the scroll area in the reading column: centred, COLUMN wide at most. The timeline
   * (#85) learns its height, and the pointer's place in it under a wheel event (wheel()).
   */
  col(el, id) {
    return h_flex().id(id).w_full().flex_none().justify_center()
      .on_size_change((size, cx) => this.measured(id, size, cx))
      .on_scroll_wheel((ev, cx) => this.wheel(cx, id, ev))
      .child(v_flex().w_full().max_w(COLUMN).px(COLUMN_PAD).min_w(0).child(el));
  }

  setHover(cx, id, on) {
    const next = on ? id : this.hover === id ? null : this.hover;
    if (next !== this.hover) {
      this.hover = next;
      cx.notify();
    }
  }

  /** Copies, then shows the check for `ms` (a one-shot timer, ANIMATIONS.md). */
  copy(cx, id, text, ms) {
    cx.write_to_clipboard(text);
    this.copied = id;
    cx.timer.after(ms, (cx) => {
      if (this.copied === id) {
        this.copied = null;
        cx.notify();
      }
    });
  }

  // theme.rs:547-577 icon_button / transcript.rs:2165-2455: 22×22 (24 for code), radius 6, icon 14,
  // ink 0.4 at rest, 0.7 on a 0.08 ground when hovered.
  iconBtn(t, id, icon, tip, onClick, size = 22) {
    return h_flex().id(id).size(size).flex_none().items_center().justify_center().rounded(6).cursor_pointer()
      .text_color(ink(t, 0.4)).hover((s) => s.bg(ink(t, 0.08)).text_color(ink(t, 0.7))).tooltip(tip)
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); cx.notify(); })
      .child(svg(icon).size(14));
  }

  label(t, text, a = 0.4) {
    return div().text_size(12).line_height("16px").text_color(ink(t, a)).child(text);
  }

  // A detail box's text: one div per line (a line wraps), the last LINES of them, mono 12/20.
  mono(t, text, color) {
    const all = lines(text);
    const shown = all.length > LINES ? all.slice(-LINES) : all;
    return v_flex().min_w(0).font_family(CODE).text_size(12).line_height("20px").text_color(color ?? ink(t, 0.6))
      .children(shown.map((l) => div().min_w(0).child(l || " ")));
  }

  // tab_tile.rs:465-469: a 22×18 tile, radius 5, its glyph white at 12 px.
  tile(t, color, icon, spin = false) {
    const glyph = svg(spin ? SPIN : icon).size(12).text_color(color ? "#ffffff" : ink(t, 0.7));
    return h_flex().w(22).h(18).flex_none().rounded(5).items_center().justify_center()
      .bg(color ?? ink(t, 0.12)).child(spin ? glyph.spin(900) : glyph);
  }

  stateMark(t, state, id) {
    const mark = (icon, color, tip) => div().id(`kc-sm-${id}`).flex_none().tooltip(tip).child(svg(icon).size(14).text_color(color));
    if (state === "running") return svg(SPIN).size(12).flex_none().text_color(t.working).spin(900);
    if (state === "error") return mark(I("x"), ERR_TARGET, tr("state.error"));
    if (state === "stopped") return mark(I("x"), ink(t, 0.35), tr("state.stopped"));
    return null;
  }

  // A step's detail, opened by a click: the command and its output, the diff, the lines read, the
  // report. Monocode shows only an error's text there; this keeps the rest, on its code surface.
  detail(t, b) {
    const r = b.result;
    const out = [];
    const section = (title, el) => out.push(v_flex().gap(3).min_w(0).child(this.label(t, title, 0.45)).child(el));
    const i = b.input ?? {};
    if (b.kind === "execute") {
      if (i.command) section(tr("detail.command"), this.mono(t, i.command, ink(t, 0.8)));
      if (r) section(tr("detail.output"), r.text ? this.mono(t, r.text, r.ok ? ink(t, 0.6) : ERR) : this.label(t, tr("detail.noOutput")));
      if (r?.interrupted) out.push(this.label(t, tr("detail.interrupted")));
      if (r?.background || i.background) out.push(this.label(t, tr("detail.background")));
    } else if (b.kind === "edit" && r?.diff) {
      if (r.create) out.push(this.label(t, tr("detail.created", { n: r.lines ?? 0 })));
      const rows = [];
      for (const h of r.diff) for (const l of h.lines) rows.push(l);
      if (rows.length) {
        out.push(v_flex().min_w(0).font_family(CODE).text_size(12).line_height("20px").children(rows.slice(0, LINES * 2).map((l) => {
          const c = l[0] === "+" ? t.ansi2 : l[0] === "-" ? ERR : null;
          return div().min_w(0).px(4).rounded(3).text_color(c ?? ink(t, 0.6)).when(Boolean(c), (el) => el.bg(alpha(c, "1a"))).child(l || " ");
        })));
      }
      if (r.diff.some((h) => h.cut) || rows.length > LINES * 2) out.push(this.label(t, tr("detail.diffCut")));
    } else if (b.kind === "read" && r?.file) {
      out.push(this.label(t, r.file.image ? tr("detail.image") : tr("detail.lines", { a: r.file.start ?? 1, b: (r.file.start ?? 1) + Math.max(0, (r.file.lines ?? 1) - 1), n: r.file.total ?? r.file.lines ?? 0 })));
    } else {
      const input = i.command ?? i.pattern ?? i.prompt ?? (i.todos ? i.todos.map((x) => `${x.status === "completed" ? "[x]" : "[ ]"} ${x.text}`).join("\n") : null) ?? i.json ?? (i.skill ? [i.skill, i.args].filter(Boolean).join(" ") : null);
      if (input) section(tr("detail.input"), this.mono(t, input, ink(t, 0.8)));
      if (r?.text) section(b.kind === "agent" ? tr("detail.report") : tr("detail.output"), this.mono(t, r.text, r.ok ? ink(t, 0.6) : ERR));
    }
    if (r && r.size > (r.text?.length ?? 0) + 1 && r.text) out.push(this.label(t, tr("detail.cut", { n: num(r.size) })));
    if (!out.length) return null;
    return v_flex().mt(2).mb(8).px(10).py(8).gap(6).min_w(0).rounded(10).border(1).border_color(ink(t, 0.1)).bg(ink(t, 0.06)).children(out);
  }

  // tools.rs:233-435: a step's row, 28 px (py 4, line 20), gap 6: the verb (the tool's name) at
  // 14 px ink 0.5, its target in mono 12 ink 0.7, a file in a pill (radius 4, px 4, ground 0.06).
  // A command has no verb: the command is the target. An error: #f87171 / #ff6467 and a cross.
  step(t, b) {
    if (b.role === "thinking") {
      // transcript.rs:5144-5183: the « minus » icon, then « Réflexion · 4 s » (its text a click away).
      const has = Boolean(b.text?.trim());
      const id = `s:${b.id}`;
      const el = h_flex().id(`kc-st-${b.id}`).py(4).gap(6).items_center().min_w(0).text_size(14).line_height("20px").text_color(ink(t, 0.5))
        .when(has, (el) => el.cursor_pointer().hover((s) => s.text_color(ink(t, 0.8))).on_click((_e, cx) => { this.toggle(id); cx.notify(); }))
        .child(svg(I("minus")).size(14).flex_none())
        .child(div().flex_1().min_w(0).truncate().child(b.ms ? tr("think.ms", { d: duration(b.ms) }) : tr("think")));
      return has && this.open.has(id) ? v_flex().min_w(0).child(el).child(div().pl(20).pb(8).child(this.mono(t, b.text, ink(t, 0.48)))) : el;
    }
    if (b.role === "note") {
      return h_flex().id(`kc-st-${b.id}`).py(4).gap(6).items_center().min_w(0).text_size(14).line_height("20px")
        .child(svg(MSG).size(14).flex_none().text_color(ink(t, 0.45)))
        .child(div().flex_1().min_w(0).truncate().text_color(ink(t, 0.6)).child(lines(b.text)[0] || " "));
    }
    const id = `s:${b.id}`;
    const err = b.state === "error";
    const verb = b.kind === "execute" ? null : b.name;
    const text = b.title || (verb ? "" : b.name);
    const pill = b.kind === "read" || b.kind === "edit" || b.kind === "execute";
    const tgt = div().min_w(0).truncate().font_family(CODE).text_size(12).text_color(err ? ERR_TARGET : ink(t, 0.7))
      .when(pill, (el) => el.px(4).rounded(4).bg(ink(t, 0.06)))
      .child(text || " ");
    const row = h_flex().id(`kc-st-${b.id}`).py(4).gap(6).items_center().min_w(0).cursor_pointer().line_height("20px")
      .hover((s) => s.text_color(ink(t, 0.8)))
      .on_click((_e, cx) => { this.toggle(id); cx.notify(); })
      .when(Boolean(verb), (el) => el.child(div().flex_none().text_size(14).text_color(err ? ERR : ink(t, 0.5)).child(verb))) // i18n: tech
      .when(Boolean(text), (el) => el.child(tgt))
      .child(div().flex_1())
      .when(Boolean(this.stateMark(t, b.state, b.id)), (el) => el.child(this.stateMark(t, b.state, b.id)));
    const d = this.open.has(id) ? this.detail(t, b) : null;
    return d ? v_flex().min_w(0).child(row).child(d) : row;
  }

  // transcript.rs:5007-5086 + activity.rs: a phase, the tile at its dominant kind's color and what the
  // calls add up to (« 3 lectures · 2 modifs »), then its steps under a 1 px rail (x = 10.5), indented
  // 30. Thinking alone is its own rows, no header. The last STEPS steps, MORE at a time above.
  activity(t, item, live) {
    const c = item.tally ?? tally(item.steps);
    const n = Math.min(item.steps.length, this.shownSteps.get(item.id) ?? STEPS);
    const hidden = item.steps.length - n;
    const steps = hidden ? item.steps.slice(-n) : item.steps;
    const more = (id, icon, text, to) => h_flex().id(id).py(2).gap(6).items_center().cursor_pointer()
      .text_size(12).text_color(ink(t, 0.45)).hover((s) => s.text_color(ink(t, 0.8)))
      .on_click((_e, cx) => { this.shownSteps.set(item.id, to); cx.notify(); })
      .child(svg(I(icon)).size(12)).child(text);
    const rows = v_flex().min_w(0)
      .when(hidden > 0, (el) => el.child(more(`kc-more-${item.id}`, "chevron-up", tr("steps.more", { n: hidden }), n + MORE)))
      .when(n > STEPS, (el) => el.child(more(`kc-less-${item.id}`, "chevron-down", tr("steps.less"), STEPS)))
      .children(steps.map((b) => this.step(t, b)));
    if (!c.order.length && !c.notes) return rows; // thinking only
    const running = live && item.steps.some((b) => b.state === "running");
    const words = tallyText(c, tr);
    return v_flex().min_w(0)
      .child(h_flex().py(4).gap(8).items_center().min_w(0)
        .child(this.tile(t, TILE[c.kind] ?? null, TILE_ICON[c.kind] ?? OWN("wrench"), running))
        .child(div().flex_1().min_w(0).truncate().text_size(14).line_height("20px").text_color(ink(t, 0.5))
          .when(running, (el) => el.loop("opacity", { from: 0.55, to: 1, period: 1600 }))
          .child(words || " ")))
      .child(div().relative().pl(30).min_w(0)
        .child(div().absolute().left(10).top(0).bottom(6).w(1).bg(ink(t, 0.14)))
        .child(rows));
  }

  // transcript/tasks.rs:358-549: a sub-agent's row, py 4 px 6, radius 6, a 0.08 ground when hovered or
  // open: its mark in its color, its name at ink 0.75, model and state at 12 ink 0.4, a chevron.
  subagents(t, item) {
    return v_flex().min_w(0).children(item.runs.map((b) => {
      const a = b.result?.agent ?? {};
      const c = agentColor(t, a.color);
      const id = `r:${b.id}`;
      const open = this.open.has(id);
      const name = a.name || b.input?.name || b.input?.description || b.title || b.name;
      const sub = [b.input?.type ?? a.type, a.model, tr(`sub.${b.state ?? "running"}`)].filter(Boolean).join(" · ");
      const head = h_flex().id(`kc-sub-${b.id}`).ml(-6).px(6).py(4).gap(8).items_center().min_w(0).rounded(6).cursor_pointer()
        .text_size(14).line_height("20px").when(open, (el) => el.bg(ink(t, 0.08))).hover((s) => s.bg(ink(t, 0.08)))
        .on_click((_e, cx) => { this.toggle(id); cx.notify(); })
        .child(svg(I("bot")).size(14).flex_none().text_color(c))
        .child(div().flex_none().max_w(260).truncate().text_color(b.state === "error" ? ERR : ink(t, 0.75))
          .when(b.state === "running", (el) => el.loop("opacity", { from: 0.55, to: 1, period: 1600 })).child(name))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(ink(t, 0.4)).child(sub))
        .child(svg(I(open ? "chevron-down" : "chevron-right")).size(14).flex_none().text_color(ink(t, 0.35)));
      return open && b.result?.text
        ? v_flex().min_w(0).child(head).child(div().relative().pl(20).pb(8)
          .child(div().absolute().left(6).top(0).bottom(8).w(1).bg(ink(t, 0.14))).child(this.mono(t, b.result.text)))
        : head;
    }));
  }

  // tools.rs:84-136: a milestone (compaction, interruption, a background task): an icon of 14 at ink
  // 0.45, its words at 0.55, gap 8, py 4, line 20.
  milestone(t, id, icon, text, { color, onClick } = {}) {
    return h_flex().id(id).py(4).gap(8).items_center().min_w(0).text_size(14).line_height("20px")
      .when(Boolean(onClick), (el) => el.cursor_pointer().hover((s) => s.text_color(ink(t, 0.8))).on_click((_e, cx) => { onClick(); cx.notify(); }))
      .child(svg(icon).size(14).flex_none().text_color(color ?? ink(t, 0.45)))
      .child(div().flex_1().min_w(0).truncate().text_color(color ?? ink(t, 0.55)).child(text));
  }

  notice(t, b) {
    if (b.kind === "compact") {
      const id = `c:${b.id}`;
      const opened = this.open.has(id);
      const head = [b.trigger === "auto" ? tr("notice.compactAuto") : tr("notice.compact"), b.tokens ? tr("notice.tokens", { n: num(b.tokens) }) : null].filter(Boolean).join(" · ");
      const row = this.milestone(t, `kc-cp-${b.id}`, I("check"), head, { onClick: b.text ? () => this.toggle(id) : null });
      return opened && b.text
        ? v_flex().min_w(0).child(row).child(div().pl(22).pb(8).text_size(14).line_height("24px").text_color(ink(t, 0.48))
          .child(TextView.markdown(`kc-sum-${b.id}`, b.text).selectable(true)))
        : row;
    }
    if (b.kind === "interrupt") return this.milestone(t, `kc-in-${b.id}`, I("x"), tr("notice.interrupt"));
    // transcript.rs:5288-5292: an error is its text in #f87171, 14/24, no bubble.
    if (b.kind === "error") {
      return div().py(4).text_size(14).line_height("24px").text_color(ERR)
        .child([tr("notice.error"), b.code].filter(Boolean).join(" · ") + (b.text ? ` : ${b.text}` : ""));
    }
    if (b.kind === "task") return this.noticeCard(t, b.id, { kind: "task", status: b.status, task: b.task ?? null }, b.text);
    if (b.kind === "command") {
      return v_flex().my(4).px(10).py(8).gap(4).min_w(0).rounded(10).border(1).border_color(ink(t, 0.1)).bg(ink(t, 0.06))
        .child(this.label(t, tr("notice.command"), 0.45))
        .child(this.mono(t, b.text));
    }
    return null;
  }

  // A notice from elsewhere (another agent, another session, a task) or a message Kylian sent while
  // the agent worked (Kylian, 2026-11-19): a discreet surface, so the background's cells never run
  // through its words (ink 0.05, border 0.08, radius 10), a 2 px edge in the sender's color, its header
  // (the dot, who and what happened: chat-view.js noticeHead, the count of what came together), its
  // body in markdown folded on its SOURCE (foldMd: never inside a `**`), « Afficher plus » as a link
  // aligned with it, and clear space under it before the answer. `from` null: Kylian's own message.
  noticeCard(t, id, from, text) {
    const head = noticeHead(from);
    const label = tr(head.key, { ...head.vars, name: head.vars.name || tr("anAgent") });
    const failed = from?.kind === "task" && head.key.startsWith("head.taskFailed");
    const color = !from ? ink(t, 0.3) : from.kind === "task" ? (failed ? ERR : ink(t, 0.35)) : agentColor(t, from.color);
    const open = this.open.has(`o:${id}`);
    const body = String(text ?? "").trim();
    const folded = body ? foldMd(body) : null;
    const shown = !body ? null : open || !folded.cut ? body : folded.text;
    return v_flex().id(`kc-nc-${id}`).relative().mt(8).mb(20).pl(14).pr(12).py(10).gap(6).min_w(0).overflow_hidden()
      .rounded(10).border(1).border_color(ink(t, 0.08)).bg(ink(t, 0.05))
      .child(div().absolute().left(0).top(8).bottom(8).w(2).rounded(1).bg(color))
      .child(h_flex().gap(6).items_center().min_w(0)
        .when(from?.kind === "task", (el) => el.child(svg(I(failed ? "circle-alert" : "check")).size(12).flex_none().text_color(color)))
        .when(from?.kind !== "task", (el) => el.child(div().size(6).flex_none().rounded_full().bg(color)))
        .child(div().min_w(0).truncate().text_size(12).line_height("16px").text_color(ink(t, 0.6)).child(label))
        .when((from?.count ?? 1) > 1, (el) => el.child(div().flex_none().h(16).px(6).flex().items_center().rounded_full()
          .bg(ink(t, 0.08)).text_size(10.5).text_color(ink(t, 0.6)).child(String(from.count)))))
      .when(Boolean(shown), (el) => el.child(div().min_w(0).overflow_hidden().text_size(13).line_height("20px").text_color(ink(t, 0.78))
        .child(TextView.markdown(`kc-nb-${id}${open ? "-all" : ""}`, shown).selectable(true))))
      .when(Boolean(folded?.cut), (el) => el.child(this.moreLink(t, `kc-nm-${id}`, open, () => this.toggle(`o:${id}`))));
  }

  /** An entry from elsewhere: one card per sender when several followed one another (classify's groups). */
  notices(t, id, e) {
    if (e.groups?.length > 1) return v_flex().min_w(0).children(e.groups.map((g, i) => this.noticeCard(t, `${id}-${i}`, g, g.text)));
    return this.noticeCard(t, id, e.from ?? null, e.text);
  }

  // « Afficher plus » under a notice: a link aligned with its words, 12/16 at 0.6 (transcript.rs:5411-5434's
  // words and size), a chevron after it, no pill (Kylian, 2026-11-19).
  moreLink(t, id, open, onClick) {
    return h_flex().child(h_flex().id(id).gap(4).items_center().text_size(12).line_height("16px").text_color(ink(t, 0.6))
      .cursor_pointer().hover((s) => s.text_color(ink(t, 1)))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(); cx.notify(); })
      .child(open ? tr("showLess") : tr("showMore"))
      .child(svg(I(open ? "chevron-up" : "chevron-down")).size(12)));
  }

  // transcript.rs:5411-5434, « Show more » / « Show less »: 12/16 at 0.6, a 0.08 ground when hovered,
  // radius 4, px 4, py 2, mt 4.
  more(t, id, open, onClick) {
    return h_flex().child(div().id(id).mt(4).px(4).py(2).rounded(4).text_size(12).line_height("16px").text_color(ink(t, 0.6))
      .cursor_pointer().hover((s) => s.bg(ink(t, 0.08)).text_color(ink(t, 1)))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(); cx.notify(); })
      .child(open ? tr("showLess") : tr("showMore")));
  }

  /**
   * markdown.rs:884-975 + transcript.rs:4455-4614, a code block: ground 0.06, border 0.1, radius 10;
   * its header (36 px, px 10, gap 8: the language as written in 12 px at 0.65, then copy) when the fence
   * has one, else copy at the top right; line numbers (24 px, right, 10 px at 0.35, 8 to the code);
   * the code in mono 12/20, py 10, pr 8, scrolled sideways, never wrapped. CODE_FOLD lines, then a
   * click for the rest (CODE_MAX): the render has ~50 ms.
   */
  codeBlock(t, cx, key, s) {
    const rows = s.text.split("\n");
    const colors = colorsOf(this.md, cx, "kt-chat", s.text, langFor(s.lang), s.hash);
    const all = this.open.has(`k:${key}`);
    const shown = rows.slice(0, all ? CODE_MAX : CODE_FOLD);
    const copied = this.copied === `c:${key}`;
    const copy = this.iconBtn(t, `kc-cc-${key}`, copied ? I("check") : COPY, copied ? tr("copiedCode") : tr("copyCode"), (cx) => this.copy(cx, `c:${key}`, s.text, 1500), 24);
    // The render's budget (body()): colored lines while spans last, plain past them; no line past rows.
    const budget = this.budget ?? { spans: CODE_SPANS, rows: CODE_ROWS };
    const runsAt = (i) => (Array.isArray(colors) && Array.isArray(colors[i]) && colors[i].length ? colors[i] : null);
    const span = ([text, color, style]) => {
      let el = div().flex_none();
      if (color) el = el.text_color(color);
      if (style & 1) el = el.italic();
      if (style & 2) el = el.font_weight(700);
      return el.child(text || " ");
    };
    const drawn = [];
    for (let i = 0; i < shown.length && budget.rows > 0; i++, budget.rows--) {
      const r = runsAt(i);
      if (r && r.length > 1 && budget.spans >= r.length) {
        budget.spans -= r.length;
        drawn.push(h_flex().h(20).whitespace_nowrap().children(r.map(span)));
      } else drawn.push(span(r && r.length === 1 && budget.spans > 0 ? r[0] : [shown[i], null, 0]).h(20).whitespace_nowrap());
    }
    const code = v_flex().flex_none().children(drawn);
    const nums = v_flex().w(24).mr(8).flex_none().items_end().text_size(10).text_color(ink(t, 0.35))
      .children(drawn.map((_, i) => div().h(20).flex().items_center().child(String(i + 1))));
    const body = h_flex().items_start().py(10).pr(8).min_w(0).font_family(CODE).text_size(12).line_height("20px").text_color(ink(t, 0.85))
      .child(nums)
      .child(div().id(`kc-code-${key}`).flex_1().min_w(0).overflow_x_scroll().child(code));
    const left = rows.length - drawn.length;
    return v_flex().relative().w_full().min_w(0).rounded(10).border(1).border_color(ink(t, 0.1)).bg(ink(t, 0.06)).overflow_hidden()
      .when(Boolean(s.lang), (el) => el.child(h_flex().min_h(36).px(10).gap(8).items_center().border_b(1).border_color(ink(t, 0.1))
        .child(svg(I("file-text")).size(14).text_color(ink(t, 0.65)))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(ink(t, 0.65)).child(s.lang))
        .child(copy)))
      .child(body)
      .when(!s.lang, (el) => el.child(div().absolute().top(6).right(6).child(copy)))
      .when(left > 0 || all, (el) => el.child(h_flex().id(`kc-cm-${key}`).px(10).pb(8).gap(6).items_center().cursor_pointer()
        .text_size(12).text_color(ink(t, 0.45)).hover((st) => st.text_color(ink(t, 0.8)))
        .on_click((_e, cx) => { this.toggle(`k:${key}`); cx.notify(); })
        .child(all ? tr("code.less") : tr("code.more", { n: rows.length }))));
  }

  /**
   * The agent's prose, cut where code blocks go (markdown.js parse(), no frontmatter): its text at
   * 14/24, ink 0.78 (markdown.rs:54-67, :739-743); 16 px between blocks (:215-222); 12 above the first
   * one of a message, 4 right under « a travaillé » (transcript.rs:5220-5221). A > [!NOTE] is a quote:
   * a 4 px rule at 0.2, 16 to the text.
   */
  prose(t, cx, b, top) {
    const doc = docOf(this.md, b.text, { meta: false });
    const md = (k, text) => TextView.markdown(`kc-md-${b.id}#${k}`, text).selectable(true).on_link_click((url) => this.link(url));
    return v_flex().w_full().min_w(0).overflow_hidden().pt(top).gap(16).text_size(14).line_height("24px").text_color(ink(t, 0.78))
      .children(doc.segs.map((s, k) => (s.kind === "code" ? this.codeBlock(t, cx, `${b.id}#${k}`, s)
        : s.kind === "alert" ? div().ml(4).pl(16).border_l(4).border_color(ink(t, 0.2)).child(md(k, s.text))
          : md(k, s.text))));
  }

  // A web link opens in the browser; a path in the prose is left alone (no viewer chosen yet).
  link(url) {
    const to = linkTarget(url, this.state?.meta?.cwd ?? null);
    if (to?.web) exec("open", [to.web]).catch(() => {});
  }

  // transcript.rs:2165-2455 + response_actions.rs: under the answer, always shown: copy (a check for
  // 2 s), a 3 px dot at 0.25 and the time at 0.35; pt 4, pb 12, gap 10, 12/16.
  actions(t, turn) {
    const answer = answerOf(turn);
    const at = answerAt(turn);
    const id = `a:${turn.id}`;
    const copied = this.copied === id;
    return h_flex().pt(4).pb(12).gap(10).items_center().text_size(12).line_height("16px")
      .child(h_flex().ml(-4).gap(4).child(this.iconBtn(t, `kc-act-${turn.id}`, copied ? I("check") : COPY, copied ? tr("copied") : tr("copyAnswer"), (cx) => this.copy(cx, id, answer, 2000))))
      .when(Boolean(at), (el) => el.child(h_flex().gap(6).items_center()
        .child(div().size(3).rounded_full().bg(ink(t, 0.25)))
        .child(div().text_color(ink(t, 0.35)).child(time(at)))));
  }

  // transcript.rs:4891-5005: « Opus 5.5 a travaillé 3m 12s », 14/20 at ink 0.5 (0.8 hovered), pt 12,
  // pb 4, gap 8, after the provider's tile; hovered or open, the tile shows the chevron.
  workedLine(t, turn, opened) {
    const hov = this.hover === `w:${turn.id}`;
    const model = modelName(turn.model);
    const d = turn.ms ? workedFor(turn.ms) : null;
    const text = d ? (model ? tr("worked", { model, d }) : tr("workedNoModel", { d })) : model ? tr("workedPlain", { model }) : tr("workedNone");
    return h_flex().id(`kc-fold-${turn.id}`).pt(12).pb(4).gap(8).items_center().min_w(0).cursor_pointer()
      .tooltip(turn.tally ? tallyText(turn.tally, tr) : text)
      .on_hover((h, cx) => this.setHover(cx, `w:${turn.id}`, h))
      .on_click((_e, cx) => { this.toggle(`f:${turn.id}`); cx.notify(); })
      .child(this.tile(t, TILE.claude, hov || opened ? I(opened ? "chevron-down" : "chevron-right") : CLAUDE_ICON))
      .child(div().flex_1().min_w(0).truncate().text_size(14).line_height("20px").text_color(ink(t, hov ? 0.8 : 0.5)).child(text));
  }

  // The live turn's row: the same line, « Opus 5.5 travaille… », the tile spinning (Monocode's shimmer
  // is a 15 fps shader: here an opacity loop, natively).
  workingLine(t) {
    const last = this.turns[this.turns.length - 1];
    const model = modelName(last?.model ?? this.line?.model ?? "");
    return h_flex().pt(12).pb(4).gap(8).items_center().min_w(0)
      .child(this.tile(t, TILE.claude, CLAUDE_ICON, true))
      .child(div().flex_1().min_w(0).truncate().text_size(14).line_height("20px").text_color(ink(t, 0.5))
        .loop("opacity", { from: 0.55, to: 1, period: 1600 })
        .child(model ? tr("workingModel", { model }) : tr("working")));
  }

  item(t, cx, it, ctx) {
    if (it.type === "activity") return this.activity(t, it, ctx.live);
    if (it.type === "subagents") return this.subagents(t, it);
    const b = it.block;
    if (b.role === "prose") return this.prose(t, cx, b, ctx.top);
    if (b.role === "notice") return this.notice(t, b);
    if (b.role === "note") return b.from?.kind === "system" ? null : this.notices(t, b.id, b);
    return null;
  }

  // transcript.rs:5290-5313 + :1325-1431, the user's bubble: on the right (its row pl 56), 576 at most,
  // px 12 py 8, radius 12 (a pill on one short line), ink 0.1, no border, 14/20 at ink 1; folded past
  // four lines under « Afficher plus » (:5275-5282); images and files above it (mb 8); hovered, copy and
  // the time under it. The bubble never takes the width its words would like: a path or a JSON line
  // with no space wraps (or is cut) inside its 576, it never pushes the bubble out of the column.
  // Another agent's message, a task's notice, a system reminder: never Kylian's bubble (classify()).
  opener(t, turn, cx) {
    const u = turn.user;
    if (!u) return null;
    if (u.from?.kind === "system") return null;
    if (u.from) return this.notices(t, turn.id, u);
    const text = u.cmd ? [u.cmd.name, u.cmd.args].filter(Boolean).join(" ") : u.text ?? "";
    const pill = !text.includes("\n") && text.length <= 60;
    const id = `u:${turn.id}`;
    const open = this.open.has(`o:${turn.id}`);
    const folded = clampText(text, { lines: 4, cols: 76 });
    const shown = open || !folded.cut ? text : folded.text;
    // #80: the message's attachments (att-model.js), its images as photos above the bubble, its other
    // files as chips in it (attachments.rs split_photos); an index from before #80 (a count, no `imgs`)
    // keeps its « N images » chip.
    const cwd = this.state?.meta?.cwd ?? null;
    const atts = attachmentsOf(u, turn.files, this.state?.session).map((a) => ({ ...a, abs: a.abs ?? (a.path?.startsWith("/") ? a.path : cwd && a.path ? `${cwd}/${a.path}` : null) }));
    const photos = atts.map((a, i) => (a.kind === "image" ? this.photo(t, cx, turn, atts, a, i) : null)).filter(Boolean);
    const docs = atts.map((a, i) => (a.kind !== "image" ? this.docChip(t, cx, turn, atts, a, i) : null)).filter(Boolean);
    if (!u.imgs && u.images) docs.unshift(this.chip(t, OWN("image"), tr("images", { n: u.images })));
    const hov = this.hover === id;
    const copied = this.copied === id;
    const row = () => h_flex().gap(6).flex_wrap().justify_end().max_w(BUBBLE_MAX);
    return h_flex().id(`kc-u-${turn.id}`).pt(4).pl(BUBBLE_ROW_PAD).w_full().min_w(0).justify_end()
      .on_hover((h, cx) => this.setHover(cx, id, h))
      .child(v_flex().items_end().max_w(BUBBLE_MAX).min_w(0)
        .when(photos.length > 0, (el) => el.child(row().mb(8).children(photos)))
        .when(docs.length > 0 && !text.trim(), (el) => el.child(row().mb(8).children(docs)))
        .when(Boolean(text.trim()), (el) => el.child(div().id(`kc-ub-${turn.id}`).max_w(BUBBLE_MAX).min_w(0).overflow_hidden()
          .px(12).py(8).rounded(pill && !docs.length ? 18 : 12).bg(ink(t, 0.1))
          .text_size(14).line_height("20px").text_color(ink(t, 1))
          .when(Boolean(u.cmd), (el) => el.font_family(CODE).text_size(13))
          .when(docs.length > 0, (el) => el.child(h_flex().mb(6).gap(6).flex_wrap().children(docs)))
          .child(u.cmd ? text : TextView.markdown(`kc-ut-${turn.id}${open ? "-all" : ""}`, shown).selectable(true))))
        .when(folded.cut, (el) => el.child(this.more(t, `kc-um-${turn.id}`, open, () => this.toggle(`o:${turn.id}`))))
        // Monocode shows these on hover; their place stays (no jump).
        .child(h_flex().h(26).pt(4).gap(6).items_center().opacity(hov || copied ? 1 : 0)
          .child(this.iconBtn(t, `kc-uc-${turn.id}`, copied ? I("check") : COPY, tr("copyMessage"), (cx) => this.copy(cx, id, text, 2000)))
          .when(Boolean(u.at), (el) => el.child(this.label(t, time(u.at))))));
  }

  // attachments.rs:272-311: a pill, padding 4, radius 6, ground 0.06, icon 16, its name at 11 px.
  chip(t, icon, text) {
    return h_flex().p(4).gap(6).items_center().rounded(6).bg(ink(t, 0.06)).text_size(11).text_color(ink(t, 0.7))
      .child(svg(icon).size(16).flex_none().text_color(ink(t, 0.5))).child(div().max_w(140).truncate().child(text));
  }

  // attachments.rs photo_row + photo_size (#80): an image whole in a 240 square, its own shape, radius
  // 16, its thumbnail made by chat-att.ts (480 px, the bounded cache); a quiet square holds its place
  // until then (the square: its size isn't known yet). A click opens the viewer on the message's
  // attachments, at this one.
  photo(t, cx, turn, atts, a, i) {
    const info = this.attOf(cx, a);
    const [w, h] = photoSize(info?.w, info?.h);
    const src = info?.thumb ? `${ATT_DIR}/${info.thumb}` : null;
    return div().id(`kc-ph-${turn.id}-${i}`).w(w).h(h).flex_none().rounded(16).overflow_hidden().bg(ink(t, 0.06))
      .cursor_pointer().on_click((_e, cx) => this.openAtts(cx, atts, i))
      .when(Boolean(src), (el) => el.child(image(src).size_full().rounded(16)))
      .when(Boolean(info?.error), (el) => el.flex().items_center().justify_center().child(svg(OWN("image")).size(16).text_color(ink(t, 0.35))));
  }

  // A file of the message (#80): a chip (attachments.rs:272-311), its type's icon, its name, then its
  // kind and size at 0.45 (Kylian: « nom, type, taille »); a click opens the viewer at it.
  docChip(t, cx, turn, atts, a, i) {
    const info = this.attOf(cx, a);
    const meta = [tr(`att.${a.kind}`), info?.bytes != null ? sizeText(info.bytes) : null].filter(Boolean).join(" · ");
    const icon = a.kind === "pdf" || a.kind === "markdown" || a.kind === "text" ? I("file-text") : a.kind === "code" ? I("square-pen") : I("file");
    return h_flex().id(`kc-dc-${turn.id}-${i}`).p(4).pr(8).gap(6).items_center().rounded(6).bg(ink(t, 0.06)).text_size(11)
      .cursor_pointer().hover((s) => s.bg(ink(t, 0.1)))
      .on_click((_e, cx) => this.openAtts(cx, atts, i))
      .child(svg(icon).size(16).flex_none().text_color(ink(t, 0.5)))
      .child(div().min_w(0).max_w(140).truncate().text_color(ink(t, 0.7)).child(a.name))
      .when(Boolean(meta), (el) => el.child(div().flex_none().text_color(ink(t, 0.45)).child(meta)));
  }

  /** chat-att.ts's argv for an attachment (by argv, never a shell): from the transcript or its file. */
  attArgv(a, full) {
    const tail = ["--out", `${appHome()}/${ATT_DIR}`, ...(full ? ["--full"] : [])];
    const bun = [`${home()}/.nix-profile/bin/bun`, `${appHome()}/mods/kt-chat/chat-att.ts`];
    if (a.ref) return this.state?.path ? [...bun, "embedded", this.state.path, "--at", String(a.ref.o), "--n", String(a.ref.n), ...tail] : null;
    if (a.abs?.startsWith("/")) return [...bun, "file", a.abs, ...tail];
    return null;
  }

  // An attachment's files (#80): asked once, from the render on a miss (never under checking()), one
  // at a time in a task: a thumbnail for an image or a PDF, a document's kind and size. Every 20 made,
  // the cache is swept to its bounds (chat-att.ts sweep: its own names only), what is shown kept.
  attOf(cx, a) {
    const got = this.att.get(a.key);
    if (got || checking() || !cx) return got ?? null;
    this.att.set(a.key, { busy: true });
    this.attQ.push(a);
    if (!this.attRun) {
      this.attRun = true;
      cx.spawn(async (cx) => {
        while (this.attQ.length) {
          const next = this.attQ.shift();
          const argv = this.attArgv(next, false);
          const r = argv ? await exec(argv[0], argv.slice(1), { timeout: 30000 }).catch(() => null) : null;
          let j = null;
          try { j = JSON.parse(r?.stdout ?? ""); } catch { /* said as failed */ }
          this.att.set(next.key, j && !j.error ? j : { error: j?.error ?? "failed" }); // i18n: tech
          if (j?.thumb) this.attMade++;
          cx.notify();
        }
        this.attRun = false;
        if (this.attMade >= 20) {
          this.attMade = 0;
          const keep = [...this.att.values()].map((x) => x.thumb).filter(Boolean).join(",");
          exec(`${home()}/.nix-profile/bin/bun`, [`${appHome()}/mods/kt-chat/chat-att.ts`, "sweep", "--out", `${appHome()}/${ATT_DIR}`, "--keep", keep], { timeout: 30000 }).catch(() => null);
        }
      });
    }
    return this.att.get(a.key);
  }

  // A click on an attachment (#80): the viewer (kt-viewer) on all of the message's, at this one. A
  // pasted image is decoded from the transcript now (chat-att --full, into the bounded cache), an image
  // file shown through a link to it; a PDF, markdown, code or text by its path (the viewer reads them,
  // and builds a PDF's page command itself); anything else by its path, for « Afficher dans le Finder ».
  openAtts(cx, atts, index) {
    if (checking()) return;
    cx.spawn(async (cx) => {
      const items = [];
      for (const a of atts) {
        if (a.kind === "image") {
          const argv = this.attArgv(a, true);
          const r = argv ? await exec(argv[0], argv.slice(1), { timeout: 30000 }).catch(() => null) : null;
          let j = null;
          try { j = JSON.parse(r?.stdout ?? ""); } catch { /* the viewer says it's missing */ }
          items.push(j?.full ? { kind: "image", path: `${ATT_DIR}/${j.full}`, name: a.name, w: j.w ?? undefined, h: j.h ?? undefined, size: j.bytes ?? undefined } : { kind: "image", name: a.name });
        } else items.push({ kind: a.kind, src: a.abs, name: a.name, lang: a.lang ?? undefined, size: this.att.get(a.key)?.bytes ?? undefined });
      }
      openOverlay({ mod: "kt-viewer", kind: "dialog", frame: "none", width: 1, height: 1, props: { items, index } });
      cx.notify();
    });
  }

  turn(t, cx, turn, i, keyed) {
    const out = [];
    const op = this.opener(t, turn, cx);
    if (op) out.push(op);
    const f = turn.fold;
    const opened = f && this.open.has(`f:${turn.id}`);
    let top = 12; // the first prose block of the message
    turn.items.forEach((it, n) => {
      if (f && n === f.start) out.push(this.workedLine(t, turn, opened));
      // Inside a closed fold only the sub-agents keep their rows (Monocode pins them outside it).
      if (f && !opened && n >= f.start && n <= f.end && it.type !== "subagents") return;
      const el = this.item(t, cx, it, { live: turn.live, top: f && n === f.end + 1 ? 4 : top });
      if (it.type === "block" && it.block.role === "prose") top = 16;
      if (el) out.push(el);
    });
    if (!turn.live && answerOf(turn)) out.push(this.actions(t, turn));
    const here = keyed && i === (this.cur < 0 ? this.turns.length - 1 : this.cur);
    return this.col(v_flex().relative().w_full().min_w(0).pb(8)
      // The keyboard's turn: a short 2 × 16 accent tick in the column's margin, at its top (a mark as
      // tall as the turn ran through a long turn like a rule).
      .when(here, (el) => el.child(div().absolute().left(-14).top(8).w(2).h(16).rounded_full().bg(t.accent)))
      .children(out), `kc-turn-${turn.id}`);
  }

  head(t) {
    if (this.first() > 0 || this.state?.more) {
      return this.col(h_flex().justify_center().py(8).child(h_flex().id("kc-older-btn").h(26).px(12).gap(6).items_center().rounded_full()
        .border(1).border_color(ink(t, 0.1)).cursor_pointer().hover((s) => s.bg(ink(t, 0.08))).text_size(12).text_color(ink(t, 0.6))
        .on_click((_e, cx) => { this.older(cx); cx.notify(); })
        .child(svg(this.olderBusy ? SPIN : I("chevron-up")).size(12).when(Boolean(this.olderBusy), (el) => el.spin(900)))
        .child(this.olderBusy ? tr("olderLoading") : tr("older"))), "kc-head");
    }
    return this.col(h_flex().justify_center().py(8).child(this.label(t, tr("start"), 0.35)), "kc-head");
  }

  // Under a live turn: the agent at work, then what was typed meanwhile and not taken yet, in pale
  // « en file » bubbles (queue-operation), on the right like the user's.
  working(t) {
    return this.col(v_flex().pb(10).min_w(0)
      .child(this.workingLine(t))
      .children(this.queued.map((q, i) => h_flex().id(`kc-q-${i}`).pt(8).pl(BUBBLE_ROW_PAD).w_full().justify_end()
        .child(v_flex().items_end().gap(4).max_w(BUBBLE_MAX)
          .child(div().px(12).py(8).rounded(12).border(1).border_dashed().border_color(ink(t, 0.2))
            .text_size(14).line_height("20px").text_color(ink(t, 0.6)).children(lines(q.text).slice(0, 6).map((l) => div().child(l || " "))))
          .child(this.label(t, tr("queued")))))), "kc-working");
  }

  empty(t, title, body, retry) {
    return v_flex().flex_1().min_h(0).p(16).gap(10).items_center().justify_center()
      .child(svg(MSG).size(22).text_color(ink(t, 0.35)))
      .child(div().text_size(14).font_semibold().text_color(ink(t, 1)).child(title))
      .child(div().max_w(380).text_size(12.5).line_height("20px").text_color(ink(t, 0.55)).child(body))
      .when(retry, (el) => el.child(h_flex().id("kc-retry").h(26).px(10).gap(6).items_center().rounded(7).bg(ink(t, 0.1))
        .text_size(12).text_color(ink(t, 0.8)).cursor_pointer().hover((s) => s.bg(ink(t, 0.15)))
        .on_click((_e, cx) => { this.load(cx); cx.notify(); })
        .child(svg(I("refresh-cw")).size(12)).child(tr("retry"))));
  }

  body(t, cx, tg, keyed) {
    if (!this.fixed && tg.reason === "noAgent") return this.empty(t, tr("empty.noAgent.title"), tr("empty.noAgent.text"));
    if (!this.fixed && tg.reason === "notClaude") return this.empty(t, tr("empty.notClaude.title"), tr("empty.notClaude.text", { app: tg.app }));
    if (!this.fixed && tg.reason === "remote") return this.empty(t, tr("empty.remote.title"), tr("empty.remote.text", { machine: tg.machine }));
    const want = this.wanted(tg);
    if (!readyFor(this.readFor, want)) {
      // Not read yet for this agent: rows as bars, breathing (skeleton.js), not the previous agent's.
      const S = skeleton(t, this.m);
      return S.pulse(h_flex().id("kc-sk").flex_1().min_h(0).justify_center()
        .child(v_flex().w_full().max_w(COLUMN).px(COLUMN_PAD).pt(TOP_INSET).child(S.list(5, { h: 52, icon: 0, lines: [0.4, 0.75], gap_y: 6 }))));
    }
    const e = this.err;
    if (e?.code === "noSession") return this.empty(t, tr("empty.noSession.title"), tr("empty.noSession.text"), true);
    if (e?.code === "missing") return this.empty(t, tr("empty.missing.title"), tr("empty.missing.text", { path: e.path }), true);
    if (e?.code === "failed") return this.empty(t, tr("empty.failed.title"), tr("empty.failed.text", { why: e.why }), true);
    if (!this.turns.length) return this.empty(t, tr("empty.empty.title"), tr("empty.empty.text"), true);
    const from = this.first();
    // The code budget goes to the latest turns first: they are described last to first.
    this.budget = { spans: CODE_SPANS, rows: CODE_ROWS };
    const turns = [];
    for (let i = this.turns.length - 1; i >= from; i--) turns.push(this.turn(t, cx, this.turns[i], i, keyed));
    this.budget = null;
    const children = [this.head(t), ...turns.reverse()];
    if (this.builtLive) children.push(this.working(t));
    // The 1 px end mark: revealing it shows the bottom of a last turn taller than the view.
    children.push(div().flex_none().h(1));
    const last = children.length - 1;
    // The timeline's jump (#85), once the rows above its turn are measured: an anchor at the turn's top,
    // a view tall (never past the end), after the end mark (the turns' child indices stay): the
    // smallest scroll that reveals it puts its top at the view's top, from above as from below.
    if (this.jump != null) {
      const g = this.geom();
      const y = g.tops.get(this.jump);
      if (!this.turns.some((x) => x.id === this.jump)) this.jump = null;
      else if (g.known && y != null && this.vh > 0) {
        children.push(div().absolute().left(0).top(y).w(1).h(anchorH({ y, end: g.end, vh: this.vh })));
        this.scroll.scroll_to_item(children.length - 1);
        this.jump = null;
        this.reveal = null;
      }
    }
    if (this.reveal != null) {
      this.scroll.scroll_to_item(this.reveal === "bottom" ? last : Math.min(this.reveal, last));
      this.reveal = null;
    }
    const rail = this.rail(t);
    return div().relative().flex_1().min_h(0).flex().flex_col()
      .child(v_flex().id("kc-scroll").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).pt(TOP_INSET).pb(8)
        .on_size_change((size, cx) => {
          const h = size.height / this.zoom();
          if (Math.abs(h - this.vh) > 0.5) { this.vh = h; cx.notify(); }
        })
        // Scrolling up leaves the bottom: new turns no longer pull the view down (G or the button bring it back).
        .on_scroll_wheel((ev, cx) => {
          if (ev.delta.y > 0 && this.follow) { this.follow = false; cx.notify(); }
          this.wheel(cx, null, ev);
        })
        .children(children))
      .when(Boolean(rail), (el) => el.child(rail))
      // transcript.rs:5986-6062, « jump to bottom »: 30 round, border 0.1, ground 0.04, chevron 16 at 0.7.
      .when(!this.follow, (el) => el.child(h_flex().absolute().bottom(8).left(0).right(0).justify_center()
        .child(h_flex().id("kc-bottom").size(30).rounded_full().items_center().justify_center().border(1).border_color(ink(t, 0.1))
          .bg(ink(t, 0.04)).cursor_pointer().tooltip(tr("bottom")).text_color(ink(t, 0.7)).hover((s) => s.text_color(ink(t, 1)))
          .on_click((_e, cx) => { this.follow = true; this.cur = -1; this.jump = null; this.reveal = "bottom"; cx.notify(); })
          .child(svg(I("chevron-down")).size(16)))));
  }

  /**
   * conversation.rs:2907-3271, the composer: a card in the reading column (px 10, pb 6), radius 12,
   * border 0.1 (0.2 focused), ground 0.03 in dark (opaque in light, with its shadow); the field at
   * 14 px (px 12, pt 10, pb 14); a toolbar (px 8, pb 10, gap 4) of pills (h 26, px 6, radius 6, ground
   * 0.1): the model and effort, the permission mode, read only; the send button (h 26, radius 7, ink on
   * paper). Under it (pt 6, px 15, gap 10, 12 px at 0.55): the checkout or worktree, the branch, and on
   * the right what the composer says, then the context.
   */
  composerView(t, tg, pr) {
    const a = tg.agent;
    const dark = Boolean(settings().dark);
    const m = sendMode(a?.status ?? null);
    const can = canSend({ status: a?.status ?? null, text: this.draft, sending: this.sending });
    const p = m === "blocked" ? this.decision?.pending : null;
    const pill = (id, label, onClick) => h_flex().id(id).flex_none().h(24).px(8).items_center().rounded(6).bg(ink(t, 0.1))
      .text_size(12).text_color(ink(t, 1)).cursor_pointer().hover((s) => s.bg(ink(t, 0.15)))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); cx.notify(); })
      .child(label);
    // A dialog waits in the terminal: what it asks, its answers when it has some, the terminal.
    const blocked = m === "blocked"
      ? v_flex().gap(6).px(12).py(10).rounded(12).border(1).border_color(alpha(t.blocked, "66")).bg(alpha(t.blocked, dark ? "14" : "1f"))
        .child(h_flex().gap(8).items_center()
          .child(div().size(6).flex_none().rounded_full().bg(t.blocked).loop("opacity", { from: 0.3, to: 1, period: 1200 }))
          .child(div().flex_1().min_w(0).truncate().text_size(13).font_medium().text_color(ink(t, 1)).child(p?.title || tr("composer.blocked"))))
        .when(Boolean(p?.detail), (el) => el.child(div().text_size(12.5).line_height("20px").text_color(ink(t, 0.6)).children(lines(p.detail).slice(0, 4).map((l) => div().child(l || " ")))))
        .child(h_flex().gap(6).items_center()
          .when(Boolean(p?.options?.length), (el) => el.child(decisionButtons(this.decision, { onDone: (r, cx) => {
            if (!r?.ok && r?.reason) notify({ title: tr("composer.answerFailed"), body: r.reason, level: "error" });
            cx.notify();
          } })))
          .child(pill("kc-open-term", tr("composer.openTerminal"), () => this.openTerminal())))
      : null;
    const toolPill = (icon, parts, color) => h_flex().h(26).px(6).gap(4).flex_none().items_center().rounded(6).bg(ink(t, 0.1))
      .child(svg(icon).size(14).flex_none().text_color(color ?? ink(t, 0.5)))
      .children(parts.map(([text, a]) => div().text_size(11).text_color(color ?? ink(t, a)).child(text)));
    const model = this.line?.model ? String(this.line.model) : "";
    const effort = this.line?.effort ? String(this.line.effort) : "";
    const perm = this.state?.meta?.permission ?? null;
    const full = perm === "bypassPermissions";
    const label = this.sending ? tr("composer.sendingShort") : m === "queue" ? tr("composer.queueShort") : tr("composer.sendShort");
    const send = h_flex().id("kc-send").h(26).flex_none().gap(6).items_center().justify_center().rounded(7)
      .when(can.ok || this.sending, (el) => el.px(8)).when(!(can.ok || this.sending), (el) => el.w(26))
      .bg(can.ok ? t.foreground : ink(t, 0.3)).text_color(can.ok ? t.background : alpha(t.background, "66"))
      .tooltip(m === "queue" ? tr("composer.sendQueue") : tr("composer.send"))
      .when(can.ok, (el) => el.cursor_pointer().on_click((_e, cx) => { cx.stop_propagation(); this.send(cx); }))
      .child(this.sending ? svg(SPIN).size(14).spin(900) : svg(SEND).size(14))
      .when(can.ok || this.sending, (el) => el.child(div().text_size(12).font_medium().child(label)));
    const card = v_flex().id("kc-card").w_full().rounded(12).border(1).border_color(ink(t, this.typing ? 0.2 : 0.1))
      .bg(dark ? ink(t, 0.03) : t.background).when(!dark, (el) => el.shadow_sm())
      .child(div().id("kc-field").px(12).pt(10).pb(14).cursor_text().on_click(() => this.composer.focus())
        .child(Textarea.new(this.composer).w_full().text_size(14).text_color(ink(t, 1))))
      .child(h_flex().px(8).pb(10).gap(4).items_center()
        .when(Boolean(model), (el) => el.child(toolPill(CLAUDE_ICON, [[model, 1], ...(effort ? [[effort, 0.5]] : [])])))
        .when(Boolean(perm), (el) => el.child(toolPill(PERM[perm] ?? OWN("lock"), [[tr(`perm.${perm}`) || perm, 0.7]], full ? FULL_ACCESS : null)))
        .child(div().flex_1())
        .child(send));
    const say = this.sending ? tr("composer.sending")
      : this.sendErr ? tr(`composer.err.${this.sendErr.why}`, { why: this.sendErr.message ?? "" })
        : this.handle.is_focused() ? tr("hint")
          : m === "queue" ? tr("composer.queue") : m === "blocked" ? tr("composer.held") : tr("composer.hint");
    const ctx = Number(this.line?.ctx_pct);
    const bar = (icon, text, id) => h_flex().id(id).h(24).px(6).ml(-6).gap(6).items_center().rounded(6).text_size(12).text_color(ink(t, 0.55))
      .child(svg(icon).size(14).flex_none()).child(div().max_w(256).truncate().child(text));
    const under = h_flex().pt(6).px(15).gap(10).items_center().min_w(0)
      .when(Boolean(pr), (el) => el.child(bar(I(pr.worktree ? "folder-tree" : "folder"), pr.worktree ? tr("ws.worktree") : tr("ws.checkout"), "kc-ws")))
      .when(Boolean(pr?.branch), (el) => el.child(bar(I("git-branch"), pr.branch, "kc-br")))
      .child(div().flex_1().min_w(0).truncate().flex().justify_end().text_size(11).text_color(this.sendErr ? ERR : ink(t, 0.45)).child(say))
      .when(Number.isFinite(ctx), (el) => el.child(div().flex_none().text_size(11).text_color(ctx >= 90 ? ERR : ctx >= 75 ? WARN : ink(t, 0.45))
        .child(tr("ctx", { n: Math.round(ctx) }))));
    return h_flex().w_full().flex_none().justify_center()
      .child(v_flex().w_full().max_w(COLUMN).px(10).pb(6).gap(8)
        .when(Boolean(blocked), (el) => el.child(blocked))
        .child(card)
        .child(under));
  }

  // ---------- live (#55) ----------

  /**
   * The live tail (#55), driven by the agent's status, never by a folder watch (a session's folder is
   * its whole project's: a team's sub-agents write there all the time):
   * - a delta every TICK ms, only while this face shows and its agent works (the timer stops itself
   *   when either goes: a hidden copy doesn't draw, so its tick notices);
   * - one delta at each status change (working → idle / blocked / done: the last lines) and when
   *   the face shows again after being hidden;
   * - nothing at rest.
   */
  live(cx, tg, want) {
    if (checking() || want == null || want !== this.loadedFor) return;
    const shown = this.isShown();
    const status = tg.agent?.status ?? null;
    const { delta, tick } = liveStep({ shown, wasShown: this.wasShown, status, lastStatus: this.lastStatus, hasState: Boolean(this.state), fixed: this.fixed });
    if (delta) this.load(cx, true);
    // #56: blocked, the request is read once (per agent and per blocking); out of it, dropped, and a
    // refusal for « blocked » goes with it.
    if (status === "blocked" && !this.fixed && (this.lastStatus !== "blocked" || this.decisionFor !== want)) {
      this.decisionFor = want;
      this.decision = null;
      this.readDecision(cx, want);
    } else if (status !== "blocked") {
      this.decisionFor = null;
      this.decision = null;
      if (this.sendErr?.why === "blocked") this.sendErr = null;
    }
    this.wasShown = shown;
    this.lastStatus = status;
    if (tick && !this.ticker) {
      this.ticker = cx.timer.every(TICK, (cx) => {
        if (!this.isShown() || target().agent?.status !== "working") {
          this.ticker?.cancel();
          this.ticker = null;
          this.wasShown = this.isShown();
          return;
        }
        this.load(cx, true);
      });
    } else if (!tick && this.ticker) {
      this.ticker.cancel();
      this.ticker = null;
    }
  }

  /** This face is on screen: the layout's thread shows its Chat, or this copy shows a fixed file. */
  isShown() {
    return Boolean(this.fixed) || chatShown(layout());
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
      this.hts.clear();
      this.tlId = null;
      this.jump = null;
      this.tlHover = -1;
      this.tlOpen = false;
      this.load(cx);
    }
    this.live(cx, tg, want);
    if (this.cleanDue && !checking()) this.sweepBg(cx);
    // The thread switched to its Chat face: take the keyboard, once per request, only when the
    // layout shows this face (a hidden copy doesn't draw anyway).
    const ask = shared("kt.chat.focus");
    if (ask && ask !== this.focusAsked && !checking()) {
      this.focusAsked = ask;
      if (chatShown(layout())) cx.spawn(async (cx) => { this.focusIn(); cx.notify(); });
    }
    const keyed = this.handle.is_focused();
    const writes = !this.fixed && Boolean(tg.agent) && !tg.reason;
    const pr = this.project(t, cx, tg);
    const bg = this.background(t, cx, pr);
    // shell/project_settings.rs:304-317: the image first, the conversation over it; nothing paints a
    // ground (conversation.rs:3833-3852, transcript.rs:5880-5918).
    // No frame (Kylian, 2026-11-19: the background goes to the edges, as in Monocode); the corners
    // stay those of the thread's block (radius 16, the column's 20 less its padding of 4).
    return div().id("kt-chat").relative().size_full().rounded(16)
      .overflow_hidden().text_color(ink(t, 1))
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .on_drop((ev, cx) => { const p = (ev?.paths ?? []).find((x) => IMAGE.test(x)); if (p && pr) { this.importBg(cx, pr, p); cx.notify(); } })
      .on_size_change((size, cx) => {
        const z = Number(settings().zoom) || 1;
        const w = size.width / z, h = size.height / z;
        if (!this.size || Math.abs(w - this.size.w) > 1 || Math.abs(h - this.size.h) > 1) { this.size = { w, h }; this.width = w; cx.notify(); }
      })
      .when(Boolean(bg), (el) => el.child(bg))
      .child(v_flex().absolute().top(0).left(0).right(0).bottom(0)
        .child(enter(this.m, this.body(t, cx, tg, keyed), `kc-body-${want ?? "none"}`, { dy: 0 }).flex_1().min_h(0))
        .when(writes, (el) => el.child(this.composerView(t, tg, pr))))
      .children(this.bgControls(t, pr) ?? []);
  }
}
