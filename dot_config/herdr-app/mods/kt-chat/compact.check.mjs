// bun compact.check.mjs: compact.js (« Compacter », kt-chat and kt-context) on a fake host: the ask and its
// own id, a yes for another id or too late does nothing, a working agent waits for the end of its turn
// (a press cancels it), one send per ask whatever ticks, the keys route (Enter only on « /compact ») or
// herdr-bridge's say when its token is fresh, the turn followed to its end (compacted, or « Not enough
// messages to compact. »), a failure's words, a wait dropped when its session or its terminal goes, the
// button. The screens are shaped as a throwaway session showed them (haiku, 2.1.328). No terminal is
// touched. gpui mocked.
import assert from "node:assert/strict";
import { plugin } from "bun";

const el = (kind) => {
  const node = { kind, kids: [], props: {}, on: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "when") return a[0] ? a[1](p) : p;
        else if (k.startsWith("on_")) target.on[k] = a.at(-1);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
plugin({
  setup(b) {
    b.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el("div"), svg: () => el("svg") } }));
    b.module("gpui-base", () => ({ loader: "object", exports: { h_flex: () => el("h") } }));
    b.module("herdr", () => ({ loader: "object", exports: { shared: () => null, checking: () => true } })); // i18n.js: French
  },
});
const { Compactor, whenOf, compactButton, ioOf, answerOf, endOf, TTL, WAIT, SHOWN, COMPACT } = await import("./compact.js");

const RULE = "─".repeat(20);
const COMPACTED = "Compacted (ctrl+o to see full summary)";
// A fake host: one agent t9, its screen (hc read), the keys typed, its turn count (hc get), files (the
// bridge's mailbox). Enter runs the command at once: one more turn, its answer on screen.
function host({ status = "idle", before = "", list = null, files = {}, answer = COMPACTED, get = true } = {}) {
  const h = {
    st: status, typed: "", ran: false, turn: 4, calls: [], overlays: [], files,
    agents: () => (h.st == null ? [] : [{ address: "t9", status: h.st }]),
    hc: async (a) => {
      h.calls.push(a.join(" "));
      if (a[0] === "read") {
        if (h.ran) return { code: 0, stdout: ["⏺ ok", "❯ /compact", `  ⎿  ${answer}`, RULE, "❯ ", RULE].join("\n") };
        const p = h.typed || before;
        return { code: 0, stdout: [...(list && h.typed ? [`  ❯ ${list}   Summarize`] : []), RULE, `❯ ${p}`.trimEnd(), RULE].join("\n") };
      }
      if (a[0] === "keys" && a[2] === "enter") { h.ran = true; h.turn++; }
      else if (a[0] === "keys") h.typed += a.slice(2).join("");
      if (a[0] === "get") return get ? { code: 0, stdout: JSON.stringify({ turn: h.turn, foreground: { pid: 7 } }) } : { code: 1, stdout: "" };
      return { code: 0, stdout: "" };
    },
    exec: async () => ({ code: 0, stdout: "00:30" }), // the agent's process: 30 s old
    home: () => "/tfx",
    readTextFile: async (p) => h.files[p] ?? null,
    writeTextFile: async (p, s) => { h.files[p] = s; return null; },
    stat: async () => ({ mtimeMs: Date.now() }),
    openOverlay: (o) => { h.overlays.push(o); return null; },
  };
  return h;
}
const cxOf = () => {
  const x = { tasks: [], notified: 0, spawn: (fn) => x.tasks.push(fn), notify: () => { x.notified++; }, timer: { after: (_ms, fn) => fn() } };
  return x;
};
const run = async (x) => { while (x.tasks.length) await x.tasks.shift()(x); };
const idOf = (o) => o.props.command.name.split(":").slice(1).join(":");
const keysAndReads = (h) => h.calls.filter((s) => s.startsWith("keys") || s.startsWith("read"));

assert.deepEqual(["idle", "done", "working", "blocked", null].map(whenOf), ["now", "now", "later", "later", null]);

// What the terminal answered, as the throwaway session showed it.
assert.equal(answerOf(["❯ /compact", `  ⎿  ${COMPACTED}`, "  ⎿  Read x.md (71 lines)", RULE, "❯ ", RULE].join("\n")), "done");
assert.equal(answerOf(["❯ /compact", "  ⎿  Not enough messages to compact.", RULE, "❯ ", RULE].join("\n")), "empty");
assert.equal(answerOf(["❯ /compact", "  ⎿  Not enough messages to compact.", "❯ /compact", `  ⎿  ${COMPACTED}`, RULE, "❯ ", RULE].join("\n")), "done", "the last /compact counts");

// endOf: it waits while the agent works, then for the count to pass, then reads the answer once.
{
  const seq = ["working", "working", "done", "done"];
  let n = 4, i = 0;
  const io = {
    sleep: async () => { i++; if (i === 3) n = 5; },
    status: () => seq[Math.min(i, seq.length - 1)],
    hc: async (a) => (a[0] === "get" ? { code: 0, stdout: JSON.stringify({ turn: n }) } : { code: 0, stdout: ["❯ /compact", `  ⎿  ${COMPACTED}`].join("\n") }),
  };
  assert.equal(await endOf(io, "t9", 4), "done");
  assert.equal(i, 3, "not before the turn's end");
  assert.equal(await endOf({ ...io, status: () => null }, "t9", 4), null, "its terminal gone");
}

// At rest: asked (kt-confirm, its own id), yes, one send by keys, its turn followed: « Session compactée ».
{
  const h = host();
  const c = new Compactor("kt-context", h);
  assert.equal(c.press("t9", "s1", 1000, 0.5), "asked");
  const d = h.overlays[0];
  assert.equal(d.mod, "kt-confirm");
  assert.equal(d.props.title, "Compacter la session ?");
  assert.ok(!d.props.detail.includes("fin de son tour"), "at rest: no « later » words");
  const id = idOf(d);
  assert.ok(d.props.command.name.startsWith("kt-context.compact-ok:t9~"), "its own id: the terminal and a token");
  assert.equal(c.yes("t9~other", 2000), false, "another ask's yes: nothing");
  assert.equal(c.yes(id, 2000), true);
  const x = cxOf();
  assert.equal(c.tick(x, { address: "t9", session: "s1" }, 2100), true);
  assert.equal(c.tick(x, { address: "t9", session: "s1" }, 2200), false, "a second tick (the timer, a render): nothing more");
  assert.equal(x.tasks.length, 1, "one send");
  assert.deepEqual([c.words("t9").note, c.words("t9").press], ["Compaction…", false], "going: the button waits");
  await run(x);
  assert.deepEqual(keysAndReads(h), ["read t9", "keys t9 / c o m p a c t", "read t9", "keys t9 enter", "read t9"], "the keys route, Enter on « /compact », its answer read once");
  assert.deepEqual([c.words("t9").note, c.words("t9").label, c.words("t9").press], ["Session compactée", "Compacter", true]);
  c.tick(cxOf(), {}, Date.now() + SHOWN + 1);
  assert.equal(c.words("t9").note, null, "then it goes");
}

// A session too short: Claude Code says so; so does the note.
{
  const h = host({ answer: "Not enough messages to compact." });
  const c = new Compactor("kt-chat", h);
  c.press("t9", null, 0, 0.11);
  c.yes(idOf(h.overlays[0]), 1);
  const x = cxOf();
  c.tick(x, {}, 2);
  await run(x);
  assert.deepEqual([c.words("t9").note, c.words("t9").error], ["Compaction pas faite : rien à compacter, la conversation est trop courte", true]);
}

// Working: the ask says so, the yes waits for the end of the turn, a press meanwhile cancels it.
{
  const h = host({ status: "working" });
  const c = new Compactor("kt-chat", h);
  c.press("t9", "s1", 1000, 0.1);
  assert.ok(h.overlays[0].props.detail.includes("L'agent travaille : la compaction partira à la fin de son tour."));
  assert.ok(h.overlays[0].props.command.name.startsWith("kt-chat.compact-ok:"));
  c.yes(idOf(h.overlays[0]), 1500);
  const x = cxOf();
  c.tick(x, {}, 2000);
  assert.equal(x.tasks.length, 0, "working: it waits");
  assert.deepEqual([c.words("t9").note, c.words("t9").label], ["Compaction à la fin du tour", "Annuler"]);
  assert.equal(c.press("t9", "s1", 2500), "cancelled");
  h.st = "idle";
  c.tick(x, {}, 3000);
  assert.deepEqual([x.tasks.length, h.calls.length], [0, 0], "cancelled: nothing goes at rest");
  // Asked again, waiting, then the turn ends: it goes, once.
  c.press("t9", "s1", 4000, 0.2);
  h.st = "working";
  c.yes(idOf(h.overlays[1]), 4100);
  c.tick(x, {}, 5000);
  h.st = "done";
  c.tick(x, {}, 6000);
  c.tick(x, {}, 6001);
  assert.equal(x.tasks.length, 1, "the end of the turn: one send");
  await run(x);
  assert.ok(h.calls.includes("keys t9 enter"));
  assert.equal(c.words("t9").note, "Session compactée");
}

// A failure says why (no raw code), and goes after a while; the prompt holds a draft: nothing typed.
{
  const h = host({ before: "un brouillon" });
  const c = new Compactor("kt-chat", h);
  c.press("t9", null, 0, 0.3);
  c.yes(idOf(h.overlays[0]), 10);
  const x = cxOf();
  c.tick(x, {}, 20);
  await run(x);
  assert.equal(h.calls.some((s) => s.startsWith("keys")), false);
  const w = c.words("t9");
  assert.deepEqual([w.note, w.error, w.press], ["Compaction pas faite : l'invite du terminal n'est pas vide", true, true]);
  c.tick(cxOf(), {}, Date.now() + SHOWN + 1);
  assert.equal(c.words("t9").note, null, "then it goes");
}

// Another command chosen in the terminal's list: no Enter.
{
  const h = host({ list: "/compact-notes" });
  const c = new Compactor("kt-chat", h);
  c.press("t9", null, 0, 0.4);
  c.yes(idOf(h.overlays[0]), 10);
  const x = cxOf();
  c.tick(x, {}, 20);
  await run(x);
  assert.equal(h.calls.includes("keys t9 enter"), false);
  assert.equal(c.words("t9").note, "Compaction pas faite : la liste de commandes propose autre chose que /compact");
}

// No turn count (hc get failed): sent, not followed; it goes after a while.
{
  const h = host({ get: false });
  const c = new Compactor("kt-chat", h);
  c.press("t9", null, 0, 0.45);
  c.yes(idOf(h.overlays[0]), 10);
  const x = cxOf();
  c.tick(x, {}, 20);
  await run(x);
  assert.equal(c.words("t9").note, "Compaction en cours");
  c.tick(cxOf(), {}, Date.now() + SHOWN + 1);
  assert.equal(c.words("t9").note, null);
}

// Too late, gone, changed: an old yes does nothing; a wait whose session changes, or whose terminal goes, is dropped.
{
  const h = host({ status: "working" });
  const c = new Compactor("kt-chat", h);
  c.press("t9", "s1", 0, 0.5);
  assert.equal(c.yes(idOf(h.overlays[0]), TTL + 1), false, "answered too late");
  assert.equal(c.words("t9").note, null);
  c.press("t9", "s1", 0, 0.6);
  c.yes(idOf(h.overlays[1]), 1);
  c.tick(cxOf(), { address: "t9", session: "s2" }, 2);
  assert.equal(c.words("t9").note, null, "another session in that terminal: dropped");
  c.press("t9", "s1", 0, 0.7);
  c.yes(idOf(h.overlays[2]), 1);
  c.tick(cxOf(), { address: "t5", session: "other" }, 2);
  assert.equal(c.words("t9").note, "Compaction à la fin du tour", "the view follows another terminal: the wait stays");
  c.tick(cxOf(), {}, WAIT + 10);
  assert.equal(c.words("t9").note, null, "waited too long: dropped");
  c.press("t9", "s1", 0, 0.8);
  c.yes(idOf(h.overlays[3]), 1);
  h.st = null;
  c.tick(cxOf(), {}, 2);
  assert.equal(c.words("t9").note, null, "its terminal gone: dropped");
  assert.equal(c.press("t9", "s1", 3), null, "no agent: no ask");
}

// herdr-bridge's say when its session token is fresh: /compact into the box, Enter after its ok.
{
  const P = (n) => `/tfx/.claude/cache/herdr/t9.${n}.json`;
  const h = host({ files: { [P("saytoken")]: JSON.stringify({ token: "test-token-fixture" }) } });
  const write = h.writeTextFile;
  h.writeTextFile = async (p, s) => {
    await write(p, s);
    if (p === P("say")) h.files[P("said")] = JSON.stringify({ id: JSON.parse(s).id, ok: true }); // the plugin's answer
  };
  const c = new Compactor("kt-chat", h);
  c.press("t9", null, 0, 0.9);
  c.yes(idOf(h.overlays[0]), 1);
  const x = cxOf();
  c.tick(x, {}, 2);
  await run(x);
  assert.equal(JSON.parse(h.files[P("say")]).text, COMPACT, "the bridge types /compact");
  assert.deepEqual(h.calls.filter((s) => s.startsWith("keys")), ["keys t9 enter"], "no keys typed by hand; Enter after its ok");
  assert.equal(c.words("t9").note, "Session compactée");
}

// ioOf: the task's timer for sleep, the agent's status by address.
{
  const h = host({ status: "working" });
  let slept = 0;
  const io = ioOf(h, { timer: { after: (ms, fn) => { slept += ms; fn(); } } }, "t9");
  await io.sleep(120);
  assert.deepEqual([slept, io.status(), await io.blocked("t9")], [120, "working", false]);
}

// A.9: one state for the Chat and Context (shared "kt.compact"): the Chat asks, both show the same words,
// the Chat alone sends /compact, both say it done with the compaction's tokens (its transcript's).
{
  const h = host();
  const store = {};
  h.shared = (k) => store[k];
  h.setShared = (k, v) => { store[k] = v; return null; };
  const chat = new Compactor("kt-chat", h), ctx = new Compactor("kt-context", h);
  chat.press("t9", "s1", 1000, 0.3);
  assert.equal(ctx.words("t9").label, "Compacter", "asked, not said yes to yet: the button as at rest");
  assert.equal(ctx.yes(idOf(h.overlays[0]), 1100), true, "the yes reaches the ask wherever it is read");
  assert.deepEqual([chat.words("t9").note, ctx.words("t9").note], ["Compaction à la fin du tour", "Compaction à la fin du tour"], "the same words in both views");
  const cx2 = cxOf(), cx1 = cxOf();
  ctx.tick(cx2, { address: "t9", session: "s1" }, 1200);
  assert.equal(cx2.tasks.length, 0, "Context didn't ask: it never sends");
  chat.tick(cx1, { address: "t9", session: "s1" }, 1300);
  assert.equal(cx1.tasks.length, 1, "the Chat asked: it sends, once");
  assert.equal(ctx.words("t9").note, "Compaction…", "Context shows it going");
  await run(cx1);
  const cut = { at: Date.now(), pre: 95348, post: 23005 };
  assert.match(ctx.words("t9", cut).note, /^Session compactée, 95.* → 23.* tokens$/, "done, said with the tokens before and after");
  assert.equal(ctx.words("t9", { at: 1000 - 60000, pre: 1, post: 1 }).note, "Session compactée", "an older compaction's tokens aren't this one's");
}

// A.9: a send or a follow whose task went with its view (shared outlives a reload, a restart): past STUCK,
// whoever owns it, it goes; before that, it stays (another view's task may still be on it).
{
  const { STUCK } = await import("./compact.js");
  const h = host();
  const store = { "kt.compact": { t9: { id: "t9~x", owner: "kt-chat#gone", phase: "going", at: 1000, asked: 900 } } };
  h.shared = (k) => store[k];
  h.setShared = (k, v) => { store[k] = v; return null; };
  const ctx = new Compactor("kt-context", h);
  ctx.tick(cxOf(), {}, 1000 + STUCK - 1);
  assert.equal(ctx.words("t9").phase, "going", "not yet: its owner may still be on it");
  ctx.tick(cxOf(), {}, 1000 + STUCK + 1);
  assert.equal(ctx.words("t9").phase, null, "past STUCK: let go, the button again");
  assert.equal(ctx.words("t9").press, true);
}

// A.9: the status's mark, the same in both views: nothing at rest, a dot breathing while it goes (a native
// loop, still in reduced motion), the check, the alert.
{
  const { compactStatus } = await import("./compact.js");
  const t = { muted: "m", done: "ok", ansi1: "err", accent: "a" };
  assert.equal(compactStatus(t, "kc-cs", { note: null }), null, "at rest: nothing");
  const going = compactStatus(t, "kc-cs", { phase: "sent", note: "Compaction en cours" });
  assert.ok(going.kids[0].props.loop, "going: the dot breathes");
  assert.equal(compactStatus(t, "kc-cs", { phase: "sent", note: "x" }, { still: true }).kids[0].props.loop, undefined, "reduced motion: still");
  assert.equal(compactStatus(t, "kc-cs", { phase: "done", note: "x" }).kids[0].kind, "svg", "done: its mark");
  assert.deepEqual(compactStatus(t, "kc-cs", { phase: "failed", note: "x" }).props.text_color, ["err"], "failed: said as an error");
}

// The button: its words, pressable or not.
{
  const t = { border: "b", muted: "m", dim: "d", hover: "h", foreground: "f" };
  let pressed = 0;
  const on = compactButton(t, "kc-compact", { label: "Compacter", tip: "x", press: true }, () => pressed++);
  assert.deepEqual([on.props.id, on.kids[0].kids], [["kc-compact"], ["Compacter"]]);
  assert.deepEqual(on.props.h, [22], "never taller than its line");
  on.on.on_click(null, { stop_propagation() {}, notify() {} });
  assert.equal(pressed, 1);
  const off = compactButton(t, "kc-compact", { label: "Compaction…", tip: "x", press: false }, () => pressed++);
  assert.equal(off.on.on_click, undefined, "going: no press");
}

console.log("kt-chat compact: ok");
