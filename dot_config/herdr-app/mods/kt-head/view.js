// The thread's two faces (#54, `ctrl-b space`): the layout's stack thread-body shows the terminal
// (child main) or the Chat (child chat, kt-chat). Pure, its herdr calls passed in: view.check.mjs.
//
// `view(arg, deps)`: "" alternates, "chat" / "main" pick. From a page that covers the thread (the
// stack view on Skills, Inbox…), "" brings the thread back on its Chat face. The Chat gets the
// keyboard through shared "kt.chat.focus" (kt-chat reads it when it draws: a mod can't send another
// one a command); back on the terminal, its tab's focused pane gets it again. Answers the child
// shown, or null without the stack (another layout).

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

const shownChild = (stack) => stack?.active ?? stack?.children?.[0]?.id;

export function view(arg, { layout, run, setShared, panes, focused }) {
  const root = layout();
  const stack = find(root, "thread-body");
  if (!stack) return null;
  const page = find(root, "view");
  const covered = Boolean(page) && shownChild(page) !== "thread";
  if (covered) run("layout.select", { stack: "view", child: "thread" });
  const to = arg === "chat" || arg === "main" ? arg : covered ? "chat" : shownChild(stack) === "chat" ? "main" : "chat";
  run("layout.select", { stack: "thread-body", child: to });
  if (to === "chat") setShared("kt.chat.focus", Date.now());
  else {
    const tab = focused()?.tab;
    const pane = panes().find((p) => p.tab === tab && p.focused && p.terminal);
    if (pane) run("pane.focus", { pane: pane.pane });
  }
  return to;
}
