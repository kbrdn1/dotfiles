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
// The strip: the column's width (read by on_size_change; Clawd keeps to its left 96 px, the LED cube runs
// along it, cubeMove()), 36 tall for Clawd, 56 for the LED cube (bandH()). kt-chat owns its place: a
// box first in the composer's flow, between the transcript and the rest of the composer, so nothing
// overlaps it (keepBottom keeps a followed view at
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
// The strip's height. Clawd's (and a program's companion): the tallest pose (30, standing: idle, look, done,
// error; his jump stays inside it) on GROUND, and 4 px over his head (Kylian, 2026-11-20: 56 left 24 px of
// nothing over him, 38 while he types; with working()'s pb 4, « … travaille » is 35 px above him typing, 21
// standing). The LED cube (kt-threads' option, the default) keeps 56: it fills the strip (S = H - GROUND).
const W = 96, H_CLAWD = 36, H_CUBE = 56;
export const bandH = () => (cubeStyle() === "cube" ? H_CUBE : H_CLAWD);
const LEFT = 8, GROUND = 2; // where his standing feet sit: from the strip's left, above its bottom
const K = 1000; // the opacity ramps' steepness, as companion.js: a swap takes ms / 2001

/** kt-chat's place for the runner: a box in the composer's flow, never absolute (nothing above or under it),
 *  the column's whole width (Kylian, 2026-11-20: the companion uses the room it is given). */
export function runnerBand(runner) {
  return div().flex_none().w_full().h(bandH()).child(runner);
}

/** Where the cube goes along the band for a state (css px from the strip's left), and how it moves there.
 *  span: the room it travels (the band's width less its margins and its own size). Native motion only:
 *  working: back and forth across the band (.loop on left, ~70 px/s), starting from the side it stands on;
 *  blocked: back home on the left, hopping in place (.loop on top) while it waits; done: off to the right
 *  end, and it stays there; idle, error: home on the left, still. Reduced motion, or no width yet: home. */
export function cubeMove(status, span, reduced, from = LEFT) {
  if (reduced || !(span > 0)) return { left: LEFT };
  const right = LEFT + span;
  if (status === "working") {
    const back = from > LEFT + span / 2;
    return { left: back ? right : LEFT, loop: { from: back ? right : LEFT, to: back ? LEFT : right, period: Math.max(4000, Math.round((2 * span / 70) * 1000)), easing: "ease-in-out" } };
  }
  if (status === "done") return { left: right, transition: { duration: 700, easing: "ease-out" } };
  if (status === "blocked") return { left: LEFT, transition: { duration: 400, easing: "ease-out" }, hop: { from: 0, to: -3, period: 700, easing: "ease-in-out" } };
  return { left: LEFT, transition: { duration: 900, easing: "ease-in-out" } };
}

/** The strip for one state: a function of its inputs, so a test mod can draw it without the view.
 *  reduced: kt.reducedMotion, as motion.js's frame() reads it (one pose, still). seed: the view's chance.
 *  width: the strip's width (the view's on_size_change, never written in); onWidth(w, cx): a new width. */
export function draw({ p, clawd, memo, now, reduced, seed, cx, width = null, onWidth = null }) {
  const H = bandH();
  const strip = div().id("kc-runner").relative().w_full().h(H)
    .when(Boolean(onWidth), (el) => el.on_size_change((size, cx) => onWidth(size.width, cx)));
  // the cube style (kt-threads' option, the default): the agent's LED cube in 3/4 runs along the strip, for
  // every program and every state, idle included (runnerShown's cube case)
  if (cubeStyle() === "cube") {
    if (!runnerShown(p.status, p.program, true)) return strip;
    const S = H - GROUND, span = width == null ? 0 : width - 2 * LEFT - S;
    const m = cubeMove(p.status, span, reduced, memo.cubeLeft);
    memo.cubeLeft = m.left;
    let mover = div().id(`kc-runner-move-${p.terminal}`).absolute().left(m.left).top(0).w(S).h(S);
    if (m.loop) mover = mover.loop("left", m.loop);
    else if (m.transition) mover = mover.transition("left", m.transition);
    const body = cube34({ state: p.status, since: p.since, size: S, height: S, id: `kc-runner-${p.terminal}`, address: p.terminal, memo, cx });
    return strip.child(mover.child(m.hop ? div().id(`kc-runner-hop-${p.terminal}`).relative().loop("top", m.hop).child(body) : body));
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
    return draw({ p: this.p, clawd: this.clawd, memo: this.memo, now: Date.now(), reduced: Boolean(shared("kt.reducedMotion")), seed: this.seed, cx,
      width: this.width ?? null, onWidth: (w, cx) => { if (w !== this.width) { this.width = w; cx.notify(); } } });
  }
}
