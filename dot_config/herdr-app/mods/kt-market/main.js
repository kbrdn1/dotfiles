// kbrdn Marketplaces (issue #70): plugins, MCP servers, skills, herdr mods and layouts, loops, found in
// several stores at once, read-only in this lot: the "market" child of kbrdn-threads' main "view" stack
// (kt-threads' navigation, Agents group, after Automatisation), or a dialog (openOverlay).
// The data comes from market.mjs (bun, through exec, never from render):
// - `query`: the catalogs' index (Anthropic's two, the known marketplaces, herdr.dev, aitmpl's loops),
//   plus the MCP registry and skills.sh asked live when there are words (a cache per query);
// - `sync`: when the page shows (each source past its TTL), and r (forced);
// - `detail`: the inspection, on i or its button only, never on a cursor move: a download at the pin,
//   the scans, the plan, the licence.
// Everything shown comes from third parties: market.mjs cleans it, a README's images become links
// (drawing it fetches nothing), a link opens on a click only (https).
// The page: the band (count, freshness, Rafraîchir, ?), the filter and the sort, the type and source
// rows; the list (60 a page); the detail beside it: what the index knows, then once inspected the exact
// source and commit, the licence, what an install would run or write, the risks, the parts, the README.
// Installer (issue #70): an inspected plugin opens kt-plugins' dialog on it (lot 3), an MCP server
// kt-mcp's form filled with public values only (lot 4), a skill kt-skills' « Depuis GitHub » with the
// inspected commit (lot 5); an aitmpl loop: « Copier le /loop », or « Adapter en me:loop » through
// kt-automation's « Créer un loop » (lot 7, loops.js). kt-market itself runs nothing.
// Keys (vim.js): the page opens typing in the filter (INSERT: ctrl-n/p ↓ ↑ move, enter opens the
// detail, esc NORMAL). NORMAL: j/k gg/G ctrl-d/u (j past the last row: the next page; k before the
// first: the previous page, then the filter), / the filter, tab / shift-tab the type, enter/o/l the
// detail, i inspect (I again, forced), a Installer (inspects first when it isn't), s the sort, O the
// repo in the browser, y copy (the plan's first
// line once inspected, else the id), p Aperçu / Brut, r refresh, ? kt-keys, esc: the filter, then the
// detail, then as q (back to the thread; a dialog closes).
// Mod commands (tests): kt-market.focus, key:<keys>, query:<text>, type:<key>, source:<key>,
// sort:<key>, select:<id> (its detail), inspect, refresh, close (a dialog).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { exec, theme, layout, props, home, appHome, notify, nextCommand, closeOverlay, shared, checking, openOverlay, run, spaces, panes } from "herdr";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { filterRow, filterState } from "./filters.js";
import { dither, iconBtn, bandRow } from "./band.js";
import { motionState, frame, enter, pulse, rows as rowsOf } from "./motion.js";
import { skeleton, still } from "./skeleton.js";
import { split } from "./tiers.js";
import { rollText } from "./roll.js";
import { refreshOn } from "./bus.js";
import { docOf, mdState, view, tabs, target } from "./markdown.js";
import { makeT, relative, compact } from "./i18n.js";
import { TYPES, SOURCES, levelOf, code, mcpForm, skillForm } from "./model.js";
import { loopForm, loopPrompt } from "./loops.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const I = (n) => `mods/kt-threads/${n}.svg`;
const OWN = (n) => `mods/kt-market/${n}.svg`;
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const PAGE = 60;
const FRESH = 10e3;
const TINT = "ansi3"; // the page's (DESIGN-REFERENCE.md: one hue per page)
const SORTS = ["relevance", "popular", "recent"];
const LIVE = new Set(["mcp-registry", "skills-sh"]);
const GLYPH = { plugin: I("puzzle"), mcp: I("plug"), skill: I("sparkles"), "herdr-mod": OWN("blocks"), "herdr-layout": I("layout-list"), loop: OWN("repeat"), automation: I("workflow") };
const TYPE_TINT = { plugin: "ansi5", mcp: "accent", skill: "ansi4", "herdr-mod": "ansi2", "herdr-layout": "ansi6", loop: "ansi3", automation: "done" };
const SOURCE_TINT = { official: "ansi5", community: "ansi4", known: "ansi6", "mcp-registry": "accent", "skills-sh": "ansi2", "herdr-dev": "done", aitmpl: "ansi3" };
const LEVELS = ["blocking", "danger", "warn", "info"];
const PARTS = ["skills", "commands", "agents", "hooks", "mods", "mcp", "lsp"];
const levelColor = (t, l) => ({ blocking: t.ansi1, danger: t.ansi1, warn: t.blocked, info: t.dim })[l] ?? t.dim;

// ---------- words for the script's codes ----------

const srcLabel = (x) => (x.source === "known" && x.market ? x.market : tr(`src.${x.source}`));
function errText(c) {
  const s = String(c ?? "");
  const http = s.match(/^http-(\d+)$/);
  return http ? tr("err.http", { n: http[1] }) : tr(`err.${s}`) || tr("err.other", { code: s });
}
// "readme:http-404" -> « README : HTTP 404 ».
function partErr(e) {
  const [part, ...rest] = String(e).split(":");
  return rest.length ? tr("errPart", { part: tr(`errOf.${part}`) || part, why: errText(rest.join(":")) }) : errText(part);
}
function flagText(f) {
  const c = code(f), arg = String(f).slice(c.length + 1);
  if (c === "secrets") return tr("flag.secrets", { n: Number(arg) || 1 });
  if (c === "hooks") return arg ? tr("flag.hooks", { list: arg.split(",").join(", ") }) : tr("flag.hooksCatalog");
  return tr(`flag.${c}`, { arg }) || c;
}
function popText(p) {
  if (!p) return null;
  return tr(`pop.${p.unit}`, { n: compact(p.n) }) || compact(p.n);
}
function pinText(x) {
  if (x.pinKind === "sha" && x.pin) return `@${x.pin}`;
  if (x.pinKind === "version" && x.pin) return `@${x.pin}`;
  return tr(`pin.${x.pinKind}`) || null;
}
// A third party's README: its images become links (drawing it fetches nothing), its <img> and
// <picture> out.
const noImages = (s) => String(s ?? "")
  .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_m, alt, url) => `[${alt || "image"}](${url})`) // i18n: tech
  .replace(/<picture\b[\s\S]*?<\/picture>/gi, "").replace(/<img\b[^>]*>/gi, "");

// ---------- the script ----------

const codeOf = (e) => (/time|délai/i.test(String(e?.message ?? e)) ? "timeout" : e?.code ?? "script");
/** `bun <script> <args>` (market.mjs, else installed.mjs): its one JSON line, else rejects with a code. */
async function bun(args, timeout, script = "market.mjs") {
  const r = await exec(`${home()}/.nix-profile/bin/bun`, [`${appHome()}/mods/kt-market/${script}`, ...args], { timeout });
  const last = String(r.stdout ?? "").trim().split("\n").pop() ?? "";
  try { return JSON.parse(last); } catch { throw Object.assign(new Error("bad-output"), { code: r.code === 0 ? "bad-output" : "script" }); }
}

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
  return (v?.active ?? v?.children?.[0]?.id) === "market";
}
const activeSpace = () => spaces().find((s) => s.active);

export default class Market extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: true });
    this.query = "";
    this.type = "all";
    this.source = "all";
    this.sort = "relevance";
    this.offset = 0;
    this.res = null; // the last `query` answer
    this.err = null; // its failure's code
    this.busy = false;
    this.again = false; // a query asked while one runs: once more after it
    this.gen = 0; // the typed filter's debounce
    this.syncing = false;
    this.syncErr = null;
    this.cur = null; // the keys' cursor (a row id); null: the first row
    this.landing = null; // "last": after a previous page, the cursor on its last row
    this.openRow = null; // the detail's row
    this.insp = new Map(); // id -> detail | { pending } | { error }, 30 kept
    this.inst = null; // installed.mjs: { [id]: { state: installed | update | present, local, available? } }
    this.instErr = null; // the parts it couldn't read (codes)
    this.instBusy = false;
    this.md = mdState();
    this.listScroll = ScrollHandle.new();
    this.detailScroll = ScrollHandle.new();
    this.typeRow = filterState();
    this.sourceRow = filterState();
    this.motion = motionState();
    this.headW = 0;
    this.width = 1100;
    this.readAt = 0;
    this.shown = false;
    if (checking()) return;
    // The keyboard left without a render (a click on a terminal): the cursor goes out.
    cx.timer.every(1000, (cx) => { const f = this.handle.is_focused(); if (this.keyed !== f) { this.keyed = f; cx.notify(); } });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        const arg = (p) => (c.startsWith(p) ? c.slice(p.length) : null);
        if (c === "focus") this.focusIn();
        else if (arg("key:") != null) { this.focusIn(); for (const k of keysOf(arg("key:"))) this.press(k, cx); }
        else if (arg("query:") != null) { this.query = arg("query:"); this.refilter(cx, true); }
        else if (arg("type:") != null && (arg("type:") === "all" || TYPES.includes(arg("type:")))) { this.type = arg("type:"); this.refilter(cx); }
        else if (arg("source:") != null && (arg("source:") === "all" || SOURCES.includes(arg("source:")))) { this.source = arg("source:"); this.refilter(cx); }
        else if (arg("sort:") != null && SORTS.includes(arg("sort:"))) { this.sort = arg("sort:"); this.refilter(cx); }
        else if (arg("select:") != null) { const r = this.rows().find((x) => x.id === arg("select:")); if (r) { this.cur = r.id; this.show(r); } }
        else if (c === "inspect") this.inspect(cx, this.openRow);
        else if (c === "refresh") this.refresh(cx);
        else if (c === "close" && props()?.overlay) closeOverlay(props().overlay);
        cx.notify();
      }
    });
  }

  // ---------- data ----------

  rows() {
    return this.res?.rows ?? [];
  }

  // A filter changed: back to the first page; typed words wait 250 ms for the next key.
  refilter(cx, typed = false) {
    this.offset = 0;
    this.cur = null;
    this.reveal = true;
    if (!typed) return this.load(cx);
    const g = ++this.gen;
    cx.timer.after(250, (cx) => { if (g === this.gen) this.load(cx); });
  }

  // One query at a time; one asked meanwhile runs once after it, with the filters then.
  load(cx) {
    if (checking()) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    const req = { q: this.query.trim(), types: this.type === "all" ? [] : [this.type], sources: this.source === "all" ? [] : [this.source],
      sort: this.sort, offset: this.offset, limit: PAGE };
    cx.spawn(async (cx) => {
      try {
        const r = await bun(["query", JSON.stringify(req)], 60e3);
        if (r.error) this.err = r.error;
        else {
          this.res = r;
          this.err = null;
          if (this.landing === "last" && r.rows.length) this.cur = r.rows[r.rows.length - 1].id;
          this.landing = null;
        }
      } catch (e) { this.err = codeOf(e); }
      this.busy = false;
      this.readAt = Date.now();
      if (this.again) { this.again = false; this.load(cx); }
      cx.notify();
    });
  }

  // The catalogs again (each past its TTL, or all with `force`), then the list.
  sync(cx, force = false) {
    if (this.syncing || checking()) return;
    this.syncing = true;
    this.syncErr = null;
    cx.spawn(async (cx) => {
      try {
        const r = await bun(["sync", ...(force ? ["--force"] : [])], 180e3);
        if (r.error) this.syncErr = r.error;
      } catch (e) { this.syncErr = codeOf(e); }
      this.syncing = false;
      this.load(cx);
      this.loadInstalled(cx); // the catalogs moved: their versions against this Mac's
      cx.notify();
    });
  }

  refresh(cx) {
    this.sync(cx, true);
  }

  // What this Mac has (installed.mjs, issue #70 lot 8): read when the page shows, after a sync, on r,
  // and when Plugins, Skills or MCP change something (the bus, render). No network.
  async readInstalled() {
    if (checking()) return;
    try {
      const j = await bun([], 90e3, "installed.mjs");
      this.inst = j.states ?? {};
      this.instErr = j.errors?.length ? j.errors : null;
    } catch (e) { this.instErr = [codeOf(e)]; }
  }

  loadInstalled(cx) {
    if (this.instBusy || checking()) return;
    this.instBusy = true;
    cx.spawn(async (cx) => {
      await this.readInstalled();
      this.instBusy = false;
      cx.notify();
    });
  }

  // The inspection of a row (market.mjs detail): on i or its button only. `force`: again, past the cache.
  inspect(cx, row, force = false) {
    if (!row || checking()) return;
    const was = this.insp.get(row.id);
    if (was?.pending || (was && !was.error && !force)) return;
    this.show(row);
    this.insp.set(row.id, { pending: true });
    cx.spawn(async (cx) => {
      let d;
      try { d = await bun(["detail", row.id, ...(force ? ["--force"] : [])], 300e3); } catch (e) { d = { error: codeOf(e) }; }
      this.insp.delete(row.id);
      this.insp.set(row.id, d);
      while (this.insp.size > 30) this.insp.delete(this.insp.keys().next().value);
      cx.notify();
    });
  }

  page(d, cx) {
    this.offset = Math.max(0, this.offset + d * PAGE);
    this.cur = null;
    this.landing = d < 0 ? "last" : null;
    this.reveal = true;
    this.load(cx);
  }

  show(row) {
    if (this.openRow?.id === row.id) return;
    this.openRow = row;
    this.detailScroll.scroll_to_item(0);
  }

  // The repo's page on GitHub (the row's `repo` is owner/name, checked by model.js).
  browse(x) {
    if (x?.repo && /^[\w.-]+\/[\w.-]+$/.test(x.repo)) exec("open", [`https://github.com/${x.repo}`]).catch(() => {});
  }

  // Installer, on an inspected plugin: kt-plugins' own dialog (browse, the cursor on it), which shows
  // what it brings and the exact command, and confirms it (kt-confirm). Anthropic's community catalog
  // not known yet: kt-plugins' "marketplace" view first, filled in, with its own confirmation, then
  // browse on the plugin. kt-market runs no command itself.
  // An MCP server (lot 4): kt-mcp's own form (stdio or HTTP), filled with the public values only (the
  // name, the command or the URL, the env and header NAMES); every value of a secret is typed by the
  // person there, masked, and kt-mcp confirms the exact command. `i`: the variant (0: the suggested one).
  install(x, d, i = 0) {
    if (checking() || !d?.plan?.route) return;
    if (x.type === "plugin" && d.plan.route === "kt-plugins" && x.market) {
      const select = `${x.name}@${x.market}`;
      const p = d.plan.addMarket ? { view: "marketplace", source: d.plan.addMarket, select } : { view: "browse", market: x.market, select };
      openOverlay({ mod: "kt-plugins", kind: "dialog", frame: "none", width: 1, height: 1, props: p });
    } else if (x.type === "mcp" && d.plan.route === "kt-mcp") {
      const f = mcpForm(x.name, d.variants?.[i]);
      if (!f) return;
      // kt-mcp's context: user scope only here (local and project belong to a project's folder).
      openOverlay({ mod: "kt-mcp", kind: "dialog", width: 1, height: 1, frame: "none", modal: true,
        props: { add: f.add, prefill: f.prefill, space: activeSpace()?.id ?? null, cwd: home(), project: false } });
    } else if (x.type === "skill" && d.plan.route === "kt-skills") {
      // A skill (lot 5): kt-skills' « Depuis GitHub », filled with its source and name; it clones aside,
      // shows the SKILL.md and the commit cloned, says when it moved since this inspection (expect).
      const f = skillForm(d.plan, d.head);
      if (!f) return;
      openOverlay({ mod: "kt-skills", kind: "dialog", width: 1, height: 1, frame: "none", modal: true,
        props: { add: f.add, prefill: f.prefill, expect: f.expect } });
    } else if (x.type === "loop" && d.plan.route === "loop-session") {
      // An aitmpl loop (lot 7): kt-automation's « Créer un loop », as its page opens it (its contract),
      // filled with loops.js' intention (no word of the recipe, the pinned source). Its confirmation
      // sends that intention to the Automatisation session; nothing is written here.
      const f = loopForm(this.loopItem(x, d), d, activeSpace()?.id ?? null);
      if (!f) return;
      openOverlay({ mod: "kt-automation", kind: "dialog", width: 1, height: 1, frame: "none", modal: true, props: f });
    }
  }

  // A loop row with its inspection's repo (owner, name, path): what loops.js validates and names.
  loopItem(x, d) {
    return { ...x, repo: d?.src ?? null };
  }

  // « Copier le /loop »: the recipe's command, as written (shown in full above it).
  copyLoop(d, cx) {
    const p = loopPrompt(d);
    if (!p) return;
    cx.write_to_clipboard(p);
    notify({ title: tr("loopCopied"), body: p.split("\n")[0], level: "success", timeout: 2500 });
  }

  // Whether Installer is offered for an inspected item: lots 3 to 5 (plugins, MCP, skills), not blocked,
  // not already on this Mac (lot 8: « present » herdr mods aside).
  installable(x, d) {
    const p = d?.plan;
    const mine = this.inst?.[x.id];
    if (!p || (mine && mine.state !== "present")) return false;
    return (x.type === "plugin" && p.route === "kt-plugins") || (x.type === "mcp" && p.route === "kt-mcp" && Boolean(mcpForm(x.name, d.variants?.[0])))
      || (x.type === "skill" && p.route === "kt-skills" && Boolean(skillForm(p, d.head)))
      || (x.type === "loop" && p.route === "loop-session" && Boolean(loopForm(this.loopItem(x, d), d, null)));
  }

  // a (NORMAL): Installer on the detail's item (else the cursor's); not inspected yet: inspect first,
  // nothing more (the plan is read before an install, never skipped).
  installKey(cx) {
    const x = this.openRow ?? this.at(this.rows());
    if (!x) return;
    const d = this.insp.get(x.id);
    if (!d || d.error) return this.inspect(cx, x);
    if (!d.pending && this.installable(x, d)) this.install(x, d);
  }

  // y: the plan's first line once inspected, else the id.
  copy(x, cx) {
    const d = this.insp.get(x.id);
    const text = d?.plan?.lines?.[0] ?? x.id;
    cx.write_to_clipboard(text);
    notify({ title: tr("copied"), body: text, level: "success", timeout: 2000 });
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  focusIn() {
    this.handle.focus();
    this.vim.normal();
    this.reveal = true;
  }

  at(list) {
    return list.find((x) => x.id === this.cur) ?? list[0] ?? null;
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // The page's own keys first (NORMAL: i I s a p), then vim's.
  press(k, cx) {
    const name = keyOf(k).name;
    if (!this.vim.insert) {
      const row = this.openRow ?? this.at(this.rows());
      if (name === "i" || name === "I") { this.inspect(cx, row, name === "I"); return true; }
      if (name === "s") { this.sort = SORTS[(SORTS.indexOf(this.sort) + 1) % SORTS.length]; this.refilter(cx); return true; }
      if (name === "a") { this.installKey(cx); return true; }
      if (name === "p" && this.docShown) { this.md.raw = !this.md.raw; return true; }
    }
    return this.keyAct(this.vim.handle(k), cx);
  }

  keyAct(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count" || a === "filter" || a === "normal") return true;
    const list = this.rows();
    const x = this.at(list);
    const i = list.indexOf(x);
    const more = Boolean(this.res) && this.offset + list.length < this.res.total;
    if (a === "type" || a === "backspace") {
      this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
      this.refilter(cx, true);
    } else if (a === "down" && i === list.length - 1 && more && !this.vim.insert) this.page(1, cx);
    else if (a === "up" && i <= 0 && this.offset > 0 && !this.vim.insert) this.page(-1, cx);
    else if (a === "up" && i <= 0 && !this.vim.insert) this.vim.edit(); // k on the first row: the filter
    else if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev"].includes(a)) {
      const j = step(a === "next" ? "down" : a === "prev" ? "up" : a, i, list.length, this.vim.count, 10);
      if (j >= 0) this.cur = list[j].id;
      this.reveal = true;
    } else if (a === "tab-next" || a === "tab-prev") {
      const all = ["all", ...TYPES];
      this.type = all[(all.indexOf(this.type) + (a === "tab-next" ? 1 : all.length - 1)) % all.length];
      this.refilter(cx);
    } else if (a === "open" || a === "right" || a === "submit") { if (x) { this.cur = x.id; this.show(x); } }
    else if (a === "open-alt") this.browse(x);
    else if (a === "yank") { if (x) this.copy(this.openRow ?? x, cx); }
    else if (a === "refresh") this.refresh(cx);
    else if (a === "escape" && this.query) { this.query = ""; this.refilter(cx); }
    else if (a === "escape" && this.openRow) this.openRow = null;
    else if (a === "escape" || a === "quit") {
      if (props()?.overlay) closeOverlay(props().overlay);
      else run("layout.select", { stack: "view", child: "thread" });
    } else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else return false;
    return true;
  }

  // ---------- pieces ----------

  eyebrow(t, text, color) {
    return div().font_family(MONO).text_size(11).text_color(color ?? t.muted).child(String(text).toUpperCase());
  }

  dashed(t) {
    return div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
  }

  // A mono block on t.raised, one line per row.
  block(t, text, color) {
    return v_flex().flex_none().rounded(12).border(1).border_color(t.border).bg(t.raised).px(12).py(10)
      .font_family(MONO).text_size(11.5).line_height("18px").text_color(color ?? t.foreground)
      .children(String(text).split("\n").map((l) => div().child(l || " ")));
  }

  // A type's tile: its glyph in its tint.
  tile(t, type, size) {
    const c = t[TYPE_TINT[type]] ?? t.muted;
    return div().size(size).flex_none().rounded(size > 28 ? 10 : 8).border(1).border_color(alpha(c, "4d")).bg(alpha(c, "1f"))
      .flex().items_center().justify_center().child(svg(GLYPH[type] ?? I("layers")).size(Math.round(size * 0.48)).text_color(c));
  }

  levelPill(t, l) {
    const c = levelColor(t, l);
    return h_flex().flex_none().h(18).px(7).gap(5).items_center().rounded_full().border(1).border_color(alpha(c, "4d")).bg(alpha(c, "1a"))
      .text_color(c).font_family(MONO).text_size(10).child(div().size(6).rounded_full().bg(c)).child(tr(`level.${l}`).toUpperCase());
  }

  chip(t, id, label, on, onClick, tip) {
    return h_flex().id(id).flex_none().h(28).px(11).items_center().rounded_full().border(1)
      .border_color(on ? alpha(t.accent, "66") : t.border).when(on, (el) => el.bg(alpha(t.accent, "24")))
      .when(!on && Boolean(onClick), (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .text_size(12).text_color(on ? t.foreground : t.muted)
      .when(Boolean(onClick), (el) => el.cursor_pointer().on_click((_e, cx) => { onClick(cx); cx.notify(); }))
      .when(Boolean(tip), (el) => el.tooltip(tip))
      .child(label);
  }

  mode(t, typing) {
    return div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(this.vim.label);
  }

  // ---------- header ----------

  // When the catalogs were read: syncing, its failure, else the oldest local source's age.
  freshness() {
    if (this.syncing) return tr("syncing");
    if (this.syncErr) return tr("syncFailed", { why: errText(this.syncErr) });
    const ages = Object.entries(this.res?.sources ?? {}).filter(([k, v]) => !LIVE.has(k) && v?.at).map(([, v]) => Date.parse(v.at));
    return ages.length ? tr("fresh", { ago: relative(Math.min(...ages)) }) : tr("neverSynced");
  }

  header(t) {
    const typing = this.keyed && this.vim.insert;
    const r = this.res;
    const words = Boolean(this.query.trim());
    const filtered = words || this.type !== "all" || this.source !== "all";
    const reduced = Boolean(shared("kt.reducedMotion"));
    const S = skeleton(t, this.m);
    const count = !r ? S.pulse(S.line(80, { h: 7, lh: 14 }).id("ktmk-count-sk"))
      : rollText(this.m, `ktmk-head-n-${filtered ? "f" : "a"}`, tr(filtered ? "shown" : "items", { n: r.total }), 14);
    const types = filterRow({ id: "ktmk-types", t, state: this.typeRow, active: this.type, reduced,
      items: [{ key: "all", label: tr("all") }, ...TYPES.map((k) => ({ key: k, label: tr(`type.${k}`), tint: TYPE_TINT[k], count: r?.counts?.byType?.[k] }))],
      onPick: (k, cx) => { this.type = k; this.refilter(cx); } });
    const sources = filterRow({ id: "ktmk-sources", t, state: this.sourceRow, active: this.source, reduced,
      items: [{ key: "all", label: tr("all") }, ...SOURCES.map((k) => ({ key: k, label: tr(`src.${k}`), tint: SOURCE_TINT[k],
        count: LIVE.has(k) && !words ? undefined : r?.counts?.bySource?.[k] }))],
      onPick: (k, cx) => { this.source = k; this.refilter(cx); } });
    // The catalogs' failures (the live sources' are said in the list, with their words).
    const failed = Object.entries(r?.sources ?? {}).filter(([k, v]) => !LIVE.has(k) && v?.error);
    const field = h_flex().id("ktmk-filter").w(300).max_w_full().h(32).px(12).gap(8).items_center().rounded_full().border(1)
      .border_color(typing ? alpha(t.accent, "99") : t.border).when(typing, (el) => el.bg(alpha(t.accent, "24"))).cursor_text()
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
      .on_mouse_down("left", (_e, cx) => { this.vim.edit(); this.handle.focus(); cx.notify(); })
      .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
      .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
        .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : tr("filter")))
      .when(this.busy, (el) => el.child(svg(I("refresh-cw")).size(12).flex_none().text_color(t.dim).spin(900)))
      .when(Boolean(this.query), (el) => el.child(div().id("ktmk-clear").flex_none().text_color(t.dim).cursor_pointer()
        .hover((s) => s.text_color(t.foreground))
        .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.handle.focus(); })
        .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; this.refilter(cx); cx.notify(); })
        .child(svg(I("x")).size(13))));
    const sorts = h_flex().flex_none().gap(4).items_center()
      .children(SORTS.map((k) => this.chip(t, `ktmk-sort-${k}`, tr(`sort.${k}`), this.sort === k, (cx) => { this.sort = k; this.refilter(cx); }, tr("sortTip"))));
    return v_flex().id("ktmk-head").relative().flex_none().px(4).pb(12).gap(10).rounded(16).border(1).border_color(t.border).bg(t.background)
      .on_size_change((s, cx) => { if (s.width !== this.headW) { this.headW = s.width; cx.notify(); } })
      .children([dither(this.headW, 60, 16, t[TINT])].filter(Boolean))
      .child(bandRow(t, { m: this.m, color: t[TINT], icon: OWN("store"), title: "Marketplaces", sub: [count, this.freshness()], // i18n: tech
        buttons: [
          pulse(this.m, iconBtn(t, "ktmk-b-refresh", I("refresh-cw"), this.syncing ? tr("syncingTip") : tr("refreshTip"), (cx) => this.refresh(cx), this.syncing), this.syncing),
          iconBtn(t, "ktmk-b-keys", I("keyboard"), tr("keysTip"), () => openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } }))] }))
      .child(div().flex_none().mx(-4).h(0).border_t(1).border_dashed().border_color(alpha(t[TINT], "4d")))
      .child(h_flex().px(10).flex_wrap().gap(8).items_center()
        .child(field).child(sorts)
        .when(Boolean(this.keyed), (el) => el.child(this.mode(t, typing))))
      .child(div().px(10).child(types))
      .child(div().px(10).child(sources))
      .when(failed.length > 0 || Boolean(this.err) || Boolean(this.instErr), (el) => el.child(v_flex().px(12).gap(2)
        .when(Boolean(this.err), (e2) => e2.child(div().text_size(11.5).text_color(t.ansi1).child(tr("queryFailed", { why: errText(this.err) }))))
        // installed.mjs couldn't read a part: its badges are missing there, not « not installed ».
        .when(Boolean(this.instErr), (e2) => e2.child(div().text_size(11.5).text_color(t.dim)
          .child(tr("instFailed", { list: this.instErr.map((c) => tr(`instPart.${c}`) || errText(c)).join(", ") }))))
        .children(failed.map(([k, v]) => div().text_size(11.5).text_color(t.dim)
          .child(tr(v.at ? "sourceFailed" : "sourceFailedNever", { source: tr(`src.${k}`), why: errText(v.error), ago: v.at ? relative(v.at, { bare: true }) : "" }))))));
  }

  // ---------- list ----------

  // What the list says above its rows (Loops, Automatisations) or instead of them (empty).
  notes(t, r, list) {
    const out = [];
    const words = Boolean(this.query.trim());
    const say = (key, vars, color) => out.push(div().px(12).py(8).text_size(12.5).line_height("18px").text_color(color ?? t.muted).child(tr(key, vars)));
    if (this.type === "loop") say("note.loop");
    if (this.type === "automation") say("note.automation");
    if (!list.length) {
      if (LIVE.has(this.source) && !words) say("empty.needsQuery", { source: tr(`src.${this.source}`) });
      else if ((this.type === "mcp" || this.type === "skill") && !words) say(`empty.${this.type}`);
      else if (this.syncing && !r.total && !words) say("empty.firstSync");
      else if (words || this.type !== "all" || this.source !== "all") say("empty.noMatch", {}, t.dim);
      else say("empty.none", {}, t.dim);
    }
    for (const k of ["mcp-registry", "skills-sh"]) {
      const s = r.sources?.[k];
      if (s?.state === "error" || s?.state === "stale") say(s.state === "error" ? "live.error" : "live.stale",
        { source: tr(`src.${k}`), why: errText(s.error), ago: s.at ? relative(s.at, { bare: true }) : "" }, t.dim);
    }
    return out;
  }

  // One row: the type's tile, the name and version, the risk, the popularity; the description, the
  // source and the age. `cursor`: "ring" (NORMAL), "mark" (INSERT) or null; `gone`: closing (motion.js).
  row(t, x, cursor, gone) {
    const on = this.openRow?.id === x.id;
    const d = this.insp.get(x.id);
    const seen = d && !d.pending && !d.error;
    const lvl = seen ? d.level : x.level;
    return h_flex().id(`ktmk-row-${x.id}`).flex_none().h(54).pl(8).pr(10).gap(10).items_center().rounded(12).border(1)
      .border_color(cursor === "ring" ? alpha(t.accent, "99") : on ? alpha(t.accent, "66") : alpha(t.border, "00"))
      .bg(on || cursor === "ring" ? alpha(t.accent, "24") : cursor === "mark" ? t.hover : t.background)
      .when(!gone && !cursor && !on, (el) => el.hover((s) => s.bg(t.hover)))
      .when(!gone, (el) => el.cursor_pointer().on_click((_e, cx) => { this.cur = x.id; this.show(x); cx.notify(); }))
      .child(this.tile(t, x.type, 30))
      .child(v_flex().flex_1().min_w(0).gap(3)
        .child(h_flex().min_w(0).gap(8).items_center()
          .child(div().min_w(0).truncate().font_family(MONO).text_size(13).font_medium().text_color(t.foreground).child(x.name))
          .when(Boolean(x.version), (el) => el.child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(x.version)))
          .when(Boolean(this.inst?.[x.id]), (el) => el.child(this.stateTag(t, this.inst[x.id].state)))
          .when(lvl !== "info", (el) => el.child(this.levelPill(t, lvl)))
          .when(Boolean(seen), (el) => el.child(svg(OWN("eye")).size(12).flex_none().text_color(t.dim)))
          .child(div().flex_1())
          .when(Boolean(x.popularity), (el) => el.child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(popText(x.popularity)))))
        .child(h_flex().min_w(0).gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(x.description ? t.muted : t.dim).child(x.description || tr("noDescription")))
          .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim)
            .child([srcLabel(x), x.updatedAt ? relative(x.updatedAt) : null].filter(Boolean).join(" · ")))));
  }

  list(t, list, cx) {
    const card = v_flex().flex_1().min_w(0).h_full().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
    const S = skeleton(t, this.m);
    const r = this.res;
    // Before the first answer: rows in the rows' shape (54 px, a tile, two lines), breathing.
    if (!r) return card.child(S.swap("ktmk-list", false, null, () => div().p(4).child(S.list(8, { h: 54, icon: 30, lines: [0.4, 0.75], gap_y: 2 }))));
    const mm = S.arriving("ktmk-list") ? still(this.m) : this.m;
    const typing = this.keyed && this.vim.insert;
    const cur = this.keyed ? this.at(list)?.id : null;
    const kids = this.notes(t, r, list);
    let at = kids.length;
    kids.push(...rowsOf(mm, cx, `ktmk-rows-${this.offset}`, list, (x) => x.id, (x, i) => {
      if (i >= 0 && this.reveal && x.id === cur) {
        this.listScroll.scroll_to_item(at);
        this.reveal = false;
      }
      at++;
      return this.row(t, x, i >= 0 && x.id === cur ? (typing ? "mark" : "ring") : null, i < 0);
    }));
    const from = list.length ? this.offset + 1 : 0;
    const to = this.offset + list.length;
    const more = this.offset + list.length < r.total;
    return card
      .child(S.swap("ktmk-list", true, v_flex().id("ktmk-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.listScroll).p(4).gap(2).children(kids), null, { grow: true }))
      .child(this.dashed(t))
      .child(h_flex().flex_none().px(12).py(8).gap(8).items_center()
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(tr("range", { from, to, n: r.total })))
        .when(this.offset > 0, (el) => el.child(this.chip(t, "ktmk-prev", tr("prev"), false, (cx) => this.page(-1, cx))))
        .when(more, (el) => el.child(this.chip(t, "ktmk-next", tr("next"), false, (cx) => this.page(1, cx)))));
  }

  // ---------- detail ----------

  pair(t, label, value, color) {
    return h_flex().gap(10).items_start()
      .child(this.eyebrow(t, label, t.dim).w(104).flex_none().pt(1))
      .child(div().flex_1().min_w(0).font_family(MONO).text_size(12).text_color(color ?? (value ? t.foreground : t.dim)).child(value || tr("unknown")));
  }

  // Risks, the gravest first: a dot in the level's color, the sentence.
  risks(t, flags) {
    const sorted = [...flags].sort((a, b) => LEVELS.indexOf(levelOf([a])) - LEVELS.indexOf(levelOf([b])));
    return v_flex().gap(6)
      .child(this.eyebrow(t, tr("risks")))
      .when(!sorted.length, (el) => el.child(div().text_size(12.5).text_color(t.dim).child(tr("noRisk"))))
      .children(sorted.map((f) => h_flex().gap(8).items_start()
        .child(div().size(7).mt(6).flex_none().rounded_full().bg(levelColor(t, levelOf([f]))))
        .child(div().flex_1().min_w(0).text_size(12.5).line_height("19px").text_color(t.foreground).child(flagText(f)))));
  }

  // What the inspection found, by type.
  specifics(t, x, d) {
    const out = [];
    if (x.type === "plugin" && d.components) {
      const parts = PARTS.filter((k) => d.components[k]?.length);
      out.push(v_flex().gap(8).child(this.eyebrow(t, tr("parts")))
        .when(!parts.length, (el) => el.child(div().text_size(12.5).text_color(t.dim).child(tr("noParts"))))
        .children(parts.map((k) => v_flex().gap(4)
          .child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(`${tr(`part.${k}`)} · ${d.components[k].length}`))
          .child(h_flex().flex_wrap().gap(6).children(d.components[k].slice(0, 30).map((n) => div().px(8).py(2).rounded_full().border(1).border_color(t.border)
            .font_family(MONO).text_size(11).text_color(t.muted).child(n)))))));
      if (d.servers?.length) out.push(v_flex().gap(6).child(this.eyebrow(t, tr("servers")))
        .child(this.block(t, d.servers.map((s) => s.url ?? [s.command, ...s.args].filter(Boolean).join(" ")).join("\n"))));
      if (d.details) out.push(v_flex().gap(6).child(this.eyebrow(t, "claude plugin details")).child(this.block(t, d.details))); // i18n: tech
    }
    if (x.type === "mcp" && d.variants?.length) {
      out.push(v_flex().gap(8).child(this.eyebrow(t, tr("variants")))
        .children(d.variants.map((v, i) => v_flex().gap(4)
          .child(h_flex().gap(8).items_center()
            .child(div().flex_1().min_w(0).font_family(MONO).text_size(10.5).text_color(t.dim).child(i === 0 ? tr("variantFirst", { kind: v.kind }) : v.kind))
            // Another way than the suggested one: kt-mcp's form filled with it.
            .when(i > 0 && d.plan?.route === "kt-mcp" && Boolean(mcpForm(x.name, v)), (el) => el
              .child(this.chip(t, `ktmk-install-v${i}`, tr("installVariant"), false, () => this.install(x, d, i), tr("installTipMcp")))))
          .child(this.block(t, JSON.stringify(v.config, null, 2)))
          .children(v.flags.map((f) => div().text_size(11.5).text_color(levelColor(t, levelOf([f]))).child(flagText(f)))))));
    }
    if (x.type === "skill" && d.skillPath != null) out.push(this.pair(t, tr("skillPath"), d.skillPath || "/"));
    if ((x.type === "herdr-mod" || x.type === "herdr-layout") && (d.mods || d.layouts)) {
      if (d.mods?.length) out.push(this.pair(t, tr("herdrMods"), d.mods.join(", ")));
      if (d.layouts?.length) out.push(this.pair(t, tr("herdrLayouts"), d.layouts.join(", ")));
      if (d.findings?.length) out.push(v_flex().gap(6).child(this.eyebrow(t, tr("findings")))
        .child(this.block(t, d.findings.map((f) => `${f.code}  ${f.file}:${f.line}`).join("\n"))));
    }
    if (x.type === "loop" && d.loop) {
      out.push(v_flex().gap(6)
        .child(this.pair(t, tr("loop.interval"), d.loop.interval))
        .child(this.pair(t, tr("loop.stop"), d.loop.stop))
        .when(d.loop.components.length > 0, (el) => el.child(this.pair(t, tr("loop.components"), d.loop.components.join(", "))))
        .when(Boolean(d.loop.prompt), (el) => el.child(this.eyebrow(t, tr("loop.prompt"))).child(this.block(t, d.loop.prompt))));
    }
    return out;
  }

  // The inspection: an invitation, the skeleton while it runs, its failure, or what it found.
  inspection(t, x, d, cx) {
    const S = skeleton(t, this.m);
    if (!d) {
      return v_flex().gap(8).px(12).py(10).rounded(12).border(1).border_dashed().border_color(t.border)
        .child(div().text_size(12.5).line_height("19px").text_color(t.muted).child(tr("inspectHint")))
        .child(h_flex().child(this.chip(t, "ktmk-inspect", tr("inspect"), false, (cx) => this.inspect(cx, x))));
    }
    if (d.pending) {
      return v_flex().gap(8).child(this.eyebrow(t, tr("inspecting")))
        .child(S.pulse(v_flex().gap(6).children([0.9, 0.7, 0.95, 0.5].map((w) => S.line(w, { h: 8, lh: 18 }))).child(S.block(null, 64, { r: 12 }))));
    }
    if (d.error) {
      return v_flex().gap(8).px(12).py(10).rounded(12).border(1).border_color(alpha(t.ansi1, "4d"))
        .child(div().text_size(12.5).text_color(t.ansi1).child(tr("inspectFailed", { why: errText(d.error) })))
        .child(h_flex().child(this.chip(t, "ktmk-retry", tr("retry"), false, (cx) => this.inspect(cx, x, true))));
    }
    const p = d.plan;
    // Lots 3 to 5: plugins (kt-plugins), MCP servers (kt-mcp), skills (kt-skills); the others show their plan.
    // Already on this Mac (lot 8): no Installer; « Chez toi » says where it is managed.
    const mine = this.inst?.[x.id];
    const have = Boolean(mine) && mine.state !== "present";
    const installable = this.installable(x, d);
    const loop = x.type === "loop";
    const note = loop ? "loopNote" : x.type === "mcp" ? "installNoteMcp" : x.type === "skill" ? "installNoteSkill" : p?.addMarket ? "installCommunity" : "installNote";
    const tip = loop ? "loopAdaptTip" : x.type === "mcp" ? "installTipMcp" : x.type === "skill" ? "installTipSkill" : "installTip";
    const lic = d.repoFacts?.license && d.repoFacts.license !== "NOASSERTION" ? d.repoFacts.license : null;
    const doc = d.readme?.text ? docOf(this.md, noImages(d.readme.text)) : null;
    this.docShown = Boolean(doc);
    const files = d.files ?? [];
    return v_flex().gap(14)
      .child(v_flex().gap(6)
        .child(this.eyebrow(t, tr("inspected")))
        .child(this.pair(t, tr("fact.commit"), d.head ? d.head.slice(0, 12) : tr("pin.market")))
        .child(this.pair(t, tr("fact.license"), lic ?? tr("license.unknown"), lic ? null : t.blocked))
        .when(d.repoFacts?.stars != null, (el) => el.child(this.pair(t, tr("fact.stars"), String(compact(d.repoFacts.stars)))))
        .child(this.pair(t, tr("fact.inspected"), tr(d.cached ? "inspectedCached" : "inspectedNow", { ago: relative(d.at) }))))
      .child(v_flex().gap(6)
        .child(this.eyebrow(t, tr("plan.title")))
        .child(p?.route ? this.block(t, p.lines.length ? p.lines.join("\n") : tr("plan.noLines")) : this.block(t, tr(`why.${p?.why}`) || tr("why.no-route"), t.blocked))
        .when(Boolean(p?.writes?.length), (el) => el.child(div().text_size(11.5).text_color(t.dim).child(tr("plan.writes", { list: p.writes.join(", ") }))))
        // A loop (lot 7): « Copier le /loop » (the recipe's own command) beside « Adapter en me:loop ».
        .when(loop && Boolean(loopPrompt(d)), (el) => el.child(h_flex().pt(2).gap(10).items_center()
          .child(this.chip(t, "ktmk-loop-copy", tr("loopCopy"), false, (cx) => this.copyLoop(d, cx), tr("loopCopyTip")))))
        .when(installable, (el) => el.child(h_flex().pt(2).gap(10).items_center()
          .child(this.chip(t, "ktmk-install", tr(loop ? "loopAdapt" : "install"), true, () => this.install(x, d), tr(tip)))
          .child(div().flex_1().min_w(0).text_size(11.5).line_height("17px").text_color(t.dim).child(tr(note)))))
        .when(!installable, (el) => el.child(div().text_size(11.5).text_color(t.dim)
          .child(tr(have ? "mine.planHave" : loop && p?.route === "loop-session" ? "loopNoForm" : "plan.readOnly")))))
      .child(this.risks(t, d.flags ?? []))
      .children(this.specifics(t, x, d))
      .when(files.length > 0, (el) => el.child(v_flex().gap(6)
        .child(this.eyebrow(t, tr("files", { n: files.length })))
        .child(this.block(t, files.slice(0, 15).map((f) => `${f.path}${f.exec ? "  *" : ""}${f.link ? "  ->" : ""}`).join("\n")
          + (files.length > 15 ? `\n${tr("filesMore", { n: files.length - 15 })}` : "")))))
      .when(Boolean(d.errors?.length), (el) => el.child(v_flex().gap(4)
        .children(d.errors.map((e) => div().text_size(11.5).text_color(t.dim).child(partErr(e))))))
      .when(Boolean(doc), (el) => el.child(v_flex().gap(8)
        .child(h_flex().items_center().child(this.eyebrow(t, d.readme.name)).child(div().flex_1()).child(tabs(t, "ktmk-md-tabs", this.md)))
        .child(div().max_w(760).text_size(13.5).line_height("22px").text_color(t.foreground)
          .child(view(t, this.m, cx, this.md, { id: `ktmk-md-${x.id}`, mod: "kt-market", doc, onLink: (url) => {
            const to = target(url, null);
            if (to?.web && /^https:\/\//.test(to.web)) exec("open", [to.web]).catch(() => {});
          } })))));
  }

  // « Chez toi » (lot 8): what this Mac has of it, the update the catalog offers, where it is managed
  // (its page: kt-market installs nothing, and neither updates nor removes). A skill: the clone's commit
  // against the one inspected (its update needs the network: shown once inspected).
  mine(t, x, st, d) {
    const l = st.local ?? {};
    const page = { plugin: "plugins", mcp: "mcp", skill: "skills" }[x.type];
    const moved = x.type === "skill" && d?.head && l.head && d.head !== l.head;
    const say = st.state === "update" ? tr("mine.update", { local: l.version ?? tr("unknown"), available: st.available ?? tr("unknown") })
      : st.state === "present" ? tr("mine.present", { mods: (l.mods ?? []).join(", ") }) : tr("mine.installed");
    return v_flex().gap(6).px(12).py(10).rounded(12).border(1)
      .border_color(alpha(st.state === "update" ? t.ansi3 : st.state === "present" ? t.border : t.done, "66"))
      .child(h_flex().gap(8).items_center().child(this.eyebrow(t, tr("mine.title"))).child(this.stateTag(t, st.state)))
      .child(div().text_size(12.5).line_height("19px").text_color(t.foreground).child(say))
      .when(Boolean(l.version) || x.type === "mcp", (el) => el.child(this.pair(t, tr("mine.version"), l.version ?? tr("mine.noVersion"))))
      .when(Boolean(l.scope), (el) => el.child(this.pair(t, tr("mine.scope"), l.scope)))
      .when(Boolean(l.name) && x.type !== "plugin", (el) => el.child(this.pair(t, tr("mine.name"), l.name)))
      .when(x.type === "skill" && l.path != null, (el) => el.child(this.pair(t, tr("mine.path"), l.path || "/")))
      .when(Boolean(moved), (el) => el.child(div().text_size(12).line_height("18px").text_color(t.ansi3)
        .child(tr("mine.skillMoved", { local: String(l.head).slice(0, 12), remote: String(d.head).slice(0, 12) }))))
      .when(Boolean(page), (el) => el.child(h_flex().pt(2).gap(10).items_center()
        .child(this.chip(t, "ktmk-mine-open", tr(`mine.open.${x.type}`), false, () => run("layout.select", { stack: "view", child: page })))
        .child(div().flex_1().min_w(0).text_size(11.5).text_color(t.dim).child(tr("mine.where")))));
  }

  // installed / update / present, as a pill (FILTERS.md: done, ansi3, dim).
  stateTag(t, s) {
    const c = s === "update" ? t.ansi3 : s === "present" ? t.dim : t.done;
    return h_flex().flex_none().h(18).px(7).items_center().rounded_full().border(1).border_color(alpha(c, "4d")).bg(alpha(c, "1a"))
      .font_family(MONO).text_size(10).text_color(c).child(tr(`tag.${s}`).toUpperCase());
  }

  // `solo`: the narrow tier (tiers.js), the detail alone: its × is a way back to the list.
  detail(t, x, w, solo, cx) {
    const d = this.insp.get(x.id);
    const done = Boolean(d && !d.pending && !d.error);
    const lvl = done ? d.level : x.level;
    const tint = t[TYPE_TINT[x.type]] ?? t.accent;
    this.docShown = false;
    const facts = v_flex().gap(6)
      .child(this.pair(t, tr("fact.source"), [x.repo, pinText(x)].filter(Boolean).join(" ")))
      .child(this.pair(t, tr("fact.author"), x.author))
      .child(this.pair(t, tr("fact.popularity"), popText(x.popularity) ?? tr("pop.none")))
      .child(this.pair(t, tr("fact.updated"), x.updatedAt ? relative(x.updatedAt) : null))
      .child(this.pair(t, tr("fact.install"), x.route ? tr(`route.${x.route}`) : tr(`why.${x.why}`) || tr("why.no-route"), x.route ? null : t.blocked));
    const card = v_flex().w(w).flex_none().h_full().min_h(0).relative().px(4).pb(4).overflow_hidden().rounded(16).border(1).border_color(t.border).bg(t.background)
      .children([dither(w, 60, 16, tint)].filter(Boolean))
      .child(bandRow(t, { m: this.m, mark: this.tile(t, x.type, 32), dot: lvl !== "info" ? levelColor(t, lvl) : null, title: x.title || x.name,
        sub: [tr(`type1.${x.type}`), srcLabel(x), pinText(x)].filter(Boolean),
        buttons: [
          pulse(this.m, iconBtn(t, "ktmk-d-inspect", OWN("eye"), d?.pending ? tr("inspectingTip") : done ? tr("reinspectTip") : tr("inspectTip"),
            (cx) => this.inspect(cx, x, done), Boolean(d?.pending)), Boolean(d?.pending)),
          x.repo && iconBtn(t, "ktmk-d-repo", I("external-link"), tr("repoTip"), () => this.browse(x)),
          iconBtn(t, "ktmk-d-copy", OWN("copy"), done && d.plan?.lines?.[0] ? tr("copyPlanTip") : tr("copyIdTip"), (cx) => this.copy(x, cx)),
          iconBtn(t, "ktmk-close", I(solo ? "chevron-left" : "x"), tr(solo ? "back" : "close"), () => { this.openRow = null; })] }))
      .child(div().flex_none().mx(-4).h(0).border_t(1).border_dashed().border_color(alpha(tint, "4d")))
      .child(v_flex().id("ktmk-detail").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.detailScroll).px(10).pt(10).pb(16).gap(14)
        .child(div().text_size(13).line_height("19px").text_color(x.description ? t.foreground : t.dim).child(x.description || tr("noDescription")))
        .child(facts)
        .when(Boolean(this.inst?.[x.id]), (el) => el.child(this.mine(t, x, this.inst[x.id], done ? d : null)))
        .when(!done, (el) => el.child(this.risks(t, x.flags)))
        .child(this.dashed(t))
        .child(this.inspection(t, x, d, cx)));
    return enter(this.m, card, `ktmk-detail-${x.id}`);
  }

  render(cx) {
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    // The bus (DATA-SYNC.md): an install, an update or a removal in Plugins, Skills or MCP, shown or not.
    if (!checking()) refreshOn(this, cx, "installed", ["plugins", "skills", "mcp"], async () => { await this.readInstalled(); });
    const vis = visible();
    if (vis && !checking() && !this.shown) {
      // The thread's terminal is hidden under this page: take the keyboard (typing filters), after the
      // app has settled its own focus on the switch.
      cx.timer.after(150, (cx) => {
        if (visible() && !this.handle.is_focused()) {
          this.handle.focus();
          this.vim.edit();
        }
        cx.notify();
      });
      // Back on the page: the list again past 10 s (DATA-SYNC.md), and the catalogs past their TTL.
      if (Date.now() - this.readAt > FRESH) {
        this.load(cx);
        this.sync(cx); // then installed.mjs, once the catalogs are read
      }
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
    const list = this.rows();
    const x = this.openRow;
    // The width's tier (tiers.js, the root's width less a dialog's padding, the last tier for its
    // hysteresis). Side by side the widths are continuous: the body keeps its id and only a column that
    // appears fades in (the list here, the detail by its own enter).
    const s = (this.tiers = split(this.width - (props()?.overlay ? 8 : 0), { ratio: 0.46, prev: this.tiers?.tier }));
    return v_flex().id("ktmk-root").size_full().gap(4).text_color(t.foreground)
      .when(Boolean(props()?.overlay), (el) => el.p(4).rounded(20).border(1).border_color(t.border).bg(t.chrome))
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
      .child(this.header(t))
      .child(h_flex().id("ktmk-body").flex_1().min_h(0).gap(4)
        .when(!(s.solo && x), (el) => el.child(enter(this.m, this.list(t, list, cx), "ktmk-col-list", { dy: 0 })))
        .when(Boolean(x), (el) => el.child(this.detail(t, x, s.detail, s.solo, cx))));
  }
}
