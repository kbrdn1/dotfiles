// bun ~/.config/herdr-app/mods/kt-keys/levels.check.mjs: the status line's thresholds, ported as is.
import assert from "node:assert/strict";
import { ctxLevel, quotaLevel, costLevel, levelColor } from "./levels.js";

assert.equal(ctxLevel(19, 1_000_000), "ok");
assert.equal(ctxLevel(20, 1_000_000), "warn");
assert.equal(ctxLevel(50, 1_000_000), "alarm");
assert.equal(ctxLevel(54, 200_000), "ok");
assert.equal(ctxLevel(55, 200_000), "warn");
assert.equal(ctxLevel(75, 200_000), "alarm");
assert.equal(ctxLevel(null, 200_000), null);

assert.equal(quotaLevel(59), "ok");
assert.equal(quotaLevel(60), "warn");
assert.equal(quotaLevel(86), "alarm");
assert.equal(quotaLevel(10, "critical"), "alarm"); // the API's severity wins
assert.equal(quotaLevel(10, "warning"), "warn");
assert.equal(quotaLevel(90, "normal"), "alarm"); // "normal" says nothing: the number decides

assert.equal(costLevel(4.99, "Opus 5.5"), "ok");
assert.equal(costLevel(5, "Opus 5.5"), "warn");
assert.equal(costLevel(25, "Opus 5.5"), "alarm");
assert.equal(costLevel(1, "Haiku 5.5"), "warn");
assert.equal(costLevel(3, "Sonnet 5.5"), "warn");

const t = { ansi1: "r1", ansi2: "g2", ansi3: "y3", ansi5: "p5", ansi9: "R", ansi10: "G", ansi11: "Y", ansi13: "P", muted: "m" };
assert.equal(levelColor(t, "ok"), "P");
assert.equal(levelColor(t, "ok", { okGreen: true }), "G");
assert.equal(levelColor(t, "warn"), "Y");
assert.equal(levelColor(t, "alarm"), "R");
assert.equal(levelColor(t, null), "m");
console.log("ok");
