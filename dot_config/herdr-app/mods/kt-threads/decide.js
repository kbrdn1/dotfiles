// What an agent's terminal waits on from Kylian, and his answer from Herdr. Used by the toast; meant
// for any card that shows an agent (kt-threads' "a besoin de toi"):
//
//   const d = await decide(terminal)    // { terminal, pending, accept(), refuse(), open() }
//   decisionButtons(d, { onDone })      // the pills, or null when there is nothing to show
//
// `pending` is { id, kind, title, detail, options: [{ key, label, tone }] } or null:
// - kind "permission": herdr-bridge (>= 0.3.0) publishes it in ~/.claude/cache/herdr/<t>.json while a
//   permission dialog is up. accept()/refuse() write <t>.decision.json = { id, choice }; the plugin
//   applies it only for the id it still waits on, once, and answers the engine's dialog itself.
// - kind "held": a message from another session held for approval. No hook can release it: it is read
//   off the screen (`hc read`) and answered with keys (`hc keys`), each step after reading the screen
//   again and finding the same dialog; Enter only once the cursor is seen on the chosen line.
// - kind "question" (AskUserQuestion, a plan) or "input" (blocked or idle, waiting for a reply): no
//   options. Only open(): Kylian answers in the conversation.
// Nothing here answers on its own: accept() and refuse() run from a click. "Always allow" and the like
// are never offered: the options are yes/no (permission) or deliver/refuse (held), nothing else.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, hc, home, readTextFile, run, theme, writeTextFile } from "herdr";

const MONO = "Monaspace Krypton";
// The held-message dialog as Claude Code 2.1.327 draws it: its title, then its two lines, Deny first.
const HELD = "Held message from another session";
const SENT = "Another Claude session sent a message:";
const DENY = "Deny — drop it and tell the sender it was declined";
const DELIVER = "Deliver this message to Claude";
// Deliver / Refuse on a held message are not offered yet: answering it by keys was never seen to work
// on a live dialog (the hold would not happen again to test it). Until then a held message only gets
// Ouvrir. To offer them, put back:
//   [{ key: "accept", label: "Livrer", tone: "positive" }, { key: "refuse", label: "Refuser", tone: "negative" }]
const HELD_OPTIONS = [];
// Ids answered from this mod (its copies share the module; another mod with its own copy of this file
// has its own sets): never answered twice, and not answered again by a second click meanwhile.
const answered = new Set();
const busy = new Set();

const cache = (terminal) => `${home()}/.claude/cache/herdr/${terminal}`;
const alpha = (c, a) => (c ?? "#000000").slice(0, 7) + a;
async function readJson(path) {
  try { return JSON.parse((await readTextFile(path)) ?? "null"); } catch { return null; }
}
// A short stable id for what a held dialog shows.
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// The held-message dialog at the bottom of `screen` (`hc read` text), or null: its sender, body, the
// line the cursor is on (0 Deny, 1 Deliver) and an id from what it shows. Anything that does not read
// exactly like it (another dialog, lines under its options, no cursor) is null.
export function heldOf(screen) {
  const lines = String(screen ?? "").split("\n");
  const top = lines.map((l) => l.trim()).lastIndexOf(HELD);
  if (top < 0) return null;
  const rest = lines.slice(top + 1);
  const deny = rest.findIndex((l) => l.includes(DENY));
  if (deny < 0 || !rest[deny + 1]?.includes(DELIVER)) return null;
  if (rest.slice(deny + 2).some((l) => l.trim())) return null;
  const on = (l) => /^\s*❯\s/.test(l);
  const cursor = on(rest[deny]) ? 0 : on(rest[deny + 1]) ? 1 : -1;
  const rules = rest.map((l, i) => (i < deny && /^\s*╌{8,}\s*$/.test(l) ? i : -1)).filter((i) => i >= 0);
  const body = rules.length >= 2 ? rest.slice(rules[0] + 1, rules[1]).map((l) => l.trim()).join("\n").trim() : "";
  const from = (rest.find((l) => l.includes(SENT)) ?? "").split(SENT)[1]?.trim() ?? "";
  if (cursor < 0 || !body) return null;
  const sender = /peer claims name: ([^)\s]+)/.exec(from)?.[1] ?? from;
  return { id: `held:${hash(`${from}\n${body}`)}`, sender, body, cursor };
}

const look = async (terminal) => heldOf((await hc(["read", terminal])).stdout);

// Moves the held dialog's cursor to `target` and presses Enter, refusing at the first sign the screen
// is no longer the dialog Kylian saw.
async function sendHeld(terminal, pending, target) {
  let held = await look(terminal);
  if (held?.id !== pending.id) return { ok: false, reason: "L'écran a changé : rien envoyé." };
  const start = held.cursor;
  const key = target > start ? "down" : "up";
  for (let i = Math.abs(target - start); i > 0; i--) await hc(["keys", terminal, key]);
  for (let i = 0; i < 10 && held?.id === pending.id && held.cursor !== target; i++) held = await look(terminal);
  if (held?.id !== pending.id || held.cursor !== target) {
    // Never leave the cursor on Deliver for an Enter typed later: put it back where it was.
    if (held?.id === pending.id && held.cursor !== start) await hc(["keys", terminal, held.cursor > start ? "up" : "down"]);
    return { ok: false, reason: "Curseur introuvable sur ce choix : rien validé." };
  }
  answered.add(pending.id);
  await hc(["keys", terminal, "enter"]);
  for (let i = 0; i < 10 && held?.id === pending.id; i++) held = await look(terminal);
  return held?.id === pending.id ? { ok: false, reason: "Envoyé, mais le dialogue est toujours là." } : { ok: true };
}

async function answer(terminal, pending, choice) {
  if (!pending?.options?.some((o) => o.key === choice)) return { ok: false, reason: "Rien à répondre ici." };
  if (answered.has(pending.id) || busy.has(pending.id)) return { ok: false, reason: "Déjà répondu." };
  busy.add(pending.id);
  try {
    if (pending.kind === "held") return await sendHeld(terminal, pending, choice === "accept" ? 1 : 0);
    // The plugin answers only the id it still waits on: check it is still that one before writing.
    const live = await readJson(`${cache(terminal)}.json`);
    if (live?.pending?.id !== pending.id) return { ok: false, reason: "La demande n'est plus en attente." };
    const path = `${cache(terminal)}.decision.json`;
    await writeTextFile(path, JSON.stringify({ id: pending.id, choice }), await readTextFile(path));
    answered.add(pending.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `Échec : ${e?.message ?? e}` };
  } finally {
    busy.delete(pending.id);
  }
}

// What `terminal` waits on now, and how to answer it. The screen is read only for a blocked agent the
// plugin says nothing actionable about.
export async function decide(terminal) {
  let pending = (await readJson(`${cache(terminal)}.json`))?.pending ?? null;
  const blocked = agents().find((a) => a.address === terminal)?.status === "blocked";
  if (blocked && pending?.kind !== "permission" && pending?.kind !== "question") {
    const held = await look(terminal).catch(() => null);
    if (held) pending = { id: held.id, kind: "held", title: `Message de ${held.sender}`, detail: held.body, options: HELD_OPTIONS };
    else pending ??= { id: `input:${terminal}`, kind: "input", title: "Attend ta réponse", options: [] };
  }
  // Answered once from here: the same dialog gets no buttons again.
  if (pending && answered.has(pending.id)) pending = { ...pending, options: [] };
  return {
    terminal,
    pending,
    accept: () => answer(terminal, pending, "accept"),
    refuse: () => answer(terminal, pending, "refuse"),
    open: () => run("agent.focus", { terminal }),
  };
}

// The pills' keys in order ("accept", "refuse", or "open"), for a keyboard cursor; [] when nothing waits.
export const pillKeys = (d) => (d?.pending ? (d.pending.options?.length ? d.pending.options.map((o) => o.key) : ["open"]) : []);

// What the pill `key` does, as a click on it: { ok, reason? }.
export async function press(d, key) {
  if (key === "open") { d.open(); return { ok: true }; }
  return key === "accept" ? d.accept() : d.refuse();
}

// The pills for `d`: Accepter / Refuser when it has options, Ouvrir when it only has a conversation to
// go to, null when nothing waits. A click stops there (the card under it is not opened) and hands its
// result to `onDone(result, cx)`: { ok, reason? }. Ids carry the terminal, so several cards can share
// one view. `cursor`: the key of the pill under a keyboard cursor, drawn with an accent ring.
export function decisionButtons(d, { onDone, cursor = null } = {}) {
  const p = d?.pending;
  if (!p) return null;
  const t = theme();
  const pill = (key, label, color) =>
    div().id(`decide-${key}-${d.terminal}`).flex_none().h(20).px(8).flex().items_center().rounded_full()
      .border(1).border_color(key === cursor ? alpha(t.accent, "99") : color ? alpha(color, "4d") : t.input)
      .when(Boolean(color) || key === cursor, (el) => el.bg(key === cursor ? alpha(t.accent, "24") : alpha(color, "1a")))
      .font_family(MONO).text_size(10).text_color(color ?? t.foreground).cursor_pointer()
      .hover((s) => s.bg(color ? alpha(color, "33") : t.hover))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        cx.spawn(async (cx) => onDone?.(await press(d, key), cx));
      })
      .child(label.toUpperCase());
  if (!p.options?.length) return h_flex().flex_none().child(pill("open", "Ouvrir", null));
  return h_flex().flex_none().gap(4).children(p.options.map((o) => pill(o.key, o.label, o.tone === "positive" ? t.done : t.ansi1)));
}
