// bun ~/.config/herdr-app/mods/kt-chat/scene.check.mjs: the runner's scene in the cube style (scene.js).
// What sets each action (the tool, Bash's command, the states), the beats (never the same twice in a row,
// the cube on the band), the scene's moves (reduced motion home, a walk then the accessory), and the table
// agreeing with the build (brand/companions/src/scene.mjs) and its images.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { bashOf, actionOf, beatOf, spotAt, sceneOf, cubeMove, TABLE, EPOCH, WALK, LEFT } from "./scene.js";

// Bash: the command, the last of a chain, behind a cd
const B = { "Run git commit -m x": "commit", "Run git push origin dev": "push", "Run git pull": "pull", "Run git fetch --all": "pull",
  "Run git rebase dev": "merge", "Run git switch -c feat": "branch", "Run gh pr create --fill": "prcreate", "Run gh pr diff 12": "review",
  "Run gh pr merge 12": "prmerge", "Run hc run --bg x": "spawn", "Run hc send t1 hi": "send", "Run hc read t3": "hcread", "Run hc wait t3": "wait",
  "Run hc kill t3": "kill", "Run mv a b": "move", "Run cp a b": "move", "Run mkdir -p x": "dir", "Run rm -f x": "rm", "Run bun test": "tests",
  "Run cd mods/kt-chat && bun runner.check.mjs": null, "Run cargo test": "tests", "Run make test": "tests", "Run cargo build": "build",
  "Run bun install": "install", "Run pip install x": "install", "Run npx eslint .": null, "Run eslint .": "lint", "Run cat a.js": "read",
  "Run rg foo": "search", "Run cd x && git commit -m y": "commit", "Run ls": null };
for (const [what, id] of Object.entries(B)) assert.equal(bashOf(what), id, what);
// the tools, the states
const W = (tool, what) => actionOf({ status: "working", action: { tool, what } });
assert.deepEqual(["Read", "Grep", "Write", "Edit", "WebFetch", "Agent", "Skill", "TodoWrite", "EnterPlanMode", "SendMessage", "mcp__github__x", "mcp__tavily__search", "Weird"].map((t) => W(t)),
  ["read", "search", "write", "edit", "web", "spawn", "skill", "todo", "plan", "message", "mcp", "web", "edit"]);
assert.equal(W("Bash", "Run ls -la"), "bash");
assert.equal(actionOf({ status: "working", action: null }), "think");
assert.equal(actionOf({ status: "working", action: undefined }), null, "no bridge: the base back and forth");
assert.equal(actionOf({ status: "working", action: null, kidBlocked: true }), "workerBlocked");
assert.deepEqual(["question", "permission", null].map((ask) => actionOf({ status: "blocked", ask })), ["question", "permission", "question"]);
assert.equal(actionOf({ status: "idle", compacting: true }), "compact");
assert.deepEqual(["done", "error", "idle"].map((status) => actionOf({ status })), ["done", "error", "idle"]);
assert.equal(actionOf({ status: "idle", asleep: true }), "sleep");
// beats: never the same twice in a row; spots on the band
for (const seed of [1, 42, 999]) {
  let walks = 0;
  for (let e = 0; e < 400; e++) {
    assert.notEqual(beatOf(e, seed), beatOf(e - 1, seed), `epoch ${e}: the same beat twice`);
    if (beatOf(e, seed) === "walk") walks++;
    const s = spotAt(e, seed, 300);
    assert.ok(s >= LEFT && s <= LEFT + 300, "a spot on the band");
  }
  assert.ok(walks > 60 && walks < 300, `walks: ${walks}`);
}
// scenes
const now = 10 * EPOCH + 100;
const sc = (o) => sceneOf({ status: "working", action: { tool: "Edit", what: "a.js" }, now, since: 0, span: 400, reduced: false, seed: 7, ...o });
assert.deepEqual([sc({ reduced: true }).left, sc({ reduced: true }).loop, sc({ reduced: true }).transition], [LEFT, undefined, undefined], "reduced motion: home, still");
assert.equal(sc({ reduced: true }).show, true, "reduced motion: the accessory shown");
assert.equal(sc({}).wake, 11 * EPOCH, "the next beat at the next epoch");
let walked = false;
for (let e = 0; e < 40 && !walked; e++) {
  const s = sc({ now: e * EPOCH + 10 });
  if (s.beat === "walk") { walked = true; assert.equal(s.transition.duration, WALK); assert.equal(s.show, WALK, "the accessory after the walk"); }
}
assert.ok(walked, "a walk within 40 epochs");
const waiting = sc({ action: { tool: "Bash", what: "Run hc wait t3" } });
assert.deepEqual([waiting.act, waiting.left, waiting.loop, TABLE.wait.cube], ["wait", LEFT, undefined, "pace"], "hc wait: home, the cube alone paces (runner.js), its workers stay");
assert.equal(sc({ status: "done", action: undefined }).left, cubeMove("done", 400, false).left, "done: the validated move");
assert.equal(sc({ action: undefined }).loop?.period > 0, true, "no bridge: back and forth");
// the table and its images
const APP = `${homedir()}/.config/herdr-app`;
assert.deepEqual(TABLE, JSON.parse(readFileSync(`${APP}/brand/companions/cube/acc/scene.json`, "utf8")), "TABLE = scene.json: copy it from the build");
for (const [id, t] of Object.entries(TABLE)) {
  for (let k = 0; k < t.n; k++) assert.ok(existsSync(`${APP}/brand/companions/cube/acc/${id}-${k}.svg`), `${id}-${k}.svg`);
  if (t.fly) assert.ok(existsSync(`${APP}/brand/companions/cube/acc/${id}-fly.svg`), `${id}-fly.svg`);
}
console.log("scene.check: ok");
