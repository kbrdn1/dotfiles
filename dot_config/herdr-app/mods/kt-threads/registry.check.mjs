// bun ~/.config/herdr-app/mods/kt-threads/registry.check.mjs: registry.js on invented projects. project-move
// keeps the color, the order and the other fields, takes the new id, folder, name and logos, re-keys
// kt.chat.backgrounds (and leaves the other keys alone), absorbs an entry already added for the new folder,
// refuses a folder that isn't on the disk unless forced; project-add appends last, refuses a duplicate. Every
// malformed input (relative folder, "..", a name out of ^[A-Za-z0-9._ -]{1,64}$, a logo outside brand/projects/,
// not JSON) is refused with a reason, and nothing is changed. Not loaded by Herdr.
import assert from "node:assert/strict";
import { idOf, folderOf, parse, moveProject, addProject } from "./registry.js";

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

console.log("registry: ok");
