// kt-usage, « Abonnements IA »: the usage and quotas of the AI subscriptions, full screen over a veil
// (mod.json: a dialog, frame "none"; kt-keys' shell: the veil, the card (20) and its inner cards (16)).
// Opened from the gauge at the bottom of the kt-threads sidebar: run("mod.open", { name: "kt-usage" }).
//
// One card per provider really in use, detected the way herdr-agent-quota
// (~/Projects/Perso/herdr-agent-quota) detects it, read the way it reads it (data.js):
// - Claude Code: the statusLine's rate_limits (statusline.ts → herdr-quota.json), the live sessions'
//   herdr-<terminal>.json (model, context, cost), the plan from ~/.claude.json, that one field via jq
//   (no other field of that file reaches the mod).
// - Codex: the newest rollout's last token_count with rate_limits (primary, secondary, plan_type),
//   its last 256 KiB through tail | grep (codex.rs' tail size; only token_count lines reach the mod).
// - The others (Grok, Devin, Muse, omp, OpenCode Go, Antigravity) by their credential files or CLI:
//   none has data here, so they are one « Non disponibles » card that says why.
// - Claude Code, also: GET /api/oauth/usage (Claude Code's own /usage endpoint), with the Claude Code
//   OAuth token read from the keychain for that one request, approved by Kylian (2026-11-18, « 5. oui »):
//   the weekly limits (all, Fable), the share per surface, Fable's share of the week, the credits.
//   The statusLine stays the fallback when that call fails.
// Read only: that one GET is the only network call (Codex's quota comes from its rollout, not from
// codex app-server), and nothing here can use a limit reset (the button opens claude.ai, no more).
// Loads on open and on Rafraîchir, never on a timer; the GET at most once per 2 min (USAGE_CACHE).
// Keys (vim.js): j/k element, gg/G, ctrl-d/u, tab/shift-tab card, enter/o on a session: focus it,
// r refresh, q/esc close. `kt-usage.key:<keys>` feeds keys, `kt-usage.refresh` refreshes (tests).

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { theme, props, closeOverlay, settings, nextCommand, checking, agents, knownAgents, exec, home, readTextFile, run, shared, watchFolder } from "herdr";
import * as fs from "fs/promises";
import { ring, ringColor } from "./ring.js";
import { costLevel, quotaLevel, levelColor } from "./levels.js";
import { Vim, keysOf, step } from "./vim.js";
import { motionState, frame, enter, pulse, stagger, sheet, leave, sharpen } from "./motion.js";
import { bump } from "./bus.js";
import { viz } from "./viz.js";
import { roll, rollText } from "./roll.js";
import { claudeWindows, codexReading, codexWindows, dayCost, resetLabel, ago, clock, day, tierLabel, resetAdvice, parseOauthUsage, moneyLabel, speak } from "./data.js";
import { makeT, num } from "./i18n.js";
import strings from "./strings.js";
import { ditherBand, TOP, ALL } from "./dither.js"; // the shared band (DESIGN-REFERENCE.md), tinted per provider

const tr = makeT(strings);
speak(makeT); // data.js' words follow kt.lang too
// A window's label (data.js' codes: 5h, 7j) as shown.
const wlabel = (l) => tr(`w.${l}`);
const MONO = "Monaspace Krypton";
const CARD = 780;
const TIMEOUT = 15000; // every exec
const ROLLOUT_TAIL = 262144; // codex.rs ROLLOUT_TAIL_BYTES
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));
const I = (name) => `mods/kt-usage/${name}.svg`;
const unix = () => Math.floor(Date.now() / 1000);
const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return Math.floor(d.getTime() / 1000); };
const plan = (p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : null);
// Limit resets are used only on this official page, by Kylian (support.claude.com/en/articles/17007452).
// The console opens it in the browser and nothing else: it never asks Anthropic to use one.
const RESETS_URL = "https://claude.ai/settings/usage";
// Reads. json: null no file, undefined unreadable or torn (statusline.ts rewrites on every render).
const json = async (p) => { try { const t = await readTextFile(p); return t == null ? null : JSON.parse(t); } catch { return undefined; } };
const has = async (p) => { try { return await fs.exists(p); } catch { return false; } };
const ls = async (p) => { try { return (await fs.readdir(p)).sort().reverse(); } catch { return []; } };
// A shell line with its arguments as $1…: stdout on success, else null. 15 s at most.
const sh = async (script, args) => {
  try {
    const r = await exec("/bin/sh", ["-c", script, "sh", ...args], { timeout: TIMEOUT });
    return r.code === 0 ? r.stdout : null;
  } catch { return null; }
};
const usd = (n) => `$${num(n, 2)}`;

// ---------- Claude Code's usage endpoint (one GET, Kylian's approval) ----------
// The only network call of the console: GET, this URL, these two headers. The token is Claude Code's
// OAuth access token, read from the keychain for this one request and dropped with it: never stored,
// logged, shown, nor handed to a program (it travels in fetch's header only). No OAuth refresh: a 401
// says so and stops (a refresh would rotate Claude Code's own tokens).
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const USAGE_TTL = 120000; // 2 min
// The last answer (parsed usage or an error message, never the token), shared by the console's copies
// so that closing and reopening it within 2 min doesn't call again.
let USAGE_CACHE = null; // { at: ms, usage?, error? }

async function claudeToken() {
  let r;
  try {
    r = await exec("security", ["find-generic-password", "-s", "Claude Code-credentials", "-w"], { timeout: TIMEOUT });
  } catch {
    return { error: "keychainUnavailable" }; // i18n: tech (err.<error>, said at render)
  }
  if (r.code !== 0) return { error: "keychainNotFound" }; // i18n: tech
  try {
    const token = JSON.parse(r.stdout)?.claudeAiOauth?.accessToken;
    return typeof token === "string" && token ? { token } : { error: "keychainNoToken" }; // i18n: tech
  } catch {
    return { error: "keychainUnreadable" }; // i18n: tech
  }
}

// 15 s at most: fetch has no timeout of its own, so it races a one-shot timer (the request may finish
// later; its answer is then ignored).
async function fetchUsage(cx, now) {
  const t = await claudeToken();
  if (t.error) return { error: t.error };
  let res;
  try {
    res = await Promise.race([
      fetch(USAGE_URL, { method: "GET", headers: { Authorization: `Bearer ${t.token}`, "anthropic-beta": "oauth-2025-04-20" } }),
      new Promise((_, fail) => cx.timer.after(TIMEOUT, () => fail(new Error("timeout")))),
    ]);
  } catch (e) {
    return { error: e?.message === "timeout" ? "timeout" : "network" }; // i18n: tech
  }
  if (res.status === 401) return { error: "expired" }; // i18n: tech
  // fetch follows redirects and offers no switch: an answer from another host is refused.
  if (!String(res.url ?? USAGE_URL).startsWith("https://api.anthropic.com/")) return { error: "host" }; // i18n: tech
  if (!res.ok) return { error: "http", status: res.status }; // i18n: tech
  try {
    const usage = parseOauthUsage(await res.json(), now);
    return usage ? { usage } : { error: "unreadable" }; // i18n: tech
  } catch {
    return { error: "unreadable" }; // i18n: tech
  }
}

// The cached answer when it is under 2 min old, else one GET (errors are cached too: no retry loop).
async function usageApi(cx) {
  if (USAGE_CACHE && Date.now() - USAGE_CACHE.at < USAGE_TTL) return { ...USAGE_CACHE, cached: true };
  USAGE_CACHE = { at: Date.now(), ...(await fetchUsage(cx, unix())) };
  return USAGE_CACHE;
}
// A provider's tint: its Herdr tile when it has a color; Claude Code's and Codex's tiles are both
// #1c1d21, which would vanish on a dark card and look alike, so then FILTERS.md's provider tints.
const TINTS = { claude: "accent", codex: "ansi6", opencode: "ansi2", cursor: "ansi4" };
const chroma = (hex) => {
  const m = /^#([0-9a-f]{6})/i.exec(String(hex ?? ""));
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b);
};

// Present here = these files exist (herdr-agent-quota's credential paths) or Herdr finds the CLI.
const OTHERS = [
  ["grok", "Grok", ".grok/auth.json"],
  ["devin", "Devin", ".local/share/devin/credentials.toml"],
  ["muse", "Muse", ".config/muse/auth.json"],
  ["omp", "omp", ".omp"],
  ["antigravity", "Antigravity", null],
];

export default class Usage extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.scroll = ScrollHandle.new();
    this.vim = new Vim();
    this.data = null;
    this.busy = false;
    this.error = null;
    this.cur = 1; // the first card, not the button
    this.items = [];
    this.motion = motionState();
    this.bw = {}; // band id -> measured width (the dither's tiles)
    this.costsAt = 0; // the sessions' cost donut: drawn from the card's third layout on (claude())
    // The dialog isn't keyed yet in init: ask for the keyboard again, briefly, until it has it.
    this.handle.focus();
    for (const ms of [16, 50, 120, 250]) cx.timer.after(ms, () => { if (!this.handle.is_focused()) this.handle.focus(); });
    if (checking()) return;
    this.refresh(cx);
    this.watch(cx, `${home()}/.claude/cache/statusline`, async (d) => { d.claude = await this.loadClaude(d.claude, d.programs, false); });
    this.watch(cx, `${home()}/.codex/sessions`, async (d) => { d.codex = await this.loadCodex(d.programs); });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) {
          this.handle.focus();
          for (const k of keysOf(c.slice(4))) this.act(this.vim.handle(k), cx);
        } else if (c === "refresh") this.refresh(cx);
        cx.notify();
      }
    });
  }

  // Not named close(): Herdr calls a view's close(cx) when its overlay goes and on a hot reload, and
  // closing the overlay from there shut the console on every save of this mod.
  // motion.js leave(): the veil fades out and the card sinks, then the dialog closes.
  dismiss(cx) {
    leave(this.motion, cx, "ku", () => closeOverlay(props().overlay));
  }

  // A full read; then bump("usage") (DATA-SYNC.md): kt-threads' 5h rings and kbrdn-status follow.
  // Folder changes (watch) don't bump: those mods watch the same files themselves.
  refresh(cx) {
    if (this.busy || checking()) return;
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        this.data = await this.load(this.data, cx);
        this.error = null;
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      this.busy = false;
      bump("usage");
      cx.notify();
    });
  }

  // ---------- reading (all local, read only) ----------

  // Everything: on open and on Rafraîchir (the folder watches re-read their own source only, never the API).
  async load(prev, cx) {
    const d = { at: unix(), programs: {} };
    // Program tiles, and whether Herdr finds each CLI (its own check, at most once a minute).
    try { for (const p of await knownAgents()) d.programs[p.key] = p; } catch { /* tiles fall back */ }
    d.claude = await this.loadClaude(prev?.claude, d.programs, true);
    d.api = await usageApi(cx);
    d.codex = await this.loadCodex(d.programs);
    d.others = await this.loadOthers(d.programs);
    return d;
  }

  // Claude Code: the statusLine's observations (claude.rs: no API, no account id). `plan`: read the
  // plan again (on a full load; a folder change keeps the last one).
  async loadClaude(prev, programs, plan) {
    const h = home();
    const sl = `${h}/.claude/cache/statusline`;
    let quota = await json(`${sl}/herdr-quota.json`);
    if (quota === undefined) quota = prev?.quota ?? null;
    const files = [];
    for (const n of await ls(sl)) {
      const m = /^herdr-(.+)\.json$/.exec(n);
      if (!m || m[1] === "quota") continue;
      const f = await json(`${sl}/${n}`);
      if (f) files.push({ ...f, file: n, terminal: m[1] });
      else if (f === undefined) { const old = prev?.files.find((o) => o.file === n); if (old) files.push(old); } // torn: keep
    }
    // The plan and its tier, those two fields only ("Ultra", "default_claude_max_20x").
    let claudePlan = prev?.plan ?? null;
    let tier = prev?.tier ?? null;
    if (plan) {
      const out = await sh('jq -r ".oauthAccount | (.planDisplayName // \\"\\"), (.organizationRateLimitTier // \\"\\")" "$1"', [`${h}/.claude.json`]);
      const [p, r] = (out ?? "").split("\n");
      claudePlan = p?.trim() || null;
      tier = tierLabel(r);
    }
    return { quota, files, plan: claudePlan, tier, present: Boolean(quota) || files.length > 0 || Boolean(programs.claude?.installed) };
  }

  // Codex: the 10 newest rollouts by name (start time; readdir has no mtime), and of their readings
  // the newest by its own timestamp: several sessions can start in the same second.
  // ponytail: a session started before those 10 and still writing is missed; read mtimes if it bites.
  async loadCodex(programs) {
    const h = home();
    const dir = `${h}/.codex/sessions`;
    const rollouts = [];
    walk: for (const y of await ls(dir)) for (const m of await ls(`${dir}/${y}`)) for (const dd of await ls(`${dir}/${y}/${m}`)) {
      for (const f of await ls(`${dir}/${y}/${m}/${dd}`)) {
        if (/^rollout-.*\.jsonl$/.test(f)) rollouts.push(`${dir}/${y}/${m}/${dd}/${f}`);
        if (rollouts.length >= 10) break walk;
      }
    }
    let reading = null;
    let from = null;
    for (const p of rollouts) {
      const out = await sh(`tail -c ${ROLLOUT_TAIL} "$1" | grep -F '"token_count"' | tail -n 20`, [p]);
      const r = out ? codexReading(out.split("\n")) : null;
      if (r && (!reading || (r.at ?? 0) > (reading.at ?? 0))) { reading = r; from = p; }
    }
    return { reading, from, rollouts: rollouts.length, present: rollouts.length > 0 || (await has(`${h}/.codex/auth.json`)) || Boolean(programs.codex?.installed) };
  }

  // The rest: presence only, never a read of a credential.
  async loadOthers(programs) {
    const h = home();
    const o = {};
    for (const [key, , path] of OTHERS) o[key] = (path ? await has(`${h}/${path}`) : false) || Boolean(programs[key]?.installed);
    const oc = `${h}/.local/share/opencode/auth.json`;
    o.opencode = (await has(oc)) || Boolean(programs.opencode?.installed);
    // jq -e answers through its exit code: no key value reaches the mod.
    o.opencodeGo = Boolean(await sh(`jq -e 'has("opencode-go")' "$1" >/dev/null && echo yes`, [oc]));
    o.gemini = await has(`${h}/.gemini`);
    o.cursor = await has(`${h}/.cursor`);
    return o;
  }

  // A local source read again when its folder changes, while the console is open (DATA-SYNC.md: the
  // statusLine cache and Codex's rollouts change outside Herdr). Closing the dialog cancels the
  // pending watch, which ends the loop. A rejected watch stops it: Rafraîchir still works.
  // ponytail: one reload a second at most; statusline.ts rewrites its files on every render of every
  // session, so a busy machine would otherwise redraw the console several times a second.
  watch(cx, dir, reload) {
    cx.spawn(async (cx) => {
      for (;;) {
        try { await watchFolder(dir); } catch { return; }
        if (!this.data || this.busy) continue;
        try { await reload(this.data); this.data.at = unix(); } catch { /* keep what is shown */ }
        cx.notify();
        await new Promise((done) => cx.timer.after(1000, () => done()));
      }
    });
  }

  // ---------- keys ----------

  act(a, cx) {
    if (!a) return false;
    if (a === "pending" || a === "count") return true;
    const n = this.items.length;
    if (a === "escape" || a === "quit") this.dismiss(cx);
    else if (a === "refresh") this.refresh(cx);
    else if (a === "open" || a === "right") this.activate(this.items[this.cur], cx);
    else if (a === "tab-next" || a === "tab-prev") this.jump(a === "tab-next" ? 1 : -1);
    else if (["down", "up", "top", "bottom", "half-down", "half-up"].includes(a)) {
      this.cur = step(a, this.cur, n, this.vim.count, 10);
      this.reveal = true;
    }
    return true;
  }

  // tab: the next card (or the button), wrapping.
  jump(dir) {
    const stops = this.items.map((it, i) => (it.kind === "session" || it.kind === "resets" ? -1 : i)).filter((i) => i >= 0);
    if (!stops.length) return;
    const at = dir > 0 ? stops.find((i) => i > this.cur) ?? stops[0] : [...stops].reverse().find((i) => i < this.cur) ?? stops[stops.length - 1];
    this.cur = at;
    this.reveal = true;
  }

  // The browser on claude.ai's usage page, where Kylian uses a reset himself. Only `open` and a fixed URL.
  openResets() {
    exec("open", [RESETS_URL], { timeout: TIMEOUT }).catch(() => {});
  }

  activate(it, cx) {
    if (!it) return;
    if (it.kind === "refresh") this.refresh(cx);
    else if (it.kind === "resets") this.openResets();
    else if (it.kind === "session") {
      run("agent.focus", { terminal: it.terminal });
      this.dismiss(cx);
    }
  }

  key(e, cx) {
    if (!this.act(this.vim.handle(e), cx)) return; // not ours: ctrl-b, cmd-* go on
    cx.stop_propagation();
    cx.notify();
  }

  // ---------- drawing ----------

  program(key) {
    return this.data?.programs?.[key] ?? agents().find((a) => a.program?.key === key)?.program ?? { icon: `icons/${key}.svg`, tint: false };
  }

  tint(t, key) {
    const tile = this.program(key).tile;
    return chroma(tile) >= 48 ? tile : t[TINTS[key] ?? "accent"];
  }

  // Crosstalk's discreet icon button: the tooltip names the key.
  iconBtn(t, id, icon, tip, fn) {
    return div().id(id).size(28).flex_none().rounded_full().flex().items_center().justify_center().text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(alpha(t.foreground, "14")).text_color(t.foreground)).tooltip(tip)
      .on_click((_e, cx) => { cx.stop_propagation(); fn(cx); cx.notify(); })
      .child(svg(icon).size(14));
  }

  // The 60 px head band: the dither in `tint` (cut by the card's top corners), a 32 px mark, the
  // title, a mono subtitle joined by « · », the icon buttons on the right.
  // The dither never crosses the card's border and fills its corners up to the arc: the band sits
  // inside the border (the card's width less 2, measured by on_size_change), drawn by the shared
  // dither.js at radius 15 (the card's 16 less its border). Nothing until the first measure.
  band(t, { id, tint, mark, title, sub, buttons, rounded = "top" }) {
    const color = alpha(tint, settings().dark ? "6b" : "4d");
    const el = div().id(id).relative().flex_none().h(60).overflow_hidden()
      .on_size_change((size, cx) => { if (this.bw[id] !== size.width) { this.bw[id] = size.width; cx.notify(); } });
    const layer = ditherBand(this.bw[id], 60, 15, color, rounded === "top" ? TOP : ALL);
    return (rounded === "top" ? el.rounded_t(15) : el.rounded(15))
      .when(Boolean(layer), (e) => e.child(layer))
      .child(h_flex().size_full().px(12).gap(10).items_center()
        .child(mark)
        .child(v_flex().flex_1().min_w(0).gap(2)
          // motion.js sharpen: the title comes into focus when it arrives or changes, once.
          .child(((ttl) => (this.m ? sharpen(this.m, `${id}-title:${title}`, ttl) : ttl()))(
            () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(title)))
          .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(sub)))
        .children(buttons));
  }

  tile(t, key, size) {
    const p = this.program(key);
    const g = Math.round(size * 0.7);
    const glyph = p.icon ? (p.tint ? svg(p.icon).size(g).text_color(p.color ?? "#ffffff") : image(p.icon).w(g).h(g)) : div();
    return div().flex_none().size(size).rounded(Math.round(size * 0.3)).border(1).border_color("#00000033")
      .bg(p.tile ?? t.raised).flex().items_center().justify_center().child(glyph);
  }

  pill(t, text, tint) {
    return div().flex_none().h(20).px(8).flex().items_center().rounded_full().border(1)
      .border_color(alpha(tint, "4d")).bg(alpha(tint, "1a")).font_family(MONO).text_size(10).text_color(tint).child(text);
  }

  eyebrow(t, text) {
    return h_flex().pt(4).gap(10).items_center()
      // An element (rollText: a count that rolls) goes as it is.
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child(typeof text === "string" ? text.toUpperCase() : text))
      .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border));
  }

  // One window. With a current number, the dithered visuals (viz.js, Monocode's): a gauge for the main
  // limit, else a progress bar, in the threshold color (ring.js' ringColor), the reset below. Without
  // one (missing, or reset since the reading), said in words over a dashed circle, never drawn as a value.
  window(t, id, w, { why, name, main = false }, now) {
    if (!w.missing && !w.passed) {
      const p = Math.round(w.used);
      const reset = div().id(`${id}-reset`).text_size(12).text_color(t.dim)
        .tooltip(w.resets ? tr("dayAt", { day: day(w.resets), time: clock(w.resets) }) : tr("resetNone")).child(resetLabel(w, now));
      if (main) return h_flex().gap(16).items_center()
        .child(this.V.gauge(name, w.used, { unit: "%", size: 168, color: ringColor(t, p, { severity: w.severity }), id }))
        .child(v_flex().flex_1().min_w(0).gap(4).child(div().font_family(MONO).text_size(11).text_color(t.muted).child(wlabel(w.label))).child(reset));
      return this.V.progress(name, w.used, { detail: resetLabel(w, now), color: ringColor(t, p, { severity: w.severity }), id });
    }
    const empty = (mark) => div().size(48).flex_none().rounded_full().border(2).border_dashed().border_color(t.border)
      .flex().items_center().justify_center().font_family(MONO).text_size(12).text_color(t.dim).child(mark);
    const small = (text, color = t.dim) => div().text_size(11).text_color(color).child(text);
    const lines = [div().font_family(MONO).text_size(11).text_color(t.muted).child(wlabel(w.label))];
    if (w.missing) lines.push(small(why, t.muted));
    else {
      lines.push(small(tr("unknownUsage"), t.muted));
      lines.push(small(tr("afterLast", { reset: resetLabel(w, now), n: Math.round(w.last) })));
    }
    return h_flex().gap(12).items_center().child(empty(w.missing ? "—" : "?")).child(v_flex().flex_1().min_w(0).gap(2).children(lines));
  }

  // A provider card: the dither band in its tint (tile, name, plan · last update, refresh), a dashed
  // rule in that tint, then the body. The cursor on it draws its border accent.
  card(t, i, { key, name, sub, body }) {
    const on = this.cur === i;
    const tint = this.tint(t, key);
    return v_flex().id(`ku-card-${key}`).relative().rounded(16).bg(t.surface).border(1)
      .border_color(on ? alpha(t.accent, "99") : t.border)
      .on_click((_e, cx) => { this.cur = i; cx.notify(); })
      .child(this.band(t, { id: `ku-band-${key}`, tint, mark: this.tile(t, key, 32), title: name, sub,
        buttons: [this.iconBtn(t, `ku-refresh-${key}`, I("refresh-cw"), tr("refreshTip"), (cx) => this.refresh(cx))] }))
      .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(tint, "4d")))
      // Breathes while a refresh reads (motion.js pulse: a loop only in that active state).
      .child(pulse(this.m, v_flex().id(`ku-body-${key}`).p(12).gap(10).children(body), this.busy));
  }

  claude(t, now, base) {
    const c = this.data.claude;
    const q = c.quota;
    const list = [];
    const items = [{ kind: "card", id: "claude" }];
    // The weekly limit first: on Ultra (Max 20x, verified) it is the only one, Anthropic removed the
    // 5h window late October 2026 (five_hour null). A five_hour that comes back shows beside it.
    // The usage endpoint's answer (cached 2 min) when the GET answered; the statusLine otherwise.
    const api = this.data.api;
    const u = api?.usage;
    const [five, slWeek] = claudeWindows(q, now);
    const week = u?.week ?? slWeek;
    list.push(this.window(t, "ku-g-claude-7j", week, { why: tr("notGivenNow"), name: tr("weekQuota"), main: true }, now));
    list.push(div().px(10).font_family(MONO).text_size(10.5).text_color(api?.error ? t.blocked : t.dim).child(
      api?.error ? tr("api.error", { error: tr(`err.${api.error}`, { status: api.status }) })
        : u ? tr("api.read", { ago: ago(Math.floor(api.at / 1000), now), cached: api.cached ? tr("api.cached") : "",
          severity: u.week?.severity ? tr("api.severity", { severity: u.week.severity }) : "" })
          : tr("api.notYet")));
    // Fable's weekly limit, and its share of the week, as the endpoint gives them.
    if (u?.scoped) list.push(this.window(t, "ku-p-claude-fable", u.scoped, {
      why: tr("notGiven"), name: tr(u.scoped.active === false ? "scopedInactive" : "scopedName", { name: u.scoped.name ?? tr("scoped") }) }, now));
    // A share with its used part and an allowance is a bar (its fill: used of the allowance, in the
    // status line's quota colours); a share without one stays a sentence.
    const shareText = (s) => tr(s.used != null ? "shareUsed" : "share", { name: s.label ?? tr("scoped"), n: Math.round(s.value), used: s.used != null ? Math.round(s.used) : "" });
    const shareWords = [];
    (u?.shares ?? []).forEach((s, i) => {
      if (s.used == null || !(s.value > 0)) { shareWords.push(shareText(s)); return; }
      list.push(this.V.progress(tr("share.bar", { name: s.label ?? tr("scoped") }), s.used, { max: s.value, id: `ku-p-claude-share-${i}`,
        figure: tr("share.figure", { used: Math.round(s.used), n: Math.round(s.value) }), detail: tr("share.detail", { used: Math.round(s.used), n: Math.round(s.value) }),
        color: levelColor(t, quotaLevel((s.used / s.value) * 100)) }));
    });
    if (shareWords.length) list.push(div().px(10).text_size(12).text_color(t.muted).child(shareWords.join(" · ")));
    if (!five.missing) list.push(this.window(t, "ku-p-claude-5h", five, { name: tr("fiveQuota") }, now));
    if (five.missing) list.push(div().px(10).text_size(12).text_color(t.muted).child(tr(c.plan === "Ultra" ? "five.ultra" : "five.none")));
    // The week per surface (Claude Code, Chats, Cowork, Other): a donut, the second heavy visual.
    if (u?.rows.length) {
      list.push(this.eyebrow(t, tr("bySurface")));
      list.push(div().px(10).child(this.V.donut(u.rows.map((r) => ({ label: r.label, value: r.value })),
        { label: tr("surfaces"), value: tr("sevenDays"), size: 132, id: "ku-d-claude-surfaces" })));
    }
    // Usage credits and spend: a bar (used of the limit, quota colours) when a limit and the amount
    // used are given; else said as the endpoint gives them, or "non fourni".
    if (u) {
      const stateOf = (c) => (c.enabled === false ? (c.byUser ? tr("credit.offByYou") : c.reason ? tr("credit.offWhy", { why: c.reason }) : tr("credit.off"))
        : c.enabled ? tr("credit.on") : tr("credit.unknown"));
      const credit = (name, c) => {
        if (c == null) return tr("credit.none", { name });
        const state = stateOf(c);
        const used = moneyLabel(c.used);
        return !used ? tr("credit.line", { name, state })
          : c.limit ? tr("credit.usedOf", { name, state, used, limit: moneyLabel(c.limit) }) : tr("credit.used", { name, state, used });
      };
      const bars = [];
      const words = [];
      for (const [key, name, c] of [["credits", tr("credits"), u.extra], ["spend", tr("spend"), u.spend]]) {
        if (!(c?.limit?.amount > 0) || c.used == null) { words.push(credit(name, c)); continue; }
        bars.push(div().flex_1().min_w(0).child(this.V.progress(name, c.used.amount, { max: c.limit.amount, id: `ku-p-claude-${key}`,
          figure: tr("credit.figure", { used: moneyLabel(c.used), limit: moneyLabel(c.limit) }), detail: stateOf(c),
          color: levelColor(t, quotaLevel((c.used.amount / c.limit.amount) * 100)) })));
      }
      if (bars.length) list.push(h_flex().gap(16).items_start().children(bars));
      if (words.length) list.push(div().px(10).text_size(12).text_color(t.muted).child(words.join(" · ")));
    }

    // The live Claude sessions on this computer (a remote one's statusLine files are on its machine).
    const byT = new Map(c.files.map((f) => [f.terminal, f]));
    const live = agents().filter((a) => a.app === "claude-code" && !a.address.includes("/"));
    list.push(this.eyebrow(t, rollText(this.m, "ku-sessions-n", tr("sessions", { n: live.length }).toUpperCase(), 14)));
    if (!live.length) list.push(div().px(10).text_size(12).text_color(t.dim).child(tr("noSession")));
    for (const a of live) {
      const idx = base + items.length;
      items.push({ kind: "session", id: `s-${a.address}`, terminal: a.address });
      // A row's figures roll while the list stays short (ANIMATIONS.md: not past 12 rows).
      list.push(this.session(t, a, byT.get(a.address), idx, now, live.length <= 12));
    }
    // The rows' costs as a donut: each live session's cost_usd, a running total since that session
    // began (not today's cost, summed differently below). The 5 dearest, then the rest. Not past 12
    // sessions (the rows stop rolling there too), nor without any cost.
    const costs = live.map((a) => ({ label: `${a.space_name} · ${a.tab_name}`, value: byT.get(a.address)?.cost_usd }))
      .filter((s) => s.value > 0).sort((x, y) => y.value - x.value);
    // Slices to the dime, the legend's own precision (viz compact, step 0.1): the ring is rebuilt when
    // a session crosses one, not at every statusLine reading.
    const dime = (v) => Math.round(v * 10) / 10;
    const slices = [...costs.slice(0, 5), { label: tr("cumul.rest"), value: costs.slice(5).reduce((sum, s) => sum + s.value, 0), color: "muted" }]
      .map((s) => ({ ...s, value: dime(s.value) })).filter((s) => s.value > 0);
    if (slices.length && live.length <= 12) {
      list.push(this.eyebrow(t, tr("cumul.title")));
      // Drawn at the card's third layout, a render of its own: the first render with data builds the
      // gauge and the surfaces donut cold, the second viz's fluid bars (Fable, its share, credits,
      // spend), and this ring in either call came near Herdr's ~120 ms interrupt (scratch check,
      // 7 sessions: 5 interrupted in 10 with it in the first, 0 without). A new id per step: its
      // on_size_change reports each one's first layout.
      const at = this.costsAt;
      list.push(div().id(`ku-d-claude-sessions~at${at}`).px(10)
        .on_size_change((_size, cx) => { if (this.costsAt === at && at < 2) { this.costsAt = at + 1; cx.notify(); } })
        .child(at >= 2 ? this.V.donut(slices, { label: tr("cumul.caption"), size: 132, id: "ku-d-claude-sessions",
          value: usd(costs.reduce((sum, s) => sum + s.value, 0)) }) : div().h(132)));
      list.push(div().px(10).text_size(11).text_color(t.dim).child(tr("cumul.about")));
    }

    const cost = dayCost(c.files, midnight());
    // A stat without its trend: there is no history of past days to draw one from (none is invented).
    list.push(h_flex().px(10).gap(10).items_start()
      .child(div().flex_1().min_w(0).child(this.V.stat(tr("dayCost"), cost.sessions ? usd(cost.total) : "—", {
        detail: tr("written", { n: cost.sessions }), id: "ku-s-claude-cost", snap: 2 })))
      .child(this.pill(t, tr("estimate"), t.blocked)));
    list.push(div().px(10).text_size(11).text_color(t.dim).child(tr("costAbout")));

    // Limit resets: what one does, when one is worth it (computed from the weekly window), and the
    // official page. Nothing here can use a reset: the button only opens claude.ai in the browser.
    const adv = resetAdvice(week, now);
    list.push(this.eyebrow(t, tr("resets")));
    list.push(div().px(10).text_size(11.5).text_color(t.dim).child(tr("resetsAbout")));
    list.push(h_flex().px(10).gap(8).items_center()
      .child(div().flex_none().size(7).rounded_full().bg(adv.worth ? t.blocked : t.done))
      .child(div().flex_1().min_w(0).text_size(12.5).text_color(adv.worth ? t.foreground : t.muted).child(adv.text)));
    list.push(div().px(10).text_size(11.5).text_color(t.dim)
      .child(tr("resetsAvailable")));
    const ri = base + items.length;
    items.push({ kind: "resets", id: "resets" });
    const onR = this.cur === ri;
    list.push(h_flex().px(10).child(h_flex().id("ku-resets").flex_none().h(30).px(12).gap(8).items_center().rounded_full().border(1)
      .border_color(onR ? alpha(t.accent, "99") : t.border).bg(onR ? alpha(t.accent, "24") : t.background)
      .cursor_pointer().hover((s) => s.bg(t.hover)).tooltip(tr("resetsTip"))
      .on_click((_e, cx) => { cx.stop_propagation(); this.cur = ri; this.openResets(); })
      .child(svg(I("external-link")).size(13).text_color(t.muted))
      .child(div().text_size(12).text_color(t.foreground).child(tr("manageResets")))
      .child(div().font_family(MONO).text_size(10).text_color(t.dim).child(tr("resetsNote")))));

    return {
      items,
      // i18n: tech (Claude Code, API + statusLine)
      el: this.card(t, base, { key: "claude", name: "Claude Code", body: list,
        sub: [c.plan ? `${c.plan}${c.tier ? ` (${c.tier})` : ""}` : tr("unknownPlan"), q?.updated_at ? tr("quotaUpdated", { ago: ago(q.updated_at, now) }) : tr("quotaNever"), u ? "API + statusLine" : "statusLine"].join(" · ") }), // i18n: tech
    };
  }

  session(t, a, s, i, now, few = false) {
    const on = this.cur === i;
    const model = s?.model ? `${s.model}${s.effort && s.effort !== "high" ? ` · ${s.effort}` : ""}` : tr("noStatusLine");
    const ctx = s?.ctx_pct;
    return h_flex().id(`ku-s-${a.address}`).h(34).px(10).gap(10).items_center().rounded(12).border(1)
      .border_color(on ? alpha(t.accent, "66") : alpha(t.accent, "00"))
      .when(on, (el) => el.bg(alpha(t.accent, "24")))
      .when(!on, (el) => el.hover((st) => st.bg(t.hover)))
      .cursor_pointer()
      .on_click((_e, cx) => { this.cur = i; cx.notify(); })
      .child(div().flex_none().size(7).rounded_full().bg(t[a.status] ?? t.idle))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(on ? t.foreground : t.muted).child(`${a.space_name} · ${a.tab_name}`))
      .child(div().flex_none().font_family(MONO).text_size(11).text_color(s?.model ? t.accent : t.dim).child(model))
      .child(h_flex().w(96).flex_none().gap(6).items_center().justify_end()
        .when(ctx == null, (el) => el.child(div().text_size(11).text_color(t.dim).child(tr("noCtx"))))
        .when(ctx != null, (el) => el.child(ring(t, `ku-ctx-${a.address}`, ctx, 18, { window: s?.window }))
          .child(div().font_family(MONO).text_size(11).text_color(ringColor(t, Math.round(ctx), { kind: "ctx", window: s?.window ?? 1_000_000 }))
            .child(few ? rollText(this.m, `ku-ctxn-${a.address}`, tr("ctx", { n: Math.round(ctx) }), 15) : tr("ctx", { n: Math.round(ctx) })))))
      // The status line's cost colour (levels.js): green, yellow, red against the model's price. The
      // dollars roll, the cents don't (they change at every reading).
      .child(div().w(70).flex_none().flex().justify_end().text_right().font_family(MONO).text_size(11)
        .text_color(s?.cost_usd > 0 ? levelColor(t, costLevel(s.cost_usd, s?.model), { okGreen: true }) : t.muted)
        .child(!(s?.cost_usd > 0) ? "—" : few ? roll(this.m, `ku-cost-${a.address}`, usd(s.cost_usd), 15, { snap: 2 }) : usd(s.cost_usd)))
      .child(div().w(76).flex_none().text_right().text_size(10.5).text_color(t.dim).child(s?.updated_at ? ago(s.updated_at, now) : ""));
  }

  codex(t, now, base) {
    const c = this.data.codex;
    const r = c.reading;
    const list = [];
    if (r) {
      // Primary and secondary as progress bars, each as wide as its half of the card (viz measures it).
      list.push(h_flex().gap(16).items_start().children(codexWindows(r.limits, now).map((w) => div().flex_1().min_w(0)
        .child(this.window(t, `ku-p-codex-${w.label}`, w, { why: tr("rolloutMissing"), name: w.label === "5h" ? tr("fiveQuota") : tr("weekQuota7") }, now)))));
      list.push(div().text_size(11).text_color(t.dim).child(tr("codexAbout", { day: day(r.at), time: clock(r.at) })));
    } else {
      list.push(div().text_size(12).text_color(t.muted).child(c.rollouts ? tr("noTokenCount", { n: c.rollouts }) : tr("noRollout")));
    }
    return {
      items: [{ kind: "card", id: "codex" }],
      el: this.card(t, base, { key: "codex", name: "Codex", body: list,
        sub: [plan(r?.plan) ?? tr("unknownPlan"), r?.at ? tr("rolloutAgo", { ago: ago(r.at, now) }) : tr("neverSeen"), tr("unverifiable")].join(" · ") }),
    };
  }

  others(t, base) {
    const o = this.data.others;
    const line = (label, text) => h_flex().gap(10).items_start()
      .child(div().w(150).flex_none().text_size(12).text_color(t.muted).child(label))
      .child(div().flex_1().min_w(0).text_size(12).text_color(t.dim).child(text));
    const absent = OTHERS.filter(([k]) => !o[k]).map(([, name]) => name);
    const seen = OTHERS.filter(([k]) => o[k]).map(([, name]) => name);
    const body = [];
    if (o.opencode) body.push(line("OpenCode", tr(o.opencodeGo ? "oc.go" : "oc.noGo"))); // i18n: tech
    if (seen.length) body.push(line(seen.join(", "), tr("seen")));
    if (absent.length) body.push(line(absent.join(", "), tr("absent")));
    const extra = [o.gemini && "Gemini", o.cursor && "Cursor"].filter(Boolean); // i18n: tech
    if (extra.length) body.push(line(extra.join(", "), tr("folders")));
    const on = this.cur === base;
    return {
      items: [{ kind: "card", id: "others" }],
      el: v_flex().id("ku-card-others").p(12).gap(8).rounded(16).bg(t.surface).border(1)
        .border_color(on ? alpha(t.accent, "99") : t.border)
        .on_click((_e, cx) => { this.cur = base; cx.notify(); })
        .child(div().text_size(13).font_semibold().text_color(t.muted).child(tr("unavailable")))
        .children(body),
    };
  }

  render() {
    const t = theme();
    const now = unix();
    const m = (this.m = frame(this.motion, Boolean(shared("kt.reducedMotion"))));
    // Monocode's dithered gauge / progress / stat, on this render's motion state; with roll, their
    // numbers roll to a new value (the gauge's percent, the progress percent, the stat value).
    this.V = viz(t, m, { roll });
    // The opening (ANIMATIONS.md 1): the veil fades in, the card rises 6 px, 180 ms ease-out, once
    // the veil has its first size. Reduced motion: in place at once.
    const shown = m.reduced || Boolean(this.size);
    const s = sheet(m, "ku", shown); // and out on dismiss: the veil fades, the card sinks 6 px, 140 ms ease-in
    const d = this.data;
    const items = [{ kind: "refresh", id: "refresh" }];
    const cards = [];
    if (d) {
      for (const part of [d.claude.present && "claude", d.codex.present && "codex", "others"].filter(Boolean)) {
        const { items: its, el } = this[part](t, now, items.length);
        items.push(...its);
        cards.push({ part, el, at: items.length - its.length, end: items.length });
      }
    }
    this.items = items;
    // Clamped once there are cards: before the first read only the button exists, and the cursor
    // must still land on the first card.
    if (d) this.cur = Math.max(0, Math.min(this.cur, items.length - 1));
    if (this.reveal) {
      const k = cards.findIndex((c) => this.cur >= c.at && this.cur < c.end);
      if (k >= 0) this.scroll.scroll_to_item(k);
      this.reveal = false;
    }

    const onBtn = this.cur === 0;
    const refresh = h_flex().id("ku-refresh").flex_none().h(30).px(12).gap(6).items_center().rounded_full().border(1)
      .border_color(onBtn ? alpha(t.accent, "99") : t.border).bg(onBtn ? alpha(t.accent, "24") : t.background)
      .text_size(12).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover)).tooltip(tr("refreshTip"))
      .on_click((_e, cx) => { cx.stop_propagation(); this.cur = 0; this.refresh(cx); })
      .child(this.busy ? svg(I("refresh-cw")).size(13).spin(900) : svg(I("refresh-cw")).size(13))
      .child(tr("refresh"));
    const mark = div().flex_none().size(32).rounded(10).border(1).border_color(alpha(t.accent, "4d")).bg(alpha(t.accent, "1a"))
      .flex().items_center().justify_center().child(svg(I("gauge")).size(18).text_color(t.accent));
    const sub = this.busy && !d ? tr("reading") : d ? tr("refreshed", { time: clock(d.at) }) : tr("notRead");

    const listH = Math.max(200, (this.size?.height ?? 760) - 300);
    // The cards come in with a short cascade (ANIMATIONS.md 6: 30 ms apart), once: their ids stay
    // across refreshes. The body scrolls, so it clips the 6 px rise.
    const body = d
      ? cards.map((c, i) => enter(m, v_flex().child(c.el), `ku-in-${c.part}`, { delay: stagger(i, cards.length) }))
      : [pulse(m, div().id("ku-loading").p(16).text_size(13).text_color(t.dim)
        .child(this.error ? tr("readFailed", { error: this.error }) : tr("readingSources")), this.busy)];

    const src = (label, text) => h_flex().gap(8).items_start()
      .child(div().w(52).flex_none().font_family(MONO).text_size(9.5).text_color(t.muted).child(label))
      .child(div().flex_1().min_w(0).font_family(MONO).text_size(9.5).text_color(t.dim).child(text));
    const rollout = d?.codex?.from ? d.codex.from.replace(home(), "~") : tr("rolloutPath");
    const hint = (k, what) => h_flex().gap(5).items_center()
      .child(div().flex_none().h(18).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted).child(k))
      .child(what);
    const mode = div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1).border_color(t.border).bg(t.background)
      .font_family(MONO).text_size(9).text_color(t.muted).child(this.vim.label);

    const card = s.card(v_flex().id("ku-card")
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .w(CARD).max_w_full())
      .p(4).gap(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg()
      .child(div().rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(this.band(t, { id: "ku-head", tint: t.accent, mark, title: tr("title"), sub, rounded: "all",
          buttons: [refresh, this.iconBtn(t, "ku-close", I("x"), tr("closeTip"), (cx) => this.dismiss(cx))] })))
      // overflow_y_scroll, not _scrollbar: with the scrollbar, scroll_to_item did nothing here (G and
      // tab left the cursor's card off screen); the wheel and trackpad scroll either way.
      .child(v_flex().id("ku-body").max_h(listH).overflow_y_scroll().track_scroll(this.scroll).gap(4).children(body))
      .child(v_flex().rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(v_flex().px(12).pt(8).pb(6).gap(3)
          .child(src("API", tr("src.api")))
          .child(src("Claude", tr("src.claude")))
          .child(src("Codex", tr("src.codex", { path: rollout })))
          .child(src("Resets", tr("src.resets")))
          .child(src(tr("src.others"), tr("src.othersText"))))
        .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
        .child(h_flex().px(12).py(8).gap(12).items_center().text_size(11).text_color(t.dim)
          .child(mode)
          .child(hint("j k", tr("hint.item")))
          .child(hint("tab", tr("hint.card")))
          .child(hint("enter", tr("hint.enter")))
          .child(hint("r", tr("hint.refresh")))
          .child(div().flex_1())
          .child(hint("q esc", tr("hint.close")))));

    return s.veil(div().id("ku-veil").size_full().flex().items_center().justify_center().bg(veil()))
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      .on_click((_e, cx) => this.dismiss(cx))
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(card);
  }
}
