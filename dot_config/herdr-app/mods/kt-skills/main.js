// kbrdn Skills (Monocode's Settings › Skills, kbrdn.dev look): every Claude Code
// skill and slash command on this machine, read-only, as a page: the "skills"
// child of kbrdn-threads' main "view" stack (kt-threads' Skills shows it), or a
// dialog (openOverlay; props.select opens one skill by name).
// Sources: ~/.claude/skills/**/SKILL.md (synced/<id>/x is claude.ai's,
// anthropic-skills:x), ~/.agents/skills/**/SKILL.md (the folder shared between
// harnesses, the real home of many skills linked into ~/.claude/skills: one
// entry per real path, named as Claude Code lists it), the enabled plugins'
// skills and commands (settings.json enabledPlugins, installed_plugins.json's
// install), ~/.claude/commands/**/*.md, and the shown space's git root's
// .claude/skills and .claude/commands. Names follow the path, as Claude Code
// lists them: skills/me/loop/x/SKILL.md is me:loop:x, a plugin's are plugin:x.
// Top: title, counter, filter, refresh, source segments. Then one card-row per
// skill (name, description, path; source and harness; on hover preview, copy,
// open), grouped by source, 80 to a page. A row opens the detail on the right:
// description, frontmatter, SKILL.md in a read-only editor, Copy / Zed / Finder.
// Scans when the page shows, when the shown space changes while it shows, and
// on Rafraîchir; never on a timer. Files are re-read only when their mtime moved.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState, ScrollHandle } from "gpui-base";
import { exec, readTextFile, theme, settings, spaces, panes, run, layout, props, home, notify, checking } from "herdr";
import { frontmatter } from "./frontmatter.js";

const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const OWN = (name) => `mods/kt-skills/${name}.svg`;
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const PAGE = 80; // rows per page: plain rows (a virtual list's rows can't hold their own buttons)
const SEGS = [["all", "Tous"], ["personal", "Personnels"], ["plugin", "Plugins"], ["project", "Projet"], ["command", "Commandes"]];
const SOURCE = { personal: "Personnel", plugin: "Plugin", project: "Projet" };
// The whole scan in one process: each (glob, dir) listed by rg (links followed, hidden
// folders skipped), then every file's mtime and real path (macOS stat: PATH's may be GNU's).
const LIST = `while [ $# -gt 1 ]; do g=$1; d=$2; shift 2; [ -d "$d" ] && rg --files --follow --no-ignore -g "$g" "$d"; done | tr '\\n' '\\0' | xargs -0 /usr/bin/stat -L -f '%m%t%R%t%N'`;

const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };
const dirOf = (p) => p.slice(0, p.lastIndexOf("/"));
const tilde = (p) => (p.startsWith(home() + "/") ? `~${p.slice(home().length)}` : p);
const fmt = (v) => (Array.isArray(v) ? v.join(", ")
  : v && typeof v === "object" ? Object.entries(v).map(([k, s]) => `${k}: ${s}`).join(" · ")
  : String(v ?? "")).trim();

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
  return (v?.active ?? v?.children?.[0]?.id) === "skills";
}
const activeSpace = () => spaces().find((s) => s.active);

export default class Skills extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.scroll = ScrollHandle.new();
    this.query = "";
    this.seg = "all";
    this.page = 0;
    this.items = [];
    this.cache = new Map(); // "path\treal" -> { mtime, item }
    this.sel = null; // the open item's key
    this.code = null; // its SKILL.md, read-only
    this.codeKey = null;
    this.hot = null; // the hovered row's key
    this.reveal = null; // a row to scroll to once drawn (props.select)
    this.unfolded = new Set(); // groups whose "Fragments et templates" are open
    this.error = null;
    this.busy = false;
    this.scanned = false;
    this.space = undefined; // the space the last scan looked at
    this.width = 1100;
  }

  // ---------- data ----------

  // The shown space's git root (local spaces: a remote one's files are on that machine).
  async projectRoot() {
    const s = activeSpace();
    if (!s || s.machine) return null;
    const tab = s.tabs.find((x) => x.active);
    const mine = panes().filter((p) => p.tab === tab?.id && p.terminal);
    const cwd = (mine.find((p) => p.program?.agent) ?? mine[0])?.cwd ?? s.folder;
    if (!cwd) return null;
    const r = await exec("git", ["-C", cwd, "rev-parse", "--show-toplevel"]).catch(() => null);
    return r?.code === 0 ? r.stdout.trim() : null;
  }

  // Where to look, in dedupe order: ~/.claude/skills first, so a skill linked there from
  // ~/.agents/skills keeps the name Claude Code gives it.
  async roots() {
    const h = home();
    const C = `${h}/.claude`;
    const roots = [
      { dir: `${C}/skills`, glob: "SKILL.md", kind: "skill", source: "personal", group: "~/.claude/skills", order: 0 },
      { dir: `${h}/.agents/skills`, glob: "SKILL.md", kind: "skill", source: "personal", group: "~/.agents/skills", order: 2 },
    ];
    const [st, inst, proj] = await Promise.all([
      readTextFile(`${C}/settings.json`).catch(() => null),
      readTextFile(`${C}/plugins/installed_plugins.json`).catch(() => null),
      this.projectRoot(),
    ]);
    const installed = parse(inst)?.plugins ?? {};
    for (const [key, on] of Object.entries(parse(st)?.enabledPlugins ?? {})) {
      if (on !== true) continue;
      const [plugin, market] = key.split("@");
      const all = installed[key] ?? [];
      const e = all.find((x) => x.scope === "user") ?? all.find((x) => x.projectPath === proj) ?? all[0];
      let dir = e?.installPath, version = e?.version;
      if (!dir && market) { // no installed_plugins.json entry: the cache's newest version
        const base = `${C}/plugins/cache/${market}/${plugin}`;
        version = (await exec("ls", ["-t", base]).catch(() => null))?.stdout.split("\n")[0]?.trim();
        dir = version ? `${base}/${version}` : null;
      }
      if (!dir) continue;
      const common = { source: "plugin", group: plugin, prefix: plugin, version, order: 3 };
      roots.push({ ...common, dir: `${dir}/skills`, glob: "SKILL.md", kind: "skill" });
      roots.push({ ...common, dir: `${dir}/commands`, glob: "*.md", kind: "command" });
    }
    // At home, the "project" is ~/.claude itself: already listed.
    if (proj && proj !== h) {
      const common = { source: "project", group: proj.split("/").pop(), order: 4 };
      roots.push({ ...common, dir: `${proj}/.claude/skills`, glob: "SKILL.md", kind: "skill" });
      roots.push({ ...common, dir: `${proj}/.claude/commands`, glob: "*.md", kind: "command" });
    }
    roots.push({ dir: `${C}/commands`, glob: "*.md", kind: "command", source: "personal", group: "~/.claude/commands", order: 5 });
    return roots;
  }

  scan(cx) {
    if (this.busy) return;
    this.busy = true;
    this.space = activeSpace()?.id ?? null;
    cx.spawn(async (cx) => {
      try {
        const roots = await this.roots();
        const r = await exec("sh", ["-c", LIST, "sh", ...roots.flatMap((x) => [x.glob, x.dir])], { timeout: 60e3 });
        const files = [];
        for (const line of r.stdout.split("\n")) {
          const [mtime, real, path] = line.split("\t");
          if (!path) continue;
          const root = roots.filter((x) => path.startsWith(x.dir + "/")).sort((a, b) => b.dir.length - a.dir.length)[0];
          if (root) files.push({ path, real, mtime: Number(mtime), root });
        }
        // A SKILL.md inside another skill's folder (a bundled venv's) isn't a skill.
        const skillDirs = new Set(files.filter((f) => f.root.kind === "skill").map((f) => dirOf(f.path)));
        const nested = (f) => {
          for (let d = dirOf(dirOf(f.path)); d.length > f.root.dir.length; d = dirOf(d)) if (skillDirs.has(d)) return true;
          return false;
        };
        const seen = new Set();
        const keep = files.filter((f) => {
          if (f.root.kind === "skill" && nested(f)) return false;
          if (seen.has(f.real)) return false; // the same file seen through a link
          seen.add(f.real);
          return true;
        });
        this.items = await Promise.all(keep.map(async (f) => {
          const k = `${f.path}\t${f.real}`;
          const c = this.cache.get(k);
          if (c?.mtime === f.mtime) return c.item;
          const item = this.item(f, await readTextFile(f.path).catch(() => null));
          this.cache.set(k, { mtime: f.mtime, item });
          return item;
        }));
        // By group, its internal bricks last, then by name (me: aside).
        this.items.sort((a, b) => a.order - b.order || a.group.localeCompare(b.group) || a.internal - b.internal || a.sort.localeCompare(b.sort));
        this.error = this.items.length ? null : r.stderr.trim() || null;
        // A dialog asked for one skill (props.select): open it once; list() pages and scrolls to it.
        const want = props()?.select;
        const x = want && !this.scanned ? this.items.find((i) => i.name === want) : null;
        if (x) {
          this.reveal = x.key;
          this.select(x, cx);
        }
      } catch (e) {
        this.error = String(e);
      } finally {
        this.busy = false;
        this.scanned = true;
        cx.notify();
      }
    });
  }

  item(f, text) {
    const { meta } = frontmatter(text ?? "");
    const r = f.root;
    const rel = f.path.slice(r.dir.length + 1);
    let parts = r.kind === "skill" ? rel.split("/").slice(0, -1) : rel.replace(/\.md$/i, "").split("/");
    let group = r.group, order = r.order;
    // ponytail: Claude Code lists synced/<id>/x as anthropic-skills:x (its claude.ai skills); hardcoded.
    if (r.source === "personal" && r.kind === "skill" && parts[0] === "synced" && parts.length > 2) {
      parts = ["anthropic-skills", ...parts.slice(2)];
      group = "claude.ai";
      order = 1;
    }
    const name = [r.prefix, ...parts].filter(Boolean).join(":");
    const label = r.kind === "command" && r.source === "personal" ? "Commandes" : SOURCE[r.source];
    const off = fmt(meta["user-invocable"]).toLowerCase() === "false";
    return {
      key: f.path, path: f.path, real: f.real, name, kind: r.kind, source: r.source, group, order,
      // _fragments, _templates: internal bricks, folded at the end of their group.
      internal: Boolean(parts[0]?.startsWith("_")), sort: name.replace(/^me:/, ""),
      glabel: `${label} · ${group}`, version: r.version ?? null, meta,
      harness: f.real.startsWith(`${home()}/.agents/`) ? "agents" : "claude",
      description: fmt(meta.description), model: fmt(meta.model), tools: fmt(meta["allowed-tools"]),
      // Claude Code doesn't load ~/.agents/skills itself: only what's linked into ~/.claude/skills (kept
      // under that path by the dedupe) is a /command. The "agents" harness label says why, no badge.
      off, invocable: r.kind === "command" || (!off && !f.path.startsWith(`${home()}/.agents/`)),
      unreadable: text == null,
    };
  }

  matches(x, seg) {
    if (seg === "personal") return x.source === "personal" && x.kind === "skill";
    if (seg === "plugin" || seg === "project") return x.source === seg;
    if (seg === "command") return x.kind === "command";
    return true;
  }

  // The query's matches (name, frontmatter name, description), before the source filter.
  queried() {
    const q = this.query.trim().toLowerCase();
    return q ? this.items.filter((x) => `${x.name} ${fmt(x.meta.name)} ${x.description}`.toLowerCase().includes(q)) : this.items;
  }

  select(x, cx) {
    if (this.sel === x.key && this.code) return;
    this.sel = x.key;
    this.loadBody(x, cx);
  }

  // SKILL.md without its frontmatter, in a read-only editor (made in a task, never in render).
  loadBody(x, cx) {
    this.code?.release();
    this.code = null;
    this.codeKey = null;
    cx.spawn(async (cx) => {
      const text = await readTextFile(x.path).catch(() => null);
      if (this.sel !== x.key) return;
      const t = theme();
      this.codeDark = settings().dark !== false;
      this.code = EditorState.new({
        language: "markdown",
        value: text == null ? "(illisible)" : frontmatter(text).body.replace(/^\n+/, "") || "(vide)",
        readonly: true,
        soft_wrap: true,
        folding: false,
        font_family: MONO,
        font_size: 12,
        syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6, punctuation: t.dim },
      });
      this.codeKey = x.key;
      cx.notify();
    });
  }

  async close() {
    this.code?.release();
  }

  copy(x, cx) {
    const text = x.invocable ? `/${x.name}` : x.name;
    cx.write_to_clipboard(text);
    notify({ title: "Copié", body: text, level: "success", timeout: 2000 });
  }

  // Zed's CLI when it's there, else its URL scheme.
  zed(x) {
    exec("zed", [x.real]).catch(() => exec("open", [`zed://file${x.real}`]).catch(() => {}));
  }

  // ---------- pieces ----------

  card(t) {
    return v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
  }

  eyebrow(t, text, color) {
    return div().font_family(MONO).text_size(11).text_color(color ?? t.muted).child(String(text).toUpperCase());
  }

  // kbrdn.dev `.tag`: pill, border 30% / fill 10% of its own color.
  tag(t, color, text) {
    return h_flex().flex_none().h(18).px(7).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
      .text_color(color).font_family(MONO).text_size(10).child(String(text).toUpperCase());
  }

  dashed(t) {
    return div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
  }

  empty(t, text, color) {
    return div().p(16).text_size(13).text_color(color ?? t.dim).child(text);
  }

  // A small round icon button; it keeps its click from the row.
  icon(t, id, icon, tip, onClick) {
    return div().id(id).p(4).rounded_full().flex_none().text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); cx.notify(); })
      .child(svg(icon).size(13));
  }

  pill(t, id, label, icon, onClick) {
    return h_flex().id(`kts-${id}`).flex_none().h(30).px(13).gap(6).items_center().rounded_full().border(1)
      .border_color(t.border).bg(t.background).text_size(12.5).font_medium().text_color(t.foreground)
      .cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { onClick(cx); cx.notify(); })
      .when(Boolean(icon), (el) => el.child(svg(icon).size(13)))
      .child(label);
  }

  // ---------- header ----------

  key(e, cx) {
    if (e.key === "escape") { if (!this.query) return; this.query = ""; }
    else if (e.key === "backspace") this.query = this.query.slice(0, -1);
    else if (e.key === "enter") {
      const first = this.queried().find((x) => this.matches(x, this.seg));
      if (first) this.select(first, cx);
    }
    else if (e.key_char && !e.modifiers?.control && !e.modifiers?.platform) this.query += e.key_char;
    else return;
    this.page = 0;
    cx.stop_propagation();
    cx.notify();
  }

  header(t, q, shown) {
    const typing = this.handle.is_focused();
    const skills = this.items.filter((x) => x.kind === "skill").length;
    const filtered = this.query.trim() || this.seg !== "all";
    const count = !this.scanned ? "…" : filtered ? `${shown} / ${this.items.length}` : `${skills} skills · ${this.items.length - skills} commandes`;
    // Concentric radii: the card (16) holds its toolbar 4 px in, so the toolbar's boxes are 12,
    // and the segments, 3 px inside theirs, 9.
    const seg = h_flex().flex_none().h(36).p(3).gap(2).items_center().rounded(12).border(1).border_color(t.border)
      .children(SEGS.map(([k, label]) => {
        const on = this.seg === k;
        return h_flex().id(`kts-seg-${k}`).h_full().px(11).gap(6).items_center().rounded(9).border(1)
          .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00"))
          .when(on, (el) => el.bg(alpha(t.accent, "24")))
          .when(!on, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
          .text_size(12).text_color(on ? t.foreground : t.muted).cursor_pointer()
          .on_click((_e, cx) => { this.seg = k; this.page = 0; cx.notify(); })
          .child(label)
          .child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(String(q.filter((x) => this.matches(x, k)).length)));
      }));
    return this.card(t).flex_none().p(4).gap(4)
      .child(v_flex().px(14).pt(12).pb(6).gap(4)
        .child(div().text_size(21).font_semibold().line_height("28px").text_color(t.foreground).child("Skills"))
        .child(div().text_size(13).text_color(t.muted)
          .child("Les skills et commandes de Claude Code, depuis les dossiers personnels, harness, plugins et projet. Lecture seule.")))
      .child(h_flex().flex_wrap().gap(4).items_center()
        .child(h_flex().id("kts-filter").w(280).h(36).px(12).gap(8).items_center().rounded(12).border(1)
          .border_color(typing ? t.accent : t.border).cursor_text()
          .track_focus(this.handle)
          .on_key_down((e, cx) => this.key(e, cx))
          .on_click((_e, cx) => { this.handle.focus(); cx.notify(); })
          .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
          .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
            .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : "Filtrer"))
          .when(Boolean(this.query), (el) => el.child(div().id("kts-clear").flex_none().text_color(t.dim).cursor_pointer()
            .hover((s) => s.text_color(t.foreground))
            .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; this.page = 0; cx.notify(); })
            .child(svg(I("x")).size(13)))))
        .child(h_flex().id("kts-refresh").h(36).px(12).gap(6).items_center().rounded(12).border(1).border_color(t.border)
          .text_size(12).text_color(this.busy ? t.dim : t.muted)
          .when(!this.busy, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)))
          .on_click((_e, cx) => { if (!checking()) this.scan(cx); cx.notify(); })
          .child(svg(I("refresh-cw")).size(13))
          .child(this.busy ? "Analyse…" : "Rafraîchir"))
        .child(div().flex_none().px(8).font_family(MONO).text_size(12).text_color(t.muted).child(count))
        .child(div().flex_1())
        .child(seg));
  }

  // ---------- list ----------

  groupRow(t, label, n, first) {
    return h_flex().px(8).pt(first ? 6 : 14).pb(6).gap(10).items_center()
      .child(this.eyebrow(t, `${label} · ${n}`).flex_none())
      .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border));
  }

  row(t, x) {
    const on = x.key === this.sel;
    const hot = on || x.key === this.hot;
    const badges = [];
    if (x.kind === "command" && x.source !== "personal") badges.push("commande");
    if (x.model) badges.push(`modèle ${x.model}`);
    if (x.tools) badges.push("outils restreints");
    if (x.off) badges.push("non invocable");
    return v_flex().id(`kts-row-${x.key}`).px(14).py(10).gap(3).rounded(12).border(1)
      .border_color(on ? alpha(t.accent, "66") : t.border)
      .bg(on ? alpha(t.accent, "24") : t.background)
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .cursor_pointer()
      .on_click((_e, cx) => { this.select(x, cx); cx.notify(); })
      .on_hover((h, cx) => {
        const next = h ? x.key : this.hot === x.key ? null : this.hot;
        if (next !== this.hot) { this.hot = next; cx.notify(); }
      })
      .child(h_flex().h(20).gap(8).items_center()
        .child(h_flex().min_w(0).items_center().font_family(MONO).text_size(13).font_medium()
          .when(x.invocable, (el) => el.child(div().flex_none().text_color(t.dim).child("/")))
          .child(div().min_w(0).truncate().text_color(t.foreground).child(x.name)))
        .children(badges.map((b) => this.tag(t, t.dim, b)))
        .child(div().flex_1())
        .child(this.tag(t, t.muted, SOURCE[x.source]))
        .child(div().w(46).flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(x.harness)))
      .child(div().truncate().text_size(12.5).text_color(x.description ? t.muted : t.dim)
        .child(x.unreadable ? "Fichier illisible." : x.description || "Pas de description."))
      .child(h_flex().h(20).gap(8).items_center()
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.dim).child(tilde(x.real)))
        .when(hot, (el) => el.child(h_flex().flex_none().gap(2)
          .child(this.icon(t, `kts-see-${x.key}`, OWN("eye"), "Aperçu", (cx) => this.select(x, cx)))
          .child(this.icon(t, `kts-copy-${x.key}`, OWN("copy"), x.invocable ? `Copier /${x.name}` : "Copier le nom", (cx) => this.copy(x, cx)))
          .child(this.icon(t, `kts-open-${x.key}`, I("external-link"), "Ouvrir dans Zed", () => this.zed(x))))));
  }

  // A group's "Fragments et templates · N", folded by default; a click unfolds it.
  foldRow(t, e) {
    return h_flex().id(`kts-fold-${e.glabel}`).h(36).px(14).gap(8).items_center().rounded(12).border(1).border_dashed()
      .border_color(t.border).text_size(12.5).text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        if (this.unfolded.has(e.glabel)) this.unfolded.delete(e.glabel);
        else this.unfolded.add(e.glabel);
        cx.notify();
      })
      .child(svg(I(e.open ? "chevron-down" : "chevron-right")).size(13).flex_none())
      .child(`Fragments et templates · ${e.fold}`);
  }

  list(t, shown) {
    const card = this.card(t).flex_1().min_w(0).h_full();
    if (!shown.length) {
      const text = this.error ?? (!this.scanned || this.busy ? "Analyse des skills…" : this.items.length ? "Aucun skill ne correspond au filtre." : "Aucun skill trouvé.");
      return card.child(this.empty(t, text, this.error ? t.ansi1 : t.dim));
    }
    const per = {}, internal = {};
    for (const x of shown) {
      per[x.glabel] = (per[x.glabel] ?? 0) + 1;
      if (x.internal) internal[x.glabel] = (internal[x.glabel] ?? 0) + 1;
    }
    // What the pages hold: the rows, each group's internal bricks (sorted last) behind one fold.
    const entries = [];
    shown.forEach((x, i) => {
      const open = this.unfolded.has(x.glabel);
      const prev = shown[i - 1];
      if (x.internal && !(prev?.internal && prev.glabel === x.glabel)) entries.push({ glabel: x.glabel, fold: internal[x.glabel], open });
      if (!x.internal || open) entries.push({ glabel: x.glabel, x });
    });
    if (this.reveal) {
      const at = entries.findIndex((e) => e.x?.key === this.reveal);
      if (at >= 0) this.page = Math.floor(at / PAGE);
      else this.reveal = null; // folded away: open the detail only
    }
    const pages = Math.ceil(entries.length / PAGE);
    const page = Math.min(this.page, pages - 1);
    const from = page * PAGE;
    const slice = entries.slice(from, from + PAGE);
    const rows = [];
    slice.forEach((e, i) => {
      if (i === 0 || slice[i - 1].glabel !== e.glabel) rows.push(this.groupRow(t, e.glabel, per[e.glabel], i === 0));
      if (e.x && e.x.key === this.reveal) { this.scroll.scroll_to_item(rows.length); this.reveal = null; }
      rows.push(e.x ? this.row(t, e.x) : this.foldRow(t, e));
    });
    const go = (p) => (_e, cx) => { this.page = p; this.scroll.scroll_to_item(0); cx.notify(); };
    // The pager sits 4 px inside the card (16): its buttons are 12.
    const step = (id, label, to, ok) => h_flex().id(id).h(30).px(11).items_center().rounded(12).border(1).border_color(t.border)
      .text_size(12).text_color(ok ? t.muted : t.dim)
      .when(ok, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(go(to)))
      .when(!ok, (el) => el.opacity(0.5))
      .child(label);
    return card
      .child(v_flex().id("kts-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).p(4).gap(4).children(rows))
      .when(pages > 1, (el) => el.child(this.dashed(t)).child(h_flex().flex_none().p(4).gap(4).items_center()
        .child(this.eyebrow(t, `${from + 1}–${from + slice.length} sur ${entries.length}`).px(10).flex_1())
        .child(step("kts-prev", "‹ Précédents", page - 1, page > 0))
        .child(step("kts-next", "Suivants ›", page + 1, page < pages - 1))));
  }

  // ---------- detail ----------

  detail(t, x, w) {
    const meta = Object.entries(x.meta).filter(([k]) => k !== "description");
    const pair = (k, v) => h_flex().gap(10).items_start()
      .child(this.eyebrow(t, k).w(150).flex_none().pt(1))
      .child(div().flex_1().min_w(0).font_family(MONO).text_size(12).text_color(t.foreground).child(v || "—"));
    const path = (label, p) => h_flex().gap(8).items_center()
      .child(this.eyebrow(t, label, t.dim).w(64).flex_none())
      .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.muted).child(tilde(p)));
    // The card (16) holds everything 4 px in: the close button in its corner is 12.
    return this.card(t).w(w).flex_none().h_full().p(4).overflow_hidden()
      .child(h_flex().flex_none().h(32).pl(14).gap(8).items_center()
        .child(this.eyebrow(t, `${x.glabel}${x.version ? ` · ${x.version}` : ""}`).flex_1().min_w(0).truncate())
        .child(this.tag(t, t.muted, x.harness))
        .child(h_flex().id("kts-close").size(32).flex_none().items_center().justify_center().rounded(12).text_color(t.muted)
          .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip("Fermer")
          .on_click((_e, cx) => { this.sel = null; this.code?.release(); this.code = null; cx.notify(); })
          .child(svg(I("x")).size(14))))
      .child(v_flex().flex_none().px(14).pt(2).pb(12).gap(8)
        .child(div().font_family(MONO).text_size(17).font_semibold().line_height("24px").text_color(t.foreground)
          .child(x.invocable ? `/${x.name}` : x.name))
        .child(v_flex().gap(2)
          .child(path("Fichier", x.real))
          .when(x.path !== x.real, (el) => el.child(path("Via", x.path))))
        .child(h_flex().flex_wrap().gap(6).pt(4)
          .child(this.pill(t, "copy", x.invocable ? `Copier /${x.name}` : "Copier le nom", OWN("copy"), (cx) => this.copy(x, cx)))
          .child(this.pill(t, "zed", "Ouvrir dans Zed", I("external-link"), () => this.zed(x)))
          .child(this.pill(t, "finder", "Révéler dans le Finder", I("folder"), () => exec("open", ["-R", x.real]).catch(() => {})))))
      .child(this.dashed(t))
      // As tall as its text: the SKILL.md view below takes the rest.
      .child(v_flex().flex_none().px(14).py(12).gap(12)
        .child(div().text_size(13).line_height("19px").text_color(x.description ? t.foreground : t.dim).child(x.description || "Pas de description."))
        .when(meta.length > 0, (el) => el.child(v_flex().gap(6).children(meta.map(([k, v]) => pair(k, fmt(v)))))))
      .child(this.dashed(t))
      .child(h_flex().flex_none().px(14).pt(10).pb(6).child(this.eyebrow(t, x.real.split("/").pop())))
      .child(v_flex().flex_1().min_h(160).px(4).pb(4)
        .child(this.code && this.codeKey === x.key ? Editor.new(this.code).flex_1().min_h(0) : this.empty(t, "Chargement…")));
  }

  render(cx) {
    const vis = visible();
    if (vis && !checking()) {
      if (!this.shown) {
        // The thread's terminal is hidden under this page: take the keyboard (typing filters),
        // after the app has settled its own focus on the switch.
        cx.timer.after(150, (cx) => {
          if (visible()) this.handle.focus();
          cx.notify();
        });
        this.scan(cx);
      } else if (!this.busy && (activeSpace()?.id ?? null) !== this.space) this.scan(cx);
    }
    if (!vis && this.shown && this.handle.is_focused() && !checking()) {
      // Back to the thread: the keyboard goes back to its terminal.
      const tab = activeSpace()?.tabs.find((c) => c.active)?.id;
      const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
      if (pane) cx.spawn(async () => run("pane.focus", { pane }));
    }
    this.shown = vis;
    const t = theme();
    const x = this.items.find((i) => i.key === this.sel);
    // A look switch (dark/light): the preview's colors are fixed at creation.
    if (x && this.code && this.codeDark !== (settings().dark !== false)) this.loadBody(x, cx);
    const q = this.queried();
    const shown = q.filter((i) => this.matches(i, this.seg));
    // No frame of its own as a page: the layout's center column (chrome, radius 20, padding 4)
    // holds it. As a frameless dialog (frame: "none") it draws that same frame.
    return v_flex().id("kts-root").size_full().gap(4).text_color(t.foreground)
      .when(Boolean(props()?.overlay), (el) => el.p(4).rounded(20).border(1).border_color(t.border).bg(t.chrome))
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
      .child(this.header(t, q, shown.length))
      .child(h_flex().flex_1().min_h(0).gap(4)
        .child(this.list(t, shown))
        .when(Boolean(x), (el) => el.child(this.detail(t, x, Math.round(this.width * 0.45)))));
  }
}
