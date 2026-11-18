// i18n.js: French and English for every kt-* and kbrdn-* mod (data/orchestrator/I18N.md). Written once
// in mods/kt-keys/i18n.js and copied byte for byte into each mod (a mod can't import from another
// folder): edit here, then copy, then cmp. Check: bun mods/kt-keys/i18n.check.mjs.
//
// Herdr's JavaScript has no Intl, and toLocaleString / localeCompare ignore the locale (en-US output,
// code point order): plurals, numbers, dates and durations are written out here, for fr and en only.
//
//   import strings from "./strings.js";       // export default { fr: { key: "…" }, en: { key: "…" } }
//   import { makeT, relative } from "./i18n.js";
//   const tr = makeT(strings);                 // module scope is fine: it reads the language at each call
//   tr("close") · tr("hello", { name }) · tr("files", { n: 3 })   // { one, other }: picked by vars.n
// (`tr`, not `t`: `t` is theme() in every mod.)
//
// The language: shared "kt.lang" = "fr" | "en" | null (auto: the system's, read once into shared
// "kt.sysLang", French until it's known and during a check). A shared key: changing it redraws every mod.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { shared, setShared, exec, checking } from "herdr";

const KEY = "kt.lang";
const SYS = "kt.sysLang";
const LANGS = ["fr", "en"];

/** What the person picked: "fr", "en", or "auto" (also when nothing is set). */
export function langSetting() {
  const v = shared(KEY);
  return LANGS.includes(v) ? v : "auto";
}

/** The system's language from `defaults read -g AppleLanguages`: its first fr or en, else fr. */
export function parseSystem(out) {
  for (const item of String(out ?? "").split(/[\n,()]/)) {
    const code = item.trim().replace(/^"|"$/g, "").slice(0, 2).toLowerCase();
    if (LANGS.includes(code)) return code;
  }
  return "fr";
}

let asking = false; // this copy's module is reading the system language now
function readSystem() {
  if (asking || checking()) return;
  asking = true;
  exec("defaults", ["read", "-g", "AppleLanguages"], { timeout: 5000 })
    .then((r) => setShared(SYS, parseSystem(r.stdout)), () => setShared(SYS, "fr"))
    .finally(() => { asking = false; });
}

/** The language shown now: "fr" or "en". */
export function lang() {
  const v = langSetting();
  if (v !== "auto") return v;
  const sys = shared(SYS);
  if (LANGS.includes(sys)) return sys;
  // ponytail: read once and kept in shared.json; picking Auto again re-reads it (a macOS language
  // change otherwise goes unseen). Upgrade: re-read at each app start once Herdr exposes one.
  readSystem();
  return "fr";
}

/** Picks the language: "fr", "en" or "auto" (which reads the system's again). */
export function setLang(v) {
  setShared(KEY, LANGS.includes(v) ? v : null);
  if (!LANGS.includes(v)) readSystem();
}

/** "one" or "other" for `n` (CLDR): fr is one below 2 (0, 1, 1.5), en only at exactly 1. */
export function plural(l, n) {
  const x = Math.abs(Number(n));
  if (n == null || !Number.isFinite(x)) return "other";
  return (l === "fr" ? x < 2 : x === 1) ? "one" : "other";
}

const warned = new Set();
function warn(msg) {
  if (warned.has(msg)) return;
  warned.add(msg);
  console.log(`i18n: ${msg}`);
}

/** A text of a dictionary with its {vars} filled: a string, or { one, other } picked by vars.n. */
export function format(v, vars, l = lang()) {
  if (v && typeof v === "object") v = v[plural(l, vars?.n)] ?? v.other ?? "";
  const s = String(v);
  return vars ? s.replace(/\{(\w+)\}/g, (_m, k) => (vars[k] == null ? "" : String(vars[k]))) : s;
}

/** t(key, vars) for `dict` = { fr, en }. A key missing in English shows the French (said once in
 *  the log); missing everywhere, nothing: never a raw key. */
export function makeT(dict) {
  return (key, vars) => {
    const l = lang();
    let v = dict?.[l]?.[key];
    if (v == null && l !== "fr") {
      warn(`no ${l} text for "${key}", French shown`);
      v = dict?.fr?.[key];
    }
    if (v == null) {
      warn(`no text for "${key}"`);
      return "";
    }
    return format(v, vars, l);
  };
}

// Numbers. fr: 1 234 567,5 (a narrow no-break space, as Intl's fr); en: 1,234,567.5.
const GROUP = { fr: " ", en: "," };
const POINT = { fr: ",", en: "." };

/** `n` with the language's separators; `digits`: exactly that many decimals, else up to 3. */
export function num(n, digits) {
  const x = Number(n);
  if (n == null || !Number.isFinite(x)) return String(n ?? "");
  const l = lang();
  const s = digits == null ? String(Math.round(Math.abs(x) * 1000) / 1000) : Math.abs(x).toFixed(digits);
  const [int, frac] = s.split(".");
  const neg = x < 0 && Number(s) !== 0;
  return `${neg ? "-" : ""}${int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP[l])}${frac ? POINT[l] + frac : ""}`;
}

const UNITS = { fr: [" k", " M", " Md"], en: ["K", "M", "B"] };

/** Short: 999 · 1,2 k · 12 k · 3,4 M · 1 Md (fr) / 1.2K · 12K · 3.4M · 1B (en). */
export function compact(n) {
  const x = Number(n);
  if (n == null || !Number.isFinite(x)) return String(n ?? "");
  const r = (q) => (Math.abs(q) < 10 ? Math.round(q * 10) / 10 : Math.round(q));
  let q = x;
  let i = -1;
  while (Math.abs(r(q)) >= 1000 && i < 2) {
    q /= 1000;
    i++;
  }
  return num(r(q)) + (i < 0 ? "" : UNITS[lang()][i]);
}

// Dates, in the machine's time zone (Date's local getters work).
const MONTHS = {
  fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const toMs = (at) => (typeof at === "string" ? Date.parse(at) : at instanceof Date ? at.getTime() : Number(at));

/** 18 nov. 2026 / Nov 18, 2026; the year only when it isn't this one, unless `year` says. */
export function date(at, { year } = {}) {
  const ms = toMs(at);
  if (!at || !Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const y = year ?? d.getFullYear() !== new Date().getFullYear();
  const m = MONTHS[lang()][d.getMonth()];
  return lang() === "fr" ? `${d.getDate()} ${m}${y ? ` ${d.getFullYear()}` : ""}` : `${m} ${d.getDate()}${y ? `, ${d.getFullYear()}` : ""}`;
}

/** 14:05 / 2:05 PM. */
export function time(at) {
  const ms = toMs(at);
  if (!at || !Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const h = d.getHours();
  const mi = String(d.getMinutes()).padStart(2, "0");
  return lang() === "fr" ? `${String(h).padStart(2, "0")}:${mi}` : `${h % 12 || 12}:${mi} ${h < 12 ? "AM" : "PM"}`;
}

const AGO = {
  fr: { now: "à l'instant", ago: (s) => `il y a ${s}`, min: "min", h: "h", d: "j", w: "sem", mo: "mois", y: ["an", "ans"] },
  en: { now: "just now", ago: (s) => `${s} ago`, min: "min", h: "hr", d: ["day", "days"], w: "wk", mo: "mo", y: "yr" },
};

/** How long ago: à l'instant · il y a 3 min · il y a 2 h · 4 j · 2 sem · 3 mois · 1 an / just now ·
 *  3 min ago · 2 hr ago · 4 days ago · 2 wk ago · 3 mo ago · 1 yr ago. `bare`: without « il y a » /
 *  "ago" (a column). Days under 2 weeks, then weeks under 60 days, months under a year. `at`: ms or ISO. */
export function relative(at, { bare = false, now = Date.now() } = {}) {
  const ms = toMs(at);
  if (!at || !Number.isFinite(ms)) return "";
  const s = Math.max(0, (now - ms) / 1000);
  const l = lang();
  const w = AGO[l];
  if (s < 60) return w.now;
  const [q, u] = s < 3600 ? [s / 60, "min"] : s < 86400 ? [s / 3600, "h"] : s < 14 * 86400 ? [s / 86400, "d"]
    : s < 60 * 86400 ? [s / 604800, "w"] : s < 365 * 86400 ? [s / 2592000, "mo"] : [s / 31536000, "y"];
  const n = Math.floor(q);
  const unit = Array.isArray(w[u]) ? w[u][plural(l, n) === "one" ? 0 : 1] : w[u];
  const text = `${n} ${unit}`;
  return bare ? text : w.ago(text);
}

/** A length of time: 45 s · 3 min · 1 h 05 · 2 j 3 h / 45s · 3m · 1h 05m · 2d 3h. */
export function duration(ms) {
  const s = Math.max(0, Math.round(Number(ms) / 1000) || 0);
  const fr = lang() === "fr";
  if (s < 60) return fr ? `${s} s` : `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return fr ? `${m} min` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  if (h < 24) return fr ? `${h} h ${mm}` : `${h}h ${mm}m`;
  return fr ? `${Math.floor(h / 24)} j ${h % 24} h` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

// The language switch (Auto / FR / EN), kt-threads' theme switch's twin: one line in a mod,
// `.child(langSwitch(theme()))`. Its own words, so the copies stay identical.
const own = makeT({
  fr: { auto: "Langue du système ({name})", fr: "Français", en: "English" },
  en: { auto: "System language ({name})", fr: "Français", en: "English" },
});
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;

/** The segment, `t` = theme(). A click sets shared "kt.lang" (Auto: back to the system's). */
export function langSwitch(t) {
  const now = langSetting();
  const sys = LANGS.includes(shared(SYS)) ? shared(SYS) : "fr";
  return h_flex().flex_none().p(2).gap(1).items_center().rounded_full().border(1).border_color(t.border).bg(t.background)
    .children([["auto", "A"], ["fr", "FR"], ["en", "EN"]].map(([v, label]) => {
      const on = now === v;
      return div().id(`kt-lang-${v}`).h(24).min_w(24).px(5).flex().items_center().justify_center().rounded_full().border(1)
        .border_color(alpha(t.accent, on ? "66" : "00"))
        .when(on, (el) => el.bg(alpha(t.accent, "24")))
        .font_family("Monaspace Krypton").text_size(9.5).text_color(on ? t.accent : t.muted)
        .cursor_pointer()
        .when(!on, (el) => el.hover((s) => s.text_color(t.foreground)))
        .tooltip(v === "auto" ? own("auto", { name: own(sys) }) : own(v))
        .on_click((_e, cx) => { setLang(v); cx.notify(); })
        .child(label);
    }));
}
