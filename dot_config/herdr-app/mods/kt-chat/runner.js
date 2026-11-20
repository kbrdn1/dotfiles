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
import { sceneOf, cubeMove, TABLE } from "./scene.js";
import { plan, runnerShown, runnerProps, keepBottom, freshAction, glanceLoops, doneAt, keyOf, CLAWD_POSES } from "./runner-plan.js";

export { runnerShown, runnerProps, keepBottom };

const DIR = "data/companions/clawd"; // written by brand/companions/clawd/extract.mjs, never in a repo
// The strip's height. Clawd's (and a program's companion): the tallest pose (30, standing: idle, look, done,
// error; his jump stays inside it) on GROUND, and 4 px over his head (Kylian, 2026-11-20: 56 left 24 px of
// nothing over him, 38 while he types; with working()'s pb 4, « … travaille » is 35 px above him typing, 21
// standing). The LED cube's scene (kt-threads' option, the default) takes 36 too (the lead, 2026-11-20): a cube
// of 28 and its accessories beside it (cubeScene()).
const W = 96, H_CLAWD = 36, H_CUBE = 36;
export const bandH = () => (cubeStyle() === "cube" ? H_CUBE : H_CLAWD);
const LEFT = 8, GROUND = 2; // where his standing feet sit: from the strip's left, above its bottom
const K = 1000; // the opacity ramps' steepness, as companion.js: a swap takes ms / 2001

/** kt-chat's place for the runner: a box in the composer's flow, never absolute (nothing above or under it),
 *  the column's whole width (Kylian, 2026-11-20: the companion uses the room it is given). */
export function runnerBand(runner) {
  return div().flex_none().w_full().h(bandH()).child(runner);
}

export { cubeMove };

// The scene (cube style): the real cube, 28 px in the 36 px band (its body about the page's 26: the
// accessories keep the validated scale), the accessories beside it (src/scene.mjs: 120 x 36 images whose cube
// stood at x 10, so they lie at -8 from the cube's box), RESERVE px kept on the right for what they reach.
const CUBE = 28, ACC_X = -8, ACC_W = 120, RESERVE = 80;
const ACC = "brand/companions/cube/acc";
const wave = (up, ms) => ({ from: up ? -K : K + 1, to: up ? K + 1 : -K, period: 2 * ms, easing: "linear" });

/** An accessory: its frames swapped natively (two: opposite square waves; three: windows of one triangle),
 *  shown at once or after the walk (a delay armed by one cue, as companion.js' once()), and its fly once per
 *  beat (a left transition from its place, fading at the end). */
function accessory(act, T, sc, ctx) {
  const { tid, reduced, memo } = ctx;
  const id = (k) => `kc-acc-${act}-${k}-${tid}`;
  const layer = (k) => div().id(id(k)).absolute().left(0).top(0).w(ACC_W).h(36);
  const img = (k) => image(`${ACC}/${act}-${k}.svg`).w(ACC_W).h(36);
  let frames;
  if (T.n === 1 || reduced || !T.ms) frames = [layer("f0").child(img(0))];
  else if (T.n === 2) frames = [layer("a").loop("opacity", wave(false, T.ms)).child(img(0)), layer("b").loop("opacity", wave(true, T.ms)).child(img(1))];
  else {
    const period = 2 * T.n * T.ms;
    frames = Array.from({ length: T.n }, (_, k) => layer(`w${k}`).loop("opacity", { from: (-K * k) / T.n, to: K * (1 - k / T.n), period, easing: "linear" })
      .child(layer(`w${k}-in`).loop("opacity", { from: (K * (k + 1)) / T.n, to: K * ((k + 1) / T.n - 1), period, easing: "linear" }).child(img(k))));
  }
  // one-shots of this beat: the accessory after the walk, the fly (armed by one cue: the first layout)
  const key = `${act}-${sc.epoch ?? "s"}`;
  memo.armed ??= {};
  const armed = Boolean(memo.armed[key]);
  const cue = (el) => (armed || reduced ? el : el.on_size_change((_s, cx) => { if (memo.armed[key]) return; memo.armed = { [key]: true }; cx.notify(); }));
  const late = typeof sc.show === "number" && !reduced;
  let el = cue(div().id(id(`box-${key}`)).absolute().left(ACC_X).top(0).w(ACC_W).h(36))
    .when(late, (e) => e.opacity(armed ? 1 : 0).transition("opacity", { duration: 200, delay: sc.show, easing: "linear" }))
    .children(frames);
  if (T.fly && !reduced) {
    const d = T.fly.ms;
    el = el.child(div().id(id(`fly-${key}`)).absolute().top(0).w(ACC_W).h(36).left(armed ? T.fly.dx : 0).opacity(armed ? 0 : 1)
      .transition("left", { duration: d, delay: late ? sc.show : 0, easing: "ease-in-out" })
      .transition("opacity", { duration: 150, delay: (late ? sc.show : 0) + d, easing: "linear" })
      .child(image(`${ACC}/${act}-fly.svg`).w(ACC_W).h(36)));
  }
  return el;
}

/** The cube style's strip content: sceneOf() (scene.js) made into elements. */
function cubeScene({ p, memo, now, reduced, seed, cx, width, H }) {
  const tid = p.terminal;
  const span = width == null ? 0 : Math.max(0, width - 2 * LEFT - CUBE - RESERVE);
  // what kt-chat already has at hand (main.js runnerNow): the pending kind, kt.compact, its hc workers
  const sc = sceneOf({ status: p.status, action: freshAction(p.action, p.since), ask: p.ask ?? null, compacting: Boolean(p.compacting),
    kidBlocked: Boolean(p.kidBlocked), now, since: p.since, span, reduced, seed, from: memo.cubeLeft });
  memo.cubeLeft = sc.left;
  // one timer per epoch while it works (the next beat), as Clawd's: it picks a beat, it never steps an image
  if (sc.wake != null && cx && !checking() && memo.sceneWake !== sc.wake) {
    memo.sceneWake = sc.wake;
    cx.timer.after(Math.max(16, sc.wake - now), (cx) => cx.notify());
  }
  const T = sc.act ? TABLE[sc.act] ?? null : null;
  const top = H - GROUND - CUBE;
  let mover = div().id(`kc-runner-move-${tid}`).absolute().left(sc.left).top(0).w(CUBE).h(H);
  if (sc.loop) mover = mover.loop("left", sc.loop);
  else if (sc.transition) mover = mover.transition("left", sc.transition);
  // the cube's own motion: a hop (blocked, a question, tests passed), a 1 px bob (typing), a tremble, a sink
  const m = T?.cube;
  const hop = sc.hop ?? (m === "hop" ? { from: 0, to: -3, period: 700, easing: "ease-in-out" } : m === "type" ? { from: 0, to: -1, period: 2 * (T.ms || 300), easing: "linear" } : null);
  let holder = div().id(`kc-runner-body-${tid}`).absolute().left(0).top(top + (m === "sink" ? 2 : 0)).w(CUBE).h(CUBE);
  if (!reduced && hop) holder = holder.loop("top", { from: top + hop.from, to: top + hop.to, period: hop.period, easing: hop.easing });
  else if (!reduced && m === "tremble") holder = holder.loop("left", { from: -1, to: 1, period: 200, easing: "linear" });
  else if (!reduced && m === "pace") holder = holder.loop("left", { from: 0, to: 30, period: 4000, easing: "ease-in-out" }); // in front of its workers
  const body = cube34({ state: p.status, since: p.since, size: CUBE, height: CUBE, id: `kc-runner-${tid}`, address: tid, memo, cx });
  mover = mover.child(holder.child(body));
  if (T && sc.show) mover = mover.child(accessory(sc.act, T, sc, { tid, reduced, memo }));
  return mover;
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
    return strip.overflow_hidden().child(cubeScene({ p, memo, now, reduced, seed, cx, width, H }));
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
