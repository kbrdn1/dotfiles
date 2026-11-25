// The threads' model, pure (no herdr, no gpui): every tab of every space as one thread, with what
// kt-threads' cards and kt-kanban's columns show of it, and the groupings both views use. The mod
// reads (herdr, the caches: threads-io.js), gathers a World, and asks threadOf / threadsOf. The
// model reads no file and no clock: `world.now` is the time (the formatters take `now`, Date.now()
// by default). Refreshing the World is the mod's job (DATA-SYNC.md).
//
// Written here, in mods/kt-threads (edit here, then copy), and copied byte for byte into each mod that
// uses it, with what it imports (`cmp` them all):
//   threads-model.js, thread-filter.js, pr-pick.js, and threads-io.js for the reads.
// Its check: bun mods/kt-threads/threads-model.check.mjs.
//
// World, a plain object (kt-threads builds one per render):
//   spaces     spaces(): SpaceInfo[]. On another machine, ids are "<machine>/<id>".
//   panes      panes(): PaneInfo[].
//   now        Date.now(). Every time here is ms since the epoch.
//   home       home().
//   homeReal   home()'s real path (`pwd -P`), null until known: then only home() itself is Home.
//   repos      { [location]: Repo | null }, location = JSON [machine | null, folder], for every space
//              folder and pane cwd (threads-io findRepo). Repo = { key: JSON [machine, git common
//              dir], name, linked: a linked worktree }. null: outside git; absent: not asked yet.
//   real       { [where(space)]: JSON [machine, real path] | null } (threads-io realOf).
//   registry   sortRegistry(shared("kt.projects")): [{ id, name, folder, machine, color, logos, order }].
//   colors     shared("space.colors") ?? {}: space id -> theme color name or #hex. kt-threads assigns
//              them (assignColors); other mods only read.
//   live       { [terminal]: herdr-bridge's json & { sl, slAt, flow } } (threads-io readLive).
//   reports    { ["<repo>|<branch>"]: summarizeReport() } (threads-io readReports).
//   prs        { [prKey()]: { number, state, url } | null } (threads-io lookupPr, asked by the mod).
//   defaults   { [repo]: its default branch | null } (filled by lookupPr).
//   snoozed    shared("kt.snoozed") ?? {}: tab id -> { until, at }.
//   pins       shared("kt.pins") ?? []: tab ids.
//   firstSeen  shared("kt.firstSeen") ?? {}: tab id -> when the list first saw it.
//   dark       settings().dark: which logo.
//
// Thread (threadOf), a plain object: spread it freely (no getters).
//   id          its tab's id: the key of pins, snoozes, cards.
//   space, tab  its SpaceInfo and TabInfo as herdr gives them (tab.changed_at, settled_at, working_since).
//   title       label(): the name given, else its agent's live title, else its program, else "Terminal".
//   lead        the PaneInfo it shows first: focused, else its agent's, else the first; undefined
//               without a terminal.
//   agent       its agent's PaneInfo, else lead.
//   terminal    agent's address ("t7", "vps/t7"), null without a terminal.
//   program     agent's Program (name, icon, tint, tile), null without a terminal.
//   agentKey    its first agent's program key ("claude"), null when no agent runs (the filter's program).
//   status      tab.status: "blocked" | "done" | "working" | "idle", null when no agent reports one.
//   shown       its space and its tab are the ones shown.
//   settled     archived (tab.settle), still running.
//   activity    when it was last active: its agents' last write (herdr-bridge, statusline), else Herdr's
//               last change of state, else when the list first saw it, else now.
//   repo        { key, name, first, machine }: the repo its terminal is in now (it cd'd there), else its
//               space's, else its space itself (key: space id). first: that repo's first space.
//   project     { key, id, home, name, color, logo, entry, machine }: the project its space belongs to,
//               kt-threads' group. key: "home", the registry id, else "space:<id>"; id: the registry's,
//               null while unknown or at home; color: a theme name or #hex, the registry's else the
//               space's ("dim" for the "~" space); logo: a path for image(), null for none.
//   branch, cwd lead's git branch and live folder, null.
//   worktree    true in a linked worktree, false in a main checkout, null outside git or not known yet.
//   issue       "12" from a `<type>/#12-slug` branch, else from claude-flow's `issue #12` step, else null.
//   pr          { number, state: "OPEN" | "MERGED" | "CLOSED", url, draft } | null: /me:report's, else gh's.
//               None on a long-lived branch (pr-pick.js). prFrom: "report" | "gh" | null.
//   report      summarizeReport() of its branch: { review, ci, pr, at } | null.
//   flow        claude-flow's timeline of its agent: { workflow, step, phase, at, done, total } | null.
//               step: the current one ({ id, label, state }), null when none is current (all done, or
//               not started); phase: the step's PHASES id, null for a step out of the table; at: where
//               the flow stands, the PHASES id of its current step, else of the last one reached (done
//               or failed), "other" for a step out of the table, null when none is reached yet.
//   asks        what its agent waits on from you, as herdr-bridge publishes it while a dialog is up (a
//               permission, a question): { kind, title, detail } | null. A held message or a plain
//               "waiting for your reply" is read off the screen by decide.js, not here.
//   line        the sidebar's live line: a working agent's last action (herdr-bridge's action.what: «
//               ListAgents », « Run cd … »), a done one's answer; null otherwise or without a bridge.
//   sl          its agent's statusline facts (Claude only): model, effort, ctx_pct, cost_usd, window...
//               cost, ctx, model, effort: sl's cost_usd, ctx_pct, model, effort; all null without one.
//   subagents   { shown, done, total }: shown, the alive ones then those that ended under GONE ago
//               (the cards' branches); done / total, over the bridge's whole list (k ended / n).
//   snooze      { until, at } | null. asleep: snoozed now (not due, and its agent hasn't asked since).
//   pinned      in pins.

import { longLived } from "./pr-pick.js";
import { passes, byNeed, byProject, groupOf, GROUPS } from "./thread-filter.js";

// ---------- formatting ----------

export function age(ms, now = Date.now()) {
  if (!ms) return "";
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export function duration(ms, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** A snooze's time left: "12m", "3h", "2d". */
export function until(ms, now = Date.now()) {
  const m = Math.max(1, Math.round((ms - now) / 60e3));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}

/** A tab id's number ("t12" -> 12): the date groups' newest-first order. */
export const num = (id) => Number(String(id).replace(/\D/g, "")) || 0;

// ---------- a thread's title ----------

// kbrdn-tabs' label(): a name the person gave stays; else the agent's live title
// (its status glyph dropped), else the program; never a bare tab number.
export const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();
export function label(tab, lead) {
  const prog = lead?.program?.name;
  const base = tab.named ? tab.name : prog ?? "Terminal";
  if (!lead?.program?.agent) return base;
  const live = clean(lead.title);
  const path = /^[~/]|^[A-Za-z]:\\/.test((lead.title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, ""));
  const telling = live && live !== lead.terminal && live !== prog && !path && !live.includes("@") && live.toLowerCase() !== lead.program.key;
  return (tab.name === prog || !tab.named) && telling ? live : base;
}

// A thread's terminals: the one it shows first, and its agent's (else the lead).
export function leads(tab, panes) {
  const mine = panes.filter((p) => p.tab === tab.id && p.terminal);
  const lead = mine.find((p) => p.focused) ?? mine.find((p) => p.program?.agent) ?? mine[0];
  return { lead, agent: mine.find((p) => p.program?.agent) ?? lead };
}

// ---------- sub-agents (herdr-bridge's `agents`) ----------

// An ended one fades after FADE, goes after GONE. A 0.3.0 bridge's rows have `at` and no
// `startedAt` / `endedAt`.
export const FADE = 60e3;
export const GONE = 5 * 60e3;
export const startOf = (a) => a.startedAt ?? a.at ?? 0;
export const endOf = (a) => a.endedAt ?? startOf(a);
export const isAlive = (a) => a.state === "running" || a.state === "background";

/** The sub-agents still shown: the alive ones, then the ended until GONE after they ended; running,
 *  background, then the latest ended. */
export function shownAgents(list, now) {
  const order = { running: 0, background: 1 };
  return (list || []).filter((a) => isAlive(a) || now - endOf(a) < GONE)
    .sort((a, b) => (order[a.state] ?? 2) - (order[b.state] ?? 2) || endOf(b) - endOf(a));
}

/** What a branch shows of its age ("now", "3m"), "~" once faded. */
export const agentAge = (a, now) => (isAlive(a) ? age(startOf(a), now) : `${age(endOf(a), now)}${now - endOf(a) > FADE ? "~" : ""}`);

// ---------- /me:report, claude-flow, the issue ----------

// /me:report facts (~/Reports/<owner>-<repo>/<branch>/facts.json, or data.js). Blockers are p0+p1+p2
// of the last pass; an axis "non exécuté" is never a zero; ci null shows nothing.
export function summarizeReport(d) {
  const f = d?.facts ?? {};
  const last = f.review?.passes?.at?.(-1);
  const ran = (a) => a?.state === "ok";
  const review = last ? { pass: last.pass, blockers: ran(last.standards) || ran(last.spec) ? (last.p0 ?? 0) + (last.p1 ?? 0) + (last.p2 ?? 0) : null } : null;
  const ci = f.ci ? { ok: f.ci.ok ?? 0, total: f.ci.total ?? 0, fail: f.ci.fail ?? 0, pending: f.ci.pending ?? 0 } : null;
  // its PR, which the card's badge takes over gh's: the same source as the rest of the card
  const pr = f.pr?.number ? { number: f.pr.number, state: f.pr.state ?? "OPEN", url: f.pr.url, draft: Boolean(f.pr.isDraft) } : null;
  return { review, ci, pr, at: d?.generatedAt ?? null };
}

/** A thread's /me:report facts, when one exists for its branch. */
export function reportOf(lead, space, repos, reports) {
  const repo = lead?.cwd && repos[JSON.stringify([space.machine ?? null, lead.cwd])]?.name;
  return repo && lead?.branch ? reports[`${repo}|${lead.branch}`] ?? null : null;
}

// claude-flow's steps by phase: kt-flow's steps.js PHASES, as ids (keep them in step: kt-kanban's
// check compares them both ways). `report` (/me:report) is a delivery step: me:goal runs it between pr
// and review, the live page of the PR under review. /me:release's changelog, bump, tag and release:
// changelog prep, bump impl, tag and release close (after merge).
export const PHASES = {
  issue: "prep", branch: "prep", worktree: "prep", pin: "prep", changelog: "prep",
  spec: "spec", plan: "spec", tasks: "spec",
  implement: "impl", commits: "impl", bump: "impl", docs: "impl",
  push: "ship", pr: "ship", report: "ship", review: "ship", ci: "ship",
  merge: "close", tag: "close", release: "close", "issue-closed": "close", note: "close", // i18n: tech
};

/** claude-flow's timeline (`<terminal>.flow.json`): its current step and phase, where it stands, and
 *  how far it is. A step can be skipped (docs pending, push done): where it stands is the furthest. */
export function flowOf(flow) {
  const steps = Array.isArray(flow?.steps) ? flow.steps : null;
  if (!steps) return null;
  const step = steps.find((s) => s?.state === "current") ?? null;
  const reached = step ?? [...steps].reverse().find((s) => s?.state === "done" || s?.state === "failed") ?? null;
  return {
    workflow: flow.workflow ?? null, step, phase: step && Object.hasOwn(PHASES, step.id) ? PHASES[step.id] : null,
    at: reached ? (Object.hasOwn(PHASES, reached.id) ? PHASES[reached.id] : "other") : null,
    done: steps.filter((s) => s?.state === "done").length, total: steps.length,
  };
}

/** The issue of a `<type>/#N-slug` branch (kt-flow's issueOf), else null. */
export const issueOf = (branch) => String(branch ?? "").match(/^[\w.-]+\/#(\d+)(?:-|$)/)?.[1] ?? null;
const flowIssue = (flow) => (Array.isArray(flow?.steps) ? flow.steps : []).find((s) => s?.id === "issue")?.label?.match?.(/#(\d+)/)?.[1] ?? null;

// ---------- places: repos, projects, Home ----------

/** A space's folder as the caches key it: JSON [machine | null, folder]. */
export const where = (s) => JSON.stringify([s.machine ?? null, s.folder]);

/** The repo of a space's folder (where it was made), or null outside git or not known yet. */
export const spaceRepo = (s, repos) => repos[where(s)] ?? null;

/** A project's key: its repo (worktree spaces share it), else the space itself. */
export const spaceKey = (s, repos) => spaceRepo(s, repos)?.key ?? s.id;

/** A folder's repo (its git common dir, as findRepo keys it), else the folder itself. */
export const repoOf = (on, cwd, repos) => repos[JSON.stringify([on ?? null, cwd])]?.key ?? JSON.stringify([on ?? null, cwd]);

/** A space's project, as the registry ids it: its repo's main checkout (a worktree, or a space whose
 *  terminal moved into a subfolder, belongs to it), else its folder's real path; null while unknown.
 *  `ctx`: { repos, real }. */
export function projectId(s, { repos, real }) {
  const r = spaceRepo(s, repos);
  if (r) return JSON.stringify([s.machine ?? null, JSON.parse(r.key)[1].replace(/\/\.git$/, "")]);
  return r === null ? (real[where(s)] ?? null) : null;
}

/** The Home space: its folder is this computer's home (a remote machine's home isn't known here).
 *  Never a project. `ctx`: { home, homeReal, real }. */
export function isHome(s, { home, homeReal, real }) {
  if (s.machine) return false;
  return s.folder === home || (homeReal != null && real[where(s)] === JSON.stringify([null, homeReal]));
}

/** Home's name: "Home" or the name it was given. */
export const homeLabel = (s) => (s.named ? s.name : "Home"); // i18n: tech

/** A space's registry entry (by project, else by its folder as written while that's unknown). */
export function entryOf(s, reg, ctx) {
  const id = projectId(s, ctx);
  return reg.find((e) => (id ? e.id === id : e.folder === s.folder && (e.machine ?? null) === (s.machine ?? null))) ?? null;
}

/** The registry in its order. */
export const sortRegistry = (list) => [...(list ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** A project's logo for the appearance (registry `logos: { light, dark }`, or the older single
 *  `logo`): its own, else the other mode's; null for none (then the initial on its color). */
export function logoOf(e, dark) {
  const l = e?.logos ?? { light: e?.logo ?? null, dark: e?.logo ?? null };
  return (dark ? (l.dark ?? l.light) : (l.light ?? l.dark)) ?? null;
}

// Space colors, kept by space id in shared "space.colors": a theme color name ("ansi6") or a picked
// #rrggbb. A space seen without one gets the theme color fewest spaces use, once; every mod does the
// same in the same order, so they agree, and adding or renaming spaces moves nothing.
export const PROJECT_COLORS = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];

/** The colors kept for the spaces open (`stored`: shared "space.colors"), the new ones given;
 *  `changed`: to be written back. */
export function assignColors(spaces, stored) {
  const ids = new Set(spaces.map((p) => p.id));
  const kept = Object.fromEntries(Object.entries(stored ?? {}).filter(([id]) => ids.has(id)));
  let changed = Object.keys(kept).length !== Object.keys(stored ?? {}).length;
  for (const p of spaces) {
    if (kept[p.id] || p.name === "~") continue;
    const uses = (c) => Object.values(kept).filter((v) => v === c).length;
    kept[p.id] = PROJECT_COLORS.reduce((best, c) => (uses(c) < uses(best) ? c : best));
    changed = true;
  }
  return { colors: kept, changed };
}

/** A space's color name: "dim" for the "~" space, else its kept one, else the first. */
export const spaceColorOf = (s, colors) => (s.name === "~" ? "dim" : colors[s.id] ?? PROJECT_COLORS[0]);

/** A thread's repo: the one where its terminal is now (you cd'd there), else its space's, else the
 *  space itself; `first`: that repo's first space (its color). */
export function repoHere(space, tab, panes, spaces, repos) {
  const mine = panes.filter((p) => p.tab === tab.id && p.terminal);
  const cwd = (mine.find((p) => p.focused) ?? mine.find((p) => p.program?.agent) ?? mine[0])?.cwd;
  const r = (cwd && repos[JSON.stringify([space.machine ?? null, cwd])]) || repos[where(space)];
  if (!r) return { key: space.id, name: space.name, first: space, machine: space.machine };
  const first = spaces.find((s) => repos[where(s)]?.key === r.key) ?? space;
  return { key: r.key, name: r.name, first, machine: space.machine };
}

// ---------- snooze, activity, PR ----------

/** Snoozed now: not yet due, and its agent hasn't asked for you since. */
export function asleep(tab, snoozed, now) {
  const s = snoozed[tab.id];
  if (!s || tab.settled) return false;
  if (now >= s.until) return false;
  return !((tab.status === "blocked" || tab.status === "done") && (tab.changed_at ?? 0) > s.at);
}

/** When a thread was last active: its agents' herdr-bridge write (updatedAt), their statusline's
 *  (slAt), Herdr's last change of state, else when the list first saw it, else now. */
export function activityOf(tab, panes, live, firstSeen, now) {
  let at = tab.changed_at ?? 0;
  for (const p of panes) {
    if (p.tab !== tab.id || !p.terminal) continue;
    const l = live[p.terminal];
    at = Math.max(at, l?.updatedAt ?? 0, l?.slAt ?? 0);
  }
  return at || firstSeen[tab.id] || now;
}

/** A branch's key in `prs` (and in the mod's queue of `gh` lookups). */
export const prKey = (on, cwd, branch) => JSON.stringify([on ?? null, cwd, branch]);

/** A thread's PR: /me:report's when it has one (the card's other facts come from it), else gh's.
 *  None on a long-lived branch, nor on the repo's default branch. */
export function prOf(lead, space, { repos, reports, prs, defaults }) {
  const def = defaults[repoOf(space.machine, lead?.cwd, repos)];
  const reported = lead?.branch && !longLived(lead.branch, def) ? reportOf(lead, space, repos, reports)?.pr : null;
  if (reported) return { pr: reported, from: "report" };
  if (!lead?.cwd || !lead?.branch || longLived(lead.branch, def)) return { pr: null, from: null };
  const pr = prs[prKey(space.machine, lead.cwd, lead.branch)] ?? null;
  return { pr, from: pr ? "gh" : null };
}

// ---------- what it does now ----------

/** The sidebar's live line (kt-threads' liveLine): what a working agent does now (herdr-bridge's
 *  action.what), what a done one answered, on one line; null otherwise. */
export function lineOf(status, bridge) {
  const text = status === "working" ? bridge?.action?.what : status === "done" ? bridge?.answer : null;
  const one = String(text ?? "").replace(/\s+/g, " ").trim();
  return one || null;
}

// ---------- the thread ----------

/** One tab of a space as a thread (the contract above). */
export function threadOf(space, tab, world) {
  const { panes, live, now } = world;
  const { lead, agent } = leads(tab, panes);
  const bridge = (agent?.terminal && live[agent.terminal]) || null;
  const sl = bridge?.sl ?? null;
  const branch = lead?.branch ?? null;
  const home = isHome(space, world);
  const id = home ? null : projectId(space, world);
  const entry = home ? null : entryOf(space, world.registry, world);
  const r = (lead?.cwd && world.repos[JSON.stringify([space.machine ?? null, lead.cwd])]) || spaceRepo(space, world.repos);
  const agents = bridge?.agents || [];
  const { pr, from } = prOf(lead, space, world);
  return {
    id: tab.id,
    space,
    tab,
    title: label(tab, agent),
    lead,
    agent,
    terminal: agent?.terminal ?? null,
    program: agent?.program ?? null,
    agentKey: panes.find((p) => p.tab === tab.id && p.program?.agent)?.program?.key ?? null,
    status: tab.status ?? null,
    shown: Boolean(space.active && tab.active),
    settled: Boolean(tab.settled),
    activity: activityOf(tab, panes, live, world.firstSeen, now),
    repo: repoHere(space, tab, panes, world.spaces, world.repos),
    project: {
      key: home ? "home" : id ?? `space:${space.id}`, id, home,
      name: home ? homeLabel(space) : entry?.name ?? space.name,
      color: entry?.color ?? spaceColorOf(space, world.colors),
      logo: home ? null : logoOf(entry, world.dark),
      entry, machine: space.machine ?? null,
    },
    branch,
    cwd: lead?.cwd ?? null,
    worktree: r ? Boolean(r.linked) : null,
    issue: issueOf(branch) ?? flowIssue(bridge?.flow),
    pr,
    prFrom: from,
    report: reportOf(lead, space, world.repos, world.reports),
    flow: flowOf(bridge?.flow),
    asks: bridge?.pending?.title ? { kind: bridge.pending.kind ?? null, tool: bridge.pending.tool ?? null, title: String(bridge.pending.title), detail: bridge.pending.detail ? String(bridge.pending.detail) : null } : null,
    line: lineOf(tab.status, bridge),
    sl,
    cost: sl?.cost_usd ?? null,
    ctx: sl?.ctx_pct ?? null,
    model: sl?.model ?? null,
    effort: sl?.effort ?? null,
    subagents: { shown: shownAgents(agents, now), done: agents.filter((a) => !isAlive(a)).length, total: agents.length },
    snooze: world.snoozed[tab.id] ?? null,
    asleep: asleep(tab, world.snoozed, now),
    pinned: world.pins.includes(tab.id),
  };
}

/** Every tab of every space, in spaces' and tabs' order. */
export const threadsOf = (world) => world.spaces.flatMap((space) => space.tabs.map((tab) => threadOf(space, tab, world)));

// ---------- what both views list ----------

/** The shown project's threads (its repo's worktree spaces too); `shown` null: every project's. */
export function scoped(threads, shown, repos) {
  const scope = shown ? spaceKey(shown, repos) : null;
  return threads.filter((th) => !scope || th.space.id === shown.id || spaceKey(th.space, repos) === scope);
}

/** The threads the filter lets through (thread-filter.js: status, period by activity, program). */
export const filtered = (threads, filter, now) => threads.filter((th) => passes(filter, { status: th.status, activity: th.activity, program: th.agentKey }, now));

/** byNeed's order (blocked, done, working, idle; pinned, then the most recently active first). */
export const sortByNeed = (threads, pins) => [...threads].sort((a, b) => byNeed({ id: a.id, status: a.status, act: a.activity }, { id: b.id, status: b.status, act: b.activity }, pins));

/** The list's shelves. The archived view: the settled threads only, dated by when they were put away.
 *  Else: the pinned awake ones (in pins' order), the other awake ones, the snoozed (soonest due first). */
export function sections(threads, filter, pins) {
  if (filter.archived) return { pinned: [], active: [], snoozed: [], archived: threads.filter((th) => th.tab.settled).map((th) => ({ ...th, activity: th.tab.settled_at ?? th.activity })) };
  const awake = (th) => !th.tab.settled && !th.asleep;
  return {
    pinned: pins.map((id) => threads.find((th) => th.id === id && awake(th))).filter(Boolean),
    active: threads.filter((th) => awake(th) && !pins.includes(th.id)),
    snoozed: threads.filter((th) => th.asleep).sort((a, b) => a.snooze.until - b.snooze.until),
    archived: [],
  };
}

/** By project, one group per project (Home its own): { key, home, space (its first thread's), entry,
 *  threads (byNeed), need (how many are blocked), at (its registry index, -1) }, in byProject order. */
export function projectGroups(threads, pins, registry) {
  const map = new Map();
  for (const th of threads) {
    const { key, home, entry } = th.project;
    let g = map.get(key);
    if (!g) map.set(key, (g = { key, home, space: th.space, entry, threads: [] }));
    g.threads.push(th);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.threads = sortByNeed(g.threads, pins);
    g.need = g.threads.filter((th) => th.status === "blocked").length;
    g.at = g.entry ? registry.indexOf(g.entry) : -1;
  }
  return groups.sort(byProject);
}

/** By date of last activity (thread-filter.js GROUPS: today, yesterday, week, older), newest thread
 *  first inside each (a group never reshuffles on activity): [[group id, threads]], empty ones out. */
export const datedGroups = (threads, now) => GROUPS.map((id, i) => [id, threads.filter((th) => groupOf(th.activity, now) === i).sort((a, b) => num(b.id) - num(a.id))])
  .filter(([, l]) => l.length > 0);

/** The Kanban's columns, by status: { blocked, done, working, idle }, a thread without a status in
 *  idle, each in byNeed order. */
export const STATUSES = ["blocked", "done", "working", "idle"];
export function byStatus(threads, pins) {
  const out = Object.fromEntries(STATUSES.map((s) => [s, []]));
  for (const th of sortByNeed(threads, pins)) out[STATUSES.includes(th.status) ? th.status : "idle"].push(th);
  return out;
}
