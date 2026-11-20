// The session status line under the thread's Chat face (#86: the terminal face shows the terminal
// only; it was a composer: the terminal is the input, so this only tells). The focused agent's model and effort, context fill as a ring, prompt-cache hit
// and what is left of its TTL, cost, duration, lines changed; the checkout or worktree and branch
// with the PR, its CI and review from /me:report; the claude-flow step, todos and sub-agents; the
// account quota with its reset, like Monocode's footer. Items drop by priority when the line is short.
// Data, read every 4 s: ~/.claude/cache/statusline/herdr-<terminal>.json and herdr-quota.json
// (statusline.ts), ~/.claude/cache/herdr/<terminal>.json (herdr-bridge) and <terminal>.flow.json
// (claude-flow), ~/Reports/<owner>-<repo>/<branch>/facts.json (/me:report, every 15 s).
// A click on the checkout item opens kt-branch above it. Its switch comes back here as
// `kt-composer.switch` (the confirm dialog's answer, the target in shared "kt-branch.switch"): this
// line stays on screen while the popup is gone.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
// kt-threads' ring (a copy of its ring.js): the context and the quotas fill a 14 px ring.
import { ring, ringColor } from "./ring.js";
import { costLevel, levelColor } from "./levels.js";
import { agents, focused, theme, panes, spaces, home, readTextFile, exec, checking, openOverlay, notify, nextCommand, shared, setShared } from "herdr";
import { motionState, frame, enter, MS } from "./motion.js";
// kt-keys' skeleton.js (a byte-identical copy): the focused agent's figures as bars while they are read.
import { skeleton, readyFor } from "./skeleton.js";
// kt-keys' roll.js (a byte-identical copy): the figures that change roll to their new digits.
import { roll, rollText } from "./roll.js";
// kt-threads' companion-logo.js (a byte-identical copy): the focused agent's tile, alive.
import { companion } from "./companion-logo.js";
import { bump, gitTopics, refreshOn } from "./bus.js";
import { makeT, num, compact, relative } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
import * as fs from "fs/promises";

const MONO = "Monaspace Krypton";
const CH = 0.62; // Monaspace's advance, em
const LABEL = 10.5;
const VALUE = 11;
const GAP = 14; // between items (a separator sits in it on the left side)
const PAD = 16;
const REPORT_EVERY = 15000;

const left = (sec) => {
  const h = Math.max(0, sec) / 3600;
  return h >= 48 ? `${Math.round(h / 24)}${tr("day")}` : h >= 1 ? `${Math.round(h)}h` : `${Math.round(h * 60)}m`;
};
const duration = (ms) => {
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${Math.floor(m / 1440)}${tr("day")}${Math.floor((m % 1440) / 60)}h`;
};
// `sec`: how long ago, in seconds.
const ago = (sec) => relative(Date.now() - sec * 1000);
const count = (n) => compact(n);

// Same reading as kt-threads' summarizeReport: blockers are p0+p1+p2 of the last pass, an axis that
// never ran is not a zero, ci null shows nothing.
function summarize(d) {
  const f = d?.facts ?? {};
  const last = f.review?.passes?.at?.(-1);
  const ran = (a) => a?.state === "ok";
  return {
    pr: f.pr?.number ? { number: f.pr.number, state: f.pr.state } : null,
    review: last ? { pass: last.pass, blockers: ran(last.standards) || ran(last.spec) ? (last.p0 ?? 0) + (last.p1 ?? 0) + (last.p2 ?? 0) : null } : null,
    ci: f.ci ? { ok: f.ci.ok ?? 0, total: f.ci.total ?? 0, fail: f.ci.fail ?? 0, pending: f.ci.pending ?? 0 } : null,
  };
}
const PR_COLOR = { OPEN: "ansi2", MERGED: "ansi5", CLOSED: "ansi1" };

// An item's parts, and what each takes (px) for the fit: text at the font's advance, capped where truncated.
const icon = (src, tint) => ({ t: "icon", src, tint });
// The agent's companion (20×16, its smallest clean size): state, herdr-bridge's action and since are
// in the part, so a change of what it does redraws the line.
const pet = (state, action, since) => ({ t: "pet", state, action, since });
const PET_W = 20;
const glyph = (src) => ({ t: "svg", src });
const label = (text) => ({ t: "label", text });
const value = (text, color, max) => ({ t: "value", text, color, max });
// A value whose digits roll when it changes (roll.js); `id` keeps its reels (per agent: a focus that
// moves shows the other agent's figures at once, only that agent's own changes roll). Measured as a value.
const rolling = (text, id, color, snap = 0) => ({ t: "roll", text, id, color, snap });
// The same for a value of several numbers and words ("✓ 3/5", "R2 · 1 bloquant", "1h05"): rollText, each
// number its own reels, so a tail that changes length moves no other number's.
const rollingText = (text, id, color) => ({ t: "rolltext", text, id, color });
// A 14 px ring (`id`: its element's, `tip`: its tooltip's name), the line's height.
const meter = (pct, id, tip, window) => ({ t: "ring", pct, id, tip, window });
const RING = 14;
function partWidth(p) {
  if (p.t === "icon") return 14;
  if (p.t === "pet") return PET_W;
  if (p.t === "svg") return 12;
  if (p.t === "ring") return RING;
  const w = [...p.text].length * (p.t === "label" ? LABEL : VALUE) * CH;
  return p.max ? Math.min(p.max, w) : w;
}
const itemWidth = (parts) => parts.reduce((s, p) => s + partWidth(p), 0) + 7 * (parts.length - 1);

export default class SessionLine extends View {
  init(_p, cx) {
    this.data = { line: null, quota: null, live: null, flow: null, report: null };
    this.repos = {}; // cwd -> repo name | null (git asked once per folder)
    this.width = null;
    this.memos = {}; // agent address -> companion-logo's memo
    this.motion = motionState(); // ANIMATIONS.md: an item that comes in fades in
    if (!checking()) {
      cx.timer.every(4000, (cx) => this.read(cx));
      this.read(cx);
      cx.spawn(async (cx) => {
        for (;;) {
          const c = await nextCommand();
          if (c === "switch") this.switchBranch(cx);
        }
      });
    }
  }

  // Read again now, the PR/CI report included (it is otherwise kept 15 s per branch).
  refresh(cx) {
    this.reportFor = null;
    this.key = null;
    this.read(cx);
  }

  // kt-branch, above the checkout item (a popup at the pointer this low would be squeezed).
  openBranches() {
    const pane = this.pane(this.agent());
    if (!pane?.cwd) return;
    const machine = spaces().find((s) => s.tabs.some((t) => t.id === pane.tab))?.machine ?? null;
    const b = this.anchor;
    openOverlay({
      mod: "kt-branch", kind: "popup", width: 420, height: 460, frame: "none",
      ...(b ? { at: { x: Math.max(8, b.x), y: Math.max(8, b.y - 460 - 8) } } : {}),
      props: { cwd: pane.cwd, machine, terminal: pane.terminal, pane: pane.pane },
    });
  }

  // The confirmed switch. The agent may have started working while the dialog was open: asked again.
  switchBranch(cx) {
    const p = shared("kt-branch.switch");
    setShared("kt-branch.switch", null);
    if (!p?.cwd || !p.branch) return;
    if (agents().some((a) => a.status === "working" && ((p.terminal && a.address === p.terminal) || (p.pane && a.pane === p.pane)))) {
      notify({ title: tr("branch.title"), body: tr("branch.body", { branch: p.branch }), level: "warning" });
      return;
    }
    cx.spawn(async (cx) => {
      try {
        const r = await exec("git", ["switch", p.branch], { cwd: p.cwd, on: p.machine ?? undefined, timeout: 120000 });
        if (r.code !== 0) notify({ title: tr("switchRefused"), body: `${p.branch} : ${(r.stderr || r.stdout).trim().split("\n").slice(-6).join("\n")}`, level: "error" });
      } catch (e) {
        notify({ title: tr("switchFailed"), body: `${p.branch} : ${String(e?.message ?? e)}`, level: "error" });
      }
      // DATA-SYNC.md: the repo moved (or may have, a failed switch can be partial), for every mod showing it.
      bump(...gitTopics(p.root ?? null));
      this.refresh(cx);
    });
  }

  agent() {
    const f = focused();
    return agents().find((a) => a.address === f?.terminal) ?? agents().find((a) => a.focused) ?? null;
  }

  // `focused` is each tab's own focused pane: the shown tab's, never another tab's (#86).
  pane(a) {
    const tab = focused()?.tab;
    return panes().find((p) => p.terminal === a?.address) ?? panes().find((p) => p.focused && p.tab === tab);
  }

  read(cx) {
    if (this.reading) return;
    this.reading = true;
    const a = this.agent();
    const pane = this.pane(a);
    cx.spawn(async (cx) => {
      try {
        // undefined: unreadable now, keep what we had; null: not there.
        const json = async (path) => { try { const s = await readTextFile(path); return s ? JSON.parse(s) : null; } catch { return undefined; } };
        const local = Boolean(a) && !a.address.includes("/");
        const sl = `${home()}/.claude/cache/statusline`;
        const hd = `${home()}/.claude/cache/herdr`;
        const next = {
          line: local ? await json(`${sl}/herdr-${a.address}.json`) : null,
          quota: await json(`${sl}/herdr-quota.json`),
          live: local ? await json(`${hd}/${a.address}.json`) : null,
          flow: local ? await json(`${hd}/${a.address}.flow.json`) : null,
          report: local ? await this.report(a.address, pane) : null,
        };
        // Another agent than last time: what can't be read now is not carried over from the previous one.
        const same = (a?.address ?? null) === this.dataFor;
        for (const [k, v] of Object.entries(next)) {
          if (v !== undefined) this.data[k] = v;
          else if (!same && k !== "quota") this.data[k] = null;
        }
        this.dataFor = a?.address ?? null;
        // What is shown, times rounded as drawn: a redraw only when a shown string changes.
        const key = JSON.stringify([a?.address, this.items(a, pane).map((i) => i.parts)]);
        if (key !== this.key) { this.key = key; cx.notify(); }
      } finally {
        // Always, a failed read too: a reading flag left up would freeze the line on the previous agent.
        this.reading = false;
      }
      // The focus moved while this read ran (that read was dropped): read the agent shown now. Once, and
      // only after an answer (a read that threw doesn't loop: the 4 s tick tries again).
      const was = a?.address ?? null;
      if (this.dataFor === was && (this.agent()?.address ?? null) !== was) this.read(cx);
    });
  }

  // The /me:report facts of the pane's branch: ~/Reports/<owner>-<repo>/<branch, / and # as ->/.
  async report(address, pane) {
    if (!pane?.cwd || !pane.branch) return null;
    const at = `${address}|${pane.cwd}|${pane.branch}`;
    if (at === this.reportFor && Date.now() - this.reportAt < REPORT_EVERY) return undefined;
    this.reportFor = at;
    this.reportAt = Date.now();
    if (!(pane.cwd in this.repos)) {
      try {
        const r = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: pane.cwd });
        const dir = r.code === 0 ? r.stdout.trim() : "";
        this.repos[pane.cwd] = dir ? (dir.endsWith("/.git") ? dir.slice(0, -5) : dir).split("/").pop() : null;
      } catch { this.repos[pane.cwd] = null; }
    }
    const repo = this.repos[pane.cwd];
    if (!repo) return null;
    let owners = [];
    try { owners = await fs.readdir(`${home()}/Reports`); } catch { return null; }
    const dir = owners.find((o) => o.endsWith(`-${repo}`));
    if (!dir) return null;
    try {
      const s = await readTextFile(`${home()}/Reports/${dir}/${pane.branch.replace(/[/#]+/g, "-")}/facts.json`);
      return s ? summarize(JSON.parse(s)) : null;
    } catch { return undefined; }
  }

  // Every item there is data for, in display order. prio: 0 is the last to go.
  items(a, pane) {
    const q = this.data.quota; // the account's, whoever is focused
    // The rest only once read for this agent: never the previous agent's for a tick.
    const { line: l, live, flow, report: r } = a && a.address === this.dataFor ? this.data : {};
    const now = Date.now() / 1000;
    const out = [];
    const add = (id, prio, parts, side = "left") => out.push({ id, prio, parts, side, w: itemWidth(parts) });
    if (a) {
      add("model", 0, [
        pet(a.status, live?.state ? (live.action ?? null) : undefined, live?.state ? live.since : undefined),
        value((l?.model ?? a.program?.name ?? "agent").toUpperCase()),
        ...(l?.effort ? [label(l.effort.toUpperCase())] : [])]);
    }
    // An agent on another machine (#65): said, and why the line has nothing else (its statusline, flow and
    // report files are on that machine; the quota read here is this Mac's account), instead of a bare line.
    const on = a?.address.includes("/") ? a.address.split("/")[0] : null;
    if (on) {
      add("machine", 0, [label(tr("on")), value(on, "muted")]);
      add("remote", 9, [value(tr("remoteLine"), "dim", 300)]);
    }
    if (l?.ctx_pct != null) {
      // kt-threads' ring and its thresholds: accent under 60 %, blocked to 85 %, ansi1 above.
      // The ring and its number share one level (levels.js, the status line's context rot): same kind, same window.
      add("ctx", 1, [label("CTX"), meter(l.ctx_pct, "ctx", tr("context"), l.window), rolling(`${Math.round(l.ctx_pct)}%`, `ctx-${a.address}`, ringColor(theme(), Math.round(l.ctx_pct), { kind: "ctx", window: l.window ?? 1_000_000 }))]);
    }
    if (l?.hit_pct != null) add("cache", 9, [label("CACHE"), rolling(`${Math.round(l.hit_pct)}%`, `cache-${a.address}`)]);
    if (l?.cache_at && l?.cache_ttl) {
      const rest = l.cache_at / 1000 + l.cache_ttl - now;
      add("ttl", 11, [label("TTL"), rest > 0 ? rollingText(left(rest), `ttl-${a.address}`, rest < 300 ? "ansi3" : null) : value(tr("expired"), "ansi1")]);
    }
    // The status line's cost colour: green, then yellow and red against the model's price (levels.js).
    if (l?.cost_usd != null) add("cost", 7, [rolling(`$${num(l.cost_usd, 2)}`, `cost-${a.address}`, levelColor(theme(), costLevel(l.cost_usd, l.model), { okGreen: true }), 2)]); // the cents change at once: no roll at every reading
    if (l?.duration_ms > 0) add("duration", 10, [label(tr("duration")), rollingText(duration(l.duration_ms), `dur-${a.address}`)]);
    if (l?.lines_added > 0 || l?.lines_removed > 0) {
      add("lines", 8, [rolling(`+${count(l.lines_added ?? 0)}`, `add-${a.address}`, "ansi2"), rolling(`−${count(l.lines_removed ?? 0)}`, `del-${a.address}`, "ansi1")]);
    }
    if (pane?.branch) {
      const worktree = Boolean(pane.cwd && /-worktrees\//.test(pane.cwd));
      add("branch", 3, [glyph("mods/kt-threads/git-branch.svg"), label(worktree ? "WORKTREE" : "CHECKOUT"), value(pane.branch, null, 260)]);
    }
    if (a && r) {
      if (r.pr) add("pr", 4, [label("PR"), value(`#${r.pr.number}`, PR_COLOR[r.pr.state])]);
      const ci = r.ci;
      if (ci && ci.total > 0) {
        // Failing counts the failures, else the passes: in the id, so 3 passed never rolls into 1 failed.
        add("ci", 4, [label("CI"), ci.fail > 0 ? rollingText(`✗ ${ci.fail}/${ci.total}`, `ci-f-${a.address}`, "ansi1")
          : ci.pending > 0 ? rollingText(`… ${ci.ok}/${ci.total}`, `ci-o-${a.address}`, "ansi3") : rollingText(`✓ ${ci.ok}/${ci.total}`, `ci-o-${a.address}`, "done")]);
      }
      if (r.review) {
        const b = r.review.blockers;
        add("review", 4, [rollingText(`R${r.review.pass} · ${b === null ? tr("notRun") : tr("blockers", { n: b })}`, `rv-${a.address}`,
          b === null ? "dim" : b > 0 ? "blocked" : "done")]);
      }
    }
    const step = a && flow?.steps?.find?.((s) => s.state === "current");
    if (step?.label) add("flow", 6, [label("FLOW"), value(step.label, null, 160)]);
    const todos = a && live?.todos;
    if (todos?.total > 0) {
      add("todos", 5, [label("TODO"), rollingText(`${todos.done}/${todos.total}`, `todo-${a.address}`), ...(todos.current ? [value(todos.current, "muted", 200)] : [])]);
    }
    // herdr-bridge never marks a background sub-agent done, so this can count some that ended.
    const running = a ? (live?.agents ?? []).filter((s) => s.state !== "done").length : 0;
    if (running > 0) add("agents", 5, [label("AGENTS"), rolling(String(running), `agents-${a.address}`)]);
    if (l?.updated_at && now - l.updated_at > 120) add("stale", 12, [rollingText(ago(now - l.updated_at), `stale-${a.address}`, "muted")], "right");
    // [key (the ids), shown name, window]
    for (const [name, shown, w] of [["5H", "5H", q?.five_hour], ["7J", tr("week"), q?.seven_day]]) {
      if (!w || on) continue; // this Mac's account: not shown beside another machine's agent
      const used = w.used_percentage ?? 0;
      add(`q${name}`, 2, [label(shown), meter(used, `q${name}`, shown), rolling(`${Math.round(used)}%`, `q${name}`, ringColor(theme(), Math.round(used))), ...(w.resets_at ? [label(`reset ${left(w.resets_at - now)}`)] : [])], "right");
    }
    return out;
  }

  // The width these items take as laid out below: padding, left items with separators, the spacer, right items.
  static span(items) {
    const L = items.filter((i) => i.side === "left");
    const R = items.filter((i) => i.side === "right");
    const kids = [...L.flatMap((i, k) => (k ? [1, i.w] : [i.w])), 0, ...R.map((i) => i.w)];
    return 2 * PAD + kids.reduce((s, w) => s + w, 0) + GAP * (kids.length - 1);
  }

  // Drops the least important item (then the later one) until the rest fits, with a little slack.
  static fit(items, width) {
    if (!width) return items;
    const shown = [...items];
    const order = items.map((i, k) => [i, k]).sort((x, y) => y[0].prio - x[0].prio || y[1] - x[1]).map(([i]) => i);
    for (const drop of order) {
      if (SessionLine.span(shown) * 1.03 + 8 <= width) break;
      shown.splice(shown.indexOf(drop), 1);
    }
    return shown;
  }

  measured(size, cx) {
    if (size.width !== this.width) { this.width = size.width; cx.notify(); }
  }

  render(cx) {
    const t = theme();
    const a = this.agent();
    // DATA-SYNC.md: a commit, a switch, a push or a PR anywhere, or an agent of this space that stopped
    // working: the line reads its facts again (the checkout item, the PR and its CI).
    const sp = spaces().find((s) => s.active)?.id;
    if (!checking()) refreshOn(this, cx, "line", ["git", "gh", ...(sp ? [`agent:${sp}`] : [])], async (cx) => this.refresh(cx));
    if (!checking() && (a?.address ?? null) !== this.dataFor) this.read(cx); // focus moved: read now, not in 4 s
    const color = (c, d) => (c ? t[c] ?? c : d);
    const el = (p) => {
      switch (p.t) {
        // A one-color glyph takes the text color (herdr.d.ts Program.tint), a picture keeps its own.
        case "icon": return p.tint ? svg(p.src).size(14).flex_none().text_color(t.foreground) : image(p.src).w(14).h(14).flex_none();
        // Its own fixed 20×16 box: the bob, the badge and a hop move inside it, never the line.
        case "pet": return companion({ program: a.program, state: p.state, action: p.action, since: p.since, cx,
          size: PET_W, height: 16, id: `sl-pet-${a.address}`, address: a.address, memo: (this.memos[a.address] ??= {}) });
        case "svg": return svg(p.src).size(12).flex_none().text_color(t.muted);
        // kind said, not read off the tip (ring.js' "Contexte" test): the tip is in the language shown.
        case "ring": return ring(t, `sl-ring-${p.id}`, p.pct, RING, { tip: p.tip, window: p.window, kind: p.id === "ctx" ? "ctx" : "quota" });
        case "label": return div().flex_none().font_family(MONO).text_size(LABEL).text_color(t.muted).child(p.text);
        // 16 px: the line's other parts (pet, ring) are 14 to 16 px high, so the reels fit without growing it.
        case "roll": return roll(m, `sl-n-${p.id}`, p.text, 16, { snap: p.snap }).font_family(MONO).text_size(VALUE).text_color(color(p.color, t.foreground));
        case "rolltext": return rollText(m, `sl-n-${p.id}`, p.text, 16).flex_none().font_family(MONO).text_size(VALUE).text_color(color(p.color, t.foreground));
        default: return div().font_family(MONO).text_size(VALUE).text_color(color(p.color, t.foreground))
          .when(Boolean(p.max), (e) => e.max_w(p.max).truncate()).when(!p.max, (e) => e.flex_none()).child(p.text);
      }
    };
    // No padding on the checkout item's hit area: fit() measures the parts alone. An item that comes
    // in (dropped no more, a new fact) fades in where it stands: the line clips, nothing slides.
    const m = frame(this.motion, Boolean(shared("kt.reducedMotion")));
    const item = (i) => enter(m, h_flex().gap(7).items_center().flex_none().whitespace_nowrap(), `item-${i.id}`, { dy: 0 })
      .when(i.id === "branch", (e) => e.cursor_pointer().hover((s) => s.opacity(0.75))
        // The item's top left in the window: the press in the window minus the press in the item.
        .on_mouse_down("left", (ev) => {
          this.anchor = ev.local_position ? { x: ev.position.x - ev.local_position.x, y: ev.position.y - ev.local_position.y } : null;
        })
        .on_click(() => this.openBranches()))
      .children(i.parts.map(el));
    const sep = () => div().w(1).h(14).bg(t.border).flex_none();
    const shown = SessionLine.fit(this.items(a, this.pane(a)), this.width);
    const L = shown.filter((i) => i.side === "left");
    const R = shown.filter((i) => i.side === "right");
    const left = L.flatMap((i, k) => (k ? [sep(), item(i)] : [item(i)]));
    // Not read yet for the focused agent (readyFor on dataFor): where its figures come, after its name,
    // the context ring with its label and value, the cost and the duration as bars (skeleton.js),
    // breathing. They fade in only past MS.open: a read that answers at once (local files, the usual)
    // shows no flash at each focus change, one that lags (git asked for a new folder) shows them.
    // Reduced motion: no delay to be had, so none (the figures come as before). Their separator is in the
    // delayed block too: nothing shows on a quick read (its room is kept, where the figures come).
    if (!m.reduced && L.length && !readyFor(this.dataFor, a?.address ?? null)) {
      const S = skeleton(t, m);
      left.splice(1, 0, enter(m, h_flex().flex_none().gap(GAP).items_center().child(sep()).child(S.pulse(h_flex().id("sl-sk").gap(GAP).items_center()
        .child(h_flex().gap(7).items_center().child(S.line(22, { h: 6, lh: 14 })).child(S.circle(RING)).child(S.line(26, { h: 7, lh: 16 })))
        .child(S.line(40, { h: 7, lh: 16 }))
        .child(S.line(48, { h: 7, lh: 16 })))), "sl-sk-in", { dy: 0, delay: MS.open }));
    }
    return h_flex().id("session-line").size_full().px(PAD).gap(GAP).items_center().overflow_hidden().whitespace_nowrap()
      .rounded(16).bg(t.background).border(1).border_color(t.border)
      .on_size_change((size, cx) => this.measured(size, cx))
      .children(left)
      .child(div().flex_1())
      .children(R.map(item));
  }
}
