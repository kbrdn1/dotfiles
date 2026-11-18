// kbrdn Threads inbox (port of herdr.dev "Threads", restyled to kbrdn.dev):
// every tab of every space as one inbox of work. Pinned on top, then active
// (newest first; activity never reshuffles), then the snoozed and settled
// shelves, folded. A row: the tile of the program it runs (its agent's first),
// its project, its status tag (needs you, done, working for
// how long) or how long since it last changed; its name; its branch and the
// icons of what runs in it. A project is a repo, worked out from git (a
// worktree's space belongs to its repo); a space outside git is its own.
// Quiet rows recede so the ones that need you stand out. Hover a row to
// snooze, pin or settle it; right-click for the tab menu. Search opens the
// picker; the filter narrows the list to one project; + folder adds a
// project (a space), the pen a new thread. A branch with a pull request shows
// its number and state (from `gh`, refreshed every few minutes); click it to
// open. Pins and snoozes are this layout's own (shared "kt.pins",
// "kt.snoozed"); a snoozed thread wakes on time or when its agent needs you.
// Settling is everyone's.
// kbrdn (Monocode): a space is a project. On top, the shown project with a
// picker of every space (by machine, worktrees under their repo) and New
// project; New thread and Inbox; the list follows the shown project unless
// "Tous les projets" (shared "kt.project" = "*"); at the bottom, a bar of
// project squares. A Claude thread's card carries herdr-agent-quota's rows
// (model, cx / 5h / 7d meters, cache, tokens), fed by ~/.claude/scripts/statusline.ts.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, run, theme, shared, setShared, openOverlay, exec, window as win, home, readTextFile, pickFolder, checking } from "herdr";
import * as fs from "fs/promises";

// kbrdn: /me:report facts (~/Reports/<owner>-<repo>/<branch>/data.js, written atomically by collect.py).
// Blockers are p0+p1+p2 of the last pass; an axis "non exécuté" is never a zero; ci null shows nothing.
function summarizeReport(d) {
  const f = d?.facts ?? {};
  const last = f.review?.passes?.at?.(-1);
  const ran = (a) => a?.state === "ok";
  const review = last ? { pass: last.pass, blockers: ran(last.standards) || ran(last.spec) ? (last.p0 ?? 0) + (last.p1 ?? 0) + (last.p2 ?? 0) : null } : null;
  const ci = f.ci ? { ok: f.ci.ok ?? 0, total: f.ci.total ?? 0, fail: f.ci.fail ?? 0, pending: f.ci.pending ?? 0 } : null;
  return { review, ci, at: d?.generatedAt ?? null };
}

const MONO = "Monaspace Krypton";
// PR state -> icon and theme color name.
const PR = {
  OPEN: { icon: "git-pull-request", color: "ansi2" },
  MERGED: { icon: "git-merge", color: "ansi5" },
  CLOSED: { icon: "git-pull-request-closed", color: "ansi1" },
};
const PR_EVERY = 180e3;
const DEFAULT_BRANCHES = ["main", "master", "trunk", "develop"];
const I = (name) => `mods/kt-threads/${name}.svg`;

// Snooze choices: label and when it wakes. Edit to taste.
const SNOOZE = [
  ["1 hour", () => Date.now() + 3600e3],
  ["Tonight", () => at(Date.now(), 19)],
  ["Tomorrow", () => at(Date.now() + 86400e3, 9)],
];
function at(ms, hour) {
  const d = new Date(ms);
  d.setHours(hour, 0, 0, 0);
  return d.getTime() > Date.now() ? d.getTime() : d.getTime() + 86400e3;
}
function until(ms) {
  const m = Math.max(1, Math.round((ms - Date.now()) / 60e3));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}

// Space colors, kept by space id in shared "space.colors": a theme
// color name ("ansi6") or a picked #rrggbb. A space seen without one gets
// the theme color fewest spaces use, once; every mod does the same in the
// same order, so they agree, and adding or renaming spaces moves nothing.
const PROJECT_COLORS = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
function spaceColors() {
  const ids = new Set(spaces().map((p) => p.id));
  const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
  let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
  for (const p of spaces()) {
    if (kept[p.id] || p.name === "~") continue;
    const uses = (c) => Object.values(kept).filter((v) => v === c).length;
    kept[p.id] = PROJECT_COLORS.reduce((best, c) => (uses(c) < uses(best) ? c : best));
    changed = true;
  }
  if (changed) setShared("space.colors", kept);
  return kept;
}
function spaceColor(t, p) {
  if (p.name === "~") return t.dim;
  const c = spaceColors()[p.id] ?? PROJECT_COLORS[0];
  return c.startsWith("#") ? c : t[c];
}

function age(ms) {
  if (!ms) return "";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

function duration(ms) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

const num = (id) => Number(String(id).replace(/\D/g, "")) || 0;

function glyph(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

// Monocode's program tile: the program's icon on its own color (Herdr's program table).
function tile(t, p) {
  const g = p?.icon ? (p.tint ? svg(p.icon).size(14).text_color(p.color ?? "#ffffff") : image(p.icon).size(14)) : svg("mods/workspace-chrome/terminal.svg").size(13).text_color(t.muted);
  return div().w(24).h(20).flex_none().rounded(6).border(1).border_color("#00000033").bg(p?.tile ?? t.raised).flex().items_center().justify_center().child(g);
}

// herdr-agent-quota's severity: green, amber from `amber` % used, red from `red` %.
const sev = (t, used, amber, red) => (used >= red ? t.ansi1 : used >= amber ? t.ansi3 : t.done);
// A quota window's reset, from its unix seconds: "4d23h", "3h07m", "12m".
function resetIn(sec) {
  const m = Math.max(0, Math.round((sec * 1000 - Date.now()) / 60e3));
  return m >= 1440 ? `${Math.floor(m / 1440)}d${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}
const toks = (n) => (n < 1000 ? String(n) : n < 1e6 ? `${Math.floor(n / 1000)}k` : `${(n / 1e6).toFixed(1)}M`);
// The prompt cache's time left, from the last API call and the TTL it was written with.
function cacheLeft(s) {
  if (!s?.cache_at || !s.cache_ttl) return "";
  const m = Math.ceil((s.cache_at + s.cache_ttl * 1000 - Date.now()) / 60e3);
  return m <= 0 ? "no cached" : m >= 60 ? "ttl≈1h" : `ttl≈${m}m`;
}
// A live 5h / 7d window (statusline's rate_limits, top level), or null once it has reset.
function windowOf(q, name) {
  const w = q?.[name] ?? q?.rate_limits?.[name];
  return w && w.resets_at * 1000 > Date.now() ? w : null;
}
const STATUSLINE = () => `${home()}/.claude/cache/statusline`;

export default class Threads extends View {
  init(_props, cx) {
    this.hover = null;
    this.showSettled = false;
    this.showSnoozed = false;
    this.snoozing = null; // the row showing its snooze choices
    this.projectsOpen = false; // the project picker under the shown project
    // Agent rows folded or unfolded by hand, by tab id (else: unfolded on the shown thread only).
    try { this.gauges = JSON.parse(localStorage.getItem("kt.gauges") ?? "{}") ?? {}; } catch { this.gauges = {}; }
    this.quota = null; // ~/.claude/cache/statusline/herdr-quota.json
    this.repos = {}; // folder -> { key, name } | null

    this.prs = {}; // "folder|branch" -> { number, state, url } | null
    this.asked = {}; // "folder|branch" -> when
    this.queue = [];
    // Durations: checked every second, but the list redraws only when a time
    // it shows really changes ("WORKING 12s" -> "13s", "3m" -> "4m"), else
    // every 30 s (snoozes coming due). Each redraw repaints the whole window.
    this.ticks = 0;
    this.shownClocks = "";
    cx.timer.every(1000, (cx) => {
      this.ticks++;
      if (this.ticks >= 30 || this.clocks() !== this.shownClocks) cx.notify();
    });
    cx.timer.every(1500, (cx) => this.lookup(cx));
    // kbrdn: each agent's live line (herdr-bridge Claude mod) every 3 s, /me:report facts every 15 s.
    // Both redraw only when what they read changed.
    this.live = {};
    this.reports = {};
    if (!checking()) {
      cx.timer.every(3000, (cx) => this.readLive(cx));
      cx.timer.every(15000, (cx) => this.readReports(cx));
    }
  }

  readLive(cx) {
    if (this.readingLive) return;
    this.readingLive = true;
    cx.spawn(async (cx) => {
      const next = {};
      let claude = false;
      for (const p of panes()) {
        if (!p.terminal || p.terminal.includes("/") || !p.program?.agent) continue;
        try {
          const s = await readTextFile(`${home()}/.claude/cache/herdr/${p.terminal}.json`);
          if (s) next[p.terminal] = JSON.parse(s);
        } catch {
          if (this.live[p.terminal]) next[p.terminal] = this.live[p.terminal]; // a torn read keeps the last one
        }
        // Claude's statusline facts (model, context, cache, tokens), for the card's agent rows.
        if (p.app === "claude-code" || p.program?.key === "claude") {
          claude = true;
          try {
            const sl = JSON.parse(await readTextFile(`${STATUSLINE()}/herdr-${p.terminal}.json`));
            if (sl) { delete sl.updated_at; next[p.terminal] = { ...(next[p.terminal] ?? {}), sl }; }
          } catch {
            if (this.live[p.terminal]?.sl) next[p.terminal] = { ...(next[p.terminal] ?? {}), sl: this.live[p.terminal].sl };
          }
        }
        // claude-flow's timeline (issue, worktree, commits, PR, review, CI, merge), when it publishes one.
        try {
          const f = await readTextFile(`${home()}/.claude/cache/herdr/${p.terminal}.flow.json`);
          if (f) next[p.terminal] = { ...(next[p.terminal] ?? {}), flow: JSON.parse(f) };
        } catch {
          if (this.live[p.terminal]?.flow) next[p.terminal] = { ...(next[p.terminal] ?? {}), flow: this.live[p.terminal].flow };
        }
      }
      // The account's 5h / 7d quota: one file, read once a tick when a Claude thread shows it.
      let quota = null;
      if (claude) {
        try { quota = JSON.parse(await readTextFile(`${STATUSLINE()}/herdr-quota.json`)); if (quota) delete quota.updated_at; } catch { quota = this.quota; }
      }
      this.readingLive = false;
      const key = JSON.stringify([next, quota]);
      if (key !== this.liveKey) { this.liveKey = key; this.live = next; this.quota = quota; cx.notify(); }
    });
  }

  readReports(cx) {
    if (this.readingReports) return;
    this.readingReports = true;
    cx.spawn(async (cx) => {
      const next = {};
      let owners = [];
      try { owners = await fs.readdir(`${home()}/Reports`); } catch { }
      for (const p of panes()) {
        if (!p.terminal || p.terminal.includes("/") || !p.branch || !p.cwd) continue;
        const repo = this.repos[JSON.stringify([null, p.cwd])]?.name;
        const dir = repo && owners.find((o) => o.endsWith(`-${repo}`));
        const key = `${repo}|${p.branch}`;
        if (!dir || key in next) continue;
        // facts.json (the stable contract) first, data.js (the page's own copy) until collect.py writes it.
        const folder = `${home()}/Reports/${dir}/${p.branch.replace(/[/#]+/g, "-")}`;
        try {
          const facts = await readTextFile(`${folder}/facts.json`).catch(() => null);
          if (facts) {
            const d = JSON.parse(facts);
            next[key] = summarizeReport(d.facts ? d : { facts: d, generatedAt: d.generatedAt });
            continue;
          }
          const s = await readTextFile(`${folder}/data.js`);
          if (s) next[key] = summarizeReport(JSON.parse(s.replace(/^\s*window\.__report\s*=\s*/, "").replace(/;\s*$/, "")));
        } catch { }
      }
      this.readingReports = false;
      const k = JSON.stringify(next);
      if (k !== this.reportsKey) { this.reportsKey = k; this.reports = next; cx.notify(); }
    });
  }

  // Review and CI pills from the thread's /me:report, when one exists for its branch.
  reportPills(t, lead, w) {
    const repo = lead?.cwd && this.repos[JSON.stringify([w.machine ?? null, lead.cwd])]?.name;
    const r = repo && lead?.branch ? this.reports[`${repo}|${lead.branch}`] : null;
    if (!r) return [];
    const pills = [];
    if (r.review) {
      const b = r.review.blockers;
      pills.push(this.tag(b === null ? t.dim : b > 0 ? t.blocked : t.done, `R${r.review.pass} · ${b === null ? "non exécuté" : b === 0 ? "0 bloquant" : `${b} bloquant${b > 1 ? "s" : ""}`}`));
    }
    if (r.ci && r.ci.total > 0) {
      const ci = r.ci;
      pills.push(ci.fail > 0 ? this.tag(t.ansi1, `CI ✗ ${ci.fail}/${ci.total}`) : ci.pending > 0 ? this.tag(t.ansi3, `CI … ${ci.ok}/${ci.total}`) : this.tag(t.done, `CI ✓ ${ci.ok}/${ci.total}`));
    }
    return pills;
  }

  // claude-flow's timeline as a strip: one dot per step (done, current pulsing, pending, failed),
  // then the current step's label.
  flowStrip(t, lead) {
    const steps = (lead?.terminal && this.live[lead.terminal]?.flow?.steps) || [];
    if (!steps.length) return null;
    const color = { done: t.done, current: t.accent, failed: t.ansi1, pending: t.border };
    const now = steps.find((s) => s.state === "current") ?? steps.filter((s) => s.state === "done").at(-1);
    return h_flex().h(16).gap(4).items_center()
      .children(steps.map((s, i) => div().id(`kt-flow-${lead.terminal}-${i}`).size(6).rounded(3).flex_none().bg(color[s.state] ?? t.border)
        .when(s.state === "current", (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1400 }))))
      .when(Boolean(now?.label), (el) => el.child(div().min_w(0).truncate().pl(4).font_family(MONO).text_size(10.5).text_color(t.muted).child(now.label)));
  }

  // Monocode's live line: what the thread's agent is doing now, or what it needs.
  liveLine(t, c, lead) {
    const l = lead?.terminal ? this.live[lead.terminal] : null;
    if (c.status === "blocked") {
      return h_flex().h(22).px(10).gap(6).items_center().rounded_full().bg(t.blocked + "26").border(1).border_color(t.blocked + "4d")
        .child(div().size(6).rounded(3).bg(t.blocked).loop("opacity", { from: 0.3, to: 1, period: 1200 }))
        .child(div().truncate().text_size(12).font_medium().text_color(t.blocked).child("a besoin de toi"));
    }
    const todo = l?.todos?.total ? ` · ${l.todos.done}/${l.todos.total}` : "";
    const text = c.status === "working" ? l?.action?.what && `${l.action.what}${todo}` : c.status === "done" ? l?.answer : null;
    return text ? div().truncate().text_size(12).text_color(t.muted).child(text) : null;
  }

  // Unfolded: the shown thread, unless folded by hand (and the other way round).
  unfolded(id, here) {
    return this.gauges[id] ?? here;
  }

  fold(id, here) {
    const ids = new Set(spaces().flatMap((w) => w.tabs.map((c) => c.id)));
    this.gauges = Object.fromEntries(Object.entries(this.gauges).filter(([k]) => ids.has(k)));
    this.gauges[id] = !this.unfolded(id, here);
    try { localStorage.setItem("kt.gauges", JSON.stringify(this.gauges)); } catch { }
  }

  // The report's `.ticks` meter: 2 px notches every 6 px (9 in 50 px), as many filled as the
  // printed percent says, never empty or full between 1 and 99 (herdr-agent-quota's `meter`).
  notches(t, pct, color, w = 50) {
    const n = Math.floor((w + 4) / 6);
    const p = Math.round(pct);
    const on = p > 0 && p < 100 ? Math.min(n - 1, Math.max(1, Math.round((p * n) / 100))) : p >= 100 ? n : 0;
    return h_flex().w(w).h(8).gap(4).flex_none().children(Array.from({ length: n }, (_, i) => div().w(2).h(8).bg(i < on ? color : t.raised)));
  }

  // One of the report's `.kpi`: mono eyebrow (and the reset, dim), the value in Inter, its meter.
  kpi(t, label, pct, color, tail, first) {
    return v_flex()
      .flex_1()
      .min_w(0)
      .gap(3)
      .when(!first, (el) => el.pl(8).border_l(1).border_dashed().border_color(t.border))
      .child(
        h_flex().gap(4).items_center().font_family(MONO).text_size(10.5)
          .child(div().flex_none().text_color(t.muted).child(label))
          .child(div().flex_1())
          .when(Boolean(tail), (el) => el.child(div().min_w(0).truncate().text_color(t.dim).child(tail))),
      )
      .child(div().text_size(14).text_color(pct == null ? t.dim : t.foreground).child(pct == null ? "N/A" : `${Math.round(pct)}%`))
      .child(pct == null ? div().h(8) : this.notches(t, pct, color));
  }

  // herdr-agent-quota's rows for a Claude thread: model and effort (the fold toggle),
  // cx / 5h / 7d, cache hit and TTL with the last turn's tokens, the session's cost,
  // time and lines. Folded: the model line and cx alone.
  agentRows(t, c, mine, here) {
    const p = mine.find((x) => this.live[x.terminal]?.sl && (x.app === "claude-code" || x.program?.key === "claude"));
    const s = p && this.live[p.terminal].sl;
    if (!s) return null;
    const open = this.unfolded(c.id, here);
    const used = s.ctx_pct;
    const cxColor = used == null ? t.dim : (s.window ?? 0) >= 1e6 ? sev(t, used, 20, 50) : sev(t, used, 55, 75);
    const head = h_flex()
      .id(`kt-agent-${c.id}`)
      .h(18)
      .gap(6)
      .items_center()
      .font_family(MONO)
      .text_size(10.5)
      .text_color(t.muted)
      .cursor_pointer()
      .hover((st) => st.text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        this.fold(c.id, here);
        cx.notify();
      })
      .child(svg(I(open ? "chevron-down" : "chevron-right")).size(12).flex_none())
      .child(div().min_w(0).truncate().text_color(t.foreground).child(s.model || "Claude"))
      .when(Boolean(s.effort), (el) => el.child(div().flex_none().text_color(t.dim).child(`· ${s.effort}`)))
      .child(div().flex_1())
      .when(!open && used != null, (el) => el.child(div().flex_none().text_color(cxColor).child(`cx ${Math.round(used)}%`)));
    if (!open) return head;
    const five = windowOf(this.quota, "five_hour");
    const week = windowOf(this.quota, "seven_day");
    const mono = (color, text) => div().flex_none().font_family(MONO).text_size(10.5).text_color(color).child(text);
    const left = cacheLeft(s);
    const fresh = s.input_tokens == null ? null : (s.input_tokens ?? 0) + (s.cache_creation_input_tokens ?? 0);
    const dur = s.duration_ms ? duration(Date.now() - s.duration_ms) : "";
    const facts = [s.cost_usd != null && `$${s.cost_usd.toFixed(2)}`, dur, (s.lines_added != null || s.lines_removed != null) && `+${s.lines_added ?? 0} −${s.lines_removed ?? 0}`].filter(Boolean);
    return v_flex()
      .gap(5)
      .child(head)
      .child(
        h_flex()
          .gap(8)
          .child(this.kpi(t, "CX", used, cxColor, null, true))
          .child(this.kpi(t, "5H", five?.used_percentage, five && sev(t, five.used_percentage, 50, 80), five && resetIn(five.resets_at)))
          .child(this.kpi(t, "7D", week?.used_percentage, week && sev(t, week.used_percentage, 50, 80), week && resetIn(week.resets_at))),
      )
      .child(
        v_flex()
          .pt(5)
          .gap(2)
          .border_t(1)
          .border_dashed()
          .border_color(t.border)
          .child(
            h_flex().h(16).gap(6).items_center()
              .when(s.hit_pct != null, (el) => el.child(mono(t.muted, `cache ${s.hit_pct.toFixed(1)}%`)))
              .when(Boolean(left), (el) => el.child(mono(left === "no cached" ? t.ansi3 : t.dim, left)))
              .child(div().flex_1())
              .when(fresh != null, (el) => el.child(mono(t.muted, `↑${toks(fresh)} ↓${toks(s.output_tokens ?? 0)}`))),
          )
          .when(facts.length > 0, (el) => el.child(h_flex().h(16).items_center().child(mono(t.dim, facts.join(" · "))))),
      );
  }

  // The folder's repo of a space (where it was made), or null outside git.
  spaceRepo(s) {
    return this.repos[JSON.stringify([s.machine ?? null, s.folder])] ?? null;
  }

  // A project's key: its repo (worktree spaces share it), else the space itself.
  spaceKey(s) {
    return this.spaceRepo(s)?.key ?? s.id;
  }

  // A worktree space goes under its repo's checkout when that one is a space too.
  nested(s, ps) {
    const r = this.spaceRepo(s);
    return Boolean(r?.linked) && ps.some((o) => o !== s && !this.spaceRepo(o)?.linked && this.spaceKey(o) === r.key);
  }

  // Each checkout space, then its worktree spaces.
  projectTree(ps) {
    return ps.filter((s) => !this.nested(s, ps)).map((s) => ({ s, kids: ps.filter((k) => this.nested(k, ps) && this.spaceKey(k) === this.spaceKey(s)) }));
  }

  // Working / blocked / done dots for the threads of a space (blocked pulses).
  statusDots(t, id, tabs) {
    return ["working", "blocked", "done"].filter((st) => tabs.some((c) => c.status === st)).map((st) =>
      div().id(`kt-dot-${id}-${st}`).size(6).rounded(3).flex_none().bg(t[st])
        .when(st === "blocked", (el) => el.loop("opacity", { from: 0.3, to: 1, period: 1200 })));
  }

  // The picker's line for a space: color, name, branch, its status dots, how many threads.
  projectLine(t, s, kid) {
    return h_flex()
      .id(`kt-proj-${s.id}`)
      .h(32)
      .px(8)
      .gap(8)
      .items_center()
      .rounded(12)
      .cursor_pointer()
      .when(s.active, (el) => el.bg(t.accent + "24"))
      .when(!s.active, (el) => el.hover((st) => st.bg(t.hover)))
      .on_click((_e, cx) => {
        this.projectsOpen = false;
        run("space.select", { id: s.id });
        cx.notify();
      })
      .when(kid, (el) => el.pl(16).child(svg(I("git-branch")).size(12).flex_none().text_color(t.dim)))
      .when(!kid, (el) => el.child(div().size(8).rounded(2).flex_none().bg(spaceColor(t, s))))
      .child(div().flex_none().max_w(120).truncate().text_size(13).text_color(s.active ? t.foreground : t.muted).child(s.name))
      .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(s.branch ?? ""))
      .children(this.statusDots(t, s.id, s.tabs))
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child(String(s.tabs.length)));
  }

  // Every space, grouped by machine (a header only once there are several), worktrees under their repo.
  projectPicker(t, ps) {
    const names = [...new Set(ps.map((s) => s.machine).filter(Boolean))].sort();
    const groups = [...(ps.some((s) => !s.machine) ? [null] : []), ...names];
    // ponytail: no scroll of its own; with dozens of spaces it squeezes the thread list (which scrolls).
    return v_flex()
      .flex_none()
      .mx(8)
      .mt(2)
      .mb(4)
      .p(4)
      .gap(1)
      .rounded(16)
      .border(1)
      .border_color(t.border)
      .bg(t.surface)
      .children(
        groups.flatMap((m) => {
          const mine = ps.filter((s) => (s.machine ?? null) === m);
          const head = groups.length > 1 ? [div().px(8).pt(6).pb(2).font_family(MONO).text_size(10.5).text_color(t.dim).child((m ?? "Cet ordinateur").toUpperCase())] : [];
          return [...head, ...this.projectTree(mine).flatMap(({ s, kids }) => [this.projectLine(t, s, false), ...kids.map((k) => this.projectLine(t, k, true))])];
        }),
      )
      .child(
        h_flex()
          .id("kt-proj-new")
          .h(32)
          .px(8)
          .gap(8)
          .items_center()
          .rounded(12)
          .text_size(13)
          .text_color(t.muted)
          .cursor_pointer()
          .hover((st) => st.bg(t.hover).text_color(t.foreground))
          // `space.new` alone opens in the focused terminal's folder (no prompt): ask for the folder,
          // a local one (the picker is this computer's), so the space goes on this computer.
          .on_click((_e, cx) => {
            this.projectsOpen = false;
            cx.notify();
            cx.spawn(async () => {
              const folder = await pickFolder({ prompt: "Ouvrir" });
              if (folder) run("space.new", { folder, machine: "" });
            });
          })
          .child(svg(I("plus")).size(14).flex_none())
          .child("Nouveau projet"),
      );
  }

  // Monocode's project bar: a colored square per project, the shown one ringed in accent,
  // a pulsing dot where an agent waits for you.
  projectBar(t, ps) {
    return h_flex()
      .px(12)
      .py(8)
      .gap(6)
      .flex_wrap()
      .border_t(1)
      .border_color(t.border)
      .children(
        this.projectTree(ps).map(({ s, kids }) => {
          const group = [s, ...kids];
          const on = group.some((x) => x.active);
          const blocked = group.some((x) => x.status === "blocked");
          return div()
            .id(`kt-bar-${s.id}`)
            .relative()
            .size(30)
            .p(2)
            .flex_none()
            .rounded(8)
            .border(1)
            .border_color(on ? t.accent : t.accent + "00")
            .when(!on, (el) => el.hover((st) => st.border_color(t.border)))
            .cursor_pointer()
            .tooltip(s.name)
            .on_click(() => run("space.select", { id: s.id }))
            .child(
              div().size_full().rounded(6).bg(spaceColor(t, s)).flex().items_center().justify_center()
                .text_size(11).font_semibold().text_color(t.chrome).child([...s.name][0]?.toUpperCase() ?? "?"),
            )
            .when(blocked, (el) =>
              el.child(div().id(`kt-bar-wait-${s.id}`).absolute().top(-3).right(-3).size(9).rounded(5).border(2).border_color(t.chrome).bg(t.blocked)
                .loop("opacity", { from: 0.3, to: 1, period: 1200 })));
        }),
      );
  }

  // Every time text the rows show, in one string: what the tick compares.
  clocks() {
    const snoozed = this.snoozed();
    return spaces()
      .flatMap((w) =>
        w.tabs.map((c) =>
          this.asleep(c)
            ? until(snoozed[c.id].until)
            : c.status === "working"
              ? c.working_since ? duration(c.working_since) : ""
              : c.status === "blocked" || c.status === "done"
                ? c.status
                : age(c.settled ? c.settled_at : c.changed_at),
        ),
      )
      .concat(Object.values(this.live).map((l) => cacheLeft(l.sl)), ["five_hour", "seven_day"].map((n) => windowOf(this.quota, n)?.resets_at ?? 0).map((s) => (s ? resetIn(s) : "")))
      .join("|");
  }

  // New folders only: a folder's repo doesn't change. Asked on render too,
  // so a new space shows its project at once.
  findRepos(cx) {
    const here = [...spaces().map((s) => [s.machine ?? null, s.folder]), ...panes().filter((p) => p.terminal).map((p) => [p.terminal.includes("/") ? p.terminal.split("/")[0] : null, p.cwd])].filter(([, cwd]) => cwd).map((at) => JSON.stringify(at));
    const folders = [...new Set(here.filter((f) => f && !(f in this.repos)))];
    if (!folders.length || this.finding) return;
    this.finding = true;
    cx.spawn(async (cx) => {
      for (const location of folders) {
        const [on, f] = JSON.parse(location);
        try {
          const r = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: f, on });
          const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: f, on });
          const key = r.code === 0 ? r.stdout.trim() : null;
          this.repos[location] = key && {
            key: JSON.stringify([on, key]),
            name: (key.endsWith("/.git") ? key.slice(0, -5) : key).split("/").pop(),
            linked: key !== `${top.stdout.trim()}/.git`,
          };
        } catch { this.repos[location] = null; }
      }
      this.finding = false;
      cx.notify();
    });
  }

  // A thread's project: the repo where its terminal is now (you cd'd there),
  // else its space's, else the space itself. Colored as the first space of that repo.
  project(w, c, all) {
    const mine = all.filter((p) => p.tab === c.id && p.terminal);
    const where = (mine.find((p) => p.focused) ?? mine.find((p) => p.program?.agent) ?? mine[0])?.cwd;
    const r = (where && this.repos[JSON.stringify([w.machine ?? null, where])]) || this.repos[JSON.stringify([w.machine ?? null, w.folder])];
    if (!r) return { key: w.id, name: w.name, first: w, machine: w.machine };
    const first = spaces().find((s) => this.repos[JSON.stringify([s.machine ?? null, s.folder])]?.key === r.key) ?? w;
    return { key: r.key, name: r.name, first, machine: w.machine };
  }

  // Settling a worktree's last open thread offers to remove the worktree
  // (the `worktree` dialog; Esc keeps it).
  settle(w, c) {
    run("tab.settle", { id: c.id });
    const last = w.tabs.every((x) => x.id === c.id || x.settled);
    if (last && this.repos[JSON.stringify([w.machine ?? null, w.folder])]?.linked)
      openOverlay({ mod: "worktree", kind: "dialog", width: 440, height: 190, props: { space: w.id, action: "remove" } });
  }

  snoozed() {
    return shared("kt.snoozed") ?? {};
  }

  // Snoozed now: not yet due, and its agent hasn't asked for you since.
  asleep(c) {
    const s = this.snoozed()[c.id];
    if (!s || c.settled) return false;
    if (Date.now() >= s.until) return false;
    return !((c.status === "blocked" || c.status === "done") && (c.changed_at ?? 0) > s.at);
  }

  snooze(id, wake) {
    const all = { ...this.snoozed() };
    if (wake) all[id] = { until: wake, at: Date.now() };
    else delete all[id];
    setShared("kt.snoozed", all);
  }

  // The pull request of a branch, asked of `gh` at most every few minutes.
  pr(cwd, branch, on) {
    if (!cwd || !branch || DEFAULT_BRANCHES.includes(branch)) return null;
    const key = JSON.stringify([on ?? null, cwd, branch]);
    if (!(Date.now() - (this.asked[key] ?? 0) < PR_EVERY) && !this.queue.includes(key)) this.queue.push(key);
    return this.prs[key] ?? null;
  }

  lookup(cx) {
    if (this.looking || !this.queue.length) return;
    this.looking = true;
    const keys = this.queue.splice(0);
    cx.spawn(async (cx) => {
      for (const key of keys) {
        const [on, cwd, branch] = JSON.parse(key);
        this.asked[key] = Date.now();
        const r = await exec("gh", ["pr", "list", "--head", branch, "--state", "all", "--limit", "1", "--json", "number,state,url"], { cwd, on }).catch(() => ({ code: 1 }));
        let found = null;
        try {
          found = r.code === 0 ? (JSON.parse(r.stdout)[0] ?? null) : null;
        } catch {}
        this.prs[key] = found;
      }
      this.looking = false;
      cx.notify();
    });
  }

  badge(t, c, pr) {
    const look = PR[pr.state] ?? PR.OPEN;
    return h_flex()
      .id(`kt-pr-${c.id}`)
      .flex_none()
      .gap(3)
      .items_center()
      .font_family(MONO)
      .text_size(11)
      .text_color(t[look.color])
      .cursor_pointer()
      .hover((s) => s.opacity(0.8))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        const p = win()?.platform;
        if (p === "windows") exec("explorer.exe", [pr.url]).catch(() => {});
        else exec(p === "macos" ? "open" : "xdg-open", [pr.url]).catch(() => {});
      })
      .child(svg(I(look.icon)).size(12))
      .child(`#${pr.number}`);
  }

  pins() {
    return shared("kt.pins") ?? [];
  }

  togglePin(id) {
    const pins = this.pins();
    setShared("kt.pins", pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id]);
  }

  // kbrdn.dev `.tag`: mono uppercase pill, border 30% / fill 10% of its own color.
  tag(color, text, lead) {
    return h_flex()
      .flex_none()
      .h(20)
      .px(8)
      .gap(5)
      .items_center()
      .rounded_full()
      .border(1)
      .border_color(color + "4d")
      .bg(color + "1a")
      .text_color(color)
      .font_family(MONO)
      .text_size(10.5)
      .when(Boolean(lead), (el) => el.child(lead))
      .child(text);
  }

  status(t, c) {
    if (c.status === "blocked")
      return this.tag(t.blocked, "NEEDS YOU", div().size(6).rounded(3).bg(t.blocked).loop("opacity", { from: 0.3, to: 1, period: 1200 }));
    if (c.status === "done") return this.tag(t.done, "DONE");
    if (c.status === "working") return this.tag(t.working, `WORKING${c.working_since ? ` ${duration(c.working_since).toUpperCase()}` : ""}`);
    return null;
  }

  button(id, label, icon, onClick) {
    const t = this.t;
    return h_flex()
      .id(id)
      .gap(4)
      .px(6)
      .py(1)
      .rounded_full()
      .items_center()
      .text_size(12)
      .text_color(t.muted)
      .cursor_pointer()
      .hover((s) => s.text_color(t.foreground).bg(t.hover))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        onClick();
        cx.notify();
      })
      .when(Boolean(icon), (el) => el.child(svg(I(icon)).size(13)))
      .when(Boolean(label), (el) => el.child(label));
  }

  row(t, r, all) {
    const { w, c } = r;
    const mine = all.filter((p) => p.tab === c.id && p.terminal);
    const lead = mine.find((p) => p.focused) ?? mine.find((p) => p.program?.agent) ?? mine[0];
    const programs = [...new Map(mine.map((p) => [p.program?.key, p.program])).values()].filter((p) => p && !p.shell);
    const st = this.status(t, c);
    const pr = this.pr(lead?.cwd, lead?.branch, w.machine);
    const here = w.active && c.active;
    const hovered = this.hover === c.id;
    const pinned = this.pins().includes(c.id);
    const asleep = this.asleep(c);
    const pj = this.project(w, c, all);
    // Quiet rows recede: what needs you (or what you're on) stays bright.
    const recede = !here && !hovered && c.status !== "blocked" && c.status !== "done";
    const mono = (color, text) => div().flex_none().font_family(MONO).text_size(11).text_color(color).child(text);
    const right = hovered
      ? c.settled
        ? this.button(`kt-un-${c.id}`, "Unsettle", "check", () => run("tab.unsettle", { id: c.id }))
        : asleep
          ? this.button(`kt-wake-${c.id}`, "Wake", "clock", () => this.snooze(c.id, null))
          : h_flex()
              .gap(2)
              .child(
                this.button(`kt-snooze-${c.id}`, "", "clock", () => {
                  this.snoozing = this.snoozing === c.id ? null : c.id;
                }),
              )
              .child(this.button(`kt-pin-${c.id}`, pinned ? "Unpin" : "", "pin", () => this.togglePin(c.id)))
              .child(this.button(`kt-settle-${c.id}`, "Settle", "check", () => this.settle(w, c)))
      : asleep
        ? mono(t.working, until(this.snoozed()[c.id].until).toUpperCase())
        : (st ?? mono(t.dim, age(c.settled ? c.settled_at : c.changed_at).toUpperCase()));
    const short = c.settled || asleep;
    // Monocode's program tile: the agent's program (else what runs in it); a mod-only
    // thread (the Inbox) shows the layers glyph. The status stays on the tags.
    const modOnly = !mine.length && all.some((p) => p.tab === c.id && p.mod);
    const avatar = modOnly
      ? tile(t, { icon: I("layers"), tint: true, color: t.muted })
      : tile(t, (mine.find((p) => p.program?.agent) ?? lead)?.program);
    const agentRows = short ? null : this.agentRows(t, c, mine, here);
    const body = v_flex()
      .flex_1()
      .min_w(0)
      .gap(short ? 0 : 3)
      .child(
        h_flex()
          .h(20)
          .gap(7)
          .items_center()
          .child(div().w(8).h(8).rounded(2).flex_none().bg(spaceColor(t, pj.first)))
          // kbrdn.dev `.eyebrow`: the project.
          .child(div().min_w(0).truncate().font_family(MONO).text_size(11).text_color(t.muted).child(pj.name.toUpperCase()))
          .when(Boolean(pj.machine), (el) => el.child(div().flex_none().px(6).rounded_full().bg(t.raised).text_size(11).text_color(t.dim).child(pj.machine)))
          .child(div().flex_1())
          .when(pinned && !hovered, (el) => el.child(svg(I("pin")).size(12).flex_none().text_color(t.dim)))
          .child(right),
      )
      .when(!short, (el) =>
        el
          .child(div().truncate().text_size(14).font_medium().text_color(t.foreground).child(c.name))
          .when(Boolean(this.liveLine(t, c, lead)), (el) => el.child(this.liveLine(t, c, lead)))
          .when(Boolean(agentRows), (el) => el.child(agentRows))
          .when(Boolean(this.flowStrip(t, lead)), (el) => el.child(this.flowStrip(t, lead)))
          .when(this.reportPills(t, lead, w).length > 0, (el) => el.child(h_flex().gap(4).flex_wrap().children(this.reportPills(t, lead, w))))
          .child(
            h_flex()
              .h(18)
              .gap(6)
              .items_center()
              .text_color(t.dim)
              .when(Boolean(lead?.branch), (el) =>
                el.child(svg(I("git-branch")).size(12).flex_none()).child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11).child(lead.branch)),
              )
              .when(!lead?.branch, (el) => el.child(div().flex_1()))
              .when(Boolean(pr), (el) => el.child(this.badge(t, c, pr)))
              .children(programs.filter((p) => p.icon).slice(0, 3).map((p) => glyph(p, 14, t.muted))),
          ),
      )
      .when(short, (el) => el.child(div().truncate().text_size(13).text_color(t.muted).child(c.name)))
      .when(this.snoozing === c.id, (el) =>
        el.child(
          h_flex()
            .gap(4)
            .pt(4)
            .children(
              SNOOZE.map(([label, wake], i) =>
                this.button(`kt-sn-${c.id}-${i}`, label, null, () => {
                  this.snoozing = null;
                  this.snooze(c.id, wake());
                }),
              ),
            ),
        ),
      );
    return h_flex()
      .id(`kt-row-${c.id}`)
      .mx(8)
      .px(10)
      .py(short ? 6 : 8)
      .gap(10)
      .items_start()
      .rounded(12)
      // kbrdn.dev SegmentInk on the shown thread (transparent border elsewhere: no shift).
      .border(1)
      .border_color(here ? t.accent + "66" : t.accent + "00")
      .when(here, (el) => el.bg(t.accent + "24"))
      .when(!here, (el) => el.hover((s) => s.bg(t.hover)))
      .cursor_pointer()
      .when(recede, (el) => el.opacity(0.62))
      .on_hover((h, cx) => {
        if (h) this.hover = c.id;
        else if (this.hover === c.id) this.hover = null;
        if (!h && this.snoozing === c.id) this.snoozing = null;
        cx.notify();
      })
      .on_click(() => run("tab.select", { id: c.id }))
      .on_mouse_down("right", () =>
        openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: w.id, settled: c.settled } } }),
      )
      .child(avatar)
      .child(body);
  }

  // kbrdn.dev `.eyebrow` shelf header.
  section(id, label, open, onClick) {
    const t = this.t;
    return h_flex()
      .id(id)
      .mx(18)
      .mt(10)
      .mb(4)
      .gap(8)
      .items_center()
      .font_family(MONO)
      .text_size(11)
      .text_color(t.muted)
      .cursor_pointer()
      .hover((s) => s.text_color(t.foreground))
      .on_click(onClick)
      .child(label.toUpperCase())
      .child(div().flex_1().h(1).bg(t.border))
      .child(svg(I(open ? "chevron-down" : "chevron-right")).size(13));
  }

  render(cx) {
    this.findRepos(cx);
    const t = (this.t = theme());
    this.ticks = 0;
    this.shownClocks = this.clocks();
    const all = panes();
    const ps = spaces();
    // The project filter (shared "kt.project"): "*" lists every project; anything else
    // follows the shown space, with its repo's worktree spaces.
    const everyProject = shared("kt.project") === "*";
    const shown = ps.find((w) => w.active);
    const scope = shown && !everyProject ? this.spaceKey(shown) : null;
    const every = ps.flatMap((w) => w.tabs.map((c) => ({ w, c, pj: this.project(w, c, all) })));
    const rows = every.filter((r) => !scope || r.w.id === shown.id || this.spaceKey(r.w) === scope);
    const inbox = all.find((x) => x.mod === "kt-inbox");
    const inboxShown = Boolean(inbox) && shown?.tabs.some((c) => c.active && c.id === inbox.tab);
    const pins = this.pins();
    const awake = (r) => !r.c.settled && !this.asleep(r.c);
    const pinned = pins.map((id) => rows.find((r) => r.c.id === id && awake(r))).filter(Boolean);
    const active = rows.filter((r) => awake(r) && !pins.includes(r.c.id)).sort((a, b) => num(b.c.id) - num(a.c.id));
    const snoozed = rows.filter((r) => this.asleep(r.c)).sort((a, b) => this.snoozed()[a.c.id].until - this.snoozed()[b.c.id].until);
    const settled = rows.filter((r) => r.c.settled).sort((a, b) => (b.c.settled_at ?? 0) - (a.c.settled_at ?? 0));

    // Monocode's 32 px navigation lines.
    const tool = (id, icon, label, onClick, right) =>
      h_flex()
        .id(id)
        .mx(8)
        .px(10)
        .h(32)
        .gap(10)
        .items_center()
        .rounded(12)
        .text_size(13)
        .text_color(t.muted)
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click(onClick)
        .child(svg(I(icon)).size(15))
        .child(div().flex_1().child(label))
        .when(Boolean(right), (el) => el.child(right));

    return v_flex()
      .size_full()
      .bg(t.chrome)
      .text_color(t.foreground)
      .pt(4)
      // The shown project; its picker below.
      .child(
        h_flex()
          .id("kt-project")
          .mx(8)
          .px(10)
          .h(36)
          .gap(9)
          .items_center()
          .rounded(12)
          .cursor_pointer()
          .when(this.projectsOpen, (el) => el.bg(t.hover))
          .hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => {
            this.projectsOpen = !this.projectsOpen;
            cx.notify();
          })
          .child(div().size(10).rounded(3).flex_none().bg(shown ? spaceColor(t, shown) : t.dim))
          .child(div().min_w(0).truncate().text_size(14).font_medium().child(shown?.name ?? "Aucun projet"))
          .child(svg(I("chevron-down")).size(14).flex_none().text_color(t.muted))
          .child(div().flex_1())
          .when(Boolean(shown?.branch), (el) => el.child(div().flex_none().max_w(110).truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(shown.branch))),
      )
      .when(this.projectsOpen, (el) => el.child(this.projectPicker(t, ps)))
      .child(tool("kt-new", "square-pen", "Nouveau thread", () => run("mod.open", { name: "kt-new" }), div().font_family(MONO).text_size(10.5).text_color(t.dim).child("⌘T")))
      .child(
        tool(
          "kt-inbox",
          "layers",
          "Inbox",
          () => {
            const p = panes().find((x) => x.mod === "kt-inbox");
            if (p) run("tab.select", { id: p.tab }); else run("tab.new", { mod: "kt-inbox", name: "Inbox" });
          },
          inboxShown ? null : div().size(6).rounded(3).bg(t.accent),
        ),
      )
      .child(tool("kt-search", "search", "Search", () => run("mod.open", { name: "picker" })))
      // kbrdn.dev `.eyebrow` over the list, and the filter as a `.segment` pill.
      .child(
        h_flex()
          .mx(18)
          .mt(8)
          .gap(8)
          .items_center()
          .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child("THREADS"))
          .child(div().flex_1().h(1).bg(t.border))
          .child(
            h_flex()
              .id("kt-every")
              .h(22)
              .px(10)
              .flex_none()
              .items_center()
              .rounded_full()
              .border(1)
              .border_color(everyProject ? t.accent + "66" : t.border)
              .when(everyProject, (el) => el.bg(t.accent + "24"))
              .font_family(MONO)
              .text_size(10.5)
              .text_color(everyProject ? t.accent : t.muted)
              .cursor_pointer()
              .hover((s) => s.text_color(t.foreground))
              .on_click((_e, cx) => {
                setShared("kt.project", everyProject ? null : "*");
                cx.notify();
              })
              .child("TOUS LES PROJETS"),
          ),
      )
      .child(
        v_flex()
          .id("kt-list")
          .flex_1()
          .min_h(0)
          .overflow_y_scrollbar()
          .pt(6)
          .gap(2)
          .children(pinned.map((r) => this.row(t, r, all)))
          .when(pinned.length > 0, (el) => el.child(div().mx(18).my(6).h(1).bg(t.border)))
          .children(active.map((r) => this.row(t, r, all)))
          .when(snoozed.length > 0, (el) =>
            el.child(
              this.section("kt-snoozed", `Snoozed (${snoozed.length})`, this.showSnoozed, (_e, cx) => {
                this.showSnoozed = !this.showSnoozed;
                cx.notify();
              }),
            ),
          )
          .when(this.showSnoozed, (el) => el.children(snoozed.map((r) => this.row(t, r, all))))
          .when(settled.length > 0, (el) =>
            el.child(
              this.section("kt-settled", `Settled (${settled.length})`, this.showSettled, (_e, cx) => {
                this.showSettled = !this.showSettled;
                cx.notify();
              }),
            ),
          )
          .when(this.showSettled, (el) => el.children(settled.map((r) => this.row(t, r, all))))
          .child(div().h(12)),
      )
      .child(this.projectBar(t, ps))
      .child(
        h_flex()
          .h(44)
          .px(14)
          .gap(4)
          .items_center()
          .border_t(1)
          .border_color(t.border)
          .child(this.button("kt-settings", "", "settings", () => run("app.settings")))
          .child(this.button("kt-keys", "", "keyboard", () => run("app.help")))
          .child(this.button("kt-layout", "", "layers", () => run("layout.switch"))),
      );
  }
}
