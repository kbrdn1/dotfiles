// kt-hub: the home page (#46), the "hub" child of kbrdn-threads' "view" stack. It draws what the indexer
// (index.ts, #44) leaves in data/kt-hub/summary.json and computes nothing in render: model.js derives the
// week, the rankings, the projects and the year once per summary (and when the day changes).
// Sections: the header (the index's state, r), Now (the live agents, a click goes to the one to see),
// This week (six cards against the same days of the week before, their 8 weeks as bars), Activity (the
// year in plain squares, viz.calendar, ‹ year ›), the week's workflows and skills, its sub-agents, the
// projects (this week's most active first).
// The indexer runs (exec, bun by its path: exec's PATH has no ~/.nix-profile): on the first show and on
// coming back after 60 s, the old summary staying shown; on the bus's "agents" while shown, 60 s apart at
// most (a bump in between waits for its turn); on r. A hidden copy doesn't render, so it doesn't hear
// the bus: it catches up when it shows. One 5 s tick while shown (the page left, a bump waiting, the day
// and the minute changing); none while hidden.
// Keys (vim.js): j / k gg / G the sections, [ / ] or h / l the year, r index, ? kt-keys, q / esc back
// to the thread when there is one.
// Mod commands: kt-hub.focus, key:<keys>, refresh, year:<yyyy>.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { exec, readTextFile, theme, spaces, agents, run, layout, home, appHome, checking, nextCommand, openOverlay, shared, settings, panes } from "herdr";
import { week, ranked, projectRows, year, years, now, delta, localDay, dayShift } from "./model.js";
import { makeT, num, date, time, relative, duration } from "./i18n.js";
import strings from "./strings.js";
import { Vim, keysOf, step } from "./vim.js";
import { dither, iconBtn, bandRow } from "./band.js";
import { motionState, frame, enter } from "./motion.js";
import { skeleton } from "./skeleton.js";
import { viz, quartileLevels } from "./viz.js";
import { roll } from "./roll.js";
import { refreshOn } from "./bus.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const I = (name) => `mods/kt-threads/${name}.svg`;
const SPIN = "mods/workspace-chrome/spinner.svg";
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };
const AGAIN_MS = 60e3; // the indexer at most once a minute, unless r
const SECTIONS = ["now", "week", "act", "rank", "proj"];
const CARDS = ["s", "p", "a", "sub", "pr", "streak"];
const FAMILY = { workflow: "ansi4", loop: "ansi5", skill: "ansi2" };

function find(node, id) {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}
// Shown: the "view" stack is on this page.
const visible = () => (find(layout(), "view")?.active ?? null) === "hub";
// A thread to go back to: a space with a tab.
const hasThread = () => spaces().some((s) => s.tabs?.length);

export default class Hub extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.vim = new Vim({ field: false });
    this.motion = motionState();
    this.scroll = ScrollHandle.new();
    this.sum = null; // summary.json
    this.d = null; // what model.js derived from it
    this.readError = null;
    this.running = false;
    this.ranAt = 0; // the last pass this copy started (0: none yet)
    this.waiting = false; // a bump of "agents" waits for its minute
    this.err = null; // error.json, when newer than the summary
    this.year = null;
    this.heat = new Map(); // year -> its levels, per summary
    this.cur = "now";
    this.reveal = false;
    this.width = 1000;
    this.headW = 0;
    this.shown = false;
    this.tick = null;
    this.minute = 0;
    if (checking()) return;
    this.load(cx);
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.focusIn(cx);
        else if (c.startsWith("key:")) {
          this.focusIn(cx);
          for (const k of keysOf(c.slice(4))) this.press(k, cx);
        } else if (c === "refresh") this.index(cx, "commande");
        else if (c.startsWith("year:")) this.pickYear(Number(c.slice(5)));
        cx.notify();
      }
    });
  }

  // ---------- data ----------

  // summary.json (and error.json), then the model; a failed read keeps what was shown.
  load(cx) {
    cx.spawn(async (cx) => {
      const base = `${appHome()}/data/kt-hub`;
      const [text, errText] = await Promise.all([readTextFile(`${base}/summary.json`).catch(() => null), readTextFile(`${base}/error.json`).catch(() => null)]);
      const s = parse(text);
      if (s?.v === 1) { this.sum = s; this.readError = null; this.derive(); }
      else if (text != null) this.readError = "summary.json";
      const e = parse(errText);
      this.err = e?.at && e.at > (this.sum?.at ?? 0) ? e : null;
      cx.notify();
    });
  }

  derive() {
    const s = this.sum;
    const today = localDay(Date.now());
    const w = week(s.days, today);
    const ys = years(s);
    if (!ys.includes(this.year)) this.year = ys.at(-1) ?? null;
    this.heat.clear();
    const reg = shared("kt.projects");
    this.regKey = JSON.stringify(reg ?? null);
    this.d = { today, w, launches: ranked(s.days, w, "l"), subs: ranked(s.days, w, "sub"), rows: projectRows(s.projects, reg, w), years: ys };
  }

  // The year's levels (quartiles each side of the junction), once per summary and year; its weeks'
  // tooltips once each (dates are slow to write: 53 a render cost ~5 ms).
  heatOf(y) {
    if (!this.heat.has(y)) {
      const h = year(this.sum, y, this.d.today);
      this.heat.set(y, h ? { ...h, levels: quartileLevels(h.values, h.split), tips: new Map() } : null);
    }
    return this.heat.get(y);
  }

  weekTip(h, a, b) {
    const key = `${a}|${tr("act.less")}`; // the language in the key: a switch writes them again
    let s = h.tips.get(key);
    if (s == null) {
      const n = h.values.slice(a, b + 1).reduce((x, v) => x + (v ?? 0), 0);
      s = tr("act.week", { from: date(`${dayShift(h.start, a)}T12:00:00`), to: date(`${dayShift(h.start, b)}T12:00:00`), n: num(n) });
      h.tips.set(key, s);
    }
    return s;
  }

  // One pass of the indexer; a pass running elsewhere (its lock) answers busy: its summary is read after.
  index(cx, why) {
    if (checking() || this.running) return;
    this.running = true;
    this.ranAt = Date.now();
    this.waiting = false;
    console.log(`kt-hub: index (${why})`);
    cx.spawn(async (cx) => {
      try {
        const r = await exec(`${home()}/.nix-profile/bin/bun`, [`${appHome()}/mods/kt-hub/index.ts`], { timeout: 600e3 });
        const out = parse(r.stdout.trim().split("\n").pop());
        if (r.code !== 0 && !out) this.err = { at: Date.now(), message: (r.stderr.trim().split("\n").pop() || `code ${r.code}`).slice(0, 200) };
      } catch (e) {
        this.err = { at: Date.now(), message: String(e?.message ?? e).slice(0, 200) };
      }
      this.running = false;
      this.load(cx);
      cx.notify();
    });
  }

  // The 5 s tick, only while shown: the page left (so its return reads again), a bump's turn, the day
  // and the minute (the clock, « il y a ») changing, the keyboard coming or going.
  startTick(cx) {
    if (this.tick) return;
    this.tick = cx.timer.every(5000, (cx) => {
      if (!visible()) {
        this.shown = false;
        this.tick?.cancel();
        this.tick = null;
        return;
      }
      if (this.waiting && Date.now() - this.ranAt >= AGAIN_MS) this.index(cx, "bus");
      if (this.d && localDay(Date.now()) !== this.d.today) this.derive();
      const minute = Math.floor(Date.now() / 60e3);
      if (minute !== this.minute || this.keyed !== this.handle.is_focused()) { this.minute = minute; cx.notify(); }
    });
  }

  async close() {
    this.tick?.cancel();
    this.tick = null;
  }

  pickYear(y) {
    if (this.d?.years.includes(y)) this.year = y;
  }

  stepYear(by) {
    const ys = this.d?.years ?? [];
    const i = ys.indexOf(this.year);
    if (i >= 0 && ys[i + by] != null) this.year = ys[i + by];
  }

  // ---------- actions ----------

  go(a) {
    if (!a) return;
    run("layout.select", { stack: "view", child: "thread" });
    run("agent.focus", { terminal: a.address });
  }

  leavePage() {
    if (!hasThread()) return;
    run("layout.select", { stack: "view", child: "thread" });
    const tab = spaces().find((s) => s.active)?.tabs.find((c) => c.active)?.id;
    const pane = panes().find((p) => p.tab === tab && p.focused)?.pane;
    if (pane) run("pane.focus", { pane });
  }

  // ---------- keys (vim.js; kt-keys lists them) ----------

  focusIn(cx) {
    this.handle.focus();
    this.vim.normal();
    if (visible()) this.startTick(cx);
  }

  key(e, cx) {
    if (!this.press(e, cx)) return;
    cx.stop_propagation();
    cx.notify();
  }

  press(k, cx) {
    const a = this.vim.handle(k);
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) {
      this.cur = SECTIONS[step(a, SECTIONS.indexOf(this.cur), SECTIONS.length, this.vim.count, 4)];
      this.reveal = true;
    } else if (a === "panel-prev" || a === "left") this.stepYear(-1);
    else if (a === "panel-next" || a === "right") this.stepYear(1);
    else if (a === "open" && this.cur === "now") this.go(now(agents()).go);
    else if (a === "refresh") this.index(cx, "r");
    else if (a === "help") openOverlay({ mod: "kt-keys", kind: "dialog", width: 1, height: 1, frame: "none", props: { group: "pages" } });
    else if (a === "quit" || a === "escape") this.leavePage();
    else return false;
    return true;
  }

  // ---------- pieces ----------

  card(t) {
    return v_flex().min_h(0).rounded(16).border(1).border_color(t.border).bg(t.background);
  }

  // A section: its name on a dashed rule (the cursor's ring while the page has the keyboard), its right
  // side, its body.
  section(t, id, label, right, body) {
    const on = this.keyed && this.cur === id;
    return v_flex().id(`hub-sec-${id}`).mx(4).px(8).pt(10).pb(8).gap(8).rounded(14).border(1)
      .border_color(on ? alpha(t.accent, "99") : alpha(t.border, "00"))
      .child(h_flex().gap(10).items_center()
        .child(div().flex_none().font_family(MONO).text_size(11).text_color(t.muted).child(String(label).toUpperCase()))
        .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border))
        .children([right].flat().filter(Boolean)))
      .child(body);
  }

  muted(t, text) {
    return div().text_size(12.5).text_color(t.dim).child(text);
  }

  // ---------- header ----------

  header(t) {
    const s = this.sum;
    const at = Date.now();
    const state = this.running ? (s ? tr("index.running") : tr("index.first"))
      : this.err ? tr("index.failed", { ago: relative(this.err.at), error: this.err.message })
        : this.readError ? tr("index.unreadable", { error: this.readError })
          : s?.pass ? tr("index.fresh", { ago: relative(s.pass.at) }) : tr("index.never");
    const refresh = this.running
      ? div().id("hub-b-running").size(28).flex_none().flex().items_center().justify_center().tooltip(tr("tip.running"))
        .child(svg(SPIN).size(14).spin(900).text_color(t.muted))
      : iconBtn(t, "hub-b-refresh", I("refresh-cw"), tr("tip.refresh"), (cx) => this.index(cx, "bouton"));
    return this.card(t).id("hub-head").relative().flex_none().px(4).pb(4)
      .on_size_change((x, cx) => { if (x.width !== this.headW) { this.headW = x.width; cx.notify(); } })
      .children([dither(this.headW, 60, 16, t.accent)].filter(Boolean))
      .child(bandRow(t, { m: this.m, color: t.accent, icon: I("house"), title: tr("title"),
        dot: this.running ? t.working : this.err ? t.ansi1 : null,
        sub: [`${date(at)} · ${time(at)}`, state],
        buttons: [refresh] }));
  }

  // ---------- now ----------

  nowSection(t) {
    const n = now(agents());
    const parts = [n.working && tr("now.working", { n: n.working }), n.blocked && tr("now.blocked", { n: n.blocked }), n.done && tr("now.done", { n: n.done })].filter(Boolean);
    const dot = n.blocked ? t.blocked : n.done ? t.done : n.working ? t.working : t.dim;
    const line = h_flex().gap(10).items_center().px(4)
      .child(n.working ? svg(SPIN).size(12).flex_none().spin(900).text_color(t.working)
        : div().size(8).flex_none().rounded_full().bg(dot).when(n.blocked > 0, (el) => el.loop("opacity", { from: 0.3, to: 1, period: 1200 })))
      .child(div().flex_1().min_w(0).truncate().text_size(13.5).text_color(parts.length ? t.foreground : t.muted).child(parts.length ? parts.join(" · ") : tr("now.none")))
      .when(Boolean(n.go), (el) => el.child(h_flex().id("hub-now-go").flex_none().h(26).px(10).gap(6).items_center().rounded_full()
        .border(1).border_color(alpha(dot, "66")).bg(alpha(dot, "14")).text_size(12).text_color(t.foreground).cursor_pointer()
        .hover((s) => s.bg(alpha(dot, "24"))).tooltip(tr("now.goTip", { name: n.go.tab_name || n.go.space_name || n.go.address }))
        .on_click((_e, cx) => { cx.stop_propagation(); this.go(n.go); })
        .child(tr("now.go")).child(svg(I("chevron-right")).size(12))));
    return this.section(t, "now", tr("now.title"), null, line);
  }

  // ---------- this week ----------

  // Eight weeks as bars, the last (this week so far) in the accent.
  bars(t, values, w, color) {
    const max = Math.max(1, ...values);
    const gap = 3;
    const bw = Math.max(2, Math.floor((w - gap * (values.length - 1)) / values.length));
    return h_flex().h(24).gap(gap).items_end().children(values.map((v, i) =>
      div().w(bw).h(Math.max(2, Math.round((v / max) * 24))).rounded(2).bg(i === values.length - 1 ? color : alpha(color, v ? "59" : "26"))));
  }

  statCard(t, k, cw) {
    const { w } = this.d;
    const s = this.sum;
    const inner = cw - 24;
    const value = (x) => (k === "a" ? duration(x) : num(x));
    let main, detail, d = null, series = null, tip;
    if (k === "streak") {
      main = tr("streak.days", { n: s.streak?.cur ?? 0 });
      detail = tr("streak.best", { n: s.streak?.best ?? 0 });
      tip = tr("tip.streak", { best: s.streak?.best ?? 0 });
    } else {
      main = value(w.now[k]);
      d = delta(w.now[k], w.before[k]);
      detail = d === 0 ? tr("week.same") : d == null && w.now[k] ? tr("week.new") : tr("week.vs");
      if (d === 0) d = null;
      series = w.trend.map((x) => (k === "a" ? Math.round(x[k] / 36e5) : x[k]));
      tip = tr(`tip.${k}`, { mg: num(w.now.mg) });
    }
    const pct = d == null ? null : `${d >= 0 ? "+" : "−"}${tr("pct", { n: Math.abs(d) })}`;
    return v_flex().id(`hub-card-${k}`).w(cw).flex_none().p(12).gap(8).rounded(12).border(1).border_color(t.border).bg(t.raised).tooltip(tip)
      .child(this.V.stat(tr(`card.${k}`), main, { delta: pct, detail, better: "higher", width: inner, id: `hub-st-${k}` }))
      .when(Boolean(series), (el) => el.child(this.bars(t, series, inner, t.accent)));
  }

  weekSection(t) {
    const W = this.width - 24;
    const cols = W >= 1050 ? 3 : 2;
    const cw = Math.floor((W - 8 * (cols - 1)) / cols);
    return this.section(t, "week", tr("week.title"), div().flex_none().text_size(11).text_color(t.dim).child(tr("week.sub")),
      h_flex().flex_wrap().gap(8).children(CARDS.map((k) => this.statCard(t, k, cw))));
  }

  // ---------- activity ----------

  actSection(t) {
    const h = this.year != null ? this.heatOf(this.year) : null;
    const ys = this.d.years;
    const i = ys.indexOf(this.year);
    const arrow = (id, icon, tip, by, on) => div().id(id).size(24).flex_none().rounded_full().flex().items_center().justify_center()
      .text_color(on ? t.muted : t.dim).when(!on, (el) => el.opacity(0.4))
      .when(on, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
        .on_click((_e, cx) => { cx.stop_propagation(); this.stepYear(by); cx.notify(); }))
      .child(svg(I(icon)).size(13));
    const right = h_flex().flex_none().gap(4).items_center()
      .child(h_flex().h(22).px(8).items_center().rounded_full().border(1).border_color(alpha(t.accent, "66")).bg(alpha(t.accent, "1f"))
        .font_family(MONO).text_size(10.5).text_color(t.foreground).child(tr("act.agents")))
      .child(arrow("hub-y-prev", "chevron-left", tr("act.prev"), -1, i > 0))
      .child(div().font_family(MONO).text_size(12).text_color(t.foreground).child(String(this.year ?? "")))
      .child(arrow("hub-y-next", "chevron-right", tr("act.next"), 1, i >= 0 && i < ys.length - 1));
    if (!h) return this.section(t, "act", tr("act.title"), right, this.V.calendar([], {}));
    const junction = this.sum.junction;
    const cal = this.V.calendar(h.levels, {
      start: h.start, months: tr("act.months").split(" "), weekdays: tr("act.weekdays").split(" "), legend: [tr("act.less"), tr("act.more")],
      mark: h.split > 0 ? h.split : null, markTip: junction ? tr("act.mark", { date: date(`${junction}T12:00:00`, { year: true }) }) : null,
      tip: (a, b) => this.weekTip(h, a, b),
      id: `hub-cal-${this.year}`,
    });
    return this.section(t, "act", tr("act.title"), right, v_flex().gap(6)
      .child(div().font_family(MONO).text_size(11).text_color(t.muted).child(tr("act.total", { active: num(h.active), sessions: num(h.sessions) })))
      .child(cal));
  }

  // ---------- this week's launches and sub-agents ----------

  rankRows(t, list, colorOf, emptyText) {
    if (!list.length) return this.muted(t, emptyText);
    const max = Math.max(...list.map((x) => x.n));
    return v_flex().gap(4).children(list.slice(0, 8).map((x) => {
      const c = colorOf(x);
      const d = x.n - x.prev;
      return h_flex().id(`hub-r-${x.family ?? "sub"}-${x.name}`).h(22).gap(8).items_center().tooltip(tr("rank.tip", { name: x.name, n: x.n, prev: x.prev }))
        .child(div().size(6).flex_none().rounded_full().bg(c))
        .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.foreground).child(x.name))
        .child(div().w(80).h(6).flex_none().rounded(3).bg(alpha(c, "1f")).child(div().h_full().rounded(3).bg(alpha(c, "b3")).w(Math.max(3, Math.round((x.n / max) * 80)))))
        .child(div().w(28).flex_none().flex().justify_end().font_family(MONO).text_size(11.5).text_color(t.foreground).child(num(x.n)))
        .child(div().w(30).flex_none().flex().justify_end().font_family(MONO).text_size(10).text_color(d > 0 ? t.ansi2 : d < 0 ? t.ansi1 : t.dim)
          .child(d ? `${d > 0 ? "+" : "−"}${Math.abs(d)}` : "="));
    }));
  }

  // The week's launches (workflows, loops, skills; Claude Code's own commands on one line under them)
  // beside its sub-agents by type, under each other when narrow.
  rankSection(t) {
    const all = this.d.launches;
    const work = all.filter((x) => x.family !== "command");
    const cmds = all.filter((x) => x.family === "command");
    const legend = h_flex().flex_none().gap(10).items_center().children(["workflow", "loop", "skill"].map((f) => h_flex().gap(4).items_center()
      .font_family(MONO).text_size(10.5).text_color(t.dim).child(div().size(6).rounded_full().bg(t[FAMILY[f]])).child(tr(`fam.${f}`))));
    const launches = v_flex().flex_1().min_w(0).gap(4)
      .child(this.rankRows(t, work, (x) => t[FAMILY[x.family]] ?? t.accent, tr("launch.none")))
      .when(cmds.length > 0, (el) => el.child(div().pt(2).truncate().font_family(MONO).text_size(10.5).text_color(t.dim)
        .child(tr("launch.commands", { list: cmds.slice(0, 6).map((x) => `/${x.name} ${x.n}`).join(" · ") }))));
    const subs = v_flex().flex_1().min_w(0).gap(6)
      .child(div().font_family(MONO).text_size(11).text_color(t.muted).child(tr("sub.title").toUpperCase()))
      .child(this.rankRows(t, this.d.subs, () => t.ansi6, tr("sub.none")));
    const wide = this.width >= 900;
    return this.section(t, "rank", tr("launch.title"), legend, (wide ? h_flex().items_start().gap(24) : v_flex().gap(14)).child(launches).child(subs));
  }

  // ---------- projects ----------

  tile(t, r) {
    const box = div().size(20).flex_none().rounded(6).flex().items_center().justify_center().overflow_hidden();
    if (r.kind === "home") return box.bg(t.raised).border(1).border_color(t.border).child(svg(I("house")).size(12).text_color(t.muted));
    const l = r.entry?.logos;
    const logo = l ? (settings().dark ? (l.dark ?? l.light) : (l.light ?? l.dark)) : null;
    if (logo) return box.child(image(logo).size(18));
    const c = r.entry?.color;
    const fill = c ? (c.startsWith("#") ? c : t[c] ?? t.dim) : t.dim;
    const name = r.kind === "other" ? "?" : r.name;
    return box.bg(alpha(fill, r.entry ? "ff" : "66")).child(div().font_family(MONO).font_bold().text_size(11).text_color(t.chrome).child(([...name][0] ?? "?").toUpperCase()));
  }

  projRow(t, r) {
    const name = r.kind === "other" ? tr("proj.other") : r.name;
    const max = Math.max(1, ...r.spark);
    const color = r.entry?.color ? (r.entry.color.startsWith("#") ? r.entry.color : t[r.entry.color] ?? t.accent) : t.accent;
    return h_flex().id(`hub-p-${r.key}`).h(34).px(4).gap(10).items_center().rounded(10).hover((s) => s.bg(t.hover))
      .child(this.tile(t, r))
      .child(h_flex().flex_1().min_w(0).gap(8).items_center()
        .child(div().min_w(0).truncate().text_size(13).text_color(r.s ? t.foreground : t.muted).child(name))
        .when(!r.entry && (r.kind === "repo" || r.kind === "gh"), (el) => el.child(div().flex_none().h(16).px(6).flex().items_center().rounded_full()
          .border(1).border_color(t.border).font_family(MONO).text_size(9.5).text_color(t.dim).child(tr("proj.unlisted")))))
      .child(h_flex().id(`hub-ps-${r.key}`).flex_none().h(18).gap(2).items_end().tooltip(tr("proj.sparkTip", { list: r.spark.join(" · ") }))
        .children(r.spark.map((v, i) => div().w(5).h(Math.max(2, Math.round((v / max) * 18))).rounded(1)
          .bg(i === r.spark.length - 1 ? color : alpha(color, v ? "66" : "26")))))
      .child(div().w(150).flex_none().flex().justify_end().font_family(MONO).text_size(11).text_color(r.s ? t.foreground : t.dim)
        .child(tr("proj.week", { s: num(r.s), a: duration(r.a * 1000) })))
      .child(div().w(46).flex_none().flex().justify_end().font_family(MONO).text_size(11).text_color(r.pr ? t.foreground : t.dim).child(tr("proj.prs", { n: r.pr })))
      .when(this.width >= 760, (el) => el.child(div().w(110).flex_none().flex().justify_end().text_size(11).text_color(t.dim)
        .child(r.last ? tr("proj.last", { ago: relative(r.last) }) : "")));
  }

  projSection(t) {
    const rows = this.d.rows.slice(0, 14);
    return this.section(t, "proj", tr("proj.title"), null,
      rows.length ? v_flex().gap(2).children(rows.map((r) => this.projRow(t, r))) : this.muted(t, tr("proj.none")));
  }

  // ---------- page ----------

  // Before the first summary: the sections' shapes as bars (skeleton.js), breathing.
  skeletonBody(t) {
    const S = skeleton(t, this.m);
    return S.pulse(v_flex().id("hub-body-sk").p(12).gap(14)
      .child(S.line(140, { h: 7, lh: 16 }))
      .child(h_flex().gap(8).children([0, 1, 2].map(() => S.block(null, 110).flex_1())))
      .child(S.line(110, { h: 7, lh: 16 }))
      .child(S.block(null, 140))
      .child(S.list(5, { h: 34, icon: 20, lines: [0.4] })));
  }

  body(t) {
    if (!this.sum || !this.d) {
      return v_flex().flex_1().min_h(0).child(this.readError ? div().p(16).text_size(13).text_color(t.ansi1).child(tr("index.unreadable", { error: this.readError })) : this.skeletonBody(t));
    }
    if (this.regKey !== JSON.stringify(shared("kt.projects") ?? null)) this.derive(); // a project added, renamed, recoloured
    const kids = [this.nowSection(t), this.weekSection(t), this.actSection(t), this.rankSection(t), this.projSection(t)];
    if (this.reveal) {
      this.scroll.scroll_to_item(Math.max(0, SECTIONS.indexOf(this.cur)));
      this.reveal = false;
    }
    return enter(this.m, v_flex().flex_1().min_h(0), "hub-in", { dy: 0 })
      .child(v_flex().id("hub-body").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).p(4).pb(16).gap(4).children(kids));
  }

  render(cx) {
    this.m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const vis = visible();
    if (!checking()) {
      // The bus (DATA-SYNC.md): an agent stopped working, its transcript grew. Once a minute at most.
      refreshOn(this, cx, "hub-agents", ["agents"], async (cx) => {
        if (Date.now() - this.ranAt >= AGAIN_MS) this.index(cx, "bus");
        else this.waiting = true;
      });
      if (vis && !this.shown) {
        // Shown again: the keyboard (NORMAL) once the app has settled its own focus, the tick, a pass
        // when the last is over a minute old (the old summary stays shown meanwhile).
        cx.timer.after(150, (cx) => {
          if (visible() && !this.handle.is_focused()) this.focusIn(cx);
          cx.notify();
        });
        this.startTick(cx);
        if (Date.now() - this.ranAt >= AGAIN_MS) this.index(cx, "page");
      }
    }
    this.shown = vis;
    this.keyed = this.handle.is_focused();
    const t = theme();
    this.V = viz(t, this.m, { roll });
    return v_flex().id("hub-root").size_full().gap(4).text_color(t.foreground)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
      .child(this.header(t))
      .child(this.card(t).flex_1().min_h(0).overflow_hidden().child(this.body(t)));
  }
}
