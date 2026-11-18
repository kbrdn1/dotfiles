// The threads' filter (shared "kt.threadFilter", set by the kt-thread-filter popup) and their date
// groups. Pure, so thread-filter.check.mjs can test it.

// `group`: how the list is grouped, "project" (default) or "date"; a way to show, not a filter.
export const DEFAULT_FILTER = { archived: false, status: [], period: "all", programs: [], group: "project" };
const DAY = 86400e3;

/** The filter as stored, with every field there. */
export function filterOf(stored) {
  const f = stored && typeof stored === "object" ? stored : {};
  return {
    archived: f.archived === true,
    status: Array.isArray(f.status) ? f.status : [],
    period: ["all", "today", "7d", "30d"].includes(f.period) ? f.period : "all",
    programs: Array.isArray(f.programs) ? f.programs : [],
    group: f.group === "date" ? "date" : "project",
  };
}

/** Whether anything narrows the list (the filter icon goes accent then). */
export function filtering(f) {
  return f.archived || f.status.length > 0 || f.period !== "all" || f.programs.length > 0;
}

/** Local midnight before `now`. */
export function midnight(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whether a thread passes the filter: status (none = all), period (by its activity), program (none = all). */
export function passes(f, { status, activity, program }, now) {
  if (f.status.length && !f.status.includes(status)) return false;
  if (f.programs.length && !f.programs.includes(program)) return false;
  if (f.period === "today") return activity >= midnight(now);
  if (f.period === "7d") return activity >= now - 7 * DAY;
  if (f.period === "30d") return activity >= now - 30 * DAY;
  return true;
}

/** The threads' order (inside a project, and the date view's pinned shelf): what needs you
 *  (blocked), done, working, idle; at equal status the pinned first, then the most recently
 *  active. Pinned threads follow the same rule. Rows: { id, status, act }. */
const RANK = { blocked: 0, done: 1, working: 2, idle: 3 };
export function byNeed(a, b, pins = []) {
  return (RANK[a.status] ?? 3) - (RANK[b.status] ?? 3) || pins.includes(b.id) - pins.includes(a.id) || b.act - a.act;
}

/** The projects: Home first, then those with a thread that needs you, then in the registry's order
 *  (`at`, its index; -1, not in it: last). Groups: { home, need, at }. */
export function byProject(a, b) {
  const at = (g) => (g.at < 0 ? 1e9 : g.at);
  return b.home - a.home || (b.need > 0) - (a.need > 0) || at(a) - at(b);
}

/** The projects' order, one for the bar and the picker: the open ones first, then the closed ones,
 *  each in the registry's order (`reg`, already sorted by `order`). */
export function openFirst(reg, isOpen) {
  return [...reg.filter((e) => isOpen(e.id)), ...reg.filter((e) => !isOpen(e.id))];
}

/** A drag in the bar: `fromId` takes `toId`'s place among the projects of its own group (open or
 *  closed): after it going right, before it going left. A drop outside the group lands at its edge
 *  (the side the target is on, by `display`, the ids as shown). Only the group's own slots in the
 *  registry change, so the other group keeps its order and a project closed later goes back to its
 *  place. Returns the registry with `order` rewritten, or null when nothing moves. */
export function moveInGroup(reg, fromId, toId, isOpen, display) {
  const g = isOpen(fromId);
  const slots = reg.flatMap((e, i) => (isOpen(e.id) === g ? [i] : []));
  const members = slots.map((i) => reg[i]);
  const from = members.findIndex((e) => e.id === fromId);
  if (from < 0) return null;
  let to = members.findIndex((e) => e.id === toId);
  if (to < 0) to = display.indexOf(toId) < display.indexOf(members[0].id) ? 0 : members.length - 1;
  if (to === from) return null;
  members.splice(to, 0, ...members.splice(from, 1));
  const out = [...reg];
  slots.forEach((s, k) => { out[s] = members[k]; });
  return out.map((e, k) => ({ ...e, order: k }));
}

/** Monocode's date groups, by when a thread was last active. */
export const GROUPS = ["Aujourd'hui", "Hier", "Cette semaine", "Plus ancien"];
export function groupOf(activity, now) {
  const today = midnight(now);
  if (activity >= today) return 0;
  if (activity >= today - DAY) return 1;
  if (activity >= today - 7 * DAY) return 2;
  return 3;
}
