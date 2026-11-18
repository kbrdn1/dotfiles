// The Inbox's bulk actions on a selection (select.js), pure so bulk.check.mjs proves what each would
// run before anything does: which items it takes, which it leaves out and why, and the exact calls.
// Also how an item asked by another mod fits the page's filters (fitAsked).

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

/** An item another mod asks to open (shared "kt.inbox.open": { repo, kind, number, tab? }; kt-gwm, kt-flow)
 *  against the page's filters `{ kind, rel, query }`: those that would hide it go (null, ""): another kind, a
 *  relation whose cached list (`cached(rel)`, the scope's items) hasn't it, a query it doesn't match
 *  (`matches(x, query)`) or that nothing listed can be checked against. `item`: its listed entry (null: not
 *  in the list, `reread` it: just opened, or closed, merged); `tab`: a PR's summary | code | checks, else null. */
export function fitAsked(req, { kind, rel, query }, cached, matches) {
  const key = `${req.repo}#${req.number}`, want = req.kind === "pr" ? "pr" : "issue";
  const find = (r) => (cached(r) ?? []).find((x) => x.key === key) ?? null;
  const keep = rel && find(rel) ? rel : null;
  const item = find(keep);
  return {
    key, kind: want, item, reread: !item,
    view: { kind: kind && kind !== want ? null : kind, rel: keep, query: query && !(item && matches(item, query)) ? "" : query },
    tab: want === "pr" && ["summary", "code", "checks"].includes(req.tab) ? req.tab : null,
  };
}

/** One line for a confirm's list. */
export const describe = (x) => `${x.kind === "pr" ? "PR" : "Issue"} #${x.number} · ${x.title}`; // i18n: tech
