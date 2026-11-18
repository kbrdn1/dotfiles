// session.js: a page's dedicated Claude session (kt-workflow's « Workflow », kt-automation's
// « Automatisation »): ONE tab of that name on this machine, found by its name whatever its folder.
// Shown when it lives. An intention goes to it only between two turns: `idle`, or `done` (a finished
// turn reads done until someone looks at it); never into a turn in progress (`working`) nor over a
// question waiting for Kylian (`blocked`): then the page says why. Without a session, a new tab runs
// claude on the task (the intention under it), beside the space of `folder` when there is one, else
// in a space of its own. Written once in mods/kt-automation/session.js and copied byte for byte (cmp)
// into the mods that use it. Check: bun mods/kt-automation/session.check.mjs.

import { spaces, agents, panes, run, hc } from "herdr";

export const intention = (x) => `Intention : ${x}`;

/** The live session: the tab named `name` on a local space, and its agent (null once Claude left). */
export function session(name) {
  for (const s of spaces()) {
    if (s.machine) continue;
    const tab = s.tabs.find((x) => x.named && x.name === name);
    if (tab) return { space: s, tab, agent: agents().find((a) => a.tab === tab.id) ?? null };
  }
  return null;
}

/** Shows it: its space, its tab, the thread view. */
export function showSession(s) {
  run("space.select", { id: s.space.id });
  run("tab.select", { id: s.tab.id });
  run("layout.select", { stack: "view", child: "thread" });
}

/** What an intention does with an agent in `status`: the `hc send` arguments before the address,
 *  or { why } (it doesn't go). `hc send --if` takes only idle or working, hence `done` sends plain;
 *  hc itself still refuses a blocked agent without --force. */
// ponytail: done → plain send leaves a short race (a turn starting between the read and the send).
export function decide(status, name) {
  if (status === "idle") return { args: ["send", "--if", "idle"] };
  if (status === "done") return { args: ["send"] };
  if (status === "blocked") return { why: `La session ${name} attend une réponse de ta part : l'intention n'est pas partie.` };
  return { why: `La session ${name} travaille (${status ?? "état inconnu"}) : l'intention n'est pas partie.` };
}

/** Opens or reuses the session `name`. `intent` null: just show it (or open it on `task`).
 *  Resolves with { done: "shown" | "sent" | "opened" }, or { why } when the intention didn't go.
 *  No toast here: the caller says it in its own words. */
export async function dedicated({ name, folder, task, intent }) {
  const s = session(name);
  if (s && !intent) {
    showSession(s);
    return { done: "shown" };
  }
  if (s && !s.agent) return { why: `La session ${name} n'a plus d'agent : Claude en est sorti.` };
  if (s) {
    const d = decide(s.agent.status, name);
    if (d.why) return d;
    const r = await hc([...d.args, s.agent.address, intention(intent)]).catch((e) => ({ code: -1, stderr: String(e?.message ?? e) }));
    if (r.code !== 0) return { why: `La session ${name} n'a pas pris l'intention : ${(r.stderr || r.stdout || `code ${r.code}`).trim().split("\n")[0]}` };
    showSession(s);
    return { done: "sent" };
  }
  const full = intent ? `${task}\n${intention(intent)}` : task;
  const ids = (sp) => new Set(sp.tabs.map((x) => x.id));
  const at = spaces().find((sp) => !sp.machine && (sp.folder === folder || panes().some((p) => p.cwd === folder && ids(sp).has(p.tab))));
  if (at) run("tab.new", { space: at.id, name, folder, argv: ["claude"], task: full });
  else run("space.new", { name, tab: name, folder, argv: ["claude"], task: full, machine: "" });
  run("layout.select", { stack: "view", child: "thread" });
  return { done: "opened" };
}
