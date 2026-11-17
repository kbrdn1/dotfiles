// kbrdn Threads inbox (port of herdr.dev "Threads", restyled to kbrdn.dev):
// every tab of every space as one inbox of work. Pinned on top, then active
// (newest first; activity never reshuffles), then the snoozed and settled
// shelves, folded. A row: a mascot head for threads with an agent (else the
// program's icon), its project, its status tag (needs you, done, working for
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

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, run, theme, shared, setShared, openOverlay, exec, window as win, home, readTextFile, checking } from "herdr";
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
// Agent status -> mascot mood (brand/mascot/<mood>.png).
const MASCOT = { blocked: "nervous", working: "thinking", done: "clap", idle: "content" };
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

export default class Threads extends View {
  init(_props, cx) {
    this.hover = null;
    this.showSettled = false;
    this.showSnoozed = false;
    this.snoozing = null; // the row showing its snooze choices
    this.picking = false;
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
      for (const p of panes()) {
        if (!p.terminal || p.terminal.includes("/") || !p.program?.agent) continue;
        try {
          const s = await readTextFile(`${home()}/.claude/cache/herdr/${p.terminal}.json`);
          if (s) next[p.terminal] = JSON.parse(s);
        } catch {
          if (this.live[p.terminal]) next[p.terminal] = this.live[p.terminal]; // a torn read keeps the last one
        }
      }
      this.readingLive = false;
      const key = JSON.stringify(next);
      if (key !== this.liveKey) { this.liveKey = key; this.live = next; cx.notify(); }
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
        try {
          const s = await readTextFile(`${home()}/Reports/${dir}/${p.branch.replace(/[/#]+/g, "-")}/data.js`);
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
      .rounded(6)
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
    const agent = Boolean(c.status) || mine.some((p) => p.program?.agent);
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
    // A mascot head for a thread with an agent, in the mood of its status;
    // otherwise the icon of what runs in it.
    const avatar = div()
      .size(22)
      .flex_none()
      .flex()
      .items_center()
      .justify_center()
      .when(agent, (el) => el.child(image(`brand/mascot/${MASCOT[c.status] ?? MASCOT.idle}.png`).size(22)))
      .when(!agent && Boolean(lead?.program?.icon), (el) => el.child(glyph(lead.program, 16, t.muted)));
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
          .when(Boolean(pj.machine), (el) => el.child(div().flex_none().px(5).rounded(4).bg(t.raised).text_size(11).text_color(t.dim).child(pj.machine)))
          .child(div().flex_1())
          .when(pinned && !hovered, (el) => el.child(svg(I("pin")).size(12).flex_none().text_color(t.dim)))
          .child(right),
      )
      .when(!short, (el) =>
        el
          .child(div().truncate().text_size(14).font_medium().text_color(t.foreground).child(c.name))
          .when(Boolean(this.liveLine(t, c, lead)), (el) => el.child(this.liveLine(t, c, lead)))
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
      .items_center()
      .rounded(10)
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
    const scope = shared("kt.project");
    const every = ps.flatMap((w) => w.tabs.map((c) => ({ w, c, pj: this.project(w, c, all) })));
    const projects = [...new Map(every.map((r) => [r.pj.key, r.pj])).values()];
    const rows = every.filter((r) => !scope || r.pj.key === scope);
    const pins = this.pins();
    const awake = (r) => !r.c.settled && !this.asleep(r.c);
    const pinned = pins.map((id) => rows.find((r) => r.c.id === id && awake(r))).filter(Boolean);
    const active = rows.filter((r) => awake(r) && !pins.includes(r.c.id)).sort((a, b) => num(b.c.id) - num(a.c.id));
    const snoozed = rows.filter((r) => this.asleep(r.c)).sort((a, b) => this.snoozed()[a.c.id].until - this.snoozed()[b.c.id].until);
    const settled = rows.filter((r) => r.c.settled).sort((a, b) => (b.c.settled_at ?? 0) - (a.c.settled_at ?? 0));

    const tool = (id, icon, label, onClick) =>
      h_flex()
        .id(id)
        .mx(8)
        .px(10)
        .h(34)
        .gap(10)
        .items_center()
        .rounded(10)
        .text_size(13)
        .text_color(t.muted)
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click(onClick)
        .child(svg(I(icon)).size(15))
        .child(div().flex_1().child(label));

    return v_flex()
      .size_full()
      .bg(t.chrome)
      .text_color(t.foreground)
      .pt(4)
      .child(
        h_flex()
          .child(div().flex_1().child(tool("kt-search", "search", "Search", () => run("mod.open", { name: "picker" }))))
          .child(
            this.button("kt-filter", "", "list-filter", () => {
              this.picking = !this.picking;
            }).when(Boolean(scope), (el) => el.text_color(t.accent)),
          )
          .child(this.button("kt-add", "", "folder-plus", () => run("space.new")))
          .child(this.button("kt-new", "", "square-pen", () => run("mod.open", { name: "kt-new" })).mr(12)),
      )
      .when(this.picking, (el) =>
        el.children(
          [{ key: null, name: "All projects" }, ...projects].map((w) =>
            h_flex()
              .id(`kt-scope-${w.key ?? "all"}`)
              .mx(8)
              .pl(36)
              .h(28)
              .items_center()
              .rounded(8)
              .font_family(MONO)
              .text_size(11)
              .text_color((scope ?? null) === w.key ? t.accent : t.muted)
              .cursor_pointer()
              .hover((s) => s.bg(t.hover).text_color(t.foreground))
              .on_click((_e, cx) => {
                setShared("kt.project", w.key);
                this.picking = false;
                cx.notify();
              })
              .child(w.name.toUpperCase()),
          ),
        ),
      )
      .child(
        v_flex()
          .id("kt-list")
          .flex_1()
          .min_h(0)
          .overflow_y_scrollbar()
          .pt(8)
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
