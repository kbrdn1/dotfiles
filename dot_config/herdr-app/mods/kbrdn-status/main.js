// Herdr's status bar (workspace-status) plus what kbrdn's Claude Code statusline knows:
// the active space's issue / PR / CI (gh) on the left, the focused Claude session's
// model + context and the account quota on the right.
import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, theme, run, window, keys, focused, exec, readTextFile, home, checking } from "herdr";
import { summarize } from "./ci.js";

const CACHE = "/.claude/cache/statusline/"; // written by ~/.claude/scripts/statusline.ts
const left = (sec) => {
  const h = Math.max(0, sec) / 3600;
  return h >= 48 ? `${Math.round(h / 24)}j` : h >= 1 ? `${Math.round(h)}h` : `${Math.round(h * 60)}m`;
};

export default class KbrdnStatus extends View {
  init(_props, cx) {
    this.width = 0;
    this.quota = null;
    this.session = {};
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
      let quota = await this.json(dir + "herdr-quota.json");
      if (quota === null) { // Open Island's live copy (7-day window only)
        try { quota = JSON.parse((await exec("cat", ["/tmp/open-island-rl.json"])).stdout); } catch { quota = null; }
      }
      if (quota !== undefined) this.quota = quota;
      const t = focused()?.terminal;
      const session = t ? await this.json(`${dir}herdr-${t}.json`) : undefined;
      if (t && session !== undefined) this.session[t] = session;
      const next = JSON.stringify([this.quota, t && this.session[t]]);
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
    const state = pr.state === "MERGED" ? ["mergée", t.ansi5] : pr.state === "CLOSED" ? ["fermée", t.dim] : pr.draft ? ["brouillon", t.muted] : ["", t.ansi4];
    chips.push(div().id("kbrdn-pr").cursor_pointer().text_color(state[1]).hover((s) => s.text_color(t.foreground))
      .on_click(() => exec("open", [pr.url])).child(`PR #${pr.number}${state[0] ? ` ${state[0]}` : ""}`));
    if (pr.state !== "OPEN") return chips;
    const ci = pr.ci;
    const [text, color] = {
      pass: [`CI ${ci.passed}/${ci.total} ✓`, t.done],
      fail: [`CI ${ci.failed} ✗ /${ci.total}`, t.ansi1],
      pending: [`CI ${ci.passed + ci.failed}/${ci.total} …`, t.ansi3],
      stale: ["CI · HEAD ≠ PR", t.dim],
      none: ["CI —", t.dim],
    }[ci.state];
    chips.push(div().text_color(color).child(text));
    if (wide && pr.review === "APPROVED") chips.push(div().text_color(t.done).child("review ✓"));
    if (wide && pr.review === "CHANGES_REQUESTED") chips.push(div().text_color(t.ansi1).child("changements demandés"));
    return chips;
  }

  // Same thresholds as statusline.ts contextColor(): context rot, not fill.
  ctxColor(t, pct, window) {
    const [warn, alarm] = window >= 1_000_000 ? [20, 50] : [55, 75];
    return pct >= alarm ? t.ansi1 : pct >= warn ? t.ansi3 : t.ansi5;
  }

  meter(t, pct, color) {
    return div().w(36).h(4).rounded(2).bg(t.raised).child(div().h(4).rounded(2).w(Math.max(2, 36 * Math.min(1, pct / 100))).bg(color));
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
    if (wide && s.cost_usd != null) chips.push(div().text_color(t.muted).child(`$${s.cost_usd.toFixed(2)}`));
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
    if (q.seven_day) chips.push(chip("7j", q.seven_day));
    return chips;
  }

  render() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    const list = agents();
    const needs = list.filter((a) => a.status === "blocked").length;
    const wide = !this.width || this.width >= 980;
    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(text);
    const group = (chips) => h_flex().gap(10).items_center().flex_none().children(chips);
    const sep = () => div().w(1).h(12).bg(t.border);
    const pr = this.prChips(t, space, wide);
    const session = this.sessionChips(t, list, wide);
    const quota = this.quotaChips(t, wide);
    return h_flex().id("root").on_size_change((size, cx) => { this.width = size.width; cx.notify(); })
      .size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .when(wide, (el) => el.child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer")))
      .when(Boolean(space?.branch), (el) => el.child(h_flex().min_w(0).child(label("branch", div().truncate().child(space.branch)))))
      .when(pr.length > 0, (el) => el.child(group(pr)))
      .child(h_flex().gap(6).items_center().flex_none().child(div().size(6).rounded(3).bg(t.dim)).child(`${list.length} agents`)
        .when(needs > 0, (el) => el.child(div().text_color(t.blocked).child(`· ${needs} needs you`))))
      .child(div().flex_1())
      .when(session.length > 0, (el) => el.child(group(session)))
      .when(session.length > 0 && quota.length > 0, (el) => el.child(sep()))
      .when(quota.length > 0, (el) => el.child(group(quota)))
      .when(wide, (el) => el.child(div().id("palette").flex_none().text_color(t.dim).on_click(() => run("app.palette")).child(this.hint(t))));
  }
}
