// remote.js: a new thread on another machine (#63). Pure, no herdr: remote.check.mjs checks it.
// - The agents a machine has: knownAgents({ on }) runs a check ON that machine, so main.js asks it only
//   on a gesture (the person picks a remote project, or « vérifier »), once per machine for the app's run.
// - The launches that ask first (kt-confirm, Kylian's decision of 2026-11-19): an agent, never a shell,
//   on a machine that logs in as root. Root not known (machines.js isRoot null) doesn't ask.

/** Whether the agent `argv` starts is installed per knownAgents' list: true / false, null when the
 *  machine wasn't checked or the list doesn't have it. The shell (argv null) always is. */
export function installedOn(list, argv) {
  if (!argv) return true;
  if (!Array.isArray(list)) return null;
  const e = list.find((a) => a?.key === argv[0] || a?.run?.[0] === argv[0]);
  return e ? Boolean(e.installed) : null;
}

/** The key of a launch the person confirmed in this dialog: its machine and its agent. */
export const okKey = (machine, argv) => `${machine}|${argv?.[0] ?? ""}`;

/** A launch that asks first: an agent, on another machine known to log in as root, not yet
 *  confirmed for that machine and agent (`ok`: the last okKey confirmed). */
export function mustConfirm({ machine, argv, root, ok = null }) {
  return Boolean(machine) && Boolean(argv) && root === true && ok !== okKey(machine, argv);
}

/** The project chip's label: its name, and its machine when it's another one (two `k-hub`s apart). */
export const chipLabel = (name, machine) => (machine ? `${name} · ${machine}` : name);
