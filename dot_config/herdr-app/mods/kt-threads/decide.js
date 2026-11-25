// What an agent's terminal waits on from Kylian, and his answer from Herdr. Used by the toast; meant
// for any card that shows an agent (kt-threads' "a besoin de toi"):
//
//   const d = await decide(terminal)    // { terminal, pending, choose(key), open() }
//   decisionButtons(d, { onDone })      // the pills, or null when there is nothing to show
//
// `pending` is { id, kind, title, detail, options: [{ key, kind, tone, label, note?, mode?, update?,
// answer? }] } or null:
// - kind "permission": herdr-bridge publishes it in ~/.claude/cache/herdr/<t>.json while a permission
//   dialog is up; the plugin applies the answer only for the id it still waits on, once. Two versions
//   live side by side until every session has restarted, told apart by their options (`tokened`):
//   - >= 0.4.0: the terminal's own choices, each with its `kind`, and the request's one-time token in
//     <t>.ask.json = { id, token }. choose(key) writes <t>.decision.json = { id, token, choice }, and
//     the plugin returns that choice's own decision (never one from the file);
//   - 0.3.1: Accepter / Refuser (`accept`, `refuse`), no kind, no token. choose(key) writes
//     <t>.decision.json = { id, choice }.
// - kind "held": a message from another session held for approval. No hook can release it: it is read
//   off the screen (`hc read`) and answered with keys (`hc keys`), each step after reading the screen
//   again and finding the same dialog; Enter only once the cursor is seen on the chosen line.
// - kind "question" (AskUserQuestion, a plan) or "input" (blocked or idle, waiting for a reply): no
//   options. Only open(): Kylian answers in the conversation.
// - herdr-bridge >= 0.6.0 (kbrdn-herdr #18), the Chat alone: an AskUserQuestion's `questions`, answered
//   whole, and an MCP server's form (kind "elicitation"), answered by reply(). A request marked `ack`
//   (a sub-agent's dialog, a form) is drawn by the terminal only once the plugin gives up on Herdr: the
//   Chat says it shows it, acknowledge(), and the plugin then waits for the answer; else it gives it
//   back to the terminal after 3 s. The cards, which don't acknowledge, offer such a request Ouvrir only.
// Nothing here answers on its own: choose() runs from a click. The cards (toast, sidebar, Kanban) get
// the plain choices only: Yes, No, a plan's Yes, a question's answers. A choice that sets a rule or a
// mode (`update`), or that takes a note, is offered by the Chat alone, `decide(t, { full: true })`,
// where Kylian reads what it allows and types the note. choose() says `note: true` for such a choice:
// the caller then sends the note as his own message.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, hc, home, readTextFile, run, theme, writeTextFile } from "herdr";
import { makeT } from "./i18n.js";
import words from "./decide.strings.js";

// Its own words (I18N.md), copied with it.
const tr = makeT(words);
const MONO = "Monaspace Krypton";
// The held-message dialog as Claude Code 2.1.327 draws it: its title, then its two lines, Deny first.
// i18n: tech (read on the screen)
const HELD = "Held message from another session";
const SENT = "Another Claude session sent a message:"; // i18n: tech
const DENY = "Deny — drop it and tell the sender it was declined"; // i18n: tech
const DELIVER = "Deliver this message to Claude"; // i18n: tech
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
  if (held?.id !== pending.id) return { ok: false, reason: tr("changed") };
  const start = held.cursor;
  const key = target > start ? "down" : "up";
  for (let i = Math.abs(target - start); i > 0; i--) await hc(["keys", terminal, key]);
  for (let i = 0; i < 10 && held?.id === pending.id && held.cursor !== target; i++) held = await look(terminal);
  if (held?.id !== pending.id || held.cursor !== target) {
    // Never leave the cursor on Deliver for an Enter typed later: put it back where it was.
    if (held?.id === pending.id && held.cursor !== start) await hc(["keys", terminal, held.cursor > start ? "up" : "down"]);
    return { ok: false, reason: tr("noCursor") };
  }
  answered.add(pending.id);
  await hc(["keys", terminal, "enter"]);
  for (let i = 0; i < 10 && held?.id === pending.id; i++) held = await look(terminal);
  return held?.id === pending.id ? { ok: false, reason: tr("stillThere") } : { ok: true };
}

/** A request from herdr-bridge >= 0.4.0 (its options say their kind, and its token is apart), else 0.3.1. */
export const tokened = (pending) => (pending?.options ?? []).some((o) => typeof o?.kind === "string");

async function answer(terminal, pending, choice, withToken) {
  if (!pending?.options?.some((o) => o.key === choice)) return { ok: false, reason: tr("nothing") };
  if (answered.has(pending.id) || busy.has(pending.id)) return { ok: false, reason: tr("already") };
  busy.add(pending.id);
  try {
    if (pending.kind === "held") return await sendHeld(terminal, pending, choice === "accept" ? 1 : 0);
    // The plugin answers only the id it still waits on: check it is still that one before writing.
    const live = await readJson(`${cache(terminal)}.json`);
    if (live?.pending?.id !== pending.id) return { ok: false, reason: tr("gone") };
    let reply = { id: pending.id, choice }; // 0.3.1
    if (withToken) {
      // >= 0.4.0: the request's one-time token, for this id only: no token, no answer (it would be ignored).
      const ask = await readJson(`${cache(terminal)}.ask.json`);
      if (ask?.id !== pending.id || typeof ask.token !== "string" || !ask.token) return { ok: false, reason: tr("gone") };
      reply = { id: pending.id, token: ask.token, choice };
    }
    const path = `${cache(terminal)}.decision.json`;
    await writeTextFile(path, JSON.stringify(reply), await readTextFile(path));
    answered.add(pending.id);
    return { ok: true, note: pending.options.find((o) => o.key === choice)?.note === true };
  } catch (e) {
    return { ok: false, reason: tr("failed", { why: e?.message ?? e }) };
  } finally {
    busy.delete(pending.id);
  }
}

// What a request says, in the language shown. herdr-bridge publishes its title and labels in French, and
// what they say as data too (kind, tool, notice; an option's key, kind, note, mode, update): they are said
// again from that. Its own text stays for the rest (a question's answers, a notice in the engine's words,
// a newer bridge's choice).
const ASKS = { ExitPlanMode: "planTitle", EnterPlanMode: "enterPlan", AskUserQuestion: "question" };
const MODES = { auto: "modeAuto", acceptEdits: "modeEdits", default: "modeManual", plan: "modePlan" };
const WHERE = { session: "whereSession", localSettings: "whereLocal", projectSettings: "whereRepo", userSettings: "whereAll" };
export function titleOf(p) {
  if (!p) return "";
  if (p.kind === "input") return (p.notice && p.title) || tr("waiting");
  if (ASKS[p.tool]) return tr(ASKS[p.tool]);
  if (p.kind === "permission" && p.tool) return tr("allow", { tool: p.tool });
  return p.title ?? "";
}
const ruleOf = (u) => (Array.isArray(u?.rules) ? u.rules.map((r) => (r.ruleContent ? `${r.toolName}(${r.ruleContent})` : r.toolName)).join(", ")
  : Array.isArray(u?.directories) ? u.directories.join(", ") : MODES[u?.mode] ? tr(MODES[u.mode]) : String(u?.mode ?? ""));
const whereOf = (d) => (WHERE[d] ? tr(WHERE[d]) : String(d ?? ""));
export function labelOf(o) {
  if (["yes", "no", "accept", "refuse"].includes(o?.key)) return tr(o.key);
  if (o?.key === "plan-default") return tr("planManual");
  if (o?.key === "plan-change") return tr("planChange");
  if (o?.kind === "yes" && o.note) return tr("yesNote");
  if (o?.kind === "no" && o.note) return tr("noNote");
  if (o?.kind === "mode" && o.update) return tr("yesMode", { mode: ruleOf(o.update), where: whereOf(o.update.destination) });
  if (o?.kind === "rule" && o.update) return tr("yesRule", { rule: ruleOf(o.update), where: whereOf(o.update.destination) });
  return o?.label ?? o?.key ?? "";
}

// The request's one-time token from <t>.ask.json, for this id only, or null.
async function tokenFor(terminal, pending) {
  const ask = await readJson(`${cache(terminal)}.ask.json`);
  return ask?.id === pending.id && typeof ask.token === "string" && ask.token ? ask.token : null;
}

// Ids acknowledged from this mod: once each.
const acked = new Set();

/**
 * Herdr shows `pending` (marked `ack`: a sub-agent's dialog, an MCP form): <t>.ack.json = { id, token },
 * once per id. The Chat calls it from a task once its card shows the request; true when written.
 */
export async function acknowledge(terminal, pending) {
  if (!pending?.ack || acked.has(pending.id)) return false;
  acked.add(pending.id);
  try {
    const token = await tokenFor(terminal, pending);
    if (!token) return false;
    const path = `${cache(terminal)}.ack.json`;
    await writeTextFile(path, JSON.stringify({ id: pending.id, token }), await readTextFile(path));
    return true;
  } catch {
    acked.delete(pending.id); // read again, tried again
    return false;
  }
}

/**
 * The Chat's whole answer to `pending` (herdr-bridge >= 0.6.0): `fields` is { answers } for an
 * AskUserQuestion, { action, content? } for an MCP form (bridge-model.js builds them). Written with the
 * request's token, once, while the plugin still waits on that id: { ok, reason? }.
 */
export async function reply(terminal, pending, fields) {
  if (!pending?.id) return { ok: false, reason: tr("nothing") };
  if (answered.has(pending.id) || busy.has(pending.id)) return { ok: false, reason: tr("already") };
  busy.add(pending.id);
  try {
    const live = await readJson(`${cache(terminal)}.json`);
    const token = live?.pending?.id === pending.id ? await tokenFor(terminal, pending) : null;
    if (!token) return { ok: false, reason: tr("gone") };
    const path = `${cache(terminal)}.decision.json`;
    await writeTextFile(path, JSON.stringify({ ...fields, id: pending.id, token }), await readTextFile(path));
    answered.add(pending.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: tr("failed", { why: e?.message ?? e }) };
  } finally {
    busy.delete(pending.id);
  }
}

// What `terminal` waits on now, and how to answer it. The screen is read only for a blocked agent the
// plugin says nothing actionable about. `full`: every choice the terminal offers (the Chat); else the
// plain ones only (the cards). `acks`: the caller acknowledges what it shows (the Chat, acknowledge()),
// so a request that waits on it keeps its choices; else it gets « Ouvrir » only.
export async function decide(terminal, { full = false, acks = full } = {}) {
  let pending = (await readJson(`${cache(terminal)}.json`))?.pending ?? null;
  const blocked = agents().find((a) => a.address === terminal)?.status === "blocked";
  if (blocked && !["permission", "question", "elicitation"].includes(pending?.kind)) {
    const held = await look(terminal).catch(() => null);
    if (held) pending = { id: held.id, kind: "held", title: tr("from", { sender: held.sender }), detail: held.body, options: HELD_OPTIONS };
    else pending ??= { id: `input:${terminal}`, kind: "input", title: tr("waiting"), options: [] };
  }
  // Which bridge asks, read on the request as published (before any filter below).
  const withToken = tokened(pending);
  // The cards' choices: none that sets a rule or a mode, none that takes a note.
  if (pending?.kind === "permission" && !full) pending = { ...pending, options: (pending.options ?? []).filter((o) => !o.note && !o.update) };
  // A request that waits on an acknowledgement: only a caller that gives it answers (a click elsewhere
  // would count for nothing).
  if (pending?.ack && !acks) pending = { ...pending, options: [] };
  // Answered once from here: the same dialog gets no buttons again.
  if (pending && answered.has(pending.id)) pending = { ...pending, options: [] };
  // Said in the language shown (titleOf, labelOf): every card reads these.
  if (pending) pending = { ...pending, title: titleOf(pending), options: (pending.options ?? []).map((o) => ({ ...o, label: labelOf(o) })) };
  return {
    terminal,
    pending,
    choose: (key) => answer(terminal, pending, key, withToken),
    open: () => run("agent.focus", { terminal }),
  };
}

// The pills' keys in order (the options' keys, or "open"), for a keyboard cursor; [] when nothing waits.
export const pillKeys = (d) => (d?.pending ? (d.pending.options?.length ? d.pending.options.map((o) => o.key) : ["open"]) : []);

// What the pill `key` does, as a click on it: { ok, reason?, note? }.
export async function press(d, key) {
  if (key === "open") { d.open(); return { ok: true }; }
  return d.choose(key);
}

// The pills for `d`: its choices when it has options, Ouvrir when it only has a conversation to go
// to, null when nothing waits. A click stops there (the card under it is not opened) and hands its
// result to `onDone(result, cx)`: { ok, reason? }. Ids carry the terminal, so several cards can share
// one view. `cursor`: the key of the pill under a keyboard cursor, drawn with an accent ring. `onNote(key,
// label, cx)`: a choice that takes a note (`note`) asks for it there first, nothing written yet (the Chat:
// the note typed, then press(), then the note sent as Kylian's message once the dialog is gone).
export function decisionButtons(d, { onDone, cursor = null, onNote = null } = {}) {
  const p = d?.pending;
  if (!p) return null;
  const t = theme();
  const noted = (key) => Boolean(onNote) && p.options?.some((o) => o.key === key && o.note);
  const pill = (key, label, color) =>
    div().id(`decide-${key}-${d.terminal}`).flex_none().h(20).px(8).flex().items_center().rounded_full()
      .border(1).border_color(key === cursor ? alpha(t.accent, "99") : color ? alpha(color, "4d") : t.input)
      .when(Boolean(color) || key === cursor, (el) => el.bg(key === cursor ? alpha(t.accent, "24") : alpha(color, "1a")))
      .font_family(MONO).text_size(10).text_color(color ?? t.foreground).cursor_pointer()
      .hover((s) => s.bg(color ? alpha(color, "33") : t.hover))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        if (noted(key)) return onNote(key, label, cx);
        cx.spawn(async (cx) => onDone?.(await press(d, key), cx));
      })
      .child(label.toUpperCase());
  if (!p.options?.length) return h_flex().flex_none().child(pill("open", tr("open"), null));
  // Said in the language shown now (labelOf: herdr-bridge publishes its labels in French).
  return h_flex().flex_none().gap(4).children(p.options.map((o) => pill(o.key, labelOf(o), o.tone === "positive" ? t.done : t.ansi1)));
}
