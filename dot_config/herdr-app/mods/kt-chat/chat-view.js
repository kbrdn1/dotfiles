// kt-chat's choices that herdr-app check can't reach, pure (herdr's calls and tr passed in):
// which agent the Chat shows, the words of a fold, which turns are drawn and where the view goes
// when more are. Checked by chat-view.check.mjs.

const isClaude = (a) => a?.program?.key === "claude" || /^claude/.test(a?.app ?? "");

/**
 * The Chat's agent: the shown tab's Claude agent, the focused pane's first (when the Chat has the
 * keyboard, focused().terminal is no longer the agent's, the tab's focused pane still is). Or why
 * there is none: { reason: "noAgent" | "notClaude" (with app) | "remote" (with machine) }.
 */
export function pickTarget({ focused, agents, panes }) {
  const tab = focused()?.tab;
  const mine = tab ? agents().filter((a) => a.tab === tab) : [];
  if (!mine.length) return { reason: "noAgent" }; // i18n: tech
  const pane = panes().find((p) => p.tab === tab && p.focused && p.terminal);
  const claude = mine.filter(isClaude);
  const a = claude.find((x) => x.address === pane?.terminal) ?? claude[0];
  if (!a) {
    const o = mine.find((x) => x.address === pane?.terminal) ?? mine[0];
    return { reason: "notClaude", app: o.program?.name ?? o.app ?? "" }; // i18n: tech
  }
  if (a.address.includes("/")) return { reason: "remote", agent: a, machine: a.address.split("/")[0] }; // i18n: tech
  return { agent: a };
}

/** The words of a tally (chat-model.js): « 4 lectures · 2 modifs », in the order the work was done. */
export function tallyText(c, tr) {
  const parts = [];
  for (const k of c.order) {
    if (k === "research") {
      if (c.reads) parts.push(tr("count.reads", { n: c.reads }));
      if (c.searches) parts.push(tr("count.searches", { n: c.searches }));
    } else if (k === "edit") parts.push(tr("count.edits", { n: c.edits }));
    else if (k === "run") parts.push(tr("count.runs", { n: c.runs }));
    else if (k === "agent") parts.push(tr("count.agents", { n: c.agents }));
    else parts.push(tr("count.others", { n: c.others }));
  }
  if (!c.order.length && c.thoughts) parts.push(tr("count.thoughts", { n: c.thoughts }));
  if (c.notes) parts.push(tr("count.notes", { n: c.notes }));
  if (c.errors) parts.push(tr("count.errors", { n: c.errors }));
  return parts.join(" · ");
}

/** The first turn drawn, of n, when the last `show` are. */
export const firstShown = (n, show) => Math.max(0, n - show);

/**
 * The scroll child (0 is the head: « Tours précédents » or « Début de la session ») of the turn
 * now at index `at` among all turns, when the first drawn is `first`.
 */
export const childOf = (at, first) => 1 + at - first;

/**
 * Turns drawn after a read put `added` older turns in front of `before` loaded ones (all of which
 * were drawn): those, plus up to `step` of the new.
 */
export const shownAfterRead = (before, added, step) => before + Math.min(step, Math.max(0, added));
