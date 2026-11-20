// What the runner above the Chat composer draws, as data (piste A, #86 follow-up). Pure: no Herdr, no GPUI,
// so runner.check.mjs runs it in Bun, with its chance seeded. runner.js turns a plan into elements.
//
// Clawd for the `claude` agent when his poses were extracted on this machine (brand/companions/clawd/
// extract.mjs), else the program's companion (Ember, Prompt: companion.js). What he does follows what the
// agent does (a mood: types, reads, thinks, waits, rests, fails), and within a mood a variant drawn by chance
// every EPOCH: a pair of poses swapped natively, sometimes a glance (another pose a moment, natively too).
// Renders: one per state change (and one cue for the jump of « fini », played natively), one per EPOCH
// while the agent works or waits (the only timer: done, the last draw holds); everything between moves
// natively, no timer ever steps an image.
export const STEP = 85; // the companions' cadence
export const EPOCH = 80 * STEP; // 6.8 s: how long a variant holds before chance may change it
export const CLAWD_POSES = ["idle", "type-0", "type-1", "read-0", "read-1", "look-0", "look-1", "done-0", "done-1", "done-2", "done-3", "error"];
const JUMP = ["done-0", "done-1", "done-2", "done-3"];
const SHOWN = new Set(["working", "blocked", "done", "error"]);
const COMPANIONS = new Set(["claude", "codex"]); // the programs brand/companions draws

/**
 * Each mood's variants. poses: one (still) or two swapped every ms. glance: `pose` shown `for` ms in the
 * middle of every `every` ms over the rest. Typing at twice the companions' step; the slow magnifier holds
 * about as long as in Anthropic's animation (1.6 s); the glance as the terminal Clawd's look (5 x 60 ms).
 */
export const VARIANTS = {
  type: [
    { poses: ["type-0", "type-1"], ms: 2 * STEP },
    { poses: ["type-0", "type-1"], ms: 2 * STEP, glance: { pose: "look-0", every: 34 * STEP, for: 7 * STEP } },
    { poses: ["type-0", "type-1"], ms: 3 * STEP, glance: { pose: "look-1", every: 50 * STEP, for: 8 * STEP } },
  ],
  read: [
    { poses: ["read-0", "read-1"], ms: 19 * STEP },
    { poses: ["read-0", "read-1"], ms: 8 * STEP },
    { poses: ["read-1"] },
  ],
  think: [
    { poses: ["look-0", "look-1"], ms: 6 * STEP },
    { poses: ["idle"], glance: { pose: "look-0", every: 24 * STEP, for: 8 * STEP } },
    { poses: ["idle", "look-1"], ms: 10 * STEP },
  ],
  blocked: [
    { poses: ["look-0", "look-1"], ms: 4 * STEP },
    { poses: ["idle"], glance: { pose: "look-1", every: 28 * STEP, for: 8 * STEP } },
    { poses: ["look-0", "idle"], ms: 6 * STEP },
  ],
  rest: [
    { poses: ["idle"] },
    { poses: ["idle"], glance: { pose: "look-0", every: 60 * STEP, for: 6 * STEP } },
    { poses: ["idle"], glance: { pose: "look-1", every: 50 * STEP, for: 6 * STEP } },
  ],
  error: [{ poses: ["error"] }],
};

export const keyOf = (program) => (typeof program === "string" ? program : program?.key ?? null);

/** Whether the runner is there: kt-chat's one condition (the slot, the « go to bottom » pill).
 *  cube: the cube style (companion-cube.js), generic: there for any agent, idle too (it breathes). */
export function runnerShown(status, program, cube = false) {
  if (cube) return Boolean(status);
  return SHOWN.has(status) && COMPANIONS.has(keyOf(program));
}

/** Whether a view following the bottom must be brought back to it now: the band entering or leaving the
 *  composer's flow moves the transcript's bottom edge, and gpui keeps the offset from the top. was: the
 *  band at the last render (undefined before the first one, when the load reveals the bottom anyway). */
export function keepBottom(follow, was, now) {
  return Boolean(follow) && was !== undefined && Boolean(was) !== Boolean(now);
}

/** What kt-chat hands the runner (set_props), and a key so it hands it only when it changes. agent:
 *  Herdr's agent; bridge: its herdr-bridge file ({ action, since }), or null when there is none
 *  (action undefined: no bridge, as companion.js reads it). */
export function runnerProps(agent, bridge, { ask = null, compacting = false, kidBlocked = false } = {}) {
  // the cube's scene (scene.js), from what kt-chat has at hand: ask, the bridge's pending kind while it waits
  // (« question », « permission »); compacting, kt.compact under way; kidBlocked, one of its hc workers waits
  const props = { terminal: agent?.address ?? null, status: agent?.status ?? null, program: agent?.program ?? null,
    action: bridge ? bridge.action ?? null : undefined, since: bridge?.since, ask: agent?.status === "blocked" ? ask : null,
    compacting: Boolean(compacting), kidBlocked: Boolean(kidBlocked) };
  const a = props.action;
  return { props, key: JSON.stringify([props.terminal, props.status, keyOf(props.program) ?? null, a === undefined ? "-" : a && [a.tool, a.what], props.since ?? null, props.ask, props.compacting, props.kidBlocked]) };
}

/** The action that counts, as companion.js's pick() reads it: one from before this state began is over
 *  (it thinks: null); undefined stays undefined (no bridge). */
export function freshAction(action, since) {
  if (action === undefined) return undefined;
  return action && (!action.at || since == null || action.at >= since) ? action : null;
}

/** What Clawd is doing, from Herdr's status and the action's accessory (companion.js accessoryFor):
 *  reading or searching, the magnifier; thinking with no tool or a sub-agent working, the glances; any
 *  other tool (an edit, a command, a message sent), typing. */
export function moodOf(status, acc) {
  if (status === "error") return "error";
  if (status === "blocked") return "blocked";
  if (status === "done") return "rest";
  if (acc === "read" || acc === "web") return "read";
  if (acc === "think" || String(acc ?? "").startsWith("agent")) return "think";
  return "type";
}

const MOODS = Object.keys(VARIANTS);

/** Three integers mixed into 32 bits (integer ops only: a render's budget is tight): the runner's chance,
 *  seeded, so the check replays it. */
export function hash(seed, salt, n) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(n + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}

/** The variant of a mood for an epoch: drawn by chance, never the one just before inside a run of RUN
 *  epochs (each step moves by 1 to n-1; 64 epochs, 7 min: at most 63 integer hashes a render); a run
 *  starts from its own draw, so only its first epoch may repeat the one before. */
export const RUN = 64;
export function variantAt(mood, seed, epoch) {
  const n = VARIANTS[mood]?.length ?? 1;
  if (n < 2) return 0;
  const salt = MOODS.indexOf(mood), start = Math.floor(epoch / RUN) * RUN;
  let v = hash(seed, salt, start) % n;
  for (let e = start + 1; e <= epoch; e++) v = (v + 1 + (hash(seed, salt, e) % (n - 1))) % n;
  return v;
}

/** A glance's two native opacity loops, created together (so in phase): `show` is up `ms` ms in the
 *  middle of each `every`, `hide` (on the rest) is 1 - show, so one is always up. Steep enough that the
 *  crossfade takes ~8 ms. */
export function glanceLoops(every, ms) {
  const span = Math.max(2, Math.ceil(every / 16));
  const b = (span * ms) / every, a = span - b;
  return { show: { from: -a, to: b, period: every, easing: "linear" }, hide: { from: 1 + a, to: 1 - b, period: every, easing: "linear" } };
}

/** When the jump of « fini » began: a done seen arriving from work. A thread opened already done, or
 *  another thread, has none: Clawd just stands. */
export function doneAt(prev, next, now) {
  if (next.terminal !== prev.terminal || next.status !== "done") return null;
  if (prev.status === "working" || prev.status === "blocked") return now;
  return prev.doneAt ?? null;
}

/**
 * o: { status, program, acc (companion.js accessoryFor of the fresh action), reduced, clawd (his manifest
 * or null), doneAt, now, seed }.
 * -> null (not there) | { who: "companion" }
 *  | { who: "clawd", mood, variant, poses: [one] or [a, b], ms?, glance?, jump?, wake? }
 *    two poses swap natively every ms; glance: { pose, every, for }; jump: { poses, ms, at }, the jump of
 *    « fini » played once natively (companion.js once()) before the variant, from `at`; wake: when to
 *    draw again, the next epoch's draw, while the agent works or waits (done: the last draw, then
 *    nothing; error has one pose). Reduced motion: the mood's first pose, still, no jump, no wake.
 */
export function plan(o) {
  if (!runnerShown(o.status, o.program)) return null;
  if (keyOf(o.program) !== "claude" || !o.clawd) return { who: "companion" };
  const mood = moodOf(o.status, o.acc);
  const list = VARIANTS[mood];
  if (o.reduced) return { who: "clawd", mood, variant: 0, poses: [list[0].poses[0]] };
  const epoch = Math.floor(o.now / EPOCH);
  const variant = variantAt(mood, o.seed ?? 0, epoch);
  const { poses, ms, glance } = list[variant];
  const p = { who: "clawd", mood, variant, poses };
  if (ms) p.ms = ms;
  if (glance) p.glance = glance;
  if (mood === "rest" && o.doneAt != null && o.now >= o.doneAt && o.now - o.doneAt < JUMP.length * STEP) p.jump = { poses: [...JUMP], ms: STEP, at: o.doneAt };
  if (o.status !== "done" && list.length > 1) p.wake = (epoch + 1) * EPOCH;
  return p;
}
