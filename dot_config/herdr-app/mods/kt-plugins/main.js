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
// the page and a detail fade in, an unfolded marketplace's rows too, the bulk bar rises, the rows
// an action runs on breathe.
// Selection (select.js): ⌘-click toggles a row, ⇧-click a range, the box left of a row toggles it.
// While rows are selected, a bar floats at the list's foot: activate, deactivate, update them, one
// confirm listing them.
// Keys (vim.js; kt-keys lists them under Pages): the page opens typing in the filter (INSERT);
// ctrl-b h/l (pane.go, "focus") or `kt-plugins.key:<keys>` give it the keyboard in NORMAL.
// NORMAL: j/k, gg/G, ctrl-d/u, n/N move the cursor (k on the first row: the filter), / the filter,
// tab / shift-tab the state segments, enter/o/l open the detail, O the plugin on GitHub, y copies
// its id, r refresh, e activate / deactivate, u update (the selection when there is one), dd
// uninstall (danger), + the "Ajouter" menu, x / space / V / ctrl-a select, ? kt-keys, q back to the
// thread; esc ends the range, then empties the selection, then clears the filter, then as q.
// Tests: `kt-plugins.add:<view>` opens the menu ("menu") or a form (add.js).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, TextView } from "gpui-base";
import { exec, theme, spaces, panes, run, layout, props, home, notify, checking, nextCommand, openOverlay, shared, watchFolder } from "herdr";
import { bump, refreshOn } from "./bus.js";
import { summary, why } from "./plugins.js";
import { installed, claude, read } from "./data.js";
import { blocks } from "./markdown.js";
import { Select, partition, lines } from "./select.js";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { Add } from "./add.js";
import { MONO, I, OWN, alpha, tilde, plural, ago, card, eyebrow, dashed, empty, tag, mode, pill, icon, check, chip, codeBlock,
  band, bandRule, markTile, iconBtn, moreMenu, marketTint } from "./ui.js";
import { filterRow, filterState } from "./filters.js";
import { motionState, frame, enter, pulse, stagger } from "./motion.js";

const MEASURE = 620; // the README's column: ~80 characters of 13.5 px Inter
const FRESH = 10e3; // the page shown again re-reads a list older than this (DATA-SYNC.md)
const SEGS = [["all", "Tous"], ["on", "Actifs"], ["off", "Désactivés"], ["updates", "Mises à jour"]];
// FILTERS.md's tints for Plugins (« Tous » neutral); marketplaces: ui.js marketTint().
const SEG_TINT = { on: "done", off: "dim", updates: "ansi3" };
const RELOAD = "Les sessions ouvertes ne le voient qu'après /reload-plugins ou un redémarrage.";
const SYNCED = "synced"; // claude.ai's plugins: a scope and a "marketplace" of their own
const VERB = { enable: "Activer", disable: "Désactiver", update: "Mettre à jour", uninstall: "Désinstaller" };
const DONE = { enable: "activé", disable: "désactivé", update: "mis à jour", uninstall: "désinstallé" };
// The components a detail lists, in order: [key, label].
const PARTS = [["skills", "Skills"], ["commands", "Commandes"], ["agents", "Agents"], ["hooks", "Hooks"], ["mcp", "Serveurs MCP"], ["mods", "Mods (function hooks)"], ["lsp", "Serveurs LSP"]];

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
const scopeLabel = (x) => (x.synced ? "claude.ai" : x.scope === "project" ? `projet · ${x.projectPath?.split("/").pop() ?? "?"}` : x.scope);
// Where `claude plugin enable/disable` writes for this install.
const settingsOf = (x) => (x.scope === "user" ? "~/.claude/settings.json"
  : x.scope === "local" ? `${tilde(x.projectPath)}/.claude/settings.local.json`
  : `${tilde(x.projectPath)}/.claude/settings.json (versionné avec le projet)`);

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
    this.doc = null; // { key, segs } its README cut by blocks() (null while read)
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
    this.unfoldGen = {}; // marketplace -> how many times unfolded: its rows fade in again
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
    if (open) {
      this.folded.delete(market);
      this.unfoldGen[market] = (this.unfoldGen[market] ?? 0) + 1;
    } else this.folded.add(market);
  }

  select(x, cx) {
    if (this.sel === x.key && this.doc?.key === x.key) return;
    this.sel = x.key;
    this.doc = { key: x.key, segs: null };
    cx.spawn(async (cx) => {
      let text = null;
      for (const f of ["README.md", "readme.md", "Readme.md"]) if ((text = await read(`${x.dir}/${f}`)) != null) break;
      if (this.doc?.key !== x.key) return;
      this.doc.segs = text == null ? null : blocks(text);
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
    notify({ title: "Copié", body: text, level: "success", timeout: 2000 });
  }

  // ---------- actions ----------

  // Why `kind` can't run on x now, or null. The disabled actions' reasons.
  refusal(kind, x) {
    if (x.synced) return "synchronisé depuis claude.ai : il se gère sur claude.ai, pas avec claude plugin";
    if (!["user", "project", "local"].includes(x.scope)) return `portée « ${x.scope} » inconnue de claude plugin`;
    if (x.projectGone) return `son projet ${tilde(x.projectPath)} n'existe plus : claude plugin ne peut rien y écrire`;
    if (kind === "enable" && x.enabled) return "déjà actif";
    if (kind === "disable" && !x.enabled) return "déjà désactivé";
    if (kind === "update" && x.folder) return "lu directement depuis son dossier : ses changements s'appliquent sans mise à jour";
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
    if (this.running) return notify({ title: "Une action est en cours", body: this.running, level: "info", timeout: 3000 });
    const token = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
    this.pending = { ...p, token };
    openOverlay({ mod: "kt-confirm", kind: "dialog", frame: "none", width: 1, height: 1,
      props: { title, detail, label, danger, ...more, command: { name: `kt-plugins.confirmed:${token}` } } });
  }

  askOne(kind, x) {
    const no = this.refusal(kind, x);
    if (no) return notify({ title: `${VERB[kind]} : impossible`, body: `${x.id} : ${no}.`, level: "warning", timeout: 6000 });
    const where = x.projectPath ? ` (dans ${tilde(x.projectPath)})` : "";
    const cmd = `claude plugin ${kind} ${x.id} --scope ${x.scope}${where}`;
    const writes = `Écrit enabledPlugins dans ${settingsOf(x)}. ${RELOAD}`;
    const more = {
      enable: { consequence: writes },
      disable: { consequence: writes },
      update: {
        consequence: `${x.update ? `${x.version} → ${x.avail}.` : x.differs ? `Installé : ${x.version}, catalogue : ${x.avail}, sans ordre entre les deux : la CLI décide.` : "Le catalogue local n'offre rien de plus récent : la CLI le dira."} ${RELOAD}`,
        warning: "Une commande déclarée par la marketplace n'est jamais acceptée d'office : la CLI la refuse et l'affiche.",
      },
      uninstall: { consequence: `Retire l'installation ${scopeLabel(x)} d'installed_plugins.json et son entrée dans ${settingsOf(x)}${x.data ? `, et supprime ses données ${tilde(x.data)}/` : ""}.${x.folder ? ` Le dossier ${tilde(x.folder)} n'est pas touché.` : ""}` },
    }[kind];
    this.ask({ label: `${VERB[kind]} ${x.id}`, jobs: [this.job(kind, x)], done: `${x.id} ${DONE[kind]}`, kind },
      `${VERB[kind]} ${x.name} ?`, cmd, VERB[kind], kind === "uninstall", more);
  }

  askBulk(kind, picked) {
    const { ok, refused } = partition(picked, (x) => this.refusal(kind, x));
    if (!ok.length) return notify({ title: `${VERB[kind]} : rien à faire`, body: refused.slice(0, 4).map((r) => `${r.item.id} : ${r.why}`).join("\n"), level: "warning", timeout: 6000 });
    const n = ok.length;
    const skipped = refused.length ? `\n\nRefusés\n${refused.map((r) => `${r.item.name} : ${r.why.split(" :")[0]}`).join("\n")}` : "";
    this.ask({ label: `${VERB[kind]} ${plural(n, "plugin", "plugins")}`, jobs: ok.map((x) => this.job(kind, x)), done: `${plural(n, "plugin", "plugins")} ${DONE[kind]}${n > 1 ? "s" : ""}`, kind },
      `${VERB[kind]} ${plural(n, "plugin", "plugins")} ?`,
      `Un par un : claude plugin ${kind} <id> --scope <portée>.\n\n${lines(ok.map((x) => `${x.id} · ${scopeLabel(x)}`))}${skipped}`, VERB[kind], false,
      { consequence: RELOAD });
  }

  askMarket(m) {
    if (!/^[\w.-]+$/.test(m.name)) return;
    this.ask({ label: `Mise à jour de ${m.name}`, jobs: [{ name: m.name, args: ["plugin", "marketplace", "update", m.name, "--json"], cwd: home(), timeout: 180e3 }], done: `Marketplace ${m.name} mise à jour`, kind: "market" },
      `Mettre à jour la marketplace ${m.name} ?`, `claude plugin marketplace update ${m.name}`, "Mettre à jour", false,
      { consequence: `Récupère son catalogue depuis ${m.origin.label}. Les versions disponibles se relisent ensuite ici.` });
  }

  // The "⋯" menu's: every known marketplace (no name: the CLI updates them all).
  askAllMarkets() {
    this.ask({ label: "Mise à jour des marketplaces", jobs: [{ name: "marketplaces", args: ["plugin", "marketplace", "update"], cwd: home(), timeout: 300e3 }], done: "Marketplaces mises à jour", kind: "market" },
      "Mettre à jour toutes les marketplaces ?", "claude plugin marketplace update", "Mettre à jour", false,
      { consequence: "Récupère le catalogue de chaque marketplace connue depuis sa source. Les plugins installés se mettent à jour à part (u)." });
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
        if (r.code !== 0) fails.push(`${j.name} : ${why(r.stderr || r.stdout) || `code ${r.code}`}`);
      }
      this.running = null;
      this.runningKeys = new Set();
      const reload = p.kind === "market" ? "" : ` ${RELOAD}`;
      notify(fails.length
        ? { level: "error", title: `${p.label} : ${plural(fails.length, "échec", "échecs")}`, body: fails.slice(0, 3).join("\n"), timeout: 12000 }
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
      const k = SEGS.findIndex(([id]) => id === this.seg);
      this.seg = SEGS[(k + (a === "tab-next" ? 1 : SEGS.length - 1)) % SEGS.length][0];
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
    const sub = !this.scanned ? "lecture de claude plugin list…"
      : [filtered && `${shown} / ${this.items.length}`, plural(this.items.length, "installé", "installés"), plural(on, "actif", "actifs"),
        plural(ups, "mise à jour", "mises à jour"), this.running ? `${this.running}…` : this.busy ? "relecture…" : this.error ? `relecture échouée, données ${ago(this.readAt)}` : "claude plugin"]
        .filter(Boolean).join(" · ");
    const markets = [...new Set(this.items.map((x) => x.market))];
    const seg = (x, k) => this.matches(x, k, this.market);
    const items = [
      ...SEGS.map(([k, label]) => ({ key: k, label, count: q.filter((x) => seg(x, k)).length, tint: SEG_TINT[k], group: "state" })),
      ...markets.map((mk) => ({ key: `mk:${mk}`, label: mk === SYNCED ? "claude.ai" : mk, count: q.filter((x) => x.market === mk && this.matches(x, this.seg, null)).length,
        tint: marketTint(mk, this.markets), group: "market" })),
    ];
    const dot = this.running ? t.working : ups ? t.ansi3 : t.done;
    return card(t).flex_none()
      .child(band(t, "ktp-band", tint, {
        w: this.headW, onW: (w, cx) => { this.headW = w; cx.notify(); },
        mark: pulse(m, markTile(t, I("puzzle"), tint, dot), Boolean(this.running)),
        title: "Plugins", sub,
        actions: [
          iconBtn(t, "ktp-add", I("plus"), "Ajouter (+)", () => { if (!checking()) this.openAdd(); }, {
            onDown: (e) => { if (e.local_position) this.addAt = { x: e.position.x - e.local_position.x, y: e.position.y - e.local_position.y, w: e.bounds?.width ?? 28, h: e.bounds?.height ?? 28 }; },
          }),
          iconBtn(t, "ktp-refresh", I("refresh-cw"), "Rafraîchir (r)", (cx) => this.scan(cx), { off: this.busy, spin: this.busy }),
          iconBtn(t, "ktp-more", OWN("ellipsis"), "Plus", () => { this.menu = !this.menu; }),
        ],
      }))
      .child(bandRule(tint))
      .child(h_flex().p(4).gap(8).items_center()
        .child(h_flex().id("ktp-filter").flex_none().w(240).h(36).px(12).gap(8).items_center().rounded(12).border(1)
          .border_color(typing ? alpha(t.accent, "99") : t.border).when(typing, (el) => el.bg(alpha(t.accent, "24"))).cursor_text()
          .track_focus(this.handle)
          .on_key_down((e, cx) => this.key(e, cx))
          .on_click((_e, cx) => { this.vim.edit(); this.handle.focus(); cx.notify(); })
          .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
          .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
            .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : "Filtrer"))
          .when(Boolean(this.query), (el) => el.child(div().id("ktp-clear").flex_none().text_color(t.dim).cursor_pointer()
            .hover((s) => s.text_color(t.foreground))
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
      ["ktp-more-mk", OWN("sync"), "Mettre à jour toutes les marketplaces…", () => { if (!checking()) this.askAllMarkets(); }],
      ["ktp-more-finder", I("folder"), "Révéler ~/.claude/plugins dans le Finder", () => exec("open", [`${home()}/.claude/plugins`]).catch(() => {})],
      ["ktp-more-keys", I("keyboard"), "Touches de la page (?)", () => openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } })],
    ], () => { this.menu = false; });
  }

  // ---------- list ----------

  // A marketplace's header: its tint, name, source, last update; a click folds or unfolds it (h folds
  // the cursor's, L unfolds them all).
  groupRow(t, name, n, first) {
    const m = this.markets[name];
    const open = !this.folded.has(name);
    const src = name === SYNCED ? "synchronisé depuis claude.ai" : m ? `${m.origin.kind ?? "?"} · ${m.origin.kind === "directory" ? tilde(m.origin.label) : m.origin.label}` : "marketplace inconnue";
    return h_flex().id(`ktp-grp-${name}`).px(8).pt(first ? 6 : 14).pb(6).gap(10).items_center().cursor_pointer()
      .on_click((_e, cx) => { this.fold(name, !open); cx.notify(); })
      .child(svg(I(open ? "chevron-down" : "chevron-right")).size(12).flex_none().text_color(t.dim))
      .child(div().size(6).flex_none().rounded_full().bg(t[marketTint(name, this.markets)] ?? t.dim))
      .child(eyebrow(t, `${name === SYNCED ? "claude.ai" : name} · ${n}`).flex_none())
      .child(div().min_w(0).max_w(360).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(src))
      .when(Boolean(m), (el) => el.child(div().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(`· mis à jour ${ago(m.updated)}`)))
      .child(div().flex_1().min_w(12).h(0).border_t(1).border_dashed().border_color(t.border))
      .when(Boolean(m?.origin.url), (el) => el.child(icon(t, `ktp-mk-web-${name}`, OWN("github"), `Ouvrir ${m.origin.url}`, () => exec("open", [m.origin.url]).catch(() => {}))))
      .when(Boolean(m), (el) => el.child(h_flex().id(`ktp-mk-up-${name}`).flex_none().h(24).px(10).gap(6).items_center().rounded_full().border(1).border_color(t.border)
        .font_family(MONO).text_size(10.5).text_color(this.running ? t.dim : t.muted)
        .when(!this.running, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)))
        .tooltip(`claude plugin marketplace update ${name}`)
        .on_click((_e, cx) => { cx.stop_propagation(); if (!checking()) this.askMarket(m); cx.notify(); })
        .child(svg(OWN("sync")).size(11)).child("METTRE À JOUR")));
  }

  row(t, x, cursor) {
    const on = x.key === this.sel;
    const hot = on || x.key === this.hot;
    const picked = this.multi.has(x.key);
    const parts = summary(x.comps);
    return h_flex().id(`ktp-row-${x.key}`).pl(10).pr(14).py(10).gap(10).items_start().rounded(12).border(1)
      .border_color(cursor === "ring" ? alpha(t.accent, "99") : on ? alpha(t.accent, "66") : t.border)
      .bg(on || cursor === "ring" ? alpha(t.accent, "24") : picked ? alpha(t.accent, "14") : cursor === "mark" ? t.hover : t.background)
      .when(!on && !cursor && !picked, (el) => el.hover((s) => s.bg(t.hover)))
      .cursor_pointer()
      .on_click((e, cx) => {
        this.cur = x.key;
        if (!this.multi.click(e.modifiers, x.key, this.order())) this.select(x, cx);
        cx.notify();
      })
      .on_hover((h, cx) => {
        const next = h ? x.key : this.hot === x.key ? null : this.hot;
        if (next !== this.hot) { this.hot = next; cx.notify(); }
      })
      .child(check(t, `ktp-check-${x.key}`, picked, picked || this.multi.size > 0 || x.key === this.hot, () => this.multi.toggle(x.key)).mt(2))
      .child(v_flex().flex_1().min_w(0).gap(3)
        .child(h_flex().h(20).gap(8).items_center()
          .child(div().min_w(0).truncate().font_family(MONO).text_size(13).font_medium().text_color(x.enabled ? t.foreground : t.muted).child(x.name))
          .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(x.version))
          .when(x.update, (el) => el.child(tag(t, t.done, `mise à jour · ${x.avail}`)))
          .when(x.differs, (el) => el.child(tag(t, t.dim, `catalogue · ${x.avail}`)))
          .child(div().flex_1())
          .child(tag(t, x.enabled ? t.done : t.dim, x.synced ? "chargé" : x.enabled ? "actif" : "désactivé"))
          .child(tag(t, t.muted, scopeLabel(x))))
        .child(div().truncate().text_size(12.5).text_color(x.description ? t.muted : t.dim).child(x.description || "Pas de description."))
        .child(h_flex().h(20).gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(parts || "aucun composant reconnu"))
          .when(hot, (el) => el.child(this.rowActions(t, x)))));
  }

  rowActions(t, x) {
    const toggle = x.enabled ? "disable" : "enable";
    return h_flex().flex_none().gap(2)
      .child(icon(t, `ktp-toggle-${x.key}`, OWN(x.enabled ? "power-off" : "power"), this.refusal(toggle, x) ?? VERB[toggle], () => this.askOne(toggle, x), { off: Boolean(this.refusal(toggle, x)) }))
      .child(icon(t, `ktp-update-${x.key}`, OWN("sync"), this.refusal("update", x) ?? "Mettre à jour", () => this.askOne("update", x), { off: Boolean(this.refusal("update", x)) }))
      .child(icon(t, `ktp-zed-${x.key}`, I("external-link"), "Ouvrir le dossier dans Zed", () => this.zed(x.dir)))
      .child(icon(t, `ktp-finder-${x.key}`, I("folder"), "Révéler dans le Finder", () => exec("open", ["-R", x.dir]).catch(() => {})))
      .child(icon(t, `ktp-web-${x.key}`, OWN("github"), x.web ? `Ouvrir ${x.web}` : "Pas de dépôt connu (source locale)", () => exec("open", [x.web]).catch(() => {}), { off: !x.web }));
  }

  // The bulk bar: floats over the list's foot while rows are selected.
  bulk(t) {
    const picked = this.multi.pick(this.items, (x) => x.key);
    if (!picked.length) return null;
    const n = picked.length;
    const actions = [["enable", "Activer", OWN("power")], ["disable", "Désactiver", OWN("power-off")], ["update", "Mettre à jour", OWN("sync")]];
    // It rises 6 px into place when it appears (enter(), inside the list's clipped box).
    return h_flex().absolute().bottom(12).left(0).right(0).justify_center()
      .child(enter(this.m, h_flex(), "ktp-bulk").p(4).gap(2).items_center().rounded(12).border(1).border_color(t.border).bg(t.popover).shadow_lg()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(div().pl(10).pr(8).font_family(MONO).text_size(11).text_color(t.foreground).child(`${n} sélectionné${n > 1 ? "s" : ""}`))
        .child(div().w(1).h(18).flex_none().bg(t.border))
        .children(actions.map(([kind, label, glyph]) => h_flex().id(`ktp-bulk-${kind}`).h(28).px(10).gap(6).items_center().rounded(8)
          .text_size(12).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { if (!checking()) this.askBulk(kind, picked); cx.notify(); })
          .child(svg(glyph).size(13)).child(label)))
        .child(h_flex().id("ktp-bulk-clear").size(28).flex_none().items_center().justify_center().rounded(8).text_color(t.muted)
          .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip("Vider la sélection (esc)")
          .on_click((_e, cx) => { this.multi.clear(); cx.notify(); })
          .child(svg(I("x")).size(13))));
  }

  list(t, shown) {
    const box = card(t).flex_1().min_w(0).h_full();
    if (!shown.length) {
      const text = this.error ?? (!this.scanned || this.busy ? "Lecture de claude plugin list…" : this.items.length ? "Aucun plugin ne correspond au filtre." : "Aucun plugin installé.");
      return box.child(empty(t, text, this.error ? t.ansi1 : t.dim));
    }
    const m = this.m;
    const per = {};
    for (const x of shown) per[x.market] = (per[x.market] ?? 0) + 1;
    const typing = this.keyed && this.vim.insert;
    const cur = this.keyed ? this.at(shown.filter((x) => !this.folded.has(x.market)))?.key : null;
    // The rows stay the list's direct children (scroll_to_item reveals those only, so j / k reach a
    // row deep in a long marketplace): a fold drops them, an unfold fades them in again, cascading on
    // a short marketplace (enter() with the unfold's count in the id), rather than collapse()'s
    // height, which would wrap them in one child.
    const rows = [];
    let k = 0;
    shown.forEach((x, i) => {
      if (i === 0 || shown[i - 1].market !== x.market) { rows.push(this.groupRow(t, x.market, per[x.market], i === 0)); k = 0; }
      if (this.folded.has(x.market)) return;
      if (this.reveal && x.key === cur) { this.scroll.scroll_to_item(rows.length); this.reveal = false; }
      const row = pulse(m, this.row(t, x, x.key === cur ? (typing ? "mark" : "ring") : null), this.runningKeys.has(x.key));
      const gen = this.unfoldGen[x.market];
      rows.push(gen ? enter(m, div().w_full().flex_none(), `ktp-in-${gen}-${x.key}`, { dy: 0, delay: stagger(k, per[x.market]) }).child(row) : row);
      k++;
    });
    const bar = this.bulk(t);
    return box
      .child(v_flex().flex_1().min_h(0).relative().overflow_hidden()
        .child(v_flex().id("ktp-list").size_full().overflow_y_scrollbar().track_scroll(this.scroll).p(4).gap(4)
          .when(Boolean(bar), (el) => el.pb(64)).children(rows))
        .when(Boolean(bar), (el) => el.child(bar)))
      .child(dashed(t))
      .child(h_flex().flex_none().px(14).py(8).gap(8).items_center()
        .child(svg(I("circle-alert")).size(12).flex_none().text_color(t.dim))
        .child(div().flex_1().min_w(0).text_size(11.5).text_color(t.dim)
          .child(`Écritures par claude plugin seulement, jamais dans settings.json ni installed_plugins.json. ${RELOAD}`)));
  }

  // ---------- detail ----------

  detail(t, x, w) {
    const path = (label, p) => h_flex().gap(8).items_center()
      .child(eyebrow(t, label, t.dim).w(64).flex_none())
      .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.muted).child(tilde(p)));
    const m = this.markets[x.market];
    const toggle = x.enabled ? "disable" : "enable";
    const actions = [[toggle, x.enabled ? "power-off" : "power"], ["update", "sync"], ["uninstall", "trash"]];
    const off = actions.map(([k]) => [k, this.refusal(k, x)]).filter(([, r]) => r && r !== "déjà actif" && r !== "déjà désactivé");
    const d = this.doc?.key === x.key ? this.doc : null;
    // The band: the marketplace's tint (its pill's), the plugin's state on the mark's dot.
    const tint = t[marketTint(x.market, this.markets)] ?? t.ansi5;
    const sub = [x.market === SYNCED ? "claude.ai" : x.market, scopeLabel(x), x.version, x.synced ? "chargé" : x.enabled ? "actif" : "désactivé"].join(" · ");
    // Fades in each time another plugin opens (enter(), the plugin's key in the id).
    return enter(this.m, card(t), `ktp-detail-${x.key}`, { dy: 0 }).w(w).flex_none().h_full().overflow_hidden()
      .child(band(t, "ktp-detail-band", tint, {
        w: this.detailW, onW: (w2, cx) => { this.detailW = w2; cx.notify(); },
        mark: pulse(this.m, markTile(t, I("puzzle"), tint, x.enabled ? t.done : t.dim), this.runningKeys.has(x.key)),
        title: x.name, sub,
        actions: [
          iconBtn(t, "ktp-d-web", OWN("github"), x.web ? "GitHub (O)" : "Pas de dépôt connu : source locale", () => exec("open", [x.web]).catch(() => {}), { off: !x.web }),
          iconBtn(t, "ktp-d-zed", I("external-link"), "Ouvrir le dossier dans Zed", () => this.zed(x.dir)),
          iconBtn(t, "ktp-close", I("x"), "Fermer", () => { this.sel = null; this.doc = null; }),
        ],
      }))
      .child(bandRule(tint))
      .child(v_flex().flex_none().px(14).pt(10).pb(12).gap(8)
        .when(x.update || x.differs, (el) => el.child(h_flex().gap(6).items_center()
          .child(tag(t, x.update ? t.done : t.dim, x.update ? `mise à jour · ${x.avail}` : `catalogue · ${x.avail}`))
          .child(div().text_size(12).text_color(t.dim).child(x.update ? "Le catalogue local offre une version plus récente." : "Version différente, sans ordre avec l'installée (un commit git) : non comptée."))))
        .child(v_flex().gap(2)
          .when(Boolean(x.folder), (el) => el.child(path("Dossier", x.folder)))
          .when(Boolean(x.installPath), (el) => el.child(path("Cache", x.installPath)))
          .child(path("Source", m ? (m.origin.kind === "directory" ? m.origin.label : `${m.origin.kind} · ${m.origin.label}`) : x.synced ? "claude.ai" : "—"))
          .when(Boolean(x.projectPath), (el) => el.child(path("Projet", x.projectPath)))
          .when(Boolean(x.lastUpdated), (el) => el.child(path("Installé", `${ago(x.installedAt)} · mis à jour ${ago(x.lastUpdated)}`))))
        .child(h_flex().flex_wrap().gap(6).pt(4)
          .children(actions.map(([k, glyph]) => pill(t, `ktp-do-${k}`, VERB[k], OWN(glyph), () => this.askOne(k, x),
            { primary: k === "update" && x.update, danger: k === "uninstall", off: Boolean(this.refusal(k, x)), tip: this.refusal(k, x) })))
          .child(pill(t, "ktp-finder", "Finder", I("folder"), () => exec("open", ["-R", x.dir]).catch(() => {}))))
        .children(off.map(([k, r]) => div().text_size(11.5).text_color(t.dim).child(`${VERB[k]} : ${r}.`)))
        .child(div().text_size(11.5).text_color(t.dim).child(RELOAD)))
      .child(dashed(t))
      .child(v_flex().id("ktp-doc").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.docScroll)
        .child(v_flex().flex_none().px(14).py(12).gap(14)
          .child(div().text_size(13).line_height("19px").text_color(x.description ? t.foreground : t.dim).child(x.description || "Pas de description."))
          .child(this.parts(t, x))
          .child(v_flex().gap(6).child(eyebrow(t, x.pjText ? "plugin.json" : "Entrée du catalogue (pas de plugin.json)"))
            .child(codeBlock(t, `pj-${x.key}`, "json", x.pjText ? pretty(x.pjText) : JSON.stringify(x.entry ?? {}, null, 2)))))
        .child(dashed(t))
        .child(h_flex().flex_none().px(14).pt(12).pb(6).child(eyebrow(t, "README")))
        .child(this.readme(t, x, d)));
  }

  // The components, one line per kind; a skill opens in kt-skills (a dialog on it) when kt-skills
  // lists it: its plugin enabled in ~/.claude/settings.json.
  parts(t, x) {
    const linked = this.enabledAtUser[x.id] === true;
    const rows = PARTS.filter(([k]) => x.comps[k]?.length).map(([k, label]) => v_flex().gap(6)
      .child(eyebrow(t, `${label} · ${x.comps[k].length}`))
      .child(h_flex().flex_wrap().gap(6).children(x.comps[k].map((n) => (k === "skills" && linked
        ? chip(t, `ktp-skill-${x.key}-${n}`, `/${x.name}:${n}`, false, () => openOverlay({ mod: "kt-skills", kind: "dialog", frame: "none", width: 0.9, height: 0.88, props: { select: `${x.name}:${n}` } }))
        : chip(t, `ktp-part-${x.key}-${k}-${n}`, k === "skills" || k === "commands" ? `/${x.name}:${n}` : n, false, null))))));
    if (!rows.length) return div().text_size(12.5).text_color(t.dim).child("Aucun composant reconnu dans son dossier.");
    return v_flex().gap(12).children(rows)
      .when(x.comps.skills.length > 0 && !linked, (el) => el.child(div().text_size(11.5).text_color(t.dim)
        .child("Skills non cliquables : la page Skills ne liste que les plugins actifs dans ~/.claude/settings.json.")));
  }

  readme(t, x, d) {
    if (!d || d.segs === null && d.readme === undefined) return empty(t, "Chargement…");
    if (!d.readme) return empty(t, "Pas de README dans son dossier.");
    return v_flex().flex_none().max_w(MEASURE).px(18).pt(2).pb(28).gap(14)
      .text_size(13.5).line_height("22px").text_color(t.foreground)
      .children(d.segs.map((s, i) => (s.kind === "code" ? codeBlock(t, `${x.key}#${i}`, s.lang, s.text)
        : TextView.markdown(`ktp-md-${x.key}#${i}`, s.text).selectable(true)
          .on_link_click((url) => { if (/^https?:/i.test(url)) exec("open", [url]).catch(() => {}); }))));
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
          .child(this.list(t, shown))
          .when(Boolean(x), (el) => el.child(this.detail(t, x, Math.round(this.width * 0.45))))))
      .when(this.menu, (el) => el.child(this.more(t)));
  }
}

function pretty(text) {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}
