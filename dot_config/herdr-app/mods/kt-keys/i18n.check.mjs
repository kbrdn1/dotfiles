// bun ~/.config/herdr-app/mods/kt-keys/i18n.check.mjs: i18n.js's language choice (setting, system,
// auto), t() with its fallback, plurals and variables, numbers, dates, relative times and durations,
// in fr and en, with herdr and gpui mocked. Intl is deleted first: Herdr's JavaScript has none, so
// nothing here may lean on Bun's.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { plugin } from "bun";

delete globalThis.Intl;
const src = readFileSync(new URL("./i18n.js", import.meta.url), "utf8");
assert.ok(!/\bIntl\b|toLocale|localeCompare/.test(src.replace(/^\s*\/\/.*$/gm, "")), "no Intl, toLocale* or localeCompare in the code");

const store = {};
const execs = [];
let isChecking = false;
let sysOut = '(\n    "en-GB",\n    "fr-FR"\n)\n';
const el = () => {
  const node = { kids: [], props: {}, on: {} };
  const p = new Proxy(node, {
    get(target, k) {
      if (k in target) return target[k];
      return (...a) => {
        if (k === "child") target.kids.push(a[0]);
        else if (k === "children") target.kids.push(...a[0]);
        else if (k === "when") return a[0] ? a[1](p) : p;
        else if (k.startsWith("on_")) target.on[k] = a.at(-1);
        else target.props[k] = a;
        return p;
      };
    },
  });
  return p;
};
plugin({
  setup(b) {
    b.module("herdr", () => ({
      loader: "object",
      exports: {
        shared: (k) => store[k],
        setShared: (k, v) => { store[k] = v; },
        checking: () => isChecking,
        exec: (cmd, args) => { execs.push([cmd, ...args]); return Promise.resolve({ code: 0, stdout: sysOut, stderr: "" }); },
      },
    }));
    b.module("gpui-kit", () => ({ loader: "object", exports: { div: () => el(), svg: () => el() } }));
  },
});
const I = await import("./i18n.js");
const tick = () => new Promise((r) => setTimeout(r, 0));

// The system's language: its first fr or en, else fr.
assert.equal(I.parseSystem('(\n    "fr-FR"\n)'), "fr");
assert.equal(I.parseSystem('(\n    "de-DE",\n    "en-US"\n)'), "en");
assert.equal(I.parseSystem("(\n    en,\n    fr\n)"), "en");
assert.equal(I.parseSystem('(\n    "ja-JP"\n)'), "fr");
assert.equal(I.parseSystem(""), "fr");

// Auto (nothing set): French while the system is unknown, one read, then the system's.
isChecking = true;
assert.equal(I.lang(), "fr");
assert.equal(execs.length, 0, "no exec during a check");
isChecking = false;
assert.equal(I.langSetting(), "auto");
assert.equal(I.lang(), "fr");
assert.equal(I.lang(), "fr");
assert.equal(execs.length, 1, "one read, however many calls");
assert.deepEqual(execs[0], ["defaults", "read", "-g", "AppleLanguages"]);
await tick();
assert.equal(store["kt.sysLang"], "en");
assert.equal(I.lang(), "en");
I.lang();
assert.equal(execs.length, 1, "cached in shared: no second read");

// A pick wins over the system; Auto goes back to null (absent) and reads the system again.
I.setLang("fr");
assert.equal(store["kt.lang"], "fr");
assert.equal(I.lang(), "fr");
sysOut = '(\n    "fr-FR"\n)';
I.setLang("auto");
assert.equal(store["kt.lang"], null);
assert.equal(I.langSetting(), "auto");
await tick();
assert.equal(execs.length, 2);
assert.equal(I.lang(), "fr");
store["kt.lang"] = "nonsense";
assert.equal(I.langSetting(), "auto");

// t(): the language's text, the French one when English lacks it (said once), never a raw key.
const logs = [];
const log = console.log;
console.log = (m) => logs.push(m);
const t = I.makeT({
  fr: { close: "Fermer", hello: "Bonjour {name}", files: { one: "{n} fichier", other: "{n} fichiers" }, onlyFr: "Seulement en français", gone: "{a} et {b}" },
  en: { close: "Close", hello: "Hello {name}", files: { one: "{n} file", other: "{n} files" }, gone: "{a} and {b}" },
});
store["kt.lang"] = "fr";
assert.equal(t("close"), "Fermer");
assert.equal(t("hello", { name: "Kylian" }), "Bonjour Kylian");
assert.equal(t("gone", { a: 1 }), "1 et ", "a missing variable: empty, never {b}");
assert.equal(t("nope"), "", "missing everywhere: nothing");
store["kt.lang"] = "en";
assert.equal(t("close"), "Close");
assert.equal(t("hello", { name: "Kylian" }), "Hello Kylian");
assert.equal(t("onlyFr"), "Seulement en français");
t("onlyFr");
assert.equal(logs.filter((m) => /onlyFr/.test(m)).length, 1, "said once");
assert.equal(t("nope"), "");
console.log = log;

// Plurals: fr is one below 2 (0 and 1 included), en only at 1.
store["kt.lang"] = "fr";
assert.deepEqual([0, 1, 1.5, 2, 10].map((n) => t("files", { n })), ["0 fichier", "1 fichier", "1.5 fichier", "2 fichiers", "10 fichiers"]);
assert.equal(t("files"), "{n} fichiers", "no vars: other, untouched (a call without its vars is a bug)");
store["kt.lang"] = "en";
assert.deepEqual([0, 1, 1.5, 2].map((n) => t("files", { n })), ["0 files", "1 file", "1.5 files", "2 files"]);
assert.equal(I.plural("en", -1), "one");
assert.equal(I.plural("fr", undefined), "other");

// Numbers.
store["kt.lang"] = "fr";
assert.equal(I.num(1234567.891), "1 234 567,891");
assert.equal(I.num(1234.5, 2), "1 234,50");
assert.equal(I.num(999), "999");
assert.equal(I.num(-1234), "-1 234");
assert.equal(I.num(-0.0001), "0");
assert.equal(I.compact(999), "999");
assert.equal(I.compact(1234), "1,2 k");
assert.equal(I.compact(12345), "12 k");
assert.equal(I.compact(999999), "1 M");
assert.equal(I.compact(3_400_000_000), "3,4 Md");
store["kt.lang"] = "en";
assert.equal(I.num(1234567.891), "1,234,567.891");
assert.equal(I.num(0.5, 1), "0.5");
assert.equal(I.compact(1234), "1.2K");
assert.equal(I.compact(12345), "12K");
assert.equal(I.compact(1000), "1K");
assert.equal(I.compact(2_500_000), "2.5M");
assert.equal(I.compact(1e9), "1B");
assert.equal(I.num(null), "");

// Dates, in local time.
const at = new Date(2025, 10, 18, 14, 5).getTime();
const am = new Date(2025, 0, 3, 0, 7).getTime();
store["kt.lang"] = "fr";
assert.equal(I.date(at), "18 nov. 2025");
assert.equal(I.date(at, { year: false }), "18 nov.");
assert.equal(I.date(new Date(new Date().getFullYear(), 7, 1)), "1 août", "this year: no year");
assert.equal(I.time(at), "14:05");
assert.equal(I.time(am), "00:07");
assert.equal(I.date("2025-11-18T14:05:00"), "18 nov. 2025", "an ISO string");
assert.equal(I.date(null), "");
store["kt.lang"] = "en";
assert.equal(I.date(at), "Nov 18, 2025");
assert.equal(I.date(at, { year: false }), "Nov 18");
assert.equal(I.time(at), "2:05 PM");
assert.equal(I.time(am), "12:07 AM");

// Relative times, then bare.
const now = Date.UTC(2026, 10, 18, 12);
const ago = (s) => now - s * 1000;
const cases = [[30], [180], [7200], [86400], [4 * 86400], [20 * 86400], [90 * 86400], [400 * 86400], [800 * 86400]];
store["kt.lang"] = "fr";
assert.deepEqual(cases.map(([s]) => I.relative(ago(s), { now })),
  ["à l'instant", "il y a 3 min", "il y a 2 h", "il y a 1 j", "il y a 4 j", "il y a 2 sem", "il y a 3 mois", "il y a 1 an", "il y a 2 ans"]);
assert.equal(I.relative(ago(180), { now, bare: true }), "3 min");
assert.equal(I.relative(new Date(ago(7200)).toISOString(), { now }), "il y a 2 h", "an ISO string");
assert.equal(I.relative(ago(-60), { now }), "à l'instant", "the future: now");
assert.equal(I.relative(null, { now }), "");
store["kt.lang"] = "en";
assert.deepEqual(cases.map(([s]) => I.relative(ago(s), { now })),
  ["just now", "3 min ago", "2 hr ago", "1 day ago", "4 days ago", "2 wk ago", "3 mo ago", "1 yr ago", "2 yr ago"]);
assert.equal(I.relative(ago(4 * 86400), { now, bare: true }), "4 days");

// Durations.
store["kt.lang"] = "fr";
assert.deepEqual([45e3, 180e3, 3900e3, 183600e3].map(I.duration), ["45 s", "3 min", "1 h 05", "2 j 3 h"]);
store["kt.lang"] = "en";
assert.deepEqual([45e3, 180e3, 3900e3, 183600e3].map(I.duration), ["45s", "3m", "1h 05m", "2d 3h"]);
assert.equal(I.duration(-5), "0s");

// The switch: one button showing the setting now, a click steps Auto → FR → EN → Auto (Auto: null).
const theme = { border: "#333333", background: "#111111", accent: "#ff8800", muted: "#888888", foreground: "#eeeeee" };
store["kt.lang"] = "en";
store["kt.sysLang"] = "fr";
const face = (b) => b.kids[0].kids[0].kids[0];
const cx = { notified: 0, notify() { this.notified++; }, stop_propagation() {} };
let sw = I.langSwitch(theme);
assert.equal(face(sw), "EN");
assert.equal(sw.props.tooltip[0], "Language: English");
sw.on.on_click({}, cx);
assert.equal(store["kt.lang"], null);
sw = I.langSwitch(theme);
assert.equal(face(sw), "A");
assert.equal(sw.props.tooltip[0], "Langue : automatique (français)");
sw.on.on_click({}, cx);
assert.equal(store["kt.lang"], "fr");
sw = I.langSwitch(theme);
assert.equal([face(sw), sw.props.tooltip[0]].join(" · "), "FR · Langue : français");
sw.on.on_click({}, cx);
assert.equal(store["kt.lang"], "en");
assert.equal(cx.notified, 3);
// fx: the caller's fade, keyed by the state.
const keys = [];
I.langSwitch(theme, (e, k) => { keys.push(k); return e; });
assert.deepEqual(keys, ["kt-lang-en"]);
await tick();

console.log("i18n.js: ok");
