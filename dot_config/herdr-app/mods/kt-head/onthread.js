// onthread.js (#86, A1): a pane command (split, zoom, close) acts on the thread's panes, so they come on
// screen first: from a page that covers the thread (the stack view on Inbox, Kanban…), the thread
// again; on its Chat face (the stack thread-body on chat), its terminals. Without it, a split from there
// made a pane nobody saw, and that pane took the keyboard: the keys typed next were lost (measured on a
// throwaway space, 2026-11-19). Since #86's lot 4 the Chat is a pane and thread-body a plain block: the
// thread-body half acts only on a stack that still has a `main` child (an older layout). Pure, its
// herdr calls passed in: onthread.check.mjs.
import { find } from "./view.js";

const shownChild = (stack) => stack?.active ?? stack?.children?.[0]?.id;

/** Brings the thread's terminals on screen; answers whether anything moved. */
export function onThread({ layout, run }) {
  const root = layout();
  const page = find(root, "view"), body = find(root, "thread-body");
  let moved = false;
  if (page && shownChild(page) !== "thread") {
    run("layout.select", { stack: "view", child: "thread" });
    moved = true;
  }
  if (body?.type === "stack" && body.children?.some((c) => c.id === "main") && shownChild(body) !== "main") {
    run("layout.select", { stack: "thread-body", child: "main" });
    moved = true;
  }
  return moved;
}
