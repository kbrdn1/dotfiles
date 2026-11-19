// The thread's Chat (#86, lots 3 and 4): a pane of the agent's tab, beside its terminal (kt-chat in a
// pane, props {terminal}), where #54 had it as the thread-body stack's second face. `ctrl-b space` and the
// crumbs' Terminal | Chat:
// - on an agent's terminal: its Chat pane in that tab, focused; none yet, one made at its right
//   (pane.split right, mod kt-chat, props {terminal}). The new pane takes the keyboard itself (kt-chat's
//   paneSync): Herdr focuses the pane a split makes but sends its mod no "focus";
// - on a Chat pane: back to its agent's terminal, nothing closed;
// - a shell with no agent, or no pane focused: nothing.
// First the thread's terminals on screen (toThread: onthread.js, from a page or the old Chat face).
// Which Chat serves which agent: kt-chat's registry shared "kt.chat.panes" = { [pane]: terminal }
// (kt-chat/chat-pane.js), only its lines whose pane is there, a kt-chat, in the same tab (a crash leaves
// lines behind). `view(arg, deps)`: "" alternates, "chat" / "main" pick. Answers the face now focused,
// "chat" or "main", or null. Pure, its herdr calls passed in: view.check.mjs.

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

/** The Chat pane of `terminal` in `tab`, from the registry, if it is there; else null. */
export function chatOf(registry, panes, terminal, tab) {
  const reg = registry && typeof registry === "object" ? registry : {};
  return Object.keys(reg).find((p) => reg[p] === terminal && panes.some((x) => x.pane === p && x.mod === "kt-chat" && x.tab === tab)) ?? null;
}

export function view(arg, { layout, run, panes, focused, agents, registry, toThread }) {
  if (!find(layout(), "thread")) return null; // another layout: no thread
  toThread();
  const all = panes();
  const here = all.find((p) => p.pane === focused()?.pane);
  if (!here) return null;
  const reg = registry() ?? {};
  if (here.mod === "kt-chat") {
    if (arg === "chat") return "chat";
    const term = reg[here.pane];
    if (!term) return null; // not registered yet (its first render): nothing to go back to
    run("pane.focus", { terminal: term });
    return "main";
  }
  if (arg === "main") return "main";
  const term = here.terminal;
  if (!term || !agents().some((a) => a.address === term)) return null;
  const chat = chatOf(reg, all, term, here.tab);
  if (chat) run("pane.focus", { pane: chat });
  else run("pane.split", { direction: "right", pane: here.pane, mod: "kt-chat", props: { terminal: term } });
  return "chat";
}
