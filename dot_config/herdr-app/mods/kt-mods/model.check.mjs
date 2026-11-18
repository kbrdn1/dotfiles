// bun ~/.config/herdr-app/mods/kt-mods/model.check.mjs : kt-mods' pure side, on the real layout (read only).
import { readFileSync } from "fs";
import { homedir } from "os";
import { SAFE, SHARED, groupOf, shippedOf, headerOf, firstSentence, describe, layoutRefs, openersIn, keyRefs, rootChoices, setRootKey, deletePlan } from "./model.js";

const eq = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: ${JSON.stringify(got)} !== ${JSON.stringify(want)}`);
};

// Names: a dot is refused (it crashed the window), dashes and digits pass.
eq([SAFE.test("kt-mods"), SAFE.test("win98"), SAFE.test("zz-ktm-probe.off"), SAFE.test("a/b"), SAFE.test("My_Mod")], [true, true, false, false, false], "safe names: [a-z0-9-]+");
const shipped = shippedOf({ toast: {}, menu: {}, "layout:main": {} });
eq([...shipped], ["toast", "menu"], "shipped without layouts");
eq([groupOf("toast", shipped), groupOf("kt-usage", shipped), groupOf("kbrdn-toast", shipped), groupOf("motion-probe", shipped)], ["herdr", "kbrdn", "kbrdn", "other"], "groups");

// Descriptions: mod.json first, else the header's first sentence.
eq(headerOf("\n// One. Two\n// three.\nimport x"), "One. Two three.", "header");
eq(firstSentence("Agents in views; parents (e.g. x) win. More."), "Agents in views; parents (e.g.", "first sentence (a known cut)");
eq(firstSentence("kbrdn.dev and herdr.dev are sites. Then"), "kbrdn.dev and herdr.dev are sites.", "dots inside words");
eq(describe({ description: " Mine " }, "// header."), "Mine", "description wins");
eq(describe({}, "// From the header. Not this."), "From the header.", "header fallback");

// The real layout: its blocks, what layout.hide can take, its root keys.
const home = `${homedir()}/.config/herdr-app`;
const text = readFileSync(`${home}/layouts/kbrdn-threads.json`, "utf8");
const refs = layoutRefs("kbrdn-threads", JSON.parse(text));
const by = (mod, role) => refs.find((r) => r.mod === mod && r.role === role);
eq(by("kt-threads", "block")?.hideable, true, "threads block hideable");
eq(by("kt-inbox", "block")?.hideable, false, "a stack child is not (layout.select)");
eq(by("kt-details", "floating")?.hideable, false, "floating is not (no node for layout.hide)");
eq(refs.filter((r) => r.mod === "kt-head").length, 2, "kt-head twice (brand, crumbs)");
eq(by("kbrdn-toast", "toast")?.implicit, false, "toast set");
eq(layoutRefs("x", { id: "root", type: "row", children: [] }).filter((r) => r.implicit).map((r) => r.mod), ["toast", "menu"], "unset roots are the shipped ones");
const hid = layoutRefs("x", { id: "root", type: "row", children: [{ id: "panel", type: "column", hidden: true, children: [{ id: "f", type: "block", content: { mod: "kt-files" } }] }] });
eq([hid[0].hidden, hid[0].under, hid[0].hideable], [false, true, true], "under a hidden column");
const main = JSON.parse(readFileSync(`${home}/layouts/main.json`, "utf8"));
if (!layoutRefs("main", main).some((r) => r.role === "header")) throw new Error("main's pane header is found");

// Openers: literal mods only, the first `mod:` of each call.
eq([...openersIn(`openOverlay({ mod: this.mod, kind: "dialog" });\n x\n openOverlay({\n  mod: "kt-new", props: {} });\n run("mod.open", { name: "kt-usage" })`)], ["kt-new", "kt-usage"], "openers");

// Keys: mod.open and mod commands, not app commands.
const names = new Set(["kt-keys", "kt-head", "pane"]);
const app = new Set(["pane.go", "mod.open"]);
eq(keyRefs({ g: { a: { command: "mod.open", args: { name: "kt-keys" } }, b: "kt-head.panel:files", c: "pane.go:left", d: "mod.open:kt-new" } }, names, app).map((k) => `${k.mod}/${k.kind}`),
  ["kt-keys/open", "kt-head/command", "kt-new/open"], "key refs");

// Root choices: the shipped one, then its clones, then the current one if neither.
eq(rootChoices("toast", [{ name: "kbrdn-toast", json: { cloned_from: { name: "toast" } } }, { name: "kt-menu", json: { cloned_from: { name: "menu" } } }], "kbrdn-toast"), ["toast", "kbrdn-toast"], "toast choices");

// The root key edit: one line, round trip byte for byte, nested keys and broken JSON refused.
const off = setRootKey(text, "toast", "toast");
if (!off || off === text) throw new Error("toast -> toast");
eq(off.split("\n").filter((l, i) => l !== text.split("\n")[i]).length, 1, "one line changed");
eq(setRootKey(off, "toast", "kbrdn-toast"), text, "round trip");
const added = setRootKey(`{\n  "id": "root",\n  "type": "row"\n}\n`, "toast", "kbrdn-toast");
eq(added, `{\n  "id": "root",\n  "toast": "kbrdn-toast",\n  "type": "row"\n}\n`, "added after id");
eq(setRootKey(`{\n  "id": "root",\n  "children": [{ "props": {\n    "toast": "x" } }]\n}`, "toast", "y"), null, "a nested key is refused");
eq(setRootKey("{ nope", "toast", "y"), null, "broken JSON refused");

// Deleting: deepest first, nothing outside the folder.
eq(deletePlan("/m/zz", ["/m/zz/a.js", "/m/zz/d/b.svg"], ["/m/zz/d"]), { files: ["/m/zz/d/b.svg", "/m/zz/a.js"], dirs: ["/m/zz/d", "/m/zz"] }, "delete order");
eq(deletePlan("/m/zz", ["/m/zz/../kt-keys/vim.js"], []), null, "escape refused");
eq(deletePlan("/m/zz", ["/m/zzz/a.js"], []), null, "sibling refused");
// SHARED watches every shared module, each with its reference mod, and that reference holds the file.
const MODS = `${homedir()}/.config/herdr-app/mods`;
for (const f of ["ring.js", "levels.js", "band.js", "select.js", "diffview.js", "diff.js", "reread.js", "icons.js", "companion-logo.js", "markdown.js", "markdown.strings.js", "machines.js", "machines.strings.js"]) {
  eq(typeof SHARED[f], "string", `${f} watched`);
  eq(readFileSync(`${MODS}/${SHARED[f]}/${f}`, "utf8").length > 0, true, `${f}: its reference ${SHARED[f]} holds it`);
}

console.log("model: ok");
