// The runner above the Chat composer (piste A, #86 follow-up): Clawd types, reads with his magnifier,
// glances around when blocked, jumps once when done; the program's companion (companion.js) without him.
// A retained nested view: kt-chat makes it once (`cx.new(Runner)` in init), mounts it when runnerShown(),
// and hands it runnerProps() ({ terminal, status, program, action, since }) with set_props from a task.
// Its own renders (a state change, the four steps of the jump) never render kt-chat (measured: 201 renders
// of a nested view for 8 of its parent). companion.js is a copy of brand/companions/companion.js (kt-mods'
// SHARED; src/build.py writes its data and refreshes the copies).
//
// The strip: 96 x 56 css px. kt-chat owns its place: a 96 x 56 box first in the composer's flow, between
// the transcript and the rest of the composer, so nothing overlaps it (keepBottom keeps a followed view at
// the bottom when it comes and goes). The runner fills that box and has no handler.
import { View, div, image } from "gpui-kit";
import { appHome, shared, checking } from "herdr";
import * as fs from "fs/promises";
import { companion, accessoryFor } from "./companion.js";
import { plan, runnerShown, runnerProps, keepBottom, doneAt, keyOf, CLAWD_POSES } from "./runner-plan.js";

export { runnerShown, runnerProps, keepBottom };

const DIR = "data/companions/clawd"; // written by brand/companions/clawd/extract.mjs, never in a repo
const W = 96, H = 56; // the strip
const LEFT = 8, GROUND = 2; // where his standing feet sit: from the strip's left, above its bottom
const K = 1000; // the opacity ramps' steepness, as companion.js: a swap takes ms / 2001

/** kt-chat's place for the runner: a box in the composer's flow, never absolute (nothing above or under it). */
export function runnerBand(runner) {
  return div().flex_none().w(W).h(H).child(runner);
}

/** The strip for one state: a function of its inputs, so a test mod can draw it without the view. */
export function draw({ p, clawd, memo, now, reduced, cx }) {
  const key = keyOf(p.program);
  const pl = plan({ ...p, acc: accessoryFor(p.action, key), reduced, clawd, now });
  const strip = div().id("kc-runner").relative().w(W).h(H);
  if (!pl) return strip;
  if (pl.who === "companion") {
    return strip.child(div().absolute().left(LEFT).top(H - GROUND - 16)
      .child(companion({ program: p.program, state: p.status, action: p.action, since: p.since, size: 24, id: `kc-runner-${p.terminal}`, memo, cx })));
  }
  // one timer per step of the jump, even if kt-chat hands new props mid-jump (companion.js's guard)
  if (pl.wake != null && cx && !checking() && memo.runnerWake !== pl.wake) {
    memo.runnerWake = pl.wake;
    cx.timer.after(Math.max(16, pl.wake - now), (cx) => cx.notify());
  }
  const pose = (name) => {
    const m = clawd.poses[name];
    return image(`${DIR}/${name}@2x.png`).absolute().left(LEFT - m.anchor[0]).top(H - GROUND - m.anchor[1]).w(m.size[0]).h(m.size[1]);
  };
  if (pl.poses.length === 1) return strip.child(pose(pl.poses[0]));
  // two poses stacked, each shown half the time by an opacity square wave in opposite phases
  const wave = (up) => ({ from: up ? -K : K + 1, to: up ? K + 1 : -K, period: 2 * pl.ms, easing: "linear" });
  const [a, b] = pl.poses;
  return strip
    .child(div().id(`kc-runner-${a}`).absolute().left(0).top(0).size_full().loop("opacity", wave(false)).child(pose(a)))
    .child(div().id(`kc-runner-${b}`).absolute().left(0).top(0).size_full().loop("opacity", wave(true)).child(pose(b)));
}

export class Runner extends View {
  init(props, cx) {
    this.p = { ...(props ?? {}), doneAt: null };
    this.memo = {}; // companion.js's, for the fallback
    this.clawd = null;
    if (checking()) return;
    cx.spawn(async (cx) => {
      const m = await fs.readFile(`${appHome()}/${DIR}/manifest.json`, "utf8").then(JSON.parse).catch(() => null);
      this.clawd = m?.complete && CLAWD_POSES.every((name) => m.poses?.[name]) ? m : null;
      if (this.clawd) cx.notify();
    });
  }

  update(props) {
    const next = props ?? {};
    this.p = { ...next, doneAt: doneAt(this.p, next, Date.now()) };
  }

  render(cx) {
    return draw({ p: this.p, clawd: this.clawd, memo: this.memo, now: Date.now(), reduced: Boolean(shared("kt.reducedMotion")), cx });
  }
}
