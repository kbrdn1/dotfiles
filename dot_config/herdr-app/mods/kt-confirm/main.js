// kbrdn Threads' confirm (a clone of the shipped `confirm`, kt-new's look): asks before
// something destructive. Opened as a dialog with props { title, detail, command: { name, args } }
// and optional `label` (the confirm button) and `danger` (the button in red). Open it with
// `frame: "none"`: it draws its own card. y or Enter confirms (runs the command); n, q or Esc
// cancels; no other key (no vim motion here). `kt-confirm.key:<keys>` feeds keys, for tests.
// Full window (mod.json, or width: 1, height: 1): a veil over the window and the 460 px card in its
// middle, as tall as its body up to the window (then the body scrolls); a click on the veil
// cancels, unless `danger` (then only the buttons and Esc). Opened in a card-sized box (an explicit
// `width: 460, height: 200`), the card fills it as before, no veil, the body scrolling.
//
// The body: an icon (danger: ansi1, warning: blocked, success: done, info: accent), the title
// (15 px) and the first paragraph of `detail` (13 px, muted), then in blocks: `facts` (key / value
// pairs), `items` (one line each: { label, detail?, state?: "ok" | "refused" | "warn", reason? }),
// the other paragraphs of `detail` (a paragraph of "• " lines is a list block; under a heading
// starting "Refus", its lines are refused, "name : why"), `warning` (a red band) and `consequence`
// (what happens, in plain words). `tone` ("danger" | "warning" | "info" | "success") and `icon` (a
// kt-threads icon name) override the defaults.
//
// Closing a thread, a pane or a project describes itself: props `thread: <tab id>`, `pane: <pane
// id>` or `space: <space id>`, or a `command` of tab.close {id}, pane.close {pane} or space.close
// {id}. Read live: its title, project, branch, terminals, sub-agents and the agent's state (working
// in red), and what closes with it (the last thread closes its project). The command then runs
// confirmed, so Herdr's own confirm never follows ours: tab.close / space.close with `confirmed:
// true`, and a pane that is its thread's only one closes as its thread (`tab.close`). Gone while
// open (closed elsewhere): an error state, and confirming only closes the dialog.
// `kt-confirm.thread:<id>` / `.pane:<id>` / `.space:<id>` describe one on an open copy, and
// `kt-confirm.props:<json>` lays props over its own (a preview), and `kt-confirm.reopen[:WxH]` shows
// them again opened with no size (or in a W × H box), for tests.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, settings, nextCommand, checking, spaces, panes, terminals, shared, home } from "herdr";
import { keyOf, keysOf } from "./vim.js";
import { motionState, frame, sheet, leave, sharpen } from "./motion.js";
import { ditherBand, TOP } from "./dither.js";
import { makeT } from "./i18n.js";
import strings from "./strings.js";

const tr = makeT(strings);
const MONO = "Monaspace Krypton";
const CARD = 460;
const I = (name) => (name.includes("/") ? name : `mods/kt-threads/${name}.svg`);
// A color with alpha `a`, replacing any it has (glass themes are #rrggbbaa).
const alpha = (c, a) => `${String(c).slice(0, 7)}${a}`;
const veil = () => (settings().dark ? alpha("#000000", "8c") : alpha("#0a0a0a", "59"));
const TONES = { danger: ["ansi1", "circle-alert"], warning: ["blocked", "circle-alert"], success: ["done", "circle-check"], info: ["accent", "message-circle-question"] };
const STATE_ICON = { ok: ["circle-check", "done"], refused: ["x", "ansi1"], warn: ["circle-alert", "blocked"] };

// kt-threads' label() (copied: a name the person gave stays; else the agent's live title, else the program).
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();
function label(tab, lead) {
  const prog = lead?.program?.name;
  const base = tab.named ? tab.name : prog ?? "Terminal";
  if (!lead?.program?.agent) return base;
  const live = clean(lead.title);
  const path = /^[~/]|^[A-Za-z]:\\/.test((lead.title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, ""));
  const telling = live && live !== lead.terminal && live !== prog && !path && !live.includes("@") && live.toLowerCase() !== lead.program.key;
  return (tab.name === prog || !tab.named) && telling ? live : base;
}
// kt-picker's project name: Home, else its registry entry (same machine, its folder or one under it), else the space's.
const isHome = (s) => !s.machine && (s.name === "~" || !s.folder || s.folder === home());
const entryOf = (s) => (isHome(s) ? null : (shared("kt.projects") ?? []).find((x) => (x.machine ?? null) === (s.machine ?? null) && x.folder && (s.folder === x.folder || s.folder.startsWith(`${x.folder}/`))) ?? null);
function projectName(s) {
  if (isHome(s)) return s.named ? s.name : "Home";
  return entryOf(s)?.name ?? s.name;
}
// The project's color as every mod paints it: its registry color, else its space's ("space.colors"); a theme name or #hex.
const projectColor = (s) => entryOf(s)?.color ?? (shared("space.colors") ?? {})[s.id] ?? null;
const tilde = (p) => (p && p.startsWith(home()) ? `~${p.slice(home().length)}` : p ?? "");
// Sub-agents: terminals started from these ones, and from theirs.
function subAgents(addresses) {
  const all = terminals();
  const seen = new Set(addresses);
  let found = 0;
  for (let grew = true; grew; ) {
    grew = false;
    for (const x of all) if (x.parent && seen.has(x.parent) && !seen.has(x.address)) { seen.add(x.address); found++; grew = true; }
  }
  return found;
}
// The agent's state, written: [what, theme color name].
const AGENT_COLOR = { working: "ansi1", blocked: "blocked", done: "done", idle: "muted" };
const agentState = (status) => (AGENT_COLOR[status] ? [tr(`agent.${status}`), AGENT_COLOR[status]] : null);

// What a close is about: explicit props, else the command it runs.
function subjectOf(p, forced) {
  if (forced) return forced;
  if (p.thread) return { kind: "thread", id: p.thread };
  if (p.pane) return { kind: "pane", id: p.pane };
  if (p.space) return { kind: "space", id: p.space };
  const c = p.command ?? {};
  if (c.name === "tab.close") return { kind: "thread", id: c.args?.id ?? spaces().find((s) => s.active)?.tabs.find((x) => x.active)?.id };
  if (c.name === "pane.close") return { kind: "pane", id: c.args?.pane ?? panes().find((x) => x.focused)?.pane };
  if (c.name === "space.close") return { kind: "space", id: c.args?.id ?? spaces().find((s) => s.active)?.id };
  return null;
}

// A thread, pane or project close, described from live data: the body's pieces and the command.
function describe(sub) {
  const ps = panes();
  if (sub.kind === "space") {
    const s = spaces().find((x) => x.id === sub.id);
    if (!s) return { missing: tr("space.missing") };
    const terms = ps.filter((x) => x.terminal && s.tabs.some((c) => c.id === x.tab));
    const busy = s.tabs.filter((c) => c.status === "working").length;
    return {
      title: tr("space.title"),
      text: tr("space.text"),
      head: { name: projectName(s), sub: tilde(s.folder) },
      tint: projectColor(s),
      subtitle: [projectName(s), tilde(s.folder), tr("space.kind")],
      facts: [[tr("fact.threads"), String(s.tabs.length)], [tr("fact.terminals"), String(terms.length)], [tr("fact.subagents"), String(subAgents(terms.map((x) => x.terminal)))],
        ...(busy ? [[tr("fact.agents"), tr("space.busy", { n: busy }), "ansi1"]] : [])],
      warning: busy ? tr("space.warning", { n: busy }) : null,
      consequence: tr("space.consequence", { n: s.tabs.length }),
      command: { name: "space.close", args: { id: s.id, confirmed: true } },
      label: tr("space.label"),
    };
  }
  const pane = sub.kind === "pane" ? ps.find((x) => x.pane === sub.id) : null;
  const tabId = sub.kind === "pane" ? pane?.tab : sub.id;
  const s = spaces().find((x) => x.tabs.some((c) => c.id === tabId));
  const c = s?.tabs.find((x) => x.id === tabId);
  if (!c || (sub.kind === "pane" && !pane)) return { missing: sub.kind === "pane" ? tr("pane.missing") : tr("thread.missing") };
  const mine = ps.filter((x) => x.tab === c.id && x.terminal);
  const lead = mine.find((x) => x.program?.agent) ?? mine[0];
  const name = label(c, lead);
  const project = projectName(s);
  const last = s.tabs.length === 1;
  const closesProject = last ? tr("thread.last", { project }) : null;
  if (sub.kind === "pane") {
    const sole = ps.filter((x) => x.tab === c.id).length <= 1;
    const st = pane.status ? agentState(pane.status) : null;
    return {
      title: tr("pane.title"),
      text: sole ? tr("pane.sole") : tr("pane.rest"),
      head: { name: pane.title || pane.program?.name || "Terminal", sub: name, program: pane.program }, // i18n: tech
      tint: projectColor(s),
      subtitle: [project, name, tr("pane.kind")],
      facts: [[tr("fact.program"), pane.program?.name ?? "—"], [tr("fact.folder"), tilde(pane.cwd) || "—"], [tr("fact.branch"), pane.branch ?? "—"],
        ...(st ? [[tr("fact.agent"), st[0], st[1]]] : []), ...(pane.terminal ? [[tr("fact.subagents"), String(subAgents([pane.terminal]))]] : [])],
      warning: pane.status === "working" ? tr("pane.warning") : null,
      consequence: [pane.terminal ? tr("pane.terminal") : tr("pane.closed"), sole ? (closesProject ?? tr("pane.thread", { name })) : null].filter(Boolean).join(" "),
      command: sole ? { name: "tab.close", args: { id: c.id, confirmed: true } } : { name: "pane.close", args: { pane: pane.pane } },
      label: tr("pane.label"),
    };
  }
  const st = c.status ? agentState(c.status) : null;
  const subs = subAgents(mine.map((x) => x.terminal));
  return {
    title: tr("thread.title"),
    text: tr("thread.text"),
    head: { name, sub: project, program: lead?.program },
    tint: projectColor(s),
    subtitle: [project, lead?.branch ?? s.branch, tr("thread.kind")],
    facts: [[tr("fact.project"), project], [tr("fact.branch"), lead?.branch ?? s.branch ?? "—"], [tr("fact.terminals"), String(mine.length)], [tr("fact.subagents"), String(subs)],
      [tr("fact.agent"), st ? st[0] : tr("none"), st ? st[1] : "dim"]],
    warning: c.status === "working" ? tr("thread.warning") : null,
    consequence: [`${tr("thread.terms", { n: mine.length })}${subs ? tr(mine.length > 1 ? "thread.subsMany" : "thread.subsOne", { n: subs }) : ""}.`, closesProject].filter(Boolean).join(" "),
    command: { name: "tab.close", args: { id: c.id, confirmed: true } },
    label: tr("thread.label"),
  };
}

// A legacy `detail`: paragraphs (blank lines between), a paragraph of "• " lines a list (its first
// line, when not one, the list's heading).
function blocks(detail) {
  return String(detail ?? "").split(/\n\s*\n/).map((para) => para.split("\n").filter((l) => l.trim())).filter((ls) => ls.length).map((ls) => {
    const bullet = (l) => /^\s*[•·▪–-]\s/.test(l);
    const rest = bullet(ls[0]) ? ls : ls.slice(1);
    if (!rest.length || !rest.every(bullet)) return { kind: "text", lines: ls };
    const heading = bullet(ls[0]) ? null : ls[0].replace(/\s*:\s*$/, "");
    const refused = /^refus/i.test(heading ?? "");
    return {
      kind: "list",
      heading,
      items: rest.map((l) => {
        const s = l.replace(/^\s*[•·▪–-]\s+/, "");
        // "name : why" (fr) or "name: why" (en, I18N.md).
        const colon = refused ? / ?: /.exec(s) : null;
        const [a, b] = s.includes(" — ") ? [s.slice(0, s.indexOf(" — ")), s.slice(s.indexOf(" — ") + 3)] : colon ? [s.slice(0, colon.index), s.slice(colon.index + colon[0].length)] : [s, null];
        return refused ? { label: a, reason: b, state: "refused" } : { label: a, detail: b };
      }),
    };
  });
}

export default class Confirm extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.forced = null; // a subject set by `thread:` / `pane:` / `space:` (tests)
    this.extra = null; // props laid over by `props:` (tests)
    this.motion = motionState(); // ANIMATIONS.md: the veil fades and the card rises, in and out (motion.js sheet, leave)
    if (!checking()) cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        const [name, arg] = [c.split(":")[0], c.slice(c.indexOf(":") + 1)];
        if (name === "key") for (const k of keysOf(arg)) this.act(k, cx);
        else if (["thread", "pane", "space"].includes(name)) this.forced = { kind: name, id: arg };
        else if (name === "props") { try { this.extra = JSON.parse(arg); } catch { this.extra = null; } }
        // Tests: the same props again, in a dialog opened with no size (kt-gwm's, kt-inbox's way:
        // 420 wide, as tall as its content), or `reopen:460x200`, a fixed box.
        else if (name === "reopen") { const p = { ...this.extra }; const [w, h] = c.includes(":") ? arg.split("x").map(Number) : []; closeOverlay(props().overlay); openOverlay({ mod: "kt-confirm", kind: "dialog", frame: "none", ...(w ? { width: w, height: h } : {}), props: p }); }
        cx.notify();
      }
    });
  }

  // One key name; false: not one of ours, and it goes on.
  act(k, cx) {
    if (k === "y" || k === "enter") this.yes(cx);
    else if (k === "n" || k === "q" || k === "escape") this.dismiss(cx);
    else return false;
    return true;
  }

  // motion.js leave(): the veil fades out and the card sinks, then the dialog closes.
  dismiss(cx) {
    leave(this.motion, cx, "kc", () => closeOverlay(props().overlay));
  }

  // What the dialog shows and runs now: the props, or a close described from live data. Once
  // confirmed, what it showed then: the thread it closed is gone, and the card leaves as it was.
  view() {
    if (this.done) return this.done;
    const p = { ...props(), ...this.extra };
    const sub = subjectOf(p, this.forced);
    if (!sub) return { ...p, tone: p.tone ?? (p.danger ? "danger" : "info"), parts: blocks(p.detail) };
    const d = describe(sub);
    if (d.missing) return { title: d.missing, tone: "warning", parts: [{ kind: "text", lines: [tr("gone.text")] }], missing: true, label: tr("close") };
    return { ...d, title: p.title ?? d.title, danger: true, tone: "danger", parts: [{ kind: "text", lines: [d.text] }] };
  }

  // The command first, then the dialog leaves; once only (a second y or Enter while it leaves).
  yes(cx) {
    if (this.done) return;
    const v = (this.done = this.view());
    // Opened bare (`mod.open`), or about something gone: nothing to run, it only closes.
    if (!v.missing && v.command?.name) run(v.command.name, v.command.args ?? {});
    this.dismiss(cx);
  }

  // ---------- the body's pieces ----------

  text(t, lines, size = 13) {
    return v_flex().gap(2).max_w(400).text_size(size).line_height("20px").text_color(t.muted).children(lines.map((l) => div().child(l)));
  }

  // An inner card (radius 12 inside the 16 one), on the terminals' background.
  block(t) {
    return v_flex().flex_none().rounded(12).border(1).border_color(t.border).bg(t.background).overflow_hidden();
  }

  // The program's tile, as kt-threads draws it (its icon on its own color).
  tile(t, prog) {
    const g = prog?.icon ? (prog.tint ? svg(prog.icon).size(12).text_color(prog.color ?? "#ffffff") : image(prog.icon).size(12)) : svg("mods/workspace-chrome/terminal.svg").size(11).text_color(t.muted);
    return div().size(22).flex_none().rounded(7).border(1).border_color("#00000033").bg(prog?.tile ?? t.raised).flex().items_center().justify_center().child(g);
  }

  // Key / value pairs, the keys aligned in mono; a card head (what it is about) above them.
  facts(t, head, rows) {
    return this.block(t)
      .when(Boolean(head), (el) => el
        .child(h_flex().px(12).py(10).gap(10).items_center()
          .child(this.tile(t, head.program))
          .child(v_flex().flex_1().min_w(0)
            .child(div().truncate().text_size(13).font_medium().text_color(t.foreground).child(head.name))
            .when(Boolean(head.sub), (el) => el.child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(head.sub)))))
        .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border)))
      .when(rows.length > 0, (el) => el.child(v_flex().px(12).py(10).gap(7).children(rows.map(([k, v, color]) =>
        h_flex().gap(12).items_center()
          .child(div().w(84).flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(k))
          .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(color ? t[color] ?? color : t.foreground).child(v))))));
  }

  // One line per element: its state's icon (a plain dot without one), its name, what it is or why it's refused.
  list(t, heading, items) {
    return this.block(t)
      .when(Boolean(heading), (el) => el.child(h_flex().px(12).pt(10).pb(4).gap(8).items_center().font_family(MONO).text_size(10.5).text_color(t.dim)
        .child(String(heading).toUpperCase()).child(div().text_color(t.muted).child(String(items.length)))))
      .child(v_flex().py(4).children(items.map((x, i) => {
        const [icon, color] = STATE_ICON[x.state] ?? [];
        return h_flex().px(12).py(7).gap(10).items_start().when(i > 0, (el) => el.border_t(1).border_color(alpha(t.border, "99")))
          .child(h_flex().size(16).flex_none().items_center().justify_center()
            .child(icon ? svg(I(icon)).size(13).text_color(t[color]) : div().size(5).rounded_full().bg(t.dim)))
          .child(v_flex().flex_1().min_w(0).gap(1)
            .child(div().truncate().text_size(12.5).text_color(x.state === "refused" ? t.muted : t.foreground).child(x.label ?? ""))
            .when(Boolean(x.detail), (el) => el.child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.dim).child(x.detail)))
            .when(Boolean(x.reason), (el) => el.child(div().text_size(11.5).line_height("16px").text_color(t.muted).child(x.reason))));
      })));
  }

  // A sober red band: the one thing that makes this worse than usual.
  warning(t, text) {
    return h_flex().flex_none().gap(9).items_start().px(12).py(9).rounded(12).border(1).border_color(alpha(t.ansi1, "4d")).bg(alpha(t.ansi1, "14"))
      .child(svg(I("circle-alert")).size(14).flex_none().mt(2).text_color(t.ansi1))
      .child(div().flex_1().min_w(0).text_size(12.5).line_height("18px").text_color(t.ansi1).child(text));
  }

  // What happens, in plain words.
  consequence(t, text, color) {
    return h_flex().flex_none().gap(9).items_start().px(2)
      .child(svg(I("x")).size(14).flex_none().mt(3).text_color(color))
      .child(div().flex_1().min_w(0).text_size(13).line_height("20px").text_color(t.foreground).child(text));
  }

  render() {
    const t = theme();
    const p = { ...props(), ...this.extra };
    const v = this.view();
    const [toneName, toneIcon] = TONES[v.tone] ?? TONES.info;
    const tone = t[toneName] ?? t.accent;
    const confirmTone = v.danger ? t.ansi1 : t.solid;
    const off = Boolean(v.missing);
    // kbrdn.dev pills: an outline Cancel, a solid Confirm.
    const button = (id, label, solid, onClick) =>
      h_flex()
        .id(id)
        .h(30)
        .px(14)
        .items_center()
        .rounded_full()
        .border(1)
        .border_color(solid ? confirmTone : t.input)
        .bg(solid ? confirmTone : t.background)
        .text_color(solid ? (v.danger ? t.background : t.solid_foreground) : t.foreground)
        .font_family(MONO)
        .text_size(11)
        .when(solid && off, (el) => el.opacity(0.45))
        .when(!(solid && off), (el) => el.cursor_pointer().hover((s) => s.opacity(0.88)))
        .on_click(onClick)
        .child(label.toUpperCase());
    const kbd = (k) => div().flex_none().h(18).px(6).flex().items_center().rounded_full().border(1).border_color(t.border).font_family(MONO).text_size(10).text_color(t.muted).child(k);
    // Before the first size report (and in `herdr-app check`), the full layout, still transparent.
    const full = !this.size || this.size.width > CARD + 40;
    // The modals' motion (ANIMATIONS.md, kt-keys' motif): the veil fades in and the card rises 6 px,
    // 180 ms, once, on the first size report, and goes back out on dismiss (motion.js sheet);
    // reduced motion: there at once.
    const still = Boolean(shared("kt.reducedMotion"));
    const shown = still || Boolean(this.size);
    const s = sheet(frame(this.motion, still), "kc", shown);
    const [lead, ...more] = v.parts ?? [];
    const intro = lead?.kind === "text" ? lead.lines : null;
    const rest = intro ? more : v.parts ?? [];
    // The blocks under the head, in order; they scroll when the card meets the window (or its box).
    const pieces = [
      ...((v.facts?.length || v.head) ? [this.facts(t, v.head, v.facts ?? [])] : []),
      ...(v.items?.length ? [this.list(t, null, v.items)] : []),
      ...rest.map((b) => (b.kind === "list" ? this.list(t, b.heading, b.items) : this.text(t, b.lines))),
      ...(v.warning ? [this.warning(t, v.warning)] : []),
      ...(v.consequence ? [this.consequence(t, v.consequence, v.danger ? t.ansi1 : t.dim)] : []),
    ];
    // The head, Crosstalk's: a 60 px band over the pixel dither (brand/dither-band.svg), tinted by
    // the project for a thread, a pane or a project, else by the tone (danger: ansi1, toned down);
    // the mark (the tone's icon on a soft square), the title (14 semibold) and a mono subtitle.
    const dark = settings().dark;
    const tintName = v.tint ?? null;
    const band = tintName ? (String(tintName).startsWith("#") ? tintName : t[tintName] ?? tone) : tone;
    const strength = !tintName && v.tone === "danger" ? (dark ? "40" : "33") : dark ? "6b" : "4d";
    const subtitle = (v.subtitle ?? [v.danger ? tr("sub.danger") : tr("sub.info"), tr("sub.yes"), tr("sub.no")]).filter(Boolean).join(" · ");
    const head = div()
      .id("confirm-head")
      .relative()
      .flex_none()
      .h(60)
      .overflow_hidden()
      .rounded_t(15)
      .on_size_change((size, cx) => {
        if (Math.abs((this.headW ?? 0) - size.width) < 0.5) return;
        this.headW = size.width;
        cx.notify();
      })
      // Inside the inner card's 1 px border: its radius 16 less the border.
      .when(this.headW > 30, (el) => el.child(ditherBand(this.headW, 60, 15, alpha(band, strength), TOP)))
      .child(h_flex().size_full().px(14).gap(12).items_center()
        .child(h_flex().size(32).flex_none().rounded(10).items_center().justify_center().border(1).border_color(alpha(tone, "4d")).bg(alpha(t.surface, "e6"))
          .child(svg(I(p.icon ?? toneIcon)).size(16).text_color(tone)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          // motion.js sharpen: the title comes into focus as the dialog opens, once.
          .child(sharpen(this.motion, `kc-title:${v.title ?? ""}`, () => div().truncate().text_size(14).font_semibold().text_color(t.foreground).child(v.title ?? tr("title"))))
          .child(div().truncate().font_family(MONO).text_size(10.5).text_color(t.muted).child(subtitle)))
        .child(kbd("esc")));
    // The card (radius 20, 4 px around) and its inner card (16), as kt-new.
    const card = v_flex()
      .id("confirm")
      // A press in the card never reaches the veil.
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      // Full: 460 wide, as tall as its body up to the window. In a fixed box: the box.
      .when(full, (el) => s.card(el.w(CARD).max_h(Math.max(240, (this.size?.height ?? 900) - 96))))
      .when(!full, (el) => el.size_full())
      .min_h(0)
      .p(4)
      .rounded(20)
      .bg(t.popover)
      .border(1)
      .border_color(t.border)
      .shadow_lg()
      .text_size(13)
      .child(
        v_flex()
          .when(!full, (el) => el.flex_1())
          .flex_shrink(1)
          .min_h(0)
          .rounded(16)
          .bg(t.surface)
          .border(1)
          .border_color(t.border)
          .child(head)
          .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(alpha(band, "4d")))
          // The body: the first paragraph (13 px, muted), then the blocks, all in one scrolling area:
          // in a card-sized box (kt-gwm, kt-plugins, kt-diff open it 460 × N) nothing can spill over
          // the foot. Full: as tall as the body up to the window (a bar-less scroll sizes to its
          // content; the scrollbar wrapper doesn't). In a box: what the box leaves, with a bar.
          .when(Boolean(intro) || pieces.length > 0, (el) => el.child(
            // A plain scroll (no scrollbar wrapper: that one doesn't size to its content, and a
            // dialog opened with no size, 420 wide and as tall as its content, lost its body):
            // as tall as its content, shrinking only in a box that is shorter (460 × N).
            v_flex()
              .id("detail")
              .p(16)
              .gap(10)
              .flex_shrink(1)
              .min_h(0)
              .overflow_y_scroll()
              .when(full, (el) => el.max_h(Math.max(160, (this.size?.height ?? 900) - 240)))
              .when(Boolean(intro), (el) => el.child(this.text(t, intro).pb(2)))
              .children(pieces),
          ))
          // The foot, under a dashed rule.
          .child(div().flex_none().h(0).border_t(1).border_dashed().border_color(t.border))
          .child(
            h_flex()
              .flex_none()
              .px(12)
              .py(10)
              .gap(8)
              .items_center()
              .child(h_flex().gap(5).items_center().text_size(11).text_color(t.dim).child(kbd("↵")).child(off ? tr("foot.close") : tr("foot.confirm")))
              .child(div().flex_1())
              .child(button("no", tr("cancel"), false, (_e, cx) => this.dismiss(cx)))
              .child(button("yes", v.label ?? tr("confirm"), true, (_e, cx) => this.yes(cx))),
          ),
      );
    // Fades in once, on the first size report, and out on dismiss.
    return s.veil(div()
      .id("confirm-veil")
      .size_full()
      .flex()
      .items_center()
      .justify_center())
      .track_focus(this.handle)
      // Enter and Esc with any modifier, as before; y, n and q bare.
      .on_key_down((e, cx) => {
        if (!this.act(e.key === "enter" || e.key === "escape" ? e.key : keyOf(e).name, cx)) return;
        cx.stop_propagation();
      })
      .on_size_change((size, cx) => {
        this.size = size;
        cx.notify();
      })
      // A press, not on_click: on the element holding the keyboard, GPUI turns Space and Enter into a click.
      .when(full, (el) => el.bg(veil()).when(!v.danger, (el) => el.on_mouse_down("left", (_e, cx) => this.dismiss(cx))))
      .child(card);
  }
}
