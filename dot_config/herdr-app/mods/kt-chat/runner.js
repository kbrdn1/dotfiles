// The runner above the Chat composer (piste A, #86 follow-up): Clawd does what the agent does (types,
// reads with his magnifier, glances around while it thinks or waits, jumps once when done, then rests and
// looks around now and then), a variant drawn by chance every few seconds (runner-plan.js); the program's
// companion (companion.js) without him.
// A retained nested view: kt-chat makes it once (`cx.new(Runner)` in init), mounts it when runnerShown(),
// and hands it runnerProps() ({ terminal, status, program, action, since }) with set_props from a task.
// Its own renders (a state change, the jump's one cue, one per epoch while the agent works or waits) never
// render kt-chat (measured: 201 renders of a nested view for 8 of its parent). companion.js is a copy of
// brand/companions/companion.js (kt-mods' SHARED; src/build.py writes its data and refreshes the copies).
//
// The strip: 96 x 56 css px. kt-chat owns its place: a 96 x 56 box first in the composer's flow, between
// the transcript and the rest of the composer, so nothing overlaps it (keepBottom keeps a followed view at
// the bottom when it comes and goes); it comes in with kt-chat's rise() (motion.js enter(): fades in and
// rises, in a box that clips). The runner fills that box and has no handler.
import { View, div, image } from "gpui-kit";
import { appHome, shared, checking } from "herdr";
import * as fs from "fs/promises";
import { companion, accessoryFor, once } from "./companion.js";
import { cube34, cubeStyle } from "./companion-cube.js";
import { plan, runnerShown, runnerProps, keepBottom, freshAction, glanceLoops, doneAt, keyOf, CLAWD_POSES } from "./runner-plan.js";

export { runnerShown, runnerProps, keepBottom };

const DIR = "data/companions/clawd"; // written by brand/companions/clawd/extract.mjs, never in a repo
const W = 96, H = 56; // the strip
const LEFT = 8, GROUND = 2; // where his standing feet sit: from the strip's left, above its bottom
const K = 1000; // the opacity ramps' steepness, as companion.js: a swap takes ms / 2001

/** kt-chat's place for the runner: a box in the composer's flow, never absolute (nothing above or under it). */
export function runnerBand(runner) {
  return div().flex_none().w(W).h(H).child(runner);
}

/** The strip for one state: a function of its inputs, so a test mod can draw it without the view.
 *  reduced: kt.reducedMotion, as motion.js's frame() reads it (one pose, still). seed: the view's chance. */
export function draw({ p, clawd, memo, now, reduced, seed, cx }) {
  const strip = div().id("kc-runner").relative().w(W).h(H);
  // the cube style (kt-threads' option, the default): the agent's LED cube in 3/4 stands in the strip, for
  // every program and every state, idle included (runnerShown's cube case)
  if (cubeStyle() === "cube") {
    if (!runnerShown(p.status, p.program, true)) return strip;
    const S = H - GROUND;
    return strip.child(div().absolute().left(LEFT).top(0)
      .child(cube34({ state: p.status, since: p.since, size: S, height: S, id: `kc-runner-${p.terminal}`, address: p.terminal, memo, cx })));
  }
  const key = keyOf(p.program);
  const pl = plan({ ...p, acc: accessoryFor(freshAction(p.action, p.since), key), reduced, clawd, now, seed });
  if (!pl) return strip;
  if (pl.who === "companion") {
    return strip.child(div().absolute().left(LEFT).top(H - GROUND - 16)
      .child(companion({ program: p.program, state: p.status, action: p.action, since: p.since, now, size: 24, id: `kc-runner-${p.terminal}`, memo, cx })));
  }
  // one timer per wake (the next epoch, while the agent works or waits), even if kt-chat hands new props meanwhile
  if (pl.wake != null && cx && !checking() && memo.runnerWake !== pl.wake) {
    memo.runnerWake = pl.wake;
    cx.timer.after(Math.max(16, pl.wake - now), (cx) => cx.notify());
  }
  const pose = (name) => {
    const m = clawd.poses[name];
    return image(`${DIR}/${name}@2x.png`).absolute().left(LEFT - m.anchor[0]).top(H - GROUND - m.anchor[1]).w(m.size[0]).h(m.size[1]);
  };
  const layer = (id) => div().id(id).absolute().left(0).top(0).size_full();
  // ids carry the mood and the variant: a new draw starts its loops afresh, in phase with each other
  const tag = `kc-runner-${pl.mood}-${pl.variant}`;
  let base = layer(tag);
  if (pl.poses.length === 1) base = base.child(pose(pl.poses[0]));
  else {
    // two poses stacked, each shown half the time by an opacity square wave in opposite phases
    const wave = (up) => ({ from: up ? -K : K + 1, to: up ? K + 1 : -K, period: 2 * pl.ms, easing: "linear" });
    const [a, b] = pl.poses;
    base = base.child(layer(`${tag}-a`).loop("opacity", wave(false)).child(pose(a)))
      .child(layer(`${tag}-b`).loop("opacity", wave(true)).child(pose(b)));
  }
  let scene = base;
  if (pl.glance) {
    // a glance: its pose up a moment in the middle of each period, the rest down meanwhile (two windows)
    const g = glanceLoops(pl.glance.every, pl.glance.for);
    scene = layer(`${tag}-scene`).child(base.loop("opacity", g.hide)).child(layer(`${tag}-glance`).loop("opacity", g.show).child(pose(pl.glance.pose)));
  }
  if (!pl.jump) return strip.child(scene);
  // the jump of « fini », once and natively (companion.js once(): no timer steps it), then the scene
  const j = pl.jump, jid = `kc-runner-jump-${j.at}`;
  return strip.child(once(jid, j.poses.map((n) => layer(`${jid}-${n}`).child(pose(n))), j.ms, scene, memo, W, H));
}

export class Runner extends View {
  init(props, cx) {
    this.p = { ...(props ?? {}), doneAt: null };
    this.memo = {}; // companion.js's, for the fallback; runnerWake, the pending wake
    this.seed = (Math.random() * 2 ** 31) >>> 0; // this copy's chance (a check injects its own)
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
    return draw({ p: this.p, clawd: this.clawd, memo: this.memo, now: Date.now(), reduced: Boolean(shared("kt.reducedMotion")), seed: this.seed, cx });
  }
}
