// bun ~/.config/herdr-app/mods/kt-chat/chat-view.check.mjs: chat-view.js, what herdr-app check can't
// reach in kt-chat: the agent chosen (the focused pane's Claude first, another tab never), the fold's
// words in the order the work was done, and where « Tours précédents » and the cursor leave the view.
import assert from "node:assert/strict";
import { pickTarget, tallyText, childOf, chatShown, takesFocus, liveStep, projectOf, bgSettings, fadeAt, bgLayers, modelName, workedFor, ink, orphans, clampText, foldMd, noticeHead, veilRects, hazeRows, filesRead, FILES, ditherCells, flickerCells, FIELD_FX } from "./chat-view.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import strings from "./strings.js";

// ── The agent ───────────────────────────────────────────────────────────────
const claude = (address, tab) => ({ address, tab, program: { key: "claude", name: "Claude Code" }, app: "claude-code" });
const other = (address, tab) => ({ address, tab, program: { key: "codex", name: "Codex" }, app: "codex" });
const env = (agents, panes, tab = "tab-1") => ({ focused: () => ({ tab }), agents: () => agents, panes: () => panes });

assert.deepEqual(pickTarget(env([], [])), { reason: "noAgent" });
assert.deepEqual(pickTarget({ focused: () => null, agents: () => [claude("t1", "tab-1")], panes: () => [] }), { reason: "noAgent" });
assert.deepEqual(pickTarget(env([claude("t9", "tab-2")], [])), { reason: "noAgent" }, "another tab's agent is not this thread's");
// Two Claude agents in the tab: the focused pane's, else the first.
const two = [claude("t1", "tab-1"), claude("t2", "tab-1")];
assert.equal(pickTarget(env(two, [{ tab: "tab-1", terminal: "t2", focused: true }])).agent.address, "t2");
assert.equal(pickTarget(env(two, [{ tab: "tab-1", terminal: "t2", focused: false }])).agent.address, "t1");
assert.equal(pickTarget(env(two, [{ tab: "tab-2", terminal: "t2", focused: true }])).agent.address, "t1", "a focused pane of another tab doesn't count");
// A Claude agent wins over a focused Codex one; no Claude at all says which program it is.
assert.equal(pickTarget(env([other("t1", "tab-1"), claude("t2", "tab-1")], [{ tab: "tab-1", terminal: "t1", focused: true }])).agent.address, "t2");
assert.deepEqual(pickTarget(env([other("t1", "tab-1")], [])), { reason: "notClaude", app: "Codex" });
// Claude on another machine.
const remote = pickTarget(env([claude("vps/t4", "tab-1")], []));
assert.equal(remote.reason, "remote");
assert.equal(remote.machine, "vps");

// ── The fold's words ────────────────────────────────────────────────────────
const tr = (k, v) => `${k}=${v?.n ?? ""}`;
const base = { order: [], reads: 0, edits: 0, searches: 0, runs: 0, agents: 0, others: 0, thoughts: 0, notes: 0, errors: 0 };
assert.equal(tallyText({ ...base, order: ["research", "edit", "run"], reads: 4, searches: 1, edits: 2, runs: 3 }, tr),
  "count.reads=4 · count.searches=1 · count.edits=2 · count.runs=3");
assert.equal(tallyText({ ...base, order: ["run", "research"], runs: 1, searches: 2 }, tr), "count.runs=1 · count.searches=2", "the order the work was done, no zero count");
assert.equal(tallyText({ ...base, thoughts: 2 }, tr), "count.thoughts=2", "thinking only");
assert.equal(tallyText({ ...base, order: ["edit"], edits: 1, thoughts: 3 }, tr), "count.edits=1", "thinking is not counted beside work");
assert.equal(tallyText({ ...base, order: ["agent", "other"], agents: 1, others: 2, notes: 1, errors: 1 }, tr), "count.agents=1 · count.others=2 · count.notes=1 · count.errors=1");

// ── Where the view goes (which turns are drawn: turn-window.check.mjs) ──────
// The head is child 0, the first turn drawn child 1; 10 more drawn above, the old first is child 11.
assert.equal(childOf(20, 20), 1);
assert.equal(childOf(20, 10), 11);

// ── The Chat face shown (#54, back with #86: it takes the keyboard on ctrl-b space only then) ───
const lay = (body, page) => ({ id: "root", children: [{ id: "view", ...(page ? { active: page } : {}), children: [
  { id: "thread", children: [{ id: "thread-body", type: "stack", ...(body ? { active: body } : {}), children: [{ id: "main" }, { id: "chat" }] }] },
  { id: "inbox" }] }] });
assert.equal(chatShown(lay("chat", "thread")), true);
assert.equal(chatShown(lay("chat")), true, "the stack view's first child is the thread");
assert.equal(chatShown(lay("main", "thread")), false);
assert.equal(chatShown(lay()), false, "thread-body shows main by default");
assert.equal(chatShown(lay("chat", "inbox")), false, "a page covers the thread");
assert.equal(chatShown({ id: "root", children: [] }), false, "another layout");
assert.equal(chatShown({ id: "root", children: [{ id: "thread-panes", type: "block" }] }), false, "the panes' block of #86 lots 3-4: no face");
// #86: the Chat face is a column (the Chat, then the status line kt-composer): still the child chat.
const colLay = (body) => ({ id: "root", children: [{ id: "view", active: "thread", children: [{ id: "thread", children: [{ id: "thread-body", type: "stack",
  active: body, children: [{ id: "main" }, { id: "chat", type: "column", children: [{ id: "chat-main" }, { id: "composer" }] }] }] }] }] });
assert.deepEqual([chatShown(colLay("chat")), chatShown(colLay("main"))], [true, false], "the Chat face as a column");
// ctrl-b space's stamp: taken once, and only with the face on screen (view.js writes it before the
// switch: seen while still hidden, it waits for the face instead of being spent without the keyboard).
assert.equal(takesFocus(1000, null, true), true, "a new stamp, the face shown: the keyboard");
assert.equal(takesFocus(1000, 1000, true), false, "taken already");
assert.equal(takesFocus(1000, null, false), false, "the face still hidden: it waits");
assert.equal(takesFocus(null, null, true), false, "no stamp");

// ── The live tail's moves (#55) ─────────────────────────────────────────────
const at = (o) => liveStep({ shown: true, wasShown: true, status: "idle", lastStatus: "idle", hasState: true, fixed: null, ...o });
assert.deepEqual(at({}), { delta: false, tick: false }, "at rest: nothing");
assert.deepEqual(at({ status: "working", lastStatus: "working" }), { delta: false, tick: true }, "shown and working: the timer");
assert.deepEqual(at({ status: "working", lastStatus: "idle" }), { delta: true, tick: true }, "it starts working: a delta now, then the timer");
assert.deepEqual(at({ status: "idle", lastStatus: "working" }), { delta: true, tick: false }, "it stops: the last lines, timer off");
assert.deepEqual(at({ status: "blocked", lastStatus: "working" }), { delta: true, tick: false });
assert.deepEqual(at({ shown: false, status: "working", lastStatus: "working" }), { delta: false, tick: false }, "hidden: no timer");
assert.deepEqual(at({ wasShown: false }), { delta: true, tick: false }, "back on screen: catch up once");
assert.deepEqual(at({ lastStatus: undefined }), { delta: false, tick: false }, "the first render: no status change yet");
assert.deepEqual(at({ hasState: false, status: "working", lastStatus: "idle" }), { delta: false, tick: true }, "nothing read yet: the full read comes first");
assert.deepEqual(at({ fixed: "/f.jsonl", status: "working", lastStatus: "working" }), { delta: false, tick: false }, "a fixed file has no agent to follow");

// ── Monocode's words (#75) ──────────────────────────────────────────────────
assert.equal(modelName("claude-opus-5-5"), "Opus 5.5");
assert.equal(modelName("claude-sonnet-4-5-20250929"), "Sonnet 4.5");
assert.equal(modelName("claude-haiku-5-5"), "Haiku 5.5");
assert.equal(modelName("claude-fable-5-2"), "Fable 5.2");
assert.equal(modelName("<synthetic>"), "");
assert.equal(modelName(null), "");
assert.equal(modelName("gpt-x"), "gpt-x");
assert.equal(workedFor(400), "1s");
assert.equal(workedFor(42000), "42s");
assert.equal(workedFor(180000), "3m");
assert.equal(workedFor(192400), "3m 12s");
// A long message folded to four wrapped lines (Monocode's « Show more »).
assert.deepEqual(clampText("court"), { text: "court", cut: false });
assert.deepEqual(clampText("a\nb\nc\nd"), { text: "a\nb\nc\nd", cut: false }, "four lines: whole");
assert.deepEqual(clampText("a\nb\nc\nd\ne"), { text: "a\nb\nc\nd…", cut: true });
const longLine = "x".repeat(400); // a path, a JSON line: no space, it wraps all the same
const cl = clampText(longLine, { cols: 76 });
assert.equal(cl.cut, true);
assert.ok(cl.text.length <= 4 * 76 && cl.text.endsWith("…"), "cut within four lines of 76");
assert.deepEqual(clampText("un\n" + "y".repeat(160) + "\nfin", { cols: 76 }), { text: "un\n" + "y".repeat(160) + "…", cut: true }, "a long line counts its wrapped lines (3)");
assert.deepEqual(clampText("trois\n\n\n"), { text: "trois", cut: false }, "trailing blank lines don't count");

assert.equal(ink({ foreground: "#ebebeb" }, 0.1), "#ebebeb1a");
assert.equal(ink({ foreground: "#2e2e2eff" }, 1), "#2e2e2eff");
assert.equal(ink({ foreground: "#ebebeb" }, 0.78), "#ebebebc7");

// ── The project's background (#57) ──────────────────────────────────────────
const reg = [
  { id: "a", folder: "/w/proj", machine: null },
  { id: "b", folder: "/w/proj/sub", machine: null },
  { id: "c", folder: "/w/remote", machine: "vps" },
];
assert.equal(projectOf(reg, "/w/proj/src", null).id, "a");
assert.equal(projectOf(reg, "/w/proj/sub/x", null).id, "b", "the longest folder wins");
assert.equal(projectOf(reg, "/w/projet", null), null, "a prefix of a name is not a folder");
assert.equal(projectOf(reg, "/wt/proj-feat", "/w/proj").id, "a", "a worktree: by its repo's main checkout");
assert.equal(projectOf(reg, "/w/remote/x", null), null, "another machine's project");
assert.equal(projectOf(null, "/w/proj", null), null);

assert.equal(bgSettings(null), null);
assert.deepEqual(bgSettings({ src: "/d/src-1.png", w: 10, h: 20 }), { src: "/d/src-1.png", w: 10, h: 20, effect: "dither", cell: 2, color: "photo", opacity: 0.24, scope: "all" }, "Kylian's defaults: the dither, 2 px cells, the photo's color (a setting from before #87 reads as it did)");
assert.deepEqual(bgSettings({ src: "s", cell: 6, color: "project", opacity: 0.9, scope: "empty" }), { src: "s", w: null, h: null, effect: "dither", cell: 6, color: "project", opacity: 0.65, scope: "empty" });
assert.equal(bgSettings({ src: "s", cell: 3, opacity: 0.01 }).cell, 2);
assert.equal(bgSettings({ src: "s", opacity: 0.01 }).opacity, 0.05);
assert.equal(bgSettings({ src: "s", effect: "haze" }).effect, "haze");
assert.equal(bgSettings({ src: "s", effect: "none" }).effect, "dither", "an unknown effect: the dither");

// The clean-up of data/kt-chat: what no setting refers to, in chat-bg.ts' names only.
const dir = [
  "src-aaaaaaaa.png", "bg-aaaaaaaa-2-photo.png", "bg-aaaaaaaa-4-photo.png", "bg-aaaaaaaa-2-d4825d.png",
  "src-bbbbbbbb.png", "bg-bbbbbbbb-4-d4825d.png", "bg-bbbbbbbb-4-112233.png", "bg-bbbbbbbb-4-photo.png", "bg-bbbbbbbb-2-d4825d.png",
  "src-cccccccc.png", "bg-cccccccc-2-photo.png",
  "notes.json", "zed-req-1.json", "bg-cccccccc.png", "src-CCCCCCCC.png", "src-cccccccc.png.tmp",
];
const settingsNow = {
  one: { src: "/h/.config/herdr-app/data/kt-chat/src-aaaaaaaa.png", cell: 2, color: "photo" },
  two: { src: "/h/.config/herdr-app/data/kt-chat/src-bbbbbbbb.png", cell: 4, color: "project" },
  three: { src: "/h/.config/herdr-app/data/kt-chat/src-aaaaaaaa.png", cell: 2, color: "photo" },
};
assert.deepEqual(orphans(dir, settingsNow), [
  "bg-aaaaaaaa-4-photo.png", "bg-aaaaaaaa-2-d4825d.png", // another cell, another color than the setting's
  "bg-bbbbbbbb-4-photo.png", "bg-bbbbbbbb-2-d4825d.png", // « project » keeps its tints at its cell only
  "src-cccccccc.png", "bg-cccccccc-2-photo.png", // no setting refers to that image any more
], "a source shared by two projects stays; nothing outside the two name patterns is ever listed");
assert.deepEqual(orphans(dir, {}).filter((n) => !/^(src|bg)-[0-9a-f]{8}/.test(n)), [], "never a file of another shape");
assert.equal(orphans(dir, {}).length, 11, "no setting at all: every texture and source of ours");
assert.deepEqual(orphans(["src-aaaaaaaa.png"], { x: { src: "src-aaaaaaaa.png", cell: 3 } }), [], "a setting's defaults count (cell 3 is read as 2)");
assert.deepEqual(orphans(["src-aaaaaaaa.png"], { x: { cell: 2 } }), ["src-aaaaaaaa.png"], "a setting without a source refers to nothing");
assert.deepEqual(orphans(null, settingsNow), []);
// #87: the effects' textures (the rule: every name chat-bg.ts writes is in a pattern, else it never goes).
const fxDir = [
  "src-aaaaaaaa.png", "bg-aaaaaaaa-2-photo.png", "fx-aaaaaaaa-ascii.png", "fx-aaaaaaaa-halftone.png", "fx-aaaaaaaa-scanlines.png",
  "fx-aaaaaaaa-haze-session-768-171717.png", "fx-aaaaaaaa-haze-session-896-171717.png", "fx-aaaaaaaa-haze-empty-768-171717.png",
  "fx-aaaaaaaa-haze-session-768-f5f5f5.png", "fx-aaaaaaaa-haze.png", "fx-AAAAAAAA-ascii.png", "fx-aaaaaaaa-sepia.png",
];
const ascii = { a: { src: "/x/src-aaaaaaaa.png", effect: "ascii" } };
assert.deepEqual(orphans(fxDir, ascii), [
  "bg-aaaaaaaa-2-photo.png", "fx-aaaaaaaa-halftone.png", "fx-aaaaaaaa-scanlines.png",
  "fx-aaaaaaaa-haze-session-768-171717.png", "fx-aaaaaaaa-haze-session-896-171717.png", "fx-aaaaaaaa-haze-empty-768-171717.png",
  "fx-aaaaaaaa-haze-session-768-f5f5f5.png",
], "an effect no longer chosen goes, the chosen one stays; never a name of another shape");
const haze = { a: { src: "/x/src-aaaaaaaa.png", effect: "haze" } };
assert.deepEqual(orphans(fxDir, haze, new Set(["/d/fx-aaaaaaaa-haze-session-896-171717.png"])), [
  "bg-aaaaaaaa-2-photo.png", "fx-aaaaaaaa-ascii.png", "fx-aaaaaaaa-halftone.png", "fx-aaaaaaaa-scanlines.png",
  "fx-aaaaaaaa-haze-session-768-171717.png", "fx-aaaaaaaa-haze-empty-768-171717.png", "fx-aaaaaaaa-haze-session-768-f5f5f5.png",
], "the Haze: only the variants in use (another height, state or theme goes)");
assert.deepEqual(orphans(fxDir, haze).filter((n) => n.includes("haze")), [], "none of its variants known yet (start-up): all kept");
assert.equal(orphans(fxDir, {}).filter((n) => n.startsWith("fx-")).length, 7, "no setting: every effect texture of ours");
assert.deepEqual(orphans(["src-aaaaaaaa.png", "bg-aaaaaaaa-2-photo.png"], { a: { src: "/x/src-aaaaaaaa.png" } }), [], "a setting from before #87: its dither stays");

// The Haze's rows: what the view shows of the image at bgLayers' whole scale, by steps of 128.
assert.equal(hazeRows({ w: 1100, h: 800, iw: 2048, ih: 1365 }), 896, "scale 1: 800 rows, up to 896");
assert.equal(hazeRows({ w: 1100, h: 800, iw: 1024, ih: 683 }), 512, "scale 2: 400 rows, up to 512");
assert.equal(hazeRows({ w: 1100, h: 2000, iw: 2048, ih: 1365 }), 1024, "never more than the image (scale 2: 1000 → 1024 ≤ 1365)");
assert.equal(hazeRows({ w: 1100, h: 1360, iw: 2048, ih: 1365 }), 1365, "capped at the image");
assert.equal(hazeRows({ w: 0, h: 800, iw: 10, ih: 10 }), 0);

assert.equal(fadeAt(0), 1);
assert.equal(fadeAt(0.18), 1);
assert.equal(fadeAt(0.72), 0);
assert.equal(fadeAt(0.9), 0);
// The Haze's own fade (#87), longer: session 1 to 18 %, gone at 76 %; empty gone at 90 %.
assert.equal(fadeAt(0.18, false, true), 1);
assert.ok(Math.abs(fadeAt(0.47, false, true) - 0.5) < 0.001, "halfway between 0.18 and 0.76");
assert.ok(fadeAt(0.72, false, true) > 0 && fadeAt(0.76, false, true) === 0);
assert.ok(Math.abs(fadeAt(0.3, true, true) - 0.94) < 1e-9);
assert.ok(fadeAt(0.85, true, true) > 0 && fadeAt(0.9, true, true) === 0);
assert.ok(Math.abs(fadeAt(0.25) - 0.805) < 0.001, "halfway between 0.18 (1) and 0.32 (0.61)");
assert.ok(fadeAt(0.3, true) > fadeAt(0.3, false), "an empty conversation fades later");

// Cover at a whole scale: an image smaller than the view is drawn ×2, never ×1.5.
const one = [[0, 0, 600, 400]];
let ls = bgLayers({ w: 600, h: 400, iw: 400, ih: 300, windows: one, opacity: 0.24 });
assert.ok(ls.every((l) => l.iw === 800 && l.ih === 600), "×2");
assert.equal(ls[0].ix, -100, "centred across, on an even px");
assert.ok(ls.every((l) => l.iy === -l.y), "from the top");
// A bigger image: ×1, cropped.
ls = bgLayers({ w: 600, h: 400, iw: 2048, ih: 1365, windows: one, opacity: 0.24 });
assert.ok(ls.every((l) => l.iw === 2048 && l.ih === 1365));
assert.equal(ls[0].ix, Math.floor((600 - 2048) / 4) * 2);
// The steps follow the fade: full at the top (one merged window), lower further down, none past 72 %.
assert.equal(ls[0].y, 0);
assert.equal(ls[0].o, 0.24);
assert.ok(ls[0].h >= 64, "the full part above 18 % is one window");
for (let i = 1; i < ls.length; i++) assert.ok(ls[i].o <= ls[i - 1].o, "never brighter further down");
assert.ok(ls.every((l) => l.y + l.h <= Math.ceil(0.72 * 400 / 16) * 16), "nothing past the fade");
assert.ok(ls.length <= 24, `a handful of quads (${ls.length})`);
// Windows (the rounded corners) keep their own columns; the image stays continuous across them.
const corners = [[6, 0, 588, 2], [2, 2, 596, 4], [0, 6, 600, 394]];
ls = bgLayers({ w: 600, h: 400, iw: 2048, ih: 1365, windows: corners, opacity: 0.2 });
assert.deepEqual(ls.slice(0, 2).map((l) => [l.x, l.w, l.ix]), [[6, 588, -730], [2, 596, -726]]);
assert.ok(ls.every((l) => l.x + l.ix === -724), "the same image place in every window");
assert.deepEqual(bgLayers({ w: 0, h: 400, iw: 10, ih: 10, windows: one, opacity: 1 }), []);

// ── A notice's body: markdown folded on its source (Kylian's capture, 2026-11-19) ────────────────
// Short: untouched. Long: cut at a whole word, and what the cut left open is closed again.
assert.deepEqual(foldMd("Court **gras**."), { text: "Court **gras**.", cut: false });
// The capture's shape: a paragraph, then a bold heading cut in its middle; never a raw `**`.
const cap = `La page est à jour : la section réunit maintenant (c) et (a).\n\n**Ordre dans la section** ${"mot ".repeat(80)}`;
const f1 = foldMd(cap);
assert.ok(f1.cut);
assert.equal((f1.text.match(/\*\*/g) ?? []).length % 2, 0, f1.text);
assert.ok(f1.text.endsWith("…"), f1.text);
const f2 = foldMd(`Début\n\n**${"long ".repeat(70)}fin**`);
assert.ok(f2.text.endsWith("…**"), f2.text);
// A `**` inside inline code doesn't count; an inline code span cut open is closed.
assert.ok(!foldMd(`Voir \`a**b\` puis ${"suite ".repeat(70)}`).text.endsWith("**"));
const f3 = foldMd(`Lance \`${"x ".repeat(200)}\``);
assert.ok(f3.text.endsWith("…`"), f3.text);
// A code fence left open is closed; a link never finished goes from its `[`.
const f4 = foldMd("Avant\n```js\nconst a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\n```\nAprès");
assert.equal(f4.text, "Avant\n```js\nconst a = 1;\n```", "inside code: whole lines, then the fence closed");
assert.ok(foldMd("```\n" + "x".repeat(400) + "\n```").text.startsWith("```\nxxx"), "one long code line: its start, not an empty block");
const f5 = foldMd(`${"mot ".repeat(70)}[le lien](https://example.invalid/une/page/longue/qui/continue`);
assert.ok(!f5.text.includes("[le lien"), f5.text);
// Four lines at most.
assert.ok(foldMd("a\nb\nc\nd\ne\nf").text.split("\n").length <= 4);

// ── A notice's header: who and what happened (fr and en keys exist, no em dash) ───────────────────
assert.deepEqual(noticeHead({ kind: "teammate", name: "lot-a", idle: true, summary: null }), { key: "head.idle", vars: { name: "lot-a", summary: null } });
assert.deepEqual(noticeHead({ kind: "teammate", name: "lot-a", idle: true, summary: "en pause" }).key, "head.idleSaid");
assert.deepEqual(noticeHead({ kind: "teammate", name: "lot-a", summary: "maquette prête" }), { key: "head.said", vars: { name: "lot-a", summary: "maquette prête" } });
assert.equal(noticeHead({ kind: "teammate", name: "lot-a" }).key, "head.msg");
assert.deepEqual(noticeHead({ kind: "peer", name: "claude-80" }), { key: "head.peer", vars: { name: "claude-80", summary: null } });
assert.deepEqual(noticeHead({ kind: "task", status: "completed", task: "revue" }), { key: "head.taskNamed", vars: { name: "revue" } });
assert.equal(noticeHead({ kind: "task", status: "failed", task: null }).key, "head.taskFailed");
assert.equal(noticeHead({ kind: "task", status: "killed", task: "x" }).key, "head.taskStoppedNamed");
assert.equal(noticeHead(null).key, "sentDuring");
const keys = ["head.msg", "head.said", "head.idle", "head.idleSaid", "head.peer", "head.peerSaid", "head.task", "head.taskNamed", "head.taskFailed", "head.taskFailedNamed", "head.taskStopped", "head.taskStoppedNamed", "sentDuring"];
for (const lang of ["fr", "en"]) for (const k of keys) {
  assert.ok(strings[lang][k], `${lang}.${k}`);
  assert.ok(!String(strings[lang][k]).includes("—"), `${lang}.${k}: no em dash`);
}
assert.equal(strings.fr["head.idle"].replace("{name}", "lot-a"), "lot-a a fini son tour");
assert.equal(strings.fr["head.peer"].replace("{name}", "claude-80"), "claude-80 (session)");

// ── The veil under the column: where the background shows, off the rounded corners ───────────────
const vr = veilRects({ w: 1200, h: 1000, column: 832 });
assert.deepEqual(vr.map((v) => [v.x, v.w, v.y, v.h, v.fade]), [[184, 832, 0, 180, false], [184, 832, 180, 540, true]]);
assert.equal(vr[1].y + vr[1].h, Math.round(1000 * 0.72), "gone where the image is gone (fadeAt)");
assert.ok(fadeAt(0.72) === 0 && fadeAt(0.18) === 1);
assert.equal(veilRects({ w: 1200, h: 1000, column: 832, haze: true })[1].y + veilRects({ w: 1200, h: 1000, column: 832, haze: true })[1].h, 760, "the Haze's veil follows its own fade");
const narrow = veilRects({ w: 600, h: 400, column: 832 });
assert.deepEqual([narrow[0].x, narrow[0].x + narrow[0].w], [16, 584], "a narrow view: kept off the corners");
assert.deepEqual(veilRects({ w: 20, h: 400 }), []);

// #81, @'s files (Kylian's probe, 2026-11-20: a thread at ~, « aucune correspondance »): ~ is no git repo,
// git ls-files fails (128) and the list stayed empty. Now: git's list in a repo; else the folder's own,
// bounded, `cut` past the cap.
assert.deepEqual(filesRead({ code: 0, stdout: "b.js\na.md\n" }, null), { files: ["b.js", "a.md"], cut: false }, "a repo: git's list");
assert.equal(filesRead({ code: 128, stdout: "" }, { code: 1, stdout: "" }), null, "neither read: nothing new");
assert.deepEqual(filesRead({ code: 128, stdout: "" }, { code: 0, stdout: "x.md\nsub/y.js\n" }), { files: ["x.md", "sub/y.js"], cut: false }, "not a repo: the folder's own files");
const big = filesRead({ code: 128 }, { code: 0, stdout: Array.from({ length: 6 }, (_, i) => `f${i}`).join("\n") }, 5);
assert.deepEqual([big.files.length, big.cut], [5, true], "bounded at the cap, and it says so");
// The real listing on a folder made here: hidden files and folders, app bundles, node_modules, deeper than
// FILES.DEPTH, all left out; paths relative to the folder, sorted.
{
  const d = mkdtempSync(`${tmpdir()}/kt-chat-files-`);
  try {
    for (const p of ["notes.md", "a/b/c/d.md", "a/b/c/e/too-deep.md", ".hidden.md", ".git/config", "node_modules/m/i.js", "X.app/Contents/Info.plist", "src/main.js"]) {
      mkdirSync(`${d}/${p.split("/").slice(0, -1).join("/")}`, { recursive: true });
      writeFileSync(`${d}/${p}`, "x");
    }
    const r = Bun.spawnSync(["/bin/sh", "-c", FILES.LIST, "sh", d, String(FILES.DEPTH), String(FILES.CAP + 1)]);
    assert.deepEqual(filesRead({ code: 128 }, { code: r.exitCode, stdout: String(r.stdout) }), { files: ["a/b/c/d.md", "notes.md", "src/main.js"], cut: false }, "the folder's files, bounded");
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}

// #81, the field's wave (Kylian, 2026-11-20: dither pixels, very light, from a corner): a Bayer 4 × 4 dither
// in the card's top-left corner, densest there, none at the far edge, none outside the rounded corner; few
// enough cells to draw (each one an element). A keystroke's flicker: a few of them, the same for the same n.
{
  const cells = ditherCells();
  const { W, H, CELL, R } = FIELD_FX;
  assert.ok(cells.length > 50 && cells.length < 300, `a light dither, ${cells.length} cells`);
  assert.ok(cells.every((p) => p.x >= 0 && p.y >= 0 && p.x < W && p.y < H && p.d >= 0 && p.d <= 1), "inside its corner, its distance from 0 to 1");
  const near = cells.filter((p) => p.d < 0.25).length, far = cells.filter((p) => p.d > 0.75).length;
  assert.ok(near > 2 * far, `densest at the corner (${near} near, ${far} far)`);
  assert.ok(!cells.some((p) => { const m = [p.x + CELL / 2, p.y + CELL / 2]; return m[0] < R && m[1] < R && Math.hypot(R - m[0], R - m[1]) > R; }), "none outside the rounded corner");
  const f = flickerCells(3);
  assert.equal(new Set(f).size, FIELD_FX.FLICK_N, "a few distinct cells");
  assert.ok(f.every((p) => cells.some((q) => q.x === p.x && q.y === p.y)), "of the corner's dither");
  assert.deepEqual(flickerCells(3), f, "the same keystroke, the same cells");
  assert.notDeepEqual(flickerCells(4), f, "the next one, others");
}

console.log("chat-view ok");
