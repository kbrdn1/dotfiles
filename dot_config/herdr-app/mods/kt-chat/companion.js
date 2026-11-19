// Companions for Herdr mods: copy this file into a mod and import it.
//
//   import { companion } from "./companion.js";
//   companion({ program: agent.program, state: agent.status, action: live?.action ?? null,
//               since: live?.since, size: 32, id: agent.address, memo: this.memos[agent.address] ??= {},
//               cx, onClick: (e, cx) => {} })
//
// Returns a gpui element: the program's companion (brand/companions/out/*.png, original pixel
// characters) in the state it is in, holding what it does, or the program's logo when it has none.
// - state: Herdr's status (working, blocked, done, idle) or "error". action: herdr-bridge's
//   { tool, what, at } while working; null when the bridge says no tool (it thinks); undefined when
//   there is no bridge (Codex): the body works with nothing in hand.
// - since: when the state began (ms), if known (herdr-bridge's since); else the first time this
//   memo saw the state. Herdr gives no time for done or blocked: the memo is what keeps it.
// - memo: an object the caller keeps per companion (per agent); cx: the render's cx, to schedule
//   the next step of a one-shot (the done celebration, the wave) and the fall asleep after 10 min.
// - size: the tile's width in css px (24 draws 21x16, 32 draws 31.5x24): the PNG is picked so one
//   image pixel is one screen pixel, never scaled. dpr: the screen scale, 2 by default.
// What moves: working and blocked swap two frames natively (no script, no timer); done and a
// click's wave play once in under a second (a short timer.after chain); idle, asleep and error
// are still.
import { div, image, svg } from "gpui-kit";
import { settings, theme } from "herdr";

const ROOT = "brand/companions/out";
// <data> written by src/build.py from index.json: do not edit by hand
const DATA = {"v":1,"grid":[21,16],"accessory_grid":[10,10],"scales":[1,2,3,4],"frame_ms":85,"themes":["dark","light"],"slots":{"hand":[11,6],"head":[11,0]},"timing":{"done_ms":440,"wave_ms":680,"sparkle_ms":510,"sleep_after_ms":600000},"programs":{"claude":{"name":"Ember","kind":"companion","anims":{"idle":{"frames":["claude/idle-0","claude/idle-1"],"ms":900,"mode":"static","play":[0]},"sleep":{"frames":["claude/sleep-0","claude/sleep-1"],"ms":1190,"mode":"static","play":[0]},"working":{"frames":["claude/working-0","claude/working-1"],"ms":255,"mode":"loop","play":[0,1]},"blocked":{"frames":["claude/blocked-0","claude/blocked-1"],"ms":340,"mode":"loop","play":[0,1]},"done":{"frames":["claude/done-0","claude/done-1","claude/done-2","claude/done-3"],"ms":110,"mode":"once","play":[0,1,2,3]},"error":{"frames":["claude/error-0","claude/error-1"],"ms":170,"mode":"static","play":[0]},"wave":{"frames":["claude/wave-0","claude/wave-1","claude/wave-2","claude/wave-3"],"ms":170,"mode":"once","play":[0,1,2,3]}},"agent":"agent-claude"},"codex":{"name":"Prompt","kind":"companion","anims":{"idle":{"frames":["codex/idle-0","codex/idle-1"],"ms":900,"mode":"static","play":[0]},"sleep":{"frames":["codex/sleep-0","codex/sleep-1"],"ms":1190,"mode":"static","play":[0]},"working":{"frames":["codex/working-0","codex/working-1"],"ms":255,"mode":"loop","play":[0,1]},"blocked":{"frames":["codex/blocked-0","codex/blocked-1"],"ms":340,"mode":"loop","play":[0,1]},"done":{"frames":["codex/done-0","codex/done-1","codex/done-2","codex/done-3"],"ms":110,"mode":"once","play":[0,1,2,3]},"error":{"frames":["codex/error-0","codex/error-1"],"ms":170,"mode":"static","play":[0]},"wave":{"frames":["codex/wave-0","codex/wave-1","codex/wave-2","codex/wave-3"],"ms":170,"mode":"once","play":[0,1,2,3]}},"agent":"agent-codex"}},"accessories":{"read":{"frames":["acc/read-0","acc/read-1","acc/read-2"],"ms":255,"slot":"hand","mode":"loop","play":[0,1]},"edit":{"frames":["acc/edit-0","acc/edit-1","acc/edit-2"],"ms":170,"slot":"hand","mode":"loop","play":[0,1]},"bash":{"frames":["acc/bash-0","acc/bash-1"],"ms":425,"slot":"hand","mode":"loop","play":[0,1]},"web":{"frames":["acc/web-0","acc/web-1","acc/web-2","acc/web-3"],"ms":255,"slot":"hand","mode":"loop","play":[0,2]},"git":{"frames":["acc/git-0","acc/git-1","acc/git-2"],"ms":255,"slot":"hand","mode":"loop","play":[0,2]},"tests":{"frames":["acc/tests-0","acc/tests-1","acc/tests-2"],"ms":255,"slot":"hand","mode":"loop","play":[0,2]},"think":{"frames":["acc/think-0","acc/think-1","acc/think-2"],"ms":340,"slot":"head","mode":"loop","play":[0,2]},"zzz":{"frames":["acc/zzz-0","acc/zzz-1","acc/zzz-2"],"ms":595,"slot":"head","mode":"static","play":[2]},"bang":{"frames":["acc/bang-0","acc/bang-1"],"ms":340,"slot":"head","mode":"loop","play":[0,1]},"sparkle":{"frames":["acc/sparkle-0","acc/sparkle-1","acc/sparkle-2"],"ms":170,"slot":"head","mode":"loop","play":[1,2]},"agent-claude":{"frames":["acc/agent-claude-0","acc/agent-claude-1","acc/agent-claude-2"],"ms":255,"slot":"hand","mode":"loop","play":[1,2]},"agent-codex":{"frames":["acc/agent-codex-0","acc/agent-codex-1","acc/agent-codex-2"],"ms":255,"slot":"hand","mode":"loop","play":[1,2]}},"state_accessory":{"blocked":"bang","done":"sparkle","sleep":"zzz"},"tools":{"Read":"read","Grep":"read","Glob":"read","Edit":"edit","MultiEdit":"edit","Write":"edit","NotebookEdit":"edit","Bash":"bash","WebFetch":"web","WebSearch":"web","Agent":"agent"},"tool_prefixes":{"mcp__tavily":"web","mcp__hyperbrowser":"web"},"bash_rules":[{"match":"^Run\\s+(git|gh|gwm)\\b","acc":"git"},{"match":"^Run\\s+.*\\b(test|tests|vitest|jest|pytest|phpunit|pest|playwright test|cargo (nextest|test)|go test|bun test|npm (run )?test|pnpm (run )?test|yarn test|make (test|check|ci))\\b","acc":"tests"}]};
// </data>

const K = 1000; // the opacity ramps' steepness: a frame swap takes ms / 2001

/** The accessory for what a working agent does, by herdr-bridge's action, or null. */
export function accessoryFor(action, key) {
  if (action === undefined) return null;
  if (action === null) return "think";
  const tool = String(action.tool ?? "");
  if (tool === "Bash") {
    const rule = DATA.bash_rules.find((r) => new RegExp(r.match).test(String(action.what ?? "")));
    return rule ? rule.acc : "bash";
  }
  const acc = DATA.tools[tool] ?? Object.entries(DATA.tool_prefixes).find(([p]) => tool.startsWith(p))?.[1] ?? null;
  return acc === "agent" ? `agent-${key}` : acc;
}

/** What it shows now: { anim, acc, start } (start: when a one-shot began). */
export function pick({ key, state, action, since, now, memo }) {
  const t = DATA.timing;
  if (memo.waveAt && now - memo.waveAt < t.wave_ms) return { anim: "wave", acc: null, start: memo.waveAt };
  if (state === "error") return { anim: "error", acc: null };
  if (state === "blocked") return { anim: "blocked", acc: "bang" };
  if (state === "done" && now - since < t.done_ms) return { anim: "done", acc: "sparkle", start: since };
  if (state === "working") {
    // an action from before this turn is over: it thinks
    const fresh = action && (!action.at || action.at >= since) ? action : action === undefined ? undefined : null;
    return { anim: "working", acc: accessoryFor(fresh, key) };
  }
  if (now - since >= t.sleep_after_ms) return { anim: "sleep", acc: "zzz" };
  return { anim: "idle", acc: null };
}

export function companion(o) {
  const key = typeof o.program === "string" ? o.program : o.program?.key;
  const P = DATA.programs?.[key];
  const now = o.now ?? Date.now();
  const memo = o.memo ?? {};
  const id = o.id ?? key;
  if (!P) return logo(o, key, id);
  if (memo.state !== o.state) {
    memo.state = o.state;
    memo.seen = now;
  }
  const since = o.since ?? memo.seen;
  const dpr = o.dpr ?? 2;
  const k = Math.min(4, Math.max(1, Math.floor(((o.size ?? 32) * dpr) / DATA.grid[0])));
  const s = k / dpr; // css px per art pixel
  const tone = (o.dark ?? settings().dark ?? true) ? "dark" : "light";
  const src = (name) => `${ROOT}/${tone}/${name}@${k}x.png`;
  const { anim, acc, start } = pick({ key, state: o.state, action: o.action, since, now, memo });

  const A = P.anims[anim];
  const [bw, bh] = DATA.grid;
  const [aw, ah] = DATA.accessory_grid;
  let body;
  let wake = null; // when to draw again: the next step of a one-shot, or falling asleep
  if (A.mode === "once") {
    const i = Math.min(A.play.length - 1, Math.max(0, Math.floor((now - start) / A.ms)));
    body = frame(src(A.frames[A.play[i]]), bw * s, bh * s);
    wake = start + (i + 1) * A.ms;
    if (i === A.play.length - 1) wake = start + A.play.length * A.ms;
  } else {
    body = layer(A, src, bw * s, bh * s, `${id}-${anim}`);
    if (anim === "idle") wake = since + DATA.timing.sleep_after_ms;
  }
  let held = null;
  if (acc && DATA.accessories[acc]) {
    const C = DATA.accessories[acc];
    const [sx, sy] = DATA.slots[C.slot];
    // an accessory moves only while its body does (working, blocked, the done celebration)
    const still = anim === "sleep" || anim === "idle" || anim === "error";
    held = div().absolute().left(sx * s).top(sy * s).w(aw * s).h(ah * s)
      .child(still ? frame(src(C.frames[C.play[0]]), aw * s, ah * s) : layer(C, src, aw * s, ah * s, `${id}-${acc}`));
  }
  if (wake != null && o.cx && memo.wake !== wake && wake > now) {
    memo.wake = wake;
    o.cx.timer.after(Math.ceil(wake - now) + 5, (cx) => cx.notify());
  }
  return div().id(`companion-${id}`).relative().w(bw * s).h(bh * s).flex_none().cursor_pointer()
    .on_click((e, cx) => {
      memo.waveAt = Date.now();
      memo.wake = null;
      o.onClick?.(e, cx);
      cx.notify();
    })
    .child(body)
    .when(Boolean(held), (el) => el.child(held));
}

// One image, drawn at one image pixel per screen pixel.
function frame(path, w, h) {
  return image(path).absolute().left(0).top(0).w(w).h(h);
}

// A loop: its two frames stacked, each shown half the time by an opacity square wave in opposite
// phases (native, about 30 redraws a second while shown). A static one: its frame.
function layer(L, src, w, h, id) {
  if (L.mode !== "loop" || L.play.length < 2) return frame(src(L.frames[L.play[0]]), w, h);
  const wave = (up) => ({ from: up ? -K : K + 1, to: up ? K + 1 : -K, period: 2 * L.ms, easing: "linear" });
  return div().absolute().left(0).top(0).w(w).h(h)
    .child(div().id(`${id}-a`).absolute().left(0).top(0).w(w).h(h).loop("opacity", wave(false)).child(frame(src(L.frames[L.play[0]]), w, h)))
    .child(div().id(`${id}-b`).absolute().left(0).top(0).w(w).h(h).loop("opacity", wave(true)).child(frame(src(L.frames[L.play[1]]), w, h)));
}

// No companion: the program's icon (herdr.d.ts Program), tinted when it is a one-color glyph.
function logo(o, key, id) {
  const p = typeof o.program === "object" ? o.program : null;
  const icon = p?.icon ?? `icons/${key}.svg`;
  const size = Math.round((o.size ?? 32) * 0.7);
  const glyph = p?.tint ? svg(icon).size(size).text_color(o.color ?? theme().foreground) : image(icon).w(size).h(size);
  return div().id(`companion-${id}`).w(o.size ?? 32).h(Math.round((o.size ?? 32) * 0.75)).flex_none()
    .flex().items_center().justify_center()
    .on_click((e, cx) => o.onClick?.(e, cx))
    .child(glyph);
}
