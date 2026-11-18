// kt-plugins' "Ajouter": the same mod opened as an overlay with props.view.
// - "menu" (a popup under the page's + Ajouter): the four ways, j/k + enter, q/esc.
// - "browse" (a dialog): what the known marketplaces offer and isn't installed, read in each
//   marketplace's .claude-plugin/marketplace.json (its clone, or its folder); a preview (plugin.json
//   and components, read in the marketplace's clone when the source is a folder of it; a remote
//   source is only known once downloaded) and Installer: `claude plugin install <id> --scope user`.
//   props.market: opened on that marketplace (after adding it).
// - "marketplace": GitHub owner/repo, a git URL or a local folder (pickFolder):
//   `claude plugin marketplace add <source>`; on success, "browse" opens on it.
// - "folder": a plugin in development (pickFolder). With a .claude-plugin/marketplace.json, one of
//   its plugins through `claude plugin install <name> --marketplace <folder>` (the CLI adds the
//   folder as a marketplace first); a lone plugin.json can't be installed by the CLI: refused, with
//   `claude --plugin-dir <folder>` (this session only) to copy.
// - "manual": a free name@marketplace for `claude plugin install`.
// Every install shows what the plugin brings first and says it plainly: hooks, MCP servers and mods
// are third-party code running in every session. Every command goes through kt-confirm, which shows
// it exactly and calls back `kt-plugins.confirmed:<token>` (only the copy holding that token runs).
// Keys (vim.js): forms open typing in their field (INSERT: the Input types; ctrl-n/ctrl-p ↓ ↑ move,
// enter runs the main action, esc: NORMAL). NORMAL: j/k gg/G ctrl-d/u move, tab / shift-tab the
// segments, enter / o / l the main action, / back to the field, q / esc close, ? the keys.
// `kt-plugins.add-key:<keys>` feeds keys to the overlay copies (the page ignores it) and
// `kt-plugins.add-query:<text>` fills their field: for tests.

import { div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, InputState, Input } from "gpui-base";
import { theme, props, closeOverlay, openOverlay, notify, nextCommand, checking, pickFolder, home, shared } from "herdr";
import { summary, isRepo, isGitUrl, isPluginId, split, under, why } from "./plugins.js";
import { claude, shown, inspect, marketplaces, offeredPlugins, folderInfo } from "./data.js";
import { Vim, keysOf, step } from "./vim.js";
import { MONO, I, OWN, SPIN, alpha, veil, tilde, plural, eyebrow, dashed, empty, tag, mode, pill, chip, codeBlock, warning,
  band, bandRule, markTile, iconBtn, marketTint } from "./ui.js";
import { bump } from "./bus.js";
import { filterRow, filterState } from "./filters.js";
import { motionState, frame, enter, ink, pulse } from "./motion.js";

const PAGE = 60;
const RELOAD = "Les sessions ouvertes ne le voient qu'après /reload-plugins ou un redémarrage.";
const THIRD = "C'est du code tiers : ses hooks, serveurs MCP et mods s'exécutent dans chacune de tes sessions Claude Code, avec tes droits. Lis son plugin.json avant d'installer.";
const MENU = [
  ["browse", "layers", "Parcourir les marketplaces", "Les plugins disponibles, pas encore installés"],
  ["marketplace", "plus", "Ajouter une marketplace", "GitHub, URL git ou dossier local"],
  ["folder", "folder", "Installer depuis un dossier", "Un plugin en développement"],
  ["manual", "square-pen", "Saisir nom@marketplace", "Un plugin introuvable ici"],
];
const TITLE = { browse: "Parcourir les marketplaces", marketplace: "Ajouter une marketplace", folder: "Installer depuis un dossier", manual: "Plugin introuvable" };
const SUB = {
  browse: "Les plugins des marketplaces connues, lus dans leur marketplace.json, moins ceux déjà installés.",
  marketplace: "claude plugin marketplace add, puis ses plugins s'ouvrent dans Parcourir.",
  folder: "Un dossier avec .claude-plugin/marketplace.json : la CLI l'ajoute comme marketplace locale, puis installe.",
  manual: "Un identifiant nom@marketplace pour claude plugin install, quand Parcourir ne le montre pas.",
};
const KINDS = [["github", "GitHub"], ["git", "URL git"], ["directory", "Dossier local"]];
const GLYPH = { browse: "layers", marketplace: "plus", folder: "folder", manual: "square-pen" };
const HOLDER = { browse: "Filtrer les plugins", manual: "nom@marketplace" };
const RISKY = [["hooks", "hooks"], ["mcp", "serveurs MCP"], ["mods", "mods (function hooks)"]];
const PARTS = [["skills", "Skills"], ["commands", "Commandes"], ["agents", "Agents"], ["hooks", "Hooks"], ["mcp", "Serveurs MCP"], ["mods", "Mods (function hooks)"], ["lsp", "Serveurs LSP"]];

// A catalog entry's source for people.
const srcLabel = (s) => (typeof s === "string" ? s
  : s?.source === "github" ? `github · ${s.repo}`
  : `${s?.source ?? "?"} · ${String(s?.url ?? "").replace(/^https?:\/\//, "").replace(/\.git$/, "")}${s?.path ? ` · ${s.path}` : ""}`);
const pretty = (text) => { try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; } };

export class Add {
  constructor(view, cx) {
    this.view = view;
    this.handle = cx.focus_handle();
    this.scroll = ScrollHandle.new();
    this.side = ScrollHandle.new();
    this.field = view === "browse" || view === "manual" || view === "marketplace";
    this.vim = new Vim({ field: this.field, insert: this.field });
    // One field for both text kinds of the marketplace form (a placeholder is set once): it names both.
    this.input = InputState.new({ placeholder: view === "marketplace" ? "owner/repo, ou une URL git" : HOLDER[view] ?? "" });
    this.input.on("focus", (_e, cx) => { this.typing = true; this.vim.edit(); cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; this.vim.normal(); cx.notify(); });
    this.input.on("change", (_e, cx) => { this.hl = 0; this.note = ""; cx.notify(); });
    this.input.on("submit", (_e, cx) => { this.primary(cx); cx.notify(); });
    this.typing = false;
    this.hl = 0; // the menu's row, the browse list's cursor
    this.market = props()?.market ?? null; // browse: a marketplace chip
    this.kind = "github"; // marketplace: the source's kind
    this.folder = null; // marketplace (directory) and folder: the picked folder
    this.info = null; // its folderInfo()
    this.choice = 0; // folder: which of its plugins
    this.items = null; // browse / manual: offeredPlugins()
    this.markets = {};
    this.errors = [];
    this.previews = new Map(); // id -> { comps, pjText, manifest } once read, "…" while read
    this.pending = null; // what kt-confirm is asking about, with its token
    this.running = null;
    this.note = "";
    this.size = null;
    this.motion = motionState();
    this.mkRow = filterState(); // Parcourir's marketplace row
    this.headW = 0; // the band's measured width (its dither waits for it)
    this.kindW = {}; // the source kinds' measured widths: where their ink glides
    if (this.field) {
      this.input.focus();
      cx.timer.after(500, () => { if (!this.handle.is_focused()) this.input.focus(); });
    } else this.handle.focus();
    if (checking()) return;
    if (view === "browse" || view === "manual") this.load(cx);
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") (this.field && this.vim.insert ? this.input : this.handle).focus();
        else if (c.startsWith("add-key:")) {
          (this.field && this.vim.insert ? this.input : this.handle).focus();
          for (const k of keysOf(c.slice(8))) this.act(this.vim.handle(k), cx);
        } else if (c.startsWith("add-query:") && this.field) {
          this.input.set_value(c.slice(10));
          this.hl = 0;
        } else if (c.startsWith("confirmed:") && this.pending && c.slice(10) === this.pending.token) {
          const p = this.pending;
          this.pending = null;
          this.run(p, cx);
        }
        cx.notify();
      }
    });
  }

  // The person closing it (Esc, ✕, Annuler, a click on the veil). Not named close(): Herdr calls a
  // View's close() on every reload, and an overlay must never shut itself then (ANIMATIONS.md).
  dismiss() {
    closeOverlay(props().overlay);
  }

  // Another view, as its own overlay (a dialog), this one closing.
  open(view, extra = {}) {
    openOverlay({ mod: "kt-plugins", kind: "dialog", frame: "none", width: 1, height: 1, props: { view, ...extra } });
    this.dismiss();
  }

  load(cx) {
    this.items = null;
    cx.spawn(async (cx) => {
      try {
        const got = await offeredPlugins();
        this.items = got.items;
        this.markets = got.markets;
        this.errors = got.errors;
        if (this.market && !this.items.some((x) => x.market === this.market)) this.note = `${this.market} n'offre aucun plugin de plus à installer.`;
      } catch (e) {
        this.items = [];
        this.note = String(e?.message ?? e);
      }
      cx.notify();
    });
  }

  // A plugin's folder read once (plugin.json, components); a remote source: its entry only.
  preview(x, cx) {
    if (!x || this.previews.has(x.id)) return this.previews.get(x?.id) ?? null;
    this.previews.set(x.id, "…");
    cx.spawn(async (cx) => {
      const [got] = await inspect([{ dir: x.dir, entry: x.entry }]);
      this.previews.set(x.id, got);
      cx.notify();
    });
    return "…";
  }

  // ---------- what each view does ----------

  rows() {
    const q = this.input.value().trim().toLowerCase();
    return (this.items ?? []).filter((x) => (!this.market || x.market === this.market)
      && (!q || `${x.id} ${x.description} ${x.category ?? ""}`.toLowerCase().includes(q)));
  }

  // manual: the typed id, and what the catalogs know of it.
  manual() {
    const v = this.input.value().trim();
    if (!isPluginId(v)) return { v, x: null, why: v ? "La forme attendue : nom@marketplace (lettres, chiffres, . _ -)." : "" };
    const { market } = split(v);
    if (!this.markets[market]) return { v, x: null, why: `Marketplace ${market} inconnue ici : ajoute-la d'abord (Ajouter une marketplace).` };
    const x = (this.items ?? []).find((i) => i.id === v);
    return { v, x, why: null, note: x ? null : `Absent du catalogue local de ${market}, ou déjà installé : la CLI tranchera.` };
  }

  // marketplace: the source to add, or null (and why).
  source() {
    const v = this.input.value().trim();
    if (this.kind === "github") return isRepo(v) ? { arg: v } : { why: v ? "La forme attendue : owner/repo." : "" };
    if (this.kind === "git") return isGitUrl(v) ? { arg: { url: v } } : { why: v ? "Une URL git : https://…, ssh://… ou git@hôte:chemin." : "" };
    if (!this.folder) return { why: "" };
    if (!this.info) return { why: "Lecture du dossier…" };
    if (!this.info.market) return { why: "Pas de .claude-plugin/marketplace.json dans ce dossier : claude plugin marketplace add le refuserait. Pour un plugin seul, Installer depuis un dossier." };
    return { arg: { path: this.folder } };
  }

  // folder: the plugin to install from the picked folder, its id-like label and command.
  folderPick() {
    const plugins = this.info?.plugins ?? [];
    const e = plugins[Math.min(this.choice, plugins.length - 1)];
    if (!e) return null;
    const local = typeof e.source === "string";
    return { id: `${e.name}@${this.info.market?.name ?? "?"}`, name: e.name, market: this.info.market?.name ?? "?", entry: e, description: String(e.description ?? ""),
      version: e.version ?? null, dir: local ? under(this.folder, e.source) : null, remote: !local };
  }

  async choose(cx) {
    const path = await pickFolder({ prompt: "Choisir" });
    if (!path) return;
    this.folder = path.replace(/\/+$/, "");
    this.info = null;
    this.choice = 0;
    cx.notify();
    this.info = await folderInfo(this.folder);
    // The plugin the folder's own plugin.json names, when its marketplace lists it.
    const own = this.info.plugins.findIndex((e) => e.name === this.info.plugin?.name);
    this.choice = Math.max(0, own);
    cx.notify();
  }

  primary(cx) {
    if (this.running || checking()) return;
    if (this.view === "menu") return void this.open(MENU[this.hl][0]);
    if (this.view === "browse") {
      const x = this.rows()[this.hl];
      if (x) this.askInstall(x, ["plugin", "install", x.id, "--scope", "user", "--json"], cx);
    } else if (this.view === "manual") {
      const m = this.manual();
      if (!m.why) this.askInstall(m.x ?? { id: m.v, name: split(m.v).name, entry: null, remote: true }, ["plugin", "install", m.v, "--scope", "user", "--json"], cx);
    } else if (this.view === "folder") {
      const x = this.folderPick();
      if (x) this.askInstall(x, ["plugin", "install", x.name, "--marketplace", { path: this.folder }, "--scope", "user", "--json"], cx,
        `Ajoute d'abord ${tilde(this.folder)} comme marketplace locale « ${x.market} » (portée user), si elle ne l'est pas déjà.`);
    } else if (this.view === "marketplace") {
      const s = this.source();
      if (!s.arg) return;
      const args = ["plugin", "marketplace", "add", s.arg, "--json"];
      this.ask({ label: "Ajout de la marketplace", args, done: "Marketplace ajoutée", then: "browse", topics: ["plugins"] }, "Ajouter cette marketplace ?",
        shown(args), "Ajouter",
        { consequence: `Déclarée dans ~/.claude/settings.json (portée user)${this.kind === "directory" ? "" : ", puis clonée sous ~/.claude/plugins/marketplaces/"}. Rien n'est installé : ses plugins s'ouvrent ensuite dans Parcourir.` });
    }
  }

  askInstall(x, args, cx, before = "") {
    const pv = x.dir || x.entry ? this.preview(x, cx) : null;
    const comps = pv && pv !== "…" ? pv.comps : null;
    const risky = comps ? RISKY.filter(([k]) => comps[k].length).map(([k, label]) => `${comps[k].length} ${label}`) : [];
    const brings = x.remote && !comps?.lsp?.length && !summary(comps)
      ? `Source distante (${srcLabel(x.entry?.source ?? "inconnue")}) : son contenu n'est connu qu'une fois téléchargé.`
      : `Apporte : ${summary(comps) || "aucun composant reconnu"}${risky.length ? `, dont ${risky.join(", ")} qui s'exécutent dans tes sessions` : ""}.`;
    // What it brings decides who else re-reads: kt-skills (skills, commands), kt-mcp (MCP); unknown
    // before download (a remote source): both.
    const topics = ["plugins", ...(!comps || comps.skills.length || comps.commands.length ? ["skills"] : []), ...(!comps || comps.mcp.length ? ["mcp"] : [])];
    this.ask({ label: `Installation de ${x.id}`, args, done: `${x.id} installé`, then: "close", topics }, `Installer ${x.name} ?`,
      [shown(args), before, brings].filter(Boolean).join("\n\n"), "Installer", { warning: THIRD, consequence: RELOAD });
  }

  // kt-confirm, full window: `detail`'s first paragraph the command, then blocks; `more`:
  // { consequence, warning } as kt-confirm draws them.
  ask(p, title, detail, label, more = {}) {
    if (this.running) return;
    const token = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
    this.pending = { ...p, token };
    openOverlay({ mod: "kt-confirm", kind: "dialog", frame: "none", width: 1, height: 1,
      props: { title, detail, label, ...more, command: { name: `kt-plugins.confirmed:${token}` } } });
  }

  run(p, cx) {
    this.running = p.label;
    this.note = "";
    cx.spawn(async (cx) => {
      const before = p.then === "browse" ? Object.keys((await marketplaces()).markets) : null;
      const r = await claude(p.args, { cwd: home(), timeout: 300e3 });
      this.running = null;
      bump(...(p.topics ?? ["plugins"])); // failed too: an install may have half happened (DATA-SYNC.md)
      if (r.code !== 0) {
        this.note = why(r.stderr || r.stdout) || `code ${r.code}`;
        notify({ level: "error", title: `${p.label} : échec`, body: this.note, timeout: 12000 });
        return void cx.notify();
      }
      notify({ level: "success", title: p.done, body: p.then === "browse" ? "Ses plugins s'ouvrent dans Parcourir." : RELOAD, timeout: 5000 });
      if (p.then === "browse") {
        const added = Object.keys((await marketplaces()).markets).find((n) => !before.includes(n));
        this.open("browse", added ? { market: added } : {});
      } else if (this.view === "browse") this.load(cx); // the installed one leaves the list
      else this.dismiss();
      cx.notify();
    });
  }

  // ---------- keys ----------

  key(e, cx) {
    if (!this.act(this.vim.handle(e), cx)) return;
    cx.stop_propagation();
    cx.notify();
  }

  // One vim action; false: not ours (in INSERT the Input types, deletes and submits itself).
  act(a, cx) {
    if (!a || a === "type" || a === "backspace" || a === "submit") return false;
    if (a === "pending" || a === "count") return true;
    const n = this.view === "menu" ? MENU.length : this.view === "browse" ? this.rows().length : this.view === "folder" ? this.info?.plugins.length ?? 0 : 0;
    const move = (to) => {
      if (to < 0) return;
      if (this.view === "folder") this.choice = to;
      else { this.hl = to; this.reveal = true; }
    };
    const at = this.view === "folder" ? this.choice : this.hl;
    if (a === "normal") this.handle.focus();
    else if (a === "filter") { if (this.field && this.kind !== "directory") this.input.focus(); }
    else if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev"].includes(a)) move(step(a === "next" ? "down" : a === "prev" ? "up" : a, at, n, this.vim.count, 16));
    else if (a === "tab-next" || a === "tab-prev") this.cycle(a === "tab-next" ? 1 : -1);
    else if (a === "open" || a === "right") {
      if (this.view === "folder" && !this.folder) cx.spawn(async (cx) => { await this.choose(cx); });
      else this.primary(cx);
    } else if (a === "escape" || a === "quit") this.dismiss();
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else return false;
    return true;
  }

  // tab: browse's marketplace chips, the marketplace form's kinds, the folder's plugins.
  cycle(d) {
    if (this.view === "browse") {
      const ms = [null, ...new Set((this.items ?? []).map((x) => x.market))];
      this.market = ms[(ms.indexOf(this.market) + d + ms.length) % ms.length];
      this.hl = 0;
    } else if (this.view === "marketplace") this.setKind(KINDS[(KINDS.findIndex(([k]) => k === this.kind) + d + KINDS.length) % KINDS.length][0]);
    else if (this.view === "folder" && this.info?.plugins.length) this.choice = (this.choice + d + this.info.plugins.length) % this.info.plugins.length;
  }

  setKind(k) {
    this.kind = k;
    this.note = "";
    this.input.set_value("");
    if (k === "directory") this.handle.focus();
    else this.input.focus();
  }

  // ---------- drawing ----------

  // The menu: a popup card (20, 4 px around), its inner card (16), rows (12).
  // It fades in when it opens (enter(); no rise: a popup doesn't clip).
  menu(t) {
    return enter(this.m, v_flex(), "ktp-menu", { dy: 0 }).size_full().p(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg()
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .child(v_flex().flex_1().min_h(0).p(4).gap(2).rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(h_flex().px(10).pt(6).pb(4).child(eyebrow(t, "Ajouter des plugins")))
        .children(MENU.map(([view, glyph, label, sub], i) => {
          const on = i === this.hl;
          return h_flex().id(`ktp-menu-${view}`).px(10).py(7).gap(10).items_center().rounded(12).border(1)
            .border_color(on ? alpha(t.accent, "99") : alpha(t.accent, "00")).when(on, (el) => el.bg(alpha(t.accent, "24")))
            .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
            .cursor_pointer()
            .on_hover((h, cx) => { if (h && this.hl !== i) { this.hl = i; cx.notify(); } })
            .on_click((_e, cx) => { this.open(view); cx.notify(); })
            .child(div().size(28).flex_none().rounded(9).border(1).border_color(t.border).bg(t.background).flex().items_center().justify_center()
              .child(svg(I(glyph)).size(14).text_color(on ? t.accent : t.muted)))
            .child(v_flex().flex_1().min_w(0)
              .child(div().text_size(13).font_medium().text_color(t.foreground).child(label))
              .child(div().truncate().text_size(11.5).text_color(t.dim).child(sub)));
        })));
  }

  // The band's mono subtitle: what the form runs, or what Parcourir holds.
  subtitle() {
    if (this.running) return `${this.running}…`;
    if (this.view === "browse") {
      if (this.items === null) return "lecture des catalogues…";
      const n = new Set(this.items.map((x) => x.market)).size;
      return [plural(this.items.length, "disponible", "disponibles"), plural(n, "marketplace", "marketplaces"), "claude plugin install"].join(" · ");
    }
    return { marketplace: "claude plugin marketplace add <source>", folder: "claude plugin install <nom> --marketplace <dossier>", manual: "claude plugin install nom@marketplace" }[this.view] ?? "";
  }

  // The source kinds, as segments with an ink gliding to the chosen one (motion.js ink(): left and
  // width move, 240 ms), placed from the segments' measured widths; no ink until they are measured.
  kinds(t) {
    const GAP = 2, PAD = 3;
    const widths = KINDS.map(([k]) => this.kindW[k] ?? 0);
    const i = KINDS.findIndex(([k]) => k === this.kind);
    const ready = widths.every((w) => w > 0);
    const left = PAD + widths.slice(0, i).reduce((s, w) => s + w + GAP, 0);
    return h_flex().id("ktp-kinds").relative().flex_none().h(36).p(PAD).gap(GAP).items_center().rounded(12).border(1).border_color(t.border)
      .when(ready, (el) => el.child(ink(this.m, div().id("ktp-kind-ink").absolute().top(PAD).h(28).left(left).w(widths[i])
        .rounded(9).border(1).border_color(alpha(t.accent, "66")).bg(alpha(t.accent, "24")))))
      .children(KINDS.map(([k, label]) => h_flex().id(`ktp-kind-${k}`).h_full().px(11).items_center().rounded(9)
        .text_size(12).text_color(k === this.kind ? t.foreground : t.muted).cursor_pointer()
        .when(k !== this.kind, (el) => el.hover((s) => s.text_color(t.foreground)))
        .on_size_change((size, cx) => { if (Math.abs((this.kindW[k] ?? 0) - size.width) >= 0.5) { this.kindW[k] = size.width; cx.notify(); } })
        .on_click((_e, cx) => { this.setKind(k); cx.notify(); })
        .child(label)));
  }

  // A dialog: a veil, the card (20) centered, its inner card (16): Crosstalk's band (the page's
  // ansi5 dither, cut inside the inner card's border), the intro, body, foot. The card fades in and
  // rises 6 px when it opens (enter(), inside the veil, which clips).
  frame(t, w, h, body, foot) {
    const tint = t.ansi5;
    const head = band(t, "ktp-add-band", tint, {
      w: this.headW, onW: (w2, cx) => { this.headW = w2; cx.notify(); },
      mark: pulse(this.m, markTile(t, I(GLYPH[this.view] ?? "plus"), tint, this.running ? t.working : null), Boolean(this.running)),
      title: TITLE[this.view], sub: this.subtitle(),
      actions: [mode(t, this.vim.label, this.typing), iconBtn(t, "ktp-add-close", I("x"), "Fermer (esc)", () => this.dismiss())],
    });
    const card = enter(this.m, v_flex(), `ktp-add-card-${this.view}`)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .w(w).when(h != null, (el) => el.h(h)).min_h(0).p(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg().text_size(13)
      .child(v_flex().when(h != null, (el) => el.flex_1()).min_h(0).rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(head)
        .child(bandRule(tint))
        .child(div().flex_none().px(16).pt(10).pb(10).text_size(12.5).line_height("18px").text_color(t.muted).child(SUB[this.view]))
        .child(body)
        .child(dashed(t))
        .child(h_flex().flex_none().px(12).py(10).gap(8).items_center().child(foot)));
    return div().id("ktp-add-veil").size_full().overflow_hidden().flex().items_center().justify_center().bg(veil())
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      .on_click(() => this.dismiss())
      .child(card);
  }

  // The field (a real Input): accent while typing in it.
  fieldBox(t, glyph) {
    return h_flex().flex_none().h(36).px(12).gap(8).items_center().rounded(12).bg(t.background)
      .border(1).border_color(this.typing ? t.accent : t.input).cursor_text()
      .child(svg(I(glyph)).size(14).flex_none().text_color(t.dim))
      .child(Input.new(this.input).flex_1().h_full().font_family(MONO).text_size(12.5).text_color(t.foreground));
  }

  commandLine(t, args) {
    return v_flex().flex_none().gap(4)
      .child(eyebrow(t, "Commande", t.dim))
      .child(div().px(12).py(8).rounded(12).border(1).border_color(t.border).bg(t.raised).font_family(MONO).text_size(12)
        .text_color(args ? t.foreground : t.dim).child(args ? shown(args) : "—"));
  }

  foot(t, label, off, tip) {
    return h_flex().flex_1().gap(8).items_center()
      .when(Boolean(this.running), (el) => el.child(h_flex().gap(6).items_center().font_family(MONO).text_size(11).text_color(t.working)
        .child(svg(SPIN).size(12).spin(900)).child(`${this.running}…`)))
      .when(!this.running && Boolean(this.note), (el) => el.child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.ansi1).child(this.note)))
      .child(div().flex_1())
      .child(pill(t, "ktp-add-cancel", "Annuler", null, () => this.dismiss()))
      .child(pill(t, "ktp-add-go", label, null, (cx) => this.primary(cx), { primary: true, off: off || Boolean(this.running), tip }));
  }

  // What a plugin brings, before installing it: description, source, components, plugin.json.
  previewPane(t, x, pv) {
    if (!x) return empty(t, "Choisis un plugin.");
    const comps = pv && pv !== "…" ? pv.comps : null;
    const risky = comps ? RISKY.filter(([k]) => comps[k].length) : [];
    return v_flex().flex_none().gap(12)
      .child(v_flex().gap(4)
        .child(h_flex().gap(8).items_baseline()
          .child(div().font_family(MONO).text_size(15).font_semibold().text_color(t.foreground).child(x.name))
          .child(div().font_family(MONO).text_size(11.5).text_color(t.dim).child(`@${x.market}${x.version ? ` · ${x.version}` : ""}`)))
        .child(h_flex().flex_wrap().gap(6)
          .child(tag(t, x.remote ? t.muted : t.done, x.remote ? "source distante" : "source locale"))
          .when(Boolean(x.category), (el) => el.child(tag(t, t.dim, x.category)))))
      .child(div().text_size(13).line_height("19px").text_color(x.description ? t.foreground : t.dim).child(x.description || "Pas de description."))
      .child(div().font_family(MONO).text_size(11.5).text_color(t.muted).child(x.dir ? tilde(x.dir) : srcLabel(x.entry?.source ?? "inconnue")))
      .child(warning(t, risky.length ? `${risky.map(([k, l]) => `${comps[k].length} ${l}`).join(", ")} : ${THIRD}` : THIRD))
      .child(pv === "…" ? empty(t, "Lecture du plugin…").p(0)
        : v_flex().gap(10).children(PARTS.filter(([k]) => comps?.[k]?.length).map(([k, label]) => v_flex().gap(6)
          .child(eyebrow(t, `${label} · ${comps[k].length}`, RISKY.some(([r]) => r === k) ? t.blocked : t.muted))
          .child(h_flex().flex_wrap().gap(6).children(comps[k].map((c) => chip(t, `ktp-pv-${x.id}-${k}-${c}`, c, false, null))))))
        .when(!summary(comps), (el) => el.child(div().text_size(12.5).text_color(t.dim)
          .child(x.remote ? "Composants inconnus avant téléchargement (source distante)." : "Aucun composant reconnu dans son dossier."))))
      .child(v_flex().gap(6)
        .child(eyebrow(t, pv?.pjText ? "plugin.json" : "Entrée du catalogue (pas de plugin.json lisible avant installation)"))
        .child(codeBlock(t, `pv-${x.id}`, "json", pv?.pjText ? pretty(pv.pjText) : JSON.stringify(x.entry ?? {}, null, 2))));
  }

  browse(t, cx) {
    const W = this.size?.width ?? 1200, H = this.size?.height ?? 900;
    const all = this.items ?? [];
    const rows = this.rows();
    if (this.hl >= rows.length) this.hl = Math.max(0, rows.length - 1);
    const x = rows[this.hl] ?? null;
    const pv = this.preview(x, cx);
    const page = Math.floor(this.hl / PAGE);
    const slice = rows.slice(page * PAGE, page * PAGE + PAGE);
    const markets = [...new Set(all.map((i) => i.market))];
    const kids = [];
    slice.forEach((r, k) => {
      const i = page * PAGE + k;
      if (k === 0 || slice[k - 1].market !== r.market) kids.push(h_flex().px(8).pt(k ? 12 : 4).pb(4).gap(8).items_center()
        .child(eyebrow(t, r.market).flex_none())
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(this.markets[r.market]?.origin.label ?? ""))
        .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border)));
      if (this.reveal && i === this.hl) { this.scroll.scroll_to_item(kids.length); this.reveal = false; }
      const on = i === this.hl;
      kids.push(v_flex().id(`ktp-av-${r.id}`).px(10).py(8).gap(2).rounded(12).border(1)
        .border_color(on ? alpha(t.accent, this.typing ? "66" : "99") : t.border).bg(on ? alpha(t.accent, "24") : t.background)
        .when(!on, (el) => el.hover((s) => s.bg(t.hover))).cursor_pointer()
        .on_click((_e, cx) => { this.hl = i; cx.notify(); })
        .child(h_flex().gap(8).items_center()
          .child(div().min_w(0).truncate().font_family(MONO).text_size(12.5).font_medium().text_color(t.foreground).child(r.name))
          .when(Boolean(r.version), (el) => el.child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(r.version)))
          .child(div().flex_1())
          .when(r.remote, (el) => el.child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child("DISTANT"))))
        .child(div().truncate().text_size(12).text_color(r.description ? t.muted : t.dim).child(r.description || "Pas de description.")));
    });
    const list = v_flex().w(Math.round(Math.min(1040, W - 80) * 0.44)).flex_none().h_full().min_h(0).gap(6)
      .child(this.fieldBox(t, "search"))
      // The marketplaces (filters.js: one line, scrolling sideways; tab / shift-tab go round them).
      .when(markets.length > 1, (el) => el.child(filterRow({
        id: "ktp-av-mk", state: this.mkRow, t, bg: t.surface, reduced: this.m.reduced,
        items: [{ key: "*", label: "toutes", count: all.length }, ...markets.map((mk) => ({ key: mk, label: mk, count: all.filter((i) => i.market === mk).length, tint: marketTint(mk, this.markets) }))],
        active: this.market ?? "*",
        onPick: (key) => { this.market = key === "*" || key === this.market ? null : key; this.hl = 0; },
      })))
      .child(v_flex().id("ktp-av-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).gap(4)
        .children(kids.length ? kids : [empty(t, this.items === null ? "Lecture des catalogues…" : all.length ? "Aucun plugin ne correspond." : "Toutes les marketplaces connues sont installées.")]))
      .when(rows.length > PAGE, (el) => el.child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim)
        .child(`${page * PAGE + 1}–${page * PAGE + slice.length} sur ${rows.length} · j/k passent d'une page à l'autre`)))
      .when(this.errors.length > 0, (el) => el.child(div().flex_none().text_size(11.5).text_color(t.dim)
        .child(`Catalogue illisible : ${this.errors.join(", ")}.`)));
    const body = h_flex().flex_1().min_h(0).px(12).pb(12).gap(12)
      .child(list)
      .child(v_flex().id("ktp-av-preview").flex_1().min_w(0).h_full().overflow_y_scrollbar().track_scroll(this.side).p(14).rounded(12).border(1).border_color(t.border).bg(t.background)
        .child(this.previewPane(t, x, pv)));
    return this.frame(t, Math.min(1040, W - 80), Math.min(800, H - 80), body,
      this.foot(t, "Installer", !x, x ? null : "Choisis un plugin"));
  }

  marketplaceForm(t) {
    const s = this.source();
    const args = s.arg ? ["plugin", "marketplace", "add", s.arg, "--json"] : null;
    const body = v_flex().flex_none().px(16).pb(14).gap(12)
      .child(h_flex().child(this.kinds(t)))
      .when(this.kind !== "directory", (el) => el.child(this.fieldBox(t, this.kind === "github" ? "git-branch" : "external-link")))
      .when(this.kind === "directory", (el) => el.child(h_flex().gap(8).items_center()
        .child(pill(t, "ktp-mk-pick", this.folder ? "Changer de dossier…" : "Choisir un dossier…", I("folder"), (cx) => cx.spawn(async (cx) => { await this.choose(cx); })))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(12).text_color(this.folder ? t.foreground : t.dim).child(this.folder ? tilde(this.folder) : "aucun dossier"))))
      .when(this.kind === "directory" && Boolean(this.info?.market), (el) => el.child(div().text_size(12.5).text_color(t.muted)
        .child(`Marketplace « ${this.info.market.name ?? "?"} » : ${plural(this.info.plugins.length, "plugin", "plugins")}.`)))
      .when(Boolean(s.why), (el) => el.child(div().text_size(12.5).text_color(t.blocked).child(s.why)))
      .child(this.commandLine(t, args))
      .child(div().text_size(12).text_color(t.dim).child("Ajouter une marketplace n'installe rien : elle rend ses plugins visibles dans Parcourir."));
    return this.frame(t, 600, null, body, this.foot(t, "Ajouter", !args, s.why || "Renseigne une source"));
  }

  folderForm(t, cx) {
    const x = this.folderPick();
    const pv = x ? this.preview(x, cx) : null;
    const lone = this.info && !this.info.market && this.info.plugin;
    const args = x ? ["plugin", "install", x.name, "--marketplace", { path: this.folder }, "--scope", "user", "--json"] : null;
    const W = this.size?.width ?? 1200, H = this.size?.height ?? 900;
    const body = v_flex().id("ktp-folder-body").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.side).px(16).pb(14).gap(12)
      .child(h_flex().gap(8).items_center()
        .child(pill(t, "ktp-folder-pick", this.folder ? "Changer de dossier…" : "Choisir un dossier…", I("folder"), (cx) => cx.spawn(async (cx) => { await this.choose(cx); })))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(12).text_color(this.folder ? t.foreground : t.dim).child(this.folder ? tilde(this.folder) : "aucun dossier")))
      .when(Boolean(this.folder) && !this.info, (el) => el.child(empty(t, "Lecture du dossier…").p(0)))
      .when(Boolean(lone), (el) => el.child(v_flex().gap(8)
        .child(div().text_size(12.5).line_height("18px").text_color(t.blocked)
          .child(`${this.info.plugin?.name ?? "Ce plugin"} n'a pas de .claude-plugin/marketplace.json : claude plugin n'installe que depuis une marketplace, il n'y a pas de sous-commande pour un dossier seul. Pour l'essayer dans une session : claude --plugin-dir (cette session seulement).`))
        .child(pill(t, "ktp-folder-copy", "Copier claude --plugin-dir …", OWN("copy"), (cx) => {
          const cmd = shown(["--plugin-dir", { path: this.folder }]);
          cx.write_to_clipboard(cmd);
          notify({ title: "Copié", body: cmd, level: "success", timeout: 2000 });
        }))))
      .when(Boolean(this.info) && !this.info.market && !this.info.plugin, (el) => el.child(div().text_size(12.5).text_color(t.blocked)
        .child("Ni .claude-plugin/marketplace.json ni .claude-plugin/plugin.json dans ce dossier.")))
      .when((this.info?.plugins.length ?? 0) > 1, (el) => el.child(v_flex().gap(6).child(eyebrow(t, `Ses plugins · ${this.info.plugins.length}`))
        .child(h_flex().flex_wrap().gap(6).children(this.info.plugins.map((e, i) => chip(t, `ktp-folder-p-${e.name}`, e.name, i === this.choice, () => { this.choice = i; }))))))
      .when(Boolean(x), (el) => el.child(this.previewPane(t, x, pv)).child(this.commandLine(t, args)));
    return this.frame(t, Math.min(760, W - 80), this.folder ? Math.min(760, H - 80) : null, body,
      this.foot(t, "Installer", !x, lone ? "Pas de marketplace.json : la CLI ne peut pas l'installer" : "Choisis un dossier"));
  }

  manualForm(t, cx) {
    const m = this.manual();
    const pv = m.x ? this.preview(m.x, cx) : null;
    const args = m.why === null ? ["plugin", "install", m.v, "--scope", "user", "--json"] : null;
    const W = this.size?.width ?? 1200, H = this.size?.height ?? 900;
    const body = v_flex().id("ktp-manual-body").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.side).px(16).pb(14).gap(12)
      .child(this.fieldBox(t, "square-pen"))
      .when(Boolean(m.why), (el) => el.child(div().text_size(12.5).text_color(t.blocked).child(m.why)))
      .when(Boolean(m.note), (el) => el.child(div().text_size(12.5).text_color(t.dim).child(m.note)))
      .when(this.items === null, (el) => el.child(empty(t, "Lecture des catalogues…").p(0)))
      .when(Boolean(m.x), (el) => el.child(this.previewPane(t, m.x, pv)))
      .when(!m.x && Boolean(args), (el) => el.child(warning(t, THIRD)))
      .child(this.commandLine(t, args));
    return this.frame(t, Math.min(760, W - 80), m.x ? Math.min(760, H - 80) : null, body, this.foot(t, "Installer", !args, m.why || "Saisis nom@marketplace"));
  }

  render(cx) {
    const t = theme();
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    if (this.view === "menu") return this.menu(t);
    if (this.view === "browse") return this.browse(t, cx);
    if (this.view === "marketplace") return this.marketplaceForm(t);
    if (this.view === "folder") return this.folderForm(t, cx);
    if (this.view === "manual") return this.manualForm(t, cx);
    return div().child(`Vue inconnue : ${this.view}`);
  }
}
