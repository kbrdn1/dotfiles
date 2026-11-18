// kbrdn Plugins (Monocode's Settings › Plugins, kbrdn.dev look): the Claude Code plugins installed on
// this machine, as a page: the "plugins" child of kbrdn-threads' main "view" stack (kt-threads'
// Plugins, ctrl-b u). Opened as an overlay with props.view, the same mod draws "Ajouter" (add.js):
// its menu (a popup) and its forms (dialogs).
// Data (data.js): one row per `claude plugin list --json` entry (a plugin installed for the user
// and for two projects is three rows, as the CLI lists them), so the counters are the CLI's;
// grouped by marketplace (known_marketplaces.json: source, last update). Version: the folder's for
// a plugin read from its folder. "Mise à jour": the marketplace's catalog (its source's plugin.json
// in the marketplace's clone, else its entry) offers a greater semver; a version that can't be
// ordered (a git sha) is only "version différente", never counted. Components are counted in the
// folder that loads (its source folder when read from one, else its cache folder).
// Actions, all through the official CLI (`claude plugin enable | disable | update | uninstall`,
// `claude plugin marketplace update`), with an explicit --scope, in the project's folder for a project
// install, one at a time, each asked first through kt-confirm (which calls back
// `kt-plugins.confirmed`). Nothing here writes settings.json or installed_plugins.json itself.
// Data sync (DATA-SYNC.md, bus.js): every action bumps "plugins" (and "skills" / "mcp" when the
// plugin brings some); the page listens to "plugins", watches ~/.claude/plugins' two JSON files for
// changes made outside Herdr, and re-reads when shown again after 10 s; never on a timer.
// Look (DESIGN-REFERENCE.md): Crosstalk's 60 px band over the pixel dither (ansi5; a detail: its
// marketplace's tint), cut inside the card's border; filters.js's row; motion.js (ANIMATIONS.md):
// the page and a detail fade in, a marketplace's rows open and close on their height in order
// (rows(): a fold, an unfold, a filter), the bulk bar rises, the rows an action runs on breathe.
// Selection (select.js): ⌘-click toggles a row, ⇧-click a range, the box left of a row toggles it.
// While rows are selected, a bar floats at the list's foot: activate, deactivate, update them, one
// confirm listing them.
// Keys (vim.js; kt-keys lists them under Pages): the page opens typing in the filter (INSERT);
// ctrl-b h/l (pane.go, "focus") or `kt-plugins.key:<keys>` give it the keyboard in NORMAL.
// NORMAL: j/k, gg/G, ctrl-d/u, n/N move the cursor (k on the first row: the filter), / the filter,
// tab / shift-tab the state segments, enter/o/l open the detail, O the plugin on GitHub, y copies
// its id, r refresh, e activate / deactivate, u update (the selection when there is one), dd
// uninstall (danger), + the "Ajouter" menu, x / space / V / ctrl-a select, p the README's Aperçu /
// Brut, ? kt-keys, q back to the thread; esc ends the range, then empties the selection, then clears
// the filter, then as q.
// The README (markdown.js): Aperçu (its frontmatter as fields, its fenced code in Zed's colors, its
// alerts) or Brut (its source in Zed's colors); a link: the web in the browser, a file of the plugin
// in Zed.
// Tests: `kt-plugins.add:<view>` opens the menu ("menu") or a form (add.js).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { exec, theme, spaces, panes, run, layout, props, home, notify, checking, nextCommand, openOverlay, shared, watchFolder } from "herdr";
import { bump, refreshOn } from "./bus.js";
import { summary, why } from "./plugins.js";
import { installed, claude, read } from "./data.js";
import { parse as mdParse, mdState, view, tabs, target } from "./markdown.js";
import { Select, partition, lines } from "./select.js";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { Add } from "./add.js";
import { MONO, I, OWN, alpha, tilde, ago, card, eyebrow, dashed, empty, tag, mode, pill, icon, check, chip, codeBlock,
  band, bandRule, markTile, iconBtn, moreMenu, marketTint } from "./ui.js";
import { filterRow, filterState } from "./filters.js";
import { motionState, frame, enter, pulse, rows as rowsOf } from "./motion.js";
import { skeleton, still } from "./skeleton.js";
// kt-keys' roll.js (a byte-identical copy): the head's and the selection's counts roll to their new digits.
import { rollText } from "./roll.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MEASURE = 620; // the README's column: ~80 characters of 13.5 px Inter
const FRESH = 10e3; // the page shown again re-reads a list older than this (DATA-SYNC.md)
const SEGS = ["all", "on", "off", "updates"]; // strings.js' seg.<key>
// FILTERS.md's tints for Plugins (« Tous » neutral); marketplaces: ui.js marketTint().
const SEG_TINT = { on: "done", off: "dim", updates: "ansi3" };
const RELOAD = () => tr("reload");
const SYNCED = "synced"; // claude.ai's plugins: a scope and a "marketplace" of their own
const VERB = (kind) => tr(`verb.${kind}`);
// The components a detail lists, in order (strings.js' part.<key>); summary()'s words (comp.<key>).
const PARTS = ["skills", "commands", "agents", "hooks", "mcp", "mods", "lsp"];
const comps = (c) => summary(c, (k, n) => tr(`comp.${k}`, { n }));

function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
// Shown: kbrdn-threads' main "view" stack is on this page.
function visible() {
  const v = find(layout(), "view");
  return (v?.active ?? v?.children?.[0]?.id) === "plugins";
}
const activeSpace = () => spaces().find((s) => s.active);
const scopeLabel = (x) => (x.synced ? "claude.ai" : x.scope === "project" ? tr("scope.project", { name: x.projectPath?.split("/").pop() ?? "?" }) : x.scope);
// Where `claude plugin enable/disable` writes for this install.
const settingsOf = (x) => (x.scope === "user" ? "~/.claude/settings.json"
  : x.scope === "local" ? `${tilde(x.projectPath)}/.claude/settings.local.json`
  : tr("settingsShared", { path: tilde(x.projectPath) }));

export default class Plugins extends View {
  init(_props, cx) {
    // An overlay (props.view): the "Ajouter" menu or one of its forms, add.js's.
    if (props()?.view) {
      this.add = new Add(props().view, cx);
      return;
    }
    this.handle = cx.focus_handle();
    this.scroll = ScrollHandle.new();
    this.docScroll = ScrollHandle.new();
    this.query = "";
    this.seg = "all";
    this.market = null; // a marketplace chip, null: all
    this.items = [];
    this.markets = {};
    this.enabledAtUser = {}; // settings.json's enabledPlugins (what kt-skills lists)
    this.sel = null; // the open row's key
    this.doc = null; // { key, md, readme } its README parsed by markdown.js (md null while read)
    this.md = mdState(); // Aperçu / Brut (kept from one README to the next) and the colors asked
    this.multi = new Select();
    this.hot = null;
    this.error = null;
    this.busy = false;
    this.scanned = false;
    this.running = null; // the action running: its label
    this.pending = null; // what kt-confirm is asking about
    this.readAt = 0; // when the list was last read
    this.width = 1100;
    this.vim = new Vim({ field: true });
    this.cur = null;
    this.motion = motionState();
    this.filters = filterState(); // the state / marketplace filter row
    this.menu = false; // the band's "⋯" menu
    this.headW = 0; // the bands' measured widths (their dither waits for them)
    this.detailW = 0;
    this.showGen = 0; // bumped each time the page shows: its content fades in again
    this.folded = new Set(); // marketplaces folded in the list
    this.runningKeys = new Set(); // the rows an action is running on (they breathe)
    if (checking()) return;
    // The keyboard left without a render (a click on a terminal): the cursor goes out. A page hidden
    // in the stack doesn't render: its `shown` is reset here, so its entrance and the 10 s re-read
    // run again when it comes back (ANIMATIONS.md).
    cx.timer.every(1000, (cx) => {
      if (this.shown && !visible()) this.shown = false;
      if (this.keyed !== this.handle.is_focused()) cx.notify();
    });
    this.watch(cx);
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn();
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        } else if (c === "refresh") this.scan(cx);
        // `add:menu` the "Ajouter" popup, `add:browse | marketplace | folder | manual` one of its forms (tests).
        else if (c.startsWith("add:")) this.openAdd(c.slice(4));
        // Only the copy holding that token runs it (an "Ajouter" dialog may have asked).
        else if (c.startsWith("confirmed:") && this.pending && c.slice(10) === this.pending.token) {
          const p = this.pending;
          this.pending = null;
          this.act(p, cx);
        }
        cx.notify();
      }
    });
  }

  // ---------- data ----------

  scan(cx) {
    if (checking()) return;
    cx.spawn(async (cx) => { await this.load(); cx.notify(); });
  }

  // One read at a time: a second call while one runs waits for it (the bus reruns it once after, if
  // something moved meanwhile). A failed read keeps the rows shown and says so in the band.
  load() {
    if (checking()) return Promise.resolve();
    if (this.loading) return this.loading;
    this.busy = true;
    this.loading = (async () => {
      try {
        const got = await installed();
        const order = (x) => (x.market === SYNCED ? "￿" : x.market.toLowerCase());
        this.items = got.items.sort((a, b) => order(a).localeCompare(order(b)) || a.name.localeCompare(b.name)
          || (a.scope === "user" ? -1 : b.scope === "user" ? 1 : 0) || String(a.projectPath).localeCompare(String(b.projectPath)));
        this.markets = got.markets;
        this.enabledAtUser = got.enabled;
        this.multi.keep(this.items.map((x) => x.key));
        if (this.market && !this.items.some((x) => x.market === this.market)) this.market = null;
        this.error = null;
        this.readAt = Date.now();
      } catch (e) {
        this.error = String(e?.message ?? e);
      } finally {
        this.busy = false;
        this.scanned = true;
        this.loading = null;
      }
    })();
    return this.loading;
  }

  // Changes made outside Herdr (a terminal's claude plugin, another session): ~/.claude/plugins,
  // only its installed_plugins.json and known_marketplaces.json, and only when their text changed
  // (a read of `claude plugin list` must not wake it again). Bumps "plugins" (DATA-SYNC.md), so
  // kt-skills and kt-mcp follow too.
  watch(cx) {
    const dir = `${home()}/.claude/plugins`;
    const files = [`${dir}/installed_plugins.json`, `${dir}/known_marketplaces.json`];
    const snap = () => Promise.all(files.map((f) => read(f)));
    cx.spawn(async (cx) => {
      let last = (await snap()).join("\0");
      for (;;) {
        const paths = await watchFolder(dir).catch(() => null);
        if (paths === null) return; // no watch possible: the bus and the page's return still work
        if (!paths.some((p) => p === dir || files.includes(p))) continue;
        const now = (await snap()).join("\0");
        if (now === last) continue;
        last = now;
        bump("plugins", "skills", "mcp");
        cx.notify();
      }
    });
  }

  matches(x, seg = this.seg, market = this.market) {
    if (market && x.market !== market) return false;
    if (seg === "on") return x.enabled;
    if (seg === "off") return !x.enabled;
    if (seg === "updates") return x.update;
    return true;
  }

  queried() {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter((x) => [x.id, x.description, x.scope, x.projectPath ?? "", ...Object.values(x.comps).flat()].join(" ").toLowerCase().includes(q));
  }

  listed() {
    return this.queried().filter((x) => this.matches(x));
  }

  // What the cursor and the selection walk: the listed rows, less the folded marketplaces'.
  walk() {
    return this.listed().filter((x) => !this.folded.has(x.market));
  }

  order() {
    return this.walk().map((x) => x.key);
  }

  fold(market, open) {
    if (open) this.folded.delete(market);
    else this.folded.add(market);
  }

  select(x, cx) {
    if (this.sel === x.key && this.doc?.key === x.key) return;
    this.sel = x.key;
    this.doc = { key: x.key, md: null };
    cx.spawn(async (cx) => {
      let text = null;
      for (const f of ["README.md", "readme.md", "Readme.md"]) if ((text = await read(`${x.dir}/${f}`)) != null) break;
      if (this.doc?.key !== x.key) return;
      this.doc.md = text == null ? null : mdParse(text);
      this.doc.readme = text != null;
      this.docScroll.scroll_to_item(0);
      cx.notify();
    });
  }

  zed(path) {
    exec("zed", [path]).catch(() => exec("open", [`zed://file${path}`]).catch(() => {}));
  }

  copy(text, cx) {
    cx.write_to_clipboard(text);
    notify({ title: tr("copied"), body: text, level: "success", timeout: 2000 });
  }

  // ---------- actions ----------

  // Why `kind` can't run on x now, or null. The disabled actions' reasons.
  refusal(kind, x) {
    if (x.synced) return tr("refuse.synced");
    if (!["user", "project", "local"].includes(x.scope)) return tr("refuse.scope", { scope: x.scope });
    if (x.projectGone) return tr("refuse.gone", { path: tilde(x.projectPath) });
    if (kind === "enable" && x.enabled) return tr("refuse.alreadyOn");
    if (kind === "disable" && !x.enabled) return tr("refuse.alreadyOff");
    if (kind === "update" && x.folder) return tr("refuse.folder");
    return null;
  }

  job(kind, x) {
    return { name: x.id, key: x.key, args: ["plugin", kind, x.id, "--scope", x.scope, "--json"], cwd: x.projectPath ?? home(), timeout: kind === "update" ? 300e3 : 60e3 };
  }

  // kt-confirm calls back with this ask's token: a cancelled ask (no callback) never runs later,
  // when another copy's confirm answers.
  // kt-confirm, full window (its body scrolls past the window): `detail`'s first paragraph is the
  // command, its other paragraphs blocks ("• " lines a list; under "Refusés", "name : why" lines
  // refused); `more`: { consequence, warning } as kt-confirm draws them.
  ask(p, title, detail, label, danger = false, more = {}) {
    if (this.running) return notify({ title: tr("running"), body: this.running, level: "info", timeout: 3000 });
    const token = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
    this.pending = { ...p, token };
    openOverlay({ mod: "kt-confirm", kind: "dialog", frame: "none", width: 1, height: 1,
      props: { title, detail, label, danger, ...more, command: { name: `kt-plugins.confirmed:${token}` } } });
  }

  askOne(kind, x) {
    const no = this.refusal(kind, x);
    if (no) return notify({ title: tr("impossible", { verb: VERB(kind) }), body: tr("idWhy", { id: x.id, why: no }), level: "warning", timeout: 6000 });
    const where = x.projectPath ? tr("inProject", { path: tilde(x.projectPath) }) : "";
    const cmd = `claude plugin ${kind} ${x.id} --scope ${x.scope}${where}`;
    const writes = tr("writes", { path: settingsOf(x), reload: RELOAD() });
    const more = {
      enable: { consequence: writes },
      disable: { consequence: writes },
      update: {
        consequence: `${x.update ? `${x.version} → ${x.avail}.` : x.differs ? tr("update.differs", { from: x.version, to: x.avail }) : tr("update.none")} ${RELOAD()}`,
        warning: tr("update.warning"),
      },
      uninstall: { consequence: tr("uninstall.consequence", { scope: scopeLabel(x), settings: settingsOf(x),
        data: x.data ? tr("uninstall.data", { path: tilde(x.data) }) : "", folder: x.folder ? tr("uninstall.folder", { path: tilde(x.folder) }) : "" }) },
    }[kind];
    this.ask({ label: `${VERB(kind)} ${x.id}`, jobs: [this.job(kind, x)], done: tr(`done.${kind}`, { id: x.id }), kind },
      tr("askTitle", { verb: VERB(kind), name: x.name }), cmd, VERB(kind), kind === "uninstall", more);
  }

  askBulk(kind, picked) {
    const { ok, refused } = partition(picked, (x) => this.refusal(kind, x));
    if (!ok.length) return notify({ title: tr("nothingToDo", { verb: VERB(kind) }), body: refused.slice(0, 4).map((r) => tr("idLine", { id: r.item.id, why: r.why })).join("\n"), level: "warning", timeout: 6000 });
    const n = ok.length;
    // kt-confirm's refused block: its heading starts "Refus", a line "name : why" (fr) / "name: why" (en).
    const skipped = refused.length ? `\n\n${tr("refusedHeading")}\n${refused.map((r) => tr("idLine", { id: r.item.name, why: r.why.split(/ ?: /)[0] })).join("\n")}` : "";
    const many = tr("plugins", { n });
    this.ask({ label: `${VERB(kind)} ${many}`, jobs: ok.map((x) => this.job(kind, x)), done: tr(`bulkDone.${kind}`, { n }), kind },
      tr("askTitle", { verb: VERB(kind), name: many }),
      `${tr("oneByOne", { kind })}\n\n${lines(ok.map((x) => `${x.id} · ${scopeLabel(x)}`), 10, (k) => tr("more", { n: k }))}${skipped}`, VERB(kind), false,
      { consequence: RELOAD() });
  }

  askMarket(m) {
    if (!/^[\w.-]+$/.test(m.name)) return;
    this.ask({ label: tr("market.label", { name: m.name }), jobs: [{ name: m.name, args: ["plugin", "marketplace", "update", m.name, "--json"], cwd: home(), timeout: 180e3 }], done: tr("market.done", { name: m.name }), kind: "market" },
      tr("market.title", { name: m.name }), `claude plugin marketplace update ${m.name}`, VERB("update"), false,
      { consequence: tr("market.consequence", { origin: m.origin.label }) });
  }

  // The "⋯" menu's: every known marketplace (no name: the CLI updates them all).
  askAllMarkets() {
    this.ask({ label: tr("markets.label"), jobs: [{ name: "marketplaces", args: ["plugin", "marketplace", "update"], cwd: home(), timeout: 300e3 }], done: tr("markets.done"), kind: "market" },
      tr("markets.title"), "claude plugin marketplace update", VERB("update"), false,
      { consequence: tr("markets.consequence") });
  }

  // Runs the confirmed jobs one at a time (parallel writes to a settings file would clobber); the
  // rows they act on breathe meanwhile (pulse).
  act(p, cx) {
    this.running = p.label;
    this.runningKeys = new Set(p.jobs.map((j) => j.key).filter(Boolean));
    cx.spawn(async (cx) => {
      const fails = [];
      for (const j of p.jobs) {
        const r = await claude(j.args, { cwd: j.cwd, timeout: j.timeout });
        if (r.code !== 0) fails.push(tr("idLine", { id: j.name, why: why(r.stderr || r.stdout) || tr("code", { code: r.code }) }));
      }
      this.running = null;
      this.runningKeys = new Set();
      const reload = p.kind === "market" ? "" : ` ${RELOAD()}`;
      notify(fails.length
        ? { level: "error", title: tr("failTitle", { label: p.label, fails: tr("fails", { n: fails.length }) }), body: fails.slice(0, 3).join("\n"), timeout: 12000 }
        : { level: "success", title: p.done, body: reload.trim() || undefined, timeout: 5000 });
      // Even after a partial failure (DATA-SYNC.md): "plugins" for everyone listening (this page
      // too), "skills" / "mcp" when a plugin acted on brings some (kt-skills, kt-mcp list them).
      const acted = this.items.filter((x) => p.jobs.some((j) => j.key === x.key));
      bump("plugins",
        ...(p.kind === "market" || acted.some((x) => x.comps.skills.length || x.comps.commands.length) ? ["skills"] : []),
        ...(p.kind === "market" || acted.some((x) => x.comps.mcp.length) ? ["mcp"] : []));
      cx.notify();
    });
  }

  // ---------- keys ----------

  focusIn() {
    this.handle.focus();
    this.vim.normal();
    const list = this.walk();
    if (!list.some((x) => x.key === this.cur)) this.cur = list.some((x) => x.key === this.sel) ? this.sel : null;
    this.reveal = true;
  }

  at(list) {
    return list.find((x) => x.key === this.cur) ?? list[0] ?? null;
  }

  key(e, cx) {
    if (!this.press(e, cx)) return;
    cx.stop_propagation();
    cx.notify();
  }

  // One key: the selection's (NORMAL: x space V ctrl-a esc), this page's own e / u, then vim's.
  press(k, cx) {
    const cur = () => this.at(this.walk())?.key ?? null;
    const name = keyOf(k).name;
    if (!this.vim.insert && this.multi.key(name, cur(), this.order())) {
      this.vim.normal();
      return true;
    }
    if (!this.vim.insert && name === "+") {
      this.vim.normal();
      this.openAdd();
      return true;
    }
    if (!this.vim.insert && name === "p" && this.doc) {
      this.vim.normal();
      this.md.raw = !this.md.raw;
      return true;
    }
    if (!this.vim.insert && (name === "e" || name === "u")) {
      this.vim.normal();
      const picked = this.multi.pick(this.items, (x) => x.key);
      const x = this.at(this.walk());
      if (name === "u") {
        if (picked.length) this.askBulk("update", picked);
        else if (x) this.askOne("update", x);
      } else if (picked.length) this.askBulk(picked.some((y) => !y.enabled) ? "enable" : "disable", picked);
      else if (x) this.askOne(x.enabled ? "disable" : "enable", x);
      return true;
    }
    if (!this.keyAct(this.vim.handle(k), cx)) return false;
    if (this.multi.visual) this.multi.follow(cur(), this.order());
    return true;
  }

  keyAct(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count" || a === "filter" || a === "normal") return true;
    const list = this.walk();
    const x = this.at(list);
    const i = list.indexOf(x);
    if (a === "type" || a === "backspace") {
      this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
      this.cur = null;
    } else if (a === "up" && i <= 0 && !this.vim.insert) this.vim.edit();
    else if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev"].includes(a)) {
      const j = step(a === "next" ? "down" : a === "prev" ? "up" : a, i, list.length, this.vim.count, 10);
      if (j >= 0) this.cur = list[j].key;
      this.reveal = true;
    } else if (a === "tab-next" || a === "tab-prev") {
      const k = SEGS.indexOf(this.seg);
      this.seg = SEGS[(k + (a === "tab-next" ? 1 : SEGS.length - 1)) % SEGS.length];
      this.cur = null;
    } else if (a === "panel-prev" || a === "panel-next") {
      // [ / ]: the marketplace filter, round (none: every marketplace).
      const ms = [null, ...new Set(this.items.map((y) => y.market))];
      this.market = ms[(ms.indexOf(this.market) + (a === "panel-next" ? 1 : ms.length - 1)) % ms.length];
      this.cur = null;
    } else if (a === "left") {
      // h: folds the cursor's marketplace; the cursor goes on to the next row still shown.
      if (!x) return true;
      const next = list.slice(i + 1).find((y) => y.market !== x.market) ?? list.slice(0, i).reverse().find((y) => y.market !== x.market);
      this.fold(x.market, false);
      this.cur = next?.key ?? null;
      this.reveal = true;
    } else if (a === "scroll-right") { for (const mk of [...this.folded]) this.fold(mk, true); }
    else if (a === "open" || a === "right" || a === "submit") { if (x) this.select(x, cx); }
    else if (a === "open-alt") { if (x?.web) exec("open", [x.web]).catch(() => {}); }
    else if (a === "yank") { if (x) this.copy(x.id, cx); }
    else if (a === "delete") { if (x) this.askOne("uninstall", x); }
    else if (a === "refresh") this.scan(cx);
    else if (a === "escape" && this.query) {
      this.query = "";
      this.cur = null;
    } else if (a === "escape" || a === "quit") run("layout.select", { stack: "view", child: "thread" });
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else return false;
    return true;
  }

  // ---------- header ----------

  // The menu, its right edge under the button's (from the press: its top-left and size); a form
  // (`view`) straight away.
  openAdd(view = "menu") {
    if (view !== "menu") return void openOverlay({ mod: "kt-plugins", kind: "dialog", frame: "none", width: 1, height: 1, props: { view } });
    const b = this.addAt;
    const at = b ? { x: Math.max(8, b.x + b.w - 300), y: b.y + b.h + 6 } : "pointer";
    openOverlay({ mod: "kt-plugins", kind: "popup", frame: "none", width: 300, height: 286, at, props: { view: "menu" } });
  }

  // Crosstalk's head (DESIGN-REFERENCE.md): the page's dither (ansi5, Plugins' tint) behind the
  // mark, the title, a mono subtitle (the counters) and icon buttons; then the filter and one filter
  // row (states, then marketplaces after a rule: filters.js).
  header(t, q, shown) {
    const m = this.m;
    const typing = this.keyed && this.vim.insert;
    const tint = t.ansi5;
    const on = this.items.filter((x) => x.enabled).length;
    const ups = this.items.filter((x) => x.update).length;
    const filtered = this.query.trim() || this.seg !== "all" || this.market;
    // The counts roll (roll.js); the tail (what runs, when a read failed) stays text: its digits aren't counts.
    // « shown / total », there only while filtering, rolls apart: coming, it moves no other count's reels.
    const counts = [tr("installed", { n: this.items.length }), tr("active", { n: on }), tr("updates", { n: ups })].join(" · ");
    const tail = this.running ? `${this.running}…` : this.busy ? tr("rereading") : this.error ? tr("readFailed", { ago: ago(this.readAt) }) : "claude plugin";
    // Before the first read, the counts as a bar (skeleton.js), breathing.
    const sub = !this.scanned ? ((S) => S.pulse(S.line(240, { h: 7, lh: 14 }).id("ktp-head-sk")))(skeleton(t, m))
      : h_flex().min_w(0).h(14).line_height("14px")
        .when(Boolean(filtered), (el) => el.child(rollText(m, "ktp-head-f", `${shown} / ${this.items.length} · `, 14).flex_none()))
        .child(rollText(m, "ktp-head-n", counts, 14).flex_none()).child(div().min_w(0).truncate().child(` · ${tail}`));
    const markets = [...new Set(this.items.map((x) => x.market))];
    const seg = (x, k) => this.matches(x, k, this.market);
    const items = [
      ...SEGS.map((k) => ({ key: k, label: tr(`seg.${k}`), count: q.filter((x) => seg(x, k)).length, tint: SEG_TINT[k], group: "state" })),
      ...markets.map((mk) => ({ key: `mk:${mk}`, label: mk === SYNCED ? "claude.ai" : mk, count: q.filter((x) => x.market === mk && this.matches(x, this.seg, null)).length,
        tint: marketTint(mk, this.markets), group: "market" })),
    ];
    const dot = this.running ? t.working : ups ? t.ansi3 : t.done;
    return card(t).flex_none()
      .child(band(t, "ktp-band", tint, { m: this.m,
        w: this.headW, onW: (w, cx) => { this.headW = w; cx.notify(); },
        mark: pulse(m, markTile(t, I("puzzle"), tint, dot), Boolean(this.running)),
        title: "Plugins", sub, // i18n: tech
        actions: [
          iconBtn(t, "ktp-add", I("plus"), tr("addTip"), () => { if (!checking()) this.openAdd(); }, {
            onDown: (e) => { if (e.local_position) this.addAt = { x: e.position.x - e.local_position.x, y: e.position.y - e.local_position.y, w: e.bounds?.width ?? 28, h: e.bounds?.height ?? 28 }; },
          }),
          iconBtn(t, "ktp-refresh", I("refresh-cw"), tr("refreshTip"), (cx) => this.scan(cx), { off: this.busy, spin: this.busy }),
          iconBtn(t, "ktp-more", OWN("ellipsis"), tr("moreTip"), () => { this.menu = !this.menu; }),
        ],
      }))
      .child(bandRule(tint))
      .child(h_flex().p(4).gap(8).items_center()
        .child(h_flex().id("ktp-filter").flex_none().w(240).h(36).px(12).gap(8).items_center().rounded(12).border(1)
          .border_color(typing ? alpha(t.accent, "99") : t.border).when(typing, (el) => el.bg(alpha(t.accent, "24"))).cursor_text()
          .track_focus(this.handle)
          .on_key_down((e, cx) => this.key(e, cx))
          // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
          .on_mouse_down("left", (_e, cx) => { this.vim.edit(); this.handle.focus(); cx.notify(); })
          .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
          .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
            .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : tr("filter")))
          .when(Boolean(this.query), (el) => el.child(div().id("ktp-clear").flex_none().text_color(t.dim).cursor_pointer()
            .hover((s) => s.text_color(t.foreground))
            .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.handle.focus(); }) // not the field's press: × keeps the mode
            .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; this.cur = null; cx.notify(); })
            .child(svg(I("x")).size(13)))))
        .when(Boolean(this.keyed), (el) => el.child(mode(t, this.vim.label, typing)))
        // A state is one of four (tab / shift-tab); a marketplace narrows it and clicked again lets go ([ / ]).
        .child(div().flex_1().min_w(0).child(filterRow({
          id: "ktp-filters", state: this.filters, t, bg: t.background, items, reduced: m.reduced,
          active: [this.seg, this.market ? `mk:${this.market}` : null].filter(Boolean),
          onPick: (key) => {
            if (key.startsWith("mk:")) this.market = this.market === key.slice(3) ? null : key.slice(3);
            else this.seg = key;
            this.cur = null;
          },
        }))));
  }

  // The band's "⋯": what isn't worth a button.
  more(t) {
    return moreMenu(t, "ktp-more-menu", [
      ["ktp-more-mk", OWN("sync"), tr("allMarkets"), () => { if (!checking()) this.askAllMarkets(); }],
      ["ktp-more-finder", I("folder"), tr("reveal"), () => exec("open", [`${home()}/.claude/plugins`]).catch(() => {})],
      ["ktp-more-keys", I("keyboard"), tr("pageKeys"), () => openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } })],
    ], () => { this.menu = false; });
  }

  // ---------- list ----------

  // A marketplace's header: its tint, name, source, last update; a click folds or unfolds it (h folds
  // the cursor's, L unfolds them all).
  groupRow(t, name, n, first) {
    const m = this.markets[name];
    const open = !this.folded.has(name);
    const src = name === SYNCED ? tr("syncedSrc") : m ? `${m.origin.kind ?? "?"} · ${m.origin.kind === "directory" ? tilde(m.origin.label) : m.origin.label}` : tr("unknownMarket");
    return h_flex().id(`ktp-grp-${name}`).px(8).pt(first ? 6 : 14).pb(6).gap(10).items_center().cursor_pointer()
      .on_click((_e, cx) => { this.fold(name, !open); cx.notify(); })
      .child(svg(I(open ? "chevron-down" : "chevron-right")).size(12).flex_none().text_color(t.dim))
      .child(div().size(6).flex_none().rounded_full().bg(t[marketTint(name, this.markets)] ?? t.dim))
      .child(eyebrow(t, `${name === SYNCED ? "claude.ai" : name} · ${n}`).flex_none())
      .child(div().min_w(0).max_w(360).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(src))
      .when(Boolean(m), (el) => el.child(div().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(tr("updatedAgo", { ago: ago(m.updated) }))))
      .child(div().flex_1().min_w(12).h(0).border_t(1).border_dashed().border_color(t.border))
      .when(Boolean(m?.origin.url), (el) => el.child(icon(t, `ktp-mk-web-${name}`, OWN("github"), tr("openUrl", { url: m.origin.url }), () => exec("open", [m.origin.url]).catch(() => {}))))
      .when(Boolean(m), (el) => el.child(h_flex().id(`ktp-mk-up-${name}`).flex_none().h(24).px(10).gap(6).items_center().rounded_full().border(1).border_color(t.border)
        .font_family(MONO).text_size(10.5).text_color(this.running ? t.dim : t.muted)
        .when(!this.running, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)))
        .tooltip(`claude plugin marketplace update ${name}`)
        .on_click((_e, cx) => { cx.stop_propagation(); if (!checking()) this.askMarket(m); cx.notify(); })
        .child(svg(OWN("sync")).size(11)).child(tr("updateCaps"))));
  }

  // `gone`: closing (rows() gave it -1), drawn as it was but no longer a target: no click, hover or box.
  row(t, x, cursor, gone = false) {
    const on = x.key === this.sel;
    const hot = !gone && (on || x.key === this.hot);
    const picked = this.multi.has(x.key);
    const parts = comps(x.comps);
    return h_flex().id(`ktp-row-${x.key}`).pl(10).pr(14).py(10).gap(10).items_start().rounded(12).border(1)
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
      .child(check(t, `ktp-check-${x.key}`, picked, !gone && (picked || this.multi.size > 0 || x.key === this.hot), () => this.multi.toggle(x.key)).mt(2))
      .child(v_flex().flex_1().min_w(0).gap(3)
        .child(h_flex().h(20).gap(8).items_center()
          .child(div().min_w(0).truncate().font_family(MONO).text_size(13).font_medium().text_color(x.enabled ? t.foreground : t.muted).child(x.name))
          .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(x.version))
          .when(x.update, (el) => el.child(tag(t, t.done, tr("tag.update", { v: x.avail }))))
          .when(x.differs, (el) => el.child(tag(t, t.dim, tr("tag.catalog", { v: x.avail }))))
          .child(div().flex_1())
          .child(tag(t, x.enabled ? t.done : t.dim, x.synced ? tr("state.loaded") : x.enabled ? tr("state.on") : tr("state.off")))
          .child(tag(t, t.muted, scopeLabel(x))))
        .child(div().truncate().text_size(12.5).text_color(x.description ? t.muted : t.dim).child(x.description || tr("noDescription")))
        .child(h_flex().h(20).gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(parts || tr("noParts")))
          .when(hot, (el) => el.child(this.rowActions(t, x)))));
  }

  rowActions(t, x) {
    const toggle = x.enabled ? "disable" : "enable";
    return h_flex().flex_none().gap(2)
      .child(icon(t, `ktp-toggle-${x.key}`, OWN(x.enabled ? "power-off" : "power"), this.refusal(toggle, x) ?? VERB(toggle), () => this.askOne(toggle, x), { off: Boolean(this.refusal(toggle, x)) }))
      .child(icon(t, `ktp-update-${x.key}`, OWN("sync"), this.refusal("update", x) ?? VERB("update"), () => this.askOne("update", x), { off: Boolean(this.refusal("update", x)) }))
      .child(icon(t, `ktp-zed-${x.key}`, I("external-link"), tr("openZed"), () => this.zed(x.dir)))
      .child(icon(t, `ktp-finder-${x.key}`, I("folder"), tr("revealFinder"), () => exec("open", ["-R", x.dir]).catch(() => {})))
      .child(icon(t, `ktp-web-${x.key}`, OWN("github"), x.web ? tr("openUrl", { url: x.web }) : tr("noRepo"), () => exec("open", [x.web]).catch(() => {}), { off: !x.web }));
  }

  // The bulk bar: floats over the list's foot while rows are selected.
  bulk(t) {
    const picked = this.multi.pick(this.items, (x) => x.key);
    if (!picked.length) return null;
    const n = picked.length;
    const actions = [["enable", VERB("enable"), OWN("power")], ["disable", VERB("disable"), OWN("power-off")], ["update", VERB("update"), OWN("sync")]];
    // It rises 6 px into place when it appears (enter(), inside the list's clipped box).
    return h_flex().absolute().bottom(12).left(0).right(0).justify_center()
      .child(enter(this.m, h_flex(), "ktp-bulk").p(4).gap(2).items_center().rounded(12).border(1).border_color(t.border).bg(t.popover).shadow_lg()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(div().pl(10).pr(8).font_family(MONO).text_size(11).text_color(t.foreground).child(rollText(this.m, "ktp-sel-n", tr("selected", { n }), 15)))
        .child(div().w(1).h(18).flex_none().bg(t.border))
        .children(actions.map(([kind, label, glyph]) => h_flex().id(`ktp-bulk-${kind}`).h(28).px(10).gap(6).items_center().rounded(8)
          .text_size(12).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { if (!checking()) this.askBulk(kind, picked); cx.notify(); })
          .child(svg(glyph).size(13)).child(label)))
        .child(h_flex().id("ktp-bulk-clear").size(28).flex_none().items_center().justify_center().rounded(8).text_color(t.muted)
          .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tr("clearSelection"))
          .on_click((_e, cx) => { this.multi.clear(); cx.notify(); })
          .child(svg(I("x")).size(13))));
  }

  list(t, shown, cx) {
    const box = card(t).flex_1().min_w(0).h_full();
    // Before the first read: cards in the shape of the plugins' rows (skeleton.js), breathing, what is
    // read under them; the list fades in over them, its rows at rest (still(): no opening from 0 under it).
    const S = skeleton(t, this.m);
    if (!this.scanned && !this.error) return box.child(S.swap("ktp-list", false, null, () => v_flex().p(4).gap(4)
      .children([0, 1, 2, 3, 4, 5].map((k) => S.block(null, 84).child(S.row({ h: 82, icon: 14, lines: [0.35, 0.8], k }))))
      .child(div().px(8).py(4).font_family(MONO).text_size(11).text_color(t.dim).child(tr("readingList")))));
    if (!shown.length) {
      const text = this.error ?? (this.busy ? tr("readingList") : this.items.length ? tr("noMatch") : tr("none"));
      return box.child(empty(t, text, this.error ? t.ansi1 : t.dim));
    }
    const m = S.arriving("ktp-list") ? still(this.m) : this.m;
    const typing = this.keyed && this.vim.insert;
    const cur = this.keyed ? this.at(shown.filter((x) => !this.folded.has(x.market)))?.key : null;
    // One rows() per marketplace (motion.js): a fold, an unfold or a filter closes and opens its rows on
    // their height, in order; folded, it gets none, so they close. The rows stay the list's direct
    // children (scroll_to_item reveals those only): `at` counts them as rows() builds them, in the
    // order it returns them, the closing ones included. A marketplace gone whole (header too) goes at once.
    const rows = [];
    for (const mk of [...new Set(shown.map((x) => x.market))]) {
      const xs = shown.filter((x) => x.market === mk);
      rows.push(this.groupRow(t, mk, xs.length, rows.length === 0));
      let at = rows.length;
      rows.push(...rowsOf(m, cx, `ktp-rows-${mk}`, this.folded.has(mk) ? [] : xs, (x) => x.key, (x, i) => {
        if (i >= 0 && this.reveal && x.key === cur) { this.scroll.scroll_to_item(at); this.reveal = false; }
        at++;
        return pulse(m, this.row(t, x, i >= 0 && x.key === cur ? (typing ? "mark" : "ring") : null, i < 0), this.runningKeys.has(x.key));
      }));
    }
    const bar = this.bulk(t);
    return box
      .child(S.swap("ktp-list", true, v_flex().flex_1().min_h(0).relative().overflow_hidden()
        .child(v_flex().id("ktp-list").size_full().overflow_y_scrollbar().track_scroll(this.scroll).p(4).gap(4)
          .when(Boolean(bar), (el) => el.pb(64)).children(rows))
        .when(Boolean(bar), (el) => el.child(bar)), null, { grow: true }))
      .child(dashed(t))
      .child(h_flex().flex_none().px(14).py(8).gap(8).items_center()
        .child(svg(I("circle-alert")).size(12).flex_none().text_color(t.dim))
        .child(div().flex_1().min_w(0).text_size(11.5).text_color(t.dim)
          .child(tr("writesOnly", { reload: RELOAD() }))));
  }

  // ---------- detail ----------

  detail(t, x, w, cx) {
    const path = (label, p) => h_flex().gap(8).items_center()
      .child(eyebrow(t, label, t.dim).w(64).flex_none())
      .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.muted).child(tilde(p)));
    const m = this.markets[x.market];
    const toggle = x.enabled ? "disable" : "enable";
    const actions = [[toggle, x.enabled ? "power-off" : "power"], ["update", "sync"], ["uninstall", "trash"]];
    const already = [tr("refuse.alreadyOn"), tr("refuse.alreadyOff")];
    const off = actions.map(([k]) => [k, this.refusal(k, x)]).filter(([, r]) => r && !already.includes(r));
    const d = this.doc?.key === x.key ? this.doc : null;
    // The band: the marketplace's tint (its pill's), the plugin's state on the mark's dot.
    const tint = t[marketTint(x.market, this.markets)] ?? t.ansi5;
    const sub = [x.market === SYNCED ? "claude.ai" : x.market, scopeLabel(x), x.version, x.synced ? tr("state.loaded") : x.enabled ? tr("state.on") : tr("state.off")].join(" · ");
    // Fades in each time another plugin opens (enter(), the plugin's key in the id).
    return enter(this.m, card(t), `ktp-detail-${x.key}`, { dy: 0 }).w(w).flex_none().h_full().overflow_hidden()
      .child(band(t, "ktp-detail-band", tint, { m: this.m,
        w: this.detailW, onW: (w2, cx) => { this.detailW = w2; cx.notify(); },
        mark: pulse(this.m, markTile(t, I("puzzle"), tint, x.enabled ? t.done : t.dim), this.runningKeys.has(x.key)),
        title: x.name, sub,
        actions: [
          iconBtn(t, "ktp-d-web", OWN("github"), x.web ? "GitHub (O)" : tr("noRepoLocal"), () => exec("open", [x.web]).catch(() => {}), { off: !x.web }),
          iconBtn(t, "ktp-d-zed", I("external-link"), tr("openZed"), () => this.zed(x.dir)),
          iconBtn(t, "ktp-close", I("x"), tr("close"), () => { this.sel = null; this.doc = null; }),
        ],
      }))
      .child(bandRule(tint))
      .child(v_flex().flex_none().px(14).pt(10).pb(12).gap(8)
        .when(x.update || x.differs, (el) => el.child(h_flex().gap(6).items_center()
          .child(tag(t, x.update ? t.done : t.dim, x.update ? tr("tag.update", { v: x.avail }) : tr("tag.catalog", { v: x.avail })))
          .child(div().text_size(12).text_color(t.dim).child(x.update ? tr("newer") : tr("differs")))))
        .child(v_flex().gap(2)
          .when(Boolean(x.folder), (el) => el.child(path(tr("path.folder"), x.folder)))
          .when(Boolean(x.installPath), (el) => el.child(path("Cache", x.installPath))) // i18n: tech
          .child(path("Source", m ? (m.origin.kind === "directory" ? m.origin.label : `${m.origin.kind} · ${m.origin.label}`) : x.synced ? "claude.ai" : "—")) // i18n: tech
          .when(Boolean(x.projectPath), (el) => el.child(path(tr("path.project"), x.projectPath)))
          .when(Boolean(x.lastUpdated), (el) => el.child(path(tr("path.installed"), tr("installedAgo", { installed: ago(x.installedAt), updated: ago(x.lastUpdated) })))))
        .child(h_flex().flex_wrap().gap(6).pt(4)
          .children(actions.map(([k, glyph]) => pill(t, `ktp-do-${k}`, VERB(k), OWN(glyph), () => this.askOne(k, x),
            { primary: k === "update" && x.update, danger: k === "uninstall", off: Boolean(this.refusal(k, x)), tip: this.refusal(k, x) })))
          .child(pill(t, "ktp-finder", "Finder", I("folder"), () => exec("open", ["-R", x.dir]).catch(() => {})))) // i18n: tech
        .children(off.map(([k, r]) => div().text_size(11.5).text_color(t.dim).child(tr("verbWhy", { verb: VERB(k), why: r }))))
        .child(div().text_size(11.5).text_color(t.dim).child(RELOAD())))
      .child(dashed(t))
      .child(v_flex().id("ktp-doc").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.docScroll)
        .child(v_flex().flex_none().px(14).py(12).gap(14)
          .child(div().text_size(13).line_height("19px").text_color(x.description ? t.foreground : t.dim).child(x.description || tr("noDescription")))
          .child(this.parts(t, x))
          .child(v_flex().gap(6).child(eyebrow(t, x.pjText ? "plugin.json" : tr("catalogEntry")))
            .child(codeBlock(t, `pj-${x.key}`, "json", x.pjText ? pretty(x.pjText) : JSON.stringify(x.entry ?? {}, null, 2)))))
        .child(dashed(t))
        .child(h_flex().flex_none().px(14).pt(12).pb(6).items_center().child(eyebrow(t, "README")) // i18n: tech
          .child(div().flex_1()).when(Boolean(d?.md), (el) => el.child(tabs(t, "ktp-md-tabs", this.md))))
        .child(this.readme(t, x, d, cx)));
  }

  // The components, one line per kind; a skill opens in kt-skills (a dialog on it) when kt-skills
  // lists it: its plugin enabled in ~/.claude/settings.json.
  parts(t, x) {
    const linked = this.enabledAtUser[x.id] === true;
    const rows = PARTS.filter((k) => x.comps[k]?.length).map((k) => v_flex().gap(6)
      .child(eyebrow(t, `${tr(`part.${k}`)} · ${x.comps[k].length}`))
      .child(h_flex().flex_wrap().gap(6).children(x.comps[k].map((n) => (k === "skills" && linked
        ? chip(t, `ktp-skill-${x.key}-${n}`, `/${x.name}:${n}`, false, () => openOverlay({ mod: "kt-skills", kind: "dialog", frame: "none", width: 0.9, height: 0.88, props: { select: `${x.name}:${n}` } }))
        : chip(t, `ktp-part-${x.key}-${k}-${n}`, k === "skills" || k === "commands" ? `/${x.name}:${n}` : n, false, null))))));
    if (!rows.length) return div().text_size(12.5).text_color(t.dim).child(tr("noPartsFolder"));
    return v_flex().gap(12).children(rows)
      .when(x.comps.skills.length > 0 && !linked, (el) => el.child(div().text_size(11.5).text_color(t.dim)
        .child(tr("skillsNotLinked"))));
  }

  // The README by markdown.js: Aperçu in a ~80-character column, Brut as wide as the card (it
  // soft-wraps). While it is read: two paragraphs and a code block as bars (skeleton.js), then the
  // README fades in over them.
  readme(t, x, d, cx) {
    const S = skeleton(t, this.m);
    const para = (n) => v_flex().children(Array.from({ length: n }, (_, i) => S.line(i === n - 1 ? 0.55 : 0.95, { h: 9, lh: 22 })));
    return S.swap(`ktp-readme-${x.key}`, d?.readme !== undefined, () => (!d.readme ? empty(t, tr("noReadme"))
      : v_flex().flex_none().px(18).pt(2).pb(28).when(!this.md.raw, (el) => el.max_w(MEASURE)).when(this.md.raw, (el) => el.w_full())
        .text_size(13.5).line_height("22px").text_color(t.foreground)
        .child(view(t, this.m, cx, this.md, { id: `ktp-md-${x.key}`, mod: "kt-plugins", doc: d.md, onLink: (url) => {
          const to = target(url, x.dir);
          if (to?.web) exec("open", [to.web]).catch(() => {});
          else if (to) this.zed(to.path);
        },
        // Another page of Brut: back to its top, the README row (the doc scroll's 3rd child).
        onPage: () => this.docScroll.scroll_to_item(2) }))),
    () => v_flex().flex_none().max_w(MEASURE).px(18).pt(2).pb(28).gap(14).child(para(3)).child(S.block(null, 72, { r: 10 })).child(para(2)));
  }

  render(cx) {
    if (this.add) return this.add.render(cx);
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const vis = visible();
    // The bus: an action here or in another mod (kt-plugins' dialogs, a watch of ~/.claude/plugins).
    // Hidden too: the page is then up to date when it shows.
    if (!checking()) refreshOn(this, cx, "plugins", ["plugins"], async () => { await this.load(); });
    if (vis && !checking() && !this.shown) {
      this.showGen++; // its content fades in again
      cx.timer.after(150, (cx) => {
        if (visible() && !this.handle.is_focused()) {
          this.handle.focus();
          this.vim.edit();
        }
        cx.notify();
      });
      // Back on the page: re-read a list older than 10 s.
      if (Date.now() - this.readAt > FRESH) this.scan(cx);
    }
    if (!vis && this.shown && this.handle.is_focused() && !checking()) {
      const tab = activeSpace()?.tabs.find((c) => c.active)?.id;
      const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
      if (pane) cx.spawn(async () => run("pane.focus", { pane }));
    }
    this.shown = vis;
    this.keyed = this.handle.is_focused();
    const t = theme();
    const x = this.items.find((i) => i.key === this.sel);
    const q = this.queried();
    const shown = q.filter((i) => this.matches(i));
    // The page fades in each time it shows (enter(), the show's count in the id; no rise: nothing
    // may slide past the block). The "⋯" menu is the root's last child: it paints over the list.
    return v_flex().id("ktp-root").relative().size_full().text_color(t.foreground)
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
      .child(enter(this.m, v_flex().size_full().gap(4), `ktp-page-${this.showGen}`, { dy: 0 })
        .child(this.header(t, q, shown.length))
        .child(h_flex().flex_1().min_h(0).gap(4)
          .child(this.list(t, shown, cx))
          .when(Boolean(x), (el) => el.child(this.detail(t, x, Math.round(this.width * 0.45), cx)))))
      .when(this.menu, (el) => el.child(this.more(t)));
  }
}

function pretty(text) {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}
