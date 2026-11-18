// The session status line under the thread (it was a composer: the terminal is the input, so this
// only tells). The focused agent's model and effort, context fill as a tick meter, prompt-cache hit,
// checkout or worktree and branch, and the account quota with its reset, like Monocode's footer.
// Data: ~/.claude/cache/statusline/herdr-<terminal>.json and herdr-quota.json (statusline.ts).

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, focused, theme, panes, home, readTextFile, checking } from "herdr";

const MONO = "Monaspace Krypton";
const left = (sec) => {
  const h = Math.max(0, sec) / 3600;
  return h >= 48 ? `${Math.round(h / 24)}j` : h >= 1 ? `${Math.round(h)}h` : `${Math.round(h * 60)}m`;
};

export default class SessionLine extends View {
  init(_p, cx) {
    this.line = null;
    this.quota = null;
    if (!checking()) cx.timer.every(4000, (cx) => this.read(cx));
  }

  agent() {
    const f = focused();
    return agents().find((a) => a.address === f?.terminal) ?? agents().find((a) => a.focused) ?? null;
  }

  read(cx) {
    const a = this.agent();
    cx.spawn(async (cx) => {
      const json = async (path) => { try { const s = await readTextFile(path); return s ? JSON.parse(s) : null; } catch { return undefined; } };
      const dir = `${home()}/.claude/cache/statusline`;
      const line = a && !a.address.includes("/") ? await json(`${dir}/herdr-${a.address}.json`) : null;
      const quota = await json(`${dir}/herdr-quota.json`);
      if (line !== undefined) this.line = line;
      if (quota !== undefined) this.quota = quota;
      const key = JSON.stringify([a?.address, this.line, this.quota]);
      if (key !== this.key) { this.key = key; cx.notify(); }
    });
  }

  // kbrdn.dev `.meter` + `.ticks`: 2 px ticks, lit up to the value.
  ticks(t, pct, color, n = 9) {
    const lit = Math.round(Math.min(1, Math.max(0, pct / 100)) * n);
    return h_flex().h(10).gap(3).items_center().children(Array.from({ length: n }, (_, i) => div().w(2).h(10).bg(i < lit ? color : t.raised)));
  }

  // statusline.ts contextColor(): context rot, not fill.
  ctxColor(t, pct, window) {
    const [warn, alarm] = window >= 1_000_000 ? [20, 50] : [55, 75];
    return pct >= alarm ? t.ansi1 : pct >= warn ? t.ansi3 : t.done;
  }

  quotaColor(t, used) {
    return used >= 80 ? t.ansi1 : used >= 50 ? t.ansi3 : t.done;
  }

  render() {
    const t = theme();
    const a = this.agent();
    const l = a && this.line;
    const q = this.quota;
    const pane = panes().find((p) => p.terminal === a?.address) ?? panes().find((p) => p.focused);
    const worktree = Boolean(pane?.cwd && /-worktrees\//.test(pane.cwd));
    const sep = () => div().w(1).h(14).bg(t.border).flex_none();
    const label = (text) => div().font_family(MONO).text_size(10.5).text_color(t.muted).child(text);
    const value = (text, color) => div().font_family(MONO).text_size(11).text_color(color ?? t.foreground).child(text);
    const item = (...kids) => h_flex().gap(7).items_center().flex_none().children(kids);
    const now = Date.now() / 1000;
    const parts = [];
    if (a) {
      parts.push(item(
        a.program?.icon ? image(a.program.icon).w(14).h(14) : div(),
        value((l?.model ?? a.program?.name ?? "agent").toUpperCase()),
        ...(l?.effort ? [label(l.effort.toUpperCase())] : [])));
    }
    if (l?.ctx_pct != null) {
      const c = this.ctxColor(t, l.ctx_pct, l.window);
      parts.push(item(label("CTX"), this.ticks(t, l.ctx_pct, c), value(`${Math.round(l.ctx_pct)}%`, c)));
    }
    if (l?.cache?.hit_pct != null) parts.push(item(label("CACHE"), value(`${Math.round(l.cache.hit_pct)}%`)));
    if (pane?.branch) {
      parts.push(item(svg("mods/kt-threads/git-branch.svg").size(12).text_color(t.muted),
        label(worktree ? "WORKTREE" : "CHECKOUT"),
        div().max_w(260).truncate().font_family(MONO).text_size(11).text_color(t.foreground).child(pane.branch)));
    }
    const windows = [["5H", q?.five_hour], ["7J", q?.seven_day]].filter(([, w]) => w);
    return h_flex().id("session-line").size_full().px(16).gap(14).items_center()
      .rounded(16).bg(t.background).border(1).border_color(t.border)
      .children(parts.flatMap((p, i) => (i ? [sep(), p] : [p])))
      .child(div().flex_1())
      .children(windows.map(([name, w]) => {
        const used = w.used_percentage ?? 0;
        const c = this.quotaColor(t, used);
        return item(label(name), this.ticks(t, used, c, 7), value(`${Math.round(used)}%`, c),
          ...(w.resets_at ? [label(left(w.resets_at - now))] : []));
      }));
  }
}
