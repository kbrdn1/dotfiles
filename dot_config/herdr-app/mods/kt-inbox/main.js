// kbrdn Inbox (Monocode's Inbox, kbrdn.dev look): open GitHub pull requests
// and issues, as a page: the "inbox" child of kbrdn-threads' main "view"
// stack (kt-threads' Inbox shows it). It follows the shown project: the
// space's folder's github.com origin gives `owner/repo`, whose open PRs and
// issues it lists (`gh pr|issue list -R`); a "Global" pill, or a space
// outside a GitHub repo, shows the global view (`gh search --involves=@me`).
// Left: the scope's eyebrow, a filter field, type pills (Tout / PR / Issues),
// relation pills (Assignées / Créées / Mentionnées; none = everything in the
// scope), refresh, and the list (latest activity first, a dot when it moved
// since I last opened it). Right: the selected item's key figures, meta and
// actions, then for a PR Summary / Code / Checks, for an issue its body and
// last 20 comments. Every change (merge, draft, ready, close, reopen) asks
// first through the `kt-confirm` dialog, which calls back
// `kt-inbox.confirmed` (a mod command: it reaches this copy while the page shows).
// Data: `gh`, cached in localStorage by scope (list 2 min, detail 1 min); the
// list refreshes every 2 min, only while the page is shown.
// Another mod opens an item here (kt-gwm's linked issues and PRs): shared
// "kt.inbox.open" = { repo, kind, number, at }, then the "inbox" page. Read once
// while shown (if under 30 s old) and cleared: the scope moves to that repo and
// the item opens as if clicked, fetched by its detail even when not listed.
// Keys (vim.js; kt-keys lists them under Pages): the page opens typing in the filter (INSERT);
// ctrl-b h/l (pane.go, "focus") or `kt-inbox.key:<keys>` give it the keyboard in NORMAL.
// INSERT: type to filter, ctrl-n/ctrl-p, ctrl-j/ctrl-k, ↓ ↑ move the cursor, enter opens it, esc:
// NORMAL. NORMAL: j/k, gg/G, ctrl-d/u, n/N move the cursor (k on the first row: the filter, INSERT),
// / the filter, tab / shift-tab the type pills, [ ] the relation pills, enter/o/l open (a click), O
// GitHub, y copy the link, r refresh, dd close it (kt-confirm, open ones), ? kt-keys, q back to the
// thread, esc empties the selection, else clears the filter, then back to the thread.
// Selection (select.js): x / space pick the cursor's row, V a range, ctrl-a every listed row,
// ⌘-click / ⇧-click; a bar then acts on them (bulk.js): open, copy the links, gwm review (PRs with a
// local checkout, never bootstrapped), close (open ones only, each listed in a danger confirm).
// A PR's Code tab is Changes' (diffview's sectionHead and fileItems): one foldable section, compact
// rows, each file unfolding into its diff, an image into its before / after (its blobs from the local
// clone, else GitHub); on hover Zed and its nvim command (the PR's worktree, else the local clone,
// whose checkout may be another branch) and the file on GitHub. Its keys (the "code" zone: l / enter
// / o on the open PR, or a click on a file): Changes' j k gg G ctrl-d ctrl-u, h l fold / unfold (h on
// a folded file folds the section, on the folded section goes back to the list), enter / o, O Zed
// (else GitHub), y the path, r, / the filter, ? kt-keys, q the thread, esc back to the list; dd / x
// and [ ] do nothing there (nothing to discard on a PR).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, TextView, ScrollHandle, Scrollbar } from "gpui-base";
import { exec, theme, spaces, panes, run, layout, openOverlay, notify, nextCommand, settings, readTextFile, appHome, checking, shared, setShared, knownAgents, home } from "herdr";
import { parsePatch } from "./diff.js";
import { ICON_MAP } from "./icons.js";
import { fileItems, sectionHead, action, alpha, colorize, cleanTokens, zed, firstLine, IMAGE, loadPreview, cleanPreviews } from "./diffview.js";
import { Vim, keyOf, keysOf, step } from "./vim.js";
import { Select, lines } from "./select.js";
import { planClose, planReview, describe } from "./bulk.js";
import { filterRow, filterState } from "./filters.js";
import { motionState, frame, enter, pulse, sharpen, rows as rowsOf } from "./motion.js";
// kt-keys' roll.js (a byte-identical copy): the head's and the selection's counts roll to their new digits.
import { roll, rollText } from "./roll.js";
// kt-keys' viz.js (a byte-identical copy, with viz.strings.js): a PR's checks as steps, a bulk run's progress.
import { viz } from "./viz.js";
import { bump, gitTopics, refreshOn } from "./bus.js";
import { ditherBand, TOP } from "./dither.js";
import { makeT, relative } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
// The filter row (filters.js): the types, then the relations (none on = everything in the scope).
// Tints per FILTERS.md: PR ansi2, Issues ansi4, Assignées ansi3, Créées ansi5, Mentionnées ansi6.
const KIND_TINT = { pr: "ansi2", issue: "ansi4" };
const REL_TINT = { assignee: "ansi3", author: "ansi5", mentions: "ansi6" };
const I = (name) => `mods/kt-threads/${name}.svg`;
const LIST_TTL = 120e3;
const DETAIL_TTL = 60e3;
const LIST_FIELDS = "number,title,repository,updatedAt,createdAt,labels,url,state,author,commentsCount";
// `gh pr|issue list` has no repository nor commentsCount (comments would fetch every body).
const REPO_FIELDS = "number,title,updatedAt,createdAt,labels,url,state,author";
// The relation pills in a repo scope (`gh search` takes --assignee/--author/--mentions=@me).
const REL_ARGS = {
  assignee: () => ["--assignee", "@me"],
  author: () => ["--author", "@me"],
  mentions: (kind) => (kind === "pr" ? ["--search", "mentions:@me"] : ["--mention", "@me"]),
};
const PR_FIELDS = "number,title,body,state,isDraft,author,assignees,createdAt,updatedAt,baseRefName,headRefName,url,mergeable,reviewDecision,labels,additions,deletions,changedFiles,isCrossRepository";
const ISSUE_FIELDS = "number,title,body,state,author,assignees,createdAt,updatedAt,url,labels,comments";
// Words: strings.js' kind.<all|pr|issue> and rel.<id>.
const KINDS = [null, "pr", "issue"];
const RELS = ["assignee", "author", "mentions"];
// Labels get a theme color by name (GitHub's own hex would ignore the theme).
const LABEL_COLORS = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
// `gh pr checks` bucket -> theme color name.
const BUCKET = { pass: "done", fail: "ansi1", cancel: "ansi1", pending: "ansi3", skipping: "dim" }; // i18n: tech
// Bucket -> viz.js step state (another: todo), and the steps' order: failed, running, passed, skipped.
const STEP = { pass: "done", fail: "failed", cancel: "failed", pending: "current", skipping: "skipped" }; // i18n: tech
const STEP_RANK = { failed: 0, current: 1, done: 2, skipped: 3, todo: 4 }; // i18n: tech

const gh = (args, timeout = 20e3) => exec("gh", args, { timeout }).catch((e) => ({ code: 1, stdout: "", stderr: String(e) }));
const parse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
const load = (k) => parse(localStorage.getItem(k) ?? "null", null);
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const time = (iso) => Date.parse(iso ?? "") || 0;
const ago = (iso) => relative(iso);
// A refused or failed one, as a confirm's list line ("name : why").
const line = (item, why) => tr("line", { item, why });
const more = (n) => tr("more", { n });

// State -> label (GitHub's own word, in both languages), icon, theme color name. Upper-cased:
// search says "open", view says "OPEN".
// i18n: tech
function look(kind, state, draft) {
  const s = String(state ?? "").toUpperCase();
  if (kind === "pr") {
    if (s === "MERGED") return { label: "Merged", icon: "git-merge", color: "ansi5" }; // i18n: tech
    if (s === "CLOSED") return { label: "Closed", icon: "git-pull-request-closed", color: "ansi1" }; // i18n: tech
    if (draft) return { label: "Draft", icon: "git-pull-request", color: "dim" }; // i18n: tech
    return { label: "Open", icon: "git-pull-request", color: "ansi2" }; // i18n: tech
  }
  return s === "CLOSED" ? { label: "Closed", icon: "circle-check", color: "ansi5" } : { label: "Open", icon: "circle-dashed", color: "ansi2" }; // i18n: tech
}

function labelColor(t, name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return t[LABEL_COLORS[h % LABEL_COLORS.length]];
}

// `scope`: the repo a `gh pr|issue list -R` ran on (its JSON names none).
function item(kind, x, scope) {
  const repo = x.repository?.nameWithOwner ?? scope ?? "";
  return {
    kind, key: `${repo}#${x.number}`, repo, number: x.number, title: x.title ?? "", url: x.url,
    updatedAt: x.updatedAt, createdAt: x.createdAt, labels: (x.labels ?? []).map((l) => l.name),
    draft: Boolean(x.isDraft), state: String(x.state ?? "").toUpperCase(), author: x.author?.login ?? "", comments: x.commentsCount ?? null,
  };
}

// "owner/repo" from a github.com remote (https, ssh://, scp-like git@…:), else null.
function githubRepo(url) {
  const m = String(url ?? "").trim().match(/^(?:(?:https?|ssh|git):\/\/)?(?:[^@/\s]+@)?github\.com(?::\d+)?[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

// Shown: kbrdn-threads' main "view" stack is on this page.
function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
function visible() {
  const v = find(layout(), "view");
  return (v?.active ?? v?.children?.[0]?.id) === "inbox";
}

export default class Inbox extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: true });
    this.multi = new Select(); // the rows picked for a bulk action (select.js), by item key
    this.cur = null; // the keys' cursor (an item key); null: the first one shown
    this.listScroll = ScrollHandle.new();
    this.filters = filterState();
    this.motion = motionState();
    this.arrivals = 0; // the page's arrivals: each one fades it in again
    this.query = "";
    this.kind = null; // null | "pr" | "issue"
    this.rel = null; // null (involves) | "assignee" | "author" | "mentions"
    this.items = [];
    this.error = null;
    this.inflight = {}; // what gh is fetching now, by cache key
    this.sel = null; // the selected item (kept even if it leaves the list)
    this.details = {}; // "owner/repo#n" -> { at, data, checks, error }
    this.diffs = {}; // "owner/repo#n" -> { at, files } | { at, error } (memory only: can be big)
    this.openFiles = new Set(); // "owner/repo#n:path" unfolded in the Code tab
    this.tokens = {}; // "owner/repo#n:path" -> colorize's { mode, label, old, new }, made when a file unfolds
    this.previews = {}; // "owner/repo#n:path" -> { before, after } | { error } | null (loading), made when an image unfolds
    this.hotFile = null;
    // The Code tab's keys: the zone they go to ("list", or "code": the open PR's files), its cursor ("h":
    // the section's header, else "f:<path>"), what it walks (code() rebuilds it), its own reveal.
    this.zone = "list";
    this.fcur = null;
    this.codeFlat = [];
    this.codeFold = false;
    this.codeReveal = false;
    this.codeScroll = ScrollHandle.new();
    this.map = null; // Catppuccin's map.json
    this.tab = "summary";
    this.busy = null; // the running action's label
    this.bulkStep = null; // a bulk run's { i: calls done, n: calls }, while it runs
    this.actionError = null; // { key, text }
    this.pending = null; // the action the confirm dialog is asking about
    this.seen = {};
    // The shown space and its GitHub repo: "owner/repo", null (none: global), undefined (still asking git).
    this.scope = { space: null, repo: undefined };
    this.global = false; // "Global" pressed in a repo scope; a space change resets it
    this.remotes = {}; // JSON([machine, folder]) -> "owner/repo" | null
    if (checking()) return;
    this.seen = load("seen") ?? {};
    // First run: everything already there counts as seen.
    this.since = load("since") ?? Date.now();
    save("since", this.since);
    this.details = load("details") ?? {};
    cx.spawn(async (cx) => {
      try { this.map = JSON.parse(await readTextFile(`${appHome()}/${ICON_MAP}`)); } catch { this.map = null; }
      cx.notify();
    });
    // Every minute while shown: redraw the ages; the list once its cache is ~2 min old.
    cx.timer.every(60e3, (cx) => {
      if (!visible()) return;
      if (Date.now() - (load(this.listKey())?.at ?? 0) > LIST_TTL - 30e3) this.loadList(cx, true);
      cx.notify();
    });
    // The keyboard left without a render (a click on a terminal): the cursor goes out.
    // Recorded here too: a hidden copy never renders, so a stale `keyed` would notify every second.
    cx.timer.every(1000, (cx) => { const f = this.handle.is_focused(); if (this.keyed !== f) { this.keyed = f; cx.notify(); } });
    // `focus` (pane.go) takes the keyboard in NORMAL; `key:<keys>` takes it and types those keys
    // ("j", "g g", "/ f i x"), for tests.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn();
        else if (c.startsWith("key:")) {
          this.focusIn();
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        }
        else if (c === "refresh") this.refresh(cx);
        else if (c === "code-first" && this.sel?.kind === "pr") {
          this.tab = "code";
          const f = this.diffs[this.sel.key]?.files?.[0];
          if (f) this.openFile(this.sel, f, cx);
        }
        else if (c === "confirmed" && this.pending) {
          const p = this.pending;
          this.pending = null;
          if (p.kind === "review") this.review(p, cx);
          else if (p.kind === "bulk") this.runBulk(p, cx);
          else this.act(p, cx);
        }
        cx.notify();
      }
    });
  }

  // ---------- data ----------

  // The repo listed now, or null for the global view.
  repo() {
    return this.global ? null : this.scope.repo ?? null;
  }

  // Cached by scope and relation.
  listKey() {
    return `list:${this.scope.repo === undefined ? "?" : (this.repo() ?? "@me")}:${this.rel ?? "involves"}`;
  }

  // The scope changed (space, Global): its cached list now, a fetch if stale.
  rescoped(cx) {
    this.sel = null;
    // Another scope is another list: nothing picked in the last one acts here.
    this.multi.clear();
    this.tab = "summary";
    this.error = null;
    this.items = load(this.listKey())?.items ?? [];
    this.loadList(cx, false);
  }

  // Follow the shown space: its folder's origin, when it's on github.com.
  follow(cx) {
    const s = spaces().find((x) => x.active);
    if (!s || s.id === this.scope.space) return;
    const at = JSON.stringify([s.machine ?? null, s.folder]);
    this.scope = { space: s.id, repo: this.remotes[at] };
    this.global = false;
    if (at in this.remotes) return this.rescoped(cx);
    this.items = [];
    cx.spawn(async (cx) => {
      const r = s.folder ? await exec("git", ["-C", s.folder, "remote", "get-url", "origin"], { on: s.machine ?? null }).catch(() => ({ code: 1 })) : { code: 1 };
      this.remotes[at] = r.code === 0 ? githubRepo(r.stdout) : null;
      // An item asked for meanwhile (openAsked) keeps its repo.
      if (this.scope.space !== s.id || this.scope.asked) return;
      this.scope.repo = this.remotes[at];
      this.rescoped(cx);
      cx.notify();
    });
  }

  // shared "kt.inbox.open" (kt-gwm): that repo as the scope, that item opened as a click would.
  // Read once and cleared; older than 30 s, only cleared.
  openAsked(cx) {
    const req = shared("kt.inbox.open");
    if (!req || this.asked === req.at) return;
    this.asked = req.at;
    // Not during render: setShared redraws every mod.
    cx.spawn(async (cx) => {
      setShared("kt.inbox.open", null);
      if (Date.now() - (req.at ?? 0) > 30e3 || !req.repo || !req.number) return;
      this.scope = { space: spaces().find((x) => x.active)?.id ?? null, repo: req.repo, asked: true };
      this.global = false;
      this.rescoped(cx);
      const kind = req.kind === "pr" ? "pr" : "issue";
      // Not in the open list (closed, merged, another relation): its detail fetches it.
      this.select(this.items.find((x) => x.key === `${req.repo}#${req.number}`) ?? item(kind, { number: req.number }, req.repo), cx);
      cx.notify();
    });
  }

  loadList(cx, force) {
    if (this.scope.repo === undefined) return; // git hasn't said yet
    const key = this.listKey();
    const cached = load(key);
    if (!force && cached && Date.now() - cached.at < LIST_TTL) {
      this.items = cached.items;
      return this.pickFirst(cx);
    }
    if (this.inflight[key]) return;
    this.inflight[key] = true;
    const repo = this.repo();
    const rel = this.rel;
    const who = `--${rel ?? "involves"}=@me`;
    const search = (what, fields) => gh(["search", what, who, "--state=open", "--sort=updated", "--json", fields, "--limit", "50"]);
    const list = (kind, fields) => gh([kind, "list", "-R", repo, "--state", "open", "--json", fields, "--limit", "50", ...(rel ? REL_ARGS[rel](kind) : [])]);
    cx.spawn(async (cx) => {
      const [p, i] = await Promise.all(repo
        ? [list("pr", `${REPO_FIELDS},isDraft`), list("issue", REPO_FIELDS)]
        : [search("prs", `${LIST_FIELDS},isDraft`), search("issues", LIST_FIELDS)]);
      delete this.inflight[key];
      const prs = parse(p.stdout, null);
      const issues = parse(i.stdout, null);
      const how = repo ? ["gh pr list", "gh issue list"] : ["gh search prs", "gh search issues"];
      const error = (!prs && (p.stderr.trim() || tr("failed", { cmd: how[0] }))) || (!issues && (i.stderr.trim() || tr("failed", { cmd: how[1] }))) || null;
      if (prs || issues) {
        const items = [...(prs ?? []).map((x) => item("pr", x, repo)), ...(issues ?? []).map((x) => item("issue", x, repo))].sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
        if (!error) save(key, { at: Date.now(), items });
        if (key === this.listKey()) this.items = items;
      }
      if (key === this.listKey()) {
        this.error = error;
        this.pickFirst(cx);
      }
      cx.notify();
    });
  }

  // The first item opens by itself; a selection stays put, refreshed when stale.
  pickFirst(cx) {
    if (this.sel) {
      const fresh = this.items.find((x) => x.key === this.sel.key);
      if (fresh) this.sel = fresh;
      return this.loadDetail(cx, false);
    }
    const first = this.filtered()[0];
    if (first) this.select(first, cx);
  }

  select(x, cx) {
    if (this.sel?.key !== x.key) this.tab = "summary";
    this.sel = x;
    this.markSeen(x.key);
    this.loadDetail(cx, false);
  }

  markSeen(key) {
    const old = Date.now() - 60 * 86400e3;
    for (const [k, at] of Object.entries(this.seen)) if (at < old) delete this.seen[k];
    this.seen[key] = Date.now();
    save("seen", this.seen);
  }

  loadDetail(cx, force) {
    const x = this.sel;
    if (!x) return;
    const d = this.details[x.key];
    const fresh = d?.data && Date.now() - d.at < DETAIL_TTL && time(d.data.updatedAt) >= time(x.updatedAt);
    if ((!force && fresh) || this.inflight[x.key]) return;
    this.inflight[x.key] = true;
    cx.spawn(async (cx) => {
      const n = String(x.number);
      let next;
      if (x.kind === "pr") {
        const [v, c] = await Promise.all([
          gh(["pr", "view", n, "-R", x.repo, "--json", PR_FIELDS]),
          gh(["pr", "checks", n, "-R", x.repo, "--json", "name,state,link,bucket"]),
        ]);
        // gh pr checks exits non-zero on failing or pending checks, and when there are none: read stdout whatever the code.
        next = { data: parse(v.stdout, null), checks: parse(c.stdout, null) ?? [], error: v.code ? v.stderr.trim() : null };
      } else {
        const v = await gh(["issue", "view", n, "-R", x.repo, "--json", ISSUE_FIELDS]);
        next = { data: parse(v.stdout, null), error: v.code ? v.stderr.trim() : null };
        if (next.data?.comments) next.data.comments = next.data.comments.slice(-20);
      }
      delete this.inflight[x.key];
      if (next.data) {
        this.details[x.key] = { at: Date.now(), ...next };
        if (x.key === this.sel?.key) this.markSeen(x.key);
        if (time(next.data.updatedAt) > (this.diffs[x.key]?.at ?? 0)) delete this.diffs[x.key];
        this.saveDetails();
      } else this.details[x.key] = { ...(d ?? {}), at: d?.at ?? 0, error: next.error || tr("nothingBack") };
      cx.notify();
    });
  }

  saveDetails() {
    for (const [k, d] of Object.entries(this.details)) if (k !== this.sel?.key && Date.now() - d.at > 10 * 60e3) delete this.details[k];
    save("details", this.details);
  }

  loadDiff(cx) {
    const x = this.sel;
    const key = `diff:${x?.key}`;
    const d = this.diffs[x?.key];
    if (!x || x.kind !== "pr" || this.inflight[key] || (d && Date.now() - d.at < DETAIL_TTL)) return;
    this.inflight[key] = true;
    cx.spawn(async (cx) => {
      // Zed's checkout: the PR's worktree (its branch, its review branch), else the local clone, on this computer.
      const clone = this.cloneOf(x.repo), head = this.details[x.key]?.data?.headRefName;
      const [r, wt] = await Promise.all([
        gh(["pr", "diff", String(x.number), "-R", x.repo]),
        clone && head ? this.worktreeOf(clone, head, x.number) : null,
      ]);
      delete this.inflight[key];
      // The raw patch, parsed and drawn after DIFF-SPEC (the 1500-line cap is per file).
      this.diffs[x.key] = r.code
        ? { at: Date.now(), error: r.stderr.trim() || tr("diffFailed") }
        : { at: Date.now(), files: parsePatch(r.stdout), root: wt ?? clone };
      // Files still unfolded take their colors and images again (the PR may have moved; same blobs: the cache).
      for (const k of Object.keys(this.previews)) if (k.startsWith(`${x.key}:`)) delete this.previews[k];
      for (const f of this.diffs[x.key].files ?? []) if (this.openFiles.has(`${x.key}:${f.path}`)) { this.colorize(x, f, cx); this.preview(x, f, cx); }
      cx.notify();
    });
  }

  // Unfolds a file of a PR's Code tab, colors it, and shows an image's before / after.
  openFile(x, f, cx) {
    this.openFiles.add(`${x.key}:${f.path}`);
    this.colorize(x, f, cx);
    this.preview(x, f, cx);
  }

  toggleFile(x, f, cx) {
    const k = `${x.key}:${f.path}`;
    if (this.openFiles.has(k)) this.openFiles.delete(k);
    else this.openFile(x, f, cx);
  }

  // An unfolded image of a PR: its two blobs (the patch's index hashes) from the local clone, else from
  // GitHub (GraphQL gives the full oid, the REST blob endpoint its raw bytes), into diffview's cache.
  preview(x, f, cx) {
    const k = `${x.key}:${f.path}`;
    if (!IMAGE.test(f.path) || this.previews[k] !== undefined) return;
    if (!f.ids) { this.previews[k] = { error: "unavailable" }; return; } // i18n: tech (diffview's pv.<error>)
    const none = (id) => /^0+$/.test(id), clone = this.cloneOf(x.repo);
    let oids = null;
    const side = (id) => (none(id) ? null : { id, write: async (abs) => {
      if (clone && (await exec("sh", ["-c", 'git -C "$1" cat-file blob "$2" > "$3"', "sh", clone, id, abs]).catch(() => null))?.code === 0) return true;
      oids ??= this.blobs(x.repo, f.ids.filter((i) => !none(i)));
      const oid = (await oids)?.[id]?.oid;
      if (!oid) return false;
      const r = await exec("sh", ["-c", 'gh api -H "Accept: application/vnd.github.raw+json" "repos/$1/git/blobs/$2" > "$3"', "sh", x.repo, oid, abs], { timeout: 30e3 }).catch(() => null);
      return r?.code === 0;
    } });
    this.previews[k] = null;
    cx.spawn(async (cx) => {
      const pv = await loadPreview(null, f, side(f.ids[0]), side(f.ids[1]));
      if (this.previews[k] === null) { this.previews[k] = pv; cx.notify(); }
    });
  }

  // A PR file's code in Zed's theme (diffview's colorize), for the appearance now. Its two blobs are
  // the patch's `index` hashes (the cache's key): read from a local clone of the repo (a space's
  // folder whose origin it is) when it has them, else from GitHub, both in one GraphQL query.
  colorize(x, f, cx) {
    if (f.binary || !f.ids || !f.hunks.length) return;
    const [a, b] = f.ids, none = (id) => /^0+$/.test(id);
    const at = Object.entries(this.remotes).find(([k, repo]) => repo === x.repo && JSON.parse(k)[0] === null)?.[0];
    const folder = at ? JSON.parse(at)[1] : null;
    let remote = null;
    const text = async (id) => {
      if (folder) {
        const r = await exec("git", ["-C", folder, "cat-file", "blob", id]).catch(() => null);
        if (r?.code === 0) return r.stdout;
      }
      remote ??= this.blobs(x.repo, [a, b].filter((i) => !none(i)));
      const blob = (await remote)?.[id];
      return blob && !blob.isBinary && !blob.isTruncated && typeof blob.text === "string" ? blob.text : null;
    };
    const sides = {
      old: none(a) ? null : { id: a, path: f.old ?? f.path, text: () => text(a) },
      new: none(b) ? null : { id: b, path: f.path, text: () => text(b) },
    };
    const k = `${x.key}:${f.path}`;
    cx.spawn(async (cx) => {
      const tk = await colorize("kt-inbox", null, f, sides, settings().dark !== false).catch(() => null);
      if (tk) { this.tokens[k] = tk; cx.notify(); }
    });
  }

  // Blobs of a GitHub repo by (abbreviated) hash, one GraphQL query: hash -> { oid, text, isBinary, isTruncated } | null.
  async blobs(repo, ids) {
    const [owner, name] = repo.split("/");
    // i18n: tech
    const q = `{repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}){${ids.map((id, i) => `b${i}:object(expression:${JSON.stringify(id)}){... on Blob{oid text isBinary isTruncated}}`).join(" ")}}}`;
    const r = await gh(["api", "graphql", "-f", `query=${q}`], 30e3);
    const data = parse(r.stdout, null)?.data?.repository ?? {};
    return Object.fromEntries(ids.map((id, i) => [id, data[`b${i}`] ?? null]));
  }

  refresh(cx) {
    if (this.sel) delete this.diffs[this.sel.key];
    this.loadList(cx, true);
    this.loadDetail(cx, true);
  }

  // ---------- actions ----------

  ask(x, label, title, detail, args) {
    if (this.busy) return;
    this.pending = { key: x.key, label, args };
    // kbrdn's confirm (kt-confirm) draws its own card: frame "none"; closing is the one red action.
    openOverlay({ mod: "kt-confirm", kind: "dialog", frame: "none",
      props: { title, detail, command: { name: "kt-inbox.confirmed" }, danger: args[1] === "close" } });
  }

  act(p, cx) {
    this.busy = p.label;
    this.actionError = null;
    cx.spawn(async (cx) => {
      const r = await gh(p.args, 60e3);
      this.busy = null;
      // Others showing this repo's PRs and issues read again (a failed call may have half applied).
      const repo = p.args[p.args.indexOf("-R") + 1];
      bump("gh", ...(repo ? [`gh:${repo}`] : []));
      if (r.code) this.actionError = { key: p.key, text: (r.stderr || r.stdout).trim() || tr("failedCode", { cmd: `gh ${p.args.slice(0, 2).join(" ")}`, code: r.code }) };
      delete this.diffs[p.key];
      this.loadList(cx, true);
      if (p.key === this.sel?.key) this.loadDetail(cx, true);
      cx.notify();
    });
  }

  actions(t, x, data) {
    const n = String(x.number);
    const R = ["-R", x.repo];
    const state = String(data?.state ?? x.state).toUpperCase();
    const v = { n, title: data?.title ?? x.title, repo: x.repo };
    const url = data?.url ?? x.url;
    const out = [];
    if (x.kind === "pr" && state === "OPEN") {
      const draft = data?.isDraft ?? x.draft;
      if (!draft)
        out.push(this.pill(t, "merge", tr("pill.merge"), "git-merge", true, () =>
          this.ask(x, tr("busy.merge"), tr("ask.merge.title", v), tr("ask.merge.detail", { ...v, head: data?.headRefName ?? tr("ask.merge.head"), base: data?.baseRefName ?? tr("ask.merge.base") }), ["pr", "merge", n, ...R, "--merge"])));
      out.push(draft
        ? this.pill(t, "ready", tr("pill.ready"), "circle-check", false, () =>
            this.ask(x, tr("busy.ready"), tr("ask.ready.title", v), tr("ask.ready.detail", v), ["pr", "ready", n, ...R]))
        : this.pill(t, "draft", tr("pill.draft"), "circle-dashed", false, () =>
            this.ask(x, tr("busy.draft"), tr("ask.draft.title", v), tr("ask.draft.detail", v), ["pr", "ready", n, ...R, "--undo"])));
      out.push(this.pill(t, "close", tr("pill.close"), "git-pull-request-closed", false, () => this.askClose(x)));
    }
    if (x.kind === "issue" && state === "OPEN")
      out.push(this.pill(t, "close", tr("pill.close"), "circle-check", false, () => this.askClose(x)));
    if (x.kind === "issue" && state === "CLOSED")
      out.push(this.pill(t, "reopen", tr("pill.reopen"), "circle-dashed", false, () =>
        this.ask(x, tr("busy.reopen"), tr("ask.reopen.title", v), tr("ask.reopen.detail", v), ["issue", "reopen", n, ...R])));
    if (x.kind === "pr") out.push(this.pill(t, "agent", tr("pill.agent"), "sparkles", false, (cx) => this.agentOnPr(x, data, cx)));
    out.push(this.pill(t, "copy", tr("pill.copy"), null, false, (cx) => this.copyLink(x, cx)));
    out.push(this.pill(t, "open", tr("pill.github"), "external-link", false, () => exec("open", [url]).catch(() => {})));
    return out;
  }

  // Closing an open PR or issue, asked first: the Fermer pill, and dd / x on the cursor.
  askClose(x) {
    const data = this.details[x.key]?.data;
    if (String(data?.state ?? x.state).toUpperCase() !== "OPEN") return;
    const n = String(x.number);
    const v = { n, title: data?.title ?? x.title, repo: x.repo };
    if (x.kind === "pr") this.ask(x, tr("busy.close"), tr("ask.closePr.title", v), tr("ask.closePr.detail", v), ["pr", "close", n, "-R", x.repo]);
    else this.ask(x, tr("busy.close"), tr("ask.closeIssue.title", v), tr("ask.closeIssue.detail", v), ["issue", "close", n, "-R", x.repo]);
  }

  // ---------- an agent on a PR ----------
  // Never in the main checkout: in the worktree that has the PR's branch (or its review branch), else
  // in a review worktree gwm makes (`gwm review`), asked first. Its bootstrap runs only when the
  // repo's .gwm.toml is approved (gwm's trust ledger has its sha256); never --allow-bootstrap.

  // The local clone of `repo`: a space's folder on this computer whose origin it is (follow() asked).
  cloneOf(repo) {
    const at = Object.entries(this.remotes).find(([k, r]) => r === repo && JSON.parse(k)[0] === null)?.[0];
    return at ? JSON.parse(at)[1] : null;
  }

  // A linked worktree of `clone` for PR `n`: its branch, its review branch, or gwm's PR link; null.
  async worktreeOf(clone, head, n) {
    const r = await exec("gwm", ["list", "--format", "json"], { cwd: clone }).catch(() => null);
    const list = r?.code === 0 ? parse(r.stdout, []) : [];
    const w = list.find((w) => !w.is_main && (w.branch === head || String(w.branch ?? "").startsWith(`review/pr-${n}-`) || w.pr === n));
    return w ? String(w.path).replace(/\/$/, "") : null;
  }

  agentOnPr(x, data, cx) {
    const clone = this.cloneOf(x.repo);
    if (!clone) return notify({ title: tr("noClone.title"), body: tr("noClone.body", { repo: x.repo }), level: "warning", timeout: 7000 });
    if (this.busy) return;
    this.busy = tr("busy.findWorktree");
    const n = x.number;
    cx.spawn(async (cx) => {
      const head = data?.headRefName ?? null;
      const found = await this.worktreeOf(clone, head, n);
      if (found) {
        this.busy = null;
        await this.startAgent(found, x);
        return cx.notify();
      }
      const toml = await readTextFile(`${clone}/.gwm.toml`).catch(() => null);
      let trusted = false;
      if (toml) {
        const sum = await exec("shasum", ["-a", "256", ".gwm.toml"], { cwd: clone }).catch(() => null);
        const hash = sum?.code === 0 ? sum.stdout.split(" ")[0].trim() : null;
        const ledger = await exec("gwm", ["trust", "show"], { cwd: clone }).catch(() => null);
        trusted = Boolean(hash && ledger?.code === 0 && ledger.stdout.includes(`"${hash}"`));
      }
      // The bootstrap's commands, as .gwm.toml lists them ([[bootstrap.command]] name / run).
      const cmds = toml ? toml.split("[[").filter((b) => b.startsWith("bootstrap.command]]"))
        .map((b) => (b.match(/^\s*run\s*=\s*"((?:[^"\\]|\\.)*)"/m) ?? [])[1]).filter(Boolean) : [];
      this.busy = null;
      // A fork's PR (or one gh didn't say): its code is a stranger's, its bootstrap never runs.
      const fork = data?.isCrossRepository !== false;
      const boot = Boolean(toml && trusted && !fork);
      this.pending = { kind: "review", key: x.key, x, clone, bootstrap: boot };
      const intro = tr("agent.intro");
      const list = cmds.length ? `\n\n${tr(boot ? "agent.boot" : "agent.bootOff")}\n${cmds.map((c) => `• ${c}`).join("\n")}` : "";
      openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: {
        // Running the repo's commands on the PR's code is what makes it dangerous.
        title: tr("agent.title", { n }), tone: boot ? "danger" : "info", danger: boot, icon: "git-pull-request",
        subtitle: [x.repo, head && data?.baseRefName ? `${head} → ${data.baseRefName}` : head, "gwm review"],
        detail: intro + list,
        facts: [[tr("fact.repo"), x.repo], ["clone", clone.replace(home(), "~")], [tr("fact.branch"), head ?? "—"], [tr("fact.origin"), fork ? "fork" : tr("origin.same"), fork ? "blocked" : null],
          ["worktree", tr("worktree.new", { n })],
          ["bootstrap", !toml ? tr("boot.none") : boot ? tr("boot.on") : fork ? tr("boot.fork") : tr("boot.untrusted"), toml && !boot ? "blocked" : boot ? "ansi1" : null]],
        warning: boot ? tr("agent.warnBoot")
          : toml && fork ? tr("agent.warnFork")
          : toml && !trusted ? tr("agent.warnUntrusted") : null,
        consequence: tr("agent.consequence"),
        label: tr("agent.label"), command: { name: "kt-inbox.confirmed" },
      } });
      cx.notify();
    });
  }

  // Confirmed: gwm review (the bootstrap only when approved), then the agent in that worktree.
  review(p, cx) {
    this.busy = "gwm review";
    this.actionError = null;
    cx.spawn(async (cx) => {
      const args = ["review", String(p.x.number), ...(p.bootstrap ? ["--bootstrap"] : [])];
      const r = await exec("gwm", args, { cwd: p.clone, timeout: 600e3 }).catch((e) => ({ code: 1, stdout: "", stderr: String(e) }));
      bump("gwm"); // worktrees moved, even on a half-done review
      const path = await this.worktreeOf(p.clone, null, p.x.number);
      this.busy = null;
      if (path) {
        bump(...gitTopics(path));
        await this.startAgent(path, p.x);
      } else this.actionError = { key: p.key, text: (r.stderr || r.stdout).trim() || tr("failedCode", { cmd: "gwm review", code: r.code }) };
      cx.notify();
    });
  }

  // The agent most picked and installed, in `path`: a new tab of its space when one is there, else a
  // new space; then the thread page.
  async startAgent(path, x) {
    const agent = (await knownAgents().catch(() => [])).find((a) => a.installed);
    const argv = agent?.run ?? ["claude"];
    const name = `PR #${x.number}`;
    const s = spaces().find((s) => !s.machine && String(s.folder).replace(/\/$/, "") === path);
    run("layout.select", { stack: "view", child: "thread" });
    if (s) run("tab.new", { space: s.id, folder: path, argv, name });
    else run("space.new", { folder: path, argv, tab: name, machine: "" });
  }

  // ---------- the selection's actions (select.js, bulk.js) ----------

  // The bar over the list's foot while rows are picked: how many, the actions on them (hidden by the
  // filter or not, in the list's order) or the running one, ✕ to empty. kt-gwm's bar.
  bulk(t) {
    const picked = this.multi.pick(this.items, (x) => x.key);
    if (!picked.length) return null;
    const n = picked.length;
    const actions = [
      ["open", tr("bulk.open"), "external-link", () => { for (const x of picked) if (x.url) exec("open", [x.url]).catch(() => {}); }],
      ["copy", tr("bulk.copy"), "file-text", (cx) => {
        cx.write_to_clipboard(picked.map((x) => x.url).filter(Boolean).join("\n"));
        notify({ title: tr("copied", { n }), body: tr("onePerLine"), level: "success", timeout: 2500 });
      }],
      ["review", tr("bulk.review"), "git-pull-request", (cx) => this.askBulkReview(picked, cx)],
      ["close", tr("bulk.close"), "x", () => this.askBulkClose(picked), true],
    ];
    return h_flex().absolute().bottom(10).left(0).right(0).px(8).justify_center()
      .child(enter(this.m, div().max_w_full(), "kti-bulk-in").child(h_flex().id("kti-bulk").max_w_full().flex_wrap().p(4).gap(2).items_center()
        .rounded(12).border(1).border_color(t.border).bg(t.popover).shadow_lg()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(div().pl(10).pr(8).font_family(MONO).text_size(11).text_color(t.foreground).child(rollText(this.m, "kti-sel-n", tr("selected", { n }), 15)))
        .child(div().w(1).h(18).flex_none().bg(t.border))
        // A bulk run: its calls done over all (viz.js progress); else what runs, spinning. A 16 px line: the
        // progress is 39 px high (the buttons 28), and the bar stays under the list's 64 px foot.
        .when(Boolean(this.busy && this.bulkStep), (el) => el.child(div().px(10).line_height("16px").child(this.V.progress(tr("running", { what: this.busy }), this.bulkStep.i,
          { max: this.bulkStep.n, width: 160, figure: `${this.bulkStep.i} / ${this.bulkStep.n}`, id: "kti-bulk-prog" }))))
        .when(Boolean(this.busy && !this.bulkStep), (el) => el.child(h_flex().h(28).px(10).gap(6).items_center().text_size(12).text_color(t.muted)
          .child(svg(I("refresh-cw")).size(13).spin(900)).child(tr("running", { what: this.busy }))))
        .when(!this.busy, (el) => el.children(actions.map(([id, label, icon, onClick, danger]) => h_flex().id(`kti-bulk-${id}`).h(28).px(10).gap(6).items_center().rounded(8)
          .text_size(12).text_color(danger ? t.ansi1 : t.foreground).cursor_pointer().hover((s) => s.bg(danger ? alpha(t.ansi1, "1a") : t.hover))
          .on_click((_e, cx) => { onClick(cx); cx.notify(); })
          .child(svg(I(icon)).size(13)).child(label))))
        .child(h_flex().id("kti-bulk-clear").size(28).flex_none().items_center().justify_center().rounded(8).text_color(t.muted)
          .cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tr("clearSelection"))
          .on_click((_e, cx) => { this.multi.clear(); cx.notify(); })
          .child(svg(I("x")).size(13)))));
  }

  // The registry's projects on this computer whose origin isn't known yet: asked once (a closed
  // project's checkout counts for gwm review).
  async resolveClones() {
    for (const e of shared("kt.projects") ?? []) {
      const at = JSON.stringify([null, e.folder]);
      if (e.machine || !e.folder || at in this.remotes) continue;
      const r = await exec("git", ["-C", e.folder, "remote", "get-url", "origin"]).catch(() => ({ code: 1 }));
      this.remotes[at] = r.code === 0 ? githubRepo(r.stdout) : null;
    }
  }

  // The refused ones, as kt-confirm lists them under its heading.
  refusedText(refused) {
    return refused.length ? `\n\n${tr("refused")}\n${lines(refused.map((r) => line(describe(r.item), tr(`why.${r.why}`))), 10, more)}` : "";
  }

  // Fermer: the open ones only, each listed in a danger confirm, closed one after another.
  askBulkClose(picked) {
    if (this.busy) return;
    const plan = planClose(picked);
    if (!plan.ok.length) return notify({ title: tr("nothingToClose"), body: lines(plan.refused.map((r) => line(describe(r.item), tr(`why.${r.why}`))), 6, more), level: "warning", timeout: 7000 });
    const n = plan.ok.length;
    this.pending = { kind: "bulk", what: "close", label: tr("busy.close"), repos: [...new Set(plan.ok.map((x) => x.repo))],
      calls: plan.calls.map((args, i) => ({ cmd: "gh", args, label: describe(plan.ok[i]) })) };
    openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: {
      title: tr("bulkClose.title", { n }), danger: true, icon: "git-pull-request-closed",
      subtitle: [tr("bulkClose.of", { k: n, n: picked.length }), "gh close", tr("oneAtATime")],
      detail: `${tr("bulkClose.detail")}${this.refusedText(plan.refused)}`,
      items: plan.ok.map((x) => ({ label: describe(x), detail: x.repo })),
      consequence: tr("bulkClose.consequence", { n }),
      label: tr("bulk.close"), command: { name: "kt-inbox.confirmed" },
    } });
  }

  // Review (gwm): PRs with a local checkout of their repo, one review worktree each, never bootstrapped.
  askBulkReview(picked, cx) {
    if (this.busy) return;
    this.busy = tr("busy.findClones");
    cx.spawn(async (cx) => {
      await this.resolveClones();
      this.busy = null;
      const plan = planReview(picked, (repo) => this.cloneOf(repo));
      if (!plan.ok.length) {
        notify({ title: tr("noReview"), body: lines(plan.refused.map((r) => line(describe(r.item), tr(`why.${r.why}`))), 6, more), level: "warning", timeout: 7000 });
        return cx.notify();
      }
      const n = plan.ok.length;
      this.pending = { kind: "bulk", what: "review", label: "gwm review", // i18n: tech
        calls: plan.calls.map((c, i) => ({ cmd: "gwm", args: c.args, cwd: c.cwd, label: describe(plan.ok[i]) })) };
      openOverlay({ mod: "kt-confirm", kind: "dialog", width: 1, height: 1, frame: "none", props: {
        title: tr("bulkReview.title", { n }), tone: "info", icon: "git-pull-request",
        subtitle: [`${n} PR`, "gwm review", tr("noBootstrap")],
        detail: `${tr("bulkReview.detail")}${this.refusedText(plan.refused)}`,
        items: plan.ok.map((x) => ({ label: describe(x), detail: this.cloneOf(x.repo).replace(home(), "~") })),
        consequence: tr("bulkReview.consequence"),
        label: tr("bulkReview.label"), command: { name: "kt-inbox.confirmed" },
      } });
      cx.notify();
    });
  }

  // A confirmed bulk action, call after call; one toast at the end, the failures in it.
  runBulk(p, cx) {
    const failed = [];
    cx.spawn(async (cx) => {
      for (const [i, c] of p.calls.entries()) {
        this.busy = p.label;
        this.bulkStep = { i, n: p.calls.length };
        cx.notify();
        const r = c.cmd === "gh" ? await gh(c.args, 60e3)
          : await exec("gwm", c.args, { cwd: c.cwd, timeout: 600e3 }).catch((e) => ({ code: 1, stdout: "", stderr: String(e) }));
        if (r.code) failed.push(line(c.label, ((r.stderr || r.stdout).trim().split("\n").pop()) || tr("code", { code: r.code })));
      }
      this.busy = null;
      this.bulkStep = null;
      // Others read again, even after a half-done run.
      if (p.what === "close") bump("gh", ...p.repos.map((r) => `gh:${r}`));
      else bump("gwm");
      this.multi.clear();
      if (p.what === "close") this.loadList(cx, true);
      const done = p.calls.length - failed.length;
      notify({
        title: failed.length ? tr("result", { label: p.label, done, total: p.calls.length }) : p.what === "close" ? tr("closedN", { n: done }) : tr("reviewN", { n: done }),
        body: failed.length ? lines(failed, 5, more) : p.what === "close" ? tr("onGithub") : tr("readyInGwm"),
        level: failed.length ? "warning" : "success", timeout: 8000,
      });
      cx.notify();
    });
  }

  // The Copier le lien pill, and y on the cursor.
  copyLink(x, cx) {
    const url = this.details[x.key]?.data?.url ?? x.url;
    if (!url) return;
    cx.write_to_clipboard(url);
    notify({ title: tr("linkCopied"), body: tr(x.kind === "pr" ? "linkOf.pr" : "linkOf.issue", { n: x.number, repo: x.repo }), level: "success", timeout: 2500 });
  }

  // ---------- pieces ----------

  // kbrdn.dev `.eyebrow`: mono 11 px, uppercase, label color.
  eyebrow(t, text, color) {
    return div().font_family(MONO).text_size(11).text_color(color ?? t.muted).child(String(text).toUpperCase());
  }

  // kbrdn.dev `.tag`: pill, border 30% / fill 10% of its own color.
  tag(t, color, text) {
    return h_flex().flex_none().h(20).px(8).items_center().rounded_full().border(1).border_color(alpha(color, "4d")).bg(alpha(color, "1a"))
      .text_color(color).font_family(MONO).text_size(10.5).child(String(text).toUpperCase());
  }

  // A filter pill: ink when on.
  chip(t, id, label, on, onClick) {
    return h_flex().id(id).flex_none().h(26).px(11).items_center().rounded_full().border(1)
      .border_color(on ? alpha(t.accent, "66") : t.border)
      .when(on, (el) => el.bg(alpha(t.accent, "24")))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
      .text_size(12).text_color(on ? t.foreground : t.muted).cursor_pointer()
      .on_click((_e, cx) => { onClick(cx); cx.notify(); })
      .child(label);
  }

  // An action pill; primary = solid ink.
  pill(t, id, label, icon, primary, onClick) {
    const off = Boolean(this.busy);
    return h_flex().id(`kti-${id}`).flex_none().h(30).px(13).gap(6).items_center().rounded_full().border(1)
      .border_color(primary ? t.solid : t.border).bg(primary ? t.solid : t.background)
      .text_size(12.5).font_medium().text_color(primary ? t.solid_foreground : t.foreground)
      .when(off, (el) => el.opacity(0.45))
      .when(!off, (el) => el.cursor_pointer().hover((s) => (primary ? s.opacity(0.88) : s.bg(t.hover))))
      .on_click((_e, cx) => { if (!this.busy) onClick(cx); cx.notify(); })
      .when(Boolean(icon), (el) => el.child(svg(I(icon)).size(13)))
      .child(label);
  }

  // A PR's checks as viz.js steps, a dithered cell each: failed, then running, then passed (each run in
  // the list's order), in the list's colors (BUCKET). Too many for the width: one bar, « n / total ».
  checkSteps(t, checks, o) {
    const list = checks.map((c, i) => ({ label: c.name, state: STEP[c.bucket] ?? "todo", i }))
      .sort((a, b) => STEP_RANK[a.state] - STEP_RANK[b.state] || a.i - b.i);
    return this.V.steps(list, { ...o, colors: { done: t.done, current: t.ansi3, failed: t.ansi1 },
      words: { done: tr("ck.done"), current: tr("ck.current"), failed: tr("ck.failed"), skipped: tr("ck.skipped") } });
  }

  dashed(t) {
    return div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
  }

  // A list or a pane with nothing to show yet: why, in plain words; breathing while GitHub answers.
  empty(t, text, color, loading = false) {
    const el = div().p(16).text_size(13).line_height("20px").text_color(color ?? t.dim).child(text);
    return this.m ? pulse(this.m, el, loading) : el;
  }

  // A card (radius 16): the layout's work card (radius 20, padding 4) holds this page, so cards are concentric.
  card(t) {
    return v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
  }

  markdown(t, id, text) {
    return div().text_size(13).text_color(t.foreground).child(TextView.markdown(id, text?.trim() || tr("noDescription")).selectable(true));
  }

  // ---------- left ----------

  filtered() {
    const q = this.query.trim().toLowerCase();
    return this.items.filter((x) => (!this.kind || x.kind === this.kind)
      && (!q || `${x.title} ${x.repo} #${x.number} ${x.author} ${x.labels.join(" ")}`.toLowerCase().includes(q)));
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  // The keyboard comes here (pane.go, a key command): NORMAL, the cursor on the open item.
  focusIn() {
    this.handle.focus();
    this.vim.normal();
    if (!this.filtered().some((x) => x.key === this.cur)) this.cur = this.sel?.key ?? null;
    this.reveal = true;
  }

  // The Code zone takes the keys (NORMAL), on the open PR's Code tab: the cursor on `path`, else where it
  // was (code() puts it on the first file when that isn't there).
  codeIn(path) {
    this.tab = "code";
    this.zone = "code";
    this.handle.focus();
    this.vim.normal();
    if (path) this.fcur = `f:${path}`;
    this.codeReveal = true;
  }

  // One vim action in the Code zone: Changes' keys on the open PR's files; false: not one it has.
  codeKey(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const x = this.sel, d = this.diffs[x?.key];
    const flat = this.codeFlat;
    const i = flat.findIndex((e) => e.id === this.fcur);
    const f = flat[i]?.file;
    const open = f && this.openFiles.has(`${x.key}:${f.path}`);
    const to = (id) => { this.fcur = id; this.codeReveal = true; };
    const out = () => { this.zone = "list"; this.reveal = true; };
    // `/`: vim is in INSERT already, the filter types.
    if (a === "filter") this.zone = "list";
    else if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) {
      const j = step(a, i, flat.length, this.vim.count, 16);
      if (j >= 0) to(flat[j].id);
    } else if (a === "left") {
      // An unfolded diff folds; on a folded file, the section folds and its header takes the cursor; on
      // the folded section, back to the list.
      if (open) this.openFiles.delete(`${x.key}:${f.path}`);
      else if (f) { this.codeFold = true; to("h"); }
      else if (!this.codeFold) this.codeFold = true;
      else out();
    } else if (a === "right") {
      if (!f) this.codeFold = false;
      else if (!open) this.openFile(x, f, cx);
    } else if (a === "open") {
      if (!f) this.codeFold = !this.codeFold;
      else this.toggleFile(x, f, cx);
    } else if (a === "open-alt") { if (f) this.openAt(x, f, d?.root); }
    else if (a === "yank") {
      if (f) {
        const p = d?.root ? `${d.root}/${f.path}` : f.path;
        cx.write_to_clipboard(p);
        notify({ title: tr("pathCopied"), body: p, level: "success", timeout: 2000 });
      }
    } else if (a === "delete" || a === "panel-prev" || a === "panel-next") return true; // nothing to discard on a PR
    else if (a === "refresh") this.refresh(cx);
    else if (a === "escape") out();
    else if (a === "quit") run("layout.select", { stack: "view", child: "thread" });
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else return false;
    return true;
  }

  // O and the file's first action: Zed at the file's first line in a local checkout, else the file in the
  // PR on GitHub (its anchor is the sha256 of its path).
  openAt(x, f, root) {
    if (root) return zed(`${root}/${f.path}`, f.status === "D" ? 0 : firstLine(f));
    const url = this.details[x.key]?.data?.url ?? x.url;
    exec("sh", ["-c", 'printf %s "$1" | shasum -a 256', "sh", f.path])
      .then((r) => exec("open", [`${url}/files#diff-${r.stdout.split(" ")[0].trim()}`])).catch(() => {});
  }

  // The cursor's item: this.cur when shown, else the first one.
  at(list) {
    return list.find((x) => x.key === this.cur) ?? list[0] ?? null;
  }

  key(e, cx) {
    if (!this.press(e, cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // One key, from the keyboard or `key:`: in NORMAL the selection's first (select.js: x / space
  // toggle the cursor's row, V a visual range, ctrl-a every listed row, esc empties), then vim's
  // (dd still closes the cursor's item). A move in a visual range extends it.
  press(e, cx) {
    // The Code zone takes the keys first: x, space or dd there never pick nor close the list's items.
    if (this.zone === "code" && !this.vim.insert && this.tab === "code" && this.sel?.kind === "pr") return this.codeKey(this.vim.handle(e), cx);
    const order = this.filtered().map((x) => x.key);
    if (!this.vim.insert && this.multi.key(keyOf(e).name, this.at(this.filtered())?.key, order)) return true;
    const taken = this.keyAct(this.vim.handle(e), cx);
    if (taken && this.multi.visual) this.multi.follow(this.at(this.filtered())?.key, order);
    return taken;
  }

  // One vim action; false: not one this page has, and the key goes on.
  keyAct(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count" || a === "filter" || a === "normal") return true;
    const list = this.filtered();
    const x = this.at(list);
    const i = list.indexOf(x);
    if (a === "type" || a === "backspace") {
      this.query = a === "type" ? this.query + this.vim.char : this.query.slice(0, -1);
      this.cur = null;
    } else if (a === "up" && i <= 0 && !this.vim.insert) this.vim.edit(); // k on the first row: the filter
    else if (["down", "up", "top", "bottom", "half-down", "half-up", "next", "prev"].includes(a)) {
      const j = step(a === "next" ? "down" : a === "prev" ? "up" : a, i, list.length, this.vim.count, 8);
      if (j >= 0) this.cur = list[j].key;
      this.reveal = true;
    } else if (a === "tab-next" || a === "tab-prev") {
      const k = KINDS.indexOf(this.kind);
      this.kind = KINDS[(k + (a === "tab-next" ? 1 : KINDS.length - 1)) % KINDS.length];
      this.cur = null;
    } else if (a === "panel-prev" || a === "panel-next") {
      // [ ] : the relations, round (none, Assignées, Créées, Mentionnées).
      const rels = [null, ...RELS];
      this.setRel(rels[(rels.indexOf(this.rel) + (a === "panel-next" ? 1 : rels.length - 1)) % rels.length], cx);
    } else if (a === "open" || a === "right" || a === "submit") {
      // On the PR already open, l / enter / o go into its Code tab (History's way into a commit's files).
      if (x && a !== "submit" && x.key === this.sel?.key && x.kind === "pr") this.codeIn(null);
      else if (x) {
        this.cur = x.key;
        this.select(x, cx);
      }
    } else if (a === "open-alt") { if (x?.url) exec("open", [x.url]).catch(() => {}); }
    else if (a === "yank") { if (x) this.copyLink(x, cx); }
    else if (a === "delete") { if (x) this.askClose(x); }
    else if (a === "refresh") this.refresh(cx);
    else if (a === "escape" && this.query) {
      this.query = "";
      this.cur = null;
    } else if (a === "escape" || a === "quit") run("layout.select", { stack: "view", child: "thread" });
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else return false;
    return true;
  }

  // A relation (null: everything in the scope): its cached list now, a fetch if stale.
  setRel(r, cx) {
    this.rel = r;
    this.cur = null;
    this.error = null;
    this.items = load(this.listKey())?.items ?? [];
    if (!checking()) this.loadList(cx, false);
  }

  // The page's tint: the project's color when the scope is a registry project's repo, else Inbox's ansi6.
  tint(t) {
    const repo = this.repo();
    const e = repo && (shared("kt.projects") ?? []).find((x) => this.remotes[JSON.stringify([x.machine ?? null, x.folder])] === repo);
    const c = e?.color;
    return (c && (c.startsWith("#") ? c : t[c])) || t.ansi6;
  }

  // A card's head (DESIGN-REFERENCE.md, Crosstalk's): 60 px over the dither of `tint`, a 32 px mark,
  // a title (14 semibold), a mono subtitle, controls on the right. `key`: where its width is kept.
  band(t, key, tint, icon, iconColor, title, sub, right) {
    const w = this.bands?.[key];
    return div().id(`kti-band-${key}`).relative().flex_none().h(60).overflow_hidden().rounded_t(15)
      .on_size_change((size, cx) => {
        this.bands ??= {};
        if (Math.abs((this.bands[key] ?? 0) - size.width) < 0.5) return;
        this.bands[key] = size.width;
        cx.notify();
      })
      // Inside the card's 1 px border: its radius 16 less the border.
      .when(w > 30, (el) => el.child(ditherBand(w, 60, 15, alpha(tint, settings().dark ? "6b" : "4d"), TOP)))
      .child(h_flex().size_full().px(12).gap(10).items_center()
        .child(h_flex().size(32).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(iconColor, "4d")).bg(alpha(t.background, "e6"))
          .child(svg(I(icon)).size(16).text_color(iconColor)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          // motion.js sharpen: the title comes into focus when it arrives or changes, once.
          .child(((ttl) => (this.m ? sharpen(this.m, `kti-title-${key}:${title}`, ttl) : ttl()))(
            () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(title)))
          .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(sub)))
        .children(right ?? []));
  }

  // NORMAL / INSERT (kt-keys' pill), mono 9 px, while the page has the keyboard.
  mode(t, typing) {
    return div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1)
      .border_color(typing ? alpha(t.accent, "66") : t.border).bg(typing ? alpha(t.accent, "24") : t.background)
      .font_family(MONO).text_size(9).text_color(typing ? t.accent : t.muted).child(this.vim.label);
  }

  // `cursor`: "ring" (NORMAL: a 1 px accent ring with the ink), "mark" (INSERT: ctrl-n/p's row) or null.
  // A selection's box: shown on every row once something is picked (else room kept, no shift).
  check(t, x, on, shown) {
    return div().id(`kti-check-${x.key}`).size(16).flex_none().rounded(5).border(1).flex().items_center().justify_center()
      .when(!shown, (el) => el.border_color(alpha(t.input, "00")))
      .when(shown, (el) => el.border_color(on ? t.accent : t.input).bg(on ? t.accent : t.background).cursor_pointer()
        .hover((s) => s.border_color(t.accent))
        .on_click((_e, cx) => { cx.stop_propagation(); this.multi.toggle(x.key); cx.notify(); }))
      .when(on, (el) => el.child(svg(I("check")).size(11).text_color(t.accent_foreground)));
  }

  // `gone`: closing (rows() gave it -1), drawn as it was but no longer a target: no click or box.
  row(t, x, cursor, order, gone = false) {
    const on = x.key === this.sel?.key;
    const picked = this.multi.has(x.key);
    const lk = look(x.kind, x.state, x.draft);
    const unread = !on && time(x.updatedAt) > (this.seen[x.key] ?? this.since ?? Date.now());
    // The open row carries the ink; a picked one a lighter ink and its box checked.
    return v_flex().id(`kti-row-${x.key}`).mx(4).px(12).py(10).gap(5).rounded(12).border(1)
      .border_color(cursor === "ring" ? alpha(t.accent, "99") : on ? alpha(t.accent, "66") : alpha(t.accent, "00"))
      .when(on || cursor === "ring", (el) => el.bg(alpha(t.accent, "24")))
      .when(!on && cursor !== "ring" && picked, (el) => el.bg(alpha(t.accent, "14")))
      .when(!on && !picked && cursor === "mark", (el) => el.bg(t.hover))
      .when(!gone && !on && !picked && !cursor, (el) => el.hover((s) => s.bg(t.hover)))
      // ⌘-click toggles, ⇧-click a range (select.js); a plain click empties the selection and opens.
      .when(!gone, (el) => el.cursor_pointer().on_click((e, cx) => {
        this.cur = x.key;
        if (!this.multi.click(e.modifiers, x.key, order)) this.select(x, cx);
        cx.notify();
      }))
      .child(h_flex().h(18).gap(7).items_center()
        .when(this.multi.size > 0, (el) => el.child(this.check(t, x, picked, !gone)))
        .child(svg(I(lk.icon)).size(14).flex_none().text_color(t[lk.color]))
        .child(this.eyebrow(t, `${x.kind === "pr" ? "Pull request" : "Issue"} · #${x.number}`).flex_1().min_w(0).truncate()) // i18n: tech
        .when(unread, (el) => el.child(div().size(7).rounded_full().flex_none().bg(t.accent)))
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(ago(x.updatedAt))))
      .child(div().text_size(13.5).font_medium().text_color(t.foreground).line_height("19px").max_h(38).overflow_hidden().child(x.title))
      .child(div().truncate().font_family(MONO).text_size(11).text_color(t.dim).child(x.repo))
      .when(x.labels.length > 0, (el) => el.child(h_flex().flex_wrap().gap(4).pt(2).children(x.labels.map((l) => this.tag(t, labelColor(t, l), l)))));
  }

  left(t, cx) {
    const shown = this.filtered();
    const order = shown.map((x) => x.key); // the selection's order (select.js)
    this.multi.keep(this.items.map((x) => x.key));
    const loading = Boolean(this.inflight[this.listKey()]);
    const focused = (this.keyed = this.handle.is_focused());
    const typing = focused && this.vim.insert;
    // The keys' cursor, while the page has the keyboard: its row, brought into view once after it moved.
    // None while the Code zone has the keys: one cursor shows at a time.
    const cur = focused && this.zone !== "code" ? this.at(shown)?.key : null;
    // The rows open and close on their height, in order (motion.js rows(), keyed repo#number): a filter,
    // a kind, a refresh. `at` counts them as rows() builds them, the closing ones included: they are the
    // list's direct children, after the error's line, which scroll_to_item reveals.
    let at = this.error ? 1 : 0;
    const rows = rowsOf(this.m, cx, "kti-rows", shown, (x) => x.key, (x, i) => {
      if (i >= 0 && this.reveal && x.key === cur) {
        this.listScroll.scroll_to_item(at);
        this.reveal = false;
      }
      at++;
      return this.row(t, x, i >= 0 && x.key === cur ? (typing ? "mark" : "ring") : null, order, i < 0);
    });
    const repo = this.repo();
    const tint = this.tint(t);
    const q = this.query.trim().toLowerCase();
    const matching = q ? this.items.filter((x) => `${x.title} ${x.repo} #${x.number} ${x.author} ${x.labels.join(" ")}`.toLowerCase().includes(q)) : this.items;
    const count = (k) => matching.filter((x) => !k || x.kind === k).length;
    // The page's head: the scope (the shown project's repo, else Global), how many, the Global pill
    // (a repo scope to the global view) and refresh, over the scope's dither.
    const head = this.band(t, "list", tint, "layers", tint,
      this.scope.repo === undefined ? "Inbox" : repo ?? "Global",
      // The count rolls; its id carries the scope, so another repo's count shows at once.
      rollText(this.m, `kti-head-n-${repo ?? "global"}`, [this.scope.repo === undefined ? tr("scope.reading") : repo ? tr("scope.repo") : tr("scope.global"), tr("openCount", { n: this.items.length })].join(" · "), 14),
      [
        ...(this.scope.repo ? [this.chip(t, "kti-global", "Global", this.global, (cx) => { // i18n: tech
          this.global = !this.global;
          if (!checking()) this.rescoped(cx);
        })] : []),
        h_flex().id("kti-refresh").size(30).flex_none().items_center().justify_center().rounded_full().border(1).border_color(t.border).bg(alpha(t.background, "e6"))
          .text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tr("refreshTip"))
          .on_click((_e, cx) => { this.refresh(cx); cx.notify(); })
          .child(svg(I("refresh-cw")).size(13).when(loading, (el) => el.spin(900))),
      ]);
    const filters = filterRow({
      id: "kti-filters", state: this.filters, t, bg: t.background, reduced: Boolean(shared("kt.reducedMotion")),
      items: [
        ...KINDS.map((k) => ({ key: k ?? "all", label: tr(`kind.${k ?? "all"}`), count: count(k), tint: k ? KIND_TINT[k] : null })),
        ...RELS.map((r) => ({ key: r, label: tr(`rel.${r}`), tint: REL_TINT[r], group: "rel" })),
      ],
      active: [this.kind ?? "all", this.rel],
      onPick: (key, cx) => {
        if (KINDS.some((k) => (k ?? "all") === key)) {
          this.kind = key === "all" ? null : key;
          this.cur = null;
        } else this.setRel(this.rel === key ? null : key, cx);
      },
    });
    const controls = this.card(t).flex_none()
      .child(head)
      .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(tint, "4d")))
      .child(v_flex().p(12).gap(10)
      // The filter: the keys' ring (and the ink) while typing in it; the mode beside it.
      .child(h_flex().gap(8).items_center()
        .child(h_flex().id("kti-filter").flex_1().min_w(0).h(34).px(13).gap(8).items_center().rounded_full().border(1)
          .border_color(typing ? alpha(t.accent, "99") : t.border).when(typing, (el) => el.bg(alpha(t.accent, "24"))).cursor_text()
          .track_focus(this.handle)
          .on_key_down((e, cx) => this.key(e, cx))
          .on_click((_e, cx) => { this.vim.edit(); this.handle.focus(); cx.notify(); })
          .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
          .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
            .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : tr("filter")))
          .when(Boolean(this.query), (el) => el.child(div().id("kti-clear").flex_none().text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
            .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; this.cur = null; cx.notify(); })
            .child(svg(I("x")).size(13)))))
        .when(focused, (el) => el.child(this.mode(t, typing))))
      // Types | relations, one scrolling row (tab / shift-tab the types, [ ] the relations).
      .child(filters));
    // The bulk bar floats over the list's foot while rows are picked; the list keeps room for its last row.
    const bar = this.bulk(t);
    const list = this.card(t).flex_1().relative()
      .child(v_flex().id("kti-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.listScroll).py(4).gap(2)
        .when(Boolean(bar), (el) => el.pb(64))
        .when(Boolean(this.error), (el) => el.child(this.empty(t, this.error, t.ansi1)))
        .when(!shown.length && !this.error, (el) => el.child(this.empty(t, loading ? tr("loading") : this.items.length ? tr("noMatch") : tr("empty"), null, loading)))
        .children(rows))
      .when(Boolean(bar), (el) => el.child(bar));
    return v_flex().w(400).flex_none().h_full().min_h(0).gap(4).child(controls).child(list);
  }

  // ---------- right ----------

  kpi(t, label, value, first) {
    return v_flex().gap(5).pr(18).when(!first, (el) => el.pl(18).border_l(1).border_color(t.border))
      .child(this.eyebrow(t, label))
      .child(typeof value === "string" ? div().text_size(15).text_color(t.foreground).child(value) : value);
  }

  checkCounts(checks) {
    const n = (b) => checks.filter((c) => b.includes(c.bucket)).length;
    return { pass: n(["pass"]), fail: n(["fail", "cancel"]), pending: n(["pending"]) };
  }

  head(t, x, d) {
    const data = d?.data;
    const lk = look(x.kind, data?.state ?? x.state, data?.isDraft ?? x.draft);
    const labels = data?.labels?.map((l) => l.name) ?? x.labels;
    const assignees = (data?.assignees ?? []).map((a) => `@${a.login}`);
    const kpis = [];
    if (x.kind === "pr" && data) {
      kpis.push([tr("kpi.files"), String(data.changedFiles ?? 0)]);
      kpis.push([tr("kpi.lines"), h_flex().gap(8).text_size(15)
        .child(div().text_color(t.done).child(`+${data.additions ?? 0}`)).child(div().text_color(t.ansi1).child(`−${data.deletions ?? 0}`))]);
      // A fixed width: the KPI row wraps, its cells have none.
      kpis.push(["Checks", d.checks?.length ? this.checkSteps(t, d.checks, { width: 140, id: `kti-ck-head-${x.key}` }) : "—"]);
    }
    // A repo scope's list doesn't count comments (null): an issue's detail does, a PR shows "—".
    kpis.push([tr("kpi.comments"), x.kind === "issue" && data?.comments ? String(Math.max(x.comments ?? 0, data.comments.length)) : x.comments == null ? "—" : String(x.comments)]);
    if (x.kind === "issue") kpis.push([tr("kpi.opened"), ago(data?.createdAt ?? x.createdAt)]);
    const meta = (label, value) => h_flex().gap(10).items_center().min_h(20)
      .child(this.eyebrow(t, label).w(92).flex_none())
      .child(typeof value === "string" ? div().min_w(0).truncate().text_size(13).text_color(t.foreground).child(value) : value);
    const review = { APPROVED: [tr("review.approved"), t.done], CHANGES_REQUESTED: [tr("review.changes"), t.ansi1], REVIEW_REQUIRED: [tr("review.required"), t.ansi3] }[data?.reviewDecision];
    const conflict = data?.mergeable === "CONFLICTING";
    const err = this.actionError?.key === x.key ? this.actionError.text : null;
    // The detail's head: the item's state icon over the scope's dither, what it is, where, its state.
    const head = this.band(t, "detail", this.tint(t), lk.icon, t[lk.color], `${x.kind === "pr" ? "Pull request" : "Issue"} #${x.number}`, // i18n: tech
      [x.repo, tr("updated", { ago: ago(data?.updatedAt ?? x.updatedAt) })].filter(Boolean).join(" · "), [this.tag(t, t[lk.color], lk.label)]);
    return this.card(t).flex_none()
      .child(head)
      .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(this.tint(t), "4d")))
      .child(v_flex().p(18).gap(14)
      .child(((ttl) => (this.m ? sharpen(this.m, `kti-dtitle-${x.key}`, ttl) : ttl()))(
        () => div().text_size(21).font_semibold().line_height("28px").text_color(t.foreground).child(data?.title ?? x.title)))
      .when(labels.length > 0, (el) => el.child(h_flex().flex_wrap().gap(5).children(labels.map((l) => this.tag(t, labelColor(t, l), l)))))
      // Stretched: the checks' cell is taller, the eyebrows stay on one line and the separators as high.
      .child(h_flex().flex_wrap().items_stretch().gap_y(10).children(kpis.map(([label, value], i) => this.kpi(t, label, value, i === 0))))
      .child(this.dashed(t))
      .child(v_flex().gap(6)
        .child(meta(tr("meta.author"), `@${data?.author?.login ?? x.author}`))
        .child(meta(tr("meta.assignees"), assignees.length ? assignees.join(", ") : "—"))
        .child(meta(tr("meta.activity"), tr("activity", { created: ago(data?.createdAt ?? x.createdAt), updated: ago(data?.updatedAt ?? x.updatedAt) })))
        // i18n: tech (Branches: git's word, the same in every language)
        .when(x.kind === "pr" && Boolean(data?.baseRefName), (el) => el.child(meta("Branches", h_flex().min_w(0).gap(8).items_center().font_family(MONO).text_size(12)
          .child(div().flex_none().text_color(t.foreground).child(data.baseRefName))
          .child(div().flex_none().text_color(t.dim).child("←"))
          .child(div().min_w(0).truncate().text_color(t.accent).child(data.headRefName))
          .when(Boolean(review), (el) => el.child(this.tag(t, review[1], review[0])))
          .when(conflict, (el) => el.child(this.tag(t, t.ansi1, tr("conflicts"))))))))
      .child(this.dashed(t))
      .child(h_flex().flex_wrap().gap(6).items_center()
        .children(this.actions(t, x, data))
        .when(Boolean(this.busy), (el) => el.child(h_flex().gap(6).items_center().pl(4).text_size(12).text_color(t.muted)
          .child(svg(I("refresh-cw")).size(12).spin(900)).child(tr("running", { what: this.busy })))))
      .when(Boolean(err), (el) => el.child(div().px(12).py(8).rounded(12).border(1).border_color(alpha(t.ansi1, "4d")).bg(alpha(t.ansi1, "1a"))
        .font_family(MONO).text_size(11.5).text_color(t.ansi1).child(err))));
  }

  // The PR's files as Changes draws them (diffview's sectionHead and fileItems): one foldable section,
  // compact rows opening and closing on their height, each unfolding into its diff, an image into its
  // before / after. On hover: Zed and its nvim command in a local checkout (d.root), the file on GitHub.
  // The keys' cursor while the Code zone has them, brought into view once after it moved.
  code(t, x, cx) {
    const d = this.diffs[x.key];
    if (!d) return this.empty(t, tr("loadingDiff"), null, true);
    if (d.error) return this.empty(t, d.error, t.ansi1);
    if (!d.files.length) return this.empty(t, tr("noFiles"));
    const dark = settings().dark !== false, root = d.root ?? null;
    const k = (f) => `${x.key}:${f.path}`;
    const o = {
      id: `kti-f-${x.key}`, map: this.map, dark, root, compact: true,
      preview: (f) => this.previews[k(f)],
      tokens: (f) => { const tk = this.tokens[k(f)]; return tk?.mode === (dark ? "dark" : "light") ? tk : null; },
      isOpen: (f) => this.openFiles.has(k(f)),
      isHot: (f) => this.hotFile === k(f),
      // A click toggles, and takes the keys' cursor (and the keyboard) along.
      toggle: (f, cx) => { this.codeIn(f.path); this.toggleFile(x, f, cx); cx.notify(); },
      hover: (f, on, cx) => {
        const next = on ? k(f) : this.hotFile === k(f) ? null : this.hotFile;
        if (next !== this.hotFile) { this.hotFile = next; cx.notify(); }
      },
      actions: (f) => {
        const id = `kti-fa-${k(f)}`, abs = root ? `${root}/${f.path}` : null;
        return [
          ...(abs ? [
            action(t, `${id}:zed`, I("external-link"), tr("openZed"), () => this.openAt(x, f, root)),
            action(t, `${id}:nvim`, "mods/kt-diff/copy.svg", tr("copyNvim"), (cx) => cx.write_to_clipboard(`nvim +${firstLine(f)} '${abs.replace(/'/g, "'\\''")}'`)),
          ] : []),
          action(t, `${id}:gh`, I("file-diff"), tr("pill.github"), () => this.openAt(x, f, null)),
        ];
      },
    };
    // Another PR, or the diff just in: the cursor goes on the first file (the header, folded).
    const shown = this.codeFold ? [] : [...d.files].sort((a, b) => a.path.localeCompare(b.path));
    if (this.fcur !== "h" && !shown.some((f) => `f:${f.path}` === this.fcur)) this.fcur = shown.length ? `f:${shown[0].path}` : "h";
    const ring = (id) => this.keyed && this.zone === "code" && this.fcur === id;
    const flat = [{ id: "h" }];
    const items = [];
    const put = (id, el) => {
      if (this.codeReveal && id && id === this.fcur) this.codeScroll.scroll_to_item(items.length);
      items.push(el);
    };
    put("h", sectionHead(t, { id: "kti-code-head", label: tr("code.files"), count: d.files.length, folded: this.codeFold, ring: ring("h"),
      toggle: (cx) => { this.codeFold = !this.codeFold; cx.notify(); },
      actions: [action(t, "kti-code-refresh", I("refresh-cw"), tr("refreshTip"), (cx) => this.refresh(cx))] }));
    for (const { el, f } of fileItems(t, this.m, cx, `kti-rows-${x.key}`, this.codeFold ? [] : d.files, o,
      { ring: (f) => ring(`f:${f.path}`), fold: (f) => `kti-open:${k(f)}` })) {
      if (f) flat.push({ id: `f:${f.path}`, file: f });
      put(f ? `f:${f.path}` : null, el);
    }
    this.codeFlat = flat;
    this.codeReveal = false;
    // overflow_y_scroll + a Scrollbar of the same id: scroll_to_item does nothing on overflow_y_scrollbar.
    return div().relative().flex_1().min_h(0)
      .child(v_flex().id("kti-code").size_full().overflow_y_scroll().track_scroll(this.codeScroll).p(4).gap(1).children(items))
      .child(Scrollbar.vertical("kti-code").absolute().inset_0());
  }

  checksView(t, x, d) {
    const cs = d?.checks ?? [];
    if (!d?.data) return this.empty(t, tr("loadingChecks"), null, true);
    if (!cs.length) return this.empty(t, tr("noChecks"));
    const c = this.checkCounts(cs);
    // The counts by kind, then the steps as wide as the card (« n / total » is theirs).
    return v_flex().id("kti-checks").flex_1().min_h(0).overflow_y_scrollbar().py(4).gap(2)
      .child(v_flex().mx(4).px(12).py(8).gap(8)
        .child(this.eyebrow(t, tr("checkCounts", { pass: c.pass, fail: c.fail, pending: c.pending })))
        .child(this.checkSteps(t, cs, { id: `kti-ck-tab-${x.key}` })))
      .children(cs.map((ck, i) => {
        const color = t[BUCKET[ck.bucket] ?? "dim"];
        return h_flex().id(`kti-ck-${i}`).mx(4).px(12).h(38).gap(10).items_center().rounded(12).hover((s) => s.bg(t.hover))
          .when(Boolean(ck.link), (el) => el.cursor_pointer().on_click(() => exec("open", [ck.link]).catch(() => {})))
          .child(div().size(8).rounded_full().flex_none().bg(color))
          .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(t.foreground).child(ck.name))
          .child(this.tag(t, color, ck.state))
          .when(Boolean(ck.link), (el) => el.child(svg(I("external-link")).size(13).flex_none().text_color(t.dim)));
      }));
  }

  body(t, x, d, cx) {
    const data = d?.data;
    const card = this.card(t).flex_1();
    if (!data) return card.child(this.empty(t, d?.error ?? tr("loading"), d?.error ? t.ansi1 : t.dim, !d?.error));
    const scroll = (id) => v_flex().id(id).flex_1().min_h(0).overflow_y_scrollbar();
    if (x.kind === "issue") {
      const comments = data.comments ?? [];
      return card.child(scroll("kti-issue").p(18).gap(14)
        .child(this.markdown(t, `kti-md-${x.key}`, data.body))
        .child(this.dashed(t))
        .child(this.eyebrow(t, comments.length ? tr("comments", { n: comments.length }) : tr("noComments")))
        .children(comments.map((c, i) => v_flex().gap(8).p(12).rounded(12).border(1).border_color(t.border)
          .child(h_flex().gap(8).items_center()
            .child(this.eyebrow(t, `@${c.author?.login ?? "?"}`, t.foreground))
            .child(div().font_family(MONO).text_size(11).text_color(t.dim).child(ago(c.createdAt))))
          .child(this.markdown(t, `kti-mdc-${x.key}-${i}`, c.body)))));
    }
    const nChecks = (d.checks ?? []).length;
    const tabs = [["summary", "Summary"], ["code", `Code · ${data.changedFiles ?? 0}`], ["checks", `Checks · ${nChecks}`]]; // i18n: tech
    return card
      .child(h_flex().flex_none().px(12).py(10).gap(6).items_center()
        .children(tabs.map(([id, label]) => this.chip(t, `kti-tab-${id}`, label, this.tab === id, () => { this.tab = id; }))))
      .child(this.dashed(t))
      .when(this.tab === "summary", (el) => el.child(scroll("kti-summary").p(18).child(this.markdown(t, `kti-md-${x.key}`, data.body))))
      .when(this.tab === "code", (el) => el.child(this.code(t, x, cx)))
      .when(this.tab === "checks", (el) => el.child(this.checksView(t, x, d)));
  }

  right(t, cx) {
    const x = this.sel;
    const panel = v_flex().flex_1().min_w(0).h_full().min_h(0).gap(4);
    if (!x) {
      const busy = Boolean(this.inflight[this.listKey()]);
      return panel.child(this.card(t).flex_1().child(this.empty(t, busy ? tr("loading") : tr("pick"), null, busy)));
    }
    const d = this.details[x.key];
    // The detail fades in each time another item opens (its id carries the item).
    return enter(this.m, panel.child(this.head(t, x, d)).child(this.body(t, x, d, cx)), `kti-detail-${x.key}`, { dy: 0 });
  }

  render(cx) {
    // Coming into view: follow the shown space, fetch what's stale now, not at the next tick.
    const vis = visible();
    if (vis && !checking()) {
      this.follow(cx);
      this.openAsked(cx);
    }
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    // Another mod (or this one) acted on GitHub: read again (DATA-SYNC.md). The first render records.
    if (!checking()) refreshOn(this, cx, "gh", ["gh"], async (cx) => {
      this.loadList(cx, true);
      this.loadDetail(cx, true);
    });
    if (vis && !this.shown) this.arrivals++;
    if (vis && !this.shown && !checking()) {
      // Back on the page: what moved while it was hidden (on GitHub, or by an agent), if read over 10 s ago.
      if (Date.now() - (load(this.listKey())?.at ?? 0) > 10e3) this.loadList(cx, true);
      if (this.sel && Date.now() - (this.details[this.sel.key]?.at ?? 0) > 10e3) this.loadDetail(cx, true);
      // The thread's terminal is hidden under this page: take the keyboard (typing filters).
      // Not during render, and after the app has settled its own focus on the switch.
      // INSERT then, unless pane.go or a key command already gave it the keyboard (NORMAL).
      cx.timer.after(150, (cx) => {
        if (visible() && !this.handle.is_focused()) {
          this.handle.focus();
          this.vim.edit();
        }
        cx.notify();
      });
      this.loadList(cx, false);
      cx.spawn(async () => { await cleanPreviews(); await cleanTokens("kt-inbox"); });
    }
    if (!vis && this.shown && this.handle.is_focused() && !checking()) {
      // Back to the thread: the keyboard goes back to its terminal.
      const tab = spaces().find((s) => s.active)?.tabs.find((c) => c.active)?.id;
      const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
      if (pane) cx.spawn(async () => run("pane.focus", { pane }));
    }
    this.shown = vis;
    if (vis && this.tab === "code" && this.sel?.kind === "pr" && !checking()) this.loadDiff(cx);
    // The Code zone lasts while its tab shows a PR, in NORMAL (the filter typing, a tab or an item
    // changed: the keys are the list's again).
    if (this.zone === "code" && (this.vim.insert || this.tab !== "code" || this.sel?.kind !== "pr")) this.zone = "list";
    const t = theme();
    this.V = viz(t, this.m, { roll });
    // No frame of its own: the work card around it paints the background. Each arrival fades the
    // page in (no rise: the stack doesn't clip).
    return enter(this.m, h_flex().size_full().gap(4).text_color(t.foreground)
      .child(this.left(t, cx))
      .child(this.right(t, cx)), `kti-page-${this.arrivals}`, { dy: 0 });
  }
}
