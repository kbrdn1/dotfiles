// What the runner above the Chat composer draws, as data (piste A, #86 follow-up). Pure: no Herdr, no GPUI,
// so runner.check.mjs runs it in Bun. runner.js turns a plan into elements.
//
// Clawd for the `claude` agent when his poses were extracted on this machine (brand/companions/clawd/
// extract.mjs), else the program's companion (Ember, Prompt: companion.js). Everything moves natively
// (two poses swapped by opacity square waves) except the jump of « fini », four poses once, one render each.
export const STEP = 85; // the companions' cadence
export const CLAWD_POSES = ["idle", "type-0", "type-1", "read-0", "read-1", "look-0", "look-1", "done-0", "done-1", "done-2", "done-3", "error"];
const JUMP = ["done-0", "done-1", "done-2", "done-3"];
const SHOWN = new Set(["working", "blocked", "done", "error"]);
const COMPANIONS = new Set(["claude", "codex"]); // the programs brand/companions draws
// ms each pose of a swap stays: typing at twice the companions' step; the magnifier holds about as long as
// in Anthropic's animation (1.6 s); the glance as the terminal Clawd's look (5 x 60 ms), on the step
const TYPE_MS = 2 * STEP, READ_MS = 19 * STEP, LOOK_MS = 4 * STEP;

export const keyOf = (program) => (typeof program === "string" ? program : program?.key ?? null);

/** Whether the runner is there: kt-chat's one condition (the slot, the « go to bottom » pill). */
export function runnerShown(status, program) {
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
export function runnerProps(agent, bridge) {
  const props = { terminal: agent?.address ?? null, status: agent?.status ?? null, program: agent?.program ?? null,
    action: bridge ? bridge.action ?? null : undefined, since: bridge?.since };
  const a = props.action;
  return { props, key: JSON.stringify([props.terminal, props.status, keyOf(props.program) ?? null, a === undefined ? "-" : a && [a.tool, a.what], props.since ?? null]) };
}

/** When the jump of « fini » began: a done seen arriving from work. A thread opened already done, or
 *  another thread, has none: Clawd just stands. */
export function doneAt(prev, next, now) {
  if (next.terminal !== prev.terminal || next.status !== "done") return null;
  if (prev.status === "working" || prev.status === "blocked") return now;
  return prev.doneAt ?? null;
}

/**
 * o: { status, program, acc (companion.js accessoryFor), reduced, clawd (his manifest or null), doneAt, now }.
 * -> null (not there) | { who: "companion" } | { who: "clawd", poses: [one] or [a, b], ms?, wake? }
 *    two poses swap natively every ms; wake: when to render again (the next step of the jump).
 */
export function plan(o) {
  if (!runnerShown(o.status, o.program)) return null;
  if (keyOf(o.program) !== "claude" || !o.clawd) return { who: "companion" };
  const still = (pose) => ({ who: "clawd", poses: [pose] });
  const swap = (a, b, ms) => (o.reduced ? still(a) : { who: "clawd", poses: [a, b], ms });
  if (o.status === "error") return still("error");
  if (o.status === "blocked") return swap("look-0", "look-1", LOOK_MS);
  if (o.status === "working") return o.acc === "read" ? swap("read-0", "read-1", READ_MS) : swap("type-0", "type-1", TYPE_MS);
  // done
  const i = o.doneAt == null || o.reduced ? JUMP.length : Math.floor((o.now - o.doneAt) / STEP);
  if (i < 0 || i >= JUMP.length) return still("idle");
  return { who: "clawd", poses: [JUMP[i]], wake: o.doneAt + (i + 1) * STEP };
}
