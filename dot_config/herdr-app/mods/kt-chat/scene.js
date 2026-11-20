// The runner's scene in the cube style: what the LED cube does along the band, from what the agent does.
// The catalogue: carry/mascot/ACTIONS.md, validated by Kylian on 2026-11-20 (carry/mascot/cube-actions.html).
// Pure: no Herdr, no GPUI (scene.check.mjs runs it in Bun). runner.js turns a scene into elements: the real
// cube (companion-cube.js cube34: its face, grid, states and ring) and the accessories beside it at its scale
// (brand/companions/cube/acc/<action>-<frame>.svg and <action>-fly.svg, src/scene.mjs).
// Renders: one per change of what the agent does, and one per EPOCH while it works (the next beat: walk then
// act, act in place, or a pause, never the same twice); a fly's one cue. Everything between moves natively.
export const EPOCH = 6800; // the rhythm, Clawd's
export const WALK = 1800; // a walk across the band
export const LEFT = 8; // home, from the band's left
const SLEEP = 600000;

// <data> brand/companions/cube/acc/scene.json (src/scene.mjs): scene.check.mjs fails if they part
export const TABLE = {"read":{"n":2,"ms":1200},"search":{"n":2,"ms":600},"write":{"n":3,"ms":450},"edit":{"n":2,"ms":300,"cube":"type"},"move":{"n":1,"ms":0,"cube":"carry"},"dir":{"n":2,"ms":900},"rm":{"n":3,"ms":600},"commit":{"n":2,"ms":1100},"push":{"n":2,"ms":240,"fly":{"dx":50,"ms":2600}},"pull":{"n":2,"ms":240,"fly":{"dx":-50,"ms":2600}},"merge":{"n":2,"ms":1000},"branch":{"n":2,"ms":900},"prcreate":{"n":2,"ms":1100},"review":{"n":2,"ms":1000},"prmerge":{"n":1,"ms":2200,"fly":{"dx":20,"ms":2200}},"bash":{"n":2,"ms":600},"tests":{"n":2,"ms":1000},"testsOk":{"n":1,"ms":0,"cube":"hop"},"testsKo":{"n":1,"ms":0,"cube":"tremble"},"build":{"n":2,"ms":300},"install":{"n":2,"ms":700},"lint":{"n":2,"ms":450},"web":{"n":2,"ms":800,"over":1},"mcp":{"n":2,"ms":900},"skill":{"n":2,"ms":1200},"todo":{"n":2,"ms":1200},"plan":{"n":2,"ms":1500},"think":{"n":3,"ms":450,"over":1},"advisor":{"n":1,"ms":0,"look":1},"compact":{"n":2,"ms":1500},"spawn":{"n":1,"ms":2800,"fly":{"dx":30,"ms":2800}},"send":{"n":2,"ms":1200,"fly":{"dx":50,"ms":2400}},"note":{"n":2,"ms":1200,"fly":{"dx":-50,"ms":2400}},"hcread":{"n":1,"ms":0,"look":1},"wait":{"n":2,"ms":700,"cube":"pace"},"workerBlocked":{"n":2,"ms":600,"look":1},"kill":{"n":2,"ms":1500},"message":{"n":1,"ms":2400,"fly":{"dx":52,"ms":2400}},"crosstalk":{"n":2,"ms":800,"look":1},"question":{"n":1,"ms":0,"cube":"hop"},"permission":{"n":2,"ms":700,"cube":"hop"},"error":{"n":3,"ms":400,"over":1},"quota":{"n":2,"ms":800,"cube":"sink"},"done":{"n":2,"ms":400},"idle":{"n":1,"ms":0},"sleep":{"n":3,"ms":600,"over":1}};
// </data>

// the tools herdr-bridge reports, and Bash's commands (its `what`, « Run … »): the last command of a chain wins
const TOOLS = { Read: "read", Grep: "search", Glob: "search", Write: "write", Edit: "edit", MultiEdit: "edit", NotebookEdit: "edit",
  WebFetch: "web", WebSearch: "web", Agent: "spawn", Task: "spawn", Skill: "skill", TodoWrite: "todo", TaskCreate: "todo", TaskUpdate: "todo",
  EnterPlanMode: "plan", ExitPlanMode: "plan", advisor: "advisor", SendMessage: "message" };
const BASH = [
  [/^git\s+commit\b/, "commit"], [/^git\s+push\b/, "push"], [/^git\s+(pull|fetch)\b/, "pull"], [/^git\s+(merge|rebase)\b/, "merge"],
  [/^git\s+(checkout|switch|branch)\b/, "branch"], [/^gh\s+pr\s+create\b/, "prcreate"], [/^gh\s+pr\s+(review|diff|view|checks)\b/, "review"],
  [/^gh\s+pr\s+merge\b/, "prmerge"], [/^hc\s+run\b/, "spawn"], [/^hc\s+send\b/, "send"], [/^hc\s+(read|get)\b/, "hcread"], [/^hc\s+wait\b/, "wait"],
  [/^hc\s+kill\b/, "kill"], [/^(mv|cp)\b/, "move"], [/^mkdir\b/, "dir"], [/^(rm|trash)\b/, "rm"],
  [/\b(vitest|jest|pytest|phpunit|pest|playwright test|cargo (nextest|test)|go test|bun test|(npm|pnpm|yarn) (run )?test|make (test|check|ci))\b/, "tests"],
  [/^(make|cargo build|go build|tsc|vite build|(bun|npm|pnpm|yarn) (run )?build)\b/, "build"],
  [/^((bun|npm|pnpm|yarn) (i|install|add)|pip3? install|brew install|cargo add)\b/, "install"],
  [/^(eslint|prettier|biome|ruff|mago|rustfmt|cargo fmt)\b|\b(run )?(lint|format)\b/, "lint"],
  [/^(cat|head|tail|less|bat)\b/, "read"], [/^(grep|rg|find|fd)\b/, "search"],
];
export function bashOf(what) {
  const segs = String(what ?? "").replace(/^Run\s+/i, "").split(/&&|\|\||;|\|/).map((s) => s.trim().replace(/^(cd\s+\S+|env\s+(\S+=\S+\s*)+)\s*/, "")).filter(Boolean);
  for (const s of segs.reverse()) for (const [re, id] of BASH) if (re.test(s)) return id;
  return null;
}

/** The action for what the agent does. ask: the bridge's pending kind (« question », « permission »); compacting:
 *  kt.compact's phase is under way; kidBlocked: one of its hc workers waits for Kylian. null: no bridge, the
 *  base back and forth. */
export function actionOf({ status, action, ask = null, compacting = false, kidBlocked = false, asleep = false }) {
  if (status === "error") return "error";
  if (status === "blocked") return ask === "permission" ? "permission" : "question";
  if (compacting) return "compact";
  if (status === "done") return "done";
  if (status !== "working") return kidBlocked ? "workerBlocked" : asleep ? "sleep" : "idle";
  if (action === undefined) return null;
  if (action === null) return kidBlocked ? "workerBlocked" : "think";
  const tool = String(action.tool ?? "");
  if (tool === "Bash") return bashOf(action.what) ?? "bash";
  if (TOOLS[tool]) return TOOLS[tool];
  if (/^mcp__(tavily|hyperbrowser)/.test(tool)) return "web";
  if (tool.startsWith("mcp__")) return "mcp";
  return "edit"; // any other tool: it types, as Clawd does
}

// chance, seeded per runner, integers only
const mix = (a, b) => { let x = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ (b | 0); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
/** An epoch's beat: never the one before it again, by construction (no history to keep): even epochs act in
 *  place, odd ones walk then act (three times in four) or pause; the spot and the action change the rest. */
export function beatOf(e, seed) {
  return e % 2 === 0 ? "act" : mix(e, seed) < 0.75 ? "walk" : "pause";
}
/** Where the cube stands during epoch e: the last walk's spot (8 epochs back at most), else home. */
export function spotAt(e, seed, span) {
  for (let k = e; k > e - 8; k--) if (beatOf(k, seed) === "walk") return Math.round(LEFT + span * mix(k * 7 + 3, seed));
  return LEFT;
}

/** The base moves (validated first): working without a bridge, back and forth; blocked, home and a hop; done,
 *  off to the right end; idle, error, home. Reduced motion, or no width yet: home. */
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

/**
 * The scene now. o: { status, action, ask, compacting, kidBlocked, now, since, span, reduced, seed, from }.
 * -> { act (an action, or null), left, transition | loop (the cube's left), hop, show (the accessory: true, or
 * a delay: after the walk), beat, epoch, wake (when to pick the next beat) }.
 */
export function sceneOf(o) {
  const asleep = o.status === "idle" && o.since != null && o.now - o.since >= SLEEP;
  const act = actionOf({ ...o, asleep });
  const base = cubeMove(o.status, o.span, o.reduced, o.from);
  if (o.status !== "working" || act === null || o.reduced || !(o.span > 0)) {
    // the states keep their validated moves; reduced motion: home, the accessory shown and still
    return { act, ...base, show: act !== null && act !== "idle", beat: null };
  }
  const e = Math.floor(o.now / EPOCH);
  const beat = beatOf(e, o.seed);
  const left = spotAt(e, o.seed, o.span);
  const T = TABLE[act] ?? {};
  const out = { act, left, beat, epoch: e, wake: (e + 1) * EPOCH };
  // hc wait: it paces in front of its workers (runner.js moves the cube alone, its workers stay put)
  if (T.cube === "pace") return { ...out, left: LEFT, show: true };
  if (beat === "walk") return { ...out, transition: { duration: WALK, easing: "ease-in-out" }, show: T.cube === "carry" ? true : WALK };
  return { ...out, show: beat !== "pause" };
}
