// kbrdn Threads' Crosstalk (the "crosstalk" child of the right panel's stack): a messenger over the
// crosstalk plugin's Herdr protocol, v1 and v2 (its README, "Herdr"). It shows the publication of
// the followed terminal, ~/.claude/cache/herdr/<terminal>.crosstalk.json (written by crosstalk
// only; the focused terminal, kept while Crosstalk has the keyboard, or one picked in the session
// selector), and answers through <terminal>.crosstalk-outbox.json (written here only: re-read,
// merged, written beside then `mv`, one write at a time, never the same bytes twice). A send is
// { id: uuid, to: key (v2) or name (v1), text }; its bubble says "envoi…", then "envoyé" (its
// tooltip: sent is not delivered when permission modes differ) or "refusé : <reason>"; an entry
// leaves `send` once its id is in `handled`. Opening a conversation writes read[<key>] = its last
// incoming message's time. v2 only: "Renommer" writes title[<key>] ("" clears it).
// Inbox (left when the panel is wide enough, else one view then the other): the search (fuzzy on
// title, project, topic and live name, substring in the messages), the conversation filter
// (Toutes / Actives / Non lues), the state and type rows (only the values the publication has),
// "N sur M"; then À traiter (waiting or unread), Actives (a message in 24 h), Inactives folded.
// Each row: the project's logo and color (kt.projects, by folder realpath, project or name), title,
// preview, time, unread. The conversation: a pixel dither of the project's color behind its header,
// bubbles by day and side in Markdown, the peer's with a stripe of that color, the reply field.
// Refresh: watchFolder on the cache folder, filtered on .crosstalk.json; 10 s fallback while shown.
// Keys (vim.js): ctrl-b l (pane.go, "focus") gives Crosstalk the keyboard. Inbox: j k gg G ctrl-d
// ctrl-u move, l / enter / o open (or unfold Inactives), h folds them, / searches (INSERT: ctrl-n
// ctrl-p ctrl-j ctrl-k move, enter opens, esc clears and goes NORMAL), tab / shift-tab the filter,
// y copies the name, r reads again, esc gives the keyboard back. Conversation: j k... over the
// messages, i / enter reply (INSERT: enter sends, esc NORMAL), r renames (v2; v1: reads again),
// y copies a message, h / esc back. [ ] the panel's tabs, ? the keys.
// Test hooks: `kt-crosstalk.fixture:<folder>` reads and writes that folder instead of the cache
// (`fixture:` goes back), `read`, `picker` (the session selector), `source:<terminal>` shows that terminal (`source:` follows again),
// `open:<key or name>`, `reply:<text>` (sends as enter does), `rename:<title>`, `query:<text>`,
// `nl` (inserts a line break in the reply, shows the field in a toast), `key:<keys>`.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, InputState, Input, TextView } from "gpui-base";
import { focused, panes, spaces, theme, layout, settings, shared, setShared, home, exec, readTextFile, writeTextFile, watchFolder, nextCommand, checking, run, notify, openOverlay } from "herdr";
import * as fs from "fs/promises";
import { randomUUID } from "crypto";
import { Vim, keyOf, keysOf, step } from "./vim.js";
import { filterRow, filterState } from "./filters.js";
import { motionState, frame, enter, ink, rows as motionRows } from "./motion.js";
import { skeleton, readyFor } from "./skeleton.js";
// kt-keys' roll.js (a byte-identical copy): the segments' counts and « N sur M » roll to their new digits.
import { roll, rollText } from "./roll.js";
import { bump, refreshOn } from "./bus.js";
import { ditherBand, TOP } from "./dither.js";
import { normalize, addr, nextOutbox, titleDone, sendState, unreadOf, groupOf, entryOf, matchPeer, snippet, runsOf, DAY } from "./xt.js";
import { makeT, date, time, lang } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);

const ME = "crosstalk"; // this block's id in the layout's "panel-body" stack
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const OWN = (name) => `mods/kt-crosstalk/${name}.svg`;
const CACHE = () => `${home()}/.claude/cache/herdr`;
const FILTERS = "kt-crosstalk.filters";
const QUERY = "kt-crosstalk.query";
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const paint = (t, c) => (!c ? null : c.startsWith("#") ? c : t[c] ?? null);
// The tables hold strings.js keys (conv.*, state.*, kind.*, status.*), said with tr() where shown.
const CONVS = [["all", "conv.all"], ["active", "conv.active"], ["unread", "conv.unread"]];
// [key, label, tint]: the coordinator's tints (FILTERS.md).
const STATES = [["live", "state.live", "ansi2"], ["busy", "state.busy", "working"], ["waiting", "state.waiting", "blocked"], ["idle", "state.idle", "done"], ["offline", "state.offline", "dim"]];
const KINDS = [["interactive", "kind.interactive", "accent"], ["remote", "kind.remote", "ansi4"], ["cloud", "kind.cloud", "ansi6"], ["background", "kind.background", "dim"]];
const STATUS = { busy: ["status.busy", "working"], waiting: ["status.waiting", "blocked"], idle: ["status.idle", "done"], offline: ["status.offline", "dim"] };
const KIND = Object.fromEntries(KINDS.map(([k, l, tint]) => [k, [l, tint]]));
const kindWord = (kind) => tr(kind[0]).toLowerCase();
const MOVES = ["down", "up", "top", "bottom", "half-down", "half-up"];

const parse = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
const clock = (at) => time(at);
const dayOf = (at) => `${tr(`day.${new Date(at).getDay()}`)} ${date(at, { year: false })}`;
const flat = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
// A message on one line without its Markdown marks, for a preview.
const plain = (s) => flat(s).replace(/\*\*|__|`/g, "").replace(/^[#>\s]+/, "");
function when(at) {
  if (!at) return "";
  const d = new Date(at), now = new Date();
  return d.toDateString() === now.toDateString() ? clock(at) : date(at, { year: false });
}
// fs reads past readTextFile's 1 MiB (200 Markdown messages can be long) but only in the home folder;
// readTextFile and ls reach a fixture folder elsewhere.
// (fs may throw at once outside the home, not reject: `later` turns that into a rejection.)
const later = (f) => { try { return Promise.resolve(f()); } catch (e) { return Promise.reject(e); } };
const readText = (p) => later(() => fs.readFile(p, "utf8")).catch(() => later(() => readTextFile(p))).catch(() => null);
const listDir = (d) => later(() => fs.readdir(d)).catch(() => exec("ls", ["-1", d]).then((r) => (r.code ? [] : r.stdout.split("\n").filter(Boolean)))).catch(() => []);
// A message's identity across renders (a Herdr send keeps its id from the outbox to the thread).
const msgKey = (m) => m.id ?? `${m.dir}:${m.at}:${m.text.length}`;
const uuid = () => { try { return randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; } };

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
// The focused terminal, else the shown tab's agent (else its first terminal). Local ones only.
function terminal() {
  const f = focused()?.terminal;
  if (f && !f.includes("/")) return f;
  const tab = spaces().find((s) => s.active)?.tabs.find((x) => x.active);
  const mine = panes().filter((p) => p.tab === tab?.id && p.terminal && !p.terminal.includes("/"));
  return (mine.find((p) => p.program?.agent) ?? mine[0])?.terminal ?? null;
}
// The panel's tabs in order, and each one's mod: [ / ] show the next one and give it the keyboard.
const TABS = ["files", "diff", "history", "flow", "crosstalk", "gwm-panel"];
const TAB_MODS = { files: "kt-files", diff: "kt-diff", history: "kt-history", flow: "kt-flow", crosstalk: "kt-crosstalk", "gwm-panel": "kt-gwm" };
// The keyboard follows a moment later: a `<mod>.focus` sent at once reaches no copy (the new tab
// isn't shown yet) and the app gives the keyboard back to the terminal.
function panelTab(dir, cx) {
  const child = TABS[(TABS.indexOf(ME) + dir + TABS.length) % TABS.length];
  run("layout.select", { stack: "panel-body", child });
  cx.timer.after(120, () => run(child === "gwm-panel" ? "kt-gwm.panel-focus" : `${TAB_MODS[child]}.focus`));
}
// NORMAL / INSERT, kt-keys' pill: INSERT on the ink, NORMAL plain.
const modePill = (t, vim) => div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
  .border_color(vim.insert ? alpha(t.accent, "66") : t.border).bg(vim.insert ? alpha(t.accent, "24") : t.background)
  .font_family(MONO).text_size(9).text_color(vim.insert ? t.accent : t.muted).child(vim.label);
// The projects registry (shared "kt.projects", kt-projects manages it) and a logo for the appearance.
const registry = () => [...(shared("kt.projects") ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
function logoOf(e) {
  const l = e?.logos ?? { light: e?.logo ?? null, dark: e?.logo ?? null };
  return (settings().dark ? (l.dark ?? l.light) : (l.light ?? l.dark)) ?? null;
}

export default class Crosstalk extends View {
  init(_props, cx) {
    this.src = null; // the terminal whose publication is shown
    this.pub = null; // that publication, normalized (xt.js), or { error }
    this.raw = null;
    this.box = null; // its outbox, as on disk
    this.boxRaw = null;
    this.term = null; // the followed terminal
    this.pick = null; // a terminal picked in the selector (null: follow)
    this.terms = []; // every terminal that publishes
    this.titles = {}; // terminal -> its session's name, for the selector
    this.real = {}; // folder -> realpath
    this.open = null; // { key, name }: the open conversation, followed by name when its key resolves
    this.zone = "list"; // where the keys go when both views show: "list" | "conv"
    this.cur = null; // the inbox cursor: a peer's key, or "fold"
    this.moved = false;
    this.mcur = -1; // the message cursor (-1: the last one)
    this.showIdle = false;
    this.picking = false;
    this.menu = false;
    this.renaming = false;
    this.typing = null; // the field that has the keyboard: "search" | "reply" | "rename"
    this.draft = "";
    this.drafts = {};
    this.width = 560;
    this.sent = []; // Herdr's sends, kept here: a refusal keeps neither text nor peer in the publication
    this.lastRows = { flat: [] };
    this.lastItems = [];
    this.query = String(shared(QUERY) ?? "");
    this.listScroll = ScrollHandle.new();
    this.msgScroll = ScrollHandle.new();
    this.frow = filterState(); // the state and type row (filters.js)
    this.motion = motionState(); // motion.js: the conversation's entry, new bubbles, the filter's ink
    this.known = null; // the open conversation's messages already drawn (null: take them all as history)
    this.fresh = new Set(); // the ones that came after: they fade in
    this.openSeq = 0;
    this.segW = {}; // the conversation filter's segments, measured for its ink
    this.headW = 0; // the conversation header, measured for its dither
    this.fixdir = null; // a test folder read and written instead of the cache (`fixture:<folder>`)
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: true });
    this.makeInputs();
    if (checking()) return;
    this.sent = load("sent") ?? [];
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        const name = c.split(":")[0];
        const arg = c.slice(name.length + 1);
        if (name === "focus") this.focusIn();
        else if (name === "key") {
          this.focusIn();
          for (const k of keysOf(arg)) this.press(k, cx);
        } else if (name === "fixture") {
          this.fixdir = arg || null;
          this.pick = null;
          this.src = null;
          this.watch?.cancel(); // the loop watches the new folder
          if (!this.watching) this.watchLoop(cx);
          this.read(cx, true);
        }
        else if (name === "read") this.read(cx, true);
        else if (name === "picker") { this.picking = !this.picking; if (this.picking) this.loadTitles(cx); }
        else if (name === "source") this.setSource(arg || null, cx);
        else if (name === "open") { const p = this.peers().find((x) => x.key === arg || x.name === arg); if (p) this.openConv(p, cx); }
        else if (name === "back") this.back();
        else if (name === "reply") { this.reply.set_value(arg); this.draft = arg; this.send(cx); }
        else if (name === "rename") { this.rename.set_value(arg); this.applyRename(cx); }
        else if (name === "query") { this.search.set_value(arg); this.query = arg; this.moved = false; }
        else if (name === "nl") { this.reply.replace("\n"); notify({ title: "kt-crosstalk nl", body: JSON.stringify(this.reply.value()), timeout: 8000 }); } // i18n: tech
        cx.notify();
      }
    });
    this.watchLoop(cx);
    cx.timer.every(10000, (cx) => this.read(cx));
    // The keyboard went away (Herdr doesn't always redraw then): drop the cursor. And the language
    // changed: the fields again, in it (an InputState keeps the placeholder it was made with), only
    // while none of them has the keyboard (else at the next tick after it leaves).
    cx.timer.every(500, (cx) => {
      if (this.inputLang !== lang() && !this.typing) { this.makeInputs(); cx.notify(); }
      if (this.keyed !== this.isKeyed()) cx.notify();
    });
    this.read(cx);
  }

  // The three fields (search, reply, rename) and their handlers, their placeholders in the language
  // now; made again on a language change, with what they held.
  // ponytail: the replaced states aren't released (one set per language switch); release them if
  // switches ever become frequent.
  makeInputs() {
    this.inputLang = lang();
    const keep = (s, fallback = "") => s?.value() ?? fallback;
    this.search = InputState.new({ placeholder: tr("ph.search"), value: keep(this.search, this.query) });
    this.reply = InputState.new({ placeholder: tr("ph.reply"), value: keep(this.reply) });
    this.rename = InputState.new({ placeholder: tr("ph.rename"), value: keep(this.rename) });
    this.search.on("change", (_e, cx) => {
      const q = this.search.value();
      if (q === this.query) return;
      this.query = q;
      this.moved = false;
      this.listScroll.scroll_to_item(0);
      cx.notify();
    });
    this.search.on("submit", (_e, cx) => { const r = this.lastRows.flat.find((x) => this.rowKey(x) === this.cur); if (r?.p) this.openConv(r.p, cx); cx.notify(); });
    this.reply.on("change", (_e, cx) => {
      const had = Boolean(this.draft.trim());
      this.draft = this.reply.value();
      if (had !== Boolean(this.draft.trim())) cx.notify();
    });
    // Enter sends; shift-enter asks for a line break (a one-line field may drop it).
    this.reply.on("submit", (e, cx) => { if (e?.shift) this.reply.replace("\n"); else this.send(cx); });
    this.rename.on("submit", (_e, cx) => this.applyRename(cx));
    for (const [state, name] of [[this.search, "search"], [this.reply, "reply"], [this.rename, "rename"]]) {
      state.on("focus", (_e, cx) => { this.typing = name; this.vim.edit(); this.zone = name === "search" ? "list" : "conv"; cx.notify(); });
      state.on("blur", (_e, cx) => {
        if (this.typing === name) { this.typing = null; this.vim.normal(); }
        if (name === "search") this.saveQuery();
        cx.notify();
      });
    }
  }

  // ---------- source, reading, writing ----------

  // crosstalk rewrites its publications in one folder: wake on them (a session that starts publishing
  // or whose file goes too); the 10 s timer reads only while shown, and carries on if a watch fails.
  watchLoop(cx) {
    this.watching = true;
    cx.spawn(async (cx) => {
      try {
        for (;;) {
          const dir = this.dir();
          this.watch = watchFolder(dir);
          const changed = await this.watch;
          if (this.dir() !== dir) continue;
          if (changed.some((p) => p === dir || p.endsWith(".crosstalk.json"))) this.read(cx);
        }
      } catch { this.watching = false; }
    });
  }

  isKeyed() { return this.handle.is_focused() || Boolean(this.typing); }
  wide() { return this.width >= 640; }
  inboxW() { return Math.round(Math.min(340, Math.max(260, this.width * 0.42))); }
  // The terminal followed: the focused one, kept while Crosstalk has the keyboard.
  follow() { return this.isKeyed() && this.term ? this.term : terminal(); }
  source() { return this.pick ?? this.follow(); }
  dir() { return this.fixdir ?? CACHE(); }
  pubOk() { return Boolean(this.pub && !this.pub.error); }
  peers() { return this.pubOk() ? this.pub.peers : []; }
  canSend() { return this.pubOk() && Boolean(this.pub.session.id); }

  setSource(term, cx) {
    this.pick = term || null;
    this.picking = false;
    this.read(cx, true);
  }

  read(cx, force = false) {
    if (!visible() || this.reading) return;
    const term = this.follow();
    const src = this.pick ?? term;
    this.reading = true;
    cx.spawn(async (cx) => {
      try {
        const dir = this.dir();
        const terms = (await listDir(dir)).filter((n) => n.endsWith(".crosstalk.json")).map((n) => n.slice(0, -15)).sort();
        const text = src ? await readText(`${dir}/${src}.crosstalk.json`) : null;
        const boxText = src ? await readText(`${dir}/${src}.crosstalk-outbox.json`) : null;
        this.term = term;
        const same = src === this.src;
        if (!force && same && text === this.raw && boxText === this.boxRaw && terms.join() === this.terms.join()) return;
        const reg = registry();
        let pub = null;
        if (text != null) {
          const j = parse(text);
          pub = j ? normalize(j, reg.map((e) => e.name)) : same && this.pubOk() ? this.pub : { error: "unreadable" }; // i18n: tech
        }
        if (!same) { this.open = null; this.menu = false; this.renaming = false; this.cur = null; this.moved = false; this.zone = "list"; }
        await this.resolve(pub, reg);
        Object.assign(this, { src, raw: text, pub, box: parse(boxText), boxRaw: boxText, terms });
        this.sync(cx);
        cx.notify();
      } finally {
        this.reading = false;
        // An answer for `src`, even unchanged or failed: its skeleton gives way to what is there (readyFor).
        if (this.readFor !== src) { this.readFor = src; cx.notify(); }
        // The source changed while this read ran (that read was dropped): read the new one now.
        if (this.source() !== src) this.read(cx);
      }
    });
  }

  // Folders' realpaths, once each: a peer's project folder and the registry's meet through them.
  async resolve(pub, reg) {
    const ex = (p) => (typeof p === "string" && p.startsWith("~/") ? `${home()}${p.slice(1)}` : p);
    const paths = [pub?.session?.cwd, ...(pub?.peers ?? []).map((p) => p.project), ...reg.filter((e) => !e.machine).map((e) => e.folder)]
      .map(ex).filter((p) => typeof p === "string" && p.startsWith("/") && !(p in this.real));
    for (const p of new Set(paths)) {
      const r = await exec("realpath", [p]).catch(() => null);
      this.real[p] = r && !r.code ? r.stdout.trim() : p;
    }
  }

  // A peer's registry entry; none for a v2 peer without a project (it gets the neutral tint).
  entry(p) { return this.pub?.v === 2 && !p.project ? null : entryOf(this.reg ?? registry(), p.project, p.name, (x) => this.real[x] ?? x); }
  sessionEntry() {
    const s = this.pub?.session, reg = this.reg ?? registry(), real = (x) => this.real[x] ?? x;
    return s ? (s.cwd && entryOf(reg, s.cwd, null, real)) || entryOf(reg, s.project, s.name, real) : null;
  }
  // The project's color; a project without one: the accent; a v2 peer without a project: neutral.
  tint(t, e, p) { return paint(t, e?.color) ?? (p && this.pub?.v === 2 && !p.project ? t.dim : t.accent); }
  // The outbox's say for this session (another session's outbox counts for nothing).
  ours() { return this.box && this.box.session === this.pub?.session?.id ? this.box : null; }
  mark(p) { return this.ours()?.read?.[addr(this.pub, p)] ?? 0; }
  // A rename shows at once, until the publication changes: then the published title is the truth
  // (crosstalk applies a title once, and another session may rename after it).
  titleOf(p) {
    const r = this.renamed;
    return (r && r.key === p.key && r.raw === this.raw && r.value) || p.title;
  }

  // After a read: retire what crosstalk handled (sends, titles it shows), and mark read the conversation shown.
  sync(cx) {
    if (!this.canSend()) return;
    const change = {};
    const c = this.conv();
    if (c?.lastIn && !(this.mark(c) >= c.lastIn)) change.read = { [addr(this.pub, c)]: c.lastIn };
    const stale = (this.ours()?.send ?? []).some((e) => this.pub.handled[e.id])
      || Object.entries(this.ours()?.title ?? {}).some(([k, v]) => this.pub.v === 2 && titleDone(this.pub, k, v));
    if (change.read || stale) this.commit(cx, change);
  }

  // A write, then the bus: whatever shows crosstalk's unread or titles reads again (DATA-SYNC.md).
  commit(cx, change, onError) {
    cx.spawn(async (cx) => {
      try { await this.write(change); } catch (err) {
        const msg = String(err?.message ?? err);
        if (onError) onError(msg);
        else notify({ title: tr("outbox.title"), body: msg, level: "error" });
      }
      bump("crosstalk");
      cx.notify();
    });
  }

  // One outbox write, after the ones before it: re-read, merged (xt.js nextOutbox), written beside
  // with a fresh name, then moved over. Only for the publication shown, and only if the bytes change.
  write(change) {
    const src = this.src, pub = this.pub;
    if (!src || !this.canSend()) return Promise.reject(new Error(tr("noPublication")));
    const dir = this.dir();
    const path = `${dir}/${src}.crosstalk-outbox.json`;
    const job = (this.writing ?? Promise.resolve()).catch(() => {}).then(async () => {
      const before = await readText(path);
      const next = nextOutbox(pub, parse(before), change);
      const text = `${JSON.stringify(next, null, 2)}\n`;
      if (text !== before) {
        const tmp = `${dir}/.${src}.crosstalk-outbox.${uuid()}.tmp`;
        await writeTextFile(tmp, text, null);
        const r = await exec("mv", ["-f", tmp, path]);
        if (r.code) {
          await exec("rm", ["-f", tmp]).catch(() => {});
          throw new Error(r.stderr.trim() || `mv: ${r.code}`);
        }
      }
      if (src === this.src) { this.box = next; this.boxRaw = text; }
    });
    this.writing = job;
    return job;
  }

  send(cx) {
    const text = this.reply.value().trim();
    const c = this.conv();
    if (!text || !c || !this.canSend()) return;
    this.reply.set_value("");
    this.draft = "";
    const e = { id: uuid(), to: addr(this.pub, c), text, at: Date.now() };
    const log = { ...e, session: this.pub.session.id };
    this.sent = [...this.sent.filter((x) => e.at - x.at < 7 * DAY).slice(-199), log];
    save("sent", this.sent);
    this.mcur = -1;
    this.revealMsg = true;
    this.commit(cx, { send: e }, (msg) => { log.err = msg; save("sent", this.sent); });
    cx.notify();
  }

  startRename() {
    const c = this.conv();
    if (!c || this.pub?.v !== 2) return;
    this.menu = false;
    this.renaming = true;
    this.rename.set_value(this.titleOf(c));
    this.rename.focus();
  }

  applyRename(cx) {
    const c = this.conv();
    if (!c || this.pub?.v !== 2) return;
    this.renaming = false;
    if (this.typing) this.handle.focus();
    const value = this.rename.value().trim();
    this.renamed = { key: c.key, value, raw: this.raw };
    this.commit(cx, { title: { [c.key]: value } });
  }

  saveQuery() { if (String(shared(QUERY) ?? "") !== this.query) setShared(QUERY, this.query); }
  filters() { return { conv: "all", state: "all", kind: "all", ...(shared(FILTERS) ?? {}) }; }
  setFilter(k, v) { setShared(FILTERS, { ...this.filters(), [k]: v }); this.moved = false; }
  // The state and type values the publication has (v1: often none, so no row).
  options() {
    const ps = this.peers();
    return {
      states: STATES.filter(([k]) => (k === "live" ? ps.some((p) => p.live !== null) : ps.some((p) => p.status === k))),
      kinds: KINDS.filter(([k]) => ps.some((p) => p.kind === k)),
    };
  }

  // ---------- conversations ----------

  conv() {
    if (!this.open) return null;
    const ps = this.peers();
    const c = ps.find((p) => p.key === this.open.key) ?? ps.find((p) => p.name === this.open.name) ?? null;
    if (c) this.open = { key: c.key, name: c.name };
    return c;
  }

  openConv(p, cx) {
    if (this.open) this.drafts[this.open.key] = this.reply.value();
    this.open = { key: p.key, name: p.name };
    this.reply.set_value(this.drafts[p.key] ?? "");
    this.draft = this.drafts[p.key] ?? "";
    this.cur = p.key;
    this.moved = true;
    this.zone = "conv";
    this.menu = false;
    this.renaming = false;
    this.mcur = -1;
    this.revealMsg = true;
    this.known = null;
    this.fresh = new Set();
    this.openSeq++;
    this.sync(cx);
  }

  back() {
    if (this.wide()) this.zone = "list";
    else { if (this.open) this.drafts[this.open.key] = this.reply.value(); this.open = null; this.zone = "list"; }
    this.menu = false;
    this.renaming = false;
    this.revealList = true;
  }

  // The thread, with Herdr's sends it doesn't hold: pending, refused, unwritten (and a sent one
  // for the minute before crosstalk files it). A Herdr message in the thread is "sent".
  items(c) {
    const pub = this.pub;
    const ids = new Set(c.msgs.map((m) => m.id).filter(Boolean));
    const out = c.msgs.map((m) => ({ ...m, state: m.id ? { state: "sent" } : null }));
    for (const s of this.sent) {
      if (s.session !== pub.session.id || ids.has(s.id) || (s.to !== c.key && s.to !== c.name)) continue;
      const state = sendState(s, pub, this.ours());
      if (state.state === "sent" && Date.now() - s.at > 60e3) continue;
      out.push({ dir: "out", text: s.text, at: s.at, id: s.id, state });
    }
    return out.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  }

  rowKey(r) { return r?.fold ? "fold" : r?.p?.key ?? null; }

  // The inbox: filtered, searched, in groups; `flat` is what the cursor walks.
  rowsOf(now) {
    const f = this.filters(), opts = this.options();
    const state = opts.states.some(([k]) => k === f.state) ? f.state : "all";
    const kind = opts.kinds.some(([k]) => k === f.kind) ? f.kind : "all";
    const q = this.query.trim();
    const groups = { todo: [], active: [], idle: [] };
    const counts = { all: 0, active: 0, unread: 0 };
    const all = this.peers();
    let shown = 0;
    for (const p of all) {
      const unread = unreadOf(p, this.mark(p));
      const group = groupOf(p, unread, now);
      counts.all++;
      if (group !== "idle") counts.active++;
      if (unread) counts.unread++;
      if ((f.conv === "active" && group === "idle") || (f.conv === "unread" && !unread)) continue;
      if (state !== "all" && (state === "live" ? p.live !== true : p.status !== state)) continue;
      if (kind !== "all" && p.kind !== kind) continue;
      const e = this.entry(p);
      const fields = [this.titleOf(p), e?.name ?? p.project ?? "", p.topic ?? "", p.name];
      const m = q ? matchPeer(q, fields, p.msgs.map((x) => x.text).reverse()) : { score: 0, marks: [], hit: null };
      if (!m) continue;
      groups[group].push({ p, unread, group, e, m });
      shown++;
    }
    if (q) for (const g of Object.values(groups)) g.sort((a, b) => b.m.score - a.m.score);
    const openIdle = this.showIdle || Boolean(q);
    const rows = [...groups.todo, ...groups.active];
    if (groups.idle.length) rows.push({ fold: true });
    if (openIdle) rows.push(...groups.idle);
    return { groups, flat: rows, shown, total: all.length, openIdle, counts, state, kind };
  }

  // ---------- keys (vim.js; i and r first, as kt-picker's ⌘1-4) ----------

  focusIn() {
    this.handle.focus();
    this.vim.normal();
    this.revealList = true;
    this.revealMsg = true;
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: typing, ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  inConv() { return Boolean(this.conv()) && (!this.wide() || this.zone === "conv"); }

  press(e, cx) {
    const k = keyOf(e).name;
    if (!this.typing && this.inConv()) {
      if (k === "i") { this.reply.focus(); return true; }
      if (k === "r" && this.pub?.v === 2) { this.startRename(); return true; }
    }
    return this.act(this.vim.handle(e), cx);
  }

  act(a, cx) {
    if (!a || a === "type" || a === "backspace" || a === "submit") return false;
    if (a === "pending" || a === "count") return true;
    if (a === "normal") {
      // esc in a field: the search empties, a rename is dropped, a reply keeps its draft.
      if (this.typing === "search") { this.search.set_value(""); this.query = ""; this.saveQuery(); }
      if (this.typing === "rename") this.renaming = false;
      this.handle.focus();
      return true;
    }
    if (this.typing) {
      if (this.typing === "search" && (a === "down" || a === "up")) { this.moveList(a); return true; }
      return false;
    }
    const copy = (text) => {
      if (!text) return;
      cx.write_to_clipboard(text);
      notify({ title: tr("copied"), body: text, level: "success", timeout: 2000 });
    };
    if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "panel" } });
    else if (a === "panel-prev" || a === "panel-next") panelTab(a === "panel-next" ? 1 : -1, cx);
    else if (this.inConv()) {
      const items = this.lastItems, n = items.length;
      const at = this.mcur < 0 ? n - 1 : this.mcur;
      if (MOVES.includes(a)) {
        const j = step(a, at, n, this.vim.count, 6);
        if (j >= 0) this.mcur = j === n - 1 ? -1 : j;
        this.revealMsg = true;
      } else if (a === "left" || a === "escape") this.back();
      else if (a === "open" || a === "right") this.reply.focus();
      else if (a === "yank") copy(items[at]?.text);
      else if (a === "refresh") this.read(cx, true);
      else if (a === "filter") { this.back(); this.search.focus(); }
      else if (a === "tab-next" || a === "tab-prev") { if (this.wide()) this.zone = "list"; }
      else return false;
    } else {
      const rows = this.lastRows.flat;
      const r = rows.find((x) => this.rowKey(x) === this.cur);
      if (MOVES.includes(a) || a === "next" || a === "prev") this.moveList(a === "next" ? "down" : a === "prev" ? "up" : a);
      else if (a === "open" || a === "right") {
        if (r?.fold) this.showIdle = a === "right" ? true : !this.showIdle;
        else if (r) this.openConv(r.p, cx);
      } else if (a === "left") {
        if (r?.fold || r?.group === "idle") { this.showIdle = false; this.cur = "fold"; this.revealList = true; }
      } else if (a === "filter") this.search.focus();
      else if (a === "tab-next" || a === "tab-prev") {
        const i = CONVS.findIndex(([k]) => k === this.filters().conv);
        this.setFilter("conv", CONVS[(i + (a === "tab-next" ? 1 : CONVS.length - 1)) % CONVS.length][0]);
      } else if (a === "yank") copy(r?.p?.name);
      else if (a === "refresh") this.read(cx, true);
      else if (a === "escape") run("pane.go", { direction: "left" });
      else return false;
    }
    return true;
  }

  moveList(a) {
    const rows = this.lastRows.flat;
    const i = rows.findIndex((x) => this.rowKey(x) === this.cur);
    const j = step(a, i, rows.length, this.vim.count, 8);
    if (j < 0) return;
    this.cur = this.rowKey(rows[j]);
    this.moved = true;
    this.revealList = true;
  }

  // ---------- drawing ----------

  tag(t, color, text) {
    return h_flex().flex_none().h(18).px(7).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
      .font_family(MONO).text_size(10).text_color(color).child(String(text));
  }

  // Text with its matched letters in accent (kt-picker's hl): runs, the last one truncating.
  hl(t, text, marks) {
    const s = text ?? "";
    if (!marks?.size) return div().min_w(0).truncate().child(s);
    const runs = [];
    for (let k = 0; k < s.length; k++) {
      const on = marks.has(k);
      if (runs.length && runs[runs.length - 1].on === on) runs[runs.length - 1].s += s[k];
      else runs.push({ on, s: s[k] });
    }
    return h_flex().min_w(0).overflow_hidden().children(runs.map((r, i) => {
      const d = div().child(r.s.replace(/ /g, " "));
      return (i === runs.length - 1 ? d.min_w(0).truncate() : d.flex_none()).when(r.on, (el) => el.text_color(t.accent));
    }));
  }

  // A project's mark (its logo, else its initial on its color) with the session's state as a dot.
  markOf(t, e, label, size, dot, p = null) {
    const logo = logoOf(e);
    const base = logo ? image(logo).size(size).rounded(Math.round(size / 4))
      : h_flex().size(size).rounded(Math.round(size / 4)).bg(this.tint(t, e, p)).items_center().justify_center()
        .text_size(Math.round(size * 0.48)).font_semibold().text_color(t.chrome).child([...(label || "?")][0].toUpperCase());
    return div().relative().flex_none().size(size).child(base)
      .when(Boolean(dot), (el) => el.child(div().absolute().right(-2).bottom(-2).size(9).rounded_full().border(2).border_color(t.background).bg(dot)));
  }

  dotOf(t, p) {
    const s = STATUS[p.status];
    return s ? paint(t, s[1]) : p.live === true ? t.done : p.live === false ? t.dim : null;
  }

  iconBtn(t, id, icon, tip, fn) {
    return div().id(id).size(28).flex_none().rounded_full().flex().items_center().justify_center().text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(alpha(t.foreground, "14")).text_color(t.foreground)).tooltip(tip)
      .on_click((_e, cx) => { cx.stop_propagation(); fn(cx); cx.notify(); })
      .child(svg(icon).size(14));
  }

  // `ready`: read for the source shown now (readyFor); else its mark and name as bars (skeleton.js), never
  // the previous source's; the selector stays.
  sessionLine(t, ready = true) {
    const s = ready && this.pubOk() ? this.pub.session : null;
    const S = skeleton(t, this.m);
    return h_flex().gap(8).items_center()
      .when(!ready, (el) => el.child(S.pulse(h_flex().id("xt-head-sk").flex_1().min_w(0).gap(8).items_center()
        .child(S.circle(18)).child(S.line(0.4, { h: 8, lh: 18 })))))
      .when(ready, (el) => el
        .child(s ? this.markOf(t, this.sessionEntry(), s.name ?? "", 18, null) : svg("mods/kt-panel-head/messages-square.svg").size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().text_size(12.5).font_medium().text_color(s ? t.foreground : t.muted)
          .child(s?.name ?? (this.src ? `Terminal ${this.src}` : "Crosstalk"))))
      .when(ready && Boolean(this.src), (el) => el.child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(this.src)))
      .when(Boolean(s), (el) => el.child(this.tag(t, t.dim, `v${this.pub.v}`)))
      .when(Boolean(this.fixdir), (el) => el.child(this.tag(t, t.blocked, "fixtures"))) // i18n: tech
      .child(h_flex().id("xt-pick").flex_none().h(22).px(8).gap(4).items_center().rounded_full().border(1)
        .border_color(this.picking ? alpha(t.accent, "66") : t.border).bg(this.picking ? alpha(t.accent, "1a") : t.background)
        .font_family(MONO).text_size(10).text_color(this.pick ? t.accent : t.muted).cursor_pointer().hover((s2) => s2.bg(t.hover))
        .tooltip(tr("publishers"))
        .on_click((_e, cx) => { this.picking = !this.picking; if (this.picking) this.loadTitles(cx); cx.notify(); })
        .child(this.pick ? tr("pinned") : tr("followsFocus"))
        .child(svg(I(this.picking ? "chevron-down" : "chevron-right")).size(11)))
      .when(this.keyed, (el) => el.child(modePill(t, this.vim)));
  }

  loadTitles(cx) {
    cx.spawn(async (cx) => {
      for (const term of this.terms) this.titles[term] = parse(await readText(`${this.dir()}/${term}.crosstalk.json`))?.session?.name ?? term;
      cx.notify();
    });
  }

  picker(t) {
    const follow = this.follow();
    const item = (id, label, sub, on, term) => h_flex().id(id).h(30).px(10).gap(8).items_center().rounded(10).cursor_pointer()
      .when(on, (el) => el.bg(alpha(t.accent, "1a"))).hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { this.setSource(term, cx); cx.notify(); })
      .child(div().size(6).flex_none().rounded_full().bg(on ? t.accent : alpha(t.accent, "00")))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).child(label))
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(sub));
    return v_flex().p(4).gap(2).rounded(14).border(1).border_color(t.border).bg(t.surface)
      .child(item("xt-pick-follow", tr("followActive"), follow ?? "—", !this.pick, null))
      .children(this.terms.map((term, i) => item(`xt-pick-${i}`, this.titles[term] ?? term, term, this.pick === term, term)))
      .when(!this.terms.length, (el) => el.child(div().px(10).py(6).text_size(12).text_color(t.dim).child(tr("noPublisher"))));
  }

  searchField(t, R) {
    const typing = this.typing === "search";
    return h_flex().id("xt-search").flex_none().h(34).px(12).gap(8).items_center().rounded(12).border(1)
      .border_color(typing ? t.accent : t.input).bg(t.background).cursor_text()
      .on_click(() => this.search.focus())
      .child(svg(I("search")).size(14).flex_none().text_color(typing ? t.accent : t.dim))
      .child(Input.new(this.search).flex_1().h_full().text_size(13).text_color(t.foreground))
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(rollText(this.m, "xt-shown", tr("shownOf", { shown: R.shown, total: R.total }), 14)));
  }

  // kbrdn.dev `.segmented`: the conversation filter (tab / shift-tab). Its ink is one layer under the
  // segments, measured, gliding to the one picked (motion.js ink).
  segmented(t, f, R, m) {
    const i = Math.max(0, CONVS.findIndex(([k]) => k === f.conv));
    const ws = CONVS.map(([k]) => this.segW[k] ?? 0);
    const left = 3 + ws.slice(0, i).reduce((s, w) => s + w + 2, 0);
    return h_flex().relative().flex_none().p(3).gap(2).items_center().rounded_full().border(1).border_color(t.border).bg(t.background)
      .when(ws[i] > 0, (el) => el.child(ink(m, div().id("xt-seg-ink").absolute().top(3).left(left).w(ws[i]).h(22).rounded_full()
        .border(1).border_color(alpha(t.accent, "66")).bg(alpha(t.accent, "24")))))
      .children(CONVS.map(([k, label]) => {
        const on = f.conv === k;
        return h_flex().id(`xt-conv-${k}`).h(22).px(10).gap(6).items_center().rounded_full()
          .font_family(MONO).text_size(10.5).text_color(on ? t.accent : t.muted).cursor_pointer()
          .hover((s) => s.text_color(on ? t.accent : t.foreground))
          .on_click((_e, cx) => { this.setFilter("conv", k); cx.notify(); })
          .on_size_change((size, cx) => { if (Math.abs((this.segW[k] ?? 0) - size.width) > 0.5) { this.segW[k] = size.width; cx.notify(); } })
          .child(tr(label).toUpperCase())
          .child(roll(m, `xt-conv-n-${k}`, String(R.counts[k]), 14).text_color(on ? t.accent : t.dim));
      }));
  }

  // `gone`: closing (rows() gave it -1), drawn as it was but no longer a target: no click, no ring.
  row(t, r, gone = false) {
    const { p, unread, e, m } = r;
    const k = p.key;
    const pc = this.tint(t, e, p);
    const ring = !gone && this.keyed && this.zone === "list" && this.cur === k && (!this.typing || this.typing === "search");
    const isOpen = this.wide() && this.open?.key === k;
    const title = this.titleOf(p);
    const hit = m.hit ? snippet(plain(m.hit.text), m.hit.term) : null;
    const preview = hit ? this.hl(t, hit.s, hit.marks)
      : div().min_w(0).truncate().child(p.last ? (p.last.dir === "out" ? tr("youSaid", { text: plain(p.last.text) }) : plain(p.last.text)) : tr("noMessage"));
    const st = STATUS[p.status];
    const meta = [st && div().flex_none().text_color(paint(t, st[1])).child(tr(st[0])),
      (e?.name ?? p.project) && ((e?.name ?? p.project) !== title || m.marks[1]?.size) && this.hl(t, e?.name ?? p.project, m.marks[1]).flex_shrink(1),
      p.topic && this.hl(t, p.topic, m.marks[2]).flex_shrink(1),
      p.live === false && div().flex_none().child(tr("unlisted"))].filter(Boolean);
    const kind = p.kind && p.kind !== "interactive" ? KIND[p.kind] : null;
    return h_flex().id(`xt-row-${k}`).flex_none().px(8).py(8).gap(10).items_start().rounded(12).border(1)
      .border_color(ring ? alpha(t.accent, "99") : alpha(t.accent, "00"))
      .when(ring, (el) => el.bg(alpha(t.accent, "24")))
      .when(!ring && isOpen, (el) => el.bg(alpha(t.accent, "14")))
      .when(!gone && !ring && !isOpen, (el) => el.hover((s) => s.bg(t.hover)))
      .when(!gone, (el) => el.cursor_pointer().on_click((_e, cx) => { this.openConv(p, cx); cx.notify(); }))
      .child(div().w(3).h(40).flex_none().rounded_full().bg(alpha(pc, unread ? "ff" : "8c")))
      .child(this.markOf(t, e, title, 28, this.dotOf(t, p), p))
      .child(v_flex().flex_1().min_w(0).gap(3)
        .child(h_flex().gap(6).items_center()
          .child(this.hl(t, title, m.marks[0]).flex_1().text_size(13).font_weight(unread ? 600 : 500).text_color(t.foreground))
          .when(Boolean(kind), (el) => el.child(this.tag(t, paint(t, kind[1]) ?? t.dim, kindWord(kind))))
          .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(unread ? t.accent : t.dim).child(when(p.lastMessageAt))))
        .child(h_flex().gap(6).items_center()
          .child(preview.flex_1().text_size(12).text_color(unread ? t.foreground : t.muted))
          .when(unread > 0, (el) => el.child(h_flex().flex_none().h(16).min_w(16).px(4).items_center().justify_center().rounded_full().bg(t.accent)
            .font_family(MONO).text_size(10).font_weight(600).text_color(t.accent_foreground).child(String(unread)))))
        .when(meta.length > 0, (el) => el.child(h_flex().gap(5).items_center().overflow_hidden().font_family(MONO).text_size(10.5).text_color(t.dim)
          .children(meta.flatMap((x, i) => (i ? [div().flex_none().child("·"), x] : [x]))))));
  }

  list(t, R, cx) {
    const children = [];
    const slots = {};
    const eyebrow = (label, n) => h_flex().flex_none().h(26).px(8).pt(6).gap(8).items_center().font_family(MONO).text_size(10.5).text_color(t.muted)
      .child(label).child(div().text_color(t.dim).child(String(n))).child(div().flex_1().h(1).bg(t.border));
    // The sessions of a group open and close on their height, in order (motion.js rows(), keyed by
    // conversation): nothing else in the list moves. A group gone whole (eyebrow too) goes at once.
    // A slot counts the rows as rows() builds them, the closing ones included (the list's children).
    const put = (id, rs) => {
      let at = children.length;
      children.push(...motionRows(this.m, cx, id, rs, (r) => r.p.key, (r, i) => {
        if (i >= 0) slots[r.p.key] = at;
        at++;
        return this.row(t, r, i < 0);
      }));
    };
    if (R.groups.todo.length) { children.push(eyebrow(tr("todo"), R.groups.todo.length)); put("xt-rows-todo", R.groups.todo); }
    if (R.groups.active.length) { children.push(eyebrow(tr("active"), R.groups.active.length)); put("xt-rows-active", R.groups.active); }
    if (R.groups.idle.length) {
      const ring = this.keyed && this.zone === "list" && this.cur === "fold";
      slots.fold = children.length;
      children.push(h_flex().id("xt-fold").flex_none().h(30).mt(4).px(10).gap(8).items_center().rounded(12).border(1)
        .border_color(ring ? alpha(t.accent, "99") : alpha(t.accent, "00")).when(ring, (el) => el.bg(alpha(t.accent, "24")))
        .cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.showIdle = !this.showIdle; cx.notify(); })
        .child(svg(I(R.openIdle ? "chevron-down" : "chevron-right")).size(13).flex_none().text_color(t.dim))
        .child(div().font_family(MONO).text_size(10.5).text_color(t.muted).child(tr("inactive")))
        .child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(String(R.groups.idle.length)))
        .child(div().flex_1().h(1).bg(t.border)));
      put("xt-rows-idle", R.openIdle ? R.groups.idle : []);
    }
    if (!children.length) {
      children.push(div().p(12).text_size(12.5).text_color(t.dim)
        .child(this.query.trim() ? tr("noMatch", { q: this.query.trim() }) : R.total ? tr("noConv") : tr("noPeer")));
    }
    if (this.revealList) {
      if (slots[this.cur] != null) this.listScroll.scroll_to_item(slots[this.cur]);
      this.revealList = false;
    }
    return v_flex().id("xt-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.listScroll).p(4).gap(2).children(children);
  }

  emptyState(t) {
    const others = this.terms.filter((x) => x !== this.src);
    const [title, body] = !this.src ? [tr("empty.noTerm.title"), tr("empty.noTerm.text")]
      : this.pub?.error ? [tr("empty.unreadable.title", { src: this.src }), this.pub.error === "version" ? tr("version", { v: this.pub.version }) : tr("unreadable")]
        : [tr("empty.none.title"), tr("empty.none.text")];
    return v_flex().flex_1().min_h(0).p(16).gap(10).items_center().justify_center()
      .child(svg("mods/kt-panel-head/messages-square.svg").size(22).text_color(t.dim))
      .child(div().text_size(13).font_medium().text_color(t.foreground).child(title))
      .child(div().max_w(320).text_size(12).text_color(t.muted).child(body))
      .when(others.length > 0, (el) => el.child(h_flex().id("xt-empty-pick").h(26).px(10).gap(6).items_center().rounded_full().border(1).border_color(t.border)
        .font_family(MONO).text_size(10.5).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => { this.picking = true; this.loadTitles(cx); cx.notify(); })
        .child(tr("choose", { n: others.length }))));
  }

  // `ready`: read for the source shown now (readyFor). Before that, the previous source's conversations
  // are neither shown nor walked by the keys.
  inboxCard(t, now, cx, ready = true) {
    const ok = ready && this.pubOk();
    const R = this.rowsOf(now);
    this.lastRows = ok ? R : { flat: [] };
    if (!this.moved || !R.flat.some((r) => this.rowKey(r) === this.cur)) this.cur = this.rowKey(R.flat.find((r) => !r.fold) ?? R.flat[0]);
    const f = this.filters(), opts = this.options();
    const count = (pred) => this.peers().filter(pred).length;
    // One filters.js row: « Tous », the states, a rule, the types. A pill picked again goes back to all.
    const items = [{ key: "all", label: tr("all"), group: "all" },
      ...opts.states.map(([k, label, tint]) => ({ key: `s:${k}`, label: tr(label), tint, group: "s", count: count((p) => (k === "live" ? p.live === true : p.status === k)) })),
      ...opts.kinds.map(([k, label, tint]) => ({ key: `k:${k}`, label: tr(label), tint, group: "k", count: count((p) => p.kind === k) }))];
    const on = [R.state !== "all" && `s:${R.state}`, R.kind !== "all" && `k:${R.kind}`].filter(Boolean);
    const pick = (key) => {
      if (key === "all") return setShared(FILTERS, { ...this.filters(), state: "all", kind: "all" });
      const [g, v] = key.split(":");
      const k = g === "s" ? "state" : "kind";
      this.setFilter(k, (g === "s" ? R.state : R.kind) === v ? "all" : v);
    };
    const head = v_flex().flex_none().px(12).pt(10).pb(8).gap(8)
      .child(this.sessionLine(t, ready))
      .when(this.picking, (el) => el.child(this.picker(t)))
      .when(ok, (el) => el
        .child(this.searchField(t, R))
        .child(h_flex().child(this.segmented(t, f, R, this.m)))
        .when(items.length > 1, (el) => el.child(filterRow({ id: "xt-filters", state: this.frow, t, bg: t.background, items,
          active: on.length ? on : "all", onPick: pick, reduced: Boolean(shared("kt.reducedMotion")) }))));
    const hint = this.typing === "search" ? tr("hint.search") : tr("hint.list");
    return v_flex().rounded(16).border(1).border_color(t.border).bg(t.background).overflow_hidden()
      .child(head)
      .child(div().mx(12).flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
      // Until a read answers for this source (the first one, or another terminal's): conversation rows
      // as bars (skeleton.js), breathing, rather than « none » or the previous source's. Later reads
      // (every 10 s) keep what is shown.
      .child(ok ? this.list(t, R, cx) : !ready
        ? ((S) => S.pulse(v_flex().id("xt-list-sk").flex_1().min_h(0).p(4).child(S.list(5, { h: 52, icon: 0, lines: [0.4, 0.75], gap_y: 2 }))))(skeleton(t, this.m))
        : this.emptyState(t))
      .when(this.keyed && ok, (el) => el.child(div().flex_none().px(14).py(7).border_t(1).border_dashed().border_color(t.border)
        .font_family(MONO).text_size(10).text_color(t.dim).child(hint)));
  }

  stateLabel(t, m, i, red) {
    const st = m.state?.state;
    if (!st) return null;
    const line = (icon, color, text) => h_flex().id(`xt-st-${i}`).gap(4).items_center().font_family(MONO).text_size(10).text_color(color)
      .child(svg(I(icon)).size(11).flex_none()).child(text);
    if (st === "pending") return line("clock", t.dim, tr("sending"));
    if (st === "sent") return line("check", t.dim, tr("sent")).tooltip(tr("held"));
    if (st === "refused") return line("circle-alert", red, tr("refused", { why: m.state.reason || tr("noReason") }));
    return line("circle-alert", red, tr("notWritten", { why: m.state.gone ? tr("notInOutbox") : m.state.reason }));
  }

  bubble(t, c, m, i, pc, dark, maxW, ring) {
    const mine = m.dir === "out";
    const st = m.state?.state;
    const red = t.ansi1 ?? t.blocked;
    const bad = st === "refused" || st === "failed";
    const box = div().id(`xt-msg-${i}`).relative().max_w(maxW).py(8).pr(12).pl(mine ? 12 : 15).rounded(12).border(1).overflow_hidden()
      .text_size(12.5).line_height("18px").text_color(t.foreground)
      .bg(mine ? alpha(bad ? red : t.accent, bad ? "12" : "1f") : alpha(pc, dark ? "14" : "0f"))
      .border_color(ring ? alpha(t.accent, "99") : mine ? alpha(bad ? red : t.accent, "4d") : alpha(pc, dark ? "40" : "4d"))
      // The peer's stripe: a pill inside the bubble (as the inbox row's), clear of its corners and border; 7 px to the text.
      .when(!mine, (el) => el.child(div().absolute().top(8).bottom(8).left(5).w(3).rounded_full().bg(pc)))
      .child(TextView.markdown(`xt-md-${m.id ?? `${m.dir}-${m.at}`}-${i}`, m.text).selectable(true));
    // A message that came after the conversation opened fades in and rises 6 px (the scroll area
    // clips it); so does its state each time it changes (envoi… -> envoyé). History doesn't.
    const k = msgKey(m);
    const fresh = this.fresh.has(k);
    let label = this.stateLabel(t, m, i, red);
    if (label && fresh) label = enter(this.m, div().flex_none().child(label), `xt-st-${k}-${st}`, { dy: 0 });
    const el = label ? v_flex().items_end().gap(3).child(box).child(label) : box;
    return fresh ? enter(this.m, div().flex_none().child(el), `xt-in-${k}`) : el;
  }

  convCard(t, c, wide) {
    const pub = this.pub, e = this.entry(c), pc = this.tint(t, e, c), dark = Boolean(settings().dark);
    const title = this.titleOf(c);
    const items = this.items(c);
    if (!this.known) this.known = new Set(items.map(msgKey));
    for (const x of items) { const k = msgKey(x); if (!this.known.has(k)) { this.known.add(k); this.fresh.add(k); } }
    if (items.length !== this.lastItems.length && this.mcur < 0) this.revealMsg = true;
    this.lastItems = items;
    const n = items.length;
    const mcur = this.mcur < 0 ? n - 1 : Math.min(this.mcur, n - 1);
    const keyedHere = this.keyed && !this.typing && (!wide || this.zone === "conv");
    const maxW = Math.round(Math.max(220, Math.min(520, ((wide ? this.width - this.inboxW() : this.width) - 40) * 0.86)));
    const children = [];
    const msgAt = [];
    let idx = 0;
    for (const day of runsOf(items, dayOf)) {
      if (day.day) {
        children.push(h_flex().flex_none().py(8).gap(10).items_center()
          .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border))
          .child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(day.day.toUpperCase()))
          .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border)));
      }
      for (const run of day.runs) {
        const mine = run.dir === "out";
        const first = run.items[0];
        const bubbles = run.items.map((m) => { const i = idx++; msgAt[i] = children.length; return this.bubble(t, c, m, i, pc, dark, maxW, keyedHere && mcur === i); });
        children.push(v_flex().flex_none().w_full().gap(4).py(4).when(mine, (el) => el.items_end()).when(!mine, (el) => el.items_start())
          .child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(`${mine ? tr("you") : title}${first.at ? ` · ${clock(first.at)}` : ""}`))
          .children(bubbles));
      }
    }
    if (!n) children.push(div().p(12).text_size(12.5).text_color(t.dim).child(tr("noMessageYet")));
    if (this.revealMsg) {
      this.msgScroll.scroll_to_item(msgAt[mcur] ?? Math.max(0, children.length - 1));
      this.revealMsg = false;
    }
    const st = STATUS[c.status], kind = c.kind && c.kind !== "interactive" ? KIND[c.kind] : null;
    const sub = [c.name !== title && c.name, st && tr(st[0]), kind && kindWord(kind), c.live === false && tr("unlisted")].filter(Boolean).join(" · ") || c.name;
    // The header: the project's dither (brand/dither-band.svg through dither.js, tinted: svg() takes a
    // tint, image() doesn't). Its levels (.34, .67, 1) already thin it out, hence a tint stronger than a
    // flat "2e". It never crosses the card's border (DESIGN-REFERENCE.md): GPUI clips to rectangles, so
    // ditherBand shows the band through 2 px rows as wide as the arc allows (15: the card's 16 less its border).
    const band = ditherBand(this.headW, 60, 15, alpha(pc, dark ? "6b" : "4d"), TOP);
    const head = div().id("xt-head").relative().flex_none().h(60).overflow_hidden().rounded_t(15)
      .on_size_change((size, cx) => { if (Math.abs(size.width - this.headW) > 0.5) { this.headW = size.width; cx.notify(); } })
      .when(Boolean(band), (el) => el.child(band))
      .child(h_flex().size_full().px(10).gap(10).items_center()
        .when(!wide, (el) => el.child(this.iconBtn(t, "xt-back", I("chevron-left"), tr("back"), () => this.back())))
        .child(this.markOf(t, e, title, 32, this.dotOf(t, c), c))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(title))
          .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(sub)))
        .when(pub.v === 2, (el) => el.child(this.iconBtn(t, "xt-rename", I("square-pen"), tr("rename"), () => this.startRename())))
        .child(this.iconBtn(t, "xt-more", OWN("ellipsis"), tr("more"), () => { this.menu = !this.menu; })));
    const mi = (id, icon, label, fn) => h_flex().id(id).h(30).px(10).gap(8).items_center().rounded(10).text_size(12.5).cursor_pointer()
      .hover((s) => s.bg(t.hover)).on_click((_e, cx) => { this.menu = false; fn(cx); cx.notify(); })
      .child(svg(I(icon)).size(13).flex_none().text_color(t.muted)).child(label);
    const menu = v_flex().id("xt-menu").absolute().top(56).right(10).w(210).p(4).gap(2).rounded(14).border(1).border_color(t.border).bg(t.popover).shadow_lg()
      .on_mouse_down_out((_e, cx) => { this.menu = false; cx.notify(); })
      .when(pub.v === 2, (el) => el.child(mi("xt-mi-rename", "square-pen", tr("renameItem"), () => this.startRename())))
      .child(mi("xt-mi-copy", "file-text", tr("copyName"), (cx) => { cx.write_to_clipboard(c.name); notify({ title: tr("copied"), body: c.name, level: "success", timeout: 2000 }); }))
      .child(mi("xt-mi-read", "check", tr("markRead"), (cx) => { if (c.lastIn) this.commit(cx, { read: { [addr(pub, c)]: c.lastIn } }); }));
    const typing = this.typing;
    const draft = Boolean(this.draft.trim());
    const field = this.renaming
      ? h_flex().id("xt-rename-field").h(36).px(12).gap(8).items_center().rounded(12).border(1).border_color(typing === "rename" ? t.accent : t.input).bg(t.background)
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.accent).child(tr("titleLabel")))
        .child(Input.new(this.rename).flex_1().h_full().text_size(13).text_color(t.foreground))
      : h_flex().id("xt-reply").h(36).pl(12).pr(4).gap(8).items_center().rounded(12).border(1)
        .border_color(typing === "reply" ? t.accent : t.input).bg(t.background).cursor_text()
        .on_click(() => this.reply.focus())
        .child(Input.new(this.reply).flex_1().h_full().text_size(13).text_color(t.foreground))
        .child(div().id("xt-send").size(28).flex_none().rounded_full().flex().items_center().justify_center()
          .bg(draft ? t.accent : t.raised).text_color(draft ? t.accent_foreground : t.dim).tooltip(tr("send"))
          .when(draft, (el) => el.cursor_pointer().on_click((_e, cx) => { cx.stop_propagation(); this.send(cx); }))
          .child(svg(OWN("send")).size(14)));
    const hint = this.renaming ? tr("hint.rename")
      : typing === "reply" ? tr("hint.reply")
        : pub.v === 2 ? tr("hint.convV2") : tr("hint.conv");
    return v_flex().relative().rounded(16).border(1).border_color(t.border).bg(t.background)
      .child(head)
      .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(pc, "4d")))
      .child(v_flex().id("xt-msgs").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.msgScroll).px(12).py(6).children(children))
      .child(v_flex().flex_none().px(10).pt(8).pb(8).gap(6).border_t(1).border_dashed().border_color(t.border)
        .child(field)
        .child(h_flex().gap(8).items_center().font_family(MONO).text_size(10).text_color(t.dim)
          .when(this.keyed, (el) => el.child(modePill(t, this.vim)))
          .child(div().flex_1().min_w(0).truncate().child(hint))))
      .when(this.menu, (el) => el.child(menu));
  }

  render(cx) {
    const vis = visible();
    if (vis && !checking() && (!this.shown || this.source() !== this.src)) this.read(cx);
    this.shown = vis;
    const t = theme();
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    // Another copy of this mod wrote the outbox (a page copy, say): read it again.
    if (vis && !checking()) refreshOn(this, cx, "crosstalk", ["crosstalk"], async (cx) => this.read(cx, true));
    this.reg = registry();
    this.keyed = this.isKeyed();
    const wide = this.wide();
    // Read for the source shown now (readyFor): else the previous source's open conversation goes too.
    const ready = readyFor(this.readFor, this.source());
    const c = ready ? this.conv() : null;
    if (!c) this.zone = "list";
    const root = v_flex().id("kt-crosstalk").size_full().gap(4).text_color(t.foreground)
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => {
        const w = size.width / (Number(settings().zoom) || 1);
        if (Math.abs(w - this.width) > 1) { this.width = w; cx.notify(); }
      });
    const now = Date.now();
    // The conversation fades in as it opens (no rise: the panel doesn't clip it).
    const conv = (w) => enter(this.m, this.convCard(t, c, w), `xt-conv-${this.openSeq}`, { dy: 0 });
    if (!wide) return root.child((c ? conv(false) : this.inboxCard(t, now, cx, ready)).flex_1().min_h(0));
    return root.child(h_flex().flex_1().min_h(0).gap(4).items_stretch()
      .child(this.inboxCard(t, now, cx, ready).w(this.inboxW()).flex_none().h_full())
      .child(c ? conv(true).flex_1().min_w(0).h_full()
        : v_flex().flex_1().h_full().rounded(16).border(1).border_color(t.border).bg(t.background).items_center().justify_center().gap(8)
          .child(svg("mods/kt-panel-head/messages-square.svg").size(22).text_color(t.dim))
          // Not read yet for this source: no « rien » before the answer.
          .when(ready, (el) => el.child(div().text_size(12.5).text_color(t.muted).child(this.pubOk() ? tr("pickConv") : tr("nothing"))))));
  }
}
