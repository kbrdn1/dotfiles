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
// Read only. No network: none of the providers present here has a network collector configured
// (Codex's quota comes from its rollout, not from codex app-server). No keychain.
// Loads on open and on Rafraîchir, never on a timer.
// Keys (vim.js): j/k element, gg/G, ctrl-d/u, tab/shift-tab card, enter/o on a session: focus it,
// r refresh, q/esc close. `kt-usage.key:<keys>` feeds keys, `kt-usage.refresh` refreshes (tests).

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { theme, props, closeOverlay, settings, nextCommand, checking, agents, knownAgents, exec, home, readTextFile, run, shared, watchFolder } from "herdr";
import * as fs from "fs/promises";
import { ring, ringColor } from "./ring.js";
import { Vim, keysOf, step } from "./vim.js";
import { motionState, frame, enter, pulse, stagger, MS } from "./motion.js";
import { bump } from "./bus.js";
import { viz } from "./viz.js";
import { claudeWindows, codexReading, codexWindows, dayCost, resetLabel, ago, clock, day, tierLabel, resetAdvice } from "./data.js";
import { ditherBand, TOP, ALL } from "./dither.js"; // the shared band (DESIGN-REFERENCE.md), tinted per provider

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
// The console opens it in the browser and nothing else: no request to Anthropic, no keychain.
const RESETS_URL = "https://claude.ai/settings/usage";
const RESETS_ABOUT = "Un reset remet à plein la limite qu'il vise (hebdo, Fable, ou les deux). Il est irréversible et peut "
  + "expirer s'il n'est pas utilisé. La limite hebdomadaire repasse quand même à zéro à son heure habituelle. Il ne "
  + "s'utilise que sur claude.ai ou Claude Desktop (Réglages › Usage › Reset for free) : Claude Code ne l'expose pas.";
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
const usd = (n) => `$${n.toFixed(2)}`;
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
  dismiss() {
    closeOverlay(props().overlay);
  }

  // A full read; then bump("usage") (DATA-SYNC.md): kt-threads' 5h rings and kbrdn-status follow.
  // Folder changes (watch) don't bump: those mods watch the same files themselves.
  refresh(cx) {
    if (this.busy || checking()) return;
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        this.data = await this.load(this.data);
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

  // Everything: on open and on Rafraîchir.
  async load(prev) {
    const d = { at: unix(), programs: {} };
    // Program tiles, and whether Herdr finds each CLI (its own check, at most once a minute).
    try { for (const p of await knownAgents()) d.programs[p.key] = p; } catch { /* tiles fall back */ }
    d.claude = await this.loadClaude(prev?.claude, d.programs, true);
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
    if (a === "escape" || a === "quit") this.dismiss();
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
      this.dismiss();
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
          .child(div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(title))
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
      .child(div().flex_none().font_family(MONO).text_size(10.5).text_color(t.muted).child(text.toUpperCase()))
      .child(div().flex_1().h(0).border_t(1).border_dashed().border_color(t.border));
  }

  // One window. With a current number, the dithered visuals (viz.js, Monocode's): a gauge for the main
  // limit, else a progress bar, in the threshold color (ring.js' ringColor), the reset below. Without
  // one (missing, or reset since the reading), said in words over a dashed circle, never drawn as a value.
  window(t, id, w, { why, name, main = false }, now) {
    if (!w.missing && !w.passed) {
      const p = Math.round(w.used);
      const reset = div().id(`${id}-reset`).text_size(12).text_color(t.dim)
        .tooltip(w.resets ? `${day(w.resets)} à ${clock(w.resets)}` : "reset non fourni").child(resetLabel(w, now));
      if (main) return h_flex().gap(16).items_center()
        .child(this.V.gauge(name, w.used, { unit: "%", size: 168, color: ringColor(t, p), id }))
        .child(v_flex().flex_1().min_w(0).gap(4).child(div().font_family(MONO).text_size(11).text_color(t.muted).child(w.label)).child(reset));
      return this.V.progress(name, w.used, { detail: resetLabel(w, now), color: ringColor(t, p), id });
    }
    const empty = (mark) => div().size(48).flex_none().rounded_full().border(2).border_dashed().border_color(t.border)
      .flex().items_center().justify_center().font_family(MONO).text_size(12).text_color(t.dim).child(mark);
    const small = (text, color = t.dim) => div().text_size(11).text_color(color).child(text);
    const lines = [div().font_family(MONO).text_size(11).text_color(t.muted).child(w.label)];
    if (w.missing) lines.push(small(why, t.muted));
    else {
      lines.push(small("usage actuel inconnu", t.muted));
      lines.push(small(`${resetLabel(w, now)}, après la dernière lecture (${Math.round(w.last)} %)`));
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
        buttons: [this.iconBtn(t, `ku-refresh-${key}`, I("refresh-cw"), "Rafraîchir (r)", (cx) => this.refresh(cx))] }))
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
    const [five, week] = claudeWindows(q, now);
    list.push(this.window(t, "ku-g-claude-7j", week, { why: "non fourni par Claude Code en ce moment", name: "Quota hebdo", main: true }, now));
    if (!five.missing) list.push(this.window(t, "ku-p-claude-5h", five, { name: "Quota 5 h" }, now));
    if (five.missing) list.push(div().px(10).text_size(12).text_color(t.muted).child(c.plan === "Ultra"
      ? "Fenêtre 5h : supprimée sur ton abonnement (Ultra vérifié)"
      : "Fenêtre 5h : non fournie par Claude Code en ce moment"));

    // The live Claude sessions on this computer (a remote one's statusLine files are on its machine).
    const byT = new Map(c.files.map((f) => [f.terminal, f]));
    const live = agents().filter((a) => a.app === "claude-code" && !a.address.includes("/"));
    list.push(this.eyebrow(t, `Sessions actives · ${live.length}`));
    if (!live.length) list.push(div().px(10).text_size(12).text_color(t.dim).child("Aucune session Claude Code en cours dans Herdr."));
    for (const a of live) {
      const idx = base + items.length;
      items.push({ kind: "session", id: `s-${a.address}`, terminal: a.address });
      list.push(this.session(t, a, byT.get(a.address), idx, now));
    }

    const cost = dayCost(c.files, midnight());
    // A stat without its trend: there is no history of past days to draw one from (none is invented).
    list.push(h_flex().px(10).gap(10).items_start()
      .child(div().flex_1().min_w(0).child(this.V.stat("Coût du jour", cost.sessions ? usd(cost.total) : "—", {
        detail: `${cost.sessions} session${cost.sessions > 1 ? "s" : ""} écrite${cost.sessions > 1 ? "s" : ""} aujourd'hui`, id: "ku-s-claude-cost" })))
      .child(this.pill(t, "ESTIMATION", t.blocked)));
    list.push(div().px(10).text_size(11).text_color(t.dim).child(
      "Équivalent API calculé par Claude Code, pas facturé sur l'abonnement. Dernier cost_usd de chaque session (sans double compte), "
      + "cumulé depuis le début de la session ; une session dont le terminal a resservi n'est plus comptée."));

    // Limit resets: what one does, when one is worth it (computed from the weekly window), and the
    // official page. Nothing here can use a reset: the button only opens claude.ai in the browser.
    const adv = resetAdvice(week, now);
    list.push(this.eyebrow(t, "Resets de limite"));
    list.push(div().px(10).text_size(11.5).text_color(t.dim).child(RESETS_ABOUT));
    list.push(h_flex().px(10).gap(8).items_center()
      .child(div().flex_none().size(7).rounded_full().bg(adv.worth ? t.blocked : t.done))
      .child(div().flex_1().min_w(0).text_size(12.5).text_color(adv.worth ? t.foreground : t.muted).child(adv.text)));
    list.push(div().px(10).text_size(11.5).text_color(t.dim)
      .child("Resets disponibles : non lisibles d'ici (ni la status line ni Claude Code ne les donnent). Leur nombre est sur claude.ai."));
    const ri = base + items.length;
    items.push({ kind: "resets", id: "resets" });
    const onR = this.cur === ri;
    list.push(h_flex().px(10).child(h_flex().id("ku-resets").flex_none().h(30).px(12).gap(8).items_center().rounded_full().border(1)
      .border_color(onR ? alpha(t.accent, "99") : t.border).bg(onR ? alpha(t.accent, "24") : t.background)
      .cursor_pointer().hover((s) => s.bg(t.hover)).tooltip("Ouvre claude.ai/settings/usage dans le navigateur (enter)")
      .on_click((_e, cx) => { cx.stop_propagation(); this.cur = ri; this.openResets(); })
      .child(svg(I("external-link")).size(13).text_color(t.muted))
      .child(div().text_size(12).text_color(t.foreground).child("Gérer mes resets"))
      .child(div().font_family(MONO).text_size(10).text_color(t.dim).child("ouvre claude.ai, rien n'est utilisé d'ici"))));

    return {
      items,
      el: this.card(t, base, { key: "claude", name: "Claude Code", body: list,
        sub: [c.plan ? `${c.plan}${c.tier ? ` (${c.tier})` : ""}` : "plan inconnu", q?.updated_at ? `quota mis à jour ${ago(q.updated_at, now)}` : "quota jamais observé", "statusLine"].join(" · ") }),
    };
  }

  session(t, a, s, i, now) {
    const on = this.cur === i;
    const model = s?.model ? `${s.model}${s.effort && s.effort !== "high" ? ` · ${s.effort}` : ""}` : "pas encore de statusLine";
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
        .when(ctx == null, (el) => el.child(div().text_size(11).text_color(t.dim).child("ctx non fourni")))
        .when(ctx != null, (el) => el.child(ring(t, `ku-ctx-${a.address}`, ctx, 18))
          .child(div().font_family(MONO).text_size(11).text_color(t.muted).child(`ctx ${Math.round(ctx)} %`))))
      .child(div().w(70).flex_none().text_right().font_family(MONO).text_size(11).text_color(t.muted)
        .child(s?.cost_usd > 0 ? usd(s.cost_usd) : "—"))
      .child(div().w(76).flex_none().text_right().text_size(10.5).text_color(t.dim).child(s?.updated_at ? ago(s.updated_at, now) : ""));
  }

  codex(t, now, base) {
    const c = this.data.codex;
    const r = c.reading;
    const list = [];
    if (r) {
      // Primary and secondary as progress bars, each as wide as its half of the card (viz measures it).
      list.push(h_flex().gap(16).items_start().children(codexWindows(r.limits, now).map((w) => div().flex_1().min_w(0)
        .child(this.window(t, `ku-p-codex-${w.label}`, w, { why: "absente du dernier rollout", name: w.label === "5h" ? "Quota 5 h" : "Quota 7 j" }, now)))));
      list.push(div().text_size(11).text_color(t.dim).child(
        `Fenêtres primaire et secondaire du dernier rollout (${day(r.at)} à ${clock(r.at)}). `
        + "Un rollout ne dit pas quel compte l'a servi : chiffre non vérifiable contre le compte connecté."));
    } else {
      list.push(div().text_size(12).text_color(t.muted).child(c.rollouts
        ? `Non disponible : aucun événement token_count avec rate_limits dans les ${c.rollouts} derniers rollouts.`
        : "Non disponible : aucun rollout dans ~/.codex/sessions (Codex n'a pas encore tourné)."));
    }
    return {
      items: [{ kind: "card", id: "codex" }],
      el: this.card(t, base, { key: "codex", name: "Codex", body: list,
        sub: [plan(r?.plan) ?? "plan inconnu", r?.at ? `rollout ${ago(r.at, now)}` : "jamais observé", "compte non vérifiable"].join(" · ") }),
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
    if (o.opencode) body.push(line("OpenCode", o.opencodeGo
      ? "Abonnement Go configuré, mais son appel réseau n'est pas transposé dans cette console (herdr-agent-quota le lit)."
      : "Installé, sans clé opencode-go dans auth.json : pas d'abonnement Go à mesurer (les autres routes n'ont pas de quota côté OpenCode)."));
    if (seen.length) body.push(line(seen.join(", "), "Identifiants ou CLI présents, mais leur collecteur n'est pas transposé dans cette console (herdr-agent-quota le lit)."));
    if (absent.length) body.push(line(absent.join(", "), "Non détectés : ni identifiants ni CLI sur cette machine."));
    const extra = [o.gemini && "Gemini", o.cursor && "Cursor"].filter(Boolean);
    if (extra.length) body.push(line(extra.join(", "), "Dossiers présents, mais herdr-agent-quota n'a pas de collecteur pour eux : rien à lire sans inventer."));
    const on = this.cur === base;
    return {
      items: [{ kind: "card", id: "others" }],
      el: v_flex().id("ku-card-others").p(12).gap(8).rounded(16).bg(t.surface).border(1)
        .border_color(on ? alpha(t.accent, "99") : t.border)
        .on_click((_e, cx) => { this.cur = base; cx.notify(); })
        .child(div().text_size(13).font_semibold().text_color(t.muted).child("Non disponibles"))
        .children(body),
    };
  }

  render() {
    const t = theme();
    const now = unix();
    const m = (this.m = frame(this.motion, Boolean(shared("kt.reducedMotion"))));
    this.V = viz(t, m); // Monocode's dithered gauge / progress / stat, on this render's motion state
    // The opening (ANIMATIONS.md 1): the veil fades in, the card rises 6 px, 180 ms ease-out, once
    // the veil has its first size. Reduced motion: in place at once.
    const shown = m.reduced || Boolean(this.size);
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
      .text_size(12).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover)).tooltip("Rafraîchir (r)")
      .on_click((_e, cx) => { cx.stop_propagation(); this.cur = 0; this.refresh(cx); })
      .child(this.busy ? svg(I("refresh-cw")).size(13).spin(900) : svg(I("refresh-cw")).size(13))
      .child("Rafraîchir");
    const mark = div().flex_none().size(32).rounded(10).border(1).border_color(alpha(t.accent, "4d")).bg(alpha(t.accent, "1a"))
      .flex().items_center().justify_center().child(svg(I("gauge")).size(18).text_color(t.accent));
    const sub = this.busy && !d ? "Lecture…"
      : d ? `Rafraîchi à ${clock(d.at)} · lecture seule, aucun appel réseau` : "Pas encore lu";

    const listH = Math.max(200, (this.size?.height ?? 760) - 300);
    // The cards come in with a short cascade (ANIMATIONS.md 6: 30 ms apart), once: their ids stay
    // across refreshes. The body scrolls, so it clips the 6 px rise.
    const body = d
      ? cards.map((c, i) => enter(m, v_flex().child(c.el), `ku-in-${c.part}`, { delay: stagger(i, cards.length) }))
      : [pulse(m, div().id("ku-loading").p(16).text_size(13).text_color(t.dim)
        .child(this.error ? `Lecture impossible : ${this.error}` : "Lecture des sources…"), this.busy)];

    const src = (label, text) => h_flex().gap(8).items_start()
      .child(div().w(52).flex_none().font_family(MONO).text_size(9.5).text_color(t.muted).child(label))
      .child(div().flex_1().min_w(0).font_family(MONO).text_size(9.5).text_color(t.dim).child(text));
    const rollout = d?.codex?.from ? d.codex.from.replace(home(), "~") : "~/.codex/sessions/AAAA/MM/JJ/rollout-*.jsonl";
    const hint = (k, what) => h_flex().gap(5).items_center()
      .child(div().flex_none().h(18).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted).child(k))
      .child(what);
    const mode = div().flex_none().h(16).px(6).flex().items_center().rounded(5).border(1).border_color(t.border).bg(t.background)
      .font_family(MONO).text_size(9).text_color(t.muted).child(this.vim.label);

    const card = v_flex().id("ku-card")
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .w(CARD).max_w_full().relative().top(shown ? 0 : 6)
      .when(!m.reduced, (el) => el.transition("top", { duration: MS.open, easing: "ease-out" }))
      .p(4).gap(4).rounded(20).bg(t.popover).border(1).border_color(t.border).shadow_lg()
      .child(div().rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(this.band(t, { id: "ku-head", tint: t.accent, mark, title: "Abonnements IA", sub, rounded: "all",
          buttons: [refresh, this.iconBtn(t, "ku-close", I("x"), "Fermer (q)", () => this.dismiss())] })))
      // overflow_y_scroll, not _scrollbar: with the scrollbar, scroll_to_item did nothing here (G and
      // tab left the cursor's card off screen); the wheel and trackpad scroll either way.
      .child(v_flex().id("ku-body").max_h(listH).overflow_y_scroll().track_scroll(this.scroll).gap(4).children(body))
      .child(v_flex().rounded(16).bg(t.surface).border(1).border_color(t.border)
        .child(v_flex().px(12).pt(8).pb(6).gap(3)
          .child(src("Claude", "quota : ~/.claude/cache/statusline/herdr-quota.json, rate_limits du statusLine Claude Code (statusline.ts ; dernier écrivain, sans identifiant de compte) ; Ultra : seven_day seul, five_hour null · sessions, contexte, coût : herdr-<terminal>.json · plan : ~/.claude.json oauthAccount.planDisplayName, via jq (pas lu par herdr-agent-quota)"))
          .child(src("Codex", `${rollout} : dernier token_count, rate_limits primary / secondary (classées par durée, comme codex.rs) et plan_type ; 256 Kio de fin`))
          .child(src("Resets", "conseil calculé sur seven_day (plus de 90 % et retour à zéro à plus de 24 h) · nombre disponible non lisible · usage seulement sur claude.ai/settings/usage (support.claude.com/en/articles/17007452)"))
          .child(src("Autres","présence des fichiers d'identifiants de herdr-agent-quota (jamais lus) et de la CLI (knownAgents) ; OpenCode : jq -e has(\"opencode-go\") sur auth.json")))
        .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
        .child(h_flex().px(12).py(8).gap(12).items_center().text_size(11).text_color(t.dim)
          .child(mode)
          .child(hint("j k", "élément"))
          .child(hint("tab", "carte"))
          .child(hint("enter", "session, page des resets"))
          .child(hint("r", "rafraîchir"))
          .child(div().flex_1())
          .child(hint("q esc", "fermer"))));

    return div().id("ku-veil").size_full().flex().items_center().justify_center()
      .bg(veil()).opacity(shown ? 1 : 0)
      .when(!m.reduced, (el) => el.transition("opacity", { duration: MS.open, easing: "ease-out" }))
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      .on_click(() => this.dismiss())
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(card);
  }
}
