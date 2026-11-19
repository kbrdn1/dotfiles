// projects.js: a project archived, restored, or deleted by force (#88). Pure: the caller reads the shared
// keys and writes what comes back. Source here, in kt-threads; copied byte for byte in kt-projects and
// kt-project-picker (kt-mods SHARED). Checked by projects.check.mjs.
//
// Archived: the entry of shared "kt.projects" keeps its id, color, logos and order and gains `archived` (ms
// since the epoch); the sidebar, the picker and the lists skip it, the Accueil dims it. Restored: the field
// goes, the project is back at its place. Deleted by force: the entry goes, with what Herdr keeps for it
// (deletePlan); never its folder, its repo, its transcripts.

export const isArchived = (e) => Number.isFinite(e?.archived);
/** The projects shown (not archived), in their order. */
export const shown = (list) => (list ?? []).filter((e) => !isArchived(e));
/** The archived ones. */
export const archivedOf = (list) => (list ?? []).filter(isArchived);

/** kt.projects with `id` archived at `now`; null when there's no such project or it's archived already. */
export function archive(list, id, now) {
  const e = (list ?? []).find((x) => x.id === id);
  return e && !isArchived(e) ? list.map((x) => (x === e ? { ...x, archived: now } : x)) : null;
}

/** kt.projects with `id` back (a space opened on it restores it too); null when it isn't archived. */
export function restore(list, id) {
  const e = (list ?? []).find((x) => x.id === id);
  if (!e || !isArchived(e)) return null;
  return list.map((x) => {
    if (x !== e) return x;
    const { archived, ...rest } = x;
    return rest;
  });
}

/**
 * What deleting `id` by force writes, as { shared key: value }, or null when there's no such project:
 * - "kt.projects": without its entry;
 * - each map keyed by project id that holds it (`maps`, e.g. { "kt.chat.backgrounds": {...} }): without it
 *   (kt-chat then sweeps the files no background refers to any more);
 * - "kt.kanban.slicePick" (`pick`): its project slice dropped, when it was this one;
 * - "kt.hub.forget" (`forget`): its folder at `now`, for the Accueil's indexer to purge its archive (a project
 *   of this computer only: the archive's folders are this computer's), and its former ones (`formerly`, a
 *   renamed folder: the Accueil counts their history as its own, which would come back under the old name).
 * state: { projects, maps, pick, forget }.
 */
export function deletePlan(state, id, now) {
  const list = state?.projects ?? [];
  const e = list.find((x) => x.id === id);
  if (!e) return null;
  const writes = { "kt.projects": list.filter((x) => x !== e) };
  for (const [key, map] of Object.entries(state.maps ?? {})) {
    if (!map || !(id in map)) continue;
    const { [id]: gone, ...rest } = map;
    writes[key] = rest;
  }
  if (state.pick?.project === id) writes["kt.kanban.slicePick"] = { ...state.pick, project: null };
  if (!e.machine && e.folder) writes["kt.hub.forget"] = { ...(state.forget ?? {}), ...Object.fromEntries([e.folder, ...(e.formerly ?? [])].map((f) => [f, now])) };
  return writes;
}
