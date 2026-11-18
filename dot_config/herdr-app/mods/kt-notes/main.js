// kbrdn Threads' Notes: the "notes" child of kbrdn-threads' main "view" stack, under Worktrees in the
// sidebar. Notes for the project on screen, in two parts:
// 1. The PROJECT note, free markdown (todo, ideas, links, context), at
//    `<git common dir>/kbrdn/notes/project.md`: local, never committed, one per repo and shared by its
//    worktrees (the common dir is theirs too), out of gwm's `gwm/notes` (gwm doctor would report it as
//    the orphan note of a branch named "project").
// 2. The WORKTREE notes of gwm (gwm-cli src/notes.rs), in gwm's own files:
//    `<common dir>/gwm/notes/<branch>.md`, so a note written here is the one `gwm note show` prints and
//    the TUI's `N` opens, and the other way round. Every worktree of `gwm list --format=json` (from the
//    main checkout) with its note; a note no worktree holds any more is listed apart, read only:
//    « worktree retiré » (gwm remove keeps the branch) or « branche supprimée » (gwm doctor's orphan).
// Scope: the shown space's repo (shared "kt.project" not "*"); with "Tous les projets" ("*"), at home or
// outside git, the projects of the registry (shared "kt.projects") that have notes, then those without.
// A project picked there, or one sent by shared "kt-notes.open" ({ root, worktree, at }: root any
// folder of the repo, worktree a worktree's path or null; taken once, under a minute old), stays until
// the space or the project filter changes.
// Reading: the markdown (TextView.markdown), its `- [ ]` / `- [x]` boxes drawn one by one and ticked
// on a click or x (the TUI's toggle, notes.js). Editing: EditorState (markdown, no vim mode in it),
// saved with ctrl-s / cmd-s and 1.5 s after the last change, through writeTextFile's compare-and-swap:
// a file changed elsewhere since it was read is never overwritten, the note says « modifiée ailleurs »
// and offers Recharger or Garder la mienne. A blank note is written empty (gwm reads blank as no
// note); nothing is ever deleted here. A space on another machine reads (readTextFile { on }) and
// never writes, and says why.
// Sync: watchFolder on the shown repo's common dir while the page shows (notes, worktrees, branches;
// a change under an open note follows notes.js external()), the bus (DATA-SYNC.md: bumps "notes" and
// "notes:<root>" after each write, listens to "notes" and "gwm") and a reread on coming back.
// Keys (vim.js; kt-keys lists them under Pages): the page takes the keyboard in NORMAL. List: j/k,
// gg/G, ctrl-d/u move, enter/o/l open the note, i opens it to edit, / searches the notes (INSERT), tab
// / shift-tab the section filter (Tout, Projet, Worktrees, Orphelines), y copies the note's path, r
// rereads, h back to every project (when one was picked), esc clears the search, then back to the
// thread, q back to the thread, ? kt-keys. Note: j/k move over its boxes, x or space ticks one, i edits,
// h or esc back to the list. Editing: the editor types; ctrl-s saves, esc back to reading.
// For tests: `kt-notes.key:<keys>` types keys, `kt-notes.select:<row id>` opens a row,
// `kt-notes.type:<text>` replaces the open note as typing would (autosave armed), `kt-notes.write:<text>`
// does and saves at once, `kt-notes.save`, `kt-notes.resolve:keep|reload` (the conflict's buttons),
// `kt-notes.open:<root>|<worktree>` (writes shared "kt-notes.open" as kt-gwm does).

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, TextView, Editor, EditorState } from "gpui-base";
import { exec, theme, spaces, panes, run, layout, openOverlay, notify, nextCommand, props, shared, setShared, home, watchFolder, checking, settings, readTextFile, writeTextFile } from "herdr";import { filterRow, filterState, nextKey } from "./filters.js";
import { dither, iconBtn, bandRow } from "./band.js";
import { motionState, frame, enter, pulse, rows as motionRows } from "./motion.js";
// kt-keys' roll.js (a byte-identical copy): the head's counts roll to their new digits.
import { rollText } from "./roll.js";
import { bump, refreshOn } from "./bus.js";
import { Vim, keysOf, keyOf, step } from "./vim.js";
import { notePath, projectPath, normalize, present, segments, toggleTask, preview, parseFind, classify, caseRival, external, relativePath } from "./notes.js";
import { makeT, relative } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
// A read-only reason ({ key, vars }, kept by the open note): said in the language shown.
const says = (r) => (r && typeof r === "object" ? tr(r.key, r.vars) : r);

const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const PEN = "mods/kt-notes/notebook-pen.svg";
const PAGE = "notes"; // in the "view" stack
const SAVE_AFTER = 1500;
const STALE = 10e3; // a page coming back rereads what is older
// The notes of a repo with their dates, one call: gwm's and the project's, symlinks left out as gwm's
// collect_files does (find -type f doesn't follow them). BSD stat here, GNU stat on a Linux machine.
const FIND = 'cd "$1" 2>/dev/null || exit 0; for d in gwm/notes kbrdn/notes; do [ -d "$d" ] && find "$d" -type f -name "*.md" -exec sh -c \'stat -f "%m %N" "$@" 2>/dev/null || stat -c "%Y %n" "$@"\' sh {} +; done; exit 0';

const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const parse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
const sh = (cmd, args, o = {}) => exec(cmd, args, { timeout: 20e3, ...o }).catch((e) => ({ code: -1, stdout: "", stderr: String(e) }));
const lastLine = (s) => String(s ?? "").trim().split("\n").filter(Boolean).pop() ?? "";
const trim = (p) => (typeof p === "string" && p.length > 1 ? p.replace(/\/+$/, "") : p);
const inside = (cwd, p) => Boolean(cwd && p) && (cwd === p || cwd.startsWith(`${p}/`));
const tilde = (p) => (p && inside(p, home()) ? `~${p.slice(home().length)}` : p ?? "");
const isHome = (s) => !s.machine && trim(s.folder) === trim(home());
const errText = (e) => String(e?.message ?? e).replace(/^`herdr\.\w+`:\s*/, "");

const ago = (sec) => (sec ? relative(sec * 1000) : "");

// kt-gwm's logoOf(): a project's logo for the appearance now, else the other one's.
function logoOf(e) {
  const l = e?.logos ?? { light: e?.logo ?? null, dark: e?.logo ?? null };
  return (settings().dark ? (l.dark ?? l.light) : (l.light ?? l.dark)) ?? null;
}

function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
const activeChild = (n) => n?.active ?? n?.children?.[0]?.id;
const onPage = () => activeChild(find(layout(), "view")) === PAGE;
const show = (child) => run("layout.select", { stack: "view", child });
const registry = () => [...(shared("kt.projects") ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export default class Notes extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: true });
    this.scroll = ScrollHandle.new();
    this.readScroll = ScrollHandle.new();
    this.secRow = filterState();
    this.motion = motionState();
    this.query = "";
    this.sec = "all"; // the section filter: all | project | wt | orphan
    this.zone = "list"; // where NORMAL's keys go: the list, or the open note
    this.cur = null; // the list's cursor (a row id)
    this.task = 0; // the open note's box under the cursor
    this.repos = {}; // "machine|folder" -> repo | null (outside git)
    this.data = {}; // repo.id -> { at, notes, project, branches, wts, listError }
    this.inflight = {};
    this.doc = null; // the open note (open())
    this.pick = null; // { folder, machine }: a project picked in "Tous les projets" or sent by kt-notes.open
    this.allView = false; // "Tous les projets" pressed in a repo's view
    this.want = null; // the worktree path kt-notes.open asked for
    this.openSeen = 0;
    this.scopeSig = null;
    this.headW = 0;
    this.watching = null;
    this.watch$ = null;
    this.edFocus = false;
    if (checking()) return;
    // A hidden copy doesn't render: this tick notes the page left (save, unwatch, keyboard back) and
    // drops the cursor's ring once the keyboard went elsewhere. No redraw unless one of those changed.
    cx.timer.every(1000, (cx) => {
      if (this.shown && !this.visible()) this.leave(cx);
      else if (this.shown && this.keyed !== (this.handle.is_focused() || this.edFocus)) cx.notify();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn();
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        } else if (c.startsWith("select:")) {
          const it = this.items().find((x) => x.id === c.slice(7));
          if (it) this.open(it, cx);
        } else if (c.startsWith("write:") && this.doc && !this.doc.readonly) {
          this.setText(this.doc, c.slice(6));
          this.save(this.doc, cx);
        } else if (c.startsWith("type:") && this.doc && !this.doc.readonly) {
          // As typing: the buffer changes, the 1.5 s autosave is armed.
          this.setText(this.doc, c.slice(5));
          this.changed(this.doc, cx);
        } else if (c.startsWith("open:")) {
          // kt-gwm's channel, as kt-gwm writes it: "open:<root>|<worktree path>".
          const [root, worktree] = c.slice(5).split("|");
          setShared("kt-notes.open", { root, worktree: worktree || null, at: Date.now() });
        } else if (c === "resolve:keep" || c === "resolve:reload") this.resolve(c === "resolve:keep", cx);
        else if (c === "save" && this.doc) this.save(this.doc, cx);
        else if (c === "refresh") this.reload(cx, true);
        cx.notify();
      }
    });
  }

  // An overlay copy (tests, mod.open) always counts as shown.
  visible() {
    return Boolean(props()?.overlay) || onPage();
  }

  // ---------- data ----------

  // A folder's repo (git's common dir), once per folder and machine; undefined while asked.
  repoAt(folder, machine, cx) {
    const k = `${machine ?? ""}|${folder}`;
    if (k in this.repos) return this.repos[k];
    if (this.inflight[k] || checking()) return undefined;
    this.inflight[k] = true;
    cx.spawn(async (cx) => {
      const r = await sh("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder, on: machine ?? null });
      delete this.inflight[k];
      const common = r.code === 0 ? trim(r.stdout.trim()) : "";
      const main = common.endsWith("/.git") ? common.slice(0, -5) : null;
      this.repos[k] = common ? { id: `${machine ?? ""}|${common}`, folder, machine: machine ?? null, common, main, name: (main ?? common).split("/").pop().replace(/\.git$/, "") } : null;
      cx.notify();
    });
    return undefined;
  }

  // The notes of a repo: gwm's and the project's, read, with their dates and the local branches.
  async readNotes(repo) {
    const on = repo.machine;
    const [f, refs] = await Promise.all([
      sh("sh", ["-c", FIND, "sh", repo.common], { on }),
      sh("git", ["for-each-ref", "--format=%(refname)", "refs/heads"], { cwd: repo.main ?? repo.folder, on }),
    ]);
    const files = parseFind(f.stdout).slice(0, 400);
    const texts = await Promise.all(files.map((x) => readTextFile(`${repo.common}/${x.rel}`, { on }).catch(() => null)));
    const all = files.map((x, i) => ({ ...x, text: texts[i] }));
    return {
      notes: all.filter((x) => x.kind === "gwm"),
      project: all.find((x) => x.kind === "project") ?? null,
      branches: refs.stdout.split("\n").map((l) => l.trim().replace(/^refs\/heads\//, "")).filter(Boolean),
    };
  }

  // A repo's worktrees (gwm list, from the main checkout): name, branch, path, main or not.
  async readList(repo) {
    const r = await sh("gwm", ["list", "--format=json"], { cwd: repo.main ?? repo.folder, on: repo.machine, timeout: 30e3 });
    const rows = r.code === 0 ? parse(r.stdout, null) : null;
    if (!Array.isArray(rows)) return { wts: null, listError: lastLine(r.stderr || r.stdout) || tr("listFailed", { code: r.code }) };
    return { wts: rows.map((w) => ({ name: w.name, branch: w.branch ?? null, path: trim(w.path), is_main: Boolean(w.is_main) })), listError: null };
  }

  // `list`: gwm list too (a repo's view); the "Tous les projets" view reads the notes only.
  load(repo, cx, list) {
    const k = `l:${repo.id}:${list ? 1 : 0}`;
    if (this.inflight[k]) return;
    this.inflight[k] = true;
    cx.spawn(async (cx) => {
      const [n, l] = await Promise.all([this.readNotes(repo), list ? this.readList(repo) : null]);
      delete this.inflight[k];
      const prev = this.data[repo.id];
      this.data[repo.id] = { ...prev, ...n, ...(l ?? {}), at: Date.now(), listed: Boolean(list || prev?.listed) };
      await this.checkDoc(repo, cx);
      cx.notify();
    });
  }

  // The shown scope again: its repo (its worktrees too, unless `notesOnly`), or every project of the
  // registry (their notes only: no gwm list per project).
  reload(cx, force, notesOnly = false) {
    const sc = this.sc;
    if (!sc || checking()) return;
    const old = (r) => force || !this.data[r.id] || Date.now() - this.data[r.id].at > STALE;
    if (sc.kind === "repo") {
      const listed = this.data[sc.repo.id]?.listed;
      if (old(sc.repo) || !listed) this.load(sc.repo, cx, !notesOnly || !listed);
    }
    if (sc.kind === "all") for (const p of sc.projects) if (p.repo && old(p.repo)) this.load(p.repo, cx, false);
  }

  // What this page shows: { kind: "repo", repo, picked } | { kind: "all", projects } | { kind: "wait" }.
  scope(cx) {
    const s = spaces().find((x) => x.active);
    const every = shared("kt.project") === "*";
    const sig = `${s?.id ?? ""}|${every}`;
    if (sig !== this.scopeSig) {
      if (this.scopeSig !== null) { this.pick = null; this.allView = false; }
      this.scopeSig = sig;
    }
    // kt-notes.open (kt-gwm's Note): a repo and a worktree to open, once.
    const o = shared("kt-notes.open");
    if (o?.root && o.at > this.openSeen && Date.now() - o.at < 60e3) {
      this.openSeen = o.at;
      this.pick = { folder: trim(String(o.root)), machine: o.machine ?? null };
      this.want = o.worktree ? trim(String(o.worktree)) : null;
      this.allView = false;
    }
    if (this.pick) {
      const r = this.repoAt(this.pick.folder, this.pick.machine, cx);
      if (r === undefined) return { kind: "wait" };
      if (r) return { kind: "repo", repo: r, picked: true };
    }
    const folder = s && !isHome(s) ? trim(s.folder) : null;
    if (!every && !this.allView && folder) {
      const r = this.repoAt(folder, s.machine, cx);
      if (r === undefined) return { kind: "wait" };
      if (r) return { kind: "repo", repo: r, picked: false };
    }
    // repo: undefined while git is asked, null outside git.
    const projects = registry().filter((e) => e.folder).map((e) => ({ e, repo: this.repoAt(trim(e.folder), e.machine ?? null, cx) }));
    return { kind: "all", projects };
  }

  // A registry entry for a repo: by folder (its main checkout, or the folder asked), else by name.
  projectOf(repo) {
    const reg = registry().filter((x) => (x.machine ?? null) === repo.machine);
    return reg.find((x) => x.folder && [repo.main, repo.folder].includes(trim(x.folder))) ?? reg.find((x) => x.name === repo.name) ?? null;
  }

  colorOf(t, e) {
    const c = e?.color;
    return (c && (String(c).startsWith("#") ? c : t[c])) || t.ansi3;
  }

  // kt-gwm's mark(): the logo 1:1 in a rounded tile, else the initial on the project's color.
  mark(t, e, name, size) {
    const r = Math.max(3, Math.round(size / 4));
    const logo = logoOf(e);
    if (logo) return div().size(size).flex_none().rounded(r).overflow_hidden().child(image(logo).size(size));
    return div().size(size).flex_none().rounded(r).bg(this.colorOf(t, e)).flex().items_center().justify_center()
      .child(div().text_size(Math.round(size * 0.55)).font_semibold().text_color(t.chrome).child([...(e?.name ?? name ?? "?")][0].toUpperCase()));
  }

  // ---------- rows ----------

  // Every row of a repo's view, in order: the project note, the worktrees, the notes without one.
  rowsOf(repo) {
    const d = this.data[repo.id];
    if (!d) return [];
    const remote = repo.machine ? { key: "ro.remote" } : null;
    const p = d.project;
    const out = [{ id: "project", kind: "project", title: tr("projectNote"), text: present(p?.text) ? p.text : null, mtime: p?.mtime ?? 0,
      path: projectPath(repo.common), readonly: remote }];
    // Read by "Tous les projets" only (no gwm list yet): no worktree row, no orphan until the list comes.
    const { rows, orphans } = d.listed ? classify(d.wts ?? [], d.notes ?? [], d.branches ?? []) : { rows: [], orphans: [] };
    for (const w of rows) {
      const path = notePath(repo.common, w.branch);
      const rival = w.branch && caseRival(w.branch, d.branches ?? []);
      const why = !w.branch ? { key: "ro.detached" }
        : !relativePath(w.branch) ? { key: "ro.badName" }
        : rival ? { key: "ro.case", vars: { branch: w.branch, rival } } : remote;
      out.push({ id: `wt:${w.path}`, kind: "wt", title: w.name, w, branch: w.branch, text: w.note?.text ?? null, mtime: w.note?.mtime ?? 0, path, readonly: why });
    }
    // gwm list failed: its notes have no worktree to sit on, they stay listed (read only), said so.
    for (const o of orphans) out.push({ id: `or:${o.branch}`, kind: "orphan", title: o.branch, branch: o.branch, gone: o.gone, text: o.text, mtime: o.mtime,
      path: `${repo.common}/${o.rel}`, readonly: { key: d.wts ? "ro.orphan" : "ro.noList" } });
    return out;
  }

  matches(it) {
    const q = this.query.trim().toLowerCase();
    if (this.sec !== "all" && it.kind !== this.sec) return false;
    return !q || `${it.title} ${it.branch ?? ""} ${it.text ?? ""}`.toLowerCase().includes(q);
  }

  // What the list's cursor walks: the rows shown (a repo), or the projects (every project).
  items() {
    const sc = this.sc;
    if (sc?.kind === "repo") return this.rowsOf(sc.repo).filter((it) => this.matches(it));
    if (sc?.kind === "all") return this.projectRows(sc).filter((p) => !this.query || `${p.e.name} ${p.text ?? ""}`.toLowerCase().includes(this.query.trim().toLowerCase()));
    return [];
  }

  // "Tous les projets": each registry project with what it has, those with notes first.
  projectRows(sc) {
    return sc.projects.map(({ e, repo }) => {
      const d = repo && this.data[repo.id];
      const n = (d?.notes ?? []).filter((x) => present(x.text)).length;
      const text = present(d?.project?.text) ? d.project.text : null;
      const mtime = Math.max(d?.project?.mtime ?? 0, ...(d?.notes ?? []).filter((x) => present(x.text)).map((x) => x.mtime));
      return { id: `p:${e.id ?? e.folder}`, e, repo, d, n, text, mtime, has: Boolean(text || n) };
    }).sort((a, b) => b.has - a.has);
  }

  // ---------- the open note ----------

  text(d) {
    return d.ed ? d.ed.value() : d.buf;
  }

  setText(d, s) {
    if (d.ed) d.ed.set_value(s);
    else d.buf = s;
  }

  dirty(d) {
    return normalize(this.text(d)) !== normalize(d.base);
  }

  open(it, cx, edit = false) {
    const sc = this.sc;
    if (sc?.kind === "all") {
      if (it.repo) {
        this.pick = { folder: it.repo.folder, machine: it.repo.machine };
        this.cur = null;
      }
      return;
    }
    if (sc?.kind !== "repo") return;
    this.cur = it.id;
    if (this.doc?.id === it.id && this.doc.repo.id === sc.repo.id) {
      this.zone = "note";
      if (edit) this.edit(cx);
      return;
    }
    this.flush(cx);
    this.doc?.ed?.release();
    const repo = sc.repo;
    const d = (this.doc = { id: it.id, repo, root: repo.main ?? repo.common, kind: it.kind, title: it.title, branch: it.branch ?? null, path: it.path,
      readonly: it.readonly ?? null, base: it.text ?? null, buf: it.text ?? "", ed: null, mode: "read", loading: Boolean(it.path),
      conflict: null, saving: false, savedAt: 0, error: null, gen: 0, mark: false });
    this.task = 0;
    this.zone = "note";
    if (!it.path) return;
    // The file as it is now: the cached text is only what the list showed.
    cx.spawn(async (cx) => {
      const disk = await readTextFile(d.path, { on: repo.machine }).catch(() => null);
      if (this.doc !== d) return;
      d.loading = false;
      if (!this.dirty(d)) { d.base = disk; this.setText(d, disk ?? ""); } else d.base = disk;
      if (edit) this.edit(cx);
      cx.notify();
    });
  }

  edit(cx) {
    const d = this.doc;
    if (!d || d.readonly || d.loading) return;
    if (!d.ed) {
      const t = theme();
      d.ed = EditorState.new({ language: "markdown", value: d.buf, soft_wrap: true, line_numbers: false, folding: false,
        font_family: settings().font_family, font_size: 13,
        syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6, punctuation: t.muted } });
      d.ed.on("change", (_e, cx) => this.changed(d, cx));
      d.ed.on("focus", (_e, cx) => { this.edFocus = true; this.zone = "note"; d.mode = "edit"; cx.notify(); });
      d.ed.on("blur", (_e, cx) => { this.edFocus = false; cx.notify(); });
    }
    d.mode = "edit";
    this.zone = "note";
    d.ed.focus();
  }

  // Back to reading: whatever is typed goes to disk now, the keyboard to the page.
  read(cx) {
    const d = this.doc;
    if (!d) return;
    d.mode = "read";
    this.flush(cx);
    this.handle.focus();
    this.vim.normal();
  }

  // A change typed in the editor: saved 1.5 s after the last one (a newer change makes it moot).
  changed(d, cx) {
    const g = ++d.gen;
    if (!d.mark) { d.mark = true; cx.notify(); }
    cx.timer.after(SAVE_AFTER, (cx) => { if (d.gen === g && this.doc === d) this.save(d, cx); });
  }

  flush(cx) {
    const d = this.doc;
    if (d && !d.readonly && !d.conflict && this.dirty(d)) this.save(d, cx);
  }

  // To disk, only if it differs, through writeTextFile's compare-and-swap on the text last read: a
  // file changed elsewhere is never overwritten (« modifiée ailleurs »). gwm's disk form (normalize).
  save(d, cx) {
    if (d.readonly || d.conflict || !d.path) return;
    if (d.saving) { d.again = true; return; }
    const text = normalize(this.text(d));
    if (text === normalize(d.base)) { d.mark = false; return; } // unchanged (blank and absent too)
    d.saving = true;
    cx.spawn(async (cx) => {
      try {
        await writeTextFile(d.path, text, d.base);
        d.base = text;
        d.savedAt = Date.now();
        d.error = null;
        this.patch(d, text);
        bump("notes", `notes:${d.root}`);
      } catch (e) {
        const disk = await readTextFile(d.path, { on: d.repo.machine }).catch(() => undefined);
        if (disk !== undefined && normalize(disk) === text) d.base = disk;
        else if (disk !== undefined && disk !== d.base) d.conflict = { disk };
        else d.error = errText(e);
      }
      d.saving = false;
      d.mark = this.dirty(d);
      if (d.again) { d.again = false; this.save(d, cx); }
      cx.notify();
    });
  }

  // The list follows a write without waiting for the reread.
  patch(d, text) {
    const data = this.data[d.repo.id];
    if (!data) return;
    const now = Math.floor(Date.now() / 1000);
    if (d.kind === "project") data.project = { ...(data.project ?? {}), kind: "project", text, mtime: now };
    else if (d.branch) {
      const n = data.notes.find((x) => x.branch === d.branch);
      if (n) Object.assign(n, { text, mtime: now });
      else data.notes.push({ kind: "gwm", branch: d.branch, rel: d.path.slice(d.repo.common.length + 1), text, mtime: now });
    }
  }

  // The open note's file moved on disk (a watch, the bus): notes.js external() decides.
  async checkDoc(repo, cx) {
    const d = this.doc;
    if (!d || d.repo.id !== repo.id || !d.path || d.saving || d.loading) return;
    const disk = await readTextFile(d.path, { on: repo.machine }).catch(() => undefined);
    if (disk === undefined || this.doc !== d || d.saving) return;
    const act = external(disk, d.base, this.text(d));
    if (act === "adopt") d.base = disk;
    else if (act === "reload") { d.base = disk; this.setText(d, disk ?? ""); d.mark = false; }
    else if (act === "conflict") d.conflict = { disk };
    if (act !== "none") cx.notify();
  }

  // « Recharger »: the disk's text replaces the buffer. « Garder la mienne »: the buffer goes over the
  // text read again now (still compare-and-swap: a third change in between asks again).
  resolve(keep, cx) {
    const d = this.doc;
    if (!d?.conflict) return;
    cx.spawn(async (cx) => {
      const disk = await readTextFile(d.path, { on: d.repo.machine }).catch(() => null);
      d.conflict = null;
      d.base = disk;
      if (keep) this.save(d, cx);
      else { this.setText(d, disk ?? ""); d.mark = false; }
      cx.notify();
    });
  }

  // A box of the open note, ticked or unticked, saved at once (a click is an act).
  toggle(line, cx) {
    const d = this.doc;
    if (!d || d.readonly || d.loading || d.conflict) return;
    this.setText(d, toggleTask(this.text(d), line));
    this.save(d, cx);
  }

  // ---------- refresh on file events (this machine) ----------

  watch(repo, cx) {
    const key = repo && !repo.machine ? repo.id : null;
    if (this.watching === key) return;
    this.unwatch();
    if (!key) return;
    this.watching = key;
    const c = repo.common;
    cx.spawn(async (cx) => {
      while (this.watching === key) {
        const w = (this.watch$ = watchFolder(c));
        let paths;
        try { paths = await w; } catch { return; } // no room left: the bus and the return to the page
        if (this.watching !== key || !paths.length) return; // [] = cancelled
        const notes = paths.some((p) => p === c || inside(p, `${c}/gwm/notes`) || inside(p, `${c}/kbrdn/notes`) || p === `${c}/gwm` || p === `${c}/kbrdn`);
        const refs = paths.some((p) => inside(p, `${c}/refs/heads`) || p === `${c}/packed-refs`);
        const wts = paths.some((p) => p === c || p === `${c}/worktrees` || /^\/worktrees\/[^/]+(\/(HEAD|gitdir))?$/.test(p.slice(c.length)));
        if (notes || refs || wts) this.soon(repo, wts, cx);
      }
    });
  }

  unwatch() {
    this.watching = null;
    this.watch$?.cancel();
    this.watch$ = null;
  }

  soon(repo, list, cx) {
    this.later = { list: Boolean(this.later?.list || list) };
    if (this.laterArmed) return;
    this.laterArmed = true;
    cx.timer.after(400, (cx) => {
      const l = this.later?.list;
      this.laterArmed = false;
      this.later = null;
      if (this.visible()) this.load(repo, cx, l || !this.data[repo.id]?.listed);
    });
  }

  // The page went away (another page, the thread): what is typed goes to disk, the watch stops, the
  // keyboard goes back to the thread's pane if it was here.
  leave(cx) {
    this.flush(cx);
    this.unwatch();
    this.shown = false;
    if (this.handle.is_focused() || this.edFocus) {
      this.edFocus = false;
      const tab = spaces().find((s) => s.active)?.tabs.find((c) => c.active)?.id;
      const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
      if (pane) run("pane.focus", { pane });
    }
  }

  // ---------- keys ----------

  focusIn() {
    this.handle.focus();
    this.vim.normal();
    if (this.zone === "list" && !this.items().some((x) => x.id === this.cur)) this.cur = this.doc?.id ?? null;
    this.reveal = true;
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: typing in the editor, ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  press(k, cx) {
    const { name } = keyOf(k);
    const d = this.doc;
    const save = name === "ctrl-s" || name === "cmd-s";
    // In the editor: the page's own handle doesn't have the keyboard, so the key came up from it.
    // Decided from focus, not from the editor's focus event: typing must never run a page key.
    if (d?.mode === "edit" && d.ed && !this.handle.is_focused()) {
      if (save) { this.save(d, cx); return true; }
      if (name === "escape") { this.read(cx); return true; }
      return false; // the editor's
    }
    if (!this.vim.insert) {
      if (save) { if (d) this.save(d, cx); return true; }
      if (name === "i") {
        const it = this.zone === "list" ? this.cursorItem() : null;
        if (it) this.open(it, cx, true);
        else this.edit(cx);
        return true;
      }
      if (this.zone === "note" && (name === "x" || name === "space")) {
        const tasks = this.tasks();
        if (tasks[this.task]) this.toggle(tasks[this.task].line, cx);
        return true;
      }
    }
    return this.act(this.vim.handle(k), cx);
  }

  cursorItem() {
    const items = this.items();
    return items.find((x) => x.id === this.cur) ?? items[0] ?? null;
  }

  tasks() {
    return this.doc ? segments(this.text(this.doc)).filter((s) => s.kind === "task") : [];
  }

  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count" || a === "normal") return true;
    if (a === "filter") { this.zone = "list"; return true; }
    const moves = ["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev"];
    const mv = (x) => (x === "next" ? "down" : x === "prev" ? "up" : x);
    if (a === "type" || a === "backspace") {
      this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
      this.cur = null;
      return true;
    }
    if (a === "help") {
      openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
      return true;
    }
    if (a === "quit") { this.leaveTo(cx); return true; }
    if (a === "refresh") { this.reload(cx, true); return true; }
    if (this.zone === "note" && this.sc?.kind === "repo") {
      if (moves.includes(a)) {
        const n = this.tasks().length;
        const j = step(mv(a), this.task, n, this.vim.count, 8);
        if (j >= 0) this.task = j;
      } else if (a === "open" || a === "submit") this.edit(cx);
      // The editor still shown (it lost the keyboard to a click or ctrl-b): back to reading first.
      else if ((a === "left" || a === "escape") && this.doc?.mode === "edit") this.read(cx);
      else if (a === "left" || a === "escape") this.zone = "list";
      else if (a === "yank") this.copy(cx);
      else return false;
      return true;
    }
    const items = this.items();
    const it = this.cursorItem();
    const i = items.indexOf(it);
    if (a === "up" && i <= 0 && !this.vim.insert) this.vim.edit(); // k on the first row: the search
    else if (moves.includes(a)) {
      const j = step(mv(a), i, items.length, this.vim.count, 8);
      if (j >= 0) this.cur = items[j].id;
      this.reveal = true;
    } else if (a === "open" || a === "right" || a === "submit") { if (it) this.open(it, cx); this.vim.normal(); }
    else if (a === "tab-next" || a === "tab-prev") this.sec = nextKey(this.sections ?? [], this.sec, a === "tab-next" ? 1 : -1) ?? "all";
    else if (a === "yank") this.copy(cx);
    else if (a === "left") { if (this.sc?.picked || this.sc?.kind === "repo") this.toAll(); }
    else if (a === "escape" && this.query) { this.query = ""; this.cur = null; }
    else if (a === "escape") this.leaveTo(cx);
    else return false;
    return true;
  }

  leaveTo(cx) {
    show("thread");
    this.leave(cx);
  }

  toAll() {
    this.pick = null;
    this.allView = true;
    this.cur = null;
  }

  copy(cx) {
    const p = this.zone === "note" ? this.doc?.path : this.cursorItem()?.path ?? this.cursorItem()?.repo?.folder;
    if (!p) return;
    cx.write_to_clipboard(p);
    notify({ title: tr("pathCopied"), body: tilde(p), level: "success", timeout: 2500 });
  }

  // ---------- pieces ----------

  box(t) {
    return v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
  }

  eyebrow(t, text, color) {
    return div().font_family(MONO).text_size(11).text_color(color ?? t.muted).child(String(text).toUpperCase());
  }

  tag(t, color, text) {
    return h_flex().flex_none().h(18).px(7).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
      .text_color(color).font_family(MONO).text_size(10).child(String(text).toUpperCase());
  }

  pill(t, id, label, icon, on, tip, fn) {
    return h_flex().id(id).flex_none().h(26).px(10).gap(6).items_center().rounded_full().border(1)
      .border_color(on ? alpha(t.accent, "66") : t.border).bg(on ? alpha(t.accent, "24") : t.background)
      .text_size(12).text_color(on ? t.foreground : t.muted).cursor_pointer().tooltip(tip)
      .when(!on, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .on_click((_e, cx) => { cx.stop_propagation(); fn(cx); cx.notify(); })
      .child(svg(icon).size(12)).child(label);
  }

  mode(t) {
    const typing = this.vim.insert || this.edFocus;
    return div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(typing ? "INSERT" : "NORMAL");
  }

  // A list row: its icon, title (and branch), the note's first line, its date. `gone`: closing (rows()
  // gave it -1), drawn as it was but no longer a target.
  row(t, it, cursor, open, gone = false) {
    const icon = it.kind === "project" ? PEN : it.kind === "wt" ? I("git-branch") : I("circle-alert");
    const tint = it.kind === "project" ? t.accent : it.kind === "wt" ? t.ansi2 : t.ansi3;
    const pv = preview(it.text);
    return h_flex().id(`kn-row-${it.id}`).flex_none().h(54).px(10).gap(10).items_center().rounded(12).border(1)
      .border_color(cursor ? alpha(t.accent, "99") : open ? alpha(t.accent, "4d") : alpha(t.accent, "00"))
      .bg(cursor ? alpha(t.accent, "24") : open ? alpha(t.accent, "14") : alpha(t.accent, "00"))
      .when(!gone, (el) => el.cursor_pointer().when(!cursor && !open, (el) => el.hover((s) => s.bg(t.hover)))
        .on_click((_e, cx) => { this.open(it, cx); cx.notify(); }))
      .child(div().relative().flex_none().size(28).rounded(8).border(1).border_color(alpha(tint, "4d")).bg(alpha(tint, "1a")).flex().items_center().justify_center()
        .child(svg(icon).size(14).text_color(tint))
        .when(Boolean(it.text), (el) => el.child(div().absolute().right(-2).top(-2).size(8).rounded_full().border(2).border_color(t.background).bg(tint))))
      .child(v_flex().flex_1().min_w(0).overflow_hidden().gap(2)
        .child(h_flex().min_w(0).gap(6).items_center()
          // The title gives way before the tags (flex_none): a tag cut mid-word says nothing.
          .child(div().min_w(0).max_w(200).truncate().text_size(13).font_medium().text_color(t.foreground).child(it.title))
          .when(it.kind === "wt" && Boolean(it.branch) && it.branch !== it.title, (el) => el.child(div().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(it.branch)))
          .when(it.kind === "wt" && it.w?.is_main, (el) => el.child(this.tag(t, t.dim, tr("main"))))
          .when(it.kind === "orphan", (el) => el.child(this.tag(t, it.gone ? t.ansi3 : t.dim, it.gone ? tr("branchGone") : tr("wtGone")))))
        .child(div().truncate().text_size(12).text_color(pv ? t.muted : t.dim).child(pv || (it.kind === "project" ? tr("emptyProject") : !it.branch && it.kind === "wt" ? tr("detached") : tr("noNote")))))
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(it.mtime ? ago(it.mtime) : ""));
  }

  // The open note: its head (title, where it lives, its state, Lire / Éditer), a conflict or a reason
  // to read only, then the reader or the editor.
  note(t, d, keyed) {
    const reading = d.mode !== "edit" || !d.ed;
    const state = d.loading ? tr("st.reading") : d.saving ? tr("st.saving") : d.error ? tr("st.failed", { error: d.error }) : d.conflict ? tr("st.conflict")
      : d.mark ? tr("st.dirty") : d.savedAt ? tr("st.saved", { ago: ago(d.savedAt / 1000) }) : d.readonly ? tr("st.readonly") : "";
    const stateColor = d.error || d.conflict ? t.ansi3 : d.mark ? t.foreground : t.dim;
    const rel = d.path ? tilde(d.path) : "";
    const head = h_flex().flex_none().h(56).px(16).gap(10).items_center()
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(d.kind === "project" ? tr("projectNote") : d.title))
        .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child([d.branch, rel].filter(Boolean).join(" · "))))
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(stateColor).child(state))
      .when(!d.readonly, (el) => el.child(h_flex().flex_none().gap(4)
        .child(this.pill(t, "kn-read", tr("read"), "mods/kt-skills/eye.svg", reading, tr("readTip"), (cx) => this.read(cx)))
        .child(this.pill(t, "kn-edit", tr("edit"), I("square-pen"), !reading, tr("editTip"), (cx) => this.edit(cx)))))
      .child(iconBtn(t, "kn-copy", "mods/kt-gwm/copy.svg", tr("copyPath"), (cx) => this.copy(cx)));
    const banner = d.conflict && h_flex().flex_none().mx(12).mb(8).px(12).py(8).gap(10).items_center().rounded(12).border(1)
      .border_color(alpha(t.ansi3, "66")).bg(alpha(t.ansi3, "1a"))
      .child(svg(I("circle-alert")).size(14).flex_none().text_color(t.ansi3))
      .child(v_flex().flex_1().min_w(0)
        .child(div().text_size(12.5).font_medium().text_color(t.foreground).child(tr("conflict.title")))
        .child(div().text_size(12).text_color(t.muted).child(tr("conflict.body"))))
      .child(this.pill(t, "kn-reload", tr("reload"), I("refresh-cw"), false, tr("reloadTip"), (cx) => this.resolve(false, cx)))
      .child(this.pill(t, "kn-keep", tr("keep"), I("check"), false, tr("keepTip"), (cx) => this.resolve(true, cx)));
    const why = d.readonly && h_flex().flex_none().mx(16).mb(6).gap(8).items_center().text_size(12).text_color(t.dim)
      .child(svg(I("circle-alert")).size(12).flex_none()).child(div().min_w(0).truncate().child(says(d.readonly)));
    let body;
    if (!reading) {
      body = v_flex().flex_1().min_h(0).px(10).pb(10).child(Editor.new(d.ed).flex_1().min_h(0));
    } else {
      const segs = segments(this.text(d));
      const tasks = segs.filter((s) => s.kind === "task");
      if (this.task >= tasks.length) this.task = Math.max(0, tasks.length - 1);
      const curLine = keyed && this.zone === "note" ? tasks[this.task]?.line : null;
      body = segs.length
        ? v_flex().id(`kn-reader-${d.id}`).flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.readScroll).px(18).pt(4).pb(18).gap(6)
          .children(segs.map((s, i) => (s.kind === "md"
            ? div().text_size(13).text_color(t.foreground).child(TextView.markdown(`kn-md-${d.id}-${i}`, s.text).selectable(true))
            : this.taskRow(t, d, s, s.line === curLine))))
        : v_flex().flex_1().items_center().justify_center().gap(8).p(24)
          .child(svg(PEN).size(20).text_color(t.dim))
          .child(div().text_size(13.5).font_medium().text_color(t.foreground).child(d.loading ? tr("reading") : d.kind === "project" ? tr("noProjectNote") : tr("noNoteYet")))
          .child(div().max_w(420).text_size(12).text_color(t.dim).child(d.loading ? "" : d.readonly ? says(d.readonly)
            : d.kind === "project" ? tr("howto.project")
            : tr("howto.wt", { path: relativePath(d.branch) ?? "" })));
    }
    return v_flex().size_full().child(head).child(div().flex_none().mx(12).mb(8).h(0).border_t(1).border_dashed().border_color(t.border))
      .when(Boolean(banner), (el) => el.child(banner)).when(Boolean(why), (el) => el.child(why)).child(body);
  }

  // A box line: the box (a click ticks it), its text in markdown, dimmed once done.
  taskRow(t, d, s, cursor) {
    const can = !d.readonly && !d.conflict;
    return h_flex().id(`kn-task-${d.id}-${s.line}`).flex_none().pl(4 + s.indent * 7).pr(6).py(3).gap(8).items_start().rounded(8).border(1)
      .border_color(cursor ? alpha(t.accent, "99") : alpha(t.accent, "00")).when(cursor, (el) => el.bg(alpha(t.accent, "24")))
      .child(div().id(`kn-box-${d.id}-${s.line}`).mt(2).size(16).flex_none().rounded(5).border(1).flex().items_center().justify_center()
        .border_color(s.done ? t.accent : t.input).bg(s.done ? t.accent : t.background)
        .when(can, (el) => el.cursor_pointer().hover((x) => x.border_color(t.accent))
          .on_click((_e, cx) => { cx.stop_propagation(); this.task = this.tasks().findIndex((x) => x.line === s.line); this.toggle(s.line, cx); cx.notify(); }))
        .when(s.done, (el) => el.child(svg(I("check")).size(11).text_color(t.accent_foreground))))
      .child(div().flex_1().min_w(0).text_size(13).text_color(s.done ? t.dim : t.foreground)
        .child(s.text.trim() ? TextView.markdown(`kn-tt-${d.id}-${s.line}`, s.text).selectable(true) : div().child(" ")));
  }

  // ---------- views ----------

  head(t, { color, mark, title, sub, buttons }) {
    const typing = this.vim.insert && this.keyed;
    return this.box(t).id("kn-head").relative().flex_none().px(4).pb(12).gap(10)
      .on_size_change((s, cx) => { if (s.width !== this.headW) { this.headW = s.width; cx.notify(); } })
      .children([dither(this.headW, 60, 16, color)].filter(Boolean))
      .child(bandRow(t, { m: this.m, color, icon: PEN, mark, title, sub, buttons }))
      .child(div().flex_none().mx(-4).h(0).border_t(1).border_dashed().border_color(alpha(color, "4d")))
      .child(h_flex().px(8).gap(8).items_center()
        .child(h_flex().id("kn-filter").flex_1().min_w(0).h(34).px(13).gap(8).items_center().rounded_full().border(1)
          .border_color(typing ? alpha(t.accent, "99") : t.border).when(typing, (el) => el.bg(alpha(t.accent, "24"))).cursor_text()
          .on_click((_e, cx) => { this.vim.edit(); this.zone = "list"; this.handle.focus(); cx.notify(); })
          .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
          .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
            .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : tr("search")))
          .when(Boolean(this.query), (el) => el.child(div().id("kn-clear").flex_none().text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
            .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; this.cur = null; cx.notify(); })
            .child(svg(I("x")).size(13)))))
        .when(Boolean(this.keyed), (el) => el.child(this.mode(t))));
  }

  repoView(t, sc, cx) {
    const repo = sc.repo;
    const e = this.projectOf(repo);
    const color = this.colorOf(t, e);
    const d = this.data[repo.id];
    const all = this.rowsOf(repo);
    // kt-notes.open's worktree, once its row exists.
    if (this.want && d?.wts) {
      const it = all.find((x) => x.kind === "wt" && x.w.path === this.want);
      this.want = null;
      if (it) { this.open(it, cx); this.reveal = true; }
    }
    // Nothing open (or another repo's note): the project's, to read.
    if (d && (!this.doc || this.doc.repo.id !== repo.id)) { this.open(all[0], cx); this.zone = "list"; }
    const notes = all.filter((x) => x.text);
    const last = Math.max(0, ...notes.map((x) => x.mtime));
    this.sections = [
      { key: "all", label: tr("sec.all"), count: all.length },
      { key: "project", label: tr("sec.project"), tint: "accent", count: 1 },
      { key: "wt", label: "Worktrees", tint: "ansi2", count: all.filter((x) => x.kind === "wt").length }, // i18n: tech
      { key: "orphan", label: tr("sec.orphan"), tint: "ansi3", count: all.filter((x) => x.kind === "orphan").length },
    ];
    const head = this.head(t, { color, mark: this.mark(t, e, repo.name, 32), title: tr("title", { name: e?.name ?? repo.name }),
      // The count rolls; its id (and the filter row's scope) carry the project: another one's shows at once.
      sub: [d ? rollText(this.m, `kn-head-n-${repo.id}`, tr("notes", { n: notes.length }), 14) : "…", last ? tr("modified", { ago: ago(last) }) : d ? tr("none") : null, tilde(repo.main ?? repo.common)],
      buttons: [
        iconBtn(t, "kn-all", I("layers"), tr("allProjects"), () => this.toAll()),
        pulse(this.m, iconBtn(t, "kn-refresh", I("refresh-cw"), tr("reread"), (cx) => this.reload(cx, true)), Boolean(this.inflight[`l:${repo.id}:1`])),
        iconBtn(t, "kn-keys", I("keyboard"), tr("keys"), () => openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } })),
      ] })
      .child(div().px(8).child(filterRow({ id: "kn-secs", t, state: this.secRow, active: this.sec, reduced: Boolean(shared("kt.reducedMotion")), scope: repo.id,
        items: this.sections, onPick: (k) => { this.sec = k; this.cur = null; } })));
    // The list, its sections under their eyebrow; the keys' cursor ring while the list has them.
    const keyed = this.keyed;
    const shown = all.filter((it) => this.matches(it));
    const cur = keyed && this.zone === "list" && !this.vim.insert ? (shown.find((x) => x.id === this.cur) ?? shown[0])?.id : null;
    // The notes of a kind open and close on their height, in order (motion.js rows(), keyed by id; the
    // repo is in the id: another repo replaces this list at once). A kind gone whole (eyebrow too) goes
    // at once. `at` counts the rows as rows() builds them, the closing ones included: they are the
    // list's direct children, which scroll_to_item reveals.
    const list = [];
    for (const kind of [...new Set(shown.map((it) => it.kind))]) {
      if (kind !== "project") {
        list.push(div().flex_none().px(10).pt(10).pb(4).child(this.eyebrow(t, kind === "wt"
          ? `Worktrees · ${all.filter((x) => x.kind === "wt" && x.text).length}/${all.filter((x) => x.kind === "wt").length}` // i18n: tech
          : tr("orphans", { n: all.filter((x) => x.kind === "orphan").length }))));
      }
      let at = list.length;
      list.push(...motionRows(this.m, cx, `kn-rows-${repo.id}-${kind}`, shown.filter((it) => it.kind === kind), (it) => it.id, (it, i) => {
        if (i >= 0 && this.reveal && it.id === cur) { this.scroll.scroll_to_item(at); this.reveal = false; }
        at++;
        return this.row(t, it, i >= 0 && it.id === cur, this.doc?.id === it.id, i < 0);
      }));
    }
    const none = !d ? tr("readingNotes") : !shown.length ? tr("noMatch") : null;
    const listCard = this.box(t).w(340).flex_none()
      .child(v_flex().id("kn-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).p(6).gap(2)
        .when(Boolean(none), (el) => el.child(div().px(10).py(12).text_size(12.5).text_color(t.dim).child(none)))
        .children(list)
        .when(Boolean(d?.listError), (el) => el.child(div().px(10).py(8).text_size(12).text_color(t.ansi3).child(`gwm list : ${d.listError}`))));
    const doc = this.doc && this.doc.repo.id === repo.id ? this.doc : null;
    const noteCard = this.box(t).flex_1().min_w(0)
      .child(doc ? enter(this.m, v_flex().size_full(), `kn-doc-${doc.id}`, { dy: 0 }).child(this.note(t, doc, keyed)) : div());
    // h_flex centres its children: the two cards stretch to the page's height instead.
    return v_flex().size_full().gap(4).child(head).child(h_flex().flex_1().min_h(0).items_stretch().gap(4).child(listCard).child(noteCard));
  }

  everyView(t, sc, cx) {
    this.sections = [];
    const rows = this.projectRows(sc);
    const q = this.query.trim().toLowerCase();
    const shown = rows.filter((p) => !q || `${p.e.name} ${p.text ?? ""}`.toLowerCase().includes(q));
    const withNotes = shown.filter((p) => p.has);
    const total = rows.reduce((n, p) => n + (p.text ? 1 : 0) + p.n, 0);
    const keyed = this.keyed;
    const cur = keyed && !this.vim.insert ? (shown.find((x) => x.id === this.cur) ?? shown[0])?.id : null;
    // A project's line; `gone`: closing (rows() gave it -1), drawn as it was but no longer a target.
    const line = (p, on, gone) => h_flex().id(`kn-proj-${p.id}`).flex_none().h(56).px(12).gap(12).items_center().rounded(12).border(1)
        .border_color(on ? alpha(t.accent, "99") : alpha(t.accent, "00")).bg(on ? alpha(t.accent, "24") : alpha(t.accent, "00"))
        .when(!p.has, (el) => el.opacity(0.6))
        .when(!gone, (el) => el.cursor_pointer().when(!on, (el) => el.hover((s) => s.bg(t.hover)))
          .on_click((_e, cx) => { this.open(p, cx); cx.notify(); }))
        .child(this.mark(t, p.e, p.e.name, 24))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(h_flex().gap(8).items_center()
            .child(div().flex_none().text_size(13.5).font_medium().text_color(t.foreground).child(p.e.name))
            .child(div().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim)
              .child(!p.repo ? (p.repo === null ? tr("outsideGit") : "…") : [p.text ? tr("projectNoteShort") : null, p.n ? tr("wtNotes", { n: p.n }) : null].filter(Boolean).join(" · ") || tr("none"))))
          .child(div().truncate().text_size(12).text_color(p.text ? t.muted : t.dim).child(preview(p.text) || tilde(p.e.folder))))
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(p.mtime ? ago(p.mtime) : ""));
    // The projects with a note, then « Sans note » and the others: each part's lines open and close on
    // their height, in order (motion.js rows(), keyed by id); a project getting its first note closes
    // below and opens above. `at` counts the lines as rows() builds them, the closing ones included:
    // they are the list's direct children, which scroll_to_item reveals.
    const without = shown.filter((p) => !p.has);
    const list = [];
    const put = (id, ps) => {
      let at = list.length;
      list.push(...motionRows(this.m, cx, id, ps, (p) => p.id, (p, i) => {
        if (i >= 0 && this.reveal && p.id === cur) { this.scroll.scroll_to_item(at); this.reveal = false; }
        at++;
        return line(p, i >= 0 && p.id === cur, i < 0);
      }));
    };
    put("kn-every-has", withNotes);
    if (withNotes.length && without.length) list.push(div().flex_none().px(10).pt(12).pb(4).child(this.eyebrow(t, tr("withoutNote"))));
    put("kn-every-none", without);
    const head = this.head(t, { color: t.ansi3, mark: null, title: tr("allTitle"),
      sub: [rollText(this.m, "kn-all-n", `${tr("notes", { n: total })} · ${tr("projects", { n: withNotes.length })}`, 14), tr("registry")],
      buttons: [iconBtn(t, "kn-refresh", I("refresh-cw"), tr("reread"), (cx) => this.reload(cx, true)),
        iconBtn(t, "kn-keys", I("keyboard"), tr("keys"), () => openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } }))] });
    return v_flex().size_full().gap(4).child(head)
      .child(this.box(t).flex_1().child(v_flex().id("kn-projects").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).p(6).gap(2)
        .when(!shown.length, (el) => el.child(div().px(10).py(12).text_size(12.5).text_color(t.dim).child(rows.length ? tr("noProjectMatch") : tr("noProject"))))
        .children(list)));
  }

  render(cx) {
    const t = theme();
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const live = !checking();
    const vis = this.visible();
    const sc = live ? this.scope(cx) : { kind: "wait" };
    this.sc = sc;
    this.keyed = this.handle.is_focused() || this.edFocus;
    // The bus (DATA-SYNC.md): a note written anywhere rereads the notes; a worktree made or removed
    // (gwm) rereads the list too.
    if (live) {
      refreshOn(this, cx, "notes", ["notes"], async (cx) => this.reload(cx, true, true));
      refreshOn(this, cx, "gwm", ["gwm"], async (cx) => this.reload(cx, true));
    }
    if (vis && live) {
      const key = sc.kind === "repo" ? sc.repo.id : sc.kind === "all" ? `all:${sc.projects.map((p) => p.repo?.id ?? "?").join("|")}` : sc.kind;
      if (key !== this.scopeKey || !this.shown) {
        this.scopeKey = key;
        this.reload(cx, false);
      }
      this.watch(sc.kind === "repo" ? sc.repo : null, cx);
      // The page's first show (or coming back): the keyboard, in NORMAL, once the app settled its focus.
      if (!this.shown) cx.timer.after(150, (cx) => {
        if (this.visible() && !this.handle.is_focused() && !this.edFocus) this.focusIn();
        cx.notify();
      });
      this.shown = true;
    }
    const root = v_flex().id("kn-root").size_full().text_color(t.foreground).track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx));
    if (sc.kind === "repo") return root.child(this.repoView(t, sc, cx));
    if (sc.kind === "all") return root.child(this.everyView(t, sc, cx));
    return root.child(this.head(t, { color: t.ansi3, mark: null, title: "Notes", sub: ["…"], buttons: [] })); // i18n: tech
  }
}
