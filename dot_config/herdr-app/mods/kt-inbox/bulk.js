// The Inbox's bulk actions on a selection (select.js), pure so bulk.check.mjs proves what each would
// run before anything does: which items it takes, which it leaves out and why, and the exact calls.

import { partition } from "./select.js";

const open = (x) => String(x.state ?? "").toUpperCase() === "OPEN";

// A refusal's `why` is a reason's key: main.js says it in words (strings.js' why.<key>, I18N.md).

/** Closing: the open ones only, one `gh <pr|issue> close` each, made one after another. */
export function planClose(items) {
  const plan = partition(items, (x) => (open(x) ? null : String(x.state).toUpperCase() === "MERGED" ? "merged" : "closed"));
  return { ...plan, calls: plan.ok.map((x) => [x.kind === "pr" ? "pr" : "issue", "close", String(x.number), "-R", x.repo]) };
}

/** gwm review: PRs only, in a local clone of their repo (`cloneOf(repo)`: its folder, or null), and
 *  never with --bootstrap: a PR's code is run by nobody before it's read. */
export function planReview(items, cloneOf) {
  const plan = partition(items, (x) => (x.kind !== "pr" ? "notPr" : cloneOf(x.repo) ? null : "noClone"));
  return { ...plan, calls: plan.ok.map((x) => ({ cwd: cloneOf(x.repo), args: ["review", String(x.number)] })) };
}

/** One line for a confirm's list. */
export const describe = (x) => `${x.kind === "pr" ? "PR" : "Issue"} #${x.number} · ${x.title}`; // i18n: tech
