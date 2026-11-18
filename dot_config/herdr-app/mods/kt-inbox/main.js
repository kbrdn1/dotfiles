// kbrdn Inbox (Monocode's Inbox, kbrdn.dev look): the open GitHub pull
// requests and issues that involve me, as one tab. Left panel: a filter field,
// type pills (Tout / PR / Issues), relation pills (Assignées / Créées /
// Mentionnées; none = everything I'm involved in), refresh, and the list
// (latest activity first, a dot when it moved since I last opened it). Right
// panel: the selected item's key figures, meta and actions, then for a PR
// Summary / Code / Checks, for an issue its body and last 20 comments.
// Every change (merge, draft, ready, close, reopen) asks first through the
// shipped `confirm` dialog, which calls back `kt-inbox.confirmed`.
// Data: `gh`, cached in localStorage (list 2 min, detail 1 min); the list
// refreshes every 2 min, only while this tab is the one shown.
// Opened by kt-threads: run("tab.new", { mod: "kt-inbox", name: "Inbox" }).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, TextView, v_virtual_list, Scrollbar } from "gpui-base";
import { exec, theme, spaces, panes, openOverlay, notify, nextCommand, settings, checking } from "herdr";

const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const LIST_TTL = 120e3;
const DETAIL_TTL = 60e3;
const MAX_DIFF = 2000;
const LIST_FIELDS = "number,title,repository,updatedAt,createdAt,labels,url,state,author,commentsCount";
const PR_FIELDS = "number,title,body,state,isDraft,author,assignees,createdAt,updatedAt,baseRefName,headRefName,url,mergeable,reviewDecision,labels,additions,deletions,changedFiles";
const ISSUE_FIELDS = "number,title,body,state,author,assignees,createdAt,updatedAt,url,labels,comments";
const KINDS = [[null, "Tout"], ["pr", "PR"], ["issue", "Issues"]];
const RELS = [["assignee", "Assignées"], ["author", "Créées"], ["mentions", "Mentionnées"]];
// Labels get a theme color by name (GitHub's own hex would ignore the theme).
const LABEL_COLORS = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
// `gh pr checks` bucket -> theme color name.
const BUCKET = { pass: "done", fail: "ansi1", cancel: "ansi1", pending: "ansi3", skipping: "dim" };

const gh = (args, timeout = 20e3) => exec("gh", args, { timeout }).catch((e) => ({ code: 1, stdout: "", stderr: String(e) }));
const parse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
const load = (k) => parse(localStorage.getItem(k) ?? "null", null);
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const time = (iso) => Date.parse(iso ?? "") || 0;

function ago(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - time(iso)) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  if (d < 365) return `il y a ${Math.floor(d / 30)} mois`;
  const y = Math.floor(d / 365);
  return `il y a ${y} an${y > 1 ? "s" : ""}`;
}

// State -> label, icon, theme color name. Upper-cased: search says "open", view says "OPEN".
function look(kind, state, draft) {
  const s = String(state ?? "").toUpperCase();
  if (kind === "pr") {
    if (s === "MERGED") return { label: "Merged", icon: "git-merge", color: "ansi5" };
    if (s === "CLOSED") return { label: "Closed", icon: "git-pull-request-closed", color: "ansi1" };
    if (draft) return { label: "Draft", icon: "git-pull-request", color: "dim" };
    return { label: "Open", icon: "git-pull-request", color: "ansi2" };
  }
  return s === "CLOSED" ? { label: "Closed", icon: "circle-check", color: "ansi5" } : { label: "Open", icon: "circle-dashed", color: "ansi2" };
}

function labelColor(t, name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return t[LABEL_COLORS[h % LABEL_COLORS.length]];
}

function item(kind, x) {
  const repo = x.repository?.nameWithOwner ?? "";
  return {
    kind, key: `${repo}#${x.number}`, repo, number: x.number, title: x.title ?? "", url: x.url,
    updatedAt: x.updatedAt, createdAt: x.createdAt, labels: (x.labels ?? []).map((l) => l.name),
    draft: Boolean(x.isDraft), state: String(x.state ?? "").toUpperCase(), author: x.author?.login ?? "", comments: x.commentsCount ?? 0,
  };
}

// Shown: the active space's active tab holds a kt-inbox pane.
function shownHere() {
  const tab = spaces().find((s) => s.active)?.tabs.find((c) => c.active)?.id;
  return Boolean(tab) && panes().some((p) => p.tab === tab && p.mod === "kt-inbox");
}

export default class Inbox extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.query = "";
    this.kind = null; // null | "pr" | "issue"
    this.rel = null; // null (involves) | "assignee" | "author" | "mentions"
    this.items = [];
    this.error = null;
    this.inflight = {}; // what gh is fetching now, by cache key
    this.sel = null; // the selected item (kept even if it leaves the list)
    this.details = {}; // "owner/repo#n" -> { at, data, checks, error }
    this.diffs = {}; // "owner/repo#n" -> { at, lines, more } | { at, error } (memory only: can be big)
    this.tab = "summary";
    this.busy = null; // the running action's label
    this.actionError = null; // { key, text }
    this.pending = null; // the action the confirm dialog is asking about
    this.seen = {};
    if (checking()) return;
    this.seen = load("seen") ?? {};
    // First run: everything already there counts as seen.
    this.since = load("since") ?? Date.now();
    save("since", this.since);
    this.details = load("details") ?? {};
    this.items = load(this.listKey())?.items ?? [];
    // Every minute while shown: redraw the ages; the list once its cache is ~2 min old.
    cx.timer.every(60e3, (cx) => {
      if (!shownHere()) return;
      if (Date.now() - (load(this.listKey())?.at ?? 0) > LIST_TTL - 30e3) this.loadList(cx, true);
      cx.notify();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "refresh") this.refresh(cx);
        else if (c === "confirmed" && this.pending) {
          const p = this.pending;
          this.pending = null;
          this.act(p, cx);
        }
        cx.notify();
      }
    });
  }

  // ---------- data ----------

  listKey() {
    return `list:${this.rel ?? "involves"}`;
  }

  loadList(cx, force) {
    const key = this.listKey();
    const cached = load(key);
    if (!force && cached && Date.now() - cached.at < LIST_TTL) {
      this.items = cached.items;
      return this.pickFirst(cx);
    }
    if (this.inflight[key]) return;
    this.inflight[key] = true;
    const who = `--${this.rel ?? "involves"}=@me`;
    const search = (what, fields) => gh(["search", what, who, "--state=open", "--sort=updated", "--json", fields, "--limit", "50"]);
    cx.spawn(async (cx) => {
      const [p, i] = await Promise.all([search("prs", `${LIST_FIELDS},isDraft`), search("issues", LIST_FIELDS)]);
      delete this.inflight[key];
      const prs = parse(p.stdout, null);
      const issues = parse(i.stdout, null);
      const error = (!prs && (p.stderr.trim() || "gh search prs a échoué")) || (!issues && (i.stderr.trim() || "gh search issues a échoué")) || null;
      if (prs || issues) {
        const items = [...(prs ?? []).map((x) => item("pr", x)), ...(issues ?? []).map((x) => item("issue", x))].sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
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
      } else this.details[x.key] = { ...(d ?? {}), at: d?.at ?? 0, error: next.error || "gh n'a rien renvoyé" };
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
      const r = await gh(["pr", "diff", String(x.number), "-R", x.repo]);
      delete this.inflight[key];
      const all = r.stdout.replace(/\n$/, "").split("\n");
      this.diffs[x.key] = r.code
        ? { at: Date.now(), error: r.stderr.trim() || "gh pr diff a échoué" }
        : { at: Date.now(), lines: all.slice(0, MAX_DIFF).map((l) => l.replace(/\t/g, "    ")), more: Math.max(0, all.length - MAX_DIFF) };
      cx.notify();
    });
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
    openOverlay({ mod: "confirm", kind: "dialog", width: 460, height: 200, props: { title, detail, command: { name: "kt-inbox.confirmed" } } });
  }

  act(p, cx) {
    this.busy = p.label;
    this.actionError = null;
    cx.spawn(async (cx) => {
      const r = await gh(p.args, 60e3);
      this.busy = null;
      if (r.code) this.actionError = { key: p.key, text: (r.stderr || r.stdout).trim() || `gh ${p.args.slice(0, 2).join(" ")} a échoué (code ${r.code})` };
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
    const name = `${x.kind === "pr" ? "la PR" : "l'issue"} #${n} de ${x.repo}`;
    const what = `« ${data?.title ?? x.title} »`;
    const url = data?.url ?? x.url;
    const out = [];
    if (x.kind === "pr" && state === "OPEN") {
      const draft = data?.isDraft ?? x.draft;
      if (!draft)
        out.push(this.pill(t, "merge", "Merger", "git-merge", true, () =>
          this.ask(x, "Merge", `Merger la PR #${n} ?`, `${what} (${x.repo}) : ${data?.headRefName ?? "sa branche"} sera mergée dans ${data?.baseRefName ?? "la base"} par un merge commit. La branche est conservée.`, ["pr", "merge", n, ...R, "--merge"])));
      out.push(draft
        ? this.pill(t, "ready", "Prête pour review", "circle-check", false, () =>
            this.ask(x, "Prête pour review", `Marquer la PR #${n} prête pour review ?`, `${what} (${x.repo}) quittera le mode draft.`, ["pr", "ready", n, ...R]))
        : this.pill(t, "draft", "Passer en draft", "circle-dashed", false, () =>
            this.ask(x, "Passage en draft", `Passer la PR #${n} en draft ?`, `${what} (${x.repo}) repassera en draft.`, ["pr", "ready", n, ...R, "--undo"])));
      out.push(this.pill(t, "close", "Fermer", "git-pull-request-closed", false, () =>
        this.ask(x, "Fermeture", `Fermer la PR #${n} ?`, `${what} (${x.repo}) sera fermée sans être mergée.`, ["pr", "close", n, ...R])));
    }
    if (x.kind === "issue" && state === "OPEN")
      out.push(this.pill(t, "close", "Fermer", "circle-check", false, () =>
        this.ask(x, "Fermeture", `Fermer l'issue #${n} ?`, `${what} (${x.repo}) sera fermée.`, ["issue", "close", n, ...R])));
    if (x.kind === "issue" && state === "CLOSED")
      out.push(this.pill(t, "reopen", "Rouvrir", "circle-dashed", false, () =>
        this.ask(x, "Réouverture", `Rouvrir l'issue #${n} ?`, `${what} (${x.repo}) sera rouverte.`, ["issue", "reopen", n, ...R])));
    out.push(this.pill(t, "copy", "Copier le lien", null, false, (cx) => {
      cx.write_to_clipboard(url);
      notify({ title: "Lien copié", body: `${name}`, level: "success", timeout: 2500 });
    }));
    out.push(this.pill(t, "open", "Ouvrir sur GitHub", "external-link", false, () => exec("open", [url]).catch(() => {})));
    return out;
  }

  // ---------- pieces ----------

  // kbrdn.dev `.eyebrow`: mono 11 px, uppercase, label color.
  eyebrow(t, text, color) {
    return div().font_family(MONO).text_size(11).text_color(color ?? t.muted).child(String(text).toUpperCase());
  }

  // kbrdn.dev `.tag`: pill, border 30% / fill 10% of its own color.
  tag(t, color, text) {
    return h_flex().flex_none().h(20).px(8).items_center().rounded_full().border(1).border_color(color + "4d").bg(color + "1a")
      .text_color(color).font_family(MONO).text_size(10.5).child(String(text).toUpperCase());
  }

  // A filter pill: ink when on.
  chip(t, id, label, on, onClick) {
    return h_flex().id(id).flex_none().h(26).px(11).items_center().rounded_full().border(1)
      .border_color(on ? t.accent + "66" : t.border)
      .when(on, (el) => el.bg(t.accent + "24"))
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

  // kbrdn.dev `.meter.ticks`: 2 px bars every 6 px, in segment order, the rest off.
  meter(t, parts, total, ticks = 16) {
    const colors = [];
    for (const [n, color] of parts) {
      const k = n ? Math.max(1, Math.round((n / Math.max(1, total)) * ticks)) : 0;
      for (let i = 0; i < k; i++) colors.push(color);
    }
    while (colors.length < ticks) colors.push(t.border);
    return h_flex().flex_none().h(12).gap(4).children(colors.slice(0, ticks).map((c) => div().w(2).h_full().bg(c)));
  }

  dashed(t) {
    return div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border);
  }

  empty(t, text, color) {
    return div().p(16).text_size(13).text_color(color ?? t.dim).child(text);
  }

  // A panel (radius 20, padding 4) holding cards (radius 16): concentric.
  panel(t) {
    return v_flex().min_h(0).p(4).gap(4).rounded(20).border(1).border_color(t.border).bg(t.chrome);
  }

  card(t) {
    return v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
  }

  markdown(t, id, text) {
    return div().text_size(13).text_color(t.foreground).child(TextView.markdown(id, text?.trim() || "_Pas de description._").selectable(true));
  }

  // ---------- left ----------

  filtered() {
    const q = this.query.trim().toLowerCase();
    return this.items.filter((x) => (!this.kind || x.kind === this.kind)
      && (!q || `${x.title} ${x.repo} #${x.number} ${x.author} ${x.labels.join(" ")}`.toLowerCase().includes(q)));
  }

  key(e, cx) {
    if (e.key === "escape") this.query = "";
    else if (e.key === "backspace") this.query = this.query.slice(0, -1);
    else if (e.key === "enter") { const first = this.filtered()[0]; if (first) this.select(first, cx); }
    else if (e.key_char && !e.modifiers?.control && !e.modifiers?.platform) this.query += e.key_char;
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  row(t, x) {
    const on = x.key === this.sel?.key;
    const lk = look(x.kind, x.state, x.draft);
    const unread = !on && time(x.updatedAt) > (this.seen[x.key] ?? this.since ?? Date.now());
    return v_flex().id(`kti-row-${x.key}`).mx(4).px(12).py(10).gap(5).rounded(12).border(1)
      .border_color(on ? t.accent + "66" : t.accent + "00")
      .when(on, (el) => el.bg(t.accent + "24"))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .cursor_pointer()
      .on_click((_e, cx) => { this.select(x, cx); cx.notify(); })
      .child(h_flex().h(18).gap(7).items_center()
        .child(svg(I(lk.icon)).size(14).flex_none().text_color(t[lk.color]))
        .child(this.eyebrow(t, `${x.kind === "pr" ? "Pull request" : "Issue"} · #${x.number}`).flex_1().min_w(0).truncate())
        .when(unread, (el) => el.child(div().size(7).rounded_full().flex_none().bg(t.accent)))
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(ago(x.updatedAt))))
      .child(div().text_size(13.5).font_medium().text_color(t.foreground).line_height("19px").max_h(38).overflow_hidden().child(x.title))
      .child(div().truncate().font_family(MONO).text_size(11).text_color(t.dim).child(x.repo))
      .when(x.labels.length > 0, (el) => el.child(h_flex().flex_wrap().gap(4).pt(2).children(x.labels.map((l) => this.tag(t, labelColor(t, l), l)))));
  }

  left(t) {
    const shown = this.filtered();
    const loading = Boolean(this.inflight[this.listKey()]);
    const typing = this.handle.is_focused();
    const controls = this.card(t).flex_none().p(12).gap(10)
      .child(h_flex().gap(8).items_center()
        // The source segment (one source today: GitHub).
        .child(h_flex().p(3).rounded_full().border(1).border_color(t.border)
          .child(h_flex().h(26).px(12).gap(7).items_center().rounded_full().border(1).border_color(t.accent + "66").bg(t.accent + "24").text_size(12.5).font_medium()
            .child("GitHub").child(div().font_family(MONO).text_size(11).text_color(t.muted).child(String(this.items.length)))))
        .child(div().flex_1())
        .child(h_flex().id("kti-refresh").h(32).px(12).gap(6).items_center().rounded_full().border(1).border_color(t.border)
          .text_size(12).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { this.refresh(cx); cx.notify(); })
          .child(svg(I("refresh-cw")).size(13).when(loading, (el) => el.spin(900)))
          .child("Actualiser")))
      .child(h_flex().id("kti-filter").h(34).px(13).gap(8).items_center().rounded_full().border(1)
        .border_color(typing ? t.accent : t.border).cursor_text()
        .track_focus(this.handle)
        .on_key_down((e, cx) => this.key(e, cx))
        .on_click((_e, cx) => { this.handle.focus(); cx.notify(); })
        .child(svg(I("search")).size(14).flex_none().text_color(t.dim))
        .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(this.query ? t.foreground : t.dim)
          .child(this.query ? this.query + (typing ? "▏" : "") : typing ? "▏" : "Filtrer"))
        .when(Boolean(this.query), (el) => el.child(div().id("kti-clear").flex_none().text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
          .on_click((_e, cx) => { cx.stop_propagation(); this.query = ""; cx.notify(); })
          .child(svg(I("x")).size(13)))))
      .child(h_flex().gap(5).items_center()
        .children(KINDS.map(([k, label]) => this.chip(t, `kti-kind-${k ?? "all"}`, label, this.kind === k, () => { this.kind = k; }))))
      .child(h_flex().gap(5).items_center()
        .children(RELS.map(([r, label]) => this.chip(t, `kti-rel-${r}`, label, this.rel === r, (cx) => {
          this.rel = this.rel === r ? null : r;
          this.error = null;
          this.items = load(this.listKey())?.items ?? [];
          if (!checking()) this.loadList(cx, false);
        }))));
    const list = this.card(t).flex_1()
      .child(v_flex().id("kti-list").flex_1().min_h(0).overflow_y_scrollbar().py(4).gap(2)
        .when(Boolean(this.error), (el) => el.child(this.empty(t, this.error, t.ansi1)))
        .when(!shown.length && !this.error, (el) => el.child(this.empty(t, loading ? "Chargement…" : this.items.length ? "Aucun élément ne correspond au filtre." : "Rien dans l'Inbox.")))
        .children(shown.map((x) => this.row(t, x))));
    return this.panel(t).w(400).flex_none().h_full().child(controls).child(list);
  }

  // ---------- right ----------

  kpi(t, label, value, first) {
    return v_flex().gap(5).pr(18).when(!first, (el) => el.pl(18).border_l(1).border_color(t.border))
      .child(this.eyebrow(t, label))
      .child(typeof value === "string" ? div().text_size(15).text_color(t.foreground).child(value) : value);
  }

  checkCounts(checks) {
    const n = (b) => checks.filter((c) => b.includes(c.bucket)).length;
    return { pass: n(["pass"]), fail: n(["fail", "cancel"]), pending: n(["pending"]), total: checks.length };
  }

  head(t, x, d) {
    const data = d?.data;
    const lk = look(x.kind, data?.state ?? x.state, data?.isDraft ?? x.draft);
    const labels = data?.labels?.map((l) => l.name) ?? x.labels;
    const assignees = (data?.assignees ?? []).map((a) => `@${a.login}`);
    const kpis = [];
    if (x.kind === "pr" && data) {
      kpis.push(["Fichiers", String(data.changedFiles ?? 0)]);
      kpis.push(["Lignes", h_flex().gap(8).text_size(15)
        .child(div().text_color(t.done).child(`+${data.additions ?? 0}`)).child(div().text_color(t.ansi1).child(`−${data.deletions ?? 0}`))]);
      const c = this.checkCounts(d.checks ?? []);
      kpis.push(["Checks", c.total
        ? h_flex().gap(8).items_center().child(this.meter(t, [[c.pass, t.done], [c.fail, t.ansi1], [c.pending, t.ansi3]], c.total))
          .child(div().text_size(15).text_color(c.fail ? t.ansi1 : c.pending ? t.ansi3 : t.foreground).child(`${c.pass}/${c.total}`))
        : "—"]);
    }
    kpis.push(["Commentaires", String(x.kind === "issue" && data?.comments ? Math.max(x.comments, data.comments.length) : x.comments)]);
    if (x.kind === "issue") kpis.push(["Ouverte", ago(data?.createdAt ?? x.createdAt)]);
    const meta = (label, value) => h_flex().gap(10).items_center().min_h(20)
      .child(this.eyebrow(t, label).w(92).flex_none())
      .child(typeof value === "string" ? div().min_w(0).truncate().text_size(13).text_color(t.foreground).child(value) : value);
    const review = { APPROVED: ["Approuvée", t.done], CHANGES_REQUESTED: ["Changements demandés", t.ansi1], REVIEW_REQUIRED: ["Review requise", t.ansi3] }[data?.reviewDecision];
    const conflict = data?.mergeable === "CONFLICTING";
    const err = this.actionError?.key === x.key ? this.actionError.text : null;
    return this.card(t).flex_none().p(18).gap(14)
      .child(h_flex().gap(8).items_center()
        .child(svg(I(lk.icon)).size(15).flex_none().text_color(t[lk.color]))
        .child(this.eyebrow(t, `${x.kind === "pr" ? "Pull request" : "Issue"} · #${x.number}`).flex_none())
        .child(this.tag(t, t[lk.color], lk.label))
        .child(div().flex_1())
        .child(div().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.dim).child(x.repo)))
      .child(div().text_size(21).font_semibold().line_height("28px").text_color(t.foreground).child(data?.title ?? x.title))
      .when(labels.length > 0, (el) => el.child(h_flex().flex_wrap().gap(5).children(labels.map((l) => this.tag(t, labelColor(t, l), l)))))
      .child(h_flex().flex_wrap().gap_y(10).children(kpis.map(([label, value], i) => this.kpi(t, label, value, i === 0))))
      .child(this.dashed(t))
      .child(v_flex().gap(6)
        .child(meta("Auteur", `@${data?.author?.login ?? x.author}`))
        .child(meta("Assignés", assignees.length ? assignees.join(", ") : "—"))
        .child(meta("Activité", `créée ${ago(data?.createdAt ?? x.createdAt)} · mise à jour ${ago(data?.updatedAt ?? x.updatedAt)}`))
        .when(x.kind === "pr" && Boolean(data?.baseRefName), (el) => el.child(meta("Branches", h_flex().min_w(0).gap(8).items_center().font_family(MONO).text_size(12)
          .child(div().flex_none().text_color(t.foreground).child(data.baseRefName))
          .child(div().flex_none().text_color(t.dim).child("←"))
          .child(div().min_w(0).truncate().text_color(t.accent).child(data.headRefName))
          .when(Boolean(review), (el) => el.child(this.tag(t, review[1], review[0])))
          .when(conflict, (el) => el.child(this.tag(t, t.ansi1, "Conflits")))))))
      .child(this.dashed(t))
      .child(h_flex().flex_wrap().gap(6).items_center()
        .children(this.actions(t, x, data))
        .when(Boolean(this.busy), (el) => el.child(h_flex().gap(6).items_center().pl(4).text_size(12).text_color(t.muted)
          .child(svg(I("refresh-cw")).size(12).spin(900)).child(`${this.busy} en cours…`))))
      .when(Boolean(err), (el) => el.child(div().px(12).py(8).rounded(12).border(1).border_color(t.ansi1 + "4d").bg(t.ansi1 + "1a")
        .font_family(MONO).text_size(11.5).text_color(t.ansi1).child(err)));
  }

  diffLine(t, l) {
    const meta = l.startsWith("+++") || l.startsWith("---") || l.startsWith("index ");
    const file = l.startsWith("diff --git");
    const k = meta ? "" : l[0];
    const color = file ? t.foreground : meta ? t.dim : k === "+" ? t.done : k === "-" ? t.ansi1 : k === "@" ? t.accent : t.muted;
    return div().w_full().h(20).px(14).flex().items_center().truncate().text_color(color)
      .when(k === "+", (el) => el.bg(t.done + "1a"))
      .when(k === "-", (el) => el.bg(t.ansi1 + "1a"))
      .when(file, (el) => el.bg(t.raised).font_semibold())
      .child(l || " ");
  }

  code(t, x) {
    const d = this.diffs[x.key];
    if (!d) return this.empty(t, "Chargement du diff…");
    if (d.error) return this.empty(t, d.error, t.ansi1);
    const lines = d.lines;
    return v_flex().flex_1().min_h(0)
      .child(div().flex_1().min_h(0).relative().font_family(String(settings().font_family ?? "JetBrains Mono")).text_size(12)
        .child(v_virtual_list("kti-diff", lines.length, 20, (i) => String(i), (range) => lines.slice(range.start, range.end).map((l) => this.diffLine(t, l))).size_full())
        .child(Scrollbar.vertical("kti-diff").viewport_from_layout().absolute().inset_0()))
      .when(d.more > 0, (el) => el.child(div().flex_none().px(14).py(8).border_t(1).border_dashed().border_color(t.border)
        .font_family(MONO).text_size(11).text_color(t.dim).child(`${d.more} lignes de plus non affichées (limite ${MAX_DIFF})`)));
  }

  checksView(t, d) {
    const cs = d?.checks ?? [];
    if (!d?.data) return this.empty(t, "Chargement des checks…");
    if (!cs.length) return this.empty(t, "Aucun check sur cette PR.");
    const c = this.checkCounts(cs);
    return v_flex().id("kti-checks").flex_1().min_h(0).overflow_y_scrollbar().py(4).gap(2)
      .child(h_flex().mx(4).px(12).py(8).gap(12).items_center()
        .child(this.meter(t, [[c.pass, t.done], [c.fail, t.ansi1], [c.pending, t.ansi3]], c.total, 24))
        .child(this.eyebrow(t, `${c.pass} ok · ${c.fail} ko · ${c.pending} en cours · ${c.total} au total`)))
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

  body(t, x, d) {
    const data = d?.data;
    const card = this.card(t).flex_1();
    if (!data) return card.child(this.empty(t, d?.error ?? "Chargement…", d?.error ? t.ansi1 : t.dim));
    const scroll = (id) => v_flex().id(id).flex_1().min_h(0).overflow_y_scrollbar();
    if (x.kind === "issue") {
      const comments = data.comments ?? [];
      return card.child(scroll("kti-issue").p(18).gap(14)
        .child(this.markdown(t, `kti-md-${x.key}`, data.body))
        .child(this.dashed(t))
        .child(this.eyebrow(t, comments.length ? `Commentaires · ${comments.length} derniers` : "Aucun commentaire"))
        .children(comments.map((c, i) => v_flex().gap(8).p(12).rounded(12).border(1).border_color(t.border)
          .child(h_flex().gap(8).items_center()
            .child(this.eyebrow(t, `@${c.author?.login ?? "?"}`, t.foreground))
            .child(div().font_family(MONO).text_size(11).text_color(t.dim).child(ago(c.createdAt))))
          .child(this.markdown(t, `kti-mdc-${x.key}-${i}`, c.body)))));
    }
    const nChecks = (d.checks ?? []).length;
    const tabs = [["summary", "Summary"], ["code", `Code · ${data.changedFiles ?? 0}`], ["checks", `Checks · ${nChecks}`]];
    return card
      .child(h_flex().flex_none().px(12).py(10).gap(6).items_center()
        .children(tabs.map(([id, label]) => this.chip(t, `kti-tab-${id}`, label, this.tab === id, () => { this.tab = id; }))))
      .child(this.dashed(t))
      .when(this.tab === "summary", (el) => el.child(scroll("kti-summary").p(18).child(this.markdown(t, `kti-md-${x.key}`, data.body))))
      .when(this.tab === "code", (el) => el.child(this.code(t, x)))
      .when(this.tab === "checks", (el) => el.child(this.checksView(t, d)));
  }

  right(t) {
    const x = this.sel;
    const panel = this.panel(t).flex_1().min_w(0).h_full();
    if (!x) return panel.child(this.card(t).flex_1().child(this.empty(t, this.inflight[this.listKey()] ? "Chargement…" : "Sélectionne une pull request ou une issue.")));
    const d = this.details[x.key];
    return panel.child(this.head(t, x, d)).child(this.body(t, x, d));
  }

  render(cx) {
    // Coming into view: fetch what's stale now, not at the next tick.
    const vis = shownHere();
    if (vis && !this.shown && !checking()) this.loadList(cx, false);
    this.shown = vis;
    if (vis && this.tab === "code" && this.sel?.kind === "pr" && !checking()) this.loadDiff(cx);
    const t = theme();
    return h_flex().size_full().p(8).gap(8).bg(t.background).text_color(t.foreground)
      .child(this.left(t))
      .child(this.right(t));
  }
}
