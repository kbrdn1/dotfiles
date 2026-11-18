// machines.js: the other machines (`hc machine ls`) for the kbrdn mods. Written once in
// mods/kt-keys/machines.js and copied byte for byte into the mods that use it (cmp to check).
//
// `machines()` only gives a machine's name and its layout (loading, ready, unavailable). Its
// connection (connected, needs_login, unreachable and why), its account and its linger come from
// `hc machine ls --json`. One poller (kt-threads, pollMachines) publishes them in shared
// "kt.machines": [{ name, state, why, keeps_running_after_logout, logout_linger_user, version }],
// never `host`, `id`, `target`, `via` nor `session`, never a `temporary` machine, set only when
// it changed. Everyone else reads it here:
//
//   stateOf(name)    { name, local, layout, state, why, root, linger, version, reachable, status }
//   reachable(name)  this computer, or layout "ready" and not known to be away
//   isRoot(name)     true / false, null when it isn't known
//   guard(exec)      exec that rejects at once with isOffline(e) = name when the machine is away
//   guardRead(read)  the same for readTextFile
//
// Asking and being answered are two things. A guarded exec that rejects (the machine is away, the
// program can't start, a timeout) means "couldn't ask": keep what was shown, ask again once the
// machine is back. A resolved exec with a nonzero code is an answer ("not a repo"): cache it.
//
// Root: `logout_linger_user` names the account whose lingering matters, i.e. the one Herdr logs in
// with. Reading "root" there as "agents run as root" is an inference (hc's skill only says the
// field names that account), and the field can be null: then isRoot is null, never false.
//
// No herdr call at load: namespace import read when called, so a check's mock can lack some.
import * as host from "herdr";

export const KEY = "kt.machines";
const FIELDS = ["name", "state", "why", "keeps_running_after_logout", "logout_linger_user", "version"];

/** `hc machine ls --json`'s stdout as kt.machines holds it (by name), or null if unreadable. */
export function publishable(stdout) {
  let all;
  try { all = JSON.parse(stdout)?.machines; } catch { return null; }
  if (!Array.isArray(all)) return null;
  return all
    .filter((m) => m && typeof m.name === "string" && m.name && !m.temporary)
    .map((m) => Object.fromEntries(FIELDS.map((k) => [k, m[k] ?? null])))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Sets kt.machines to `list` unless it already holds the same. Returns whether it changed. */
export function publish(list) {
  if (!list) return false;
  if (JSON.stringify(host.shared(KEY) ?? null) === JSON.stringify(list)) return false;
  host.setShared(KEY, list);
  return true;
}

/** The poller: once now, then every `every` ms (kt-threads, outside checks). A failed read keeps
 *  the last list. One read at a time. */
export function pollMachines(cx, every = 15000) {
  let busy = false;
  const read = (cx) => {
    if (busy) return;
    busy = true;
    cx.spawn(async () => {
      try {
        const r = await host.hc(["machine", "ls", "--json"]);
        if (r.code === 0) publish(publishable(r.stdout));
      } catch {} // hc missing or failing: the last list stays
      busy = false;
    });
  };
  read(cx);
  cx.timer.every(every, read);
}

const local = (name) => name == null || name === "";

/** A machine as the mods show it. `layouts`: machines(); `published`: shared("kt.machines").
 *  status: "local", "ready", "loading", "login" (needs_login), "away" (unreachable, unavailable,
 *  or a machine the app doesn't know). A state not published yet (the first 15 s) leaves the
 *  layout alone to decide. */
export function stateOf(name, { layouts = host.machines?.() ?? [], published = host.shared?.(KEY) ?? [] } = {}) {
  if (local(name)) return { name: null, local: true, layout: "ready", state: "connected", why: null, root: false, linger: null, version: null, reachable: true, status: "local" };
  const layout = layouts.find((m) => m.name === name)?.layout ?? null;
  const p = (published ?? []).find((m) => m.name === name) ?? null;
  const state = p?.state ?? null;
  const status = state === "needs_login" ? "login"
    : state && state !== "connected" ? "away"
    : layout === "ready" ? "ready"
    : layout === "loading" ? "loading"
    : "away";
  return {
    name, local: false, layout, state, why: p?.why ?? null,
    root: p ? (p.logout_linger_user == null ? null : p.logout_linger_user === "root") : null,
    linger: p?.keeps_running_after_logout ?? null, version: p?.version ?? null,
    reachable: status === "ready", status,
  };
}

export const reachable = (name, opts) => stateOf(name, opts).reachable;
export const isRoot = (name, opts) => stateOf(name, opts).root;

/** The machine a guarded call was refused for, else null. */
export const isOffline = (e) => e?.offline ?? null;

function refuse(name, opts) {
  const s = stateOf(name, opts);
  return Object.assign(new Error(`${name}: ${s.status}`), { offline: name, status: s.status });
}

/** `exec` that rejects at once, without calling the machine, when `options.on` isn't reachable. */
export function guard(exec, opts) {
  return (cmd, args, options) => {
    const on = options?.on;
    return local(on) || reachable(on, opts) ? exec(cmd, args, options) : Promise.reject(refuse(on, opts));
  };
}

/** `readTextFile` that rejects at once when `options.on` isn't reachable. */
export function guardRead(read, opts) {
  return (path, options) => {
    const on = options?.on;
    return local(on) || reachable(on, opts) ? read(path, options) : Promise.reject(refuse(on, opts));
  };
}
