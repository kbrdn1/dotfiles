// registry.js: the project registry (shared "kt.projects") moved or grown by a command, where neither
// kt-projects nor kt-threads' own sync can: a project's folder renamed on disk (k-hub -> kbrdn-hub), a
// project added before any space opens on it. kt-threads runs them, from `herdr-app do`, the JSON as
// base64url (a raw JSON value doesn't reach the mod intact through the CLI); the outcome is written to
// shared "kt.registry.last" ({ at, received, ok, id | reason }), read with jq:
//
//   herdr-app do "kt-threads.project-move:b64:$(printf %s '{"from":"/…/k-hub","to":"/…/kbrdn-hub"}' | base64 | tr '+/' '-_' | tr -d '=\n')"
//   jq '."kt.registry.last"' ~/.config/herdr-app/shared.json
//
// project-move {from, to, name?, logos?, force?}: the entry of this computer whose folder is `from` takes
//   `to`'s id ([null, to]) and folder, and the name and logos given; its color, order and other fields stay.
//   The maps keyed by project id (kt.chat.backgrounds) follow it. An entry already made for `to` (kt-threads
//   adds one when a space opens there) goes: the moved one, with its color and place, stands for it.
// project-add {folder, name, logos?, force?}: a new entry, last, with no color yet; refused when the folder
//   has one.
// Both refuse a folder (`to`, `folder`) that isn't on the disk, unless `force` (a move prepared before the
// folder is renamed). Strict input: absolute folders without "." or ".." segments, a name of
// ^[A-Za-z0-9._ -]{1,64}$, logos only `brand/projects/<simple file name>.svg|png` (one for both modes, or
// { light, dark }). Anything else: nothing done, and the reason said. Pure: the caller reads the disk
// (`exists`), the shared keys, and writes what comes back. Checked by registry.check.mjs.

export const idOf = (folder) => JSON.stringify([null, folder]);
const NAME = /^[A-Za-z0-9._ -]{1,64}$/;
const LOGO = /^brand\/projects\/[A-Za-z0-9._-]+\.(svg|png)$/;

/** An absolute folder without "." / ".." segments, its trailing slash dropped; null when not one. */
export function folderOf(p) {
  if (typeof p !== "string" || !p.startsWith("/") || p.length > 1024 || /[\0\n\r]/.test(p)) return null;
  const parts = p.split("/").slice(1);
  if (parts.some((s, i) => s === "." || s === ".." || (s === "" && i < parts.length - 1))) return null;
  return p.length > 1 ? p.replace(/\/$/, "") : p;
}

// { light, dark } from one path or a pair; undefined when not given; null when invalid.
function logosOf(v) {
  if (v === undefined) return undefined;
  const one = (x) => (x === null || (typeof x === "string" && LOGO.test(x)) ? x : undefined);
  if (typeof v === "string") return one(v) ? { light: v, dark: v } : null;
  if (!v || typeof v !== "object") return null;
  const [light, dark] = [one(v.light ?? null), one(v.dark ?? null)];
  return light === undefined || dark === undefined ? null : { light, dark };
}

/** The command's JSON, read strictly: { ok: true, value } or { ok: false, reason }. */
export function parse(text) {
  if (typeof text === "string" && text.startsWith("b64:")) {
    const json = fromBase64url(text.slice(4));
    if (json === null) return { ok: false, reason: "not base64url" }; // i18n: tech
    text = json;
  }
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? { ok: true, value: v } : { ok: false, reason: "not a JSON object" }; // i18n: tech
  } catch {
    return { ok: false, reason: "not JSON" }; // i18n: tech
  }
}

// `b64:<base64url>`: the JSON as base64url (A-Z a-z 0-9 - _, no padding needed), so `herdr-app do` passes
// the command as it is: a raw JSON value ({, ", :) doesn't reach the mod intact. Decoded here by hand (no
// atob in every runtime), UTF-8 included; null when it isn't base64url or valid UTF-8.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export function fromBase64url(s) {
  const text = String(s).replace(/=+$/, "");
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const bytes = [];
  let acc = 0, bits = 0;
  for (const ch of text) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 255); }
  }
  let out = "";
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    const n = b < 0x80 ? 0 : b >= 0xf0 ? 3 : b >= 0xe0 ? 2 : b >= 0xc0 ? 1 : -1;
    if (n < 0 || i + n > bytes.length - 1) return null;
    let cp = n ? b & (0x3f >> n) : b;
    for (let k = 1; k <= n; k++) {
      if ((bytes[i + k] & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (bytes[i + k] & 0x3f);
    }
    out += String.fromCodePoint(cp);
    i += n + 1;
  }
  return out;
}

const no = (reason) => ({ ok: false, reason });

/** project-move. `list`: kt.projects; `maps`: { key: { [project id]: value } } (kt.chat.backgrounds);
 *  `exists`: whether `to` is a folder on the disk. Returns { ok, list, maps (only those changed), id } or
 *  { ok: false, reason }. */
export function moveProject(list, maps, input, exists) {
  const from = folderOf(input?.from), to = folderOf(input?.to);
  if (!from || !to) return no("from and to must be absolute folders without . or .."); // i18n: tech
  if (from === to) return no("from and to are the same folder"); // i18n: tech
  if (input.name !== undefined && !(typeof input.name === "string" && NAME.test(input.name))) return no("name must match ^[A-Za-z0-9._ -]{1,64}$"); // i18n: tech
  const logos = logosOf(input.logos);
  if (logos === null) return no("logos must be brand/projects/<file>.svg|png"); // i18n: tech
  if (!exists && input.force !== true) return no(`${to} is not on the disk (force: true to move ahead of the rename)`); // i18n: tech
  const [oldId, newId] = [idOf(from), idOf(to)];
  const e = (list ?? []).find((x) => !x.machine && x.id === oldId);
  if (!e) return no(`no project at ${from}`); // i18n: tech
  const moved = { ...e, id: newId, folder: to, ...(input.name !== undefined ? { name: input.name } : {}), ...(logos ? { logos } : {}) };
  const next = list.filter((x) => x.id !== newId).map((x) => (x === e ? moved : x));
  const changed = {};
  for (const [key, map] of Object.entries(maps ?? {})) {
    if (!map || !(oldId in map)) continue;
    const { [oldId]: value, ...rest } = map;
    changed[key] = { ...rest, [newId]: value };
  }
  return { ok: true, list: next, maps: changed, id: newId };
}

/** project-add. `exists`: whether `folder` is a folder on the disk. Returns { ok, list, id } or { ok: false, reason }. */
export function addProject(list, input, exists) {
  const folder = folderOf(input?.folder);
  if (!folder) return no("folder must be an absolute folder without . or .."); // i18n: tech
  if (!(typeof input.name === "string" && NAME.test(input.name))) return no("name must match ^[A-Za-z0-9._ -]{1,64}$"); // i18n: tech
  const logos = logosOf(input.logos);
  if (logos === null) return no("logos must be brand/projects/<file>.svg|png"); // i18n: tech
  if (!exists && input.force !== true) return no(`${folder} is not on the disk`); // i18n: tech
  const id = idOf(folder);
  if ((list ?? []).some((x) => x.id === id)) return no(`${folder} is in the registry already`); // i18n: tech
  const order = (list ?? []).reduce((m, x) => Math.max(m, (x.order ?? 0) + 1), 0);
  const entry = { id, name: input.name, folder, machine: null, color: null, logos: logos ?? { light: null, dark: null }, order };
  return { ok: true, list: [...(list ?? []), entry], id };
}
