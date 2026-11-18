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
import { MONO, I, OWN, SPIN, alpha, veil, tilde, eyebrow, dashed, empty, tag, mode, pill, chip, codeBlock, warning,
  band, bandRule, markTile, iconBtn, marketTint } from "./ui.js";
import { bump } from "./bus.js";
import { filterRow, filterState } from "./filters.js";
import { motionState, frame, enter, ink, pulse } from "./motion.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const PAGE = 60;
const RELOAD = () => tr("reload");
const THIRD = () => tr("third");
// The ways to add, in order: [view, glyph]; their words: strings.js' menu.<view> and menu.<view>.sub.
const MENU = [["browse", "layers"], ["marketplace", "plus"], ["folder", "folder"], ["manual", "square-pen"]];
const TITLE = (view) => tr(view === "manual" ? "title.manual" : `menu.${view}`);
const SUB = (view) => tr(`sub.${view}`);
const KINDS = ["github", "git", "directory"]; // strings.js' kind.<key> (GitHub stays GitHub)
const kindName = (k) => (k === "github" ? "GitHub" : tr(`kind.${k}`));
const GLYPH = { browse: "layers", marketplace: "plus", folder: "folder", manual: "square-pen" };
const RISKY = ["hooks", "mcp", "mods"]; // strings.js' risky.<key>
const PARTS = ["skills", "commands", "agents", "hooks", "mcp", "mods", "lsp"]; // strings.js' part.<key>
const comps = (c) => summary(c, (k, n) => tr(`comp.${k}`, { n }));

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
    this.input = InputState.new({ placeholder: ["browse", "manual", "marketplace"].includes(view) ? tr(`holder.${view}`) : "" });
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
        if (this.market && !this.items.some((x) => x.market === this.market)) this.note = tr("noMore", { market: this.market });
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
    if (!isPluginId(v)) return { v, x: null, why: v ? tr("manual.form") : "" };
    const { market } = split(v);
    if (!this.markets[market]) return { v, x: null, why: tr("manual.unknownMarket", { market }) };
    const x = (this.items ?? []).find((i) => i.id === v);
    return { v, x, why: null, note: x ? null : tr("manual.absent", { market }) };
  }

  // marketplace: the source to add, or null (and why).
  source() {
    const v = this.input.value().trim();
    if (this.kind === "github") return isRepo(v) ? { arg: v } : { why: v ? tr("source.repo") : "" };
    if (this.kind === "git") return isGitUrl(v) ? { arg: { url: v } } : { why: v ? tr("source.git") : "" };
    if (!this.folder) return { why: "" };
    if (!this.info) return { why: tr("readingFolder") };
    if (!this.info.market) return { why: tr("source.noMarket") };
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
    const path = await pickFolder({ prompt: tr("choose") });
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
        tr("folder.before", { path: tilde(this.folder), market: x.market }));
    } else if (this.view === "marketplace") {
      const s = this.source();
      if (!s.arg) return;
      const args = ["plugin", "marketplace", "add", s.arg, "--json"];
      this.ask({ label: tr("mk.label"), args, done: tr("mk.done"), then: "browse", topics: ["plugins"] }, tr("mk.title"),
        shown(args), tr("add"),
        { consequence: tr("mk.consequence", { cloned: this.kind === "directory" ? "" : tr("mk.cloned") }) });
    }
  }

  askInstall(x, args, cx, before = "") {
    const pv = x.dir || x.entry ? this.preview(x, cx) : null;
    const parts = pv && pv !== "…" ? pv.comps : null;
    const risky = parts ? RISKY.filter((k) => parts[k].length).map((k) => tr(`risky.${k}`, { n: parts[k].length })) : [];
    const brings = x.remote && !parts?.lsp?.length && !comps(parts)
      ? tr("remote", { src: srcLabel(x.entry?.source ?? tr("unknown")) })
      : tr("brings", { parts: comps(parts) || tr("noParts"), risky: risky.length ? tr("bringsRisky", { list: risky.join(", ") }) : "" });
    // What it brings decides who else re-reads: kt-skills (skills, commands), kt-mcp (MCP); unknown
    // before download (a remote source): both.
    const topics = ["plugins", ...(!parts || parts.skills.length || parts.commands.length ? ["skills"] : []), ...(!parts || parts.mcp.length ? ["mcp"] : [])];
    this.ask({ label: tr("install.label", { id: x.id }), args, done: tr("install.done", { id: x.id }), then: "close", topics }, tr("install.title", { name: x.name }),
      [shown(args), before, brings].filter(Boolean).join("\n\n"), tr("install"), { warning: THIRD(), consequence: RELOAD() });
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
        this.note = why(r.stderr || r.stdout) || tr("code", { code: r.code });
        notify({ level: "error", title: tr("fail", { label: p.label }), body: this.note, timeout: 12000 });
        return void cx.notify();
      }
      notify({ level: "success", title: p.done, body: p.then === "browse" ? tr("opensInBrowse") : RELOAD(), timeout: 5000 });
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
    } else if (this.view === "marketplace") this.setKind(KINDS[(KINDS.indexOf(this.kind) + d + KINDS.length) % KINDS.length]);
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
        .child(h_flex().px(10).pt(6).pb(4).child(eyebrow(t, tr("menu.title"))))
        .children(MENU.map(([view, glyph], i) => {
          const [label, sub] = [tr(`menu.${view}`), tr(`menu.${view}.sub`)];
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
      if (this.items === null) return tr("readingCatalogs");
      const n = new Set(this.items.map((x) => x.market)).size;
      return [tr("available", { n: this.items.length }), tr("marketplaces", { n }), "claude plugin install"].join(" · ");
    }
    return { marketplace: "claude plugin marketplace add <source>", folder: tr("cmd.folder"), manual: tr("cmd.manual") }[this.view] ?? ""; // i18n: tech
  }

  // The source kinds, as segments with an ink gliding to the chosen one (motion.js ink(): left and
  // width move, 240 ms), placed from the segments' measured widths; no ink until they are measured.
  kinds(t) {
    const GAP = 2, PAD = 3;
    const widths = KINDS.map((k) => this.kindW[k] ?? 0);
    const i = KINDS.indexOf(this.kind);
    const ready = widths.every((w) => w > 0);
    const left = PAD + widths.slice(0, i).reduce((s, w) => s + w + GAP, 0);
    return h_flex().id("ktp-kinds").relative().flex_none().h(36).p(PAD).gap(GAP).items_center().rounded(12).border(1).border_color(t.border)
      .when(ready, (el) => el.child(ink(this.m, div().id("ktp-kind-ink").absolute().top(PAD).h(28).left(left).w(widths[i])
        .rounded(9).border(1).border_color(alpha(t.accent, "66")).bg(alpha(t.accent, "24")))))
      .children(KINDS.map((k) => h_flex().id(`ktp-kind-${k}`).h_full().px(11).items_center().rounded(9)
        .text_size(12).text_color(k === this.kind ? t.foreground : t.muted).cursor_pointer()
        .when(k !== this.kind, (el) => el.hover((s) => s.text_color(t.foreground)))
        .on_size_change((size, cx) => { if (Math.abs((this.kindW[k] ?? 0) - size.width) >= 0.5) { this.kindW[k] = size.width; cx.notify(); } })
        .on_click((_e, cx) => { this.setKind(k); cx.notify(); })
        .child(kindName(k))));
  }

  // A dialog: a veil, the card (20) centered, its inner card (16): Crosstalk's band (the page's
  // ansi5 dither, cut inside the inner card's border), the intro, body, foot. The card fades in and
  // rises 6 px when it opens (enter(), inside the veil, which clips).
  frame(t, w, h, body, foot) {
    const tint = t.ansi5;
    const head = band(t, "ktp-add-band", tint, {
      w: this.headW, onW: (w2, cx) => { this.headW = w2; cx.notify(); },
      mark: pulse(this.m, markTile(t, I(GLYPH[this.view] ?? "plus"), tint, this.running ? t.working : null), Boolean(this.running)),
      title: TITLE(this.view), sub: this.subtitle(),
      actions: [mode(t, this.vim.label, this.typing), iconBtn(t, "ktp-add-close", I("x"), tr("closeEsc"), () => this.dismiss())],
    });
    const card = enter(this.m, v_flex(), `ktp-add-card-${this.view}`)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .w(w).when(h != null, (el) => el.h(h)).min_h(0).p(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg().text_size(13)
      .child(v_flex().when(h != null, (el) => el.flex_1()).min_h(0).rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(head)
        .child(bandRule(tint))
        .child(div().flex_none().px(16).pt(10).pb(10).text_size(12.5).line_height("18px").text_color(t.muted).child(SUB(this.view)))
        .child(body)
        .child(dashed(t))
        .child(h_flex().flex_none().px(12).py(10).gap(8).items_center().child(foot)));
    return div().id("ktp-add-veil").size_full().overflow_hidden().flex().items_center().justify_center().bg(veil())
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
      .on_mouse_down("left", () => this.dismiss())
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
      .child(eyebrow(t, tr("command"), t.dim))
      .child(div().px(12).py(8).rounded(12).border(1).border_color(t.border).bg(t.raised).font_family(MONO).text_size(12)
        .text_color(args ? t.foreground : t.dim).child(args ? shown(args) : "—"));
  }

  foot(t, label, off, tip) {
    return h_flex().flex_1().gap(8).items_center()
      .when(Boolean(this.running), (el) => el.child(h_flex().gap(6).items_center().font_family(MONO).text_size(11).text_color(t.working)
        .child(svg(SPIN).size(12).spin(900)).child(`${this.running}…`)))
      .when(!this.running && Boolean(this.note), (el) => el.child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.ansi1).child(this.note)))
      .child(div().flex_1())
      .child(pill(t, "ktp-add-cancel", tr("cancel"), null, () => this.dismiss()))
      .child(pill(t, "ktp-add-go", label, null, (cx) => this.primary(cx), { primary: true, off: off || Boolean(this.running), tip }));
  }

  // What a plugin brings, before installing it: description, source, components, plugin.json.
  previewPane(t, x, pv) {
    if (!x) return empty(t, tr("pickPlugin"));
    const parts = pv && pv !== "…" ? pv.comps : null;
    const risky = parts ? RISKY.filter((k) => parts[k].length) : [];
    return v_flex().flex_none().gap(12)
      .child(v_flex().gap(4)
        .child(h_flex().gap(8).items_baseline()
          .child(div().font_family(MONO).text_size(15).font_semibold().text_color(t.foreground).child(x.name))
          .child(div().font_family(MONO).text_size(11.5).text_color(t.dim).child(`@${x.market}${x.version ? ` · ${x.version}` : ""}`)))
        .child(h_flex().flex_wrap().gap(6)
          .child(tag(t, x.remote ? t.muted : t.done, x.remote ? tr("src.remote") : tr("src.local")))
          .when(Boolean(x.category), (el) => el.child(tag(t, t.dim, x.category)))))
      .child(div().text_size(13).line_height("19px").text_color(x.description ? t.foreground : t.dim).child(x.description || tr("noDescription")))
      .child(div().font_family(MONO).text_size(11.5).text_color(t.muted).child(x.dir ? tilde(x.dir) : srcLabel(x.entry?.source ?? tr("unknown"))))
      .child(warning(t, risky.length ? tr("riskyThird", { list: risky.map((k) => tr(`risky.${k}`, { n: parts[k].length })).join(", "), third: THIRD() }) : THIRD()))
      .child(pv === "…" ? empty(t, tr("readingPlugin")).p(0)
        : v_flex().gap(10).children(PARTS.filter((k) => parts?.[k]?.length).map((k) => v_flex().gap(6)
          .child(eyebrow(t, `${tr(`part.${k}`)} · ${parts[k].length}`, RISKY.includes(k) ? t.blocked : t.muted))
          .child(h_flex().flex_wrap().gap(6).children(parts[k].map((c) => chip(t, `ktp-pv-${x.id}-${k}-${c}`, c, false, null))))))
        .when(!comps(parts), (el) => el.child(div().text_size(12.5).text_color(t.dim)
          .child(x.remote ? tr("compsRemote") : tr("noPartsFolder")))))
      .child(v_flex().gap(6)
        .child(eyebrow(t, pv?.pjText ? "plugin.json" : tr("catalogEntryInstall")))
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
          .when(r.remote, (el) => el.child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child(tr("remoteCaps")))))
        .child(div().truncate().text_size(12).text_color(r.description ? t.muted : t.dim).child(r.description || tr("noDescription"))));
    });
    const list = v_flex().w(Math.round(Math.min(1040, W - 80) * 0.44)).flex_none().h_full().min_h(0).gap(6)
      .child(this.fieldBox(t, "search"))
      // The marketplaces (filters.js: one line, scrolling sideways; tab / shift-tab go round them).
      .when(markets.length > 1, (el) => el.child(filterRow({
        id: "ktp-av-mk", state: this.mkRow, t, bg: t.surface, reduced: this.m.reduced,
        items: [{ key: "*", label: tr("all"), count: all.length }, ...markets.map((mk) => ({ key: mk, label: mk, count: all.filter((i) => i.market === mk).length, tint: marketTint(mk, this.markets) }))],
        active: this.market ?? "*",
        onPick: (key) => { this.market = key === "*" || key === this.market ? null : key; this.hl = 0; },
      })))
      .child(v_flex().id("ktp-av-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).gap(4)
        .children(kids.length ? kids : [empty(t, this.items === null ? tr("readingCatalogsCap") : all.length ? tr("noPluginMatch") : tr("allInstalled"))]))
      .when(rows.length > PAGE, (el) => el.child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim)
        .child(tr("paging", { from: page * PAGE + 1, to: page * PAGE + slice.length, n: rows.length }))))
      .when(this.errors.length > 0, (el) => el.child(div().flex_none().text_size(11.5).text_color(t.dim)
        .child(tr("unreadableCatalog", { list: this.errors.join(", ") }))));
    const body = h_flex().flex_1().min_h(0).px(12).pb(12).gap(12)
      .child(list)
      .child(v_flex().id("ktp-av-preview").flex_1().min_w(0).h_full().overflow_y_scrollbar().track_scroll(this.side).p(14).rounded(12).border(1).border_color(t.border).bg(t.background)
        .child(this.previewPane(t, x, pv)));
    return this.frame(t, Math.min(1040, W - 80), Math.min(800, H - 80), body,
      this.foot(t, tr("install"), !x, x ? null : tr("pickPluginTip")));
  }

  marketplaceForm(t) {
    const s = this.source();
    const args = s.arg ? ["plugin", "marketplace", "add", s.arg, "--json"] : null;
    const body = v_flex().flex_none().px(16).pb(14).gap(12)
      .child(h_flex().child(this.kinds(t)))
      .when(this.kind !== "directory", (el) => el.child(this.fieldBox(t, this.kind === "github" ? "git-branch" : "external-link")))
      .when(this.kind === "directory", (el) => el.child(h_flex().gap(8).items_center()
        .child(pill(t, "ktp-mk-pick", this.folder ? tr("changeFolder") : tr("chooseFolder"), I("folder"), (cx) => cx.spawn(async (cx) => { await this.choose(cx); })))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(12).text_color(this.folder ? t.foreground : t.dim).child(this.folder ? tilde(this.folder) : tr("noFolder")))))
      .when(this.kind === "directory" && Boolean(this.info?.market), (el) => el.child(div().text_size(12.5).text_color(t.muted)
        .child(tr("mk.info", { name: this.info.market.name ?? "?", plugins: tr("plugins", { n: this.info.plugins.length }) }))))
      .when(Boolean(s.why), (el) => el.child(div().text_size(12.5).text_color(t.blocked).child(s.why)))
      .child(this.commandLine(t, args))
      .child(div().text_size(12).text_color(t.dim).child(tr("mk.note")));
    return this.frame(t, 600, null, body, this.foot(t, tr("add"), !args, s.why || tr("mk.tip")));
  }

  folderForm(t, cx) {
    const x = this.folderPick();
    const pv = x ? this.preview(x, cx) : null;
    const lone = this.info && !this.info.market && this.info.plugin;
    const args = x ? ["plugin", "install", x.name, "--marketplace", { path: this.folder }, "--scope", "user", "--json"] : null;
    const W = this.size?.width ?? 1200, H = this.size?.height ?? 900;
    const body = v_flex().id("ktp-folder-body").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.side).px(16).pb(14).gap(12)
      .child(h_flex().gap(8).items_center()
        .child(pill(t, "ktp-folder-pick", this.folder ? tr("changeFolder") : tr("chooseFolder"), I("folder"), (cx) => cx.spawn(async (cx) => { await this.choose(cx); })))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(12).text_color(this.folder ? t.foreground : t.dim).child(this.folder ? tilde(this.folder) : tr("noFolder"))))
      .when(Boolean(this.folder) && !this.info, (el) => el.child(empty(t, tr("readingFolder")).p(0)))
      .when(Boolean(lone), (el) => el.child(v_flex().gap(8)
        .child(div().text_size(12.5).line_height("18px").text_color(t.blocked)
          .child(tr("lone", { name: this.info.plugin?.name ?? tr("thisPlugin") })))
        .child(pill(t, "ktp-folder-copy", tr("copyPluginDir"), OWN("copy"), (cx) => {
          const cmd = shown(["--plugin-dir", { path: this.folder }]);
          cx.write_to_clipboard(cmd);
          notify({ title: tr("copied"), body: cmd, level: "success", timeout: 2000 });
        }))))
      .when(Boolean(this.info) && !this.info.market && !this.info.plugin, (el) => el.child(div().text_size(12.5).text_color(t.blocked)
        .child(tr("neither"))))
      .when((this.info?.plugins.length ?? 0) > 1, (el) => el.child(v_flex().gap(6).child(eyebrow(t, tr("itsPlugins", { n: this.info.plugins.length })))
        .child(h_flex().flex_wrap().gap(6).children(this.info.plugins.map((e, i) => chip(t, `ktp-folder-p-${e.name}`, e.name, i === this.choice, () => { this.choice = i; }))))))
      .when(Boolean(x), (el) => el.child(this.previewPane(t, x, pv)).child(this.commandLine(t, args)));
    return this.frame(t, Math.min(760, W - 80), this.folder ? Math.min(760, H - 80) : null, body,
      this.foot(t, tr("install"), !x, lone ? tr("noMarketTip") : tr("chooseFolderTip")));
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
      .when(this.items === null, (el) => el.child(empty(t, tr("readingCatalogsCap")).p(0)))
      .when(Boolean(m.x), (el) => el.child(this.previewPane(t, m.x, pv)))
      .when(!m.x && Boolean(args), (el) => el.child(warning(t, THIRD())))
      .child(this.commandLine(t, args));
    return this.frame(t, Math.min(760, W - 80), m.x ? Math.min(760, H - 80) : null, body, this.foot(t, tr("install"), !args, m.why || tr("manualTip")));
  }

  render(cx) {
    const t = theme();
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    if (this.view === "menu") return this.menu(t);
    if (this.view === "browse") return this.browse(t, cx);
    if (this.view === "marketplace") return this.marketplaceForm(t);
    if (this.view === "folder") return this.folderForm(t, cx);
    if (this.view === "manual") return this.manualForm(t, cx);
    return div().child(tr("unknownView", { view: this.view }));
  }
}
