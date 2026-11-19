// projects.js's check (#88): bun projects.check.mjs. Fixtures with no real name, id or path.
import assert from "node:assert/strict";
import { isArchived, shown, archivedOf, archive, restore, deletePlan } from "./projects.js";

const idOf = (folder) => JSON.stringify([null, folder]);
const A = idOf("/work/alpha"), B = idOf("/work/beta"), R = JSON.stringify(["vps", "/srv/gamma"]);
const list = [
  { id: A, name: "alpha", folder: "/work/alpha", machine: null, color: "ansi3", logos: { light: "brand/projects/a.svg", dark: null }, order: 0 },
  { id: B, name: "beta", folder: "/work/beta", machine: null, color: null, logos: { light: null, dark: null }, order: 1 },
  { id: R, name: "gamma", folder: "/srv/gamma", machine: "vps", color: "ansi5", logos: { light: null, dark: null }, order: 2 },
];

// Archive: the entry keeps everything and gains `archived`; the others are the same objects.
const a = archive(list, A, 1000);
assert.equal(a[0].archived, 1000);
assert.deepEqual({ ...a[0], archived: undefined }, { ...list[0], archived: undefined }, "color, logos, order kept");
assert.equal(a[1], list[1]);
assert.equal(list[0].archived, undefined, "the list given isn't changed");
assert.equal(archive(a, A, 2000), null, "archived already");
assert.equal(archive(list, idOf("/work/none"), 1), null, "no such project");
assert.ok(isArchived(a[0]) && !isArchived(a[1]) && !isArchived(null));
assert.deepEqual(shown(a).map((e) => e.name), ["beta", "gamma"]);
assert.deepEqual(archivedOf(a).map((e) => e.name), ["alpha"]);
assert.deepEqual(shown(null), []);

// Restore: the field goes, the entry is the one it was, at its place.
const r = restore(a, A);
assert.deepEqual(r, list);
assert.ok(!("archived" in r[0]));
assert.equal(restore(list, A), null, "not archived");
assert.equal(restore(list, idOf("/work/none")), null);

// Delete by force: the entry, its fond (another project's stays), the slice that pointed at it, the folder to forget.
const maps = { "kt.chat.backgrounds": { [A]: { src: "data/kt-chat/src-x.png" }, [B]: { src: "data/kt-chat/src-y.png" } }, "kt.other": { [B]: 1 } };
const pick = { project: A, program: "p" };
const w = deletePlan({ projects: a, maps, pick, forget: { "/work/old": 5 } }, A, 3000);
assert.deepEqual(w["kt.projects"].map((e) => e.name), ["beta", "gamma"]);
assert.deepEqual(w["kt.chat.backgrounds"], { [B]: { src: "data/kt-chat/src-y.png" } });
assert.ok(!("kt.other" in w), "a map without it isn't written");
assert.deepEqual(w["kt.kanban.slicePick"], { project: null, program: "p" });
assert.deepEqual(w["kt.hub.forget"], { "/work/old": 5, "/work/alpha": 3000 });
assert.deepEqual(Object.keys(maps["kt.chat.backgrounds"]).length, 2, "the maps given aren't changed");
// A slice on another project stays; nothing to forget for a project of another computer.
const w2 = deletePlan({ projects: list, maps: {}, pick: { project: B } }, R, 3000);
assert.deepEqual(Object.keys(w2), ["kt.projects"]);
assert.equal(deletePlan({ projects: list }, idOf("/work/none"), 1), null);
assert.deepEqual(deletePlan({ projects: list }, B, 7)["kt.hub.forget"], { "/work/beta": 7 }, "no forget yet");

console.log("projects.check: ok");
