// kbrdn Threads' Flow (the "flow" child of the right panel's stack): the
// claude-flow timeline of the focused terminal (else the shown tab's agent),
// read from ~/.claude/cache/herdr/<terminal>.flow.json ({ v: 1, workflow,
// steps: [{ id, label, state, tool, source }], updatedAt }, written by
// claude-flow). On top, the context: the workflow's readable name, the project
// and branch (its issue), the PR and the CI from /me:report's facts, the
// progress bar and what's running. Below, the steps grouped in phases
// (Préparation, Spec, Implémentation, Livraison, Clôture), a phase all done
// folded to one line, each step one 28 px row with its details as pills.
// Read-only. Follows the cache folder with watchFolder (10 s fallback), only
// while shown; one loop animation: the running step's pulse.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { focused, panes, spaces, theme, layout, settings, readTextFile, watchFolder, exec, home, nextCommand, checking } from "herdr";
import * as fs from "fs/promises";
import { NAMES, workflowName, issueOf, phasesOf, details, runningLine, findPlans, passOf, decisionOf, locOf } from "./steps.js";

const ME = "flow"; // this block's id in the layout's "panel-body" stack
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
// A theme color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const CACHE = () => `${home()}/.claude/cache/herdr`;

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
function visible() {
  const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
  return Boolean(panel && !panel.hidden && body && (body.active ?? body.children?.[0]?.id) === ME);
}
// The focused terminal, else the shown tab's agent (else its first terminal). Local ones only.
function terminal() {
  const f = focused()?.terminal;
  if (f && !f.includes("/")) return f;
  const tab = spaces().find((s) => s.active)?.tabs.find((x) => x.active);
  const mine = panes().filter((p) => p.tab === tab?.id && p.terminal && !p.terminal.includes("/"));
  return (mine.find((p) => p.program?.agent) ?? mine[0])?.terminal ?? null;
}
// "owner/repo" from a github.com remote, else null.
function githubRepo(url) {
  const m = String(url ?? "").trim().match(/^(?:(?:https?|ssh|git):\/\/)?(?:[^@/\s]+@)?github\.com(?::\d+)?[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}
// After kt-threads' summarizeReport: /me:report's facts, the PR and the CI here.
function summarizeReport(d) {
  const f = d?.facts ?? {};
  const pr = f.pr?.number ? { number: f.pr.number, state: String(f.pr.state ?? "").toUpperCase(), draft: Boolean(f.pr.isDraft), url: f.pr.url ?? null } : null;
  const ci = f.ci ? { ok: f.ci.ok ?? 0, total: f.ci.total ?? 0, fail: f.ci.fail ?? 0, pending: f.ci.pending ?? 0 } : null;
  return { pr, ci, at: d?.generatedAt ?? null };
}

function ago(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`;
}

export default class Flow extends View {
  init(_props, cx) {
    this.term = null;
    this.flow = null;
    this.fold = {}; // phase id -> folded, once clicked
    this.repos = {}; // cwd -> { name, gh } | null
    this.report = null;
    this.copied = false;
    if (checking()) return;
    this.read(cx);
    // claude-flow writes into one folder: wake on its changes, read when they're ours.
    cx.spawn(async (cx) => {
      for (;;) {
        let changed;
        try { changed = await watchFolder(CACHE()); } catch { return; } // the 10 s timer carries on
        const mine = this.term && `/${this.term}.flow.json`;
        if (changed.some((p) => p === CACHE() || (mine && p.endsWith(mine)))) this.read(cx);
      }
    });
    cx.timer.every(10000, (cx) => this.read(cx));
    // Debug and capture hooks: `kt-flow.report:<folder or facts.json>` reads that report instead of
    // the branch's (`report:` alone goes back), `review` / `pass:<n>` / `finding:first` unfold.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("report:")) {
          const p = c.slice(7).trim().replace(/\/facts\.json$/, "");
          this.forced = p || null;
          this.read(cx);
        } else if (c === "review") this.reviewOpen = true;
        else if (c.startsWith("pass:")) { this.reviewOpen = true; this.openPass = Number(c.slice(5)); this.openFinding = null; }
        else if (c === "finding:first") this.openFinding = (this.report?.review?.findings ?? []).find((f) => f.pass === this.openPass)?.id ?? null;
        cx.notify();
      }
    });
  }

  // Follows the report folder: collect.py rewrites facts.json atomically, read it again then.
  watchReport(cx, folder) {
    if (folder === this.watchedReport) return;
    this.reportWatch?.cancel();
    this.reportWatch = null;
    this.watchedReport = folder;
    if (!folder) return;
    cx.spawn(async (cx) => {
      while (this.watchedReport === folder) {
        const w = watchFolder(folder);
        this.reportWatch = w;
        let changed;
        try { changed = await w; } catch { return; } // no such folder: the next panel opening looks again
        if (this.watchedReport !== folder || !changed.length) return;
        this.reportDirty = true;
        this.read(cx);
      }
    });
  }

  read(cx) {
    if (!visible() || this.reading) return;
    const term = terminal();
    const pane = term ? panes().find((p) => p.terminal === term) : null;
    const cwd = pane?.cwd ?? null;
    let branch = pane?.branch ?? null;
    this.reading = true;
    cx.spawn(async (cx) => {
      try {
        const text = term ? await readTextFile(`${CACHE()}/${term}.flow.json`).catch(() => null) : null;
        let flow = null;
        try { flow = text ? JSON.parse(text) : null; } catch { flow = term === this.term ? this.flow : null; } // a torn write keeps the last one
        // The project: its repo (git, once per folder) and its /me:report facts for this branch.
        if (cwd && !(cwd in this.repos)) {
          const [top, origin] = await Promise.all([
            exec("git", ["rev-parse", "--show-toplevel"], { cwd }).catch(() => ({ code: 1 })),
            exec("git", ["remote", "get-url", "origin"], { cwd }).catch(() => ({ code: 1 })),
          ]);
          // The project's name: its GitHub repo's (a worktree's folder isn't), else its folder's.
          const gh = origin.code ? null : githubRepo(origin.stdout);
          this.repos[cwd] = top.code ? null : { name: gh ? gh.split("/")[1] : top.stdout.trim().split("/").pop(), gh };
        }
        const repo = cwd ? this.repos[cwd] : null;
        // A shell that just started may not report its branch yet: ask git.
        if (repo && !branch) branch = (await exec("git", ["branch", "--show-current"], { cwd }).catch(() => ({ stdout: "" }))).stdout.trim() || null;
        // /me:report's folder for this branch (or the one `kt-flow.report:<path>` forces): its facts
        // are read when the panel opens, when it changes, and when collect.py rewrites them (watched).
        const reports = `${home()}/Reports`;
        const folder = this.forced ?? (repo?.gh && branch ? `${reports}/${repo.gh.replace("/", "-")}/${branch.replace(/[/#]+/g, "-")}` : null);
        let report = this.report;
        if (folder !== this.reportFolder || this.relink || this.reportDirty) {
          this.reportDirty = false;
          if (folder !== this.reportFolder) { this.openPass = null; this.openFinding = null; this.reviewOpen = undefined; }
          this.reportFolder = folder;
          report = null;
          const facts = folder ? await readTextFile(`${folder}/facts.json`).catch(() => null) : null;
          try {
            if (facts) {
              const d = JSON.parse(facts), f = d.facts ?? d;
              report = { ...summarizeReport(d.facts ? d : { facts: d, generatedAt: d.generatedAt }), review: f.review ?? null, root: f.repoPath ?? null };
            }
          } catch { report = this.report; } // a torn write keeps the last one
          this.watchReport(cx, folder);
        }
        // The branch's report page and the plans holding the flow's issue: on opening the panel and
        // when the followed terminal (its repo, branch, issue) changes, never in the loop.
        const issue = issueOf(branch) ?? details((flow?.steps ?? []).find((s) => s.id === "issue") ?? { id: "issue" })[0]?.text?.slice(1) ?? null;
        const linkKey = JSON.stringify([repo?.gh, branch, issue, folder]);
        if (linkKey !== this.linkKey || this.relink) {
          this.linkKey = linkKey;
          const page = folder ? `${folder}/index.html` : null;
          this.page = page && (await fs.exists(page).catch(() => false)) ? page : null;
          const list = async (d) => { try { return await fs.readdir(d); } catch { return []; } };
          const read = (p) => readTextFile(p).catch(() => null);
          const dirs = [...(repo?.gh ? [`${reports}/${repo.gh.replace("/", "-")}/plans`] : []), `${reports}/_plans`];
          this.plans = await findPlans(dirs, issue, list, read).catch(() => []);
        }
        this.relink = false;
        const key = JSON.stringify([term, cwd, branch, text, report, this.page, this.plans]);
        this.issue = issue;
        if (key === this.key) return;
        if (term !== this.term) this.fold = {};
        this.key = key;
        this.term = term;
        this.cwd = cwd;
        this.branch = branch;
        this.flow = flow;
        this.report = report;
        cx.notify();
      } finally { this.reading = false; }
    });
  }

  colors(t) {
    const dark = settings().dark !== false;
    return { ok: t.done, err: dark ? t.ansi9 : t.ansi1, warn: dark ? t.ansi11 : t.ansi3, accent: t.accent };
  }

  pill(t, id, text, color, onClick, icon, tip) {
    return h_flex().id(id).flex_none().max_w(220).h(18).px(7).gap(4).items_center().rounded_full().border(1)
      .border_color(alpha(color, "4d")).bg(alpha(color, "1a")).font_family(MONO).text_size(10.5).text_color(color)
      .when(Boolean(onClick), (el) => el.cursor_pointer().hover((s) => s.bg(alpha(color, "33"))).on_click(() => onClick()))
      .when(Boolean(tip), (el) => el.tooltip(tip))
      .when(Boolean(icon), (el) => el.child(svg(icon).size(11).flex_none()))
      .child(div().min_w(0).truncate().child(text));
  }

  prUrl(n) {
    const gh = this.cwd ? this.repos[this.cwd]?.gh : null;
    return this.report?.pr?.number === n && this.report.pr.url ? this.report.pr.url : gh ? `https://github.com/${gh}/pull/${n}` : null;
  }

  // ---------- context ----------

  head(t, c, steps) {
    const f = this.flow;
    const repo = this.cwd ? this.repos[this.cwd] : null;
    const issue = this.issue;
    const prStep = steps.find((s) => s.id === "pr");
    const prN = this.report?.pr?.number ?? details(prStep ?? { id: "pr" }).find((d) => d.pr)?.pr ?? null;
    const prState = this.report?.pr?.number === prN ? this.report.pr : null;
    const prColor = !prState ? t.muted : prState.state === "MERGED" ? t.ansi5 : prState.state === "CLOSED" ? c.err : prState.draft ? t.dim : t.done;
    const ci = this.report?.ci;
    const ciColor = !ci ? t.muted : ci.fail ? c.err : ci.pending ? c.warn : c.ok;
    const doneN = steps.filter((s) => s.state === "done").length;
    const running = runningLine(steps);
    const url = prN ? this.prUrl(prN) : null;
    return v_flex().flex_none().rounded(16).border(1).border_color(t.border).bg(t.background).px(14).py(12).gap(9)
      .child(h_flex().gap(8).items_center()
        .child(svg("mods/kt-panel-head/workflow.svg").size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().text_size(13.5).font_semibold().child(workflowName(f.workflow)))
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(f.updatedAt ? ago(f.updatedAt) : "")))
      .when(Boolean(repo || this.branch), (el) => el.child(h_flex().gap(6).items_center().min_w(0)
        .child(svg(I("git-branch")).size(12).flex_none().text_color(t.muted))
        .child(div().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.muted)
          .child([repo?.name, this.branch].filter(Boolean).join(" · ")))))
      .when(Boolean(issue || prN || ci?.total || this.page || this.plans?.length), (el) => el.child(h_flex().flex_wrap().gap(6).items_center()
        .when(Boolean(issue), (el) => el.child(this.pill(t, "kf-issue", `#${issue}`, t.muted)))
        .when(Boolean(prN), (el) => el.child(this.pill(t, "kf-pr", `PR #${prN}${prState ? ` · ${prState.draft ? "draft" : prState.state.toLowerCase()}` : ""}`, prColor,
          url ? () => exec("open", [url]).catch(() => {}) : null, I("git-pull-request"))))
        .when(Boolean(ci?.total), (el) => el.child(this.pill(t, "kf-ci", `CI ${ci.ok}/${ci.total}`, ciColor)))
        .when(Boolean(this.page), (el) => el.child(this.pill(t, "kf-report", "Rapport", t.ansi4,
          () => exec("open", [this.page]).catch(() => {}), I("file-text"), "Rapport /me:report de la branche")))
        .children((this.plans ?? []).map((p, i) => this.pill(t, `kf-plan-${i}`, p.title, t.ansi5,
          () => exec("open", [p.path]).catch(() => {}), I("layers"), `Plan /me:report --plan · ${p.slug}`)))))
      .child(h_flex().gap(10).items_center()
        .child(h_flex().flex_1().h(6).gap(3).children(steps.map((s) => div().flex_1().h_full().rounded_full()
          .bg(s.state === "done" ? c.ok : s.state === "current" ? c.accent : s.state === "failed" ? c.err : t.input))))
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(`${doneN}/${steps.length}`)))
      .when(Boolean(running), (el) => el.child(div().min_w(0).truncate().font_family(MONO).text_size(11).text_color(c.accent)
        .child(`EN COURS · ${running}`)));
  }

  // ---------- steps ----------

  dot(t, c, s, pulse) {
    const box = h_flex().size(14).flex_none().items_center().justify_center();
    if (s.state === "done") return box.text_color(c.ok).child(svg(I("check")).size(12));
    if (s.state === "failed") return box.text_color(t.ansi1).child(svg(I("x")).size(12));
    if (s.state === "current") return box.child(div().size(8).rounded_full().bg(c.accent).when(pulse, (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1400 })));
    return box.child(div().size(8).rounded_full().border(1).border_color(t.dim));
  }

  // Review unfolds when the report has passes: open by default while it runs.
  isReviewOpen(s) {
    return Boolean(this.report?.review?.passes?.length) && (this.reviewOpen ?? s.state === "current");
  }

  step(t, c, s, first, last, pulse) {
    const on = s.state === "current";
    const live = on || s.state === "done";
    const toneOf = (d) => (d.tone === "ok" ? c.ok : d.tone === "err" ? c.err : d.tone === "dim" ? t.dim : t.muted);
    const rail = (show) => div().w(1).flex_1().when(show, (el) => el.bg(t.border));
    const folds = s.id === "review" && Boolean(this.report?.review?.passes?.length);
    const open = folds && this.isReviewOpen(s);
    return h_flex().id(`kf-s-${s.id}`).h(28).px(6).gap(8).items_center().rounded(8)
      .when(on, (el) => el.bg(alpha(t.accent, "14")).border(1).border_color(alpha(t.accent, "66")))
      .when(!on, (el) => el.border(1).border_color(alpha(t.accent, "00")))
      .when(folds, (el) => el.cursor_pointer().when(!on, (e) => e.hover((st) => st.bg(t.hover)))
        .on_click((_e, cx) => { this.reviewOpen = !open; cx.notify(); }))
      .child(v_flex().w(14).h_full().flex_none().items_center()
        .child(rail(!first)).child(this.dot(t, c, s, pulse)).child(rail(!last && !open)))
      .child(div().flex_none().text_size(12.5).text_color(s.state === "pending" ? t.muted : t.foreground).when(on, (el) => el.font_medium())
        .child(NAMES[s.id] ?? s.id))
      .when(folds, (el) => el.child(svg(I(open ? "chevron-down" : "chevron-right")).size(12).flex_none().text_color(open ? t.accent : t.muted)))
      .child(h_flex().flex_1().min_w(0).gap(5).items_center().overflow_hidden()
        .children(details(s).map((d, i) => d.pr
          ? this.pill(t, `kf-pr-${s.id}-${i}`, d.text, s.state === "pending" ? t.muted : t.ansi4, this.prUrl(d.pr) ? () => exec("open", [this.prUrl(d.pr)]).catch(() => {}) : null)
          : d.tone
            ? this.pill(t, `kf-d-${s.id}-${i}`, d.text, toneOf(d))
            : div().min_w(0).truncate().when(Boolean(d.mono), (el) => el.font_family(MONO).text_size(11)).when(!d.mono, (el) => el.text_size(11.5))
              .text_color(t.muted).child(d.text))))
      .when(s.source === "host", (el) => el.child(div().id(`kf-h-${s.id}`).flex_none().text_color(t.dim).tooltip("détecté par gwm/git/gh")
        .child(svg("mods/kt-flow/scan-eye.svg").size(12))))
      .when(live && Boolean(s.tool), (el) => el.child(div().flex_none().font_family(MONO).text_size(10).text_color(t.dim).child(s.tool)));
  }

  // ---------- review passes ----------

  // Under an open Review step: the passes' convergence, one 28 px row a pass (the last one inked),
  // one pass unfolded at a time into its findings, one finding at a time into its detail.
  reviewBody(t, c, s) {
    if (s.id !== "review" || !this.isReviewOpen(s)) return [];
    const rv = this.report.review;
    const passes = rv.passes ?? [], findings = rv.findings ?? [];
    const sums = passes.map(passOf);
    const max = Math.max(1, ...sums.map((x) => x.blockers));
    const lastN = passes.at(-1)?.pass;
    const root = this.report.root ?? null;
    const prioColor = (pr) => (/P[012]/.test(pr) ? c.err : t.muted);
    const toneColor = (tone) => (tone === "ok" ? c.ok : tone === "warn" ? c.warn : t.dim);
    const axis = (label, ran) => h_flex().flex_none().gap(3).items_center().font_family(MONO).text_size(10)
      .text_color(ran ? t.dim : c.warn).child(label)
      .child(ran ? svg(I("check")).size(10).text_color(c.ok) : div().child("non exécuté"));
    const rows = [];
    passes.forEach((p, i) => {
      const x = sums[i], last = p.pass === lastN, open = this.openPass === p.pass;
      rows.push(h_flex().id(`kf-pass-${p.pass}`).h(28).px(6).gap(7).items_center().rounded(8).cursor_pointer()
        .when(last, (el) => el.bg(alpha(t.accent, "14")))
        .when(!last, (el) => el.hover((st) => st.bg(t.hover)))
        .on_click((_e, cx) => { this.openPass = open ? null : p.pass; this.openFinding = null; cx.notify(); })
        .child(svg(I(open ? "chevron-down" : "chevron-right")).size(11).flex_none().text_color(open ? t.accent : t.dim))
        .child(div().flex_none().text_size(12).text_color(last ? t.foreground : t.muted).when(last, (el) => el.font_medium()).child(`Passe ${p.pass}`))
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim).child(String(p.sha ?? "").slice(0, 7)))
        .child(h_flex().flex_1().min_w(0).gap(4).items_center().overflow_hidden()
          .children(["p0", "p1", "p2"].filter((k) => x[k] > 0).map((k) => this.pill(t, `kf-pc-${p.pass}-${k}`, `${k.toUpperCase()} ${x[k]}`, c.err)))
          .when(x.p3 > 0, (el) => el.child(this.pill(t, `kf-pc-${p.pass}-p3`, `P3 ${x.p3}`, t.muted)))
          .when(x.clean, (el) => el.child(this.pill(t, `kf-pc-${p.pass}-ok`, "0 bloquant", c.ok))))
        .child(axis("std", x.std)).child(axis("spec", x.spec)));
      if (!open) return;
      for (const f of findings.filter((y) => y.pass === p.pass)) {
        const d = decisionOf(f), loc = locOf(f.loc), shown = this.openFinding === f.id;
        rows.push(h_flex().id(`kf-f-${f.id}`).h(26).ml(18).px(6).gap(7).items_center().rounded(8).cursor_pointer()
          .when(shown, (el) => el.bg(t.hover)).when(!shown, (el) => el.hover((st) => st.bg(t.hover)))
          .on_click((_e, cx) => { this.openFinding = shown ? null : f.id; cx.notify(); })
          .child(this.pill(t, `kf-fp-${f.id}`, f.prio ?? "?", prioColor(f.prio ?? "")))
          .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.foreground).child(f.title ?? f.id))
          .when(Boolean(loc), (el) => el.child(div().id(`kf-fl-${f.id}`).flex_none().max_w(150).truncate().font_family(MONO).text_size(10.5).text_color(t.dim)
            .when(Boolean(root), (e) => e.cursor_pointer().hover((st) => st.text_color(t.foreground))
              .on_click((_e, cx) => { cx.stop_propagation(); exec("open", [`zed://file${root}/${loc}`]).catch(() => {}); }))
            .tooltip(f.loc).child(loc.split("/").pop())))
          .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(toneColor(d.tone)).child(d.text)));
        if (shown) {
          rows.push(v_flex().ml(18).mb(4).p(10).gap(6).rounded(8).border(1).border_color(t.border).bg(t.raised)
            .child(div().font_family(MONO).text_size(10.5).text_color(t.dim).child(`${f.axis ?? ""} · ${f.loc ?? ""}`))
            .child(div().w_full().text_size(12).line_height("17px").text_color(t.foreground).child(f.detail ?? "—")));
        }
      }
    });
    return [v_flex().ml(13).pl(10).pb(4).gap(2).border_l(1).border_color(t.border)
      .child(h_flex().h(30).px(6).gap(8).items_center()
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child("CONVERGENCE"))
        .child(h_flex().h(22).gap(3).items_end().children(sums.map((x, i) => div().w(7).h(Math.max(2, Math.round((20 * x.blockers) / max))).rounded(2)
          .bg(x.blockers ? c.err : c.ok).opacity(passes[i].pass === lastN ? 1 : 0.5))))
        .child(div().flex_1())
        .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.dim)
          .child(`${rv.reviewer ? `${rv.reviewer} · ` : ""}${passes.length} passe${passes.length > 1 ? "s" : ""} · ${findings.length} findings`)))
      .children(rows)];
  }

  phase(t, c, p, pulseId) {
    const folded = this.fold[p.id] ?? (p.done === p.total && !p.failed);
    const all = p.done === p.total;
    return v_flex().flex_none().rounded(12).border(1).border_color(t.border).bg(t.background).p(4)
      .child(h_flex().id(`kf-p-${p.id}`).h(28).px(6).gap(8).items_center().rounded(8).cursor_pointer()
        .hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.fold[p.id] = !folded; cx.notify(); })
        .child(svg(I(folded ? "chevron-right" : "chevron-down")).size(12).flex_none().text_color(t.muted))
        .when(all, (el) => el.child(svg(I("check")).size(12).flex_none().text_color(c.ok)))
        .child(div().flex_1().min_w(0).truncate().text_size(12.5).font_medium().text_color(p.current ? t.foreground : t.muted).child(p.label))
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(all ? c.ok : p.failed ? c.err : t.dim).child(`${p.done}/${p.total}`)))
      .when(!folded, (el) => el.children(p.steps.flatMap((s, i) => [this.step(t, c, s, i === 0, i === p.steps.length - 1, s.id === pulseId), ...this.reviewBody(t, c, s)])));
  }

  // ---------- empty ----------

  empty(t) {
    const why = !this.term ? "Aucun terminal local au focus." : `Pas de flow pour ${this.term}.`;
    return v_flex().size_full().gap(4).text_color(t.foreground)
      .child(v_flex().flex_1().rounded(16).border(1).border_color(t.border).bg(t.background).items_center().justify_center().gap(12).p(24)
        .child(div().size(44).rounded_full().border(1).border_dashed().border_color(t.input).flex().items_center().justify_center()
          .text_color(t.dim).child(svg("mods/kt-panel-head/workflow.svg").size(18)))
        .child(div().text_size(14).font_medium().child(why))
        .child(div().max_w(380).text_size(12.5).line_height("19px").text_color(t.muted)
          .child("Flow suit, étape par étape, le workflow que la session Claude Code de ce terminal déroule : issue, worktree, implémentation, PR, review, CI, merge. claude-flow le publie dès qu'un workflow démarre."))
        .child(h_flex().gap(8).items_center()
          .child(div().text_size(12).text_color(t.dim).child("Afficher le flow dans la session :"))
          .child(h_flex().id("kf-kbd").h(24).px(9).gap(6).items_center().rounded(6).border(1).border_color(t.input).bg(t.raised)
            .font_family(MONO).text_size(11.5).text_color(this.copied ? t.done : t.foreground).cursor_pointer().tooltip("Copier")
            .hover((s) => s.border_color(t.accent))
            .on_click((_e, cx) => {
              cx.write_to_clipboard("/me:flow");
              this.copied = true;
              cx.timer.after(1500, (cx) => { this.copied = false; cx.notify(); });
              cx.notify();
            })
            .child(this.copied ? "copié" : "/me:flow")
            .when(!this.copied, (el) => el.child(svg("mods/kt-diff/copy.svg").size(11).text_color(t.dim))))));
  }

  render(cx) {
    const vis = visible();
    if (vis && !this.shown) this.relink = true; // the panel opens: look for the report and plans again
    if (vis && !checking() && (!this.shown || terminal() !== this.term)) this.read(cx);
    this.shown = vis;
    const t = theme();
    const steps = this.flow?.steps ?? [];
    if (!steps.length) return this.empty(t);
    const c = this.colors(t);
    const pulseId = steps.find((s) => s.state === "current")?.id;
    return v_flex().size_full().gap(4).text_color(t.foreground)
      .child(this.head(t, c, steps))
      .child(v_flex().id("kf-phases").flex_1().min_h(0).overflow_y_scrollbar().gap(4)
        .children(phasesOf(steps).map((p) => this.phase(t, c, p, pulseId))));
  }
}
