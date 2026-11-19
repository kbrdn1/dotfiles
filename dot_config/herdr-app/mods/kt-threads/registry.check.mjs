// bun ~/.config/herdr-app/mods/kt-threads/registry.check.mjs: registry.js on invented projects. project-move
// keeps the color, the order and the other fields, takes the new id, folder, name and logos, re-keys
// kt.chat.backgrounds (and leaves the other keys alone), absorbs an entry already added for the new folder,
// refuses a folder that isn't on the disk unless forced; project-add appends last, refuses a duplicate. Every
// malformed input (relative folder, "..", a name out of ^[A-Za-z0-9._ -]{1,64}$, a logo outside brand/projects/,
// not JSON) is refused with a reason, and nothing is changed. The request file (requestOf + settle): applied
// once per id (a replay set aside), set aside past 2 minutes either way (120000 ms still good), and a request
// set aside or refused writes nothing. guard: a command that throws never ends kt-threads' loop. Not loaded
// by Herdr.
import assert from "node:assert/strict";
import { idOf, folderOf, parse, fromBase64url, moveProject, addProject, requestOf, settle, REQUEST_TTL, APPLIED_KEPT, guard, failure } from "./registry.js";

const P = "/Users/someone/Projects";
const entry = (name, order, extra = {}) => ({ id: idOf(`${P}/${name}`), name, folder: `${P}/${name}`, machine: null, color: "ansi3", order,
  logos: { light: `brand/projects/${name}-light.svg`, dark: `brand/projects/${name}-dark.svg` }, ...extra });
const list = [entry("alpha", 0), entry("old-hub", 1, { color: "ansi5", logosFrom: { light: "x", dark: "y" } }), entry("tv-old", 2)];
const backgrounds = { [idOf(`${P}/tv-old`)]: { src: "/tmp/bg.png", opacity: 0.24 }, "root:/Users/someone": { src: "/tmp/root.png" } };

// folderOf: absolute, no "." / "..", no empty segment; a trailing slash dropped.
assert.equal(folderOf(`${P}/a/`), `${P}/a`);
assert.equal(folderOf("/"), "/");
for (const bad of ["rel/a", `${P}/../etc`, `${P}/./a`, `${P}//a`, "", null, 3, `${P}/a\nb`]) assert.equal(folderOf(bad), null, `refused: ${JSON.stringify(bad)}`);

// parse: a JSON object only.
assert.deepEqual(parse('{"a":1}'), { ok: true, value: { a: 1 } });
assert.equal(parse("nope").ok, false);
assert.equal(parse("[1]").ok, false);
assert.equal(parse("null").ok, false);

// (a) the hub: folder renamed on disk. Color, order, other fields stay; id, folder, name, logos change.
const a = moveProject(list, { "kt.chat.backgrounds": backgrounds }, { from: `${P}/old-hub`, to: `${P}/new-hub`, name: "new-hub", logos: "brand/projects/new-hub.svg" }, true);
assert.equal(a.ok, true, a.reason);
const hub = a.list[1];
assert.deepEqual([hub.id, hub.folder, hub.name, hub.color, hub.order], [idOf(`${P}/new-hub`), `${P}/new-hub`, "new-hub", "ansi5", 1]);
assert.deepEqual(hub.logos, { light: "brand/projects/new-hub.svg", dark: "brand/projects/new-hub.svg" });
assert.deepEqual(hub.logosFrom, { light: "x", dark: "y" }, "other fields kept");
assert.deepEqual(a.list.map((e) => e.name), ["alpha", "new-hub", "tv-old"], "same place");
assert.deepEqual(a.maps, {}, "no background on the hub: no map changed");
assert.equal(list[1].name, "old-hub", "the input list untouched");

// (c) tv: the chat background follows the project id; the root's stays; name only, logos kept when not given.
const c = moveProject(list, { "kt.chat.backgrounds": backgrounds }, { from: `${P}/tv-old`, to: `${P}/tv-new`, name: "tv-new" }, true);
assert.equal(c.ok, true, c.reason);
const bg = c.maps["kt.chat.backgrounds"];
assert.deepEqual(bg[idOf(`${P}/tv-new`)], { src: "/tmp/bg.png", opacity: 0.24 }, "re-keyed to the new id");
assert.equal(idOf(`${P}/tv-old`) in bg, false, "the old key gone");
assert.deepEqual(bg["root:/Users/someone"], { src: "/tmp/root.png" }, "other keys kept");
assert.deepEqual(c.list[2].logos, list[2].logos, "logos kept when not given");
assert.equal(c.list[2].name, "tv-new");

// An entry kt-threads already added for the new folder (a space opened there) is absorbed: one entry left,
// the moved one, in its own place, with its color.
const auto = [...list, { id: idOf(`${P}/new-hub`), name: "new-hub", folder: `${P}/new-hub`, machine: null, color: "ansi1", order: 3, logos: { light: null, dark: null } }];
const d = moveProject(auto, {}, { from: `${P}/old-hub`, to: `${P}/new-hub` }, true);
assert.equal(d.ok, true, d.reason);
assert.equal(d.list.filter((e) => e.folder === `${P}/new-hub`).length, 1);
assert.deepEqual([d.list[1].color, d.list[1].order, d.list.length], ["ansi5", 1, 3]);

// Not on the disk: refused, unless force (prepared ahead of the rename).
assert.equal(moveProject(list, {}, { from: `${P}/tv-old`, to: `${P}/tv-new` }, false).ok, false);
assert.equal(moveProject(list, {}, { from: `${P}/tv-old`, to: `${P}/tv-new`, force: true }, false).ok, true);
assert.equal(moveProject(list, {}, { from: `${P}/tv-old`, to: `${P}/tv-new`, force: "yes" }, false).ok, false, "force must be true");

// Refused moves, each with a reason: no such project, same folder, bad folders, bad name, bad logos.
for (const [what, input] of [
  ["no project there", { from: `${P}/ghost`, to: `${P}/x` }],
  ["same folder", { from: `${P}/alpha`, to: `${P}/alpha/` }],
  ["relative to", { from: `${P}/alpha`, to: "alpha2" }],
  ["dotdot to", { from: `${P}/alpha`, to: `${P}/../alpha2` }],
  ["name with /", { from: `${P}/alpha`, to: `${P}/alpha2`, name: "a/b" }],
  ["empty name", { from: `${P}/alpha`, to: `${P}/alpha2`, name: "" }],
  ["name too long", { from: `${P}/alpha`, to: `${P}/alpha2`, name: "x".repeat(65) }],
  ["logo outside brand", { from: `${P}/alpha`, to: `${P}/alpha2`, logos: "/etc/passwd" }],
  ["logo with a folder", { from: `${P}/alpha`, to: `${P}/alpha2`, logos: "brand/projects/../x.svg" }],
  ["logo not an image", { from: `${P}/alpha`, to: `${P}/alpha2`, logos: "brand/projects/x.js" }],
  ["bad pair", { from: `${P}/alpha`, to: `${P}/alpha2`, logos: { light: "brand/projects/a.svg", dark: "mods/x.svg" } }],
  ["no input", null],
]) {
  const r = moveProject(list, { "kt.chat.backgrounds": backgrounds }, input, true);
  assert.equal(r.ok, false, `refused: ${what}`);
  assert.equal(typeof r.reason, "string", `a reason: ${what}`);
}
// A pair of logos, one per mode (null allowed for a missing one).
const pair = moveProject(list, {}, { from: `${P}/alpha`, to: `${P}/alpha2`, logos: { light: "brand/projects/a-light.png", dark: null } }, true);
assert.deepEqual(pair.list[0].logos, { light: "brand/projects/a-light.png", dark: null });

// (b) project-add: last, no color yet, its logos; a duplicate, a missing folder, a bad input refused.
const b = addProject(list, { folder: `${P}/interface`, name: "interface", logos: "brand/projects/interface.svg" }, true);
assert.equal(b.ok, true, b.reason);
assert.deepEqual(b.list.at(-1), { id: idOf(`${P}/interface`), name: "interface", folder: `${P}/interface`, machine: null, color: null,
  logos: { light: "brand/projects/interface.svg", dark: "brand/projects/interface.svg" }, order: 3 });
assert.equal(b.list.length, 4);
assert.equal(addProject(list, { folder: `${P}/alpha`, name: "alpha" }, true).ok, false, "already there");
assert.equal(addProject(list, { folder: `${P}/interface`, name: "interface" }, false).ok, false, "not on the disk");
assert.equal(addProject(list, { folder: `${P}/interface`, name: "bad|name" }, true).ok, false, "bad name");
assert.equal(addProject(list, { folder: "interface", name: "interface" }, true).ok, false, "relative folder");
assert.deepEqual(addProject([], { folder: `${P}/first`, name: "first" }, true).list[0].logos, { light: null, dark: null }, "no logos given");

// b64:<base64url>, the form `herdr-app do` passes intact: a valid one (built the way the command line does,
// base64 then + / -> - _ and no =), UTF-8 included; a broken one; one of invalid JSON; plain JSON still read.
const b64url = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const payload = { from: `${P}/old-hub`, to: `${P}/new-hub`, name: "new-hub", logos: "brand/projects/new-hub.svg" };
assert.deepEqual(parse(`b64:${b64url(JSON.stringify(payload))}`), { ok: true, value: payload }, "a valid b64");
assert.deepEqual(parse(`b64:${b64url('{"name":"é ü 漢"}')}`), { ok: true, value: { name: "é ü 漢" } }, "UTF-8 decoded");
assert.deepEqual(parse(`b64:${b64url(JSON.stringify(payload))}==`).ok, true, "padding tolerated");
assert.equal(parse("b64:not base64!").ok, false, "a broken b64");
assert.equal(parse("b64:A").ok, false, "a b64 of impossible length");
assert.equal(parse(`b64:${Buffer.from([0x7b, 0xff, 0x7d]).toString("base64url")}`).reason, "not base64url", "a b64 of invalid UTF-8");
assert.equal(parse(`b64:${b64url("{not json")}`).reason, "not JSON", "a b64 of invalid JSON");
assert.equal(parse(`b64:${b64url("[1,2]")}`).ok, false, "a b64 of a JSON array");
assert.deepEqual(parse(JSON.stringify(payload)), { ok: true, value: payload }, "plain JSON still read");
// The bytes of invalid UTF-8 (a lone continuation byte): refused, not mangled.
assert.equal(fromBase64url(Buffer.from([0x80]).toString("base64url")), null);
assert.equal(fromBase64url(Buffer.from("ok", "utf8").toString("base64url")), "ok");
// And the decoded payload goes through as it would: the move succeeds.
assert.equal(moveProject(list, {}, parse(`b64:${b64url(JSON.stringify(payload))}`).value, true).ok, true);

// The request file, as kt-threads takes it: requestOf, then settle against the shared keys; the writes applied
// to a copy of the state the way setShared would.
const NOW = 1_800_000_000_000;
const state0 = { projects: list, maps: { "kt.chat.backgrounds": backgrounds }, applied: [] };
const frozen = structuredClone(state0);
const take = (text, state, now = NOW, exists = true) => settle(requestOf(text, now, state.applied), state, exists);
const next = (state, writes) => ({
  projects: writes["kt.projects"] ?? state.projects,
  maps: { "kt.chat.backgrounds": writes["kt.chat.backgrounds"] ?? state.maps["kt.chat.backgrounds"] },
  applied: writes["kt.registry.applied"] ?? state.applied,
});
const tvMove = { id: "req-c", at: NOW, kind: "project-move", from: `${P}/tv-old`, to: `${P}/tv-new/`, name: "tv-new", logos: "brand/projects/tv-new.svg" };

// Applied: the entry as it now stands (color and order kept), the background re-keyed, the id kept.
assert.equal(requestOf(JSON.stringify(tvMove), NOW).folder, `${P}/tv-new`, "the folder to look for, normalized");
const t1 = take(JSON.stringify(tvMove), state0);
assert.equal(t1.out.ok, true, t1.out.reason);
assert.deepEqual([t1.out.project, t1.out.entry.name, t1.out.entry.color, t1.out.entry.order, t1.out.maps], [idOf(`${P}/tv-new`), "tv-new", "ansi3", 2, ["kt.chat.backgrounds"]]);
assert.deepEqual(Object.keys(t1.writes).sort(), ["kt.chat.backgrounds", "kt.projects", "kt.registry.applied"]);
assert.deepEqual(t1.writes["kt.registry.applied"], ["req-c"]);
assert.deepEqual(t1.writes["kt.chat.backgrounds"]["root:/Users/someone"], { src: "/tmp/root.png" }, "other backgrounds kept");
const state1 = next(state0, t1.writes);

// The same id again: set aside, even with a fresh `at`, and nothing written.
for (const replay of [tvMove, { ...tvMove, at: NOW + 5000 }, { ...tvMove, from: `${P}/alpha`, to: `${P}/alpha2` }]) {
  const r = take(JSON.stringify(replay), state1, NOW + 5000);
  assert.deepEqual(r, { out: { ok: false, reason: "applied already" }, writes: {} }, "a replayed id");
}

// The delay: 2 minutes either way still good, a millisecond past it set aside.
const addAt = (at, id = "req-b") => JSON.stringify({ id, at, kind: "project-add", folder: `${P}/interface`, name: "interface", logos: "brand/projects/interface.svg" });
assert.equal(REQUEST_TTL, 120000);
assert.equal(take(addAt(NOW - 120000), state1).out.ok, true, "120000 ms old: good");
assert.equal(take(addAt(NOW + 120000), state1).out.ok, true, "120000 ms ahead: good");
for (const at of [NOW - 120001, NOW + 120001, 0]) {
  const r = take(addAt(at), state1);
  assert.deepEqual(r.writes, {}, `at ${at - NOW}: nothing written`);
  assert.match(r.out.reason, /older than 2 minutes/);
}
const b2 = take(addAt(NOW), state1);
assert.deepEqual([b2.out.entry.name, b2.out.entry.color, b2.out.entry.order, b2.writes["kt.projects"].at(-1).name], ["interface", null, 3, "interface"], "added last, no color yet");

// Invalid requests: a reason, nothing written, the state untouched.
for (const [what, text, exists = true] of [
  ["not JSON", "{nope"],
  ["an array", "[1]"],
  ["no id", JSON.stringify({ ...tvMove, id: undefined })],
  ["a bad id", JSON.stringify({ ...tvMove, id: "../x" })],
  ["an id too long", JSON.stringify({ ...tvMove, id: "x".repeat(65) })],
  ["no at", JSON.stringify({ ...tvMove, id: "r1", at: undefined })],
  ["at as text", JSON.stringify({ ...tvMove, id: "r2", at: String(NOW) })],
  ["an unknown kind", JSON.stringify({ ...tvMove, id: "r3", kind: "project-delete" })],
  ["no kind", JSON.stringify({ ...tvMove, id: "r4", kind: undefined })],
  ["a bad name", JSON.stringify({ ...tvMove, id: "r5", name: "a/b" })],
  ["a logo outside brand", JSON.stringify({ ...tvMove, id: "r6", logos: "/etc/passwd" })],
  ["a relative folder", JSON.stringify({ ...tvMove, id: "r7", to: "tv-new" })],
  ["no project there", JSON.stringify({ ...tvMove, id: "r8", from: `${P}/ghost` })],
  ["not on the disk", JSON.stringify({ ...tvMove, id: "r9" }), false],
  ["force not true", JSON.stringify({ ...tvMove, id: "r10", force: "yes" }), false],
  ["an add of a folder there already", JSON.stringify({ id: "r11", at: NOW, kind: "project-add", folder: `${P}/alpha`, name: "alpha" })],
]) {
  const r = take(text, state0, NOW, exists);
  assert.equal(r.out.ok, false, `refused: ${what}`);
  assert.equal(typeof r.out.reason, "string", `a reason: ${what}`);
  assert.deepEqual(r.writes, {}, `nothing written: ${what}`);
}
assert.deepEqual(state0, frozen, "the state read, never changed");

// The applied ids kept: the last APPLIED_KEPT.
const many = { ...state0, applied: Array.from({ length: APPLIED_KEPT }, (_, i) => `old-${i}`) };
const kept = take(JSON.stringify(tvMove), many).writes["kt.registry.applied"];
assert.deepEqual([kept.length, kept[0], kept.at(-1)], [APPLIED_KEPT, "old-1", "req-c"]);

// guard: kt-threads' command loop, faked. A handler that throws, one that rejects after an await, one that never
// returns (a folder picker left open, the 2026-11-19 block), and one whose failure report throws too: each is
// said or left pending, and every command after it is handled at once, in order.
const handled = [], failures = [];
const dispatch = async (c) => {
  if (c === "boom") throw new Error("boom");
  if (c === "late") { await null; throw new Error("late"); }
  if (c === "spawn") ({}).spawn(); // a TypeError, as a missing cx.spawn would be
  if (c === "new-project") { await new Promise(() => {}); handled.push("never"); }
  handled.push(c);
};
const tick = () => new Promise((r) => setTimeout(r, 0));
// The loop as kt-threads runs it (awaiting each guard): it must reach its end, not wait on new-project.
let timer;
const loop = (async () => { for (const c of ["agents", "boom", "new-project", "density", "late", "spawn", "every"]) await guard(c, dispatch, (f) => failures.push(f), () => 7); })();
const through = await Promise.race([loop.then(() => true), new Promise((r) => { timer = setTimeout(() => r(false), 1000); })]);
clearTimeout(timer);
assert.ok(through, "the loop went past a command that never returns");
assert.deepEqual(handled, ["agents", "density", "every"], "each handled, past a failure and past a command that never returns");
await tick(); // the rejections land
assert.deepEqual(failures.map((f) => f.received).sort(), ["boom", "late", "spawn"]);
assert.ok(failures.every((f) => f.at === 7));
assert.match(failures.find((f) => f.received === "boom").error, /^Error: boom/);
assert.match(failures.find((f) => f.received === "spawn").error, /TypeError/);
guard("boom", dispatch, () => { throw new Error("the report failed"); });
guard("after", dispatch, () => {});
await tick();
assert.equal(handled.at(-1), "after", "a report that throws doesn't end it either");
assert.ok(!handled.includes("never"), "the pending one still pending, nothing waited on it");
const long = failure("x".repeat(500), { stack: "s".repeat(5000) }, 1);
assert.deepEqual([long.received.length, long.error.length], [200, 2000], "bounded");

console.log("registry: ok");
