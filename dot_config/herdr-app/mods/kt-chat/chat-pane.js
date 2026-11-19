// chat-pane.js: kt-chat as a pane of the thread's tab (#86, lot 2), beside the terminals: its agent
// is the terminal its props name (`pane.split {mod: "kt-chat", props: {terminal}}`, kt-head), not the
// tab's. Pure, herdr's facts passed in: checked under bun (chat-pane.check.mjs).
//
// A mod pane's PaneInfo has no props (herdr.d.ts: terminal null, mod "kt-chat"), and run() doesn't
// answer the pane it made: the copy finds its own pane (ownPane), says it in the registry shared
// "kt.chat.panes" = { [pane]: terminal } (kt-head focuses the Chat of an agent instead of making a
// second, kt-composer reads registry[focused().pane]), and works out whether it shows (paneShown),
// which drives the live tail and the keyboard. Each copy keeps its own line only: written when it
// knows its pane, taken out in close(). Nothing else is cleaned (at start, panes() may come before
// every tab is loaded): the readers keep only lines whose pane is there and is a Chat.

import { isClaude, threadShown } from "./chat-view.js";

export const REGISTRY = "kt.chat.panes";

/**
 * The pane's agent, by its props' terminal: { agent } when that terminal is a Claude agent here; else
 * why not: « closed » (no such terminal any more: « agent fermé », the pane offers to close), « remote »
 * (another machine's, refused as the stack's Chat refuses it), « notClaude » (the terminal is there,
 * no Claude in it).
 */
export function paneTarget({ terminal, agents, terminals }) {
  if (!terminal) return { reason: "closed" }; // i18n: tech
  const a = (agents ?? []).find((x) => x.address === terminal) ?? null;
  const t = (terminals ?? []).find((x) => x.address === terminal) ?? null;
  if (!a && !t) return { reason: "closed" }; // i18n: tech
  if (terminal.includes("/")) return { reason: "remote", agent: a, machine: terminal.split("/")[0] }; // i18n: tech
  if (a && isClaude(a)) return { agent: a };
  return { reason: "notClaude", app: (a ?? t).program?.name ?? a?.app ?? "" }; // i18n: tech
}

/**
 * This copy's pane, in order: its props' (if Herdr puts it there); the one found before; the focused
 * pane while this copy holds the keyboard (pane.go, pane.focus, a click: it can only be its own); the
 * kt-chat pane the registry gives to its terminal (the registry survives a restart; kt-head makes one
 * Chat per agent); else the one kt-chat pane of its agent's tab the registry has nobody for. Never a
 * pane that isn't there or isn't a Chat. null when nothing tells it apart yet (two new Chats of one
 * tab, none registered: their first focus does).
 */
export function ownPane({ given, known, keyed, focused, registry, panes, terminal, agentTab }) {
  const chat = (id) => Boolean(id) && (panes ?? []).some((p) => p.pane === id && p.mod === "kt-chat");
  if (chat(given)) return given;
  if (chat(known)) return known;
  if (keyed && chat(focused)) return focused;
  const reg = registry ?? {};
  const mine = Object.keys(reg).filter((p) => reg[p] === terminal && chat(p));
  if (mine.length === 1) return mine[0];
  if (!agentTab) return null;
  const free = (panes ?? []).filter((p) => p.mod === "kt-chat" && p.tab === agentTab && !(p.pane in reg));
  return free.length === 1 ? free[0].pane : null;
}

/**
 * Does this copy show: the thread on screen (stack `view` on `thread`), its pane in the shown tab of
 * the shown space, and no other pane of that tab zoomed (it may be). Its pane unknown yet: its agent's
 * tab shown stands for it.
 */
export function paneShown({ pane, agentTab, panes, spaces, layout }) {
  if (!threadShown(layout)) return false;
  const space = (spaces ?? []).find((s) => s.active);
  const shownTab = space?.tabs?.find((t) => t.active)?.id ?? null;
  const mine = pane ? (panes ?? []).find((p) => p.pane === pane) : null;
  const tab = mine?.tab ?? agentTab;
  if (!tab || tab !== shownTab) return false;
  if (!mine) return true;
  return !(panes ?? []).some((p) => p.tab === tab && p.zoomed && p.pane !== pane);
}

/**
 * The registry with this pane's line on its terminal: unchanged (the same object) when it already
 * says so, so a render never writes twice. Only its own line is ever set, no other touched: two
 * copies writing never undo each other.
 */
export function register(registry, pane, terminal) {
  const reg = registry && typeof registry === "object" ? registry : {};
  if (!pane || reg[pane] === terminal) return registry ?? reg;
  return { ...reg, [pane]: terminal };
}

/** The registry without this pane's line (its copy closes). Unchanged when it isn't there. */
export function unregister(registry, pane) {
  if (!registry || !pane || !(pane in registry)) return registry;
  const out = { ...registry };
  delete out[pane];
  return out;
}
