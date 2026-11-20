// Herdr's status bar (workspace-status) plus what kbrdn's Claude Code statusline knows:
// the active space's issue / PR / CI (gh) on the left, the focused Claude session's
// model + context and the account quota on the right.
import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, theme, run, window, keys, focused, exec, readTextFile, home, checking, shared, settings } from "herdr";
import { summarize } from "./ci.js";
import { motionState, frame, enter } from "./motion.js";
import { companion } from "./companion-logo.js";
import { refreshOn } from "./bus.js";
import { costLevel, levelColor } from "./levels.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);

const CACHE = "/.claude/cache/statusline/"; // written by ~/.claude/scripts/statusline.ts
const left = (sec) => {
  const h = Math.max(0, sec) / 3600;
  return h >= 48 ? tr("left.d", { n: Math.round(h / 24) }) : h >= 1 ? tr("left.h", { n: Math.round(h) }) : tr("left.m", { n: Math.round(h * 60) });
};

export default class KbrdnStatus extends View {
  init(_props, cx) {
    this.width = 0;
    this.quota = null;
    this.session = {};
    this.bridge = {}; // terminal -> herdr-bridge's { state, since, action }, for the companion
    this.memos = {}; // agent address -> companion-logo's memo
    this.motion = motionState(); // ANIMATIONS.md: a group that comes in fades in, the context meter slides
    this.pr = {};
    this.prKey = "";
    this.busy = false;
    if (checking()) return;
    cx.timer.every(5000, (cx) => this.poll(cx));
    cx.timer.every(60000, (cx) => this.loadPr(cx, true));
    this.poll(cx);
  }

  // null: no file. undefined: a torn read (statusline.ts rewrites these files on every render), keep the last value.
  async json(path) {
    try { const text = await readTextFile(path); return text == null ? null : JSON.parse(text); } catch { return undefined; }
  }

  poll(cx) {
    this.loadPr(cx, false);
    cx.spawn(async (cx) => {
      const dir = home() + CACHE;
      const quota = await this.json(dir + "herdr-quota.json");
      if (quota !== undefined) this.quota = quota;
      const t = focused()?.terminal;
      const session = t ? await this.json(`${dir}herdr-${t}.json`) : undefined;
      if (t && session !== undefined) this.session[t] = session;
      // herdr-bridge: what the focused agent does now (the companion's badge); a torn read keeps the last.
      const bridge = t ? await this.json(`${home()}/.claude/cache/herdr/${t}.json`) : undefined;
      if (t && bridge !== undefined) this.bridge[t] = bridge && { state: bridge.state, since: bridge.since, action: bridge.action };
      const next = JSON.stringify([this.quota, t && this.session[t], t && this.bridge[t]]);
      if (next !== this.last) { this.last = next; cx.notify(); }
    });
  }

  // The active space's PR, from where its focused terminal is now. Once a minute, at once on a switch.
  loadPr(cx, force) {
    const space = spaces().find((s) => s.active);
    const cwd = focused()?.cwd ?? space?.folder;
    if (!space || !cwd || this.busy) return;
    const key = `${space.id}|${cwd}`;
    if (!force && key === this.prKey) return;
    this.prKey = key;
    this.busy = true;
    cx.spawn(async (cx) => {
      const opts = { cwd, on: space.machine, timeout: 15000 };
      try {
        const head = (await exec("git", ["rev-parse", "HEAD"], opts)).stdout.trim();
        const r = await exec("gh", ["pr", "view", "--json", "number,state,isDraft,reviewDecision,statusCheckRollup,headRefOid,url"], opts);
        const pr = r.code === 0 ? JSON.parse(r.stdout) : null;
        this.pr[space.id] = pr && { number: pr.number, state: pr.state, draft: pr.isDraft, review: pr.reviewDecision,
          url: pr.url, ci: summarize(pr.statusCheckRollup, pr.headRefOid, head) };
      } catch {
        this.pr[space.id] = null;
      }
      this.busy = false;
      cx.notify();
    });
  }

  // The palette key as actually bound, not a hardcoded one; without a
  // binding the hint stays useful ("commands") instead of lying.
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  prChips(t, space, wide) {
    const chips = [];
    const issue = space?.branch?.match(/#(\d+)/)?.[1];
    if (issue) chips.push(div().text_color(t.ansi3).child(`#${issue}`));
    const pr = space && this.pr[space.id];
    if (!pr) return chips;
    const state = pr.state === "MERGED" ? ["merged", t.ansi5] : pr.state === "CLOSED" ? ["closed", t.dim] : pr.draft ? ["draft", t.muted] : ["", t.ansi4];
    chips.push(div().id("kbrdn-pr").cursor_pointer().text_color(state[1]).hover((s) => s.text_color(t.foreground))
      .on_click(() => exec("open", [pr.url])).child(state[0] ? tr("pr", { n: pr.number, state: tr(`pr.${state[0]}`) }) : `PR #${pr.number}`));
    if (pr.state !== "OPEN") return chips;
    const ci = pr.ci;
    const [text, color] = {
      pass: [`CI ${ci.passed}/${ci.total} ✓`, t.done],
      fail: [`CI ${ci.failed} ✗ /${ci.total}`, t.ansi1],
      pending: [`CI ${ci.passed + ci.failed}/${ci.total} …`, t.ansi3],
      stale: ["CI · HEAD ≠ PR", t.dim], // i18n: tech
      none: ["CI —", t.dim],
    }[ci.state];
    chips.push(div().text_color(color).child(text));
    if (wide && pr.review === "APPROVED") chips.push(div().text_color(t.done).child("review ✓")); // i18n: tech
    if (wide && pr.review === "CHANGES_REQUESTED") chips.push(div().text_color(t.ansi1).child(tr("changesRequested")));
    return chips;
  }

  // Same thresholds as statusline.ts contextColor(): context rot, not fill.
  ctxColor(t, pct, window) {
    const [warn, alarm] = window >= 1_000_000 ? [20, 50] : [55, 75];
    return pct >= alarm ? t.ansi1 : pct >= warn ? t.ansi3 : t.ansi5;
  }

  // The fill slides to a new value (ReaderBar.vue's bar, ANIMATIONS.md), at once under reduced motion.
  meter(t, pct, color) {
    return div().w(36).h(4).rounded(2).bg(t.raised).child(div().id("ks-ctx-fill").h(4).rounded(2).w(Math.max(2, 36 * Math.min(1, pct / 100))).bg(color)
      .when(!this.motion.reduced, (el) => el.transition("width", { duration: 240, easing: "ease-out" })));
  }
  // The focused terminal's agent, alive (kt-threads' companion-logo.js): 20×16, its smallest clean size,
  // the bob inside its own box so nothing else in the bar moves. No agent there: nothing.
  pet(list, cx) {
    const ft = focused()?.terminal;
    const a = ft && list.find((x) => x.address === ft);
    if (!a) return null;
    const b = this.bridge[ft];
    return companion({
      program: a.program, state: a.status, id: `ks-pet-${a.address}`, address: a.address, cx, size: 20, height: 16,
      action: b?.state ? (b.action ?? null) : undefined, since: b?.state ? b.since : undefined,
      memo: (this.memos[a.address] ??= {}),
    });
  }

  sessionChips(t, list, wide) {
    const ft = focused()?.terminal;
    const s = ft && list.some((a) => a.address === ft && a.app === "claude-code") ? this.session[ft] : null;
    if (!s) return [];
    const chips = [];
    if (wide) chips.push(div().text_color(t.accent).child(`${s.model}${s.effort && s.effort !== "high" ? ` · ${s.effort}` : ""}`));
    if (s.ctx_pct != null) {
      const color = this.ctxColor(t, s.ctx_pct, s.window);
      chips.push(h_flex().gap(6).items_center().child(this.meter(t, s.ctx_pct, color)).child(div().text_color(color).child(`${s.ctx_pct.toFixed(0)}%`)));
    }
    if (wide && s.cost_usd != null) chips.push(div().text_color(levelColor(t, costLevel(s.cost_usd, s.model), { okGreen: true })).child(`$${s.cost_usd.toFixed(2)}`));
    return chips;
  }

  quotaChips(t, wide) {
    const q = this.quota;
    if (!q) return [];
    const now = Date.now() / 1000;
    const chip = (label, w) => {
      const used = w.used_percentage ?? 0;
      const color = used >= 80 ? t.ansi1 : used >= 50 ? t.ansi3 : t.muted;
      return div().text_color(color).child(`${label} ${Math.round(used)}%${w.resets_at ? ` · ${left(w.resets_at - now)}` : ""}`);
    };
    const chips = [];
    if (wide && q.five_hour) chips.push(chip("5h", q.five_hour));
    if (q.seven_day) chips.push(chip(tr("week"), q.seven_day));
    return chips;
  }

  render(cx) {
    const t = theme();
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const space = spaces().find((s) => s.active);
    // DATA-SYNC.md: a commit, a push or a PR anywhere, or an agent of this space that stopped working: the
    // PR and its CI are read again (the branch is Herdr's own, live).
    if (!checking()) refreshOn(this, cx, "pr", ["git", "gh", ...(space ? [`agent:${space.id}`] : [])], async (cx) => this.loadPr(cx, true));
    const list = agents();
    const needs = list.filter((a) => a.status === "blocked").length;
    const wide = !this.width || this.width >= 980;
    const pet = this.pet(list, cx);
    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(text);
    // A group that comes in (a PR found, a session, the quota) fades in where it stands: no slide in a bar.
    const group = (chips, id) => enter(m, h_flex().gap(10).items_center().flex_none(), id, { dy: 0 }).children(chips);
    const sep = () => div().w(1).h(12).bg(t.border);
    const pr = this.prChips(t, space, wide);
    const session = this.sessionChips(t, list, wide);
    const quota = this.quotaChips(t, wide);
    return h_flex().id("root").on_size_change((size, cx) => { this.width = size.width; cx.notify(); })
      .size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .when(Boolean(pet), (el) => el.child(pet))
      .when(wide, (el) => el.child(label(space?.machine ? "server" : "monitor", space?.machine ?? tr("thisComputer"))))
      .when(Boolean(space?.branch), (el) => el.child(h_flex().min_w(0).child(label("branch", div().truncate().child(space.branch)))))
      .when(pr.length > 0, (el) => el.child(group(pr, "ks-pr")))
      .child(h_flex().gap(6).items_center().flex_none().child(div().size(6).rounded(3).bg(t.dim)).child(tr("agents", { n: list.length }))
        // In light, blocked is 4.1:1 (FILTERS.md, #81): foreground words, the hue on a dot that stands in for the "·".
        .when(needs > 0 && !settings().dark, (el) => el.child(enter(m, h_flex().gap(6).items_center().text_color(t.foreground), "ks-needs", { dy: 0 })
          // i18n: tech (NEEDS YOU, the agent state: the same in every language)
          .child(div().size(6).rounded(3).bg(t.blocked)).child(`${needs} needs you`)))
        // i18n: tech (NEEDS YOU, the agent state: the same in every language)
        .when(needs > 0 && settings().dark, (el) => el.child(enter(m, div().text_color(t.blocked), "ks-needs", { dy: 0 }).child(`· ${needs} needs you`))))
      .child(div().flex_1())
      .when(session.length > 0, (el) => el.child(group(session, "ks-session")))
      .when(session.length > 0 && quota.length > 0, (el) => el.child(sep()))
      .when(quota.length > 0, (el) => el.child(group(quota, "ks-quota")))
      .when(wide, (el) => el.child(div().id("palette").flex_none().text_color(t.dim).on_click(() => run("app.palette")).child(this.hint(t))));
  }
}
