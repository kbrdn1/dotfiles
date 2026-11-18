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
//   guard(exec)      exec that rejects at once with isOffline(e) = name when the machine is away;
//                    a remote call without a timeout gets 10 s (the app's default is 30 s)
//   guardRead(read)  the same for readTextFile
//   due(on, at, ms)  a poll's tick: always here, on another machine only `ms` after the last read
//   notice(t, name)  what a panel shows instead (away, login with its command and Copy, loading)
//   localOnly(name)  the tooltip of an action that only works on this computer
//
// Its words are in machines.strings.js, copied with it (as viz.strings.js with viz.js).
//
// Asking and being answered are two things. A guarded exec that rejects (the machine is away, the
// program can't start, a timeout) means "couldn't ask": keep what was shown, ask again once the
// machine is back. A resolved exec with a nonzero code is an answer ("not a repo"): cache it.
//
// Root: `logout_linger_user` names the account whose lingering matters, i.e. the one Herdr logs in
// with. Reading "root" there as "agents run as root" is an inference (hc's skill only says the
// field names that account), and the field can be null: then isRoot is null, never false.
//
// No herdr call at load: namespace imports read when called, so a check's mock can lack some.
import * as host from "herdr";
import * as kit from "gpui-kit";
import * as base from "gpui-base";
import { makeT } from "./i18n.js";
import words from "./machines.strings.js";

const tr = makeT(words);
const MONO = "Monaspace Krypton";
export const KEY = "kt.machines";
export const REMOTE_TIMEOUT = 10e3;
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

/** `exec` that rejects at once, without calling the machine, when `options.on` isn't reachable.
 *  A remote call that names no timeout gets REMOTE_TIMEOUT. */
export function guard(exec, opts) {
  return (cmd, args, options) => {
    const on = options?.on;
    if (local(on)) return exec(cmd, args, options);
    if (!reachable(on, opts)) return Promise.reject(refuse(on, opts));
    return exec(cmd, args, { ...options, timeout: options.timeout ?? REMOTE_TIMEOUT });
  };
}

/** `readTextFile` that rejects at once when `options.on` isn't reachable. */
export function guardRead(read, opts) {
  return (path, options) => {
    const on = options?.on;
    return local(on) || reachable(on, opts) ? read(path, options) : Promise.reject(refuse(on, opts));
  };
}

/** A poll's tick (DATA-SYNC.md: a remote space reads on the bus and when its tab comes back; the timer
 *  is only a slow fallback there): always for this computer, else once `every` ms passed since `at`. */
export const due = (on, at, every, now = Date.now()) => local(on) || at == null || now - at >= every;

/** The tooltip of an action that only works on this computer (Zed, a pull request in the browser…). */
export const localOnly = (name) => tr("localOnly", { name });

/** What a panel shows in place of a read it couldn't make on `name`: the state, what it means, the
 *  connection's reason, and for a login the command with Copy. null when `name` is reachable. */
export function notice(t, name, { id = "machine-notice", opts } = {}) {
  const s = stateOf(name, opts);
  if (s.reachable) return null;
  const { div } = kit;
  const { h_flex, v_flex } = base;
  const login = s.status === "login" ? `hc machine login ${name}` : null; // i18n: tech
  const dot = s.status === "login" ? t.blocked : s.status === "loading" ? t.working : t.dim;
  return v_flex().id(id).gap(6).px(12).py(10).rounded(12).border(1).border_color(t.border).bg(t.raised)
    .child(h_flex().gap(8).items_center()
      .child(div().size(7).flex_none().rounded_full().bg(dot))
      .child(div().min_w(0).truncate().text_size(12.5).font_medium().text_color(t.foreground).child(tr(`state.${s.status}`, { name }))))
    .child(div().text_size(11.5).text_color(t.muted).child(tr(`body.${s.status}`)))
    .when(Boolean(s.why), (el) => el.child(div().font_family(MONO).text_size(11).text_color(t.dim).child(s.why)))
    .when(Boolean(login), (el) => el.child(h_flex().gap(6).items_center()
      .child(div().flex_1().min_w(0).truncate().font_family(MONO).text_size(11.5).text_color(t.foreground).child(login))
      .child(div().id(`${id}-copy`).flex_none().px(8).py(3).rounded(6).border(1).border_color(t.border)
        .text_size(11).text_color(t.muted).cursor_pointer().hover((st) => st.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => {
          cx.write_to_clipboard(login);
          host.notify?.({ title: tr("copied"), body: login, level: "success", timeout: 2000 });
        })
        .child(tr("copy")))));
}
