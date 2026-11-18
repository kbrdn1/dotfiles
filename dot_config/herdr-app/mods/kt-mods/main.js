// kt-mods, « Mods » : la console des mods de ~/.config/herdr-app, plein écran sur un voile. Le mod.json
// en fait un dialog, frame "none", avec la coquille de kt-usage (le voile, la carte (20), les cartes
// internes (16)). On l'ouvre par run("mod.open", { name: "kt-mods" }) : la sidebar de kt-threads le fait.
//
// Each mod folder, grouped kbrdn (kt-*, kbrdn-*) / Herdr's (installed.json's keys, read only) / others.
// For each one: its description, where it is used (the layouts' blocks and root keys, the mods that open
// it, keys.json), its state (loaded / hidden / on demand / in another layout / unused / error from
// `herdr-app status`), its date, files and weight (Herdr's generated gpui-kit.d.ts and jsconfig.json
// left out), and its copies of the shared modules compared with their reference (model.js SHARED).
// What Herdr really allows, and so all the console does (MOD-OPTIONS.md has the details):
// - a block of the shown layout: layout.hide / layout.show. Its copy stays alive: hidden, not stopped;
// - a root key (toast, terminal_menu) of the shown personal layout: the shipped mod or one of its clones,
//   with a one-line edit of the base file (never the -glass copy, which kt-threads rewrites);
// - kbrdn's shared switches (kt.reducedMotion, kt.density, kt.details) and the options a mod declares
//   in its mod.json (`options`), written to shared("kt.opt.<mod>.<key>");
// - Zed, `herdr-app check`, mod.clone, and deleting one file at a time through kt-confirm (danger),
//   for unused mods in the "others" group only. There is no "disable a mod": nothing in Herdr has one.
//   Renaming a folder breaks whatever names it, and a dotted name crashed the window.
// Reads on open, on r, and (option `watch`) when mods/ or layouts/ change, 2 s settle. Nothing runs
// while it is closed. Keys (vim.js): j/k gg G ctrl-d/u, / search, tab / shift-tab group, [ ] state,
// l / enter the detail (j/k its controls, enter or space acts, h/l change a value, esc back), O Zed,
// v check, D duplicate, dd / x delete, y copy the path, r refresh, q / esc close.
// Tests: `kt-mods.key:<keys>`, `kt-mods.select:<name>`, `kt-mods.normal` (NORMAL mode, list), `kt-mods.refresh`.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import {
  theme, props, closeOverlay, settings, nextCommand, checking, shared, setShared, exec, readTextFile, writeTextFile,
  appHome, run, layout, panes, openOverlay, commands, watchFolder,
} from "herdr";
import * as fs from "fs/promises";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { motionState, frame, enter, pulse, MS } from "./motion.js";
import { ditherBand, TOP, ALL } from "./dither.js";
import { filterState, filterRow, nextKey } from "./filters.js";
import { search } from "./fuzzy.js";
import {
  SAFE, OPT_KEY, GENERATED, SHARED, ROOTS, shippedOf, groupOf, describe, layoutRefs, openersIn, keyRefs, rootChoices, setRootKey,
  deletePlan, size, ago,
} from "./model.js";

const MONO = "Monaspace Krypton";
const TIMEOUT = 15000;
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));
const I = (name) => `mods/kt-mods/${name}.svg`;
const unix = () => Math.floor(Date.now() / 1000);
const clock = (s) => new Date(s * 1000).toTimeString().slice(0, 5);
const run1 = (cmd, args, timeout = TIMEOUT) =>
  exec(cmd, args, { timeout }).catch((e) => ({ code: -1, stdout: "", stderr: String(e?.message ?? e) }));
const parse = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

const GROUPS = [["kbrdn", "kbrdn", "accent"], ["herdr", "Livrés par Herdr", "ansi4"], ["other", "Autres", "ansi3"]];
const STATES = {
  error: ["En erreur", "ansi1"], loaded: ["Chargé", "done"], hidden: ["Masqué", "dim"], demand: ["À la demande", "ansi6"],
  elsewhere: ["Autre layout", "ansi5"], unused: ["Non utilisé", "dim"],
};
const ROLE = { block: "bloc", floating: "bloc flottant", header: "en-tête", toast: "clé racine toast", terminal_menu: "clé racine terminal_menu" };
// The kbrdn switches that already exist: mods read them, and a button writes them elsewhere (except
// kt.reducedMotion, which nobody wrote). kt.themeMode is not one: kt-threads derives the theme from the
// layout and the appearance, and only its setTheme acts. Writing the key alone would do nothing.
const GLOBAL = [
  { key: "kt.reducedMotion", label: "Mouvement réduit", type: "bool", default: false,
    description: "Coupe les transitions, fondus et rebonds non essentiels. Les boucles qui disent un état (working, en attente) restent (ANIMATIONS.md)." },
  { key: "kt.density", label: "Densité des cartes", type: "enum", values: ["detailed", "compact"], labels: ["Détaillée", "Compacte"], default: "detailed",
    description: "Les cartes de threads et d'agents : détaillées, ou sur une ligne de 36 px. C'est le même réglage que le bouton de kt-threads." },
  { key: "kt.details", label: "Carte Détails du thread", type: "bool", default: false,
    description: "La carte flottante à droite du terminal (kt-details). C'est le même réglage que le bouton de kt-head." },
];
const SETTINGS = "__settings"; // the pseudo-row of the kbrdn switches
const ROOT_HOST = "kt-threads"; // its block carries the button that opens this console: never hidden from here

// An option as declared (mod.json `options`), or the reason it's ignored.
function checkOption(o) {
  if (!o || typeof o.key !== "string" || !OPT_KEY.test(o.key)) return "clé absente ou invalide";
  if (o.type === "bool") return null;
  if (o.type === "enum") return Array.isArray(o.values) && o.values.length ? null : "enum sans values";
  if (o.type === "number") return null;
  return `type « ${o.type} » inconnu (bool, enum, number)`;
}
const valueOf = (o, key) => {
  const v = shared(key);
  if (o.type === "bool") return v == null ? Boolean(o.default) : v === true;
  if (o.type === "enum") return o.values.includes(v) ? v : o.default ?? o.values[0];
  if (o.type === "number") return typeof v === "number" ? v : Number(o.default ?? 0);
  return v;
};
// The default is stored as null: whoever reads the key applies it (`shared(k) ?? default`).
const write = (o, key, v) => setShared(key, v === o.default ? null : v);
function bump(o, v, dir) {
  if (o.type === "bool") return !v;
  if (o.type === "enum") return o.values[(o.values.indexOf(v) + dir + o.values.length) % o.values.length];
  const st = Number(o.step ?? 1);
  const lo = o.min ?? -Infinity;
  const hi = o.max ?? Infinity;
  const n = Math.round((v + dir * st) * 1000) / 1000;
  return n > hi ? (Number.isFinite(lo) ? lo : hi) : n < lo ? (Number.isFinite(hi) ? hi : lo) : n;
}
const optText = (o, v) => (o.type === "bool" ? (v ? "oui" : "non") : o.type === "enum" ? o.labels?.[o.values.indexOf(v)] ?? String(v) : String(v));

export default class Mods extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.listScroll = ScrollHandle.new();
    this.detailScroll = ScrollHandle.new();
    this.groups = filterState();
    this.states = filterState();
    this.vim = new Vim({ field: true, insert: true }); // a dialog with a field opens in INSERT (KEYMAP.md)
    this.motion = motionState();
    this.bw = {};
    this.cache = new Map(); // path -> { m: mtime, text }
    this.data = null;
    this.busy = false;
    this.again = false;
    this.error = null;
    this.sel = SETTINGS;
    this.pane = "list";
    this.dcur = 0;
    this.query = "";
    this.group = "all";
    this.state = "all";
    this.out = null; // the last check: { name, busy, ok, text }
    this.note = null; // the last action's word: { name, text, tone }
    this.pending = null; // a delete waiting for kt-confirm
    this.handle.focus();
    for (const ms of [16, 50, 120, 250]) cx.timer.after(ms, () => { if (!this.handle.is_focused()) this.handle.focus(); });
    if (checking()) return;
    this.refresh(cx);
    this.watch(cx, "mods");
    this.watch(cx, "layouts");
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) {
          this.handle.focus();
          for (const k of keysOf(c.slice(4))) this.key(k, cx, true);
        } else if (c.startsWith("select:")) {
          this.sel = c.slice(7);
          this.pane = "list";
          this.reveal = true;
        } else if (c === "normal") { this.vim.normal(); this.pane = "list"; }
        else if (c === "refresh") this.refresh(cx);
        else if (c === "confirmed") this.confirmed(cx);
        cx.notify();
      }
    });
  }

  // Not close(): Herdr calls a view's close(cx) when its overlay goes and on a hot reload (kt-usage).
  dismiss() {
    closeOverlay(props().overlay);
  }

  refresh(cx) {
    if (checking()) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        this.data = await this.load();
        this.error = null;
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      this.busy = false;
      cx.notify();
      if (this.again) { this.again = false; this.refresh(cx); }
    });
  }

  // mods/ and layouts/ changed outside (another agent saves a mod, a click writes layouts/.state):
  // read again after 2 s of calm, while the console is open (closing it cancels the watch).
  watch(cx, sub) {
    cx.spawn(async (cx) => {
      for (;;) {
        try { await watchFolder(`${appHome()}/${sub}`); } catch { return; }
        if (shared("kt.opt.kt-mods.watch") === false) continue;
        await new Promise((done) => cx.timer.after(2000, () => done()));
        this.refresh(cx);
      }
    });
  }

  // A file read again only when its mtime moved.
  async read(path, m) {
    const c = this.cache.get(path);
    if (c && m != null && c.m === m) return c.text;
    const text = await readTextFile(path).catch(() => null);
    this.cache.set(path, { m, text });
    return text;
  }

  // ---------- reading (local; two execs of find/grep and one herdr-app status) ----------

  async load() {
    const H = appHome();
    const M = `${H}/mods`;
    const [st, opens, reads, status, installed, keysTxt, dirents, lnames] = await Promise.all([
      run1("/usr/bin/find", [M, "-mindepth", "2", "-exec", "/usr/bin/stat", "-f", "%Sp %m %z %N", "{}", "+"], 30000),
      run1("/usr/bin/grep", ["-rlE", "openOverlay|mod\\.open", "--include=*.js", M]),
      run1("/usr/bin/grep", ["-roE", "--include=*.js", "shared\\(\"kt\\.[A-Za-z0-9_.-]+\"\\)", M]),
      run1("herdr-app", ["status"]),
      readTextFile(`${H}/installed.json`).catch(() => null),
      readTextFile(`${H}/keys.json`).catch(() => null),
      fs.readdir(M, { withFileTypes: true }),
      fs.readdir(`${H}/layouts`).catch(() => []),
    ]);
    const inst = parse(installed ?? "") ?? {};
    const shipped = shippedOf(inst);
    const shippedLayouts = new Set(Object.keys(inst).filter((k) => k.startsWith("layout:")).map((k) => k.slice(7)));
    const names = dirents.filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name).sort();
    const nameSet = new Set(names);
    const per = Object.fromEntries(names.map((n) => [n, { files: [], dirs: [], own: 0, bytes: 0, mtime: 0, top: new Map() }]));
    const mtimes = new Map();
    const gen = { n: 0, bytes: 0 };
    for (const line of st.stdout.split("\n")) {
      const m = /^(\S+) (\d+) (\d+) (.+)$/.exec(line);
      if (!m || !m[4].startsWith(`${M}/`)) continue;
      const [, perm, mt, sz, p] = m;
      const parts = p.slice(M.length + 1).split("/");
      const e = per[parts[0]];
      if (!e) continue;
      if (perm.startsWith("d")) { e.dirs.push(p); continue; }
      e.files.push(p);
      mtimes.set(p, Number(mt));
      const base = parts.at(-1);
      if (parts.length === 2) e.top.set(base, Number(mt));
      if (parts.length === 2 && GENERATED.has(base)) { gen.n++; gen.bytes += Number(sz); continue; }
      e.own++;
      e.bytes += Number(sz);
      e.mtime = Math.max(e.mtime, Number(mt));
    }

    // Who opens whom: openOverlay({ mod }) and run("mod.open") in every script (a mod opening itself aside).
    const openedBy = {};
    for (const p of opens.stdout.split("\n").filter(Boolean)) {
      const owner = p.slice(M.length + 1).split("/")[0];
      for (const target of openersIn(await this.read(p, mtimes.get(p)))) if (target !== owner) (openedBy[target] ??= new Set()).add(owner);
    }
    // Which shared("kt.…") keys each mod reads, and who reads each key.
    const readsOf = {};
    const readers = {};
    for (const line of reads.stdout.split("\n")) {
      const m = /^([^:]+):shared\("([^"]+)"\)$/.exec(line);
      if (!m || !m[1].startsWith(`${M}/`)) continue;
      const owner = m[1].slice(M.length + 1).split("/")[0];
      (readsOf[owner] ??= new Set()).add(m[2]);
      (readers[m[2]] ??= new Set()).add(owner);
    }

    const layouts = {};
    for (const f of lnames.filter((f) => f.endsWith(".json") && !f.startsWith(".")).sort()) {
      const tree = parse((await readTextFile(`${H}/layouts/${f}`).catch(() => null)) ?? "");
      if (tree) layouts[f.slice(0, -5)] = layoutRefs(f.slice(0, -5), tree);
    }
    const keys = keyRefs(parse(keysTxt ?? "") ?? {}, nameSet, new Set(commands().map((c) => c.name)));

    const s = parse(status.stdout) ?? {};
    const modErr = {};
    const global = [];
    for (const e of s.errors ?? []) {
      const m = /^mod ([^:]+): ([\s\S]*)$/.exec(String(e));
      if (m && nameSet.has(m[1])) modErr[m[1]] = m[2];
      else global.push(String(e));
    }
    if (status.code !== 0) global.push(`herdr-app status : ${status.stderr.trim() || "pas de réponse"}`);
    for (const f of ["layout.error", "keys.error", "settings.error", "programs.error"]) {
      const t = await readTextFile(`${H}/${f}`).catch(() => null);
      if (t) global.push(`${f} : ${t.trim()}`);
    }

    // Reference copies of the shared modules, read once.
    const ref = {};
    for (const [file, owner] of Object.entries(SHARED)) {
      const p = `${M}/${owner}/${file}`;
      ref[file] = per[owner]?.top.has(file) ? await this.read(p, mtimes.get(p)) : null;
    }

    const mods = [];
    for (const name of names) {
      const e = per[name];
      const dir = `${M}/${name}`;
      const jsonTxt = e.top.has("mod.json") ? await this.read(`${dir}/mod.json`, e.top.get("mod.json")) : null;
      const json = jsonTxt == null ? null : parse(jsonTxt);
      const js = e.top.has("main.js") ? await this.read(`${dir}/main.js`, e.top.get("main.js")) : null;
      const copies = [];
      for (const file of Object.keys(SHARED)) {
        if (!e.top.has(file)) continue;
        if (SHARED[file] === name) { copies.push({ file, ref: true }); continue; }
        const text = await this.read(`${dir}/${file}`, e.top.get(file));
        copies.push({ file, ok: ref[file] != null && text === ref[file], noref: ref[file] == null });
      }
      mods.push({
        name, dir, group: groupOf(name, shipped), safe: SAFE.test(name),
        json, jsonError: jsonTxt != null && json === undefined, main: js != null,
        desc: describe(json, js), options: Array.isArray(json?.options) ? json.options : [],
        files: e.files, dirs: e.dirs, own: e.own, bytes: e.bytes, mtime: e.mtime,
        openedBy: [...(openedBy[name] ?? [])].sort(), keys: keys.filter((k) => k.mod === name),
        reads: [...(readsOf[name] ?? [])].sort(), error: modErr[name] ?? null, copies,
      });
    }
    return { at: unix(), mods, layouts, shippedLayouts, gen, global, readers, overlays: s.overlays ?? [] };
  }

  // ---------- live facts (render) ----------

  // The shown layout, its base file (the -glass copy is kt-threads' rewrite of it), and whether it is
  // personal (a shipped layout's structure and root keys are not ours to edit).
  shownLayout() {
    const shown = String(shared("layout") ?? "");
    const base = shown.endsWith("-glass") ? shown.slice(0, -6) : shown;
    const personal = Boolean(base) && Boolean(this.data) && !this.data.shippedLayouts.has(base);
    return { shown, base, personal };
  }

  live(m, liveRefs, shown) {
    const here = liveRefs.filter((r) => r.mod === m.name);
    const elsewhere = Object.entries(this.data.layouts).filter(([l]) => l !== shown).flatMap(([, refs]) => refs.filter((r) => r.mod === m.name));
    const nPanes = panes().filter((p) => p.mod === m.name).length;
    const open = this.data.overlays.includes(m.name);
    const blocks = here.filter((r) => r.role === "block");
    let state;
    if (m.error) state = "error";
    else if (open || nPanes || here.some((r) => r.role !== "block" || (!r.hidden && !r.under))) state = "loaded";
    else if (blocks.length) state = "hidden";
    else if (m.openedBy.length || m.keys.length) state = "demand";
    else if (elsewhere.length) state = "elsewhere";
    else state = "unused";
    const alert = !m.safe || m.copies.some((c) => !c.ref && !c.ok); // an invalid name, or a shared copy that drifted
    return { here, elsewhere, nPanes, open, state, alert };
  }

  rows(t) {
    const { shown } = this.shownLayout();
    const liveRefs = layoutRefs(shown, layout() ?? {});
    const sort = shared("kt.opt.kt-mods.sort") === "recent" ? "recent" : "name";
    const all = this.data.mods.map((m) => ({ ...m, ...this.live(m, liveRefs, shown) }));
    const q = this.query.trim();
    let list = all.filter((m) => (this.group === "all" || m.group === this.group)
      && (this.state === "all" || (this.state === "alert" ? m.alert : m.state === this.state)));
    if (q) {
      list = list.map((m) => ({ m, r: search(q, [m.name, m.desc]) })).filter((x) => x.r)
        .sort((a, b) => b.r.score - a.r.score).map((x) => ({ ...x.m, marks: x.r.marks[0] }));
    } else {
      const order = Object.fromEntries(GROUPS.map(([g], i) => [g, i]));
      list.sort((a, b) => order[a.group] - order[b.group] || (sort === "recent" ? b.mtime - a.mtime : a.name.localeCompare(b.name)));
    }
    const withSettings = !q && this.state === "all" && (this.group === "all" || this.group === "kbrdn");
    return { all, list: withSettings ? [{ name: SETTINGS, group: "kbrdn", settings: true }, ...list] : list, shown, liveRefs };
  }

  // ---------- actions ----------

  say(name, text, tone = "info") {
    this.note = { name, text, tone };
  }

  zed(m) {
    exec("zed", [m.dir], { timeout: TIMEOUT }).then((r) => { if (r.code) this.say(m.name, `Zed : ${r.stderr.trim()}`, "error"); })
      .catch((e) => this.say(m.name, `Zed : ${e?.message ?? e}`, "error"));
  }

  copyPath(m) {
    exec("/bin/sh", ["-c", "printf %s \"$1\" | pbcopy", "sh", m.dir], { timeout: TIMEOUT }).catch(() => {});
    this.say(m.name, `Chemin copié : ${m.dir.replace(appHome(), "~/.config/herdr-app")}`);
  }

  check(m, cx) {
    if (this.out?.busy || !m.safe) return;
    this.out = { name: m.name, busy: true, text: "" };
    cx.notify();
    cx.spawn(async (cx) => {
      const r = await run1("herdr-app", ["check", m.dir], 60000);
      this.out = { name: m.name, busy: false, ok: r.code === 0, text: `${r.stdout}${r.stderr}`.trim() || `code ${r.code}` };
      cx.notify();
    });
  }

  // mod.clone under a free name (<name>-copy, -copy-2…), through herdr-app to get its answer. A folder
  // Herdr has never seen docks one copy per mod.json into the shown layout unless place is "none".
  clone(m, cx) {
    if (!m.safe) return this.say(m.name, "Nom invalide (hors [a-z0-9-]), peut faire planter Herdr : pas de duplication d'ici.", "error");
    if ((m.json?.place ?? "none") !== "none") return this.say(m.name, `place « ${m.json.place} » : le clone s'ancrerait dans le layout affiché. Duplique-le à la main.`, "error");
    const taken = new Set(this.data.mods.map((x) => x.name));
    let as = `${m.name}-copy`;
    for (let i = 2; taken.has(as); i++) as = `${m.name}-copy-${i}`;
    cx.spawn(async (cx) => {
      const r = await run1("herdr-app", ["do", "mod.clone", "--name", m.name, "--as", as]);
      const ans = parse(r.stdout);
      if (r.code || ans?.error) this.say(m.name, `Duplication refusée : ${ans?.error ?? r.stderr.trim()}`, "error");
      else { this.say(as, `Copie de ${m.name}. Elle est à toi : Herdr ne la met jamais à jour.`, "success"); this.sel = as; this.reveal = true; }
      this.refresh(cx);
      cx.notify();
    });
  }

  // A block of the shown layout: layout.hide / layout.show (kept in layouts/.state). Its copy keeps running.
  toggleBlock(m, r) {
    if (m.name === ROOT_HOST) return this.say(m.name, "Ce bloc porte le bouton de cette console : il ne se masque pas d'ici.", "error");
    run(r.hidden ? "layout.show" : "layout.hide", { id: r.id });
    this.say(m.name, `${r.hidden ? "Montré" : "Masqué"} : bloc « ${r.id} ». ${r.hidden ? "" : "Le mod continue de tourner, caché."}`);
  }

  // A root key of the shown personal layout: one line of its base file, written only if the file is
  // unchanged since the read (writeTextFile's expected text), then layout.error checked.
  setRoot(key, value, name, cx) {
    const { base, personal } = this.shownLayout();
    if (!personal) return this.say(name, "Layout livré par Herdr : ses clés racines ne s'éditent pas. Clone-le d'abord.", "error");
    if (!SAFE.test(value)) return;
    cx.spawn(async (cx) => {
      const H = appHome();
      const path = `${H}/layouts/${base}.json`;
      try {
        const text = await readTextFile(path);
        const next = text == null ? null : setRootKey(text, key, value);
        if (!next) throw new Error("édition non prouvée sûre, rien n'est écrit");
        if (next !== text) await writeTextFile(path, next, text);
        await new Promise((done) => cx.timer.after(900, () => done()));
        const err = await readTextFile(`${H}/layout.error`).catch(() => null);
        if (err) this.say(name, `layout.error : ${err.trim()}`, "error");
        else this.say(name, `${base}.json : « ${key} » vaut « ${value} ». Pas de layout.error.${shared("layout") !== base ? " La copie glass suit, réécrite par kt-threads." : ""}`, "success");
      } catch (e) {
        this.say(name, `${key} : ${e?.message ?? e}`, "error");
      }
      this.refresh(cx);
      cx.notify();
    });
  }

  // Delete: only an unused mod of the "others" group with a safe name. kt-confirm (danger) lists every
  // file, then the files go one by one, deepest first, then the folders. The list is read again at
  // confirm time and must not have changed.
  deletable(m) {
    return Boolean(m && !m.settings && m.group === "other" && m.state === "unused" && m.safe && !m.open && !m.nPanes);
  }

  async listing(dir) {
    const r = await run1("/usr/bin/find", [dir, "-mindepth", "1", "-exec", "/usr/bin/stat", "-f", "%Sp %N", "{}", "+"]);
    const files = [];
    const dirs = [];
    for (const line of r.stdout.split("\n")) {
      const m = /^(\S+) (.+)$/.exec(line);
      if (m) (m[1].startsWith("d") ? dirs : files).push(m[2]);
    }
    return deletePlan(dir, files, dirs);
  }

  askDelete(m, cx) {
    if (!this.deletable(m)) {
      const why = m.group !== "other" ? "seuls les mods du groupe Autres se suppriment d'ici" : "il est utilisé (layout, mod, touche ou overlay ouvert)";
      return this.say(m.name, `Suppression refusée : ${why}.`, "error");
    }
    cx.spawn(async (cx) => {
      const plan = await this.listing(m.dir);
      if (!plan) { this.say(m.name, "Un chemin sort du dossier : rien n'est supprimé.", "error"); cx.notify(); return; }
      this.pending = { name: m.name, dir: m.dir, sig: JSON.stringify(plan) };
      const rel = (p) => p.slice(m.dir.length + 1);
      openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: {
        title: `Supprimer « ${m.name} » ?`,
        detail: `Le dossier mods/${m.name} et ses ${plural(plan.files.length, "fichier", "fichiers")}, un par un. Aucun layout, mod ni touche ne le nomme, et il n'est pas ouvert.`,
        items: [...plan.files.map((p) => ({ label: rel(p) })), ...plan.dirs.map((p) => ({ label: p === m.dir ? `mods/${m.name}/` : `${rel(p)}/`, detail: "dossier" }))],
        consequence: "C'est définitif : rien ne part à la corbeille.",
        label: "Supprimer", danger: true, command: { name: "kt-mods.confirmed" },
      } });
      cx.notify();
    });
  }

  confirmed(cx) {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    cx.spawn(async (cx) => {
      const plan = await this.listing(p.dir);
      const m = this.data.mods.find((x) => x.name === p.name);
      const row = m && this.rows(theme()).all.find((x) => x.name === p.name);
      if (!plan || JSON.stringify(plan) !== p.sig || !this.deletable(row)) {
        this.say(p.name, "Le dossier ou son usage a changé depuis la confirmation : rien n'est supprimé.", "error");
        cx.notify();
        return;
      }
      let done = 0;
      try {
        for (const f of plan.files) { await fs.unlink(f); done++; }
        for (const d of plan.dirs) await fs.rmdir(d);
        this.say(p.name, `Supprimé : ${plural(done, "fichier", "fichiers")}, puis le dossier.`, "success");
      } catch (e) {
        this.say(p.name, `Arrêt après ${done} fichier(s) : ${e?.message ?? e}`, "error");
      }
      this.refresh(cx);
      cx.notify();
    });
  }

  // ---------- keys ----------

  // The detail's controls, built by render: [{ act(cx), adjust?(dir, cx) }].
  key(e, cx, fromCommand = false) {
    if (this.data) this.prepare(theme(), unix(), this.m ?? frame(this.motion, Boolean(shared("kt.reducedMotion"))));
    const k = keyOf(e).name;
    const a = this.vim.handle(e);
    const rows = this.view?.list ?? [];
    const i = Math.max(0, rows.findIndex((r) => r.name === this.sel));
    const m = this.view?.sel;
    const ctl = this.view?.ctl ?? [];
    let used = true;
    if (this.vim.insert || a === "normal") {
      if (a === "type") { this.query += this.vim.char; this.sel = null; }
      else if (a === "backspace") { this.query = [...this.query].slice(0, -1).join(""); this.sel = null; }
      else if (a === "down" || a === "up") this.move(a, rows, i);
      else if (a === "submit") { this.vim.normal(); if (ctl.length) { this.pane = "detail"; this.dcur = 0; } }
      else if (a === "tab-next" || a === "tab-prev") this.cycleGroup(a === "tab-next" ? 1 : -1);
      else if (a !== "normal") used = false;
    } else if (a === "pending" || a === "count") {
      // gg / dd / a count being typed
    } else if (a === "quit") this.dismiss();
    else if (a === "escape") {
      if (this.pane === "detail") this.pane = "list";
      else if (this.query) this.query = "";
      else this.dismiss();
    } else if (a === "filter") this.pane = "list";
    else if (a === "refresh") this.refresh(cx);
    else if (a === "tab-next" || a === "tab-prev") this.cycleGroup(a === "tab-next" ? 1 : -1);
    else if (a === "panel-next" || a === "panel-prev") this.state = nextKey(this.view?.stateItems ?? [], this.state, a === "panel-next" ? 1 : -1) ?? "all";
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else if (m && !m.settings && a === "open-alt") this.zed(m);
    else if (m && !m.settings && a === "yank") this.copyPath(m);
    else if (m && !m.settings && a === "delete") this.askDelete(m, cx);
    else if (m && !m.settings && k === "v") this.check(m, cx);
    else if (m && !m.settings && k === "D") this.clone(m, cx);
    else if (this.pane === "list") {
      if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) this.move(a, rows, i);
      else if ((a === "open" || a === "right") && ctl.length) { this.pane = "detail"; this.dcur = 0; }
      else used = false;
    } else {
      const c = ctl[Math.min(this.dcur, ctl.length - 1)];
      if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) this.dcur = step(a, this.dcur, ctl.length, this.vim.count, 8);
      else if (a === "open" || k === "space") c?.act(cx);
      else if (a === "left" || a === "right") {
        if (c?.adjust) c.adjust(a === "right" ? 1 : -1, cx);
        else if (a === "left") this.pane = "list";
      } else used = false;
    }
    if (!used && !fromCommand) return; // not ours: ctrl-b, cmd-* go on
    if (!fromCommand) cx.stop_propagation();
    cx.notify();
  }

  move(a, rows, i) {
    const j = step(a, i, rows.length, this.vim.count, 12);
    if (j >= 0) this.sel = rows[j].name;
    this.reveal = true;
  }

  cycleGroup(dir) {
    this.group = nextKey(this.view?.groupItems ?? [], this.group, dir) ?? "all";
  }

  // ---------- drawing ----------

  iconBtn(t, id, icon, tip, fn) {
    return div().id(id).size(28).flex_none().rounded_full().flex().items_center().justify_center().text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(alpha(t.foreground, "14")).text_color(t.foreground)).tooltip(tip)
      .on_click((_e, cx) => { cx.stop_propagation(); fn(cx); cx.notify(); })
      .child(svg(icon).size(14));
  }

  // kt-usage's 60 px band: the shared dither in `tint`, inside the card's border, then mark, title, sub.
  band(t, { id, tint, mark, title, sub, buttons = [], rounded = "top" }) {
    const el = div().id(id).relative().flex_none().h(60).overflow_hidden()
      .on_size_change((sz, cx) => { if (this.bw[id] !== sz.width) { this.bw[id] = sz.width; cx.notify(); } });
    const layer = ditherBand(this.bw[id], 60, 15, alpha(tint, settings().dark ? "6b" : "4d"), rounded === "top" ? TOP : ALL);
    return (rounded === "top" ? el.rounded_t(15) : el.rounded(15))
      .when(Boolean(layer), (e) => e.child(layer))
      .child(h_flex().size_full().px(12).gap(10).items_center()
        .child(mark)
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(title))
          .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(sub)))
        .children(buttons));
  }

  mark(t, icon, tint) {
    return div().flex_none().size(32).rounded(10).border(1).border_color(alpha(tint, "4d")).bg(alpha(tint, "1a"))
      .flex().items_center().justify_center().child(svg(icon).size(17).text_color(tint));
  }

  pill(t, text, tint) {
    return div().flex_none().h(18).px(7).flex().items_center().rounded_full().border(1)
      .border_color(alpha(tint, "4d")).bg(alpha(tint, "1a")).font_family(MONO).text_size(9.5).text_color(tint).child(text);
  }

  eyebrow(t, text) {
    return h_flex().pt(6).gap(10).items_center()
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child(text.toUpperCase()))
      .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border));
  }

  // A name with the search's matched characters in accent.
  marked(t, text, marks, color) {
    if (!marks?.size) return div().truncate().child(text);
    const runs = [];
    [...text].forEach((ch, i) => {
      const hi = marks.has(i);
      if (runs.length && runs.at(-1).hi === hi) runs.at(-1).s += ch;
      else runs.push({ hi, s: ch });
    });
    return h_flex().min_w(0).overflow_hidden().children(runs.map((r) => div().flex_none().text_color(r.hi ? t.accent : color).child(r.s)));
  }

  row(t, m, now) {
    const on = m.name === this.sel;
    const focusList = this.pane === "list";
    const base = div().id(`km-r-${m.name}`).flex_none().h(34).px(10).gap(10).flex().items_center().rounded(12).border(1)
      .border_color(on ? alpha(t.accent, focusList ? "66" : "33") : alpha(t.accent, "00"))
      .when(on, (el) => el.bg(alpha(t.accent, focusList ? "24" : "14")))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .cursor_pointer()
      .on_click((_e, cx) => { this.sel = m.name; this.pane = "list"; this.handle.focus(); cx.notify(); });
    if (m.settings) {
      return base.child(svg(I("settings")).size(13).text_color(t.accent))
        .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(on ? t.foreground : t.muted).child("Réglages kbrdn"))
        .child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child(plural(GLOBAL.length, "interrupteur", "interrupteurs")));
    }
    const [label, tint] = STATES[m.state];
    return base.tooltip(`${label}${m.error ? ` : ${m.error}` : ""}`)
      .child(div().flex_none().size(7).rounded_full().bg(t[tint] ?? t.dim))
      .child(div().w(150).flex_none().min_w(0).font_family(MONO).text_size(12).text_color(on ? t.foreground : t.muted)
        .child(this.marked(t, m.name, m.marks, on ? t.foreground : t.muted)))
      .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(m.desc || "—"))
      .when(m.alert, (el) => el.child(svg(I("circle-alert")).size(13).text_color(t.blocked)))
      .when(!m.safe, (el) => el.child(this.pill(t, "NOM INVALIDE", t.ansi1)))
      .child(div().w(52).flex_none().text_right().whitespace_nowrap().font_family(MONO).text_size(10).text_color(t.dim)
        .child(m.mtime ? ago(m.mtime, now).replace(/^il y a /, "").replace("à l'instant", "< 1 min") : ""));
  }

  // A detail control row: the cursor draws its border accent; a click acts.
  ctlRow(t, i, children, act) {
    const on = this.pane === "detail" && this.dcur === i;
    return h_flex().id(`km-c-${i}`).min_h(34).px(10).py(4).gap(10).items_center().rounded(12).border(1)
      .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00")).when(on, (el) => el.bg(alpha(t.accent, "1a")))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover))).cursor_pointer()
      .on_click((_e, cx) => { this.pane = "detail"; this.dcur = i; act(cx); this.handle.focus(); cx.notify(); })
      .children(children);
  }

  toggle(t, id, on, reduced) {
    return div().flex_none().w(30).h(18).rounded_full().relative().bg(on ? t.accent : t.border)
      .child(div().id(id).absolute().top(2).left(on ? 14 : 2).size(14).rounded_full().bg(on ? t.accent_foreground : t.background)
        .when(!reduced, (el) => el.transition("left", { duration: MS.hover, easing: "ease-out" })));
  }

  segmented(t, idPre, values, labels, cur, pick) {
    return h_flex().flex_none().p(2).gap(2).rounded_full().border(1).border_color(t.border).bg(t.background)
      .children(values.map((v, k) => div().id(`${idPre}-${v}`).h(22).px(9).flex().items_center().rounded_full()
        .bg(v === cur ? alpha(t.accent, "33") : alpha(t.accent, "00")).text_size(11.5)
        .text_color(v === cur ? t.foreground : t.muted).cursor_pointer().hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => { cx.stop_propagation(); pick(v, cx); cx.notify(); })
        .child(labels?.[k] ?? v)));
  }

  // One option (a kbrdn switch or a mod's): its control, label, description, and who reads its key.
  option(t, i, o, key, readers, reduced, ctl) {
    const v = valueOf(o, key);
    const act = () => write(o, key, bump(o, v, 1));
    ctl.push({ act, adjust: o.type === "bool" ? null : (dir) => write(o, key, bump(o, v, dir)) });
    const control = o.type === "bool" ? this.toggle(t, `km-sw-${key}`, v, reduced)
      : o.type === "enum" ? this.segmented(t, `km-seg-${key}`, o.values, o.labels, v, (x) => write(o, key, x))
      : h_flex().flex_none().gap(6).items_center()
        .child(this.iconText(t, `km-n-${key}-m`, "−", () => write(o, key, bump(o, v, -1))))
        .child(div().w(48).text_center().font_family(MONO).text_size(12).text_color(t.foreground).child(String(v)))
        .child(this.iconText(t, `km-n-${key}-p`, "+", () => write(o, key, bump(o, v, 1))));
    const rs = [...(readers ?? [])].sort();
    const who = !rs.length ? "lu par aucun mod" : rs.length > 6 ? `lu par ${rs.length} mods (${rs.slice(0, 5).join(", ")}…)` : `lu par ${rs.join(", ")}`;
    return this.ctlRow(t, i, [
      v_flex().flex_1().min_w(0).gap(2)
        .child(h_flex().gap(8).items_center()
          .child(div().text_size(12.5).text_color(t.foreground).child(o.label ?? o.key))
          .child(div().font_family(MONO).text_size(10).text_color(readers?.size ? t.dim : t.blocked).child(key)))
        .when(Boolean(o.description), (el) => el.child(div().text_size(11).text_color(t.dim).child(o.description)))
        .child(div().font_family(MONO).text_size(10).text_color(readers?.size ? t.dim : t.blocked).child(`${who} · ${shared(key) == null ? "défaut" : "réglé"} : ${optText(o, v)}`)),
      control,
    ], act);
  }

  iconText(t, id, text, fn) {
    return div().id(id).size(22).flex_none().rounded_full().border(1).border_color(t.border).flex().items_center().justify_center()
      .font_family(MONO).text_size(12).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); fn(cx); cx.notify(); }).child(text);
  }

  action(t, i, icon, label, hint, act, ctl, tone) {
    ctl.push({ act });
    const on = this.pane === "detail" && this.dcur === i;
    const c = tone ? t[tone] : t.foreground;
    return h_flex().id(`km-a-${i}`).flex_none().h(30).px(12).gap(7).items_center().rounded_full().border(1)
      .border_color(on ? alpha(t.accent, "99") : tone ? alpha(c, "66") : t.border).bg(on ? alpha(t.accent, "24") : t.background)
      .cursor_pointer().hover((s) => s.bg(t.hover)).tooltip(hint)
      .on_click((_e, cx) => { cx.stop_propagation(); this.pane = "detail"; this.dcur = i; act(cx); cx.notify(); })
      .child(svg(I(icon)).size(13).text_color(tone ? c : t.muted))
      .child(div().text_size(12).text_color(c).child(label));
  }

  line(t, label, text, color) {
    return h_flex().px(10).gap(10).items_start()
      .child(div().w(112).flex_none().text_size(11.5).text_color(t.muted).child(label))
      .child(div().flex_1().min_w(0).text_size(11.5).text_color(color ?? t.dim).child(text));
  }

  settingsDetail(t, reduced) {
    const ctl = [];
    const body = [
      div().px(10).text_size(12).text_color(t.dim).child("Les interrupteurs kbrdn qui existent déjà : des mods les lisent, et la console les écrit comme leurs propres boutons. La valeur par défaut est stockée en null, et c'est le mod qui lit la clé qui l'applique."),
      this.eyebrow(t, "Interrupteurs"),
      ...GLOBAL.map((o, i) => this.option(t, i, o, o.key, this.data.readers[o.key], reduced, ctl)),
      this.eyebrow(t, "Ce qui n'est pas ici"),
      this.line(t, "kt.themeMode", "Pas un interrupteur : il ne fait que mémoriser le dernier choix. Le thème vient du layout et de l'apparence, et c'est le sélecteur en bas de la sidebar qui l'applique."),
      this.line(t, "Options de mod", "Chaque mod déclare les siennes dans son mod.json (options) : elles apparaissent sur sa fiche. Convention : data/orchestrator/MOD-OPTIONS.md."),
    ];
    return { ctl, el: this.card(t, "km-d-settings", t.accent, this.mark(t, I("settings"), t.accent), "Réglages kbrdn", "shared(…) · lus en direct par les mods", body) };
  }

  card(t, id, tint, mark, title, sub, body, buttons = []) {
    return v_flex().rounded(16).bg(t.surface).border(1).border_color(t.border)
      .child(this.band(t, { id: `${id}-band`, tint, mark, title, sub, buttons }))
      .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(tint, "4d")))
      .child(v_flex().p(10).gap(8).children(body));
  }

  detail(t, m, view, now, reduced) {
    if (m.settings) return this.settingsDetail(t, reduced);
    const ctl = [];
    const body = [];
    const tint = m.error ? t.ansi1 : t[GROUPS.find(([g]) => g === m.group)[2]];
    const [stLabel, stTint] = STATES[m.state];
    const { base, personal, shown } = this.shownLayout();
    if (this.note?.name === m.name) {
      const c = this.note.tone === "error" ? t.ansi1 : this.note.tone === "success" ? t.done : t.accent;
      body.push(h_flex().px(10).py(6).gap(8).items_start().rounded(10).bg(alpha(c, "14")).border(1).border_color(alpha(c, "4d"))
        .child(svg(I(this.note.tone === "error" ? "circle-alert" : "circle-check")).size(13).text_color(c))
        .child(div().flex_1().min_w(0).text_size(11.5).text_color(t.foreground).child(this.note.text)));
    }
    body.push(div().px(10).text_size(12.5).text_color(m.desc ? t.foreground : t.dim).child(m.desc || "Pas de description : ni description dans mod.json, ni commentaire d'en-tête dans main.js."));
    body.push(h_flex().px(10).gap(8).items_center().flex_wrap()
      .child(this.pill(t, stLabel.toUpperCase(), t[stTint] ?? t.dim))
      .when(m.group === "herdr", (el) => el.child(this.pill(t, "LECTURE SEULE", t.ansi4)))
      .when(Boolean(m.json?.cloned_from), (el) => el.child(this.pill(t, `CLONE DE ${m.json.cloned_from.name}`, t.ansi5)))
      .when(!m.safe, (el) => el.child(this.pill(t, "NOM INVALIDE", t.ansi1))));
    if (!m.safe) body.push(div().mx(10).px(10).py(6).rounded(10).bg(alpha(t.ansi1, "14")).text_size(11.5).text_color(t.ansi1)
      .child("Nom invalide, peut faire planter Herdr : un nom de mod s'écrit en [a-z0-9-]. Un point a fait planter la fenêtre à l'ouverture en overlay (le 2026-11-18). La console ne l'ouvre, ne le vérifie, ne le duplique et ne le supprime pas : renomme le dossier à la main, Herdr fermé ou le mod non utilisé."));
    if (m.error) body.push(div().mx(10).px(10).py(6).rounded(10).bg(alpha(t.ansi1, "14")).font_family(MONO).text_size(10.5).text_color(t.ansi1).child(m.error));
    if (m.group === "herdr") body.push(div().px(10).text_size(11.5).text_color(t.dim).child("Livré par Herdr : remplacé à chaque démarrage, une modification partirait dans <nom>-edited. Pour le changer, il faut le dupliquer."));
    if (m.jsonError) body.push(div().px(10).text_size(11.5).text_color(t.ansi1).child("mod.json illisible : JSON invalide."));

    // Where it is used.
    body.push(this.eyebrow(t, "Où il sert"));
    let used = 0;
    for (const r of view.here) {
      used++;
      if (r.role === "block" && r.hideable) {
        const i = ctl.length;
        const prot = m.name === ROOT_HOST;
        ctl.push({ act: () => this.toggleBlock(m, r) });
        body.push(this.ctlRow(t, i, [
          v_flex().flex_1().min_w(0).gap(2)
            .child(div().text_size(12).text_color(t.foreground).child(`${shown} · bloc « ${r.id} »`))
            .child(div().text_size(10.5).text_color(t.dim).child(prot ? "Porte le bouton de cette console : non masquable d'ici."
              : r.hidden ? "Masqué (layout.hide). Le mod tourne encore, caché."
              : r.under ? "Son conteneur est masqué (un panneau replié) : il ne se voit pas, même affiché."
              : "Affiché. Masquer le cache (layout.hide), sans l'arrêter.")),
          prot ? div() : this.toggle(t, `km-hide-${r.id}`, !r.hidden, reduced),
        ], () => this.toggleBlock(m, r)));
      } else if ((r.role === "toast" || r.role === "terminal_menu") && !r.implicit && personal) {
        // handled below with the choices
      } else {
        const why = r.role === "block" ? (r.id ? "enfant d'une stack : il se montre par layout.select" : "bloc sans id")
          : r.role === "floating" ? "flottant : layout.hide ne l'atteint pas" : r.implicit ? "par défaut (clé non réglée)" : "";
        body.push(this.line(t, `${shown}`, `${ROLE[r.role] ?? r.role}${r.id ? ` « ${r.id} »` : ""}${why ? ` · ${why}` : ""}`, t.foreground));
      }
    }
    // Root keys of the shown personal layout this mod can fill: the shipped one or one of its clones.
    if (personal) {
      const tree = layout() ?? {};
      for (const key of Object.keys(ROOTS)) {
        const cur = typeof tree[key] === "string" && tree[key] ? tree[key] : ROOTS[key];
        const choices = rootChoices(key, this.data.mods, cur);
        if (!choices.includes(m.name) || choices.length < 2) continue;
        used++;
        const i = ctl.length;
        const pick = (v, cx) => { if (v !== cur) this.setRoot(key, v, m.name, cx); };
        ctl.push({ act: (cx) => pick(choices[(choices.indexOf(cur) + 1) % choices.length], cx),
          adjust: (dir, cx) => pick(choices[(choices.indexOf(cur) + dir + choices.length) % choices.length], cx) });
        body.push(this.ctlRow(t, i, [
          v_flex().flex_1().min_w(0).gap(2)
            .child(div().text_size(12).text_color(t.foreground).child(`${base} · clé racine « ${key} »`))
            .child(div().text_size(10.5).text_color(t.dim).child(`Le mod qui dessine ${key === "toast" ? "les notifications" : "le menu du clic droit d'un terminal"}. Une ligne de layouts/${base}.json change, si le fichier n'a pas bougé entre-temps.`)),
          this.segmented(t, `km-root-${key}`, choices, choices, cur, pick),
        ], ctl[i].act));
      }
    }
    for (const r of view.elsewhere) {
      used++;
      body.push(this.line(t, r.layout, `${ROLE[r.role] ?? r.role}${r.id ? ` « ${r.id} »` : ""}${r.implicit ? " · par défaut" : ""}`));
    }
    if (m.openedBy.length) { used++; body.push(this.line(t, "Ouvert par", m.openedBy.join(", "), t.foreground)); }
    for (const k of m.keys) { used++; body.push(this.line(t, "Touche", `${k.keys} · ${k.section} · ${k.action}`, t.foreground)); }
    if (view.nPanes) { used++; body.push(this.line(t, "Panes", plural(view.nPanes, "pane mod ouvert", "panes mod ouverts"), t.foreground)); }
    if (view.open) { used++; body.push(this.line(t, "Overlay", "ouvert en ce moment", t.foreground)); }
    if (!used) body.push(div().px(10).text_size(11.5).text_color(t.dim).child("Nulle part : aucun layout, aucun mod qui l'ouvre, aucune touche."));

    // Shared modules.
    if (m.copies.length) {
      body.push(this.eyebrow(t, "Modules partagés"));
      body.push(h_flex().px(10).gap(6).flex_wrap().children(m.copies.map((c) =>
        c.ref ? this.pill(t, `${c.file} · RÉFÉRENCE`, t.accent)
          : c.ok ? this.pill(t, `${c.file} ✓`, t.done)
          : this.pill(t, `${c.file} ≠ ${SHARED[c.file]}`, c.noref ? t.dim : t.ansi1))));
      const drift = [...new Set(m.copies.filter((c) => !c.ref && !c.ok).map((c) => SHARED[c.file]))];
      if (drift.length) body.push(div().px(10).text_size(11).text_color(t.ansi1).child(`Copie divergente : elle n'est plus identique à celle de ${drift.join(", ")}. Recopier la référence à l'identique (cp, puis cmp).`));
    }

    // Options: mod.json `options` (MOD-OPTIONS.md), written to shared("kt.opt.<mod>.<key>").
    body.push(this.eyebrow(t, "Options"));
    const opts = m.options.map((o) => ({ o, why: checkOption(o) }));
    if (!opts.length) body.push(div().px(10).text_size(11.5).text_color(t.dim).child(m.group === "herdr" ? "Un mod livré n'a pas d'options kbrdn." : "Aucune option déclarée dans mod.json (convention : MOD-OPTIONS.md)."));
    for (const { o, why } of opts) {
      if (why) { body.push(this.line(t, String(o?.key ?? "?"), `ignorée : ${why}`, t.ansi1)); continue; }
      const key = `kt.opt.${m.name}.${o.key}`;
      body.push(this.option(t, ctl.length, o, key, this.data.readers[key], reduced, ctl));
    }
    if (m.reads.length) body.push(this.line(t, "Lit", m.reads.join(" · ")));

    // Actions.
    body.push(this.eyebrow(t, "Actions"));
    const acts = [this.action(t, ctl.length, "external-link", "Zed", "Ouvrir le dossier dans Zed (O)", () => this.zed(m), ctl)];
    if (m.safe) acts.push(this.action(t, ctl.length, "circle-check", "Vérifier", "herdr-app check mods/<nom> (v)", (cx) => this.check(m, cx), ctl));
    if (m.safe) acts.push(this.action(t, ctl.length, "copy", "Dupliquer", "mod.clone, sous un nom libre (D)", (cx) => this.clone(m, cx), ctl));
    const del = this.deletable({ ...m, ...view });
    if (del) acts.push(this.action(t, ctl.length, "trash-2", "Supprimer", "Fichier par fichier, après confirmation (dd)", (cx) => this.askDelete({ ...m, ...view }, cx), ctl, "ansi1"));
    body.push(h_flex().px(10).gap(8).flex_wrap().children(acts));
    body.push(div().px(10).text_size(10.5).text_color(t.dim).child(
      `Pas de « Recharger » : Herdr n'a pas de commande pour ça. Il recharge un mod quand un de ses fichiers est enregistré, et la console ne touche pas aux fichiers pour ça.${del ? "" : m.group === "other" ? " Supprimer : seulement quand le mod n'est utilisé nulle part." : " Supprimer : seulement pour le groupe Autres."}`));
    if (this.out?.name === m.name) {
      body.push(pulse(this.m, div().id("km-out").mx(10).px(10).py(8).rounded(10).border(1)
        .border_color(this.out.busy ? t.border : alpha(this.out.ok ? t.done : t.ansi1, "66")).bg(t.background)
        .font_family(MONO).text_size(10.5).text_color(this.out.busy ? t.dim : this.out.ok ? t.foreground : t.ansi1)
        .child(this.out.busy ? "herdr-app check…" : this.out.text), Boolean(this.out.busy)));
    }

    const sub = [m.group === "herdr" ? "livré" : m.group, plural(m.own, "fichier", "fichiers"), size(m.bytes), m.mtime ? `modifié ${ago(m.mtime, now)}` : "vide"].join(" · ");
    return { ctl, el: this.card(t, `km-d-${m.name}`, tint, this.mark(t, I("blocks"), tint), m.name, sub, body) };
  }

  // What the keys act on, from the state now: the list, the selected mod, its detail's controls. render
  // calls it, and so does key(), before each key. A batch (`kt-mods.key:l enter`), or keys typed faster
  // than a frame, must never act on the previous render's controls (that toggled kt.reducedMotion
  // instead of a block, 2026-11-18).
  prepare(t, now, m) {
    const d = this.data;
    let list = [];
    let all = [];
    let sel = null;
    let detail = null;
    let groupItems = [{ key: "all", label: "Tous" }];
    let stateItems = [{ key: "all", label: "Tous états" }];
    if (d) {
      ({ list, all } = this.rows(t));
      const count = (f) => all.filter(f).length;
      groupItems = [{ key: "all", label: "Tous", count: all.length, group: "g" },
        ...GROUPS.map(([g, label, tint]) => ({ key: g, label, count: count((x) => x.group === g), tint, group: "g" }))];
      stateItems = [{ key: "all", label: "Tous états", group: "s" },
        ...Object.entries(STATES).map(([k, [label, tint]]) => ({ key: k, label, count: count((x) => x.state === k), tint, group: "s" })),
        { key: "alert", label: "Alertes", count: count((x) => x.alert), tint: "blocked", group: "s" }];
      if (!list.some((r) => r.name === this.sel)) this.sel = list[0]?.name ?? null;
      sel = list.find((r) => r.name === this.sel) ?? null;
      if (sel) detail = this.detail(t, sel, sel.settings ? {} : sel, now, m.reduced);
    }
    const ctl = detail?.ctl ?? [];
    this.dcur = Math.max(0, Math.min(this.dcur, ctl.length - 1));
    if (!ctl.length && this.pane === "detail") this.pane = "list";
    return (this.view = { list, all, sel, ctl, detail, groupItems, stateItems });
  }

  render() {
    const t = theme();
    const now = unix();
    const m = (this.m = frame(this.motion, Boolean(shared("kt.reducedMotion"))));
    const shown = m.reduced || Boolean(this.size);
    const d = this.data;
    const W = this.size?.width ?? 1200;
    const H = this.size?.height ?? 800;
    const { list, all, sel, detail, groupItems, stateItems } = this.prepare(t, now, m);

    // Head.
    const counts = d ? GROUPS.map(([g]) => `${all.filter((x) => x.group === g).length} ${{ kbrdn: "kbrdn", herdr: "livrés", other: "autres" }[g]}`).join(" · ") : "";
    const alerts = d ? all.filter((x) => x.alert).length + all.filter((x) => x.state === "error").length : 0;
    const sub = this.busy && !d ? "Lecture…" : d ? `${all.length} mods · ${counts}${alerts ? ` · ${plural(alerts, "alerte", "alertes")}` : ""} · lu à ${clock(d.at)}` : this.error ?? "Pas encore lu";
    const refresh = this.iconBtn(t, "km-refresh", I("refresh-cw"), "Rafraîchir (r)", (cx) => this.refresh(cx));
    const head = div().flex_none().rounded(16).bg(t.surface).border(1).border_color(t.border)
      .child(this.band(t, { id: "km-head", tint: t.accent, mark: this.mark(t, I("blocks"), t.accent), title: "Mods", sub, rounded: "all",
        buttons: [this.busy ? div().size(28).flex().items_center().justify_center().child(svg(I("refresh-cw")).size(14).text_color(t.muted).spin(900)) : refresh,
          this.iconBtn(t, "km-close", I("x"), "Fermer (q)", () => this.dismiss())] }));

    const banner = d?.global?.length ? div().flex_none().px(12).py(8).rounded(16).border(1).border_color(alpha(t.ansi1, "66")).bg(alpha(t.ansi1, "14"))
      .font_family(MONO).text_size(10.5).text_color(t.ansi1).child(d.global.join("\n")) : null;

    // Left: search, filters, list.
    const insert = this.vim.insert;
    const field = h_flex().id("km-search").flex_none().h(32).px(10).gap(8).items_center().rounded(12).border(1)
      .border_color(insert ? alpha(t.accent, "99") : t.border).bg(t.background).cursor_pointer()
      .on_click((_e, cx) => { this.vim.edit(); this.pane = "list"; this.handle.focus(); cx.notify(); })
      .child(svg(I("search")).size(13).text_color(t.dim))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(this.query ? t.foreground : t.dim)
        .child(this.query || (insert ? "" : "Chercher un mod (/)")))
      .when(insert, (el) => el.child(div().flex_none().w(1.5).h(15).bg(t.accent)))
      .when(Boolean(this.query), (el) => el.child(this.iconBtn(t, "km-clear", I("x"), "Effacer (esc)", () => { this.query = ""; })));
    const filters = v_flex().flex_none().gap(6)
      .child(filterRow({ id: "km-g", state: this.groups, t, bg: t.surface, items: groupItems, active: this.group, reduced: m.reduced,
        onPick: (k) => { this.group = k; } }))
      .child(filterRow({ id: "km-s", state: this.states, t, bg: t.surface, items: stateItems, active: this.state, reduced: m.reduced,
        onPick: (k) => { this.state = k; } }));
    // scroll_to_item counts direct children, eyebrows included: the cursor's row index is its child's.
    const kids = [];
    let lastGroup = null;
    let selChild = -1;
    for (const r of list) {
      if (!this.query.trim() && r.group !== lastGroup && !r.settings) {
        lastGroup = r.group;
        const g = GROUPS.find(([x]) => x === r.group);
        kids.push(div().id(`km-gh-${r.group}`).flex_none().child(this.eyebrow(t, `${g[1]} · ${all.filter((x) => x.group === r.group).length}`)));
      }
      if (r.name === this.sel) selChild = kids.length;
      kids.push(this.row(t, r, now));
    }
    if (this.reveal && selChild >= 0) this.listScroll.scroll_to_item(selChild);
    this.reveal = false;
    const empty = d && !list.length ? [div().p(16).text_size(12).text_color(t.dim).child(this.query ? `Aucun mod ne correspond à « ${this.query} ».` : "Aucun mod avec ces filtres.")] : [];
    const left = v_flex().w(Math.min(560, Math.max(380, (W - 96) * 0.46))).flex_none().min_h(0).p(8).gap(8).rounded(16).bg(t.surface).border(1).border_color(t.border)
      .child(field).child(filters)
      .child(v_flex().id("km-list").flex_1().min_h(0).overflow_y_scroll().track_scroll(this.listScroll).gap(2)
        .children(d ? [...kids, ...empty] : [pulse(m, div().id("km-loading").p(16).text_size(13).text_color(t.dim)
          .child(this.error ? `Lecture impossible : ${this.error}` : "Lecture des mods…"), this.busy)]));

    // Right: the selected mod.
    const right = v_flex().id("km-detail").flex_1().min_w(0).min_h(0).overflow_y_scroll().track_scroll(this.detailScroll)
      .child(detail ? enter(m, v_flex().child(detail.el), `km-in-${sel?.name}`, { dy: 0 }) : div());

    const hint = (k, what) => h_flex().gap(5).items_center()
      .child(div().flex_none().h(18).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted).child(k))
      .child(what);
    const mode = div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1).border_color(t.border).bg(t.background)
      .font_family(MONO).text_size(9).text_color(t.muted).child(this.vim.label);
    const gen = d ? `fichiers générés par Herdr exclus des poids : ${d.gen.n} (gpui-kit.d.ts, jsconfig.json), ${size(d.gen.bytes)}` : "";
    const foot = h_flex().flex_none().px(12).py(8).gap(12).items_center().rounded(16).bg(t.surface).border(1).border_color(t.border)
      .text_size(11).text_color(t.dim)
      .child(mode)
      .children(this.pane === "detail"
        ? [hint("j k", "contrôle"), hint("enter", "agir"), hint("h l", "valeur"), hint("esc", "liste")]
        : [hint("j k", "mod"), hint("/", "chercher"), hint("tab [ ]", "filtres"), hint("l", "fiche")])
      .child(hint("O v D", "Zed, vérifier, dupliquer"))
      .child(div().flex_1().min_w(0).truncate().text_right().font_family(MONO).text_size(9.5).child(gen))
      .child(hint("q", "fermer"));

    const card = v_flex().id("km-card")
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .w(Math.min(1240, W - 48)).h(H - 48).relative().top(shown ? 0 : 6)
      .when(!m.reduced, (el) => el.transition("top", { duration: MS.open, easing: "ease-out" }))
      .p(4).gap(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg()
      .child(head)
      .when(Boolean(banner), (el) => el.child(banner))
      .child(h_flex().flex_1().min_h(0).gap(4).items_start().child(left.h_full()).child(right.h_full()))
      .child(foot);

    return div().id("km-veil").size_full().flex().items_center().justify_center()
      .bg(veil()).opacity(shown ? 1 : 0)
      .when(!m.reduced, (el) => el.transition("opacity", { duration: MS.open, easing: "ease-out" }))
      .on_size_change((sz, cx) => { this.size = sz; cx.notify(); })
      .on_click(() => this.dismiss())
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(card);
  }
}
