// The program's own logo, alive: for Herdr mods' agent cards. Copy this file into a mod and import it.
//
//   import { companion } from "./companion-logo.js";
//   companion({ program: agent.program, state: agent.status, action: live?.action ?? null,
//               since: live?.since, size: 24, id: agent.address, memo: (this.memos[agent.address] ??= {}),
//               cx, onClick: (e, cx) => {} })
//
// The body is the icon Herdr gives (program.icon, tint, tile, color), on its tile as kt-threads and
// kbrdn-agents draw it: never redrawn. Around it, all native (.loop, .transition, .spring):
// - idle: still; idle 10 min: a small "z" in the corner, still;
// - working: the icon bobs 1.5 to 2 px; what it does sits in a corner as a pixel badge
//   (brand/companions/out acc/*, two frames swapped natively): magnifier, pencil, >_, globe,
//   branch, flask, a mini tile for a sub-agent, a "…" bubble when it thinks;
// - blocked: a "!" dot (theme blocked) that pops once; error: a cross dot (theme ansi1);
// - done: sparkles, once (510 ms), then idle;
// - a click: a small hop, once.
// One-shots (the pop, the sparkles, the hop, falling asleep) are single timer.after steps, never a
// repeating timer. state: Herdr's status or "error". action: herdr-bridge's { tool, what, at };
// null when it says no tool (it thinks); undefined without a bridge (Codex): no badge.
// since: when the state began (ms) if known, else the memo's first sight of it. size: the tile's
// width in css px (24 draws 24x20, 32 draws 32x32; height: o.height). memo: kept by the caller per
// agent. cx: the render's cx. at: draw as of that time, with no timers (previews).
// variant: a sub-agent's coiffe (#71, brand/companions out var/*), from variantFor(); a parent has none.
// It sits on the glyph's head, top left, and bobs with it: the same tile told apart at a glance.
// While kt-threads' option companion_style is "cube" (the default), companion() hands over to
// companion-cube.js (copy both files): pass the agent's terminal `address`, and for a bridge sub-agent its
// `parent` terminal; its coiffe's index becomes its rank.
import { div, image, svg } from "gpui-kit";
import { settings, theme, shared } from "herdr";
import { cube, cubeStyle } from "./companion-cube.js";

const ROOT = "brand/companions/out";
// <data> written by src/build.py from index.json: do not edit by hand
const DATA = {"accessory_grid":[10,10],"frame_ms":85,"timing":{"done_ms":440,"wave_ms":680,"sparkle_ms":510,"sleep_after_ms":600000},"accessories":{"read":{"frames":["acc/read-0","acc/read-1","acc/read-2"],"ms":255,"slot":"hand","mode":"loop","play":[0,1]},"edit":{"frames":["acc/edit-0","acc/edit-1","acc/edit-2"],"ms":170,"slot":"hand","mode":"loop","play":[0,1]},"bash":{"frames":["acc/bash-0","acc/bash-1"],"ms":425,"slot":"hand","mode":"loop","play":[0,1]},"web":{"frames":["acc/web-0","acc/web-1","acc/web-2","acc/web-3"],"ms":255,"slot":"hand","mode":"loop","play":[0,2]},"git":{"frames":["acc/git-0","acc/git-1","acc/git-2"],"ms":255,"slot":"hand","mode":"loop","play":[0,2]},"tests":{"frames":["acc/tests-0","acc/tests-1","acc/tests-2"],"ms":255,"slot":"hand","mode":"loop","play":[0,2]},"think":{"frames":["acc/think-0","acc/think-1","acc/think-2"],"ms":340,"slot":"head","mode":"loop","play":[0,2]},"zzz":{"frames":["acc/zzz-0","acc/zzz-1","acc/zzz-2"],"ms":595,"slot":"head","mode":"static","play":[2]},"bang":{"frames":["acc/bang-0","acc/bang-1"],"ms":340,"slot":"head","mode":"loop","play":[0,1]},"sparkle":{"frames":["acc/sparkle-0","acc/sparkle-1","acc/sparkle-2"],"ms":170,"slot":"head","mode":"loop","play":[1,2]},"agent-claude":{"frames":["acc/agent-claude-0","acc/agent-claude-1","acc/agent-claude-2"],"ms":255,"slot":"hand","mode":"loop","play":[1,2]},"agent-codex":{"frames":["acc/agent-codex-0","acc/agent-codex-1","acc/agent-codex-2"],"ms":255,"slot":"hand","mode":"loop","play":[1,2]}},"tools":{"Read":"read","Grep":"read","Glob":"read","Edit":"edit","MultiEdit":"edit","Write":"edit","NotebookEdit":"edit","Bash":"bash","WebFetch":"web","WebSearch":"web","Agent":"agent"},"tool_prefixes":{"mcp__tavily":"web","mcp__hyperbrowser":"web"},"bash_rules":[{"match":"^Run\\s+(git|gh|gwm)\\b","acc":"git"},{"match":"^Run\\s+.*\\b(test|tests|vitest|jest|pytest|phpunit|pest|playwright test|cargo (nextest|test)|go test|bun test|npm (run )?test|pnpm (run )?test|yarn test|make (test|check|ci))\\b","acc":"tests"}],"variants":{"grid":[9,7],"head":0.21,"list":["crown","cap","bow","sprout","wizard","beanie","halo","tophat","bird","flower"]}};
// </data>

const K = 1000; // the opacity ramps' steepness: a frame swap takes ms / 2001
const POP_MS = 30;
const HOP_MS = 160;

/** The badge for what a working agent does, by herdr-bridge's action, or null. */
export function badgeFor(action) {
  if (action === undefined) return null;
  if (action === null) return "think";
  const tool = String(action.tool ?? "");
  if (tool === "Bash") {
    const rule = DATA.bash_rules.find((r) => new RegExp(r.match).test(String(action.what ?? "")));
    return rule ? rule.acc : "bash";
  }
  return DATA.tools[tool] ?? Object.entries(DATA.tool_prefixes).find(([p]) => tool.startsWith(p))?.[1] ?? null;
}

// FNV-1a, 32 bits: the same key gives the same coiffe in every mod, every run.
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** A sub-agent's coiffe (#71): its key's hash picks one of the ten; if a sibling that started before it
 *  already wears that one, the next free one. `key`: `${parent terminal}:${id}` for herdr-bridge's
 *  sub-agents, the address for hc's. `siblings`: the parent's sub-agents' keys, oldest first (the
 *  bridge keeps its last 8: when the oldest goes, one wearing its own hash's coiffe keeps it; only one
 *  that had been pushed aside may change). */
export function variantFor(key, siblings = []) {
  if (key == null) return null;
  const L = DATA.variants.list;
  const taken = new Set();
  for (const k of siblings.includes(key) ? siblings : [...siblings, key]) {
    const h = hash(String(k));
    let i = h % L.length;
    for (let n = 1; n < L.length && taken.has(i); n++) i = (h + n) % L.length;
    if (k === key) return L[i];
    taken.add(i);
  }
  return null;
}

export function companion(o) {
  // the cube is an agent's (its terminal, or a bridge sub-agent's parent): a thread without a session, or a
  // shell, keeps the program's icon
  if (cubeStyle() === "cube" && (o.address || o.parent) && !o.program?.shell) {
    return cube({ ...o, rank: DATA.variants.list.includes(o.variant) ? DATA.variants.list.indexOf(o.variant) : undefined });
  }
  const t = theme();
  const p = o.program ?? {};
  const live = o.at == null;
  // kt-mods' option (kt-threads' mod.json): off, the tile stays still; the wake timer below is not an animation.
  const anim = live && shared("kt.opt.kt-threads.companion") !== false;
  const now = o.at ?? Date.now();
  const memo = o.memo ?? {};
  const id = o.id ?? p.key ?? "agent";
  if (memo.state !== o.state) {
    memo.state = o.state;
    memo.seen = now;
  }
  const since = o.since ?? memo.seen;
  const w = o.size ?? 24;
  const h = o.height ?? (w <= 24 ? 20 : w);
  const g = Math.round(h * 0.7); // the glyph, as the cards draw it (14 in 20)
  const dpr = o.dpr ?? 2;
  const k = w <= 24 ? 2 : 3; // badge PNG: device px per art px (10 art px: 10 css at 24, 15 at 32)
  const bs = (DATA.accessory_grid[0] * k) / dpr; // badge size, css px
  const tone = (o.dark ?? settings().dark ?? true) ? "dark" : "light";
  const src = (name) => `${ROOT}/${tone}/${name}@${k}x.png`;
  const T = DATA.timing;
  const wakes = [];

  // the body: the icon on its tile, centred; it bobs while working
  const glyph = p.icon ? (p.tint ? svg(p.icon).size(g).text_color(p.color ?? "#ffffff") : image(p.icon).w(g).h(g))
    : svg("mods/workspace-chrome/terminal.svg").size(g).text_color(t.muted);
  const top = Math.round((h - g) / 2);
  const bob = Math.max(1, Math.min(2, Math.round(h / 16 * 2) / 2));
  // a sub-agent's coiffe: on the glyph's head (DATA.variants.head down it), top left, moving with it
  const V = DATA.variants;
  const [cw, ch] = V.grid.map((n) => (n * k) / dpr);
  const hat = V.list.includes(o.variant)
    ? image(src(`var/${o.variant}`)).absolute().left(-(1 + k / dpr)).top(Math.round(g * V.head) - ch + k / dpr).w(cw).h(ch)
    : null;
  const icon = div().id(`${id}-icon`).absolute().left(Math.round((w - g) / 2)).top(top).w(g).h(g)
    .when(o.state === "working" && anim, (el) => el.loop("top", { from: top, to: top - bob, period: 900, easing: "ease-in-out" }))
    .child(glyph)
    .when(Boolean(hat), (el) => el.child(hat));
  const tileEl = div().absolute().left(0).top(0).w(w).h(h).rounded(Math.round(h * 0.3)).border(1).border_color("#00000033")
    .bg(p.tile ?? t.raised).child(icon);

  // the corner marks
  const dot = Math.max(8, Math.round(h * 0.42));
  const mark = (key, bg, text, pulse) => {
    const full = !pulse || !live || now - memo.popAt >= POP_MS;
    const s = full ? dot : Math.round(dot * 0.4);
    return div().id(`${id}-${key}`).absolute().right(-1).top(-1).w(s).h(s).rounded_full().bg(bg)
      .border(1).border_color(t.background).flex().items_center().justify_center()
      .when(pulse && anim, (el) => el.spring("width", { response: 420, damping: 0.35 }).spring("height", { response: 420, damping: 0.35 }))
      .child(div().text_size(Math.round(dot * 0.8)).font_weight(800).line_height(`${dot}px`).text_color(t.background).child(full ? text : ""));
  };
  let corner = null;
  let badge = null;
  if (o.state === "blocked") {
    if (memo.popFor !== since) {
      memo.popFor = since;
      memo.popAt = now;
    }
    corner = mark("bang", t.blocked, "!", true);
    wakes.push(memo.popAt + POP_MS);
  } else if (o.state === "error") {
    corner = mark("cross", t.ansi1, "×", false);
  } else if (o.state === "done" && now - since < T.sparkle_ms) {
    const C = DATA.accessories.sparkle;
    const i = Math.min(C.frames.length - 1, Math.floor((now - since) / C.ms));
    corner = div().absolute().right(-2).top(-2).w(bs).h(bs).child(image(src(C.frames[i])).w(bs).h(bs));
    wakes.push(since + (i + 1) * C.ms);
  } else if (o.state !== "working" && o.state !== "blocked" && now - since >= T.sleep_after_ms) {
    corner = div().absolute().right(1).top(-1).text_size(Math.round(h * 0.45)).font_weight(700)
      .text_color(t.muted).child("z");
  } else if (o.state !== "working") {
    wakes.push(since + T.sleep_after_ms);
  }
  if (o.state === "working") {
    const name = badgeFor(o.action && o.action.at && o.action.at < since ? null : o.action);
    if (name === "agent") {
      // a sub-agent: a mini tile of the same program
      const m = Math.round(h * 0.5);
      badge = div().absolute().right(-1).bottom(-1).w(m).h(m).rounded(Math.round(m * 0.3)).border(1).border_color(t.background)
        .bg(p.tile ?? t.raised).flex().items_center().justify_center()
        .child(p.icon ? (p.tint ? svg(p.icon).size(Math.round(m * 0.66)).text_color(p.color ?? "#ffffff") : image(p.icon).w(Math.round(m * 0.66)).h(Math.round(m * 0.66))) : div());
    } else if (name && DATA.accessories[name]) {
      const C = DATA.accessories[name];
      badge = div().absolute().right(-1).bottom(-1).w(bs).h(bs).child(swap(C, src, bs, `${id}-${name}`, anim));
    }
  }

  // a click: a hop, once
  const hopping = memo.hopAt != null && now - memo.hopAt < HOP_MS;
  if (hopping) wakes.push(memo.hopAt + HOP_MS);
  const wake = Math.min(...wakes.filter((x) => x > now));
  if (live && o.cx && Number.isFinite(wake) && memo.wake !== wake) {
    memo.wake = wake;
    o.cx.timer.after(Math.ceil(wake - now) + 5, (cx) => cx.notify());
  }
  return div().id(`companion-${id}`).relative().w(w).h(h).flex_none().cursor_pointer()
    .top(hopping ? -3 : 0).transition("top", { duration: hopping ? 90 : HOP_MS, easing: "ease-out" })
    .on_click((e, cx) => {
      memo.hopAt = Date.now();
      memo.wake = null;
      o.onClick?.(e, cx);
      cx.notify();
    })
    .child(tileEl)
    .when(Boolean(badge), (el) => el.child(badge))
    .when(Boolean(corner), (el) => el.child(corner));
}

// Two frames swapped natively: an opacity square wave each, in opposite phases. Still: the first.
function swap(C, src, s, id, live) {
  const a = image(src(C.frames[C.play[0]])).w(s).h(s);
  if (!live || C.mode !== "loop" || C.play.length < 2) return a;
  const b = image(src(C.frames[C.play[1]])).w(s).h(s);
  const wave = (up) => ({ from: up ? -K : K + 1, to: up ? K + 1 : -K, period: 2 * C.ms, easing: "linear" });
  return div().relative().w(s).h(s)
    .child(div().id(`${id}-a`).absolute().left(0).top(0).loop("opacity", wave(false)).child(a))
    .child(div().id(`${id}-b`).absolute().left(0).top(0).loop("opacity", wave(true)).child(b));
}
