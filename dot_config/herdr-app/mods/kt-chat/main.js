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
// The background's effect (#87), per project in its panel: the dither (#57, the default), or
// Monocode's ASCII, Halftone, Scanlines and Haze, each a texture chat-bg.ts makes once into
// data/kt-chat; the Haze's follows the view (its rows by steps of 128, empty or not, the theme), the
// last texture staying on screen while the next one is made.
//
// Keys (focusable): j k turns, gg G, ctrl-d ctrl-u, o / enter fold, y copy the turn's answer, r
// reread, i write, [ ] Kylian's message before / after (the timeline, #85). `kt-chat.file:<path>`
// shows that JSONL instead (tests), `file:` back; `kt-chat.tl:hover:<n>` / `tl:jump:<n>` / `tl:off`
// hover or jump to the timeline's n-th message (captures: never the focus).
// In the field (#81): `/` `#` `@` open the completion menu (commands, MCP tools, the project's files),
// tab or enter takes its row, ctrl-n ctrl-p move it, esc closes it (a second esc leaves the field).
//
// The timeline (#85, timeline.js): Monocode's prompt outline, a bar per message Kylian typed on the
// right edge of the transcript, the one on screen lit, a card on hover, a click or [ ] to it. No
// scroll offset is exposed: the rows report their heights, a wheel event the pointer's place.
//
// Live (#55, live()): while this face shows and the agent works, a delta (`--from end`) every TICK
// ms, plus one at each status change and on coming back on screen; nothing at rest.
//
// The thread's Chat face (#54, back with #86: Kylian wants it in place of the tab's panes, not beside
// them): the layout's stack thread-body shows this copy (child chat) or the tab's panes (child main).
// It follows the shown tab's agent (pickTarget), takes the keyboard when kt-head's view.js switches to
// it (shared stamp "kt.chat.focus"); « Ouvrir le terminal » goes back to the panes, the keyboard to its
// agent's pane. Or a fixed file (props().file). No motion at the switch: Herdr keeps this copy alive
// while hidden (AGENTS.md: the other child of a stack is found as it was), so the face shows its last
// state in its first image; a cold copy (its first show, or after a save) shows its skeleton at once.

import { View, div, svg, image, PathBuilder, Background } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, TextView, TextareaState, Textarea } from "gpui-base";
import { agents, focused, panes, theme, settings, shared, setShared, home, appHome, exec, hc, readTextFile, writeTextFile, checking, nextCommand, notify, props, layout, run, openOverlay } from "herdr";
// #56: the composer (pure, composer.check.mjs); kt-threads' decide.js (a byte-identical copy, with
// decide.strings.js): what a blocked agent waits on, and its Accepter / Refuser.
import { mode as sendMode, canSend, sendArgs, sendResult } from "./composer.js";
import { decide, decisionButtons } from "./decide.js";
import { askOf, callId, shownRows } from "./ask.js";
import { ingest, prepend, build, buildInc, tally, foldedSteps, foldTree, arrivals, trim, pendingQueue, subPath, subItems, subArrivals } from "./chat-model.js";
import {
  pickTarget, tallyText, childOf, chatShown, takesFocus, liveStep,
  projectOf, bgSettings, bgLayers, modelName, workedFor, ink, OPACITY, CELL_SIZES, EFFECTS, HAZE_DARK, hazeRows, orphans, clampText,
  foldMd, noticeHead, veilRects, VEIL,
} from "./chat-view.js";
import { docOf, mdState, colorsOf, langFor, target as linkTarget } from "./markdown.js";
// #82: the references in the transcript (refs.js), opened in Herdr; a panel tab shown first (panel.js).
import { refsState, ensure as ensureRefs, refsOf, linkify, parseRef, plan as refPlan, githubUrl, labelOf, chipsOf, kindFrom } from "./refs.js";
import { showColumn } from "./panel.js";
import { attachmentsOf, photoSize, extOf, familyOf, tileOf, CARD, colsFor, gridW, gridPlan } from "./att-model.js";
// #93: a turn's assets (its tools' images and files, the files its answer cites: assets.js), and the
// field's attachments (a drop, a paste, a picked file) and « Citer » (attach.js).
import { turnAssets } from "./assets.js";
import { add as addDraft, remove as dropDraft, promptOf, mentionText, PASTE_DIR, pasteArgs, pasteChoice, mayHoldFiles, copyArgs, pasteName, isPasteName, pasteSweep, pasted, pickArgs, picked, quoteOf } from "./attach.js";
// kt-keys' categories.js (a byte-identical copy, with workflows.js): the pieces' one chip (#81 and #93).
import { pieceChip, classify } from "./categories.js";
// #81: the field's completions (/ # @): completer.js' menu over kt-keys' complete.js (byte-identical
// copies, with complete.strings.js), menu.js' popup and its dither effects (the wave, a workflow's rail
// of workflows.js' steps), and the route a /command takes: herdr-bridge's say.js when its session token
// is fresh (keysend.js sayReady), a Claude Code built-in as keys (keysend.js), the rest by hc send.
import { menuFor, move as menuMove, pick as menuPick, typed as typedCommand, effectOf } from "./completer.js";
import { menuView, wave, rail, routeWords, ROW, ROWS } from "./menu.js";
import { tokenAt, merge, filesOf, routeOf } from "./complete.js";
import { STEPS as FLOW_STEPS } from "./workflows.js";
import { keysSend as keysRoute, sayReadyOf, sayFail } from "./keysend.js";
import { say as sayBridge } from "./say.js";
// « Compacter » by the ctx ring (compact.js, shared with Context's head): asks, waits for rest, /compact.
import { Compactor, compactButton, ioOf } from "./compact.js";
// kt-keys' dither.js (a byte-identical copy): the windows that keep the background inside the corners.
import { bandWindows, ALL } from "./dither.js";
import { motionState, frame, enter, collapse, rows, MS, DY } from "./motion.js";
// #84, the composer's ledges: the agent's tasks and sub-agents from its herdr-bridge file (shelf.js),
// drawn as the sidebar draws its sub-agents: kt-threads' branches (tree.js) and companions
// (companion-logo.js, a byte-identical copy).
import { tasksLedge, tasksOf, agentsLedge, shownAgents, agentAge, isAlive, startOf, endOf, FADE, say as sayTask, runOf, watching } from "./shelf.js";
import { twig, treeLine, hang, stem } from "./tree.js";
import { companion, variantFor } from "./companion-logo.js";
// The context as the composer's status line says it (kt-composer): kt-threads' ring and its threshold
// colors (ring.js, levels.js), the percent rolling (roll.js); byte-identical copies.
import { ring, ringColor } from "./ring.js";
import { roll } from "./roll.js";
import { TL, marks as markList, allMarks, readFrom, barStack, barLift, cardTop, offsets, viewTop, wheelAfter, wheelDy, activeAt, atEnd, anchorH, glide, stepMark, ownerOf } from "./timeline.js";
// #59: the turns drawn, a window [from, to) of CAP turns at most that no longer sticks to the end.
import * as win from "./turn-window.js";
import { skeleton, readyFor, still } from "./skeleton.js";
import { Vim, keyOf, keysOf, step } from "./vim.js";
import { makeT, duration, time, num, relative } from "./i18n.js";
import strings from "./strings.js";
import * as fs from "fs/promises";

const tr = makeT(strings);
// The host functions keysend.js, say.js and compact.js are handed (they import none: shared, checked bare).
const HOST = { agents, hc, exec, home, readTextFile, writeTextFile, stat: (p) => fs.stat(p), openOverlay };
const MONO = "Monaspace Krypton";
const CODE = "Monaspace Neon";
const K = 30; // turns read at first, and per read of « Tours précédents »
const BUDGET = 500000; // chat-index.ts --budget: characters of JSON per read
const MAX_ENTRIES = 900; // --max-entries: JSON.parse + build() stay ~15 ms in the mod engine
// #59: a read toward a message far above (reach(), the timeline): more turns a read, fewer reads; each
// one bounded by the summary's openers (timeline.js readFrom). To be measured in the engine (the journal).
const FAR = { turns: 90, budget: 1500000, entries: 2000 };
const KEEP = 1200; // entries the live tail keeps (trim), whole turns, before the oldest go
// The live tail: a delta read this often, only while the Chat shows and its agent works.
const TICK = 750;
const BRIDGE = 2000; // #84: the bridge file read again while the agent works or shows sub-agents
const SUB_TRIES = 3; // #58: failed reads of a sub-agent's transcript in a row before it stops trying (until unfolded again)
const STALE = 30000; // #81: the completions' catalog is read again when older, as the menu opens or the field takes focus
const ASK_TTL = 300000; // #81: a kt-confirm « yes » later than this after its ask sends nothing
// #81: a completed piece becomes a chip in the field (an InlineToken). Probed with herdr-app check
// (2026-11-19): value(), what goes, gives the token's `text`; but check never draws a token, so the
// chip's render (Textarea.token) is unproven until the capture slot: plain text until then.
const CHIPS = false;
// runner: the runner above the composer (runner.js, runner-plan.js; companion.js for its fallback):
// runnerShown(status, program) says when its band shows (composerView, in the flow), Runner is the nested
// view drawn there, runnerProps what feedRunner() hands it, keepBottom when the band moves a followed view.
import { Runner, runnerBand, runnerShown, runnerProps, keepBottom } from "./runner.js";
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
// A16: what one render may draw of the work other turns fold, in rows (a step, a line of an opened
// detail, a sub-agent: 1; a phase's header: FOLD_HEAD; a prose block in a fold, a markdown view:
// PROSE_ROWS). Measured under herdr-app check on the busy fixture (30 calls a turn), the window at
// CAP: all folds closed ~27 ms, 3 opened ~30 ms, 15 opened interrupted 5 times in 6 (#90's tree); a
// fold's headers and prose cost ~0.9 ms, steps or not. So a fold opened in another turn than the
// reader's is drawn whole while it fits, else held closed whole (a click in its turn serves it first);
// the reader's turn is outside the budget, and nothing is ever cut inside a turn drawn (the cold
// review's P1: a budget spent in drawing order starved what the reader looked at).
const ROW_BUDGET = 190; // ~4 busy folds open
const FOLD_HEAD = 2;
const PROSE_ROWS = 5;
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
const QUOTE = OWN("text-quote"); // #93: « Citer »
const MSG = "mods/kt-panel-head/messages-square.svg";
// #82: a reference's chip, its kind's icon; GitHub's mark (kt-gwm's) on its second button.
const REF_ICON = { issue: I("git-pull-request"), commit: I("git-commit"), file: I("file-text"), branch: I("git-branch"), worktree: I("folder-tree") };
const GITHUB = "mods/kt-gwm/github.svg";
const MAX_REFS = 8; // chips under one answer
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;

// ── Monocode's values (crates/monocode-gpui/src, 09d0443) ───────────────────
const COLUMN = 832; // theme.rs:8, the reading column
const COLUMN_PAD = 23; // theme.rs:12, its sides (the composer's 10 + 1 + 12: prose lines up with its text)
const TOP_INSET = 20; // transcript.rs:208
const SCROLLBAR_W = 16; // the band on the scroll area's right edge where a press is taken for the scrollbar's
const ROOM = 8; // #92: the room a turn's clipping box keeps on its sides (landing()): more than a row's ml(-6)
const BUBBLE_MAX = 576; // transcript.rs:217, PROMPT_BUBBLE_MAX
const BUBBLE_ROW_PAD = 56; // transcript.rs:5590, the bubble's row: pl 56, justify_end
const ERR = "#f87171"; // tools.rs:436-545, an error's words
const ERR_TARGET = "#ff6467"; // its target and its cross
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
    this.built = new Map(); // buildInc's turns of the last build, by their first entry (chat-model.js)
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
    // ctrl-b space (kt-head's view.js) asks for the keyboard through this shared stamp (a time). One
    // older than 2 s when this copy starts is not a request; a fresh one is (the first ctrl-b space
    // starts this copy: its stamp is written just before).
    const stamp = shared("kt.chat.focus");
    this.focusAsked = stamp && Date.now() - stamp > 2000 ? stamp : null;
    this.open = new Set(); // opened: f:<turn> fold, s:<step> detail, c:<notice> summary, r:<run> report, k:<code> block, p:<grid> pieces (« +N »)
    this.shownSteps = new Map(); // phase id -> steps drawn (STEPS, then MORE at a time)
    this.cur = -1; // the turn cursor (-1: the last)
    this.win = { from: 0, to: 0 }; // the turns drawn, [from, to) (turn-window.js, #59)
    this.follow = true; // stuck to the bottom until the reader scrolls up
    this.reveal = null; // a child to bring into view after the next layout
    // The timeline (#85): Kylian's messages (timeline.js marks, made in rebuild), the scroll area's
    // rows' heights (col() id -> design px) and its own, the message lit (its id; the last while
    // following) and whether its turn starts above the view, the bar hovered and its card, a jump
    // waiting for its rows' heights (a turn id). #59: the whole session's (the summary, chat-index.ts --marks:
    // every turn's opener and Kylian's messages, read once per full read), and the message a read upward
    // is going toward (reach(): its id).
    this.marks = [];
    this.summary = null;
    this.farTo = null;
    this.hts = new Map();
    this.vh = 0;
    this.areaW = 0; // the scroll area's width (design px): a reflow under a view that follows (areaSized)
    this.pinned = null; // the render being described brings the bottom: its token (body(), col(), measured())
    // A16: each fold's state as last drawn ("o" open, "c" closed: turn id -> state), the heights a turn's
    // row was measured at in each state (`${row}|${state}` -> design px), the folds held closed by the
    // budget in the last render, the row a press asked to keep where it is on screen ({ id, screen, top,
    // at, correct }: keepY()) and whether the press moved the reader.
    this.drawn = new Map();
    this.byState = new Map();
    this.heldNow = new Set();
    this.keepRow = null;
    this.pressMoved = false;
    this.tlId = null;
    this.tlAbove = false;
    this.tlLost = false; // the view moved where no event says (a press on the scrollbar): nothing lit
    this.bgBtn = false; // the background's button shows, over the scrollbar's top (areaPress)
    this.tlHover = -1;
    this.tlOpen = false;
    this.tlOpening = false;
    this.jump = null;
    // The view's top in the window (window px, viewSeen(): the box around the scroll area, kc-view) and the
    // last wheel event's offset ({ by, top }: timeline.js wheelAfter), what the view's top is measured from.
    this.viewY = null;
    this.wheelEst = null;
    // The jump's glide (glide(), timeline.js): the view's top as last known (design px; null unknown:
    // after a reveal or a press on the scrollbar), where a jump leaves from, the slide drawn ({ gen, dy, ready }).
    this.top = null;
    this.glideFrom = null;
    this.slide = null;
    this.width = 640;
    this.size = null; // { w, h } of this card, in design px (the background's)
    this.hover = null; // the row under the pointer, for what Monocode shows on hover
    this.copied = null; // the copy button showing its check
    this.roots = {}; // folder -> its repo's main checkout (null: no repo), git asked once per folder
    this.bgDone = new Map(); // bgKey(src, fx) -> chat-bg.ts' { path, w, h }
    this.bgBusy = new Set();
    this.bgLast = new Map(); // project key -> the texture shown last (kept on screen while the next is made, #87)
    // #80: an attachment's key -> chat-att.ts' answer ({ thumb, w, h, bytes } | { kind, bytes } |
    // { busy } | { error }), what is waiting for it, whether its task runs, thumbnails made since a sweep.
    this.att = new Map();
    this.attQ = [];
    this.attRun = false;
    this.attMade = 0;
    this.bgMenu = false;
    this.bgNote = null; // { busy } | { err } of the last image chosen
    this.cleanDue = true; // sweepBg() at the next render: once at start, then after each setting
    this.bgKeys = null; // the projects kt.chat.backgrounds had at the last render (#88: one gone elsewhere sweeps too)
    // #84: the agent's herdr-bridge file as last read (its todos and agents) and whose it is, what was
    // last drawn of it, the reads' timer; the ledges unfolded (per agent), the sub-agent whose detail
    // shows, the companions' memos (companion-logo.js).
    this.bridge = null;
    this.bridgeFor = null;
    this.plan = null; // the session's plan as last read validly (data/kt-chat/plan/<terminal>.json), bridgeFor's too
    this.bridgeKey = null;
    this.bridgeReading = false;
    this.bridgeTicker = null;
    this.tasksOpen = new Set();
    this.agentsOpen = new Set();
    this.subOpen = null;
    // #92: what arrived live and fades in where it lands (turn ids, the live turn's item ids; noteFresh),
    // the live turn's items at the last build, and the fold the reader opened or closed last ({ id, at }:
    // its items open or close on their height, rows(); a fold drawn again later lands as it is).
    this.fresh = new Set();
    this.liveItems = null;
    this.foldAt = null;
    // #92: what goes away fading out (goOut()), a ledge's last state while it does (its data went), and
    // the sub-agents each ledge knew at the last render (one new fades in).
    this.going = new Set();
    this.lastLedge = {};
    this.subsKnown = new Map();
    // #58: the sub-agents' own transcripts read so far (agent id -> { state, turns, done, busy, err,
    // shown }), each read when its line unfolds, then live while it runs and stays open.
    this.subRuns = new Map();
    this.memos = {};
    this.scroll = ScrollHandle.new();
    this.md = mdState();
    this.motion = motionState();
    this.runner = cx.new(Runner); // runner: a nested view, its renders are its own
    this.handle = cx.focus_handle();
    this.vim = new Vim();
    // #56, the composer: its field (a TextareaState is made here, never in render), what is typed,
    // whether a send runs, its refusal or failure, and the blocked agent's request (decide.js).
    this.draft = "";
    this.typing = false;
    this.sending = false;
    this.sendErr = null; // { why, message } from composer.js sendResult
    this.decision = null; // decide(terminal) while the agent is blocked
    this.ask = null; // #79: askOf(pending, call): the card worked out when the request or its call (chat-index.ts --tool) arrives
    this.askOpen = false; // #79: the request shown whole
    this.composer = TextareaState.new({ placeholder: tr("composer.ph") });
    // Monocode's field: one row of 22 px, up to 140 (input.rs:27, :407-411).
    this.composer.set_auto_grow(1, 6);
    // #81, the completions: the catalog (complete.js merge's commands, the session's MCP tools, the
    // project's files) and when it was read, the menu open (completer.js) and the last one shown (it fades
    // out, menu.js), its openings (each fades in anew), the token Esc closed, a /command typed by hand
    // already made a chip (its start), the route line under the card, the pieces the field holds as chips
    // (token id -> piece), the waves started. Then the menu's scroll, the wave running ({ id, category,
    // rail }), and a confirmed route waiting for kt-confirm.
    this.cpl = { catalog: { commands: [], tools: [], files: [] }, at: 0, loading: false, menu: null, last: null, gen: 0, dismissed: null, typedAt: null, route: null, pieces: new Map(), n: 0 };
    this.menuScroll = ScrollHandle.new();
    this.wave = null;
    this.pendingRoute = null;
    this.compactor = new Compactor("kt-chat", HOST); // « Compacter » by the ctx ring (compact.js)
    this.composer.on("change", (_e, cx) => {
      const had = Boolean(this.draft.trim());
      this.draft = this.composer.value();
      if (this.sendErr && this.sendErr.why !== "blocked") this.sendErr = null;
      const moved = this.complete(cx);
      if (moved || had !== Boolean(this.draft.trim())) cx.notify();
    });
    // Enter sends; shift-enter asks for a line break (the field may give one by itself). The menu open
    // with rows: Enter takes its active row.
    this.composer.on("submit", (e, cx) => {
      if (e?.shift) this.composer.replace("\n");
      else if (this.cpl.menu?.rows.length) this.accept(this.cpl.menu.active, cx);
      else this.send(cx);
    });
    this.composer.on("focus", (_e, cx) => {
      this.typing = true;
      if (Date.now() - this.cpl.at > STALE) this.loadCatalog(cx); // a head start on the first `/`
      cx.notify();
    });
    this.composer.on("blur", (_e, cx) => { this.typing = false; this.closeMenu(cx); cx.notify(); });
    // #93: the files waiting above the field (attach.js), a paste or a chooser running (a turn's assets are
    // worked out in rebuild(), on the turn).
    this.drafts = [];
    this.pieceHover = null; // the card under the pointer (pieceCard): the field's shows its ×; apart from this.hover
    this.hoverPiece = null; // and its piece, which Cmd+C copies as a file (key(), copyPiece)
    this.pasting = false;
    this.picking = false;
    // A paste the field found no text in: the Finder's files, else the clipboard's image (attach.js).
    this.composer.on("paste_other", (_e, cx) => this.paste(cx));
    this.keyPasting = false;
    if (checking()) return;
    // Cmd+V in the field is ours (pasteKey), ahead of the field's own: bound on the field's key context
    // (Input) under the composer's card only (KtComposer, composerView), so no other field changes. Probed
    // on 2026-11-19: this binding wins and the field pastes nothing. The keymap is the app's: a reload binds
    // the same again, which changes nothing.
    // i18n: tech
    cx.bind_keys([{ keystroke: "cmd-v", action: "kt_chat_paste", context: "KtComposer > Input" }]);
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
        else if (name === "background") {
          if (this.bgMenu) this.closeBg(cx);
          else this.bgMenu = true;
        }
        else if (name === "tl") this.tlCommand(arg, cx);
        else if (name === "confirmed") this.confirmed(cx, arg); // kt-confirm said yes to a /command (askRoute's id)
        else if (name === "compact-ok") this.compactor.yes(arg); // kt-confirm said yes to « Compacter » (its ask's id)
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
    // A status line written before it published transcript_path: the session's file by its id, a plain
    // name only (letters, digits, dashes: a uuid), never a path that would leave the projects' folders.
    if (!/^[A-Za-z0-9-]{1,128}$/.test(String(line?.session_id ?? ""))) return null;
    const r = await exec("/bin/sh", ["-c", 'ls -1 "$HOME"/.claude/projects/*/"$1".jsonl 2>/dev/null | head -1', "sh", line.session_id]).catch(() => null); // i18n: tech
    return r?.stdout?.trim() || null;
  }

  async index(path, extra = [], lim = {}) {
    const args = [`${appHome()}/mods/kt-chat/chat-index.ts`, path, "--last-turns", String(lim.turns ?? K), "--budget", String(lim.budget ?? BUDGET), "--max-entries", String(lim.entries ?? MAX_ENTRIES), ...extra];
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
              this.win = win.bottom(this.turns.length);
              this.reveal = "bottom";
              this.farTo = null;
              this.readSummary(cx, path);
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

  /**
   * #59: the timeline's summary of the whole file (chat-index.ts --marks: every turn's opener and
   * Kylian's messages, from the lines' heads, ~0.2 s on a 160 MB transcript), after a full read. Without
   * it, the timeline lists the loaded turns' messages only, as before.
   */
  readSummary(cx, path) {
    cx.spawn(async (cx) => {
      try {
        const s = await this.index(path, ["--marks"]);
        if (this.state?.path !== path || !Array.isArray(s?.marks)) return;
        this.summary = s;
        this.marks = allMarks(s, markList(this.turns), this.state.start);
        cx.notify();
      } catch {
        // the loaded turns' messages stay what the timeline lists
      }
    });
  }

  /**
   * #59: a message of the timeline above what is loaded (i -1: from the summary). Reads go up from the
   * first loaded byte, bounded by the summary's turn openers (timeline.js readFrom, FAR turns at most a
   * read), until its turn is in; then the jump, as to any loaded message. The view stays where it is
   * meanwhile (the head says « lecture… »); the bottom, another jump or a key cancel it (farTo).
   */
  reach(m, cx) {
    if (this.olderBusy || !this.summary || !this.state) return;
    const target = this.summary.turns.find((t) => t.uuid === m.turn)?.o ?? m.o;
    this.farTo = m.id;
    this.follow = false; // the live tail's trim keeps what is read (tail(): keepFrom)
    this.olderBusy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        while (this.farTo === m.id && this.state?.more && this.state.start > target) {
          const s = this.state;
          const out = await this.index(s.path, ["--from", String(readFrom(this.summary.turns, s.start, target, FAR.turns)), "--to", String(s.start)], FAR);
          const next = prepend(this.state, out);
          if (next === this.state) break; // another state meanwhile (a full read, another agent): it no longer continues
          this.state = next;
          this.rebuild(this.builtLive, false); // the same turns drawn, now after the read ones
          cx.notify(); // the timeline as it fills in
        }
        const k = this.farTo === m.id ? this.marks.findIndex((x) => x.id === m.id) : -1;
        if (k >= 0 && this.marks[k].i >= 0) {
          this.farTo = null;
          this.jumpTo(k, cx);
        }
      } catch (e) {
        notify({ title: tr("empty.failed.title"), body: String(e?.message ?? e).slice(0, 300), level: "error" });
      } finally {
        if (this.farTo === m.id) this.farTo = null;
        this.olderBusy = false;
        cx.notify();
      }
    });
  }

  /** The live tail of `path` into the state. Answers whether anything changed (a redraw is due). */
  async tail(path, live) {
    // #59: the chain's last link read, so a prompt that went back (a rewind) is seen in the delta.
    const out = await this.index(path, ["--from", String(this.state.end), ...(this.state.tail ? ["--tail", this.state.tail] : [])]);
    if (out.error === "missing") {
      this.err = { code: "missing", path };
      this.state = null;
      this.turns = [];
      return true;
    }
    // It went back to a message read before this delta: its abandoned branch is in the state, the
    // whole tail is read again (chat-index.ts drops the branch there). Rare: a rewind.
    if (out.rewound) {
      this.again = "full";
      return false;
    }
    const before = this.state;
    const grown = ingest(before, out);
    // Not following the bottom, the turns drawn stay (#59: a « Tours précédents » read while it works
    // would go at the next tick): the trim stops at the window's first turn. While reads go up toward a
    // message far above (reach()), every loaded turn stays: they are what the next read continues.
    const keepFrom = this.follow ? null : (this.farTo ? this.turns[0] : this.turns[this.first()])?.id ?? null;
    this.state = trim(grown, win.keepFor(grown.entries, keepFrom, KEEP));
    // ingest keeps the entries array when nothing came (skipped lines only), trim when under KEEP.
    const grew = this.state.entries !== before.entries;
    if (!grew && live === this.builtLive) return false; // the state still moves on to the new end
    // The cursor follows its turn by id (turns come in at the bottom, old ones go at the top); the
    // drawn window too (rebuild: remap): it slides with the end while following it, else it keeps its
    // turns and the new ones wait in « Tours suivants ».
    const curId = this.cur >= 0 ? this.turns[this.cur]?.id : null;
    this.rebuild(live);
    this.cur = curId ? this.turns.findIndex((t) => t.id === curId) : -1;
    if (this.follow) this.reveal = "bottom";
    return true;
  }

  /** The turns built again from the state; the drawn window follows its turns by id (turn-window.js remap). */
  rebuild(live, follow = this.follow) {
    const was = this.turns.map((t) => t.id);
    this.builtLive = live;
    // Turn by turn (chat-model.js buildInc): a live tick builds the turns its lines touch, not the
    // whole read (A4: ~15 ms per 1000 entries, every tick, when the reader had gone far back).
    this.turns = this.state ? buildInc(this.state.entries, { live, cache: this.built }) : [];
    this.win = win.remap(this.win, was, this.turns.map((t) => t.id), follow);
    // Messages typed while it works, not taken yet: their « en file » bubbles under the live turn.
    this.queued = live && this.state ? pendingQueue(this.state.entries) : [];
    // The counts, once per turn built rather than on every render: the fold's, each phase's (a turn
    // buildInc kept has its own already).
    // #93: its assets too (assets.js turnAssets: its tools', the files its answer cites, found and checked
    // on the disk by the indexer), here and never in render: render only reads `turn.assets`.
    const session = this.state?.session, cwd = this.state?.meta?.cwd ?? null;
    for (const turn of this.turns) {
      if (turn.counted) continue;
      turn.counted = true;
      turn.tally = turn.fold ? tally(foldedSteps(turn.items, turn.fold)) : null;
      for (const it of turn.items) if (it.type === "activity") it.tally = tally(it.steps);
      const seen = attachmentsOf(turn.user, turn.files, session)
        .map((a) => (a.ref ? a.key : a.abs ?? (a.path?.startsWith("/") ? a.path : cwd && a.path ? `${cwd}/${a.path}` : null)));
      turn.assets = turnAssets(turn, { session, cwd, home: home(), seen }).all;
    }
    // The timeline's messages, here rather than in render; the heights of turns gone (trim) go too.
    this.marks = allMarks(this.summary?.path === this.state?.path ? this.summary : null, markList(this.turns), this.state?.start ?? 0);
    const rows = new Set(this.turns.map((t) => `kc-turn-${t.id}`));
    for (const k of this.hts.keys()) if (k.startsWith("kc-turn-") && !rows.has(k)) this.hts.delete(k);
    if (this.byState) for (const k of this.byState.keys()) if (!rows.has(k.slice(0, k.lastIndexOf("|")))) this.byState.delete(k);
    this.noteFresh(was, live);
  }

  /**
   * #92: what arrived live, to fade in where it lands (turn()): a turn after the last one this build
   * found, an item new in the live turn. Never on a first build, an older read (it comes above) or
   * another agent's (the last turn known isn't there); ids of turns gone are let go.
   */
  noteFresh(was, live) {
    this.fresh ??= new Set(); // a bare instance too (scroll.check.mjs builds one without init)
    const a = arrivals(was, this.turns, live, this.liveItems);
    for (const id of a.fresh) this.fresh.add(id);
    this.liveItems = a.seen;
    if (!this.fresh.size) return;
    // Only what is still there: the turns', and the items of the last ones (where arrivals are).
    const here = new Set(this.turns.map((t) => t.id));
    for (const t of this.turns.slice(-2)) for (const it of t.items) here.add(it.id);
    for (const id of this.fresh) if (!here.has(id)) this.fresh.delete(id);
  }

  /**
   * #92: an element that comes in as the popups do (fades in, rises DY.row) when it arrived live, else
   * drawn as it is: enter() with its id marked shown. Its place is taken at once in the flow (the
   * scroll's height doesn't move, a followed bottom stays put): the rise is inside a box that clips, so
   * nothing goes over a neighbour. Once it has come in, it leaves `fresh` (a window change brings it back
   * as it is). `el`: a div / h_flex / v_flex with no id of its own. `fresh`: the set of what arrived
   * (the turns' by default; a sub-agent's own, #58).
   */
  landing(el, key, id, fresh = this.fresh) {
    const wid = `kc-in-${id}`;
    if (fresh.has(key) && this.m.shown.has(wid)) fresh.delete(key);
    if (!fresh.has(key)) this.m.shown.add(wid);
    // The rise is clipped below, never on the sides: the clipping box has ROOM px of room left and right
    // (a row drawn a little out to the left keeps its edge: a sub-agent's head, ml(-6); a copy button,
    // ml(-4)). It is stretched by a column flex, as those rows are: its negative margins widen it.
    // Not overflow_y_hidden: gpui's mask still cuts x at the element's bounds (style.rs overflow_mask).
    // Cold review, point 3.
    return v_flex().w_full().min_w(0).child(div().mx(-ROOM).px(ROOM).min_w(0).overflow_hidden().child(enter(this.m, el, wid, { dy: DY.row })));
  }

  /**
   * #92: a block coming in as the popups do (fades in, rises DY.row) inside a box that clips: its place
   * taken at once, nothing over a neighbour. `going`: the name it goes away under (out(), goOut()).
   */
  rise(el, id, going = null) {
    return div().w_full().min_w(0).overflow_hidden().child(this.out(enter(this.m, el, id, { dy: DY.row }), going));
  }

  /** #92: a block going away (goOut()): it fades out where it stands (MS.leave, ease-in), still drawn. */
  out(el, going) {
    return going && this.going?.has(going) ? el.opacity(0).transition("opacity", { duration: MS.leave, easing: "ease-in" }) : el;
  }

  /**
   * #92: lets `id` go: drawn fading out (out()) for MS.leave, then ONE cx.timer.after runs `drop` (what
   * stops drawing it) and redraws: motion.js leave()'s way, for a block of the page. Reduced motion: at
   * once. `inRender`: called while rendering (a ledge whose data went), which draws it fading already.
   */
  goOut(cx, id, drop, { inRender = false } = {}) {
    if (this.m.reduced) {
      drop();
      if (!inRender) cx.notify();
      return;
    }
    if (this.going.has(id)) return;
    this.going.add(id);
    if (!inRender) cx.notify();
    cx.timer.after(MS.leave + 40, (cx) => {
      if (!this.going.delete(id)) return; // came back meanwhile
      drop();
      cx.notify();
    });
  }

  /** The first turn drawn (turn-window.js: [from, to), CAP turns at most). */
  first() {
    return Math.min(this.win.from, this.turns.length);
  }

  /** After the last turn drawn: the end, or the first of « Tours suivants ». */
  end() {
    return Math.min(this.win.to, this.turns.length);
  }

  /**
   * « Tours précédents »: the loaded turns not drawn yet first, then a read before the first one;
   * the window fills up to CAP first (the live turn stays), then slides, the bottom ones going to
   * « Tours suivants » (turn-window.js older). Either way the turn that was first drawn stays
   * where the reader was looking. The caller redraws.
   */
  older(cx) {
    const was = this.first();
    if (was > 0) {
      this.win = win.older(this.win);
      this.reveal = childOf(was, this.first());
      this.cur = was; // j k go on from what is read, not from a turn the window left
      this.light(was);
      if (this.end() < this.turns.length) this.follow = false;
      return;
    }
    if (!this.state?.more || this.olderBusy) return;
    this.olderBusy = true;
    cx.spawn(async (cx) => {
      try {
        // The state as it is when the read lands, not as it was when it left (A3): a live tick or
        // another agent may have replaced it meanwhile; prepend() refuses a read that no longer
        // continues it (another file, a start the trim moved).
        const out = await this.index(this.state.path, ["--to", String(this.state.start)]);
        const next = prepend(this.state, out);
        if (next !== this.state) {
          this.state = next;
          this.rebuild(this.builtLive, false); // the same turns drawn, now after the read ones
          const at = this.first(); // where the turn that was first drawn is now
          this.win = win.older(this.win);
          this.reveal = childOf(at, this.first());
          this.cur = at;
          this.light(at);
          if (this.end() < this.turns.length) this.follow = false;
        }
      } catch (e) {
        notify({ title: tr("empty.failed.title"), body: String(e?.message ?? e).slice(0, 300), level: "error" });
      } finally {
        this.olderBusy = false;
        cx.notify();
      }
    });
  }

  /** « Tours suivants »: SHOW more below, the top ones out past CAP; the last turn drawn stays in view. */
  newer() {
    const was = this.end() - 1;
    this.win = win.newer(this.win, this.turns.length);
    this.reveal = childOf(was, this.first());
    this.cur = was;
    this.light(was);
  }

  /** No wheel measures a scroll the Chat makes itself: the timeline lights the message of the turn it brings (A7). */
  light(i) {
    this.tlId = this.marks[ownerOf(this.marks, i)]?.id ?? null;
    this.tlAbove = false;
    this.tlLost = false;
  }

  // ---------- keys ----------

  key(e, cx) {
    // #93: Cmd+C with the pointer on a piece's card copies the piece as a file (the field, when it has the
    // keyboard, copies its text: this key never comes here then).
    if (e?.keystroke === "cmd-c" && this.hoverPiece) {
      this.copyPiece(cx, this.pieceHover, this.hoverPiece);
      cx.stop_propagation();
      return;
    }
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* and the app's keys go on
    cx.stop_propagation();
    cx.notify();
  }

  press(e, cx) {
    // The composer has the keyboard: typing is its own; esc gives the keyboard back to the turns. The
    // completion menu open (#81) takes its keys first: esc closes it (a second esc gives the keyboard back).
    if (this.typing) {
      if (this.menuKey(keyOf(e).name, cx)) return true;
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
      this.win = win.reach(this.win, n, to); // the cursor draws the turn it reaches, CAP at most
      this.reveal = childOf(to, this.first());
      this.jump = null; // a jump still waiting for its rows: this move wins
      this.farTo = null; // a read toward a message far above too (reach())
      this.light(to); // the timeline lights the cursor's message
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
        if (to >= 0) this.jumpTo(to, cx);
        return true;
      }
      case "open": {
        const turn = this.turns[at];
        if (turn?.fold) {
          this.toggle(`f:${turn.id}`);
          this.foldAt = { id: turn.id, at: Date.now() }; // #92: its items open or close on their height
        }
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
    const atts = this.drafts;
    const can = canSend({ status: this.fixed ? null : a?.status ?? null, text: this.draft, sending: this.sending, atts: atts.length });
    if (!can.ok) {
      if (can.why === "blocked") this.sendErr = { why: "blocked" };
      cx.notify();
      return;
    }
    this.sending = true;
    this.sendErr = null;
    const text = this.draft;
    cx.spawn(async (cx) => {
      // #81: a /command alone (no file waiting) takes its route (complete.js routeOf): herdr-bridge types
      // it when its session token is fresh (sayReady: no token, nothing else asked), a Claude Code built-in
      // goes as keys (keysend.js), the rest by hc send (a skill: the agent invokes it). /clear, /exit and
      // /logout ask first (kt-confirm).
      const r = !atts.length && /^\s*\//.test(text) ? routeOf(text, { say: await this.sayReady(a) }) : { via: "send" };
      if (r.via === "none") return this.done(cx, text, atts, { ok: false, why: "untypable" });
      if (r.confirm) {
        this.sending = false;
        this.askRoute(a, r, text);
        return cx.notify();
      }
      this.done(cx, text, atts, await this.deliver(cx, a, r, text, atts));
    });
  }

  /** The draft sent its route's way: { ok } or { ok: false, why, message }. */
  async deliver(cx, a, r, text, atts) {
    if (r.via === "keys") return this.keysSend(cx, a.address, r, text);
    if (r.via === "say") {
      const s = await sayBridge(a.address, text.trim(), ioOf(HOST, cx, a.address));
      return s.ok ? s : { ok: false, why: sayFail(s.why) }; // its own words, never the plugin's raw code
    }
    // #93: the files above the field go with it, as `@path` (attach.js promptOf; composer.js clean()
    // keeps a mention at either end apart from hc's envelope).
    return sendResult(await hc(sendArgs(a.address, promptOf(text, atts))).catch((e) => (e instanceof Error ? e : new Error(String(e)))));
  }

  /** A send's end. Sent: only what went leaves the field (typing meanwhile stays, a file added meanwhile
   *  too; the sent pieces go at once, as the text does), and the live tail shows it come in. Refused or
   *  failed: the text stays and the reason shows under the field. */
  done(cx, text, atts, res) {
    this.sending = false;
    if (res.ok) {
      if (this.composer.value() === text) {
        this.composer.set_value("");
        this.cpl.pieces.clear();
      }
      this.cpl.dismissed = null;
      this.draft = this.composer.value();
      const went = new Set(atts.map((x) => x.id));
      this.drafts = this.drafts.filter((x) => !went.has(x.id));
      if (!this.drafts.length) this.open.delete("p:drafts"); // the next pieces start on two rows again
      if (this.pieceHover?.startsWith("kc-pc-d:")) this.pieceHover = this.hoverPiece = null; // the field's cards went: no Cmd+C on one
      this.follow = true;
      this.jump = null;
      this.win = win.bottom(this.turns.length);
      this.reveal = "bottom";
      this.load(cx, true);
    } else this.sendErr = res;
    cx.notify();
  }

  /**
   * #81, keysend.js keysSend (shared with Context's « Compacter »): a Claude Code built-in typed into the
   * agent's prompt, then Enter, only at rest: its status idle or done, its prompt empty on screen (`hc
   * read`), then reading exactly the command once typed, its command list's chosen row too (read again a
   * few times while the screen catches up: never Enter on a doubt). Any step that fails stops before
   * Enter: what was typed stays in the terminal's prompt, never sent.
   */
  keysSend(cx, address, r, text) {
    return keysRoute(ioOf(HOST, cx, address), address, r.keys, text);
  }

  /** #81, keysend.js sayReadyOf: herdr-bridge can type a /command into this agent's box (its session token
   *  fresh). No token file: false at once. This computer's agents only (the Chat writes to no other). */
  sayReady(a) {
    return sayReadyOf(ioOf(HOST, null, a?.address), a?.address); // no sleep in it: no cx needed
  }

  /** A built-in that resets or ends the session (/clear, /exit, /logout) asks first: kt-confirm, which
   *  sends `kt-chat.confirmed:<id>` back (confirmed()). The id is this ask's own (its terminal and a
   *  token, kt-plugins' way): a cancelled ask gets no callback, so it never runs later when another
   *  copy's dialog says yes; a newer ask here replaces it. */
  askRoute(a, r, text) {
    const id = `${a.address}~${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
    this.pendingRoute = { id, address: a.address, r, text, at: Date.now() };
    openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: {
      title: tr("composer.confirm.title", { cmd: text.trim().split(/\s+/)[0] }), detail: tr("composer.confirm.detail"),
      label: tr("composer.confirm.label"), danger: true, command: { name: `kt-chat.confirmed:${id}` } } });
  }

  /** kt-confirm said yes to `id`: only the copy that asked it, while it is fresh (ASK_TTL), sends it, to
   *  the same agent only (keysSend checks it is at rest again). Another id leaves this copy's ask alone. */
  confirmed(cx, id) {
    const p = this.pendingRoute;
    if (!p || !id || p.id !== id) return;
    this.pendingRoute = null;
    const a = target().agent;
    if (Date.now() - p.at > ASK_TTL || a?.address !== p.address || this.sending) return;
    this.sending = true;
    this.sendErr = null;
    cx.spawn(async (cx) => this.done(cx, p.text, [], await this.deliver(cx, a, p.r, p.text, [])));
  }

  // ---------- the completions (#81) ----------

  /**
   * On each change of the field (never in render): the menu for its text and cursor (completer.js), its
   * catalog read again when older than STALE, a /command typed by hand at the head made a chip with its
   * wave (once per place), the route that command takes (the line under the card). true: what shows changed.
   */
  complete(cx) {
    const c = this.cpl;
    if (c.quiet) return false; // its own chip going in (below): the change it raises is not Kylian's
    const was = c.menu;
    const { end } = this.composer.selected_range();
    // Esc closed one token: another one (or none) under the cursor and the menu may open again.
    const tok = tokenAt(this.draft, end);
    if (c.dismissed && (tok?.trigger !== c.dismissed.trigger || tok?.start !== c.dismissed.start)) c.dismissed = null;
    c.menu = menuFor(this.draft, end, c.catalog, { prev: was, dismissed: c.dismissed });
    if (c.menu && !was) c.gen++;
    if (c.menu) c.last = c.menu;
    else if (was) this.menuGone(cx);
    if (c.menu && Date.now() - c.at > STALE) this.loadCatalog(cx);
    const ty = typedCommand(this.draft, c.catalog.commands);
    let made = false;
    if (!ty) c.typedAt = null;
    else if (c.typedAt !== ty.start) {
      c.typedAt = ty.start;
      // Picked from the menu, it is a chip already (and its wave ran: accept() set typedAt).
      if (!(this.composer.content().tokens ?? []).some((s) => s.range.start === ty.start)) {
        c.pieces.set(ty.piece.id, ty.piece);
        if (CHIPS) {
          // The token puts the cursor at its end: put back where it was (the same length) before any
          // change it raises is read (quiet: whatever order the events come in).
          c.quiet = true;
          try {
            this.composer.replace_range_with_token({ start: ty.start, end: ty.start + ty.piece.text.length }, { id: ty.piece.id, text: ty.piece.text, label: ty.piece.label });
            this.composer.set_selected_range({ start: end, end });
          } finally {
            c.quiet = false;
          }
        }
        this.wave = { id: `kc-wave-${++c.n}`, ...effectOf(ty.piece) };
        made = true;
      }
    }
    // The route the command at the head would take (herdr-bridge's is asked only as it goes: send()).
    const head = /^\s*\/(\S+)/.exec(this.draft)?.[1];
    const route = head && c.catalog.commands.some((x) => x.name === head) ? routeWords(routeOf(this.draft, { say: false })) : null;
    const changed = made || was !== c.menu || route !== c.route;
    c.route = route;
    return changed;
  }

  /** The menu's active row into the field (completer.js pick): a chip (CHIPS) then a space, with its wave;
   *  a server only narrows the list to its tools (the menu stays). A press reads the menu fading too. */
  accept(i, cx) {
    const c = this.cpl;
    const menu = c.menu ?? c.last;
    const row = menu?.rows?.[i];
    if (!row) return;
    const program = target().agent?.program ?? "claude";
    const p = menuPick(menu, row, { mention: (x) => mentionText(program, x) });
    c.dismissed = null;
    if (p.piece?.kind === "command") c.typedAt = p.start; // its wave is this one: complete() makes no second
    if (p.piece && CHIPS) {
      c.pieces.set(p.piece.id, p.piece);
      this.composer.replace_range_with_token({ start: p.start, end: p.end }, { id: p.piece.id, text: p.piece.text, label: p.piece.label });
      this.composer.replace(" ");
    } else {
      this.composer.set_selected_range({ start: p.start, end: p.end });
      this.composer.replace(p.text);
    }
    if (p.piece) this.wave = { id: `kc-wave-${++c.n}`, ...effectOf(p.piece) };
    this.composer.focus();
    cx.notify();
  }

  /** The menu's keys while it is open: Tab takes the active row, ctrl-n / ctrl-p (↓ ↑ when the field
   *  leaves them to the view) move it, esc closes it until another token. true: the key was the menu's. */
  menuKey(name, cx) {
    const c = this.cpl;
    if (!c.menu) return false;
    if (name === "escape") {
      c.dismissed = { trigger: c.menu.trigger, start: c.menu.start };
      this.closeMenu(cx);
      return true;
    }
    if (name === "tab") {
      if (c.menu.rows.length) this.accept(c.menu.active, cx);
      return true;
    }
    const dir = name === "ctrl-n" || name === "down" ? 1 : name === "ctrl-p" || name === "up" ? -1 : 0;
    if (!dir) return false;
    c.menu = menuMove(c.menu, dir);
    c.last = c.menu;
    this.menuScroll.scroll_to_item(c.menu.active + 1); // the list's first child is the active row's fill
    return true;
  }

  closeMenu(cx) {
    if (!this.cpl.menu) return;
    this.cpl.menu = null;
    this.menuGone(cx);
  }

  /** The menu that just closed fades out (menu.js, MS.leave), then ONE timer lets it go; reduced motion: at once. */
  menuGone(cx) {
    const c = this.cpl;
    const last = c.last;
    if (!last) return;
    if (this.m?.reduced) {
      c.last = null;
      return;
    }
    cx.timer.after(MS.leave + 20, (cx) => {
      if (c.menu || c.last !== last) return;
      c.last = null;
      cx.notify();
    });
  }

  /**
   * What the menu completes, read off the UI thread, one read at a time: kt-keys' complete-index.ts (the
   * /commands on disk, the session's own listing and MCP tools from its transcript; bun, local) merged
   * with categories.js' classify, and the project's files (`git ls-files`, the agent's folder). Read
   * again only when older than STALE, as the menu opens or the field takes focus: never on a timer.
   */
  loadCatalog(cx) {
    const c = this.cpl;
    if (c.loading || checking()) return;
    c.loading = true;
    c.at = Date.now();
    const a = target().agent;
    const cwd = a ? panes().find((p) => p.terminal === a.address)?.cwd ?? null : null;
    const jsonl = this.line?.transcript_path ?? null;
    cx.spawn(async (cx) => {
      const args = [`${appHome()}/mods/kt-keys/complete-index.ts`, ...(cwd ? ["--root", cwd] : []), ...(jsonl ? ["--jsonl", jsonl] : [])];
      const r = await exec(`${home()}/.nix-profile/bin/bun`, args, { timeout: 20000 }).catch(() => null);
      let j = null;
      try {
        j = JSON.parse(r?.stdout || "null");
      } catch {
        j = null;
      }
      // Sorted by git (completer.js ranks them as they come); quotepath off: a path with an accent as
      // itself, not "\303\211" between quotes (the mention would name no file).
      const g = cwd ? await exec("git", ["-c", "core.quotepath=off", "-C", cwd, "ls-files", "-co", "--exclude-standard"], { timeout: 10000 }).catch(() => null) : null; // i18n: tech
      c.loading = false;
      if (j) c.catalog = { ...c.catalog, commands: merge(j.items, j.listing, classify), tools: j.tools ?? [] };
      if (g?.code === 0) c.catalog = { ...c.catalog, files: filesOf(g.stdout) };
      // The open menu again, on what was read.
      if (c.menu) {
        const { end } = this.composer.selected_range();
        c.menu = menuFor(this.draft, end, c.catalog, { prev: c.menu, dismissed: c.dismissed });
        if (c.menu) c.last = c.menu;
        else this.menuGone(cx);
      }
      cx.notify();
    });
  }

  /** The popup over the transcript's bottom, in the composer's column (menu.js): it never covers the
   *  card, and shows fewer rows when the transcript is short. null when nothing is open or fading. */
  menuEl(t) {
    const c = this.cpl;
    if (!c.menu && !c.last) return null;
    const rowsShown = Math.max(2, Math.min(ROWS, Math.floor((this.vh - 72) / ROW)));
    const v = menuView(t, this.m, c.menu, { last: c.last, gen: c.gen, dark: Boolean(settings().dark), onPick: (i, cx) => this.accept(i, cx), scroll: this.menuScroll, rows: rowsShown });
    if (!v) return null;
    return h_flex().absolute().left(0).right(0).bottom(8).justify_center()
      .child(v_flex().w_full().max_w(COLUMN).px(10).child(v));
  }

  // ---------- the field's attachments and « Citer » (#93) ----------

  /** Files to send with the message (attach.js add: absolute, once each, 10 at most); the field takes the keyboard. */
  attach(cx, paths, source) {
    const r = addDraft(this.drafts, paths, source);
    this.drafts = r.list;
    if (r.refused.length) notify({ title: tr("attach.refused", { n: r.refused.length }), body: r.refused.slice(0, 3).join("\n"), level: "warning", timeout: 4000 });
    if (r.added.length && this.composerShown()) this.composer.focus();
    cx.notify();
  }

  /**
   * Files dropped anywhere on the face, transcript included (Kylian: not only on the field). With the
   * background's panel open, an image among them goes to the background (the panel says so); otherwise,
   * or with no image, they join the message, when there is an agent to write to.
   */
  dropped(cx, paths, pr) {
    const img = this.bgMenu && pr ? paths.find((x) => IMAGE.test(x)) : null;
    if (img) this.importBg(cx, pr, img);
    else if (this.composerShown()) return this.attach(cx, paths, "drop");
    cx.notify();
  }

  /**
   * A paste the field found no text in: files copied in the Finder go as themselves; an image is written
   * under data/kt-chat/paste (the only copy #93 makes, the 12 newest kept) and goes as that file.
   */
  paste(cx) {
    if (checking() || this.pasting) return;
    this.pasting = true;
    const dir = `${appHome()}/${PASTE_DIR}`;
    const out = `${dir}/${pasteName(Date.now())}`;
    cx.spawn(async (cx) => {
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      const said = pasted(await exec("/usr/bin/osascript", pasteArgs(out), { timeout: 15000 }).catch((e) => e));
      this.pasting = false;
      if (said.files) this.attach(cx, said.files, "paste");
      else if (said.image) {
        this.attach(cx, [out], "paste");
        const keep = new Set(this.drafts.filter((x) => x.path.startsWith(`${dir}/`)).map((x) => x.label));
        for (const n of pasteSweep(await fs.readdir(dir).catch(() => []), keep)) await fs.unlink(`${dir}/${n}`).catch(() => {});
      } else if (said.failed) {
        this.sendErr = { why: "paste" };
        cx.notify();
      }
    });
  }

  /**
   * Cmd+V in the field (kt_chat_paste, bound in init ahead of the field's own paste). The Finder's copied
   * files join the message as a drop does, their names or paths never typed; any other text goes in as the
   * field would put it (one undo step); no text at all goes paste()'s way (files, else the image). Only a
   * text that may come with files (mayHoldFiles: gpui gives a copied file as its path) waits for the read
   * of the clipboard's files (osascript, 60 to 120 ms measured); any other text goes in at once. The
   * field's own paste stays for its menu (Edit > Paste: a Finder copy's paths typed there, as before).
   */
  pasteKey(cx) {
    let text = null;
    let unread = false; // the host refusing the read: the files are still asked for, and nothing is typed
    try {
      text = cx.read_from_clipboard(); // now: a task's cx is another, this one goes at the first await
    } catch {
      unread = true;
    }
    if (!unread && pasteChoice(text, null).other) return this.paste(cx);
    const put = (cx, c) => {
      if (c.files) return this.attach(cx, c.files, "paste");
      if (unread) this.sendErr = { why: "paste" };
      else {
        this.composer.replace(c.text);
        this.draft = this.composer.value();
      }
      cx.notify();
    };
    if (!unread && !mayHoldFiles(text)) return put(cx, pasteChoice(text, null));
    if (checking() || this.keyPasting) return;
    this.keyPasting = true;
    cx.spawn(async (cx) => {
      const said = pasted(await exec("/usr/bin/osascript", pasteArgs("", true), { timeout: 15000 }).catch((e) => e));
      this.keyPasting = false;
      put(cx, pasteChoice(unread ? null : text, said));
    });
  }

  /**
   * Cmd+C on a card under the pointer (key(): the keyboard on the Chat, not in the field, where Cmd+C copies
   * its text): the piece as a file on the clipboard (COPY_JXA, its URL alone), so the Finder pastes the
   * file, a chat or a mail attaches it, the field joins it. An image the transcript holds without a file is
   * decoded first (chat-att --full, into the bounded cache: one pasted long after may be gone). The card
   * says « Copié » for a moment (copy()'s one-shot timer). A remote agent's file isn't here: nothing.
   */
  copyPiece(cx, id, a) {
    if (checking()) return;
    if (!this.localFiles()) return notify({ title: tr("pieces.copyFailed"), body: a.name, level: "warning", timeout: 4000 });
    cx.spawn(async (cx) => {
      let path = a.abs?.startsWith("/") ? a.abs : null;
      if (!path && a.ref) {
        const argv = this.attArgv(a, true);
        const r = argv ? await exec(argv[0], argv.slice(1), { timeout: 30000 }).catch(() => null) : null;
        try { const j = JSON.parse(r?.stdout ?? ""); if (j?.full) path = `${appHome()}/${ATT_DIR}/${j.full}`; } catch { /* said below */ }
      }
      const r = path ? await exec("/usr/bin/osascript", copyArgs(path), { timeout: 15000 }).catch(() => null) : null;
      if (r?.code === 0 && r.stdout.trim() === "ok") {
        this.copied = id;
        cx.timer.after(1500, (cx) => {
          if (this.copied !== id) return;
          this.copied = null;
          cx.notify();
        });
      } else notify({ title: tr("pieces.copyFailed"), body: a.name, level: "warning", timeout: 4000 });
      cx.notify();
    });
  }

  /** The system's file chooser (osascript), in a task of its own: it waits for Kylian, nothing waits on it. */
  pick(cx) {
    if (checking() || this.picking) return;
    this.picking = true;
    cx.spawn(async (cx) => {
      const r = picked(await exec("/usr/bin/osascript", pickArgs(tr("attach.pickPrompt")), { timeout: 600000 }).catch((e) => e));
      this.picking = false;
      if (r.paths?.length) return this.attach(cx, r.paths, "pick");
      if (r.error) this.sendErr = { why: "pick", message: r.error };
      cx.notify();
    });
  }

  /** « Citer »: the message, or the part of it copied last (a selection), quoted into the field at its cursor. */
  cite(cx, text) {
    const q = quoteOf(text, cx.read_from_clipboard?.());
    if (!q || !this.composerShown()) return;
    this.composer.focus();
    this.composer.replace(q);
    this.draft = this.composer.value();
  }

  /**
   * The files waiting above the field, as cards (pieceCard), each with its × while hovered; a click opens
   * the viewer on them; two rows until « +N » shows them all. #92's rule for the composer: its height never
   * moves frame by frame (that resizes the transcript, areaSized redraws the Chat each frame, the followed
   * bottom shakes). So the grid takes or gives its height at once (« +N » too); a piece fades in rising
   * DY.row inside a box of its own size that clips (rise()'s way, for an inline piece); × fades it out where
   * it stands (goOut(): its place kept, then the height changes once); a sent message's pieces go at once.
   * Reduced motion: no fade, no timer.
   */
  draftView(t, cx) {
    if (!this.drafts.length) return null;
    const asAtt = (x) => ({ id: x.id, key: x.path, abs: x.path, name: x.label, ...x.doc }); // the viewer's and the thumbnail's
    const atts = this.drafts.map(asAtt);
    const out = (p) => `kc-dr~${p.id}`;
    const x = (p) => this.iconBtn(t, `kc-dx-${p.id}`, I("x"), tr("attach.remove"), (cx) => this.goOut(cx, out(p), () => {
      this.drafts = dropDraft(this.drafts, p.id);
      if (this.pieceHover === `kc-pc-${p.id}`) this.pieceHover = this.hoverPiece = null; // gone under the pointer: no Cmd+C on it
    }), 18);
    // enter() gives the motion's id to a box around the card: the card keeps its own id and handlers.
    const pop = (p, el) => div().flex_none().overflow_hidden().child(this.out(enter(this.m, div().child(el), `kc-dr-${p.id}`, { dy: DY.row }), out(p)));
    const w = Math.min(this.width || COLUMN, COLUMN) - 42; // the card's inside: composerView's px 10 and border 1, this row's px 10
    return div().id("kc-drafts").px(10).pt(10)
      .child(this.pieceGrid(t, "p:drafts", this.drafts.length, w, (i) => pop(this.drafts[i], this.pieceCard(t, cx, `kc-pc-${this.drafts[i].id}`, atts, i, { x: x(this.drafts[i]) }))));
  }

  /**
   * Under an answer: what its tools got back, read or wrote, and the files it cites (`turn.assets`, worked
   * out in rebuild(): render only reads it; a cited file the indexer didn't find on the disk isn't there).
   * One image alone as #80's photo at 160; more, or one that isn't an image, as cards (pieceCard), two rows
   * until « +N ». A click opens the viewer. Known with its turn, it comes as its turn does (landing()): no
   * motion of its own.
   */
  assetsRow(t, cx, turn) {
    const atts = turn.assets ?? [];
    if (!atts.length) return null;
    const own = { id: `${turn.id}-as` }; // its elements' ids, apart from the prompt's attachments'
    const w = Math.min(this.width || COLUMN, COLUMN) - 2 * COLUMN_PAD;
    const local = this.localFiles();
    const body = atts.length === 1 && atts[0].kind === "image" ? this.photo(t, cx, own, atts, atts[0], 0, 160)
      : this.pieceGrid(t, `p:${own.id}`, atts.length, w, (i) => this.pieceCard(t, cx, `kc-pc-${own.id}-${i}`, atts, i, { drag: local }));
    return v_flex().id(`kc-as-${turn.id}`).pt(12).min_w(0).child(body);
  }

  /**
   * #93: a piece's one card, wherever it shows (Kylian: one format for all): CARD (188 × 48), its 36
   * square on the left, an image's thumbnail cut to it (cover), else its family's dithered tile (tiles/,
   * pre-rendered by brand/piece-tiles.py: an asset read as it is, never worked out here) with its
   * extension over it; its name cut in the middle, « type · size » under it (a folder: no size). A click
   * opens the viewer at it. `x`: the field's ×, shown while the card is hovered, in its corner (the box
   * its rise clips in holds it); `drag`: a file on this computer can be dragged onto a terminal
   * (drag_paths: Herdr takes such a drag nowhere else).
   */
  pieceCard(t, cx, id, atts, i, { x = null, drag = false } = {}) {
    const a = atts[i];
    const info = this.attOf(cx, a);
    const dir = Boolean(info?.dir);
    const fam = familyOf(a.name, a.kind, { dir });
    const ext = extOf(a.name);
    const meta = [fam.type ? tr(`att.${fam.type}`) : fam.ext, info?.bytes != null && !dir ? sizeText(info.bytes) : null].filter(Boolean).join(" · ");
    const S = 36;
    const thumb = a.kind === "image" && info?.thumb ? `${ATT_DIR}/${info.thumb}` : null;
    const r = info?.w > 0 && info?.h > 0 ? info.w / info.h : 1;
    const [w, h] = r >= 1 ? [S * r, S] : [S, S / r];
    const square = div().relative().size(S).flex_none().rounded(8).overflow_hidden()
      .when(Boolean(thumb), (el) => el.child(image(thumb).absolute().left((S - w) / 2).top((S - h) / 2).w(w).h(h)))
      .when(!thumb, (el) => el.child(image(tileOf(fam.tile, Boolean(settings().dark))).absolute().left(0).top(0).size(S))
        .child(h_flex().absolute().left(0).top(0).size(S).items_center().justify_center()
          .child(dir || !ext ? svg(I(dir ? "folder" : "file")).size(16).text_color(ink(t, 0.85))
            : div().text_size(9.5).font_bold().text_color(ink(t, 0.9)).child(ext.toUpperCase().slice(0, 5)))));
    const hov = Boolean(x) && this.pieceHover === id;
    const said = this.copied === id ? tr("pieces.copied") : meta;
    return h_flex().id(id).relative().w(CARD.w).h(CARD.h).flex_none().gap(10).pl(5).pr(10).items_center().rounded(10)
      .bg(ink(t, 0.06)).border(1).border_color(ink(t, 0.08)).cursor_pointer().hover((s) => s.bg(ink(t, 0.1)))
      .tooltip(tr("pieces.tip"))
      .on_click((_e, cx) => this.openAtts(cx, atts, i))
      // The card under the pointer: Cmd+C copies its piece (key(), copyPiece); the field's shows its ×, so
      // only that one is drawn again when the pointer comes or goes.
      .on_hover((on, cx) => {
        const next = on ? id : this.pieceHover === id ? null : this.pieceHover;
        if (next === this.pieceHover) return;
        this.pieceHover = next;
        this.hoverPiece = next ? a : null;
        if (x) cx.notify();
      })
      .when(drag && Boolean(a.abs?.startsWith("/")), (el) => el.drag_paths([a.abs]))
      .child(square)
      .child(v_flex().flex_1().min_w(0)
        .child(div().min_w(0).overflow_hidden().whitespace_nowrap().text_ellipsis_middle().text_size(12.5).line_height("16px").text_color(ink(t, 1))
          .child(isPasteName(a.name) ? tr("att.pasted") : a.name))
        .when(Boolean(said), (el) => el.child(div().min_w(0).truncate().text_size(11).line_height("14px").text_color(ink(t, 0.5)).child(said))))
      .when(hov, (el) => el.child(div().absolute().top(5).right(5).rounded(6).bg(alpha(t.background, "cc")).child(x)));
  }

  /** « +N »: the grid's last place, the rest of its pieces in it; a click shows them all (one height change). */
  moreCard(t, id, n, onOpen) {
    return h_flex().id(id).w(CARD.w).h(CARD.h).flex_none().gap(8).items_center().justify_center().rounded(10)
      .border(1).border_dashed().border_color(ink(t, 0.18)).cursor_pointer().hover((s) => s.bg(ink(t, 0.06)))
      .on_click((_e, cx) => { cx.stop_propagation(); onOpen(); cx.notify(); })
      .child(div().text_size(15).font_semibold().text_color(ink(t, 1)).child(tr("pieces.more", { n })))
      .child(div().text_size(11.5).text_color(ink(t, 0.5)).child(tr("pieces.all")));
  }

  /**
   * #93: `n` pieces as a grid of cards (`card(i)` draws the i-th): as many columns as `w` px hold, at
   * most that wide (max_w: a guess a few px too wide only costs a row), two rows until « +N » opens it
   * all (`key` in this.open). `end`: on the right (a sent message's).
   */
  pieceGrid(t, key, n, w, card, { end = false } = {}) {
    const cols = colsFor(w);
    const plan = gridPlan(n, cols, this.open.has(key));
    const cells = Array.from({ length: plan.shown }, (_, i) => card(i));
    if (plan.more) cells.push(this.moreCard(t, `kc-more-${key}`, plan.more, () => this.open.add(key)));
    return h_flex().max_w(gridW(cols)).flex_wrap().gap(CARD.gap).when(end, (el) => el.justify_end()).children(cells);
  }

  /** Whether the shown agent's files are on this computer (a remote one's address is `machine/tN`): only those drag. */
  localFiles() {
    return !String(target().agent?.address ?? "").includes("/");
  }

  // The blocked agent's request (decide.js reads the bridge's cache, or the screen for a held message):
  // read when the status turns blocked, dropped when it leaves it.
  readDecision(cx, address) {
    cx.spawn(async (cx) => {
      const d = await decide(address).catch(() => null);
      const still = target().agent?.address === address && target().agent?.status === "blocked";
      if (still) {
        this.decision = d;
        this.ask = askOf(d?.pending, null);
        this.askOpen = false;
      }
      cx.notify();
      // #79: the call itself, read back from the transcript by its id: what an edit changes (the bridge
      // publishes its path only). Never during the render.
      const id = still ? callId(d?.pending) : null;
      const path = this.state?.path;
      if (!id || !path) return;
      const r = await exec(`${home()}/.nix-profile/bin/bun`, [`${appHome()}/mods/kt-chat/chat-index.ts`, path, "--tool", id], { timeout: 20000 }).catch(() => null);
      let call = null;
      try {
        call = JSON.parse(r?.stdout || "null")?.call ?? null;
      } catch {
        call = null;
      }
      if (this.decision === d) {
        this.ask = askOf(d?.pending, call);
        cx.notify();
      }
    });
  }

  // « Ouvrir le terminal »: the thread's panes again (thread-body on main, no motion), the keyboard to
  // this Chat's agent's pane, as kt-head's view.js does on ctrl-b space.
  openTerminal() {
    run("layout.select", { stack: "thread-body", child: "main" });
    const a = target().agent;
    if (a) run("pane.focus", { terminal: a.address });
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
    // A Haze's variants: only those shown now stay (#87), each project's last texture.
    const inUse = new Set([...this.bgLast.values()].map((v) => v.path).filter(Boolean));
    cx.spawn(async () => {
      const names = await fs.readdir(dir).catch(() => []);
      for (const n of orphans(names, all, inUse)) {
        await fs.unlink(`${dir}/${n}`).catch(() => {});
        for (const [k, v] of this.bgDone) if (v.path?.endsWith(`/${n}`) || v.src?.endsWith(`/${n}`)) this.bgDone.delete(k);
      }
    });
  }

  /**
   * chat-bg.ts on `src` for `fx` ({ effect, cell, tint, empty, rows, ground }, fxOf): { src, path, w, h }
   * or throws.
   */
  async texture(src, fx) {
    const args = [`${appHome()}/mods/kt-chat/chat-bg.ts`, src, "--out", `${appHome()}/data/kt-chat`, "--effect", fx.effect, "--cell", String(fx.cell ?? 2),
      ...(fx.tint ? ["--tint", fx.tint] : []), ...(fx.empty ? ["--empty"] : []), ...(fx.rows ? ["--rows", String(fx.rows)] : []), ...(fx.ground ? ["--ground", fx.ground] : [])];
    const r = await exec(`${home()}/.nix-profile/bin/bun`, args, { timeout: 120000 });
    const out = JSON.parse(r.stdout || "null");
    if (!out || out.error) throw new Error(out?.message ?? out?.error ?? (r.stderr || `exit ${r.code}`).trim());
    return out;
  }

  /**
   * What a setting's texture is made of (#87): the dither's cell and tint; for the Haze, the view
   * (empty or not, the image rows it shows by steps of 128, the theme's ground: Monocode's 23,23,23 in
   * a dark theme, the light theme's own background there).
   */
  fxOf(t, s, pr) {
    if (s.effect === "dither") return { effect: "dither", cell: s.cell, tint: s.color === "project" ? pr.tint : null };
    if (s.effect !== "haze") return { effect: s.effect };
    const rows = this.size && s.w && s.h ? hazeRows({ w: Math.floor(this.size.w), h: Math.floor(this.size.h), iw: s.w, ih: s.h }) : 0;
    return { effect: "haze", empty: !this.turns.length, rows, ground: settings().dark ? HAZE_DARK : String(t.background).slice(0, 7) };
  }

  bgKey(src, fx) {
    return [src, fx.effect, fx.cell ?? "", fx.tint ?? "", fx.empty ? 1 : 0, fx.rows ?? "", fx.ground ?? ""].join("|");
  }

  /**
   * The texture for these settings: made once (then kept). While it is made (another effect, a Haze's
   * new height or theme), the project's last one stays on screen (#87); null before any.
   */
  bgImage(cx, s, fx, project) {
    const k = this.bgKey(s.src, fx);
    const done = this.bgDone.get(k);
    if (done) {
      this.bgLast.set(project, done);
      return done;
    }
    if (!checking() && !this.bgBusy.has(k)) {
      this.bgBusy.add(k);
      cx.spawn(async (cx) => {
        try {
          const out = await this.texture(s.src, fx);
          this.bgDone.set(k, out);
          // Shown from now: the sweep it asks for keeps this Haze variant and lets the one before go.
          this.bgLast.set(project, out);
          if (fx.effect === "haze") this.cleanDue = true;
        } catch (e) {
          this.bgNote = { err: String(e?.message ?? e).slice(0, 200) };
        } finally {
          this.bgBusy.delete(k);
          cx.notify();
        }
      });
    }
    return this.bgLast.get(project) ?? null;
  }

  /**
   * A chosen image (the picker, a drop) for the project: kept and resized once (its dither made on the
   * way: another effect's texture follows at the next render, the sweep lets the dither go).
   */
  importBg(cx, pr, path) {
    if (!pr || !path) return;
    const s = this.bgOf(pr.key);
    const cell = s?.cell ?? 2;
    const color = s?.color ?? "photo";
    const fx = { effect: "dither", cell, tint: color === "project" ? pr.tint : null };
    this.bgNote = { busy: true };
    cx.spawn(async (cx) => {
      try {
        const out = await this.texture(path, fx);
        this.bgDone.set(this.bgKey(out.src, fx), out);
        this.setBg(pr.key, { src: out.src, w: out.w, h: out.h, effect: s?.effect ?? "dither", cell, color, opacity: s?.opacity ?? OPACITY.dflt, scope: s?.scope ?? "all" });
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
    const img = this.bgImage(cx, s, this.fxOf(t, s, pr), pr.key);
    if (!img) return null;
    const w = Math.floor(this.size.w), h = Math.floor(this.size.h); // no border: the whole block
    if (w <= 30 || h <= 30) return null;
    const haze = s.effect === "haze"; // its own fade, longer (chat-view.js fadeAt)
    const layers = bgLayers({ w, h, iw: img.w, ih: img.h, windows: bandWindows(w, h, 16, ALL), opacity: s.opacity, empty: !this.turns.length, haze });
    const src = appPath(img.path);
    // The veil under the reading column (chat-view.js veilRects: why, and why not a lower opacity).
    const ground = `${String(t.background).slice(0, 7)}${hex2(VEIL)}`;
    const veil = veilRects({ w, h, column: COLUMN, r: 16, empty: !this.turns.length, haze }).map((v) =>
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
      .on_click((_e, cx) => {
        if (Date.now() - (this.bgClosedAt ?? 0) <= 400) return;
        if (this.bgMenu) return this.closeBg(cx);
        this.bgMenu = true;
        cx.notify();
      })
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
    // 320 wide (#87): the five effects on one row (appearance.rs:23-39, its segmented « Background effect »).
    // #92: a popup: it comes in fading and rising DY.row (enter(), which gives it its id before its
    // handlers), and fades out before it goes (closeBg()).
    const panel = this.out(enter(this.m, v_flex().w(320).p(12).gap(10).rounded(12).border(1).border_color(ink(t, 0.1))
      .bg(t.popover).shadow_lg(), "kc-bg-panel", { dy: DY.row }), "kc-bg-panel")
      .on_mouse_down_out((_e, cx) => { this.bgClosedAt = Date.now(); this.closeBg(cx); })
      .child(div().text_size(12).font_semibold().text_color(ink(t, 1)).child(tr("bg.title", { project: pr.name })))
      .child(h_flex().gap(8).items_center().child(button("kc-bg-pick", tr("bg.pick"), (cx) => this.pickBg(cx, pr)))
        .when(Boolean(this.bgNote?.busy) || this.bgBusy.size > 0, (el) => el.child(svg(SPIN).size(12).text_color(t.working).spin(900))))
      .child(div().text_size(11).text_color(ink(t, 0.45)).child(tr("bg.drop")))
      .when(Boolean(this.bgNote?.err), (el) => el.child(div().text_size(11).text_color(ERR).child(tr("bg.failed", { why: this.bgNote.err }))))
      .when(Boolean(s), (el) => el
        .child(v_flex().gap(6)
          .child(div().text_size(11).text_color(ink(t, 0.5)).child(tr("bg.effect")))
          .child(seg("kc-bg-effect", EFFECTS.map((e) => [e, tr(`fx.${e}`)]), s.effect, (v) => this.setBg(pr.key, { effect: v })))
          .child(div().text_size(11).line_height("16px").text_color(ink(t, 0.45)).child(tr(`fxd.${s.effect}`))))
        // The dither's own (#57): its color and its cells.
        .when(s.effect === "dither", (el) => el
          .child(row(tr("bg.color"), seg("kc-bg-color", [["photo", tr("bg.photo")], ["project", tr("bg.project")]], s.color, (v) => this.setBg(pr.key, { color: v }))))
          .child(row(tr("bg.cell"), seg("kc-bg-cell", CELL_SIZES.map((c) => [c, `${c} px`]), s.cell, (v) => this.setBg(pr.key, { cell: v })))))
        .child(row(tr("bg.opacity"), h_flex().gap(4).items_center()
          .child(button("kc-bg-less", "−", () => nudge(-OPACITY.step))) // i18n: tech
          .child(div().w(44).text_size(12).text_color(ink(t, 1)).flex().justify_center().child(`${pct} %`))
          .child(button("kc-bg-more", "+", () => nudge(OPACITY.step))))) // i18n: tech
        .child(row(tr("bg.scope"), seg("kc-bg-scope", [["all", tr("bg.all")], ["empty", tr("bg.empty")]], s.scope, (v) => this.setBg(pr.key, { scope: v }))))
        .child(button("kc-bg-remove", tr("bg.remove"), () => this.setBg(pr.key, null), ERR)));
    return [btn, div().absolute().top(42).right(10).child(panel)];
  }

  /** #92: the background panel fades out, then closes (goOut()). */
  closeBg(cx) {
    this.goOut(cx, "kc-bg-panel", () => { this.bgMenu = false; });
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
   * view's top once its rows are measured (body(): the anchor). A note goes to its turn's top. One above
   * what is loaded (the summary's, #59): read up to it first (reach()).
   */
  jumpTo(k, cx = null) {
    const m = this.marks[k];
    if (!m) return;
    this.farTo = null; // another jump: a read toward an earlier one stops at its next step
    if (m.i < 0) {
      if (cx) this.reach(m, cx);
      return;
    }
    // Where the view leaves from, for the glide: the bottom while following, else the top last known;
    // unknown when the window moves its top (its rows above aren't the same), then the way it goes.
    const a = this.tlIndex(), g = this.geom(), was = this.first();
    const at = this.follow ? (g.known ? Math.max(0, g.end + 8 - this.vh) : null) : this.top;
    const dir = k > a ? 1 : k < a || this.tlAbove ? -1 : 0;
    this.cur = m.i;
    this.follow = false;
    this.win = win.at(this.win, this.turns.length, m.i); // not drawn: it and SHOW - 1 after it (#59)
    this.glideFrom = { from: this.first() === was ? at : null, dir };
    this.jump = m.turn;
    this.reveal = null;
    this.tlId = m.id;
    this.tlAbove = false;
    this.tlLost = false;
  }

  /** `tl:hover:<n>` (its card open, no delay), `tl:jump:<n>`, `tl:off`: the captures' pointer. */
  tlCommand(arg, cx = null) {
    const [what, at] = String(arg).split(":");
    const k = Number(at);
    if (what === "off") {
      this.tlHover = -1;
      this.tlOpen = false;
    } else if (Number.isInteger(k) && k >= 0 && k < this.marks.length) {
      if (what === "hover") {
        this.tlHover = k;
        this.tlOpen = true;
      } else if (what === "jump") this.jumpTo(k, cx);
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

  /**
   * A row's height (design px), and in which state its fold was drawn (`state`, A16: keepY()'s guess). A
   * redraw when a jump waits for it, or a press's keep has a correction to make (keepY), and under a
   * view that follows the bottom:
   * - the last row grows (A2): the bottom again. `pin` (col()): the render that drew the row brought
   *   the bottom itself (the live tail, a send, the runner's band), so the first size it makes is
   *   covered. A growth past that first size, or one no render brought the bottom for (a fold or
   *   « Afficher plus » opened at rest), is a motion on its height (rows(), collapse(): a new size every
   *   frame for MS.open): the bottom now when nothing brought it, once more when it has settled
   *   (settle(): one timer, never a render per frame);
   * - a row above it grows with no render that brought the bottom (a fold opened higher up, its items
   *   coming in on their height): what was clicked stays where it is, the bottom isn't followed any
   *   more (« ce qu'on vient de cliquer ne bouge pas »; the « bas » button brings it back).
   */
  measured(id, size, cx, pin = null, state = null) {
    const h = size.height / this.zoom();
    if (state) this.byState?.set(`${id}|${state}`, h);
    const was = this.hts.get(id);
    if (Math.abs((was ?? -9) - h) < 0.5) return;
    this.hts.set(id, h);
    if (this.keepRow?.correct) return cx.notify();
    if (this.follow && was != null && h > was) {
      if (id !== this.lastRow()) {
        if (pin) return;
        this.follow = false;
        return cx.notify();
      }
      if (pin && !pin.seen) pin.seen = true;
      else {
        if (!pin) {
          this.reveal = "bottom";
          cx.notify();
        }
        this.settle(cx);
      }
    } else if (this.jump != null) cx.notify();
  }

  /** The bottom once more after a motion (MS.open, and a frame or so), if the view still follows it. */
  settle(cx) {
    if (this.settling) return;
    this.settling = true;
    cx.timer.after(MS.open + 60, (cx) => {
      this.settling = false;
      if (!this.follow) return;
      this.reveal = "bottom";
      cx.notify();
    });
  }

  /** The scroll area's last row before its end mark, as body() draws them (geom()'s order). */
  lastRow() {
    if (this.end() < this.turns.length) return "kc-later";
    if (this.builtLive) return "kc-working";
    const t = this.turns[this.end() - 1];
    return t ? `kc-turn-${t.id}` : "kc-head";
  }

  /** The scroll area's rows, top to bottom (as body() draws them): { tops: turn id -> top, at: row id -> top, end, known }. */
  geom() {
    const turns = this.turns.slice(this.first(), this.end());
    const tail = this.end() < this.turns.length ? ["kc-later"] : this.builtLive ? ["kc-working"] : [];
    const ids = ["kc-head", ...turns.map((t) => `kc-turn-${t.id}`), ...tail];
    // The end mark: 1 px, never measured.
    const o = offsets([...ids.map((id) => this.hts.get(id)), 1], TOP_INSET);
    const at = new Map(ids.map((id, k) => [id, o.tops[k]]));
    return { at, tops: new Map(turns.map((t) => [t.id, at.get(`kc-turn-${t.id}`)])), end: o.end, known: o.known };
  }

  /**
   * One wheel event over the scroll area, its own half: the bounds it carries are the content's (measured
   * in the engine, timeline.js viewTop), so the view's top it leaves is the view's (viewY) less them, its
   * delta taken off (wheelAfter: several events on one paint add up). Then the bottom followed again when
   * it reaches it, the message on screen; a redraw only when that changes. Unknown until the pointer has
   * crossed the transcript once (viewSeen()).
   */
  wheel(cx, ev) {
    const by = ev.bounds?.y;
    if (by == null || this.viewY == null || this.vh <= 0) {
      this.top = null;
      return;
    }
    const g = this.geom(), z = this.zoom();
    // A14: the area moves by delta.x when delta.y is 0 (it scrolls y only). Its padding (TOP_INSET above,
    // 8 under) is part of what scrolls.
    const dy = wheelDy(ev.delta) / z;
    this.wheelEst = wheelAfter(this.wheelEst, { by, top: viewTop({ viewY: this.viewY, contentY: by, z }), dy, max: g.known ? g.end + 8 - this.vh : Infinity });
    const scrollTop = (this.top = this.wheelEst.top);
    if (!g.known) return;
    const whole = this.end() >= this.turns.length; // the window's bottom is the conversation's
    // #59: going down to the conversation's bottom follows it again (the live tail's new turns show).
    if (dy < 0 && !this.follow && atEnd({ scrollTop, vh: this.vh, end: g.end + 8, whole })) {
      this.follow = true;
      this.cur = -1;
      cx.notify();
    }
    if (!this.marks.length) return;
    const cur = this.follow ? -1 : this.marks.findIndex((m) => m.id === this.tlId);
    const r = activeAt({ marks: this.marks, tops: g.tops, first: this.first(), scrollTop, vh: this.vh, end: g.end + 8, follow: this.follow, whole, cur });
    const id = this.marks[r.k]?.id ?? null;
    if (id !== this.tlId || r.above !== this.tlAbove || this.tlLost) {
      this.tlId = id;
      this.tlAbove = r.above;
      this.tlLost = false;
      cx.notify();
    }
  }

  // ---------- the scroll area's own events (body()) ----------

  /**
   * The scroll area's size (design px). A view following the bottom stays there when its box changes:
   * gpui keeps the offset from the top, so the last lines would slip under the composer. Shorter (a
   * ledge opening, a dialog's card, the composer growing, the window) or narrower (the text reflows,
   * taller: A2): the bottom again.
   */
  areaSized(size, cx) {
    const z = this.zoom(), h = size.height / z, w = size.width / z;
    const tall = Math.abs(h - this.vh) > 0.5, wide = Math.abs(w - this.areaW) > 0.5;
    if (!tall && !wide) return;
    this.vh = h;
    this.areaW = w;
    if (this.follow) this.reveal = "bottom";
    if (tall || this.follow) cx.notify();
  }

  /** Scrolling up leaves the bottom: new turns no longer pull the view down (G or the button bring it back). */
  areaWheel(ev, cx) {
    if (wheelDy(ev.delta) > 0 && this.follow) {
      this.follow = false;
      cx.notify();
    }
    this.keepRow = null; // the reader scrolls: a press's keep no longer holds (keepY())
    this.wheel(cx, ev);
  }

  /**
   * The box around the scroll area (kc-view) under the pointer: its top in the window is the view's top,
   * what the area's events are measured from (wheel(), keepPress()). It follows the layout and the zoom:
   * taken again at every pointer move and wheel over the transcript.
   */
  viewSeen(ev) {
    if (ev?.bounds?.y != null) this.viewY = ev.bounds.y;
  }

  /**
   * A press on the scrollbar (the area's right edge, SCROLLBAR_W) moves the view where no event says:
   * the bottom isn't followed any more (A1: else the next live tick pulls the view back down), the
   * view's top is unknown, and the timeline lights nothing until a wheel measures it again (A7). A
   * press on the text, or on the background's button over the bar's top (bgControls), leaves them. The
   * press's y in the view: from the view's top (viewSeen()), its local y being the content's.
   */
  areaPress(ev, cx) {
    if (!ev.local_position || !ev.bounds) return;
    const z = this.zoom(), { x } = ev.local_position, w = ev.bounds.width;
    if (x <= w - SCROLLBAR_W * z) return;
    const y = this.viewY != null && ev.position ? ev.position.y - this.viewY : ev.local_position.y;
    if (this.bgBtn && y >= 10 * z && y <= 36 * z && x >= w - 36 * z) return;
    this.top = null;
    this.keepRow = null;
    const changed = this.follow || !this.tlLost;
    this.follow = false;
    this.tlLost = true;
    if (changed) cx.notify();
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
    const on = this.tlLost && !this.follow ? -1 : active; // A7: where the view is isn't known, nothing lit
    const { start, end, gap } = barStack(n, active, Math.min(TL.STACK_MAX, Math.floor(this.vh * TL.SHARE)));
    const hov = this.tlHover >= start && this.tlHover < end ? this.tlHover : -1;
    const row = TL.BAR_H + gap;
    const bars = [];
    for (let k = start; k < end; k++) {
      const m = list[k];
      const lit = hov >= 0 ? k === hov : k === on;
      // The wave reaches the outer bars a beat after the hovered one; back at rest, all at once.
      const p = { duration: TL.MS, delay: hov >= 0 ? Math.min(Math.abs(k - hov), TL.RIPPLE) * TL.STEP : 0, easing: "ease-out" };
      let bar = div().id(`kc-tlb-${m.id}`).h(TL.BAR_H).w(TL.BAR_W + (TL.BAR_LIFT - TL.BAR_W) * barLift(k, hov)).rounded_full()
        .bg(ink(t, 1)).opacity(lit ? TL.LIT : TL.IDLE);
      if (!this.m.reduced) bar = bar.transition("width", p).transition("opacity", p);
      bars.push(h_flex().id(`kc-tl-${m.id}`).w_full().h(row).flex_none().items_center().justify_end().cursor_pointer()
        .on_hover((h, cx) => { if (h) this.hoverMark(cx, k); })
        .on_click((_e, cx) => { this.jumpTo(k, cx); cx.notify(); })
        .child(bar));
    }
    let card = null;
    if (this.tlOpen && hov >= 0) {
      const m = list[hov];
      const text = clampText(m.text || (m.images ? tr("images", { n: m.images }) : tr("tl.empty")), { lines: 2, cols: TL.CARD_COLS }).text;
      // Centred on its bar, whatever its height (one line or two): a band around it that centres it,
      // kept inside the transcript's box (cardTop): past its bottom it would cover the composer.
      const mid = (hov - start) * row + row / 2;
      card = h_flex().absolute().right(TL.BAR_LIFT + TL.CARD_GAP).top(cardTop(mid, (end - start) * row, this.vh)).h(120).items_center()
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
  col(el, id, state = null) {
    let inner = v_flex().w_full().max_w(COLUMN).px(COLUMN_PAD).min_w(0).child(el);
    // A jump's glide (body()): the row's content moves, not the row, whose bounds (the scroll's size,
    // the heights, the wheel's maths) stay put. Drawn dy off under a new id (a first render never
    // animates), then at 0: the native slide. The new id drops what gpui keeps under it (a code
    // block's horizontal scroll).
    const s = this.slide;
    if (s && !this.m.reduced)
      inner = inner.id(`${id}~g${s.gen}`).relative().top(s.ready ? 0 : s.dy).transition("top", { duration: MS.panel, easing: "ease-out" });
    const pin = this.pinned; // this render brings the bottom: the first size it makes is covered (measured())
    return h_flex().id(id).w_full().flex_none().justify_center()
      .on_size_change((size, cx) => this.measured(id, size, cx, pin, state))
      // A16: a press in a turn makes it the reader's (the cursor): its folded work is served first.
      .when(id.startsWith("kc-turn-"), (el) => el.on_mouse_down("left", (ev, cx) => this.pressTurn(id, ev, cx)))
      .child(inner);
  }

  /**
   * A16: the turn pressed becomes the cursor's, which body() serves first (nearFirst); a fold of it held
   * closed by the budget then opens as one the reader opens (foldAt: rows()). Where that row is on screen
   * (keepPress()), so a fold above it that this changes doesn't move it.
   */
  pressTurn(id, ev, cx) {
    const i = this.turns.findIndex((t) => `kc-turn-${t.id}` === id);
    this.pressMoved = i >= 0 && i !== this.cur && !this.follow;
    if (i >= 0 && i !== this.cur) {
      this.cur = i;
      const t = this.turns[i];
      if (this.heldNow?.has(t.id)) this.foldAt = { id: t.id, at: Date.now() };
      cx.notify();
    }
    this.keepPress(id, ev);
  }

  /**
   * When the press moved the reader, where the pressed row is on screen: its bounds against the view's
   * top (viewSeen()), the view's top following (row top in the content + the view's top - the row's).
   * That row is kept there (keepRow: keepY() moves the view's top by what the folds above it change in
   * the next render).
   */
  keepPress(row, ev) {
    if (!this.pressMoved) return;
    this.pressMoved = false;
    const by = ev?.bounds?.y, g = this.geom();
    if (by == null || this.viewY == null || !g.known || !g.at.has(row)) return;
    const at = g.at.get(row);
    const top = Math.max(0, at + (this.viewY - by) / this.zoom());
    this.top = top;
    this.keepRow = { id: row, screen: at - top, top, at: Date.now(), correct: false };
  }

  /**
   * « Ce qu'on vient de cliquer ne bouge pas » (A16): a press that made another turn the reader's may
   * draw a fold above it open or held closed in this render (`drawnNow`: turn id -> "o" | "c"). The view's
   * top then moves by what that changes above the pressed row, so the row stays where it was on screen.
   * A changed row's height: the one measured the last time it was drawn that way (byState), else its
   * current one (a guess: measured() asks a render more to correct it). Answers { top, h } (the anchor:
   * at the view's new top, a view tall, never past the end) or null when nothing has to move.
   */
  keepY(drawnNow) {
    const k = this.keepRow;
    if (!k || Date.now() - k.at > 1000) return (this.keepRow = null);
    const turns = this.turns.slice(this.first(), this.end());
    const tail = this.end() < this.turns.length ? ["kc-later"] : this.builtLive ? ["kc-working"] : [];
    const rows = [["kc-head", null], ...turns.map((t) => [`kc-turn-${t.id}`, t.id]), ...tail.map((r) => [r, null])];
    let y = TOP_INSET, rowAt = null, guess = false;
    for (const [id, tid] of rows) {
      if (id === k.id) rowAt = y;
      let h = this.hts.get(id);
      const now = tid != null ? drawnNow.get(tid) : undefined, was = tid != null ? this.drawn.get(tid) : undefined;
      if (rowAt == null && now !== undefined && was !== undefined && now !== was) {
        const p = this.byState.get(`${id}|${now}`);
        if (p != null) h = p;
        else guess = true;
      }
      if (h == null) return (this.keepRow = null);
      y += h;
    }
    if (rowAt == null) return (this.keepRow = null);
    const top = Math.max(0, rowAt - k.screen);
    this.keepRow = guess ? { ...k, top, correct: true } : null;
    if (Math.abs(top - k.top) < 0.5) return null;
    return { top, h: anchorH({ y: top, end: y + 1, vh: this.vh }) };
  }

  /** A16: the turn a render serves first: the last while following the bottom, else the cursor's. */
  focusTurn() {
    return this.follow || this.cur < 0 ? this.turns.length - 1 : this.cur;
  }

  /**
   * A16: whether a fold the reader opened is drawn open in this render, always whole. The reader's turn
   * (the first a render serves: body()) is outside the budget: drawn as opened, with all it shows. Another
   * turn's is drawn when its whole cost (foldCost) fits in what the budget has left (then spent), else held
   * closed. Nothing is cut inside a turn drawn: a step, an opened detail, « N étapes de plus » are drawn
   * in full or not at all, with their fold.
   */
  holds(turn) {
    const b = this.budget;
    if (b?.steps == null || b.fresh) return true;
    const cost = this.foldCost(turn);
    if (b.steps < cost) return false;
    b.steps -= cost;
    return true;
  }

  /**
   * A16: a fold's cost in rows: each phase's header and the steps it shows (the opened details among
   * them, line by line, as detail() caps them), each prose block, each sub-agent's row and opened report
   * (#58: or, its own transcript read, the items it shows of it).
   */
  foldCost(turn) {
    const f = turn.fold;
    let c = 0;
    for (let n = f.start; n <= f.end; n++) c += this.itemCost(turn.items[n]);
    return c;
  }

  /** A16: one item's rows, as foldCost() counts them. */
  itemCost(it) {
    if (it.type === "activity") {
      const shown = it.steps.slice(it.steps.length - Math.min(it.steps.length, this.shownSteps.get(it.id) ?? STEPS));
      return FOLD_HEAD + shown.length + shown.reduce((c, b) => c + (this.open.has(`s:${b.id}`) ? this.detailRows(b) : 0), 0);
    }
    if (it.type === "subagents") {
      return it.runs.reduce((c, b) => {
        if (!this.open.has(`r:${b.id}`)) return c + 1;
        const own = this.ownOf(b);
        return c + 1 + (own ? own.items.reduce((k, x) => k + this.itemCost(x), 0) : Math.min(LINES, lines(b.result?.text).length));
      }, 0);
    }
    return it.type === "block" ? PROSE_ROWS : 0;
  }

  /** A16: the rows a step's opened detail draws (its text's lines, a command's, a diff's), as detail() caps them. */
  detailRows(b) {
    if (b.role === "thinking") return Math.min(LINES, lines(b.text).length);
    const r = b.result ?? {}, i = b.input ?? {};
    const diff = (r.diff ?? []).reduce((k, h) => k + h.lines.length, 0);
    return Math.min(LINES, lines(i.command).length) + Math.min(LINES, lines(r.text).length) + Math.min(LINES * 2, diff);
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
      // #92: its text opens and closes on its height (motion.js collapse).
      const body = has ? collapse(this.m, `kc-thb-${b.id}`, this.open.has(id), () => div().pl(20).pb(8).child(this.mono(t, b.text, ink(t, 0.48)))) : null;
      return body ? v_flex().min_w(0).child(el).child(body) : el;
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
    // #92: its detail opens and closes on its height (motion.js collapse).
    const d = collapse(this.m, `kc-sd-${b.id}`, this.open.has(id), () => this.detail(t, b) ?? div());
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
    // Its rows: [element, its first line's height (the bend at its middle), its branch's color].
    const kids = [
      ...(hidden > 0 ? [[more(`kc-more-${item.id}`, "chevron-up", tr("steps.more", { n: hidden }), n + MORE), 20, null]] : []),
      ...(n > STEPS ? [[more(`kc-less-${item.id}`, "chevron-down", tr("steps.less"), STEPS), 20, null]] : []),
      ...steps.map((b) => [this.step(t, b), 28, this.branchColor(t, b.state)]),
    ];
    if (!c.order.length && !c.notes) return v_flex().min_w(0).children(kids.map(([el]) => el)); // thinking only: its rows, on the fold's branch
    const running = live && item.steps.some((b) => b.state === "running");
    const words = tallyText(c, tr);
    const rest = treeLine(t);
    // #90: its steps on kt-threads' branches (tree.js), the trunk from under its tile (18 in a 28 px row: 23 down).
    return v_flex().min_w(0)
      .child(h_flex().relative().py(4).gap(8).items_center().min_w(0)
        .child(this.tile(t, TILE[c.kind] ?? null, TILE_ICON[c.kind] ?? OWN("wrench"), running))
        .child(div().flex_1().min_w(0).truncate().text_size(14).line_height("20px").text_color(ink(t, 0.5))
          .when(running, (el) => el.loop("opacity", { from: 0.55, to: 1, period: 1600 }))
          .child(words || " "))
        .child(stem(rest, { top: 23 })))
      .children(kids.map(([el, h, color], k) => hang(t, el, { h, last: k === kids.length - 1, color, rest })));
  }

  /** A branch's color by its step's state (kt-threads' sub-agents): a running one's, a failed one's, else at rest (null). */
  branchColor(t, state) {
    return state === "running" ? alpha(t.working, "99") : state === "error" ? alpha(t.ansi1, "80") : null;
  }

  // transcript/tasks.rs:358-549: a sub-agent's row, py 4 px 6, radius 6, a 0.08 ground when hovered or
  // open: its mark in its color, its name at ink 0.75, model and state at 12 ink 0.4, a chevron.
  // `branch` (#90, in a fold's tree): { last, rest }, each row on its own branch, the last row's ending the
  // trunk when `last`; its head keeps its ml(-6) inside the branch's box.
  // #58: unfolded, its own transcript (subagents/agent-<id>.jsonl, read on demand, live while it runs):
  // the last items of its last turn, under the rail; its report as before while that isn't read, or
  // when it can't be.
  subagents(t, item, branch = null, cx = null) {
    const n = item.runs.length;
    const onBranch = (el, k) => (branch ? hang(t, v_flex().min_w(0).child(el), { h: 28, last: branch.last && k === n - 1, rest: branch.rest }) : el);
    const row = (b) => {
      const a = b.result?.agent ?? {};
      const c = agentColor(t, a.color);
      const id = `r:${b.id}`;
      const open = this.open.has(id);
      let run = a.id ? this.subRuns.get(a.id) : null;
      // Unfolded, or shown again (back in the window), after reads that failed: it tries again.
      const again = Boolean(run && open && !run.shown && run.err);
      if (again) run.fails = 0;
      if (open && a.id && cx && (!run || again)) this.readSub(cx, a.id, Boolean(run?.state));
      run = a.id ? this.subRuns.get(a.id) : null; // readSub() may have just put a new one
      if (run) run.shown = open;
      if (open && a.id) this.subsNow?.add(a.id);
      const own = open ? this.ownOf(b) : null;
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
      const body = own ? this.subBody(t, cx, own, run) : open && b.result?.text ? this.mono(t, b.result.text) : null;
      return body
        ? v_flex().min_w(0).child(head).child(div().relative().pl(20).pb(8)
          .child(div().absolute().left(6).top(0).bottom(8).w(1).bg(ink(t, 0.14))).child(body))
        : head;
    };
    return v_flex().min_w(0).children(item.runs.map((b, k) => onBranch(row(b), k)));
  }

  /** #58: what a sub-agent's line shows of its own transcript once read (chat-model.js subItems), else null. */
  ownOf(b) {
    const id = b.result?.agent?.id;
    const run = id ? this.subRuns.get(id) : null;
    return run?.turns ? subItems(run.turns, 8, id) : null;
  }

  /**
   * #58: a sub-agent's last items, as the transcript draws them, with how many came before. Those its
   * read brought (run.fresh, subArrivals()) come in once as a live turn's do (landing(): fade, 6 px rise
   * in a box that clips, no height moving); drawn again later, as they are.
   */
  subBody(t, cx, own, run) {
    const fresh = (run.fresh ??= new Set());
    return v_flex().min_w(0)
      .when(own.more > 0, (el) => el.child(div().py(2).text_size(12).text_color(ink(t, 0.45)).child(tr("sub.earlier", { n: own.more }))))
      .children(own.items.map((it) => {
        const el = this.item(t, cx, it, { live: own.turn.live, top: 8 });
        return el && this.landing(div().w_full().min_w(0).child(el), it.id, it.id, fresh);
      }).filter(Boolean));
  }

  /**
   * #58: a sub-agent's own transcript (chat-model.js subPath: beside its session's), read when its line
   * unfolds: its last 2 turns within a small budget (its own lead's brief opens its turn). Again, from
   * where it stopped, every BRIDGE ms while it runs and its line stays open and drawn (followSubs()),
   * until its .meta.json says finished. Missing or unreadable: its line keeps its report, and after
   * SUB_TRIES failed reads in a row it stops trying until unfolded again. A redraw only when something
   * came.
   */
  readSub(cx, id, delta = false) {
    const p = subPath(this.state?.path, id);
    const was = this.subRuns.get(id);
    if (!p || was?.busy || (delta && (!was?.state || was.done))) return;
    this.subRuns.set(id, { ...(was ?? {}), busy: true });
    cx.spawn(async (cx) => {
      const r = this.subRuns.get(id) ?? {};
      let next = { ...r, busy: false };
      try {
        const args = [`${appHome()}/mods/kt-chat/chat-index.ts`, p.file, "--sidechain", "--last-turns", "2", "--budget", "200000", "--max-entries", "400"];
        if (delta) args.push("--from", String(r.state.end));
        const res = await exec(`${home()}/.nix-profile/bin/bun`, args, { timeout: 20000 });
        const out = res.code === 0 ? JSON.parse(res.stdout) : null;
        let done = Boolean(r.done);
        try {
          done = Boolean(JSON.parse((await readTextFile(p.meta)) ?? "{}").finished);
        } catch {
          // no meta yet: as before
        }
        if (!out || out.error) next = { ...next, err: true, fails: (r.fails ?? 0) + 1 };
        else {
          const state = delta ? ingest(r.state, out) : ingest(null, out);
          const grew = !r.state || state.entries.length !== r.state.entries.length || done !== r.done;
          const turns = grew || !r.turns ? build(state.entries, { live: !done }) : r.turns;
          next = { state, turns, fresh: subArrivals(r.turns, turns, id, r.fresh), busy: false, done, shown: r.shown, grew };
        }
      } catch {
        next = { ...next, err: true, fails: (r.fails ?? 0) + 1 };
      }
      if (this.subRuns.get(id) !== r) return; // another agent meanwhile (cleared)
      next.shown = r.shown; // as the renders during the read left it (folded, out of the window)
      this.subRuns.set(id, next);
      if (!delta || next.grew || next.err) cx.notify();
    });
  }

  /**
   * #58, watchBridge()'s timer: the sub-agents whose line is open and drawn, while they run, read on from
   * where they stopped (not read yet: whole); not one that failed SUB_TRIES times in a row.
   */
  followSubs(cx) {
    for (const [id, r] of this.subRuns) if (r.shown && !r.done && (r.fails ?? 0) < SUB_TRIES) this.readSub(cx, id, Boolean(r.state));
  }

  /** #58, after a render's turns (subsNow: the open lines drawn): a line not drawn (its turn out of the window) isn't followed. */
  subsDrawn() {
    for (const [id, r] of this.subRuns) if (!this.subsNow?.has(id)) r.shown = false;
    this.subsNow = null;
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
        .child(TextView.markdown(`kc-nb-${id}${open ? "-all" : ""}`, this.linked(null, shown)).selectable(true).on_link_click((url, cx) => this.link(url, cx)))))
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
    // #82: its references as links (linked()); a click on one goes to Herdr (link()).
    const md = (k, text) => TextView.markdown(`kc-md-${b.id}#${k}`, this.linked(cx, text)).selectable(true).on_link_click((url, cx) => this.link(url, cx));
    return v_flex().w_full().min_w(0).overflow_hidden().pt(top).gap(16).text_size(14).line_height("24px").text_color(ink(t, 0.78))
      .children(doc.segs.map((s, k) => (s.kind === "code" ? this.codeBlock(t, cx, `${b.id}#${k}`, s)
        : s.kind === "alert" ? div().ml(4).pl(16).border_l(4).border_color(ink(t, 0.2)).child(md(k, s.text))
          : md(k, s.text))));
  }

  // A reference (#82, herdr-ref:) opens its Herdr view (openRef); a web link opens in the browser; a
  // path written as a link is left alone (a path in the text is a reference when it's in the repo).
  link(url, cx) {
    const r = parseRef(url);
    if (r) return void this.openRef(r, cx);
    const to = linkTarget(url, this.state?.meta?.cwd ?? null);
    if (to?.web) exec("open", [to.web]).catch(() => {});
  }

  // #82: the thread's folder, where its references are looked for (refs.js); none without a transcript.
  // The facts per cwd (refs.js refsState) and the linked segments' memo, made on first use.
  refsCwd() {
    this.refs ??= refsState();
    this.linkedMemo ??= new Map();
    return this.state?.meta?.cwd ?? null;
  }

  // #82: a prose segment with its references as links (refs.js linkify), those checked against the
  // thread's repo only: an absent or ambiguous one stays text. What a render misses is asked in ONE task
  // after it (refs.js ensure), then a redraw; `cx` null (a notice): only what is known already. Memoized
  // per text and facts' version (bounded).
  linked(cx, text) {
    const cwd = this.refsCwd();
    if (!cwd || !text) return text;
    const key = `${this.refs.v}\0${cwd}\0${text}`;
    const hit = this.linkedMemo.get(key);
    if (hit !== undefined) return hit;
    const [cands, rs] = refsOf(this.refs, cwd, text, home());
    if (cands.length && cx) ensureRefs(this.refs, cx, cwd, cands, { exec, checking, home });
    const out = cands.length ? linkify(text, cands, rs) : text;
    if (this.linkedMemo.size > 400) this.linkedMemo.delete(this.linkedMemo.keys().next().value);
    this.linkedMemo.set(key, out);
    return out;
  }

  // #82: a reference opened in Herdr. Its receiver's shared key first (it reads it in its render), then
  // its page (the main "view" stack) or its panel tab (the column shown first, panel.js). An issue's kind
  // (Inbox needs it) asked of GitHub on the click, an issue when gh can't say. Nothing opens without a click.
  openRef(r, cx) {
    const go = (kind) => {
      const p = refPlan(r, kind);
      setShared(p.key, { ...p.value, at: Date.now() });
      if (p.page) run("layout.select", { stack: "view", child: p.page });
      else {
        showColumn("panel", cx);
        run("layout.select", { stack: "panel-body", child: p.panel });
      }
    };
    if (r.kind !== "issue") return void go();
    cx.spawn(async () => {
      const out = await exec("gh", ["api", `repos/${r.repo}/issues/${r.number}`, "--jq", ".pull_request"], { timeout: 5000 }).catch(() => null);
      go(kindFrom(out?.code === 0 ? out.stdout : ""));
    });
  }

  // #82: under an answer, a chip per reference it names (once each, in order, MAX_REFS at most): its
  // kind's icon and its label, a click to its Herdr view, and GitHub's page as a second button when it
  // has one (an issue or a PR, a commit). Its own row, between #93's assets and the answer's actions:
  // nothing overlaps; a file already among the assets (the same path) isn't a second chip. Read from
  // refs.js chipsOf, memoized per turn and facts' version: a render doesn't rescan the answer. Fades in
  // once when its first chip is known (motion.js enter).
  refChips(t, cx, turn) {
    const cwd = this.refsCwd();
    const text = answerOf(turn);
    if (!cwd || !text) return null;
    const { list } = chipsOf(this.refs, turn.id, cwd, text, turn.assets, home(), MAX_REFS,
      (cands) => ensureRefs(this.refs, cx, cwd, cands, { exec, checking, home }));
    if (!list.length) return null;
    const chip = (r, i) => {
      const gh = githubUrl(r);
      return h_flex().id(`kc-ref-${turn.id}-${i}`).h(24).pl(8).pr(gh ? 2 : 8).gap(6).items_center().min_w(0).rounded(8)
        .border(1).border_color(ink(t, 0.1)).bg(ink(t, 0.04)).cursor_pointer().hover((s) => s.bg(ink(t, 0.08)))
        .tooltip(tr(`ref.open.${r.kind}`))
        .on_click((_e, cx) => { this.openRef(r, cx); cx.notify(); })
        .child(svg(REF_ICON[r.kind]).size(12).flex_none().text_color(ink(t, 0.5)))
        .child(div().max_w(220).truncate().font_family(CODE).text_size(12).text_color(ink(t, 0.75)).child(labelOf(r)))
        .when(Boolean(gh), (el) => el.child(this.iconBtn(t, `kc-refgh-${turn.id}-${i}`, GITHUB, tr("ref.github"), () => exec("open", [gh]).catch(() => {}), 20)));
    };
    return enter(this.m, h_flex().flex_wrap().gap(6).pt(8), `kc-refs-${turn.id}`, { dy: 0 }).children(list.map(chip));
  }

  // transcript.rs:2165-2455 + response_actions.rs: under the answer, always shown: copy (a check for
  // 2 s), a 3 px dot at 0.25 and the time at 0.35; pt 4, pb 12, gap 10, 12/16.
  actions(t, turn) {
    const answer = answerOf(turn);
    const at = answerAt(turn);
    const id = `a:${turn.id}`;
    const copied = this.copied === id;
    return h_flex().pt(4).pb(12).gap(10).items_center().text_size(12).line_height("16px")
      .child(h_flex().ml(-4).gap(4).child(this.iconBtn(t, `kc-act-${turn.id}`, copied ? I("check") : COPY, copied ? tr("copied") : tr("copyAnswer"), (cx) => this.copy(cx, id, answer, 2000)))
        // #93: into the field, quoted: the part of it copied last (a selection), else all of it.
        .when(this.composerShown(), (el) => el.child(this.iconBtn(t, `kc-acq-${turn.id}`, QUOTE, tr("cite"), (cx) => this.cite(cx, answer)))))
      .when(Boolean(at), (el) => el.child(h_flex().gap(6).items_center()
        .child(div().size(3).rounded_full().bg(ink(t, 0.25)))
        .child(div().text_color(ink(t, 0.35)).child(time(at)))));
  }

  // transcript.rs:4891-5005: « Opus 5.5 a travaillé 3m 12s », 14/20 at ink 0.5 (0.8 hovered), pt 12,
  // pb 4, gap 8, after the provider's tile; hovered or open, the tile shows the chevron. A16 `held`:
  // opened, but drawn closed past the render's budget: a click doesn't close it, the press in its turn
  // (pressTurn) serves it first and it opens as one opened (foldAt: rows()).
  workedLine(t, turn, opened, kids = false, held = false) {
    const hov = this.hover === `w:${turn.id}`;
    const model = modelName(turn.model);
    const d = turn.ms ? workedFor(turn.ms) : null;
    const text = d ? (model ? tr("worked", { model, d }) : tr("workedNoModel", { d })) : model ? tr("workedPlain", { model }) : tr("workedNone");
    // #90: with children shown (opened, or its sub-agents kept), the trunk leaves from under its tile
    // (18 in its 20 px line under pt 12: 31 down).
    return h_flex().id(`kc-fold-${turn.id}`).relative().pt(12).pb(4).gap(8).items_center().min_w(0).cursor_pointer()
      .when(kids, (el) => el.child(stem(treeLine(t), { top: 31 })))
      .tooltip(turn.tally ? tallyText(turn.tally, tr) : text)
      .on_hover((h, cx) => this.setHover(cx, `w:${turn.id}`, h))
      .on_click((_e, cx) => { if (!held) this.toggle(`f:${turn.id}`); this.foldAt = { id: turn.id, at: Date.now() }; cx.notify(); })
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
    if (it.type === "subagents") return this.subagents(t, it, ctx.branch, cx);
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
    // #80: the message's attachments (att-model.js), above the bubble. #93: one image alone keeps its
    // photo (240); more pieces, or one that isn't an image, are cards (pieceCard) on the right, two rows
    // until « +N », with no motion of their own (they come with their turn). An index from before #80 (a
    // count, no `imgs`) keeps its « N images » chip.
    const cwd = this.state?.meta?.cwd ?? null;
    const atts = attachmentsOf(u, turn.files, this.state?.session).map((a) => ({ ...a, abs: a.abs ?? (a.path?.startsWith("/") ? a.path : cwd && a.path ? `${cwd}/${a.path}` : null) }));
    const lone = atts.length === 1 && atts[0].kind === "image" ? this.photo(t, cx, turn, atts, atts[0], 0) : null;
    const room = Math.min(BUBBLE_MAX, Math.min(this.width || COLUMN, COLUMN) - 2 * COLUMN_PAD - BUBBLE_ROW_PAD);
    const local = atts.length && !lone ? this.localFiles() : false;
    const grid = atts.length && !lone
      ? this.pieceGrid(t, `p:${turn.id}`, atts.length, room, (i) => this.pieceCard(t, cx, `kc-pc-${turn.id}-${i}`, atts, i, { drag: local }), { end: true })
      : null;
    const legacy = !u.imgs && u.images ? this.chip(t, OWN("image"), tr("images", { n: u.images })) : null;
    const hov = this.hover === id;
    const copied = this.copied === id;
    const row = () => h_flex().gap(6).flex_wrap().justify_end().max_w(BUBBLE_MAX);
    return h_flex().id(`kc-u-${turn.id}`).pt(4).pl(BUBBLE_ROW_PAD).w_full().min_w(0).justify_end()
      .on_hover((h, cx) => this.setHover(cx, id, h))
      .child(v_flex().items_end().max_w(BUBBLE_MAX).min_w(0)
        .when(Boolean(lone || legacy), (el) => el.child(row().mb(8).children([lone, legacy].filter(Boolean))))
        .when(Boolean(grid), (el) => el.child(grid.mb(8)))
        .when(Boolean(text.trim()), (el) => el.child(div().id(`kc-ub-${turn.id}`).max_w(BUBBLE_MAX).min_w(0).overflow_hidden()
          .px(12).py(8).rounded(pill ? 18 : 12).bg(ink(t, 0.1))
          .text_size(14).line_height("20px").text_color(ink(t, 1))
          .when(Boolean(u.cmd), (el) => el.font_family(CODE).text_size(13))
          .child(u.cmd ? text : TextView.markdown(`kc-ut-${turn.id}${open ? "-all" : ""}`, shown).selectable(true))))
        .when(folded.cut, (el) => el.child(this.more(t, `kc-um-${turn.id}`, open, () => this.toggle(`o:${turn.id}`))))
        // Monocode shows these on hover; their place stays (no jump).
        .child(h_flex().h(26).pt(4).gap(6).items_center().opacity(hov || copied ? 1 : 0)
          .child(this.iconBtn(t, `kc-uc-${turn.id}`, copied ? I("check") : COPY, tr("copyMessage"), (cx) => this.copy(cx, id, text, 2000)))
          .when(this.composerShown(), (el) => el.child(this.iconBtn(t, `kc-uq-${turn.id}`, QUOTE, tr("cite"), (cx) => this.cite(cx, text))))
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
  // attachments, at this one. `side`: a turn's assets are smaller (#93: 160, radius 12).
  photo(t, cx, turn, atts, a, i, side = 240) {
    const info = this.attOf(cx, a);
    const [w, h] = photoSize(info?.w, info?.h, side);
    const r = side < 240 ? 12 : 16;
    const src = info?.thumb ? `${ATT_DIR}/${info.thumb}` : null;
    return div().id(`kc-ph-${turn.id}-${i}`).w(w).h(h).flex_none().rounded(r).overflow_hidden().bg(ink(t, 0.06))
      .cursor_pointer().on_click((_e, cx) => this.openAtts(cx, atts, i))
      .when(Boolean(src), (el) => el.child(image(src).size_full().rounded(r)))
      .when(Boolean(info?.error), (el) => el.flex().items_center().justify_center().child(svg(OWN("image")).size(16).text_color(ink(t, 0.35))));
  }

  /** chat-att.ts's argv for an attachment (by argv, never a shell): from the transcript or its file. */
  attArgv(a, full) {
    const tail = ["--out", `${appHome()}/${ATT_DIR}`, ...(full ? ["--full"] : [])];
    const bun = [`${home()}/.nix-profile/bin/bun`, `${appHome()}/mods/kt-chat/chat-att.ts`];
    if (a.ref) return this.state?.path ? [...bun, "embedded", this.state.path, "--at", String(a.ref.o), ...(a.ref.tool ? ["--tool", a.ref.tool] : []), "--n", String(a.ref.n), ...tail] : null;
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
    // A16: an opened fold past the render's budget is drawn closed (held: no motion, rows() at rest); the
    // reader's turn always holds. What each fold is drawn as goes to keepY() (drawnNow).
    const asked = Boolean(f) && this.open.has(`f:${turn.id}`);
    const opened = asked && this.holds(turn);
    if (this.budget) this.budget.fresh = false;
    if (asked && !opened) this.heldNow?.add(turn.id);
    if (f) this.drawnNow?.set(turn.id, opened ? "o" : "c");
    // #90: the fold as a tree (chat-model.js foldTree): its items hang under the header on its branches
    // (tree.js hang), the bend at their first line's middle (a step's or a tile's row 28, a prose block's
    // first line under its margin); inside a closed fold only the sub-agents (Monocode pins them outside).
    const tree = foldTree(turn.items, f, opened);
    const inFold = (n) => Boolean(f) && n >= f.start && n <= f.end;
    // Each item's top margin as drawn, in order: a prose block's 12 for the message's first, 16 after one
    // drawn, 4 right under the fold.
    const tops = [];
    let top = 12;
    turn.items.forEach((it, n) => {
      tops[n] = f && n === f.end + 1 ? 4 : top;
      if ((!inFold(n) || tree.kids.includes(n)) && it.type === "block" && it.block.role === "prose") top = 16;
    });
    // #92: the live turn's items fade in where they land as they come (landing()).
    const draw = (it, n, branch = null) => {
      const el = this.item(t, cx, it, { live: turn.live, top: tops[n], branch });
      return el && turn.live ? this.landing(div().w_full().min_w(0).child(el), it.id, it.id) : el;
    };
    // #92: the fold's items open and close on their height, in order (motion.js rows()), right after the
    // reader opened or closed it; drawn again later (a window change), it lands as it is. The last row
    // while the bottom is followed doesn't move: the bottom would chase it, a render a frame.
    const rest = treeLine(t);
    const moved = this.foldAt?.id === turn.id && Date.now() - this.foldAt.at < 1000 && !(this.follow && i === this.end() - 1);
    const kids = f ? rows(moved ? this.m : still(this.m), cx, `kc-fk-${turn.id}`, tree.kids, (n) => String(turn.items[n]?.id ?? n), (n) => {
      const it = turn.items[n];
      // Sub-agents launched together are one item (chat-model.js groups the runs): one branch each, the
      // last one's ending the trunk when the group is the fold's last. Cold review, point 4.
      if (it?.type === "subagents") return draw(it, n, { last: n === tree.last, rest }) ?? div();
      const el = it ? draw(it, n) : null;
      if (!el) return div();
      const prose = it.type === "block" && it.block.role === "prose";
      const running = it.type === "activity" && turn.live && it.steps.some((b) => b.state === "running");
      return hang(t, el, { h: prose ? 2 * (tops[n] + 12) : 28, last: n === tree.last, color: running ? this.branchColor(t, "running") : null, rest });
    }) : [];
    turn.items.forEach((it, n) => {
      if (f && n === f.start) {
        out.push(this.workedLine(t, turn, opened, kids.length > 0, asked && !opened));
        if (kids.length) out.push(v_flex().min_w(0).children(kids));
      }
      if (inFold(n)) return;
      const el = draw(it, n);
      if (el) out.push(el);
    });
    // #93: what the turn's tools got back or wrote and the files its answer cites, once it is over.
    const assets = turn.live ? null : this.assetsRow(t, cx, turn);
    if (assets) out.push(assets);
    if (!turn.live && answerOf(turn)) {
      const refs = this.refChips(t, cx, turn); // #82: its own row, under the assets
      if (refs) out.push(refs);
      out.push(this.actions(t, turn));
    }
    const here = keyed && i === (this.cur < 0 ? this.turns.length - 1 : this.cur);
    // #92: a turn that arrived live fades in where it lands (landing()); the others are drawn as they are.
    return this.col(v_flex().relative().w_full().min_w(0).pb(8)
      // The keyboard's turn: a short 2 × 16 accent tick in the column's margin, at its top (a mark as
      // tall as the turn ran through a long turn like a rule). Outside the turn's clipping box.
      .when(here, (el) => el.child(div().absolute().left(-14).top(8).w(2).h(16).rounded_full().bg(t.accent)))
      .child(this.landing(v_flex().w_full().min_w(0).children(out), turn.id, `t-${turn.id}`)), `kc-turn-${turn.id}`, f ? (opened ? "o" : "c") : null);
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

  // « Tours suivants » (#59): the head's twin under a window that stops before the end, with how many
  // turns wait below it (the live tail's new ones among them), and « en direct » when the agent's live
  // turn is one of them (the bottom isn't followed then: the button or G bring it back).
  later(t, k) {
    return this.col(h_flex().justify_center().py(8).child(h_flex().id("kc-later-btn").h(26).px(12).gap(6).items_center().rounded_full()
      .border(1).border_color(ink(t, 0.1)).cursor_pointer().hover((s) => s.bg(ink(t, 0.08))).text_size(12).text_color(ink(t, 0.6))
      .on_click((_e, cx) => { this.newer(); cx.notify(); })
      .child(svg(I("chevron-down")).size(12))
      .child(tr(this.builtLive ? "laterLive" : "later", { n: k }))), "kc-later");
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
    // The window (#59): [from, to), CAP turns at most, « Tours suivants » under it when it stops
    // before the end (the live turn and its « travaille… » row are then below too).
    const from = this.first(), to = this.end();
    this.pinned = this.reveal === "bottom" ? {} : null; // the rows described below: their first sizes are this reveal's (col())
    // The timeline's jump (#85), once the rows above its turn are measured: an anchor at the turn's top,
    // a view tall (never past the end), after the end mark (the turns' child indices stay): the
    // smallest scroll that reveals it puts its top at the view's top, from above as from below. Worked
    // out before the rows: its glide (glide(), timeline.js) draws them where the view was, under a new
    // generation (col()), and its cue's first layout lets them slide; gpui scrolls in that same
    // image, before painting them (div.rs prepaint, scroll_to_active_item).
    let anchor = null;
    if (this.jump != null) {
      const g = this.geom();
      const y = g.tops.get(this.jump);
      if (!this.turns.some((x) => x.id === this.jump)) this.jump = null;
      else if (g.known && y != null && this.vh > 0) {
        const h = anchorH({ y, end: g.end, vh: this.vh });
        const go = glide({ y, h, vh: this.vh, max: g.end + 8 - this.vh, ...this.glideFrom });
        this.top = go.top;
        anchor = div().absolute().left(0).top(y).w(1).h(h);
        if (go.dy && !this.m.reduced) this.slide = { gen: (this.slide?.gen ?? 0) + 1, dy: go.dy, ready: false };
        this.jump = null;
        this.reveal = null;
        this.glideFrom = null;
      }
    }
    // What one render may draw (code, A16's folded work) goes to the reader's turn first, then outwards
    // (turn-window.js nearFirst): following the bottom, the last turn first, then up.
    this.budget = { spans: CODE_SPANS, rows: CODE_ROWS, steps: ROW_BUDGET, fresh: true };
    this.drawnNow = new Map();
    this.heldNow = new Set();
    this.subsNow = new Set();
    const turns = [];
    for (const i of win.nearFirst(from, to, this.focusTurn())) turns[i - from] = this.turn(t, cx, this.turns[i], i, keyed);
    this.budget = null;
    this.subsDrawn();
    // A16: a press that moved the reader keeps its row where it was on screen, whatever the folds above
    // it are drawn as now (keepY(): an anchor at the view's new top, as the jump's).
    if (!anchor && this.reveal == null && this.keepRow) {
      const k = this.keepY(this.drawnNow);
      if (k) {
        this.top = k.top;
        anchor = div().absolute().left(0).top(k.top).w(1).h(k.h);
      }
    }
    this.drawn = this.drawnNow;
    this.drawnNow = null;
    const children = [this.head(t), ...turns];
    if (to < this.turns.length) children.push(this.later(t, this.turns.length - to));
    else if (this.builtLive) children.push(this.working(t));
    // The 1 px end mark: revealing it shows the bottom of a last turn taller than the view.
    children.push(div().flex_none().h(1));
    const last = children.length - 1;
    if (anchor) {
      children.push(anchor);
      this.scroll.scroll_to_item(children.length - 1);
    }
    // The glide's cue (enter()'s way): drawn under one id until its first layout is seen, then the
    // rows go to 0 (col()). 1 px at the top, after the anchor: neither the scroll's size nor its target.
    const s = this.slide;
    if (s && !s.ready && !this.m.reduced)
      children.push(div().id(`kc-jump-${s.gen}`).absolute().top(0).left(0).size(1).on_size_change((_size, cx) => {
        if (this.slide !== s || s.ready) return;
        s.ready = true;
        cx.notify();
      }));
    if (this.reveal != null) {
      this.scroll.scroll_to_item(this.reveal === "bottom" ? last : Math.min(this.reveal, last));
      this.reveal = null;
      this.top = null; // the smallest scroll, from where gpui is: unknown until a wheel or a jump
    }
    const rail = this.rail(t);
    // kc-view: the box the scroll area fills, its top the view's (viewSeen(): the area's own events carry
    // the content's bounds, not the view's).
    return div().id("kc-view").relative().flex_1().min_h(0).flex().flex_col()
      .on_mouse_move((ev, _cx) => this.viewSeen(ev))
      .on_scroll_wheel((ev, _cx) => this.viewSeen(ev))
      .child(v_flex().id("kc-scroll").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).pt(TOP_INSET).pb(8)
        .on_size_change((size, cx) => this.areaSized(size, cx))
        .on_scroll_wheel((ev, cx) => this.areaWheel(ev, cx))
        .on_mouse_down("left", (ev, cx) => this.areaPress(ev, cx))
        .children(children))
      .when(Boolean(rail), (el) => el.child(rail))
      // transcript.rs:5986-6062, « jump to bottom »: 30 round, border 0.1, ground 0.04, chevron 16 at 0.7.
      // Inside the transcript's box: the runner's band is under it, in the composer's flow.
      .when(!this.follow, (el) => el.child(h_flex().absolute().bottom(8).left(0).right(0).justify_center()
        .child(h_flex().id("kc-bottom").size(30).rounded_full().items_center().justify_center().border(1).border_color(ink(t, 0.1))
          .bg(ink(t, 0.04)).cursor_pointer().tooltip(tr("bottom")).text_color(ink(t, 0.7)).hover((s) => s.text_color(ink(t, 1)))
          .on_click((_e, cx) => { this.follow = true; this.cur = -1; this.jump = null; this.farTo = null; this.win = win.bottom(this.turns.length); this.reveal = "bottom"; cx.notify(); })
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
  composerView(t, tg, pr, cx) {
    const a = tg.agent;
    const dark = Boolean(settings().dark);
    const m = sendMode(a?.status ?? null);
    const can = canSend({ status: a?.status ?? null, text: this.draft, sending: this.sending, atts: this.drafts.length });
    const p = m === "blocked" ? this.decision?.pending : null;
    const pill = (id, label, onClick) => h_flex().id(id).flex_none().h(24).px(8).items_center().rounded(6).bg(ink(t, 0.1))
      .text_size(12).text_color(ink(t, 1)).cursor_pointer().hover((s) => s.bg(ink(t, 0.15)))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); cx.notify(); })
      .child(label);
    // #79: what it asks, whole: the command, or the edit's diff under its file; its first rows, all on a
    // click (up to OPEN, the rest left to the terminal). Opened, the card takes its height at once (no
    // height animation, #92) and the rows come in fading (motion.js enter, no rise). The rows were worked
    // out when the request or its call arrived (readDecision, askOf): the render only reads them.
    const mine = p && this.ask?.pending === p ? this.ask : null;
    const ask = mine?.rows ?? [];
    const file = mine?.file ?? null;
    const shown = shownRows(ask, this.askOpen);
    const body = v_flex().min_w(0).font_family(CODE).text_size(12).line_height("20px")
      .children(shown.rows.map((r) => {
        const c = r.sign === "+" ? t.ansi2 : r.sign === "-" ? ERR : null;
        return div().min_w(0).px(4).rounded(3).text_color(c ?? ink(t, 0.75)).when(Boolean(c), (el) => el.bg(alpha(c, "1a")))
          .child(`${r.sign === " " ? "" : r.sign}${r.text}` || " ");
      }));
    const askView = ask.length
      ? v_flex().gap(4).min_w(0)
        .when(Boolean(file), (el) => el.child(div().min_w(0).truncate().text_size(12).text_color(ink(t, 0.5)).child(file)))
        .child(this.askOpen ? enter(this.m, body.max_h(260).overflow_y_scrollbar(), "kc-ask-open", { dy: 0 }) : body.id("kc-ask"))
        .when(shown.foldable, (el) => el.child(h_flex().gap(6).items_center()
          .child(pill("kc-ask-fold", this.askOpen ? tr("composer.askFold") : tr("composer.askAll", { n: ask.length }), () => { this.askOpen = !this.askOpen; }))
          .when(this.askOpen && shown.more > 0, (el) => el.child(div().text_size(12).text_color(ink(t, 0.5)).child(tr("composer.askMore", { n: shown.more }))))))
      : null;
    // A dialog waits in the terminal: what it asks, its answers when it has some, the terminal.
    const blocked = m === "blocked"
      ? v_flex().gap(6).px(12).py(10).rounded(12).border(1).border_color(alpha(t.blocked, "66")).bg(alpha(t.blocked, dark ? "14" : "1f"))
        .child(h_flex().gap(8).items_center()
          .child(div().size(6).flex_none().rounded_full().bg(t.blocked).loop("opacity", { from: 0.3, to: 1, period: 1200 }))
          .child(div().flex_1().min_w(0).truncate().text_size(13).font_medium().text_color(ink(t, 1)).child(p?.title || tr("composer.blocked"))))
        .when(Boolean(askView), (el) => el.child(askView))
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
    // #93: files dropped on the face join the message (dropped(): their paths, absolute, never a copy); the
    // ones waiting show above the text (draftView); « + » opens the system's chooser.
    const drafts = this.draftView(t, cx);
    // #81: a completed piece's wave (menu.js: three dither crests crossing the field in its category's
    // hue, then a workflow's rail of its steps), under the text, in the field's box that clips: nothing
    // around it moves. Gone once it ran, and never in reduced motion. The field's width: the card's.
    const fx = this.wave;
    const fieldW = Math.min(this.width, COLUMN) - 22;
    const waves = fx ? wave(t, this.m, fx.id, fx.category, fieldW, { dark }) : [];
    const railEl = fx?.rail ? rail(t, this.m, `${fx.id}-rail`, FLOW_STEPS.length, { dark }) : null;
    if (fx && !waves.length && !railEl) this.wave = null;
    const card = v_flex().id("kc-card").w_full().rounded(12).border(1).border_color(ink(t, this.typing ? 0.2 : 0.1))
      .bg(dark ? ink(t, 0.03) : t.background).when(!dark, (el) => el.shadow_sm())
      // Cmd+V in the field comes here first (init's binding, « KtComposer > Input »): pasteKey.
      .key_context("KtComposer").on_action("kt_chat_paste", (_e, cx) => this.pasteKey(cx))
      .when(Boolean(drafts), (el) => el.child(drafts))
      .child(div().id("kc-field").relative().overflow_hidden().px(12).pt(10).pb(14).cursor_text().on_click(() => this.composer.focus())
        .children(waves)
        .when(Boolean(railEl), (el) => el.child(railEl))
        // A piece the field holds as a token (#81, CHIPS): its chip (categories.js pieceChip), as #93's above the text.
        .child(Textarea.new(this.composer).w_full().text_size(14).text_color(ink(t, 1))
          .token((ctx) => pieceChip(t, this.cpl.pieces.get(ctx.token.id) ?? { kind: "file", category: "file", label: ctx.token.label ?? ctx.token.text }, { dark })
            .h(Math.min(22, ctx.line_height || 22)))))
      .child(h_flex().px(8).pb(10).gap(4).items_center()
        .child(this.iconBtn(t, "kc-attach", this.picking || this.pasting ? SPIN : I("plus"), tr("attach.pick"), (cx) => this.pick(cx), 26))
        .when(Boolean(model), (el) => el.child(toolPill(CLAUDE_ICON, [[model, 1], ...(effort ? [[effort, 0.5]] : [])])))
        .when(Boolean(perm), (el) => el.child(toolPill(PERM[perm] ?? OWN("lock"), [[tr(`perm.${perm}`) || perm, 0.7]], full ? FULL_ACCESS : null)))
        .child(div().flex_1())
        .child(send));
    // « Compacter » (compact.js): what it does now goes in the same words' slot (no line of its own).
    const cw = this.compactor.words(a?.address);
    const say = this.sending ? tr("composer.sending")
      : this.sendErr ? tr(`composer.err.${this.sendErr.why}`, { why: this.sendErr.message ?? "" })
        : cw.note ? cw.note
        : this.cpl.route ? this.cpl.route // #81: the route the /command at the head takes
        : this.handle.is_focused() ? tr("hint")
          : m === "queue" ? tr("composer.queue") : m === "blocked" ? tr("composer.held") : tr("composer.hint");
    const sayErr = Boolean(this.sendErr) || (!this.sending && cw.error);
    const ctx = Number(this.line?.ctx_pct);
    const bar = (icon, text, id) => h_flex().id(id).h(24).px(6).ml(-6).gap(6).items_center().rounded(6).text_size(12).text_color(ink(t, 0.55))
      .child(svg(icon).size(14).flex_none()).child(div().max_w(256).truncate().child(text));
    const under = h_flex().pt(6).px(15).gap(10).items_center().min_w(0)
      .when(Boolean(pr), (el) => el.child(bar(I(pr.worktree ? "folder-tree" : "folder"), pr.worktree ? tr("ws.worktree") : tr("ws.checkout"), "kc-ws")))
      .when(Boolean(pr?.branch), (el) => el.child(bar(I("git-branch"), pr.branch, "kc-br")))
      .child(div().flex_1().min_w(0).truncate().flex().justify_end().text_size(11).text_color(sayErr ? ERR : ink(t, 0.45)).child(say))
      // kt-composer's CTX item: its label, the 14 px ring, the percent rolling in the ring's color (levels.js'
      // context thresholds by the window's size); the ring's tooltip says « Contexte 77 % » (ring.strings.js).
      // « Compacter » before it (Kylian: where the context shows), h 22 in the line's 24: nothing moves.
      .when(Number.isFinite(ctx), (el) => el.child(h_flex().gap(7).items_center().flex_none().whitespace_nowrap()
        .child(compactButton(t, "kc-compact", cw, () => this.compactor.press(a.address, this.line?.session_id ?? null)))
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child("CTX")) // i18n: tech
        .child(ring(t, "kc-ctx-ring", ctx, 14, { kind: "ctx", window: this.line?.window }))
        .child(roll(this.m, "kc-ctx-n", `${Math.round(ctx)}%`, 16).font_family(MONO).text_size(11)
          .text_color(ringColor(t, Math.round(ctx), { kind: "ctx", window: this.line?.window ?? 1_000_000 })))));
    // #84: the agent's tasks on a ledge over the card, its sub-agents on one under it, both against
    // the card (shelf.js); nothing when there is nothing to follow. A dialog waiting goes above them.
    // The tasks: the bridge's todos, else the session's plan (data/kt-chat/plan/<terminal>.json), dated.
    const bridge = this.bridgeOf(a?.address);
    const src = this.tasksFor(a?.address);
    const tasks = tasksLedge(src?.todos);
    const subs = agentsLedge(bridge?.agents, Date.now(), a?.address ?? "");
    // #92: a ledge whose data went (its tasks all done, its last sub-agent gone) fades out where it
    // stood, its last state kept, then goes (goOut()); its data coming back meanwhile cancels that.
    const keyA = a?.address ?? "";
    // Another agent shown: the last one's ledges are forgotten. Back on an agent, its old ledge would
    // otherwise fade out where it stood, its height held unseen (cold review, point 5).
    if (this.lastLedge.key !== keyA) this.lastLedge = { key: keyA };
    const ledge = (kind, now, draw) => {
      const gone = `kc-${kind}-led-${keyA}`;
      if (now) {
        this.going.delete(gone);
        this.lastLedge[kind] = now;
        return draw(now);
      }
      const l = this.lastLedge[kind];
      if (!l) return null;
      this.goOut(cx, gone, () => { if (this.lastLedge[kind] === l) this.lastLedge[kind] = null; }, { inRender: true });
      return this.m.reduced ? null : draw(l);
    };
    const tasksEl = ledge("tasks", tasks && { led: tasks, at: src?.plan ? src.at : null }, (x) => this.tasksShelf(t, x.led, a, cx, x.at));
    const subsEl = ledge("agents", subs && { led: subs }, (x) => this.agentsShelf(t, x.led, a, cx));
    return h_flex().w_full().flex_none().justify_center()
      .child(v_flex().relative().w_full().max_w(COLUMN).px(10).pb(6).gap(8)
        // runner: its band in the flow, first, on the card's left edge: the transcript ends above it and
        // nothing is drawn over it or under it (Kylian, 2026-11-19: the live turn went over Clawd when it
        // bit into the transcript). this.band: render() worked it out, to keep a followed view at the bottom.
        // It comes in as the ledges do (#92 rise(): motion.js enter(), fades in and rises in a box that
        // clips; reduced motion: as it is); it goes at once, its place with it.
        .when(this.band, (el) => el.child(this.rise(runnerBand(this.runner), "kc-runner-band")))
        .when(Boolean(blocked), (el) => el.child(blocked))
        .child(v_flex().w_full()
          .when(Boolean(tasksEl), (el) => el.child(tasksEl))
          .child(card)
          .when(Boolean(subsEl), (el) => el.child(subsEl)))
        .child(under));
  }

  // ---------- the composer's ledges (#84, shelf.js) ----------

  /** The bridge file as last read, only when it is this agent's (never another agent's tasks). */
  bridgeOf(address) {
    return address && this.bridgeFor === address ? this.bridge : null;
  }

  /** The session's plan as last read, only when it is this agent's. */
  planOf(address) {
    return address && this.bridgeFor === address ? this.plan : null;
  }

  /** What the tasks' ledge shows for this agent (shelf.js tasksOf): the bridge's todos, else its session's plan. */
  tasksFor(address) {
    return tasksOf(this.bridgeOf(address)?.todos, this.planOf(address));
  }

  /**
   * Reads the agent's herdr-bridge file, threads-io.js' read for one agent (the sidebar's source, so
   * both say the same): a torn read keeps the last one; a redraw only when what the ledges show
   * changes (the tasks, the sub-agents, their ages, one leaving after GONE).
   */
  readBridge(cx, address) {
    if (!address || address.includes("/") || this.bridgeReading) return;
    this.bridgeReading = true;
    cx.spawn(async (cx) => {
      let next = this.bridgeOf(address);
      let plan = this.planOf(address);
      try {
        const s = await readTextFile(`${home()}/.claude/cache/herdr/${address}.json`);
        next = s ? JSON.parse(s) : null;
      } catch {
        // a torn read keeps the last one
      }
      // The session's plan, kept by hand for a session with no TaskCreate (the tasks' ledge falls back on
      // it): absent, none; caught mid-write (unreadable), the last valid one stays, no blink.
      try {
        const s = await readTextFile(`${appHome()}/data/kt-chat/plan/${address}.json`);
        plan = s ? JSON.parse(s) : null;
      } catch {
        // a torn read keeps the last one
      }
      this.bridgeReading = false;
      const now = Date.now();
      const src = tasksOf(next?.todos, plan);
      const key = JSON.stringify([address, src?.todos ?? null, next?.agents ?? null, shownAgents(next?.agents, now).map((a) => agentAge(a, now)), src?.at ? relative(src.at, { now }) : ""]);
      this.bridgeFor = address;
      this.bridge = next;
      this.plan = plan;
      this.feedRunner(); // runner: its action, its status or its agent may have just changed
      if (key !== this.bridgeKey) {
        this.bridgeKey = key;
        cx.notify();
      }
    });
  }

  /** runner: what the runner should hold for this target (runnerProps), the bridge only when it is its agent's. */
  runnerNow(tg) {
    const a = tg.agent ?? null;
    return runnerProps(a, a && this.bridgeFor === a.address ? this.bridge : null);
  }

  /**
   * runner: hands the runner its agent when that changed, from a task (readBridge's, or one live() starts):
   * set_props notifies it, so never during render.
   */
  feedRunner() {
    const { props, key } = this.runnerNow(target());
    if (key === this.runnerKey) return;
    this.runnerKey = key;
    this.runner.set_props(props);
  }

  /**
   * The reads' timer, every BRIDGE ms while this face shows and its agent works or shows sub-agents
   * (their ages move, an ended one goes after GONE); it stops itself when that ends. A data timer: the
   * ledges' motion is native.
   */
  watchBridge(cx) {
    const tg = target();
    const address = !this.fixed && tg.agent && !tg.reason ? tg.agent.address : null;
    const on = watching({ address, shown: this.isShown(), status: tg.agent?.status, agents: this.bridgeOf(address)?.agents, now: Date.now(),
      tasks: Boolean(tasksLedge(this.tasksFor(address)?.todos)) });
    if (on && !this.bridgeTicker) {
      this.bridgeTicker = cx.timer.every(BRIDGE, (cx) => {
        this.watchBridge(cx);
        if (this.bridgeTicker) this.readBridge(cx, target().agent?.address);
        // #58: a sub-agent's transcript open under its line, while it runs: what it wrote since.
        if (this.bridgeTicker) this.followSubs(cx);
      });
    } else if (!on && this.bridgeTicker) {
      this.bridgeTicker.cancel();
      this.bridgeTicker = null;
    }
  }

  /**
   * A ledge's 30 px header: what it holds, a chevron; a click unfolds it (`set`, per agent) or folds it:
   * its body fades out first (#92, goOut(), under `${id}~${key}`), the ledge's height kept meanwhile.
   */
  shelfHead(t, id, set, key, open, chevron, ...parts) {
    return h_flex().id(id).h(30).gap(8).items_center().cursor_pointer()
      .on_click((_e, cx) => {
        cx.stop_propagation();
        if (open) return this.goOut(cx, `${id}~${key}`, () => set.delete(key));
        set.add(key);
        cx.notify();
      })
      .children(parts)
      .child(h_flex().size(20).flex_none().rounded(6).items_center().justify_center().text_color(ink(t, 0.45))
        .hover((s) => s.bg(ink(t, 0.08)).text_color(ink(t, 0.9)))
        .child(svg(I(chevron)).size(12)));
  }

  /**
   * The tasks' ledge on top of the card, Monocode's composer shelf (conversation/composer_shelf.rs):
   * rounded on its free side, no edge against the card, 8 in, ground 0.03, edge 0.08 dark / 0.06
   * light. Folded by default: its header says the one in front and done / total. Unfolded: the
   * sidebar's lines (kt-threads todoList: ✓ done, ● running, ○ to do), six, then "+N".
   */
  tasksShelf(t, led, a, cx, at = null) {
    const key = a?.address ?? "";
    const open = this.tasksOpen.has(key);
    const dark = Boolean(settings().dark);
    const mark = (s) => (s === "completed" ? svg(I("check")).size(11).flex_none().text_color(t.done)
      : s === "in_progress" ? div().size(7).rounded(4).flex_none().bg(t.working)
        : div().size(7).rounded(4).flex_none().border(1.5).border_color(t.dim));
    // #92: a task's mark fades in when its state changes (a new id per state: one done, its ✓ comes in).
    const taskLines = () => v_flex().pb(6)
      .children(led.rows.map((x, i) => h_flex().h(22).gap(8).items_center()
        .child(enter(this.m, h_flex().w(16).flex_none().items_center().justify_center().child(mark(x.status)), `kc-tk-${key}-${i}-${x.status}`, { dy: 0 }))
        .child(div().flex_1().min_w(0).truncate().text_size(12.5)
          .text_color(x.status === "in_progress" ? ink(t, 0.9) : x.status === "completed" ? ink(t, 0.4) : ink(t, 0.6)).child(sayTask(x)))))
      .when(led.more > 0, (el) => el.child(div().pl(24).h(18).font_family(MONO).text_size(10.5).text_color(ink(t, 0.4)).child(`+${led.more}`)));
    // A spinner only while a task runs and its agent works (an active state); else the list's icon.
    const busy = led.live && a?.status === "working";
    const head = this.shelfHead(t, "kc-tasks-head", this.tasksOpen, key, open, open ? "chevron-down" : "chevron-up",
      h_flex().size(16).flex_none().items_center().justify_center().text_color(ink(t, 0.6))
        .child(busy ? svg(SPIN).size(12).spin(900) : svg(I("list")).size(13)),
      div().flex_none().text_size(12.5).font_medium().text_color(ink(t, 0.8)).child(tr("shelf.tasks")),
      div().flex_1().min_w(0).truncate().text_size(12.5).text_color(ink(t, 0.4)).child(led.current),
      div().flex_none().font_family(MONO).text_size(11).text_color(ink(t, 0.45)).child(`${led.done} / ${led.total}`),
      // A session's plan is kept by hand and can grow old: its age (the bridge, live, has none).
      ...(at ? [div().flex_none().text_size(11).text_color(ink(t, 0.35)).child(tr("shelf.planAge", { ago: relative(at) }))] : []));
    // #92: unfolded, its lines come in as the popups do and fade out before it folds; the composer's
    // height moves once, never frame by frame (it is the transcript's height: a followed bottom would
    // redraw on every frame). The ledge itself comes in the same way, and fades out when its data goes.
    const body = open ? this.rise(taskLines(), `kc-tasks-b-${key}`, `kc-tasks-head~${key}`) : null;
    return this.rise(v_flex().mx(8).px(10).rounded_t(10).border_t(1).border_x(1).border_color(ink(t, dark ? 0.08 : 0.06)).bg(ink(t, 0.03))
      .child(head).when(Boolean(body), (el) => el.child(body)), `kc-tasks-${key}-ledge`, `kc-tasks-led-${key}`);
  }

  /**
   * The sub-agents' ledge under the card: the same ledge upside down (rounded below, no edge against
   * the card). Folded by default: its header shows the first ones' companions, how many and how many
   * run. Unfolded: kt-threads' branches (tree.js), the trunk leaving from under the first companion,
   * each one's companion in its coiffe (variantFor, its siblings the bridge's whole list), what it does,
   * its age; an ended one fades after FADE (the sidebar's rules, shelf.js). A click on one shows its
   * detail under it, or folds it.
   */
  agentsShelf(t, led, a, cx) {
    const key = a?.address ?? "";
    const open = this.agentsOpen.has(key);
    const dark = Boolean(settings().dark);
    const now = Date.now();
    const rest = treeLine(t);
    const H = 28; // kt-threads' BRANCH_H
    const pet = (x, id) => companion({
      program: a?.program, id, cx, size: 20, height: 16,
      variant: variantFor(`${key}:${x.id}`, led.kin),
      state: isAlive(x) ? "working" : x.state === "done" ? "done" : x.state === "error" ? "error" : "idle",
      since: isAlive(x) ? startOf(x) : now - endOf(x) < 5000 ? undefined : endOf(x),
      memo: (this.memos[`${key}:${x.id}`] ??= {}),
    });
    const n = led.rows.length;
    // A live one's branch in its state's color, a failed one in a muted red, the others at rest.
    const colorOf = (x) => (isAlive(x) ? alpha(t.working, "99") : x.state === "error" ? alpha(t.ansi1, "80") : rest);
    // #92: a sub-agent new since the last render comes in as the popups do; the others are drawn as
    // they are (one that ends fades already, FADE, then goes after GONE, at once).
    const known = this.subsKnown.get(key);
    this.subsKnown.set(key, new Set(led.rows.map((x) => x.id)));
    const row = (x, i) => {
      const ended = !isAlive(x);
      const last = i === n - 1;
      const shown = this.subOpen === x.id;
      const color = colorOf(x);
      const wid = `kc-sa-in-${key}-${x.id}`;
      if (!known || known.has(x.id)) this.m.shown.add(wid);
      // Its detail: in as the popups do, out fading before it goes (#92).
      const away = `kc-sad-${key}-${x.id}`;
      return this.rise(v_flex()
        .child(h_flex().id(`kc-sa-${key}-${x.id}`).h(H).gap(8).items_center().rounded(6).cursor_pointer().hover((s) => s.bg(ink(t, 0.05)))
          .on_click((_e, cx) => {
            cx.stop_propagation();
            if (shown) return this.goOut(cx, away, () => { if (this.subOpen === x.id) this.subOpen = null; });
            this.subOpen = x.id;
            cx.notify();
          })
          .child(twig(t, { h: H, x: 10, last: last && !shown, color, rest }))
          .child(h_flex().flex_1().min_w(0).gap(8).items_center().when(ended && now - endOf(x) > FADE, (el) => el.opacity(0.45))
            .child(pet(x, `kc-sa-pet-${key}-${x.id}`))
            .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(ended ? ink(t, 0.5) : ink(t, 0.85)).child(x.what || x.name || "agent")) // i18n: tech
            .child(div().flex_none().pr(4).font_family(MONO).text_size(11).text_color(ink(t, 0.45)).child(agentAge(x, now)))))
        .when(shown, (el) => el.child(this.rise(this.subDetail(t, x, last, rest, now), `kc-sad-in-${key}-${x.id}`, away))), wid);
    };
    const alive = led.alive;
    const head = this.shelfHead(t, "kc-agents-head", this.agentsOpen, key, open, open ? "chevron-up" : "chevron-down",
      // Unfolded, the trunk leaves from under the first companion (its 16 px in the 30 px header: 7 down
      // to the branches, which the fold's clipping would cut from a reach of theirs).
      h_flex().relative().flex_none().gap(2).items_center().children(led.rows.slice(0, 3).map((x) => pet(x, `kc-sa-head-${key}-${x.id}`)))
        .when(open, (el) => el.child(div().absolute().top(16).left(10).h(7).border_l(1).border_color(colorOf(led.rows[0])))),
      div().flex_1().min_w(0).truncate().text_size(12.5).text_color(ink(t, 0.8))
        .child(`${tr("shelf.agents", { n })} · ${alive ? tr("shelf.running", { n: alive }) : tr("shelf.ended", { n })}`));
    // #92: as the tasks' ledge: its branches come in and fade out before it folds, the ledge itself
    // comes in and fades out when its last sub-agent goes; the composer's height moves once.
    const body = open ? this.rise(v_flex().pb(6).children(led.rows.map(row)), `kc-agents-b-${key}`, `kc-agents-head~${key}`) : null;
    return this.rise(v_flex().mx(8).px(10).rounded_b(10).border_b(1).border_x(1).border_color(ink(t, dark ? 0.08 : 0.06)).bg(ink(t, 0.03))
      .child(head).when(Boolean(body), (el) => el.child(body)), `kc-agents-${key}-ledge`, `kc-agents-led-${key}`);
  }

  /**
   * A sub-agent's detail under its branch: its type and model when its Agent call is in the loaded
   * turns (shelf.js runOf), how long it runs or ran (the bridge), its prompt's first three lines. The
   * trunk goes on through it unless it is the last.
   */
  subDetail(t, x, last, rest, now) {
    const run = runOf(this.turns, x.id);
    const d = duration(Math.max(0, (isAlive(x) ? now : endOf(x)) - startOf(x)));
    const when = isAlive(x) ? tr("shelf.for", { d }) : x.state === "error" ? tr("shelf.error", { d }) : tr("shelf.done", { d });
    const facts = [run?.block?.input?.type ?? run?.type, run?.model, when].filter(Boolean).join(" · ");
    const prompt = lines(run?.block?.input?.prompt ?? "").filter((l) => l.trim()).slice(0, 3);
    return v_flex().relative().pl(28).pb(6).gap(2).min_w(0)
      .when(!last, (el) => el.child(div().absolute().top(0).bottom(0).left(10).border_l(1).border_color(rest)))
      .child(div().min_w(0).truncate().text_size(12).text_color(ink(t, 0.55)).child(facts))
      .children(prompt.map((l) => div().min_w(0).truncate().text_size(12).text_color(ink(t, 0.4)).child(l)));
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
    // #84: the agent's herdr-bridge file (its tasks, its sub-agents), read when this face shows or its
    // agent or status changes, then by watchBridge()'s timer while there is something to follow.
    // runner: a status or agent change goes to the runner from a task started here (set_props notifies,
    // never during render); readBridge's task hands it the action as it comes.
    if (this.runnerNow(tg).key !== this.runnerKey) cx.spawn(async () => this.feedRunner());
    const address = !this.fixed && tg.agent && !tg.reason ? tg.agent.address : null;
    if (address && shown && (!this.wasShown || status !== this.lastStatus || this.bridgeFor !== address)) this.readBridge(cx, address);
    this.watchBridge(cx);
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
      this.fresh.clear(); // another agent's turns land as they are (#92)
      this.liveItems = null;
      this.foldAt = null;
      this.subRuns.clear(); // its sub-agents are another session's (#58)
      this.load(cx);
    }
    this.live(cx, tg, want);
    // « Compacter » (compact.js): a yes waiting for rest goes when the agent's status says so (a render
    // follows each status change, as live() does).
    if (!checking()) this.compactor.tick(cx, { address: tg.agent?.address, session: this.line?.session_id ?? null });
    // #88: a project deleted by force (kt-projects) leaves kt.chat.backgrounds from outside this copy: its
    // last texture is forgotten and data/kt-chat swept, as after a setting changed here.
    const bgAll = shared(BG) ?? {};
    const bgKeys = Object.keys(bgAll).join("\n");
    if (bgKeys !== this.bgKeys) {
      for (const k of this.bgLast.keys()) if (!(k in bgAll)) this.bgLast.delete(k);
      this.bgKeys = bgKeys;
      this.cleanDue = true;
    }
    if (this.cleanDue && !checking()) this.sweepBg(cx);
    // The thread switched to its Chat face: take the keyboard, once per request, at the first render
    // that shows this face (a stamp seen while the face is still hidden waits for it: view.js writes the
    // stamp, then switches).
    const ask = shared("kt.chat.focus");
    if (!checking() && takesFocus(ask, this.focusAsked, chatShown(layout()))) {
      this.focusAsked = ask;
      cx.spawn(async (cx) => { this.focusIn(); cx.notify(); });
    }
    const keyed = this.handle.is_focused();
    const writes = !this.fixed && Boolean(tg.agent) && !tg.reason;
    // runner: its band (composerView) entering or leaving moves the transcript's bottom edge by 64 px: a
    // view following the bottom is brought back to it in this same frame (body() reveals it), not one late.
    const band = writes && runnerShown(tg.agent?.status, tg.agent?.program);
    if (keepBottom(this.follow, this.band, band)) this.reveal = "bottom";
    this.band = band;
    const pr = this.project(t, cx, tg);
    this.bgBtn = Boolean(pr); // bgControls draws its button (areaPress leaves a press on it)
    const bg = this.background(t, cx, pr);
    // shell/project_settings.rs:304-317: the image first, the conversation over it; nothing paints a
    // ground (conversation.rs:3833-3852, transcript.rs:5880-5918).
    // No frame (Kylian, 2026-11-19: the background goes to the edges, as in Monocode); the corners
    // stay those of the thread's block (radius 16, the column's 20 less its padding of 4).
    // The body fades in when the agent changes (#92), not the copy's first one (its first show: the
    // skeleton, or the state read before, is there in the first image).
    const bodyId = `kc-body-${want ?? "none"}`;
    if (this.bodyFor === undefined) this.motion.shown.add(bodyId);
    this.bodyFor = want;
    return div().id("kt-chat").relative().size_full().rounded(16)
      .overflow_hidden().text_color(ink(t, 1))
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .on_drop((ev, cx) => this.dropped(cx, ev?.paths ?? [], pr))
      .on_size_change((size, cx) => {
        const z = Number(settings().zoom) || 1;
        const w = size.width / z, h = size.height / z;
        if (!this.size || Math.abs(w - this.size.w) > 1 || Math.abs(h - this.size.h) > 1) { this.size = { w, h }; this.width = w; cx.notify(); }
      })
      .when(Boolean(bg), (el) => el.child(bg))
      .child(v_flex().absolute().top(0).left(0).right(0).bottom(0)
        // #81: the completion menu, a passing popup over the transcript's bottom (menu.js, like bgMenu):
        // in the transcript's own box, so it never covers the composer and moves nothing in it.
        .child(div().relative().flex_1().min_h(0).flex().flex_col()
          .child(enter(this.m, this.body(t, cx, tg, keyed), bodyId, { dy: 0 }).flex_1().min_h(0))
          .when(writes, (el) => el.children([this.menuEl(t)].filter(Boolean))))
        .when(writes, (el) => el.child(this.composerView(t, tg, pr, cx))))
      .children(this.bgControls(t, pr) ?? []);
  }
}
