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
//   stateOf(name)    { name, local, layout, state, why, root, account, linger, version, reachable,
//                    status }
//   reachable(name)  this computer, or layout "ready" and not known to be away
//   isRoot(name)     true / false, null when it isn't known
//   machineList()    every other machine, by name, as stateOf describes it
//   loginOf(name)    `hc machine login <name>` when it needs one, else null
//   stateWord(name), stateColor(t, status), machineTag(t, name, { id }): a machine as the lists show
//                    it (a dot, its name, ROOT; its state and account on hover)
//   machineNote(t, name, text, { id })  a view that shows this Mac only, said beside another machine's
//                    thread: its tag and `text` on a dashed line (#65)
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
  if (local(name)) return { name: null, local: true, layout: "ready", state: "connected", why: null, root: false, account: null, linger: null, version: null, reachable: true, status: "local" };
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
    account: p?.logout_linger_user ?? null,
    linger: p?.keeps_running_after_logout ?? null, version: p?.version ?? null,
    reachable: status === "ready", status,
  };
}

export const reachable = (name, opts) => stateOf(name, opts).reachable;
export const isRoot = (name, opts) => stateOf(name, opts).root;

/** Every other machine (published or with a layout), by name, as stateOf describes it. */
export function machineList({ layouts = host.machines?.() ?? [], published = host.shared?.(KEY) ?? [] } = {}) {
  const names = [...new Set([...(published ?? []).map((m) => m.name), ...layouts.map((m) => m.name)].filter((n) => !local(n)))].sort();
  return names.map((n) => stateOf(n, { layouts, published }));
}

/** What to run when a machine needs a login, else null. */
export const loginOf = (name, opts) => (stateOf(name, opts).status === "login" ? `hc machine login ${name}` : null); // i18n: tech

/** A machine's state in a word ("login requis", "injoignable", "connexion…"); "" when it answers. */
export function stateWord(name, opts) {
  const { status } = stateOf(name, opts);
  return status === "ready" || status === "local" ? "" : tr(`word.${status}`);
}

/** The dot of a state: answers (done), login (blocked), loading (working), away (dim). */
export const stateColor = (t, status) => ({ ready: t.done, local: t.done, login: t.blocked, loading: t.working }[status] ?? t.dim);

/** A machine as a small tag: its state's dot, its name, ROOT when it logs in as root; on hover, its
 *  state, its account and what ROOT means. null for this computer. `id`: unique where it's drawn. */
export function machineTag(t, name, { id, opts, size = 10.5 } = {}) {
  if (local(name)) return null;
  const s = stateOf(name, opts);
  const { div } = kit;
  const { h_flex } = base;
  const tip = [s.reachable ? tr("tip.ready", { name }) : tr(`state.${s.status}`, { name }),
    s.account ? tr("tip.account", { account: s.account }) : null, s.root === true ? tr("tip.root") : null].filter(Boolean).join(" · ");
  return h_flex().id(id ?? `machine-tag-${name}`).flex_none().gap(5).items_center().px(6).rounded_full().bg(t.raised)
    .font_family(MONO).text_size(size).text_color(s.reachable ? t.dim : t.muted).tooltip(tip)
    .child(div().size(6).flex_none().rounded_full().bg(stateColor(t, s.status)))
    .child(name)
    .when(s.root === true, (el) => el.child(rootMark(t, div))); // i18n: tech
}

// ROOT in the warning hue. blocked is 4.1:1 on light (FILTERS.md, #81): there the word stays foreground
// and the hue goes on a thin border; dark keeps the hued word, as before.
function rootMark(t, div) {
  const dark = host.settings?.()?.dark !== false;
  return div().flex_none().text_color(dark ? t.blocked : t.foreground)
    .when(!dark, (el) => el.px(3).rounded(3).border(1).border_color(`${String(t.blocked).slice(0, 7)}80`))
    .child("ROOT"); // i18n: tech
}

/** What a view shows when the thread or project on screen is another machine's and the view reads this
 *  Mac only (#65): the machine's tag, then `text` (the mod's own words), on a dashed line. null for this
 *  computer. `id`: unique where it's drawn. */
export function machineNote(t, name, text, { id = "machine-note", opts } = {}) {
  if (local(name)) return null;
  const { div } = kit;
  const { h_flex } = base;
  return h_flex().id(id).flex_none().px(10).py(6).gap(8).items_center().rounded(12).border(1).border_dashed().border_color(t.border)
    .child(machineTag(t, name, { id: `${id}-tag`, opts }))
    .child(div().flex_1().min_w(0).text_size(12).line_height("17px").text_color(t.muted).child(text));
}

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
  const login = loginOf(name, opts);
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
