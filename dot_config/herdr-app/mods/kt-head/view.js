// The thread's two faces (#54, back with #86: Kylian wants the Chat in place of the tab's panes, not
// beside them): the layout's stack thread-body shows the tab's panes (child main) or the Chat (child
// chat, kt-chat, the shown tab's agent). `ctrl-b space` and the crumbs' Terminal | Chat. #86's splits
// from a page or this face stay (onthread.js): the panes come back on screen first.
//
// `view(arg, deps)`: "" alternates, "chat" / "main" pick. From a page that covers the thread (the
// stack view on Skills, Inbox…), "" brings the thread back on its Chat face. The Chat gets the
// keyboard through shared "kt.chat.focus" (kt-chat reads it when it draws: a mod can't send another
// one a command; a new stamp also fades the face in), written before the switch so the face's first
// draw has it. Back on the panes, no motion: the keyboard to the agent's pane (the focused pane's
// agent, else the tab's first agent; none: the tab's focused pane). Answers the child shown, or null
// without the stack (another layout). Pure, its herdr calls passed in: view.check.mjs.

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

const shownChild = (stack) => stack?.active ?? stack?.children?.[0]?.id;

export function view(arg, { layout, run, setShared, panes, focused, agents, now = Date.now }) {
  const root = layout();
  const stack = find(root, "thread-body");
  if (stack?.type !== "stack") return null;
  const page = find(root, "view");
  const covered = Boolean(page) && shownChild(page) !== "thread";
  if (covered) run("layout.select", { stack: "view", child: "thread" });
  const to = arg === "chat" || arg === "main" ? arg : covered ? "chat" : shownChild(stack) === "chat" ? "main" : "chat";
  if (to === "chat") setShared("kt.chat.focus", now());
  run("layout.select", { stack: "thread-body", child: to });
  if (to === "main") {
    const tab = focused()?.tab;
    const here = panes().find((p) => p.tab === tab && p.focused && p.terminal);
    const mine = agents().filter((a) => a.tab === tab);
    const agent = mine.find((a) => a.address === here?.terminal) ?? mine[0];
    if (agent) run("pane.focus", { terminal: agent.address });
    else if (here) run("pane.focus", { pane: here.pane });
  }
  return to;
}
