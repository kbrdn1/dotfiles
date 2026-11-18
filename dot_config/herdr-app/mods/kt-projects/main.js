// kbrdn Threads' projects: the registry (shared "kt.projects", kept across restarts) that
// kt-threads fills with every space it sees. One project per folder: rename it (its space too
// when open), color it (written to shared "space.colors" as well, so every mod agrees), give it a
// logo for light mode and one for dark (a candidate found in its folder, an evident light/dark
// pair, any image of the folder from a filtered list, or a file dropped from the Finder; copied to
// brand/projects/; either stands in for a missing other), drag it to reorder, or forget it.
// Forgetting deletes no file of the project; an open project's space must be closed first, after
// a second, explicit confirmation (its terminals close). Opened as a dialog with frame "none" from
// the project picker's « Gérer les projets ». ↑/↓ pick a project, Enter renames, Esc closes.
// Keys (vim.js): it opens on the list (NORMAL): j / k (↓ ↑, round), gg / G, ctrl-d / ctrl-u pick
// a project; enter or o renames it (INSERT in the name field); / opens « Parcourir… » typing in
// its filter (INSERT); dd or x forgets it (kt-confirm, as « Retirer »); q or esc closes; ? the
// keys (kt-keys, Modales). In a field: Enter renames, Esc leaves it (as before: the rename is
// dropped, the browse list closes). `kt-projects.key:<keys>` feeds keys ("j j", "o"), for tests.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { spaces, panes, run, theme, props, closeOverlay, shared, setShared, exec, openOverlay, nextCommand, appHome, checking, settings, readTextFile, home } from "herdr";
import { Vim, keysOf, step } from "./vim.js";
import { motionState, frame, sheet, leave, sharpen } from "./motion.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
import { ditherBand, TOP } from "./dither.js";

const MONO = "Monaspace Krypton";
// The theme's colors, then kbrdn.dev's primary scale (600, 400, 300, 800).
const SWATCHES = ["accent", "ansi1", "ansi3", "ansi2", "ansi6", "ansi4", "ansi5", "#c15f3c", "#e8a573", "#f4c895", "#8b3d24"];
// Where a repo keeps its logo, most telling first. Unmatched globs stay literal and fail -f.
// i18n: tech
const LOGO_GLOBS = "public/favicon.svg public/logo.svg public/icon.png assets/logo.* .github/logo.* docs/_assets/logo.* logo.* icon.*";
const PICTURE = /\.(svg|png|jpe?g|webp|gif|ico)$/i;
const MAX_FILES = 200;
const CARD_W = 780;
const CARD_H = 560;
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));
const I = (name) => `mods/kt-threads/${name}.svg`;
const tilde = (p) => (p && p.startsWith(home()) ? `~${p.slice(home().length)}` : p ?? "");

// The home folder is never a project (kt-threads purges it from the registry): not listed here.
const registry = () => (shared("kt.projects") ?? []).filter((e) => e.machine || e.folder !== home()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
// Saves the list in its order (order = position).
const save = (list) => setShared("kt.projects", list.map((e, i) => ({ ...e, order: i })));
// `from` takes `to`'s place (after it going down, before it going up), as spaces' drag does.
function reorder(fromId, toId) {
  const list = registry();
  const i = list.findIndex((e) => e.id === fromId);
  const j = list.findIndex((e) => e.id === toId);
  if (i < 0 || j < 0 || i === j) return;
  list.splice(j, 0, ...list.splice(i, 1));
  save(list);
}
const where = (s) => JSON.stringify([s.machine ?? null, s.folder]);
const paint = (t, c) => (!c ? null : c.startsWith("#") ? c : t[c] ?? null);
const kebab = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// A short stable tag of a string, so two projects of the same name don't share a logo file.
const tag = (s) => [...s].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381).toString(36).slice(0, 5);
const ext = (path) => path.split(".").pop().toLowerCase();
// A project's logos (`logos: { light, dark }`, or the older single `logo`), and the one for the
// appearance now: its own, else the other mode's.
const logosOf = (e) => e?.logos ?? { light: e?.logo ?? null, dark: e?.logo ?? null };
const logoOf = (e) => { const l = logosOf(e); return settings().dark ? (l.dark ?? l.light) : (l.light ?? l.dark); };
// [mode, its name's key in strings.js, its background].
const MODES = [["light", "mode.light", "#f5f5f5"], ["dark", "mode.dark", "#0f0f0f"]];

// How light an SVG's drawing is (0..1): the mean luminance of its neutral colors (else of all),
// null for a raster or an SVG without colors. A light drawing is for dark backgrounds.
function lightness(svgText) {
  const hex = [...svgText.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map((m) => (m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1]))
    .concat([...svgText.matchAll(/\b(white|black)\b/gi)].map((m) => (m[1].toLowerCase() === "white" ? "ffffff" : "000000")));
  const rgb = hex.map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
  const neutral = rgb.filter((c) => Math.max(...c) - Math.min(...c) < 0.15);
  const use = neutral.length ? neutral : rgb;
  return use.length ? use.reduce((n, [r, g, b]) => n + 0.2126 * r + 0.7152 * g + 0.0722 * b, 0) / use.length : null;
}

export default class Projects extends View {
  init(_props, cx) {
    this.real = {}; // where(space) -> registry id, null when unresolved
    this.sel = registry()[0]?.id ?? null;
    this.typing = null; // "name" | "filter": where the keys go
    this.draft = "";
    this.filter = "";
    this.browse = false; // the list of every image of the folder
    this.logos = {}; // id -> null (looking) | [{ rel, preview }]
    this.files = {}; // id -> null (listing) | [rel]
    this.pairs = {}; // id -> null (none, or looking) | { light, dark } (relative paths)
    this.slot = settings().dark ? "dark" : "light"; // which logo a pick or a drop sets
    // ponytail: the preview cache is never pruned (copies of a repo's images); clear data/kt-projects/preview if it grows.
    this.previews = {}; // `${folder}|${rel}` -> preview path under data/kt-projects/preview
    this.pressed = null; // the row a drag started on
    this.over = null;
    this.pending = null; // { step: "remove" | "close-ask" | "close", id }
    this.error = "";
    this.handle = cx.focus_handle();
    this.handle.focus();
    // Keys (vim.js): its mode follows `typing` (a field: INSERT, the list: NORMAL).
    this.vim = new Vim({ field: true });
    this.listScroll = ScrollHandle.new();
    this.motion = motionState(); // motion.js sheet(): the veil fades and the card rises in, the reverse on dismiss
    if (checking()) return;
    // kt-confirm answers with `kt-projects.confirmed`; `next` / `prev` pick a project; `browse`
    // opens or closes the list of the folder's images; `key:<keys>` types keys, for tests.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "confirmed") this.confirmed();
        else if (c === "next" || c === "prev") this.step(c === "next" ? 1 : -1);
        else if (c === "browse") { this.browse = !this.browse; this.typing = this.browse ? "filter" : null; }
        else if (c.startsWith("key:")) {
          this.handle.focus();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        }
        cx.notify();
      }
    });
  }

  // Each open space's project, as kt-threads ids it (projectId): its repo's main checkout (a
  // worktree, a subfolder belong to it), else its folder's real path.
  resolve(cx) {
    const todo = [...new Set(spaces().filter((s) => s.folder).map(where).filter((l) => !(l in this.real)))];
    if (!todo.length || this.resolving || checking()) return;
    this.resolving = true;
    cx.spawn(async (cx) => {
      for (const l of todo) {
        const [on, folder] = JSON.parse(l);
        try {
          const git = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder, on });
          const path = git.code === 0 && git.stdout.trim() ? git.stdout.trim().replace(/\/\.git$/, "") : (await exec("pwd", ["-P"], { cwd: folder, on })).stdout.trim();
          this.real[l] = path ? JSON.stringify([on, path]) : null;
        } catch { this.real[l] = null; }
      }
      this.resolving = false;
      cx.notify();
    });
  }

  // Every open space of a project (two spaces on its folder, its worktrees).
  spacesOf(e) {
    return spaces().filter((s) => (this.real[where(s)] ? this.real[where(s)] === e.id : s.folder === e.folder && (s.machine ?? null) === (e.machine ?? null)));
  }

  spaceOf(e) {
    return this.spacesOf(e)[0] ?? null;
  }

  current() {
    const reg = registry();
    return reg.find((e) => e.id === this.sel) ?? reg[0] ?? null;
  }

  select(id) {
    this.sel = id;
    this.typing = null;
    this.browse = false;
    this.filter = "";
  }

  step(by) {
    const reg = registry();
    if (!reg.length) return;
    const i = Math.max(0, reg.findIndex((e) => e.id === this.current()?.id));
    this.select(reg[(((i + by) % reg.length) + reg.length) % reg.length].id);
    this.reveal = true;
  }

  // vim's mode follows where the keys go: a field (INSERT) or the list (NORMAL).
  sync() {
    if (Boolean(this.typing) !== this.vim.insert) this.typing ? this.vim.edit() : this.vim.normal();
  }

  // motion.js leave(): the veil fades out and the card sinks, then the dialog closes.
  dismiss(cx) {
    leave(this.motion, cx, "kp", () => closeOverlay(props().overlay));
  }

  // One key, from the keyboard or `key:` (a name).
  press(ev, cx) {
    this.sync();
    return this.act(this.vim.handle(ev), cx);
  }

  // One vim action; false: not one of ours, and the key goes on. In a field, what it did before.
  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const e = this.current();
    if (this.typing === "name" && e) {
      if (a === "normal") this.typing = null;
      else if (a === "submit") this.rename(e);
      else if (a === "backspace") this.draft = this.draft.slice(0, -1);
      else if (a === "type") { if (this.draft.length < 60) this.draft += this.vim.char; }
      else return false;
    } else if (this.typing === "filter") {
      if (a === "normal") { this.typing = null; this.browse = false; this.filter = ""; }
      else if (a === "backspace") this.filter = this.filter.slice(0, -1);
      else if (a === "type") { if (this.filter.length < 80) this.filter += this.vim.char; }
      else return false;
    } else if (a === "escape" || a === "quit") this.dismiss(cx);
    else if (a === "down" || a === "up") this.step((a === "down" ? 1 : -1) * this.vim.count);
    else if (["top", "bottom", "half-down", "half-up"].includes(a)) {
      const reg = registry();
      const j = step(a, reg.findIndex((x) => x.id === e?.id), reg.length, this.vim.count, 10);
      if (j >= 0) { this.select(reg[j].id); this.reveal = true; }
    } else if (a === "open" && e) { this.typing = "name"; this.draft = e.name; }
    else if (a === "filter" && e && !e.machine) { this.browse = true; this.typing = "filter"; }
    else if (a === "delete" && e) this.forget(e);
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "modals" } });
    else return false;
    return true;
  }

  update(id, patch) {
    save(registry().map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  rename(e) {
    const name = this.draft.trim();
    this.typing = null;
    if (!name || name === e.name) return;
    this.update(e.id, { name });
    // Its open spaces called after it (by Herdr or by its old name) follow; one named otherwise keeps its name.
    for (const s of this.spacesOf(e)) if (!s.named || s.name === e.name) run("space.rename", { id: s.id, name });
  }

  recolor(e, color) {
    this.update(e.id, { color });
    const ids = this.spacesOf(e).map((s) => s.id);
    if (ids.length) setShared("space.colors", { ...(shared("space.colors") ?? {}), ...Object.fromEntries(ids.map((id) => [id, color])) });
  }

  // image() only reads under ~/.config/herdr-app: a picture of the folder is previewed from a copy
  // in data/kt-projects/preview/, named after its source so a cached picture is never another's.
  async preview(e, rel) {
    const key = `${e.folder}|${rel}`;
    if (this.previews[key] !== undefined) return this.previews[key];
    const file = `data/kt-projects/preview/${tag(key)}${tag(`${rel}~`)}.${ext(rel)}`;
    const r = await exec("cp", [`${e.folder}/${rel}`, `${appHome()}/${file}`]).catch(() => ({ code: 1 }));
    return (this.previews[key] = r.code === 0 ? file : null);
  }

  // The logo candidates in a local project's folder, at most 8 (a remote one's files aren't here).
  findLogos(e, cx) {
    if (e.id in this.logos || checking()) return;
    if (e.machine) { this.logos[e.id] = []; return; }
    this.logos[e.id] = null;
    cx.spawn(async (cx) => {
      const found = [];
      try {
        const r = await exec("sh", ["-c", `for f in ${LOGO_GLOBS}; do [ -f "$f" ] && printf '%s\\n' "$f"; done`], { cwd: e.folder });
        await exec("mkdir", ["-p", `${appHome()}/data/kt-projects/preview`]);
        for (const rel of [...new Set(r.stdout.split("\n").filter((f) => PICTURE.test(f)))].slice(0, 8)) {
          const preview = await this.preview(e, rel);
          if (preview) found.push({ rel, preview });
        }
      } catch {}
      this.logos[e.id] = found;
      cx.notify();
    });
  }

  // Every image of the folder (rg, else git ls-files: both skip what git ignores), 200 at most,
  // the shallowest first; previews follow as they're copied.
  listFiles(e, cx) {
    if (e.id in this.files || checking()) return;
    if (e.machine) { this.files[e.id] = []; return; }
    this.files[e.id] = null;
    cx.spawn(async (cx) => {
      const rg = await exec("rg", ["--files", "-g", "*.{svg,png,jpg,jpeg,webp,ico}"], { cwd: e.folder }).catch(() => null);
      let out = rg && rg.code !== 2 ? rg.stdout : null; // rg: 1 is "none found"
      if (out === null) {
        const git = await exec("git", ["ls-files"], { cwd: e.folder }).catch(() => null);
        out = git?.code === 0 ? git.stdout : "";
      }
      this.files[e.id] = out.split("\n").filter((f) => PICTURE.test(f)).sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)).slice(0, MAX_FILES);
      cx.notify();
    });
  }

  // Copies the previews of the shown files that have none yet, then redraws once.
  previewAll(e, rels, cx) {
    const todo = rels.filter((rel) => this.previews[`${e.folder}|${rel}`] === undefined);
    if (!todo.length || this.copying || checking()) return;
    this.copying = true;
    cx.spawn(async (cx) => {
      await exec("mkdir", ["-p", `${appHome()}/data/kt-projects/preview`]).catch(() => null);
      for (const rel of todo) await this.preview(e, rel);
      this.copying = false;
      cx.notify();
    });
  }

  // An evident light/dark pair among the folder's images: names that differ only by light/dark
  // or white/black (`k-light.svg` / `k-dark.svg`, `light/` / `dark/`, `logo-white` / `logo-black`),
  // a logo's first, the shallowest. Which is for dark mode: for SVGs, the lighter drawing; else by
  // name (white for dark backgrounds, black for light; light / dark as the mode).
  findPair(e, cx) {
    const files = this.files[e.id];
    if (!files || e.id in this.pairs || checking()) return;
    this.pairs[e.id] = null;
    const found = [];
    for (const f of files) {
      for (const [re, to] of [[/light/gi, "dark"], [/white/gi, "black"]]) {
        const other = f.replace(re, (m) => (m[0] === m[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to));
        if (other !== f && files.includes(other)) found.push([f, other]);
      }
    }
    if (!found.length) return;
    const telling = (p) => (/logo|icon|brand|mark/i.test(p) ? 0 : 1);
    found.sort((a, b) => telling(a[0]) - telling(b[0]) || a[0].split("/").length - b[0].split("/").length || a[0].localeCompare(b[0]));
    const [a, b] = found[0];
    cx.spawn(async (cx) => {
      const lit = async (rel) => (/\.svg$/i.test(rel) ? lightness((await readTextFile(`${e.folder}/${rel}`).catch(() => null)) ?? "") : null);
      const [la, lb] = [await lit(a), await lit(b)];
      const dark = la != null && lb != null && la !== lb ? (la > lb ? a : b) : /white/i.test(a) ? a : b;
      const light = dark === a ? b : a;
      await exec("mkdir", ["-p", `${appHome()}/data/kt-projects/preview`]).catch(() => null);
      await this.preview(e, light);
      await this.preview(e, dark);
      this.pairs[e.id] = { light, dark };
      cx.notify();
    });
  }

  // Copies a picked file (absolute path) into brand/projects/ as the project's logo for `mode`;
  // the source stays as it is. Several at once (a pair) go in one write.
  useLogos(e, picks, cx) {
    cx.spawn(async (cx) => {
      try {
        await exec("mkdir", ["-p", `${appHome()}/brand/projects`]);
        const logos = {};
        const from = {};
        for (const { mode, src, rel } of picks) {
          const file = `brand/projects/${kebab(e.name) || "project"}-${tag(e.id)}-${mode}.${ext(src)}`;
          const r = await exec("cp", [src, `${appHome()}/${file}`]);
          if (r.code !== 0) throw new Error(r.stderr.trim() || tr("cpFailed", { code: r.code }));
          logos[mode] = file;
          from[mode] = rel; // which file of the folder it was, to mark it
        }
        const now = registry().find((x) => x.id === e.id) ?? e;
        this.update(e.id, { logos: { ...logosOf(now), ...logos }, logosFrom: { ...(now.logosFrom ?? {}), ...from }, logo: undefined, logoFrom: undefined });
        this.error = "";
      } catch (err) { this.error = String(err?.message ?? err); }
      cx.notify();
    });
  }

  useLogo(e, src, rel, cx, mode = this.slot) {
    this.useLogos(e, [{ mode, src, rel }], cx);
  }

  clearLogo(e, mode) {
    const now = registry().find((x) => x.id === e.id) ?? e;
    this.update(e.id, { logos: { ...logosOf(now), [mode]: null }, logosFrom: { ...(now.logosFrom ?? {}), [mode]: null }, logo: undefined, logoFrom: undefined });
  }

  // kt-confirm, answering `kt-projects.confirmed`.
  ask(step, e, title, detail, label) {
    this.pending = { step, id: e.id };
    openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: { title, detail, label, danger: true, command: { name: "kt-projects.confirmed" } } });
  }

  // Forgetting a project: a closed one goes at once (after the confirm); an open one first asks to
  // close its space, then says plainly that its terminals close.
  forget(e) {
    const n = this.spacesOf(e).length;
    if (!n) return this.ask("remove", e, tr("remove.title", { name: e.name }), tr("remove.detail"), tr("remove.label"));
    this.ask("close-ask", e, tr("open.title", { name: e.name }), tr("open.detail", { n }), tr("open.label", { n }));
  }

  confirmed() {
    const p = this.pending;
    this.pending = null;
    const e = p && registry().find((x) => x.id === p.id);
    if (!e) return;
    const open = this.spacesOf(e);
    if (p.step === "close-ask" && open.length) {
      const tabs = new Set(open.flatMap((s) => s.tabs.map((tb) => tb.id)));
      const n = panes().filter((x) => x.terminal && tabs.has(x.tab)).length;
      return this.ask("close", e, tr("close.title", { n: open.length, name: e.name }), tr("close.detail", { n }), tr("close.label"));
    }
    if (p.step === "close") for (const s of open) run("space.close", { id: s.id, confirmed: true });
    if (p.step === "remove" || p.step === "close") {
      save(registry().filter((x) => x.id !== e.id));
      if (this.sel === e.id) this.sel = registry()[0]?.id ?? null;
    }
  }

  render(cx) {
    this.resolve(cx);
    const t = theme();
    const reg = registry();
    const e = this.current();
    if (e) {
      this.findLogos(e, cx);
      this.listFiles(e, cx);
      this.findPair(e, cx);
    }
    const focused = this.handle.is_focused();
    this.sync();
    // The picked project brought into view once after a key moved it (the list's children are its rows).
    if (this.reveal) {
      const i = reg.findIndex((x) => x.id === e?.id);
      if (i >= 0) this.listScroll.scroll_to_item(i);
      this.reveal = false;
    }
    const mode = div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(this.vim.insert ? alpha(t.accent, "66") : t.border).bg(this.vim.insert ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(this.vim.insert ? t.accent : t.muted).child(this.vim.label);
    const kbd = (k) => div().flex_none().h(18).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted).child(k);
    const hint = (k, what) => h_flex().gap(5).items_center().child(kbd(k)).child(div().child(what));
    const dashed = () => div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
    // A key of a key / value line (kt-confirm's facts): mono, dim, a fixed width so the values align.
    const eyebrow = (s) => div().w(76).flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(s);
    // An inner card (radius 12 inside the 16 one), on the terminals' background; its heading in
    // mono uppercase, what it holds or says at its right.
    const block = () => v_flex().flex_none().rounded(12).border(1).border_color(t.border).bg(t.background).overflow_hidden();
    const heading = (s, right) => h_flex().flex_none().px(12).pt(10).pb(6).gap(8).items_center().font_family(MONO).text_size(10.5)
      .child(div().flex_none().text_color(t.dim).child(s.toUpperCase()))
      .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(alpha(t.border, "99")))
      .when(Boolean(right), (el) => el.child(div().flex_none().text_color(t.dim).child(right)));
    // A short state said in a line (looking, nothing found): its icon, then the words.
    const say = (icon, text, color = t.dim) => h_flex().min_w(0).gap(8).items_start()
      .child(icon === "spinner" ? svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().mt(4).spin(900).text_color(t.working) : svg(I(icon)).size(12).flex_none().mt(4).text_color(color))
      .child(div().min_w(0).text_size(13).line_height("20px").text_color(t.muted).child(text));
    const tile = (x, size) => {
      const color = paint(t, x.color) ?? paint(t, (shared("space.colors") ?? {})[this.spaceOf(x)?.id]) ?? t.dim;
      const logo = logoOf(x);
      return div().size(size).flex_none().rounded(size > 24 ? 8 : 6).bg(logo ? t.raised : color).flex().items_center().justify_center()
        .child(logo ? image(logo).size(size - 8) : div().text_size(size > 24 ? 14 : 11).font_semibold().text_color(t.chrome).child([...x.name][0]?.toUpperCase() ?? "?"));
    };
    // kbrdn.dev pill buttons; `danger` in red.
    const pill = (id, label, onClick, { danger = false, on = false } = {}) =>
      h_flex().id(id).h(28).px(12).gap(6).flex_none().items_center().rounded_full().border(1)
        .border_color(danger ? t.ansi1 + "66" : on ? t.accent + "66" : t.input).bg(danger ? t.ansi1 + "14" : on ? t.accent + "24" : t.background)
        .font_family(MONO).text_size(11).text_color(danger ? t.ansi1 : on ? t.accent : t.foreground)
        .cursor_pointer().hover((s) => s.opacity(0.85))
        .on_click((_e, cx) => { onClick(cx); cx.notify(); })
        .child(label.toUpperCase());
    const segmented = (id, items) => h_flex().id(id).min_w(0).p(3).gap(2).items_center().rounded_full().border(1).border_color(t.border).bg(t.background).children(items);
    // A text field (radius 12) in its accent ring (3 px, radius 15) while it takes the keys.
    const field = (id, which, text, placeholder, tail, onClick) => {
      const live = this.typing === which;
      return div().flex_1().min_w(0).p(3).rounded(15).bg(live && focused ? t.accent + "33" : t.accent + "00").child(
        h_flex().id(id).h(34).px(12).gap(8).items_center().rounded(12).bg(t.background).border(1)
          .border_color(live ? t.accent : t.input).cursor_text()
          .on_click((_e, cx) => { onClick(); this.handle.focus(); cx.notify(); })
          .when(Boolean(text), (el) => el.child(div().min_w(0).truncate().text_size(13.5).text_color(t.foreground).child(text)))
          .when(live, (el) => el.child(div().flex_none().w(2).h(18).rounded(1).bg(t.accent)))
          .when(!text, (el) => el.child(div().min_w(0).truncate().pl(live ? 4 : 0).text_size(13.5).text_color(t.dim).child(placeholder)))
          .child(div().flex_1())
          .child(tail));
    };

    // A project row; drag it onto another to reorder (a 2 px accent bar shows where it lands).
    const from = this.pressed === null ? -1 : reg.findIndex((x) => x.id === this.pressed);
    // The picked row is the keys' cursor too: on the list (NORMAL, the dialog keyed) a 1 px accent ring.
    const row = (x, i) => {
      const on = e?.id === x.id;
      const cursor = on && focused && !this.typing;
      const open = Boolean(this.spaceOf(x));
      return h_flex()
        .id(`kp-row-${i}`)
        .relative()
        .h(40)
        .px(8)
        .gap(10)
        .flex_none()
        .items_center()
        .rounded(12)
        .border(1)
        .border_color(alpha(t.accent, cursor ? "99" : on ? "66" : "00"))
        .when(on, (el) => el.bg(t.accent + "24"))
        .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
        .when(this.pressed === x.id && this.over !== x.id, (el) => el.opacity(0.5))
        .when(this.pressed !== null && this.over === x.id && this.pressed !== x.id, (el) => el.child(
          div().absolute().left(6).right(6).h(2).rounded(1).bg(t.accent).when(from < i, (b) => b.bottom(-2)).when(from > i, (b) => b.top(-2))))
        .cursor_pointer()
        .on_mouse_down("left", () => { this.pressed = x.id; this.over = x.id; })
        .on_mouse_move((_e, cx) => {
          if (this.pressed !== null && this.over !== x.id) { this.over = x.id; cx.notify(); }
        })
        .on_mouse_up("left", (_e, cx) => {
          const src = this.pressed;
          this.pressed = null;
          this.over = null;
          if (src !== null && src !== x.id) reorder(src, x.id);
          else if (src === x.id) this.select(x.id); // a plain click
          cx.notify();
        })
        .child(div().when(!open, (el) => el.opacity(0.5)).child(tile(x, 24)))
        .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(open ? t.foreground : t.muted).child(x.name))
        .when(Boolean(x.machine), (el) => el.child(div().flex_none().px(6).rounded_full().bg(t.raised).font_family(MONO).text_size(10).text_color(t.dim).child(x.machine)))
        .child(div().flex_none().font_family(MONO).text_size(10).text_color(open ? t.done : t.dim).child(open ? tr("open") : tr("closed")));
    };

    const editor = () => {
      const open = this.spaceOf(e);
      const logos = this.logos[e.id];
      const swatch = (c, i) => {
        const on = e.color === c;
        return div().id(`kp-sw-${i}`).size(24).flex_none().rounded_full().p(3).border(1)
          .border_color(on ? t.accent : t.accent + "00").when(on, (el) => el.bg(t.accent + "24"))
          .cursor_pointer().hover((s) => s.border_color(on ? t.accent : t.border))
          .on_click((_e, cx) => { this.recolor(e, c); cx.notify(); })
          .child(div().size_full().rounded_full().bg(paint(t, c) ?? t.dim));
      };
      const mine = logosOf(e);
      const from = e.logosFrom ?? {};
      const slot = this.slot;
      // A candidate: on the picked slot's background; ringed when it is that slot's logo.
      const thumb = ({ rel, preview }, i) => {
        const on = Boolean(mine[slot]) && from[slot] === rel;
        return div().id(`kp-logo-${i}`).size(30).flex_none().rounded_full().p(2).border(1)
          .border_color(on ? t.accent : t.accent + "00").cursor_pointer().hover((s) => s.border_color(on ? t.accent : t.border)).tooltip(rel)
          .on_click((_e, cx) => this.useLogo(e, `${e.folder}/${rel}`, rel, cx))
          .child(div().size_full().rounded_full().p(3).bg(MODES.find(([m]) => m === slot)[2]).child(image(preview).size_full()));
      };
      const line = (label, ...kids) => h_flex().min_h(36).gap(10).items_center().child(eyebrow(label)).children(kids);
      // A dropped picture (from the Finder) becomes the logo of `mode`, as a picked one.
      const dropTo = (mode) => (ev, cx) => {
        const src = ev.paths.find((p) => PICTURE.test(p));
        if (!src) { this.error = tr("dropError"); cx.notify(); return; }
        this.useLogo(e, src, src.startsWith(`${e.folder}/`) ? src.slice(e.folder.length + 1) : null, cx, mode);
      };
      const drop = (ev, cx) => dropTo(this.slot)(ev, cx);
      // The two logos side by side, each on its mode's background; the ringed one is where a pick
      // or a drop goes. A missing one shows the other, dimmed: that's what the app will use.
      const slotCard = ([mode, label, bg]) => {
        const own = mine[mode];
        const shown = own ?? mine[mode === "light" ? "dark" : "light"];
        const on = slot === mode;
        return h_flex().id(`kp-slot-${mode}`).h(44).pl(4).pr(8).gap(10).flex_1().min_w(0).items_center().rounded(10).border(1)
          .border_color(on ? t.accent + "99" : t.border).bg(on ? t.accent + "14" : t.surface).cursor_pointer()
          .on_click((_e, cx) => { this.slot = mode; cx.notify(); })
          .on_drop(dropTo(mode))
          .child(div().size(34).flex_none().rounded(6).bg(bg).border(1).border_color(t.border).flex().items_center().justify_center()
            .child(shown ? div().when(!own, (el) => el.opacity(0.35)).child(image(shown).size(24)) : div().font_family(MONO).text_size(10).text_color("#888888").child("—")))
          .child(v_flex().flex_1().min_w(0).gap(1)
            .child(div().font_family(MONO).text_size(10.5).text_color(on ? t.accent : t.muted).child(tr(label).toUpperCase()))
            .child(div().truncate().text_size(11.5).text_color(own ? t.foreground : t.dim).child(own ? (from[mode] ?? tr("dropped")).split("/").pop() : shown ? tr("usesOther") : tr("none"))))
          .when(Boolean(own), (el) => el.child(
            div().id(`kp-none-${mode}`).ml(4).px(7).h(20).flex().items_center().rounded_full().border(1).border_color(t.border)
              .font_family(MONO).text_size(10).text_color(t.muted).cursor_pointer().hover((s) => s.text_color(t.foreground))
              .on_click((_e, cx) => { cx.stop_propagation(); this.clearLogo(e, mode); cx.notify(); })
              .child(tr("noneButton"))));
      };
      const pair = this.pairs[e.id];
      const pairPreview = (rel, bg) => div().size(22).rounded(7).p(3).bg(bg).child(this.previews[`${e.folder}|${rel}`] ? image(this.previews[`${e.folder}|${rel}`]).size_full() : div());
      const pairChip = pair && h_flex().id("kp-pair").h(30).pl(4).pr(10).gap(6).flex_none().items_center().rounded_full().border(1).border_color(t.border).bg(t.background)
        .cursor_pointer().hover((s) => s.border_color(t.accent + "66")).tooltip(`${pair.light} · ${pair.dark}`)
        .on_click((_e, cx) => this.useLogos(e, [{ mode: "light", src: `${e.folder}/${pair.light}`, rel: pair.light }, { mode: "dark", src: `${e.folder}/${pair.dark}`, rel: pair.dark }], cx))
        .child(pairPreview(pair.light, MODES[0][2]))
        .child(pairPreview(pair.dark, MODES[1][2]))
        .child(div().font_family(MONO).text_size(10.5).text_color(t.muted).child(tr("pair")));
      // The browse list: every image of the folder, filtered by the field.
      const all = this.files[e.id];
      const q = this.filter.toLowerCase();
      const shown = (all ?? []).filter((f) => f.toLowerCase().includes(q));
      if (this.browse && all) this.previewAll(e, shown, cx);
      const fileRow = (rel, i) => {
        const on = Boolean(mine[slot]) && from[slot] === rel;
        const preview = this.previews[`${e.folder}|${rel}`];
        return h_flex().id(`kp-file-${i}`).h(30).px(8).gap(10).flex_none().items_center().rounded(10)
          .border(1).border_color(on ? t.accent + "66" : t.accent + "00").when(on, (el) => el.bg(t.accent + "24"))
          .when(!on, (el) => el.hover((s) => s.bg(t.hover))).cursor_pointer()
          .on_click((_e, cx) => this.useLogo(e, `${e.folder}/${rel}`, rel, cx))
          .child(div().size(20).flex_none().rounded(4).flex().items_center().justify_center()
            .child(preview ? image(preview).size(18) : div().size(6).rounded(3).bg(t.border)))
          .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(on ? t.accent : t.muted).child(rel));
      };
      // A function: an element has one parent, and both the candidates and the browse list are built.
      const toggle = () => pill("kp-browse-toggle", this.browse ? tr("closeList") : tr("browse"), () => {
        this.browse = !this.browse;
        this.typing = this.browse ? "filter" : null;
      }, { on: this.browse });
      const browsing = this.browse && !e.machine;
      // The browse list, in the Logo block: the filter (and how many it keeps), then the images, or
      // why there are none.
      const browser = v_flex().id("kp-browse").px(12).pt(8).pb(10).gap(6).min_h(0).flex_1()
        .child(h_flex().gap(8).items_center()
          .child(field("kp-filter", "filter", this.filter, tr("filterImages"),
            div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(all ? `${shown.length}${all.length >= MAX_FILES ? "+" : ""}` : "…"),
            () => { this.typing = "filter"; }))
          .child(toggle()))
        .child(v_flex().id("kp-files").flex_1().min_h(0).p(4).gap(1).rounded(10).border(1).border_color(t.border).bg(t.surface).overflow_y_scrollbar()
          .when(!all, (el) => el.child(div().p(8).child(say("spinner", tr("reading")))))
          .when(Boolean(all) && !shown.length, (el) => el.child(div().p(8).child(all.length
            ? say("list-filter", tr("noImageMatch", { q: this.filter }))
            : say("file", tr("noImage")))))
          .children(shown.map(fileRow)));
      // The logo candidates of the folder: looking, the ones found (and an evident light/dark pair), none.
      const candidates = h_flex().id("kp-cands").px(12).pt(8).pb(10).min_h(48).gap(8).items_center()
        .child(logos === null ? say("spinner", tr("searching"))
          : logos?.length ? segmented("kp-logos", logos.map(thumb))
          : pair ? div() : say("circle-dashed", tr("noLogo")))
        .when(Boolean(pairChip), (el) => el.child(pairChip))
        .child(div().flex_1())
        .child(toggle());
      const opened = this.spacesOf(e);
      const state = h_flex().flex_none().h(22).px(8).gap(6).items_center().rounded_full().border(1)
        .border_color(open ? alpha(t.done, "66") : t.border).bg(open ? alpha(t.done, "14") : t.surface)
        .child(div().size(6).rounded(3).bg(open ? t.done : t.dim))
        .child(div().font_family(MONO).text_size(10).text_color(open ? t.done : t.dim).child(open ? (opened.length > 1 ? tr("openN", { n: opened.length }) : tr("open")) : tr("closed")));
      return v_flex()
        .flex_1()
        .min_w(0)
        .min_h(0)
        .p(16)
        .gap(10)
        // What it is: its mark, its name (15 medium), where it lives (mono), open or closed.
        .child(
          h_flex().flex_none().gap(12).items_center().on_drop(drop)
            .child(tile(e, 40))
            .child(v_flex().flex_1().min_w(0).gap(2)
              .child(div().truncate().text_size(15).font_medium().text_color(t.foreground).child(e.name))
              .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(e.machine ? `${e.machine} · ${e.folder}` : tilde(e.folder))))
            .child(state),
        )
        // Its name and color, as key / value lines. Put away while browsing: the images take the room.
        .when(!browsing, (el) => el.child(
          block().child(v_flex().px(12).py(6).gap(2)
            .child(line(tr("name"), field("kp-name", "name", this.typing === "name" ? this.draft : e.name, tr("namePlaceholder"),
              this.typing === "name" ? kbd("↵") : div().font_family(MONO).text_size(10.5).text_color(t.dim).child(tr("rename")),
              () => { this.typing = "name"; this.draft = e.name; })))
            .child(line(tr("color"), segmented("kp-colors", SWATCHES.map(swatch))))),
        ))
        // Its logo for each mode, then the folder's candidates or the browse list; a drop anywhere sets it.
        .child(
          block().id("kp-logo-zone").on_drop(drop).when(browsing, (el) => el.flex_1().min_h(0))
            .child(heading(tr("logo"), tr("dropHere")))
            .child(h_flex().px(12).gap(8).items_center().children(MODES.map(slotCard)))
            .when(Boolean(e.machine), (el) => el.child(div().px(12).pt(8).pb(10)
              .child(say("circle-alert", tr("remote"), t.blocked))))
            .when(!e.machine && !browsing, (el) => el.child(candidates))
            .when(browsing, (el) => el.child(browser)),
        )
        .when(Boolean(this.error), (el) => el.child(
          h_flex().flex_none().gap(9).items_start().px(12).py(9).rounded(12).border(1).border_color(alpha(t.ansi1, "4d")).bg(alpha(t.ansi1, "14"))
            .child(svg(I("circle-alert")).size(14).flex_none().mt(2).text_color(t.ansi1))
            .child(div().flex_1().min_w(0).text_size(12.5).line_height("18px").text_color(t.ansi1).child(this.error))))
        .when(!browsing, (el) => el.child(div().flex_1()))
        .child(dashed())
        .child(h_flex().flex_none().gap(10).items_center()
          .child(div().flex_1().min_w(0).text_size(13).line_height("20px").text_color(t.muted).child(open ? tr("footOpen") : tr("footClosed")))
          .child(pill("kp-forget", open ? tr("forgetOpen") : tr("forget"), () => this.forget(e), { danger: true })));
    };
    // No project yet: what the dialog is for, and how one gets here.
    const nothing = () => v_flex().flex_1().min_w(0).h_full().p(24).items_center().justify_center().child(
      v_flex().max_w(380).gap(8)
        .child(h_flex().gap(10).items_center()
          .child(h_flex().size(32).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(t.accent, "4d")).bg(t.background)
            .child(svg(I("folder-plus")).size(16).text_color(t.accent)))
          .child(div().text_size(15).font_medium().text_color(t.foreground).child(tr("nothing.title"))))
        .child(div().text_size(13).line_height("20px").text_color(t.muted)
          .child(tr("nothing.text"))));

    // Before the first size report (and in `herdr-app check`), the full layout, still transparent.
    const full = !this.size || this.size.width > CARD_W + 40 || this.size.height > CARD_H + 40;
    // The modals' motion (motion.js sheet): the veil fades in and the card rises 6 px, once, on the
    // first size report, and the reverse on dismiss; reduced motion: there at once, gone at once.
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const s = sheet(m, "kp", Boolean(this.size));
    // The head, Crosstalk's: a 60 px band over the pixel dither, tinted by the picked project's color
    // (else its space's, else accent); the mark, the title (14 semibold) and a mono subtitle.
    const dark = settings().dark;
    const band = (e && (paint(t, e.color) ?? paint(t, (shared("space.colors") ?? {})[this.spaceOf(e)?.id]))) ?? t.accent;
    const openN = reg.filter((x) => this.spaceOf(x)).length;
    const subtitle = [tr("sub.projects", { n: reg.length }), tr("sub.open", { n: openN }), reg.length > openN ? tr("sub.closed", { n: reg.length - openN }) : null].filter(Boolean).join(" · ");
    const head = div()
      .id("kp-head")
      .relative()
      .flex_none()
      .h(60)
      .overflow_hidden()
      .rounded_t(15)
      .on_size_change((size, cx) => {
        if (Math.abs((this.headW ?? 0) - size.width) < 0.5) return;
        this.headW = size.width;
        cx.notify();
      })
      // Inside the inner card's 1 px border: its radius 16 less the border.
      .when(this.headW > 30, (el) => el.child(ditherBand(this.headW, 60, 15, alpha(band, dark ? "6b" : "4d"), TOP)))
      .child(h_flex().size_full().px(14).gap(12).items_center()
        .child(h_flex().size(32).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(t.accent, "4d")).bg(alpha(t.surface, "e6"))
          .child(svg(I("layers")).size(16).text_color(t.accent)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          // motion.js sharpen: the title comes into focus as the dialog opens, once.
          .child(sharpen(m, "kp-title", () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(tr("title"))))
          .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(subtitle)))
        .child(kbd("esc")));
    const card = v_flex()
      .id("kt-projects")
      // A press in the card never reaches the veil.
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .when(full, (el) => s.card(el.w(CARD_W).h(CARD_H).max_w_full().max_h_full()))
      .when(!full, (el) => el.size_full())
      .min_h(0)
      .p(4)
      .rounded(20)
      .bg(t.popover)
      .border(1)
      .border_color(t.border)
      .shadow_lg()
      .child(
        v_flex()
          .flex_1()
          .min_h(0)
          .rounded(16)
          .bg(t.surface)
          .border(1)
          .border_color(t.border)
          .child(head)
          .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(band, "4d")))
          .child(
            h_flex().flex_1().min_h(0).items_start()
              .child(
                v_flex().id("kp-list").w(280).h_full().flex_none().p(8).gap(2).overflow_y_scrollbar().track_scroll(this.listScroll).border_r(1).border_dashed().border_color(t.border)
                  .when(!reg.length, (el) => el.child(div().p(8).child(say("circle-dashed", tr("emptyRegistry")))))
                  .children(reg.map(row)),
              )
              .when(Boolean(e), (el) => el.child(v_flex().flex_1().min_w(0).h_full().child(editor())))
              .when(!e, (el) => el.child(nothing())),
          )
          .child(dashed())
          .child(
            h_flex().flex_none().px(14).py(10).gap(12).items_center().text_size(11).text_color(t.dim)
              .when(focused, (el) => el.child(mode))
              .child(hint("↑↓", tr("hint.project")))
              .child(hint(tr("hint.drag"), tr("hint.reorder")))
              .child(hint("↵", tr("hint.rename")))
              .child(hint("esc", this.typing ? tr("hint.cancel") : tr("hint.close"))),
          ),
      );
    // Full window: a veil (a click on it closes), the card in its middle; in a card-sized box (an
    // explicit `width: 780, height: 560`) the card fills it as before, no veil. Fades in once, out on dismiss.
    return s.veil(div()
      .id("kt-projects-veil")
      .size_full()
      .flex()
      .items_center()
      .justify_center())
      .on_size_change((size, cx) => {
        this.size = size;
        cx.notify();
      })
      // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
      .when(full, (el) => el.bg(veil()).on_mouse_down("left", (_e, cx) => this.dismiss(cx)))
      .track_focus(this.handle)
      .on_key_down((ev, cx) => {
        if (!this.press(ev, cx)) return; // not ours: ctrl-b, cmd-* go on
        cx.stop_propagation();
        cx.notify();
      })
      // A drag let go outside a row (over the veil too) ends there.
      .on_mouse_up("left", (_e, cx) => { if (this.pressed !== null) { this.pressed = null; this.over = null; cx.notify(); } })
      .child(card);
  }
}
